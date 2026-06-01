from datetime import datetime, timedelta
from extensions import db
from models import User, WeeklyRelease
import logging
from spotify_client import (
    refresh_user_token, get_user_top_artists, get_artist_albums, get_user_top_tracks, get_recommendations_user,
    get_new_releases, get_artist, get_related_artists
)

logger = logging.getLogger(__name__)

def parse_release_date(date_str):
    # Spotify can return YYYY, YYYY-MM or YYYY-MM-DD
    if not date_str:
        return None
    try:
        if len(date_str) == 4:
            return datetime.strptime(date_str, '%Y').date()
        if len(date_str) == 7:
            return datetime.strptime(date_str, '%Y-%m').date()
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except Exception:
        return None


def fetch_weekly_personalized_for_user(user):
    """Busca lançamentos recentes (últimos 7 dias) baseados nos top artists do usuário."""
    if not user.spotify_refresh_token:
        return

    try:
        token_info = refresh_user_token(user.spotify_refresh_token)
        access_token = token_info.get('access_token')
        # Atualiza tokens locais se vierem
        user.spotify_access_token = access_token
        if token_info.get('refresh_token'):
            user.spotify_refresh_token = token_info.get('refresh_token')
        user.spotify_token_expires = int(datetime.utcnow().timestamp()) + int(token_info.get('expires_in', 3600))
        db.session.commit()
        logger.info('Refreshed token for user_id=%s', user.id)
    except Exception as e:
        logger.exception('Failed to refresh token for user_id=%s', getattr(user, 'id', None))
        return

    try:
        top_artists = get_user_top_artists(access_token, limit=10)
    except Exception as e:
        logger.exception('Failed to get top artists for user_id=%s', getattr(user, 'id', None))
        top_artists = []

    # Use 14 days window for 'recent' releases per user's preference
    cutoff = (datetime.utcnow() - timedelta(days=14)).date()

    found = {}
    for idx, artist in enumerate(top_artists):
        artist_id = artist.get('id')
        if not artist_id:
            continue
        try:
            albums = get_artist_albums(artist_id, limit=50)
        except Exception:
            logger.exception('Failed to get albums for artist_id=%s (user_id=%s)', artist_id, getattr(user, 'id', None))
            albums = []

        for alb in albums:
            rel = parse_release_date(alb.get('release_date'))
            if not rel or rel < cutoff:
                continue
            aid = alb.get('id')
            if not aid:
                continue
            # score: baseia-se na posição do artista (melhor artista => maior peso)
            score = max(0, 10 - idx)
            # aumenta pontuação se já existir com menor score
            existing = found.get(aid)
            if existing:
                if score > existing['score']:
                    existing['score'] = score
            else:
                found[aid] = {
                    'spotify_id': aid,
                    'title': alb.get('name'),
                    'image': (alb.get('images') or [{}])[0].get('url'),
                    'artist': ', '.join([a.get('name') for a in alb.get('artists', []) if a.get('name')]) or None,
                    'release_date': rel,
                    'score': score
                }

    # Persiste apenas os top N resultados recentes (ordenados por score)
    try:
        WeeklyRelease.query.filter_by(user_id=user.id).delete()
        # ordenar por score desc e limitar
        sorted_vals = sorted(found.values(), key=lambda x: x.get('score', 0), reverse=True)[:24]
        for v in sorted_vals:
            wr = WeeklyRelease(
                user_id=user.id,
                spotify_id=v['spotify_id'],
                title=v['title'] or 'Unknown',
                image=v.get('image'),
                artist=v.get('artist'),
                release_date=v.get('release_date'),
                score=v.get('score', 0.0)
            )
            db.session.add(wr)
        db.session.commit()
        logger.info('Persisted %s weekly releases for user_id=%s', len(sorted_vals), user.id)
    except Exception:
        logger.exception('Failed to persist weekly releases for user_id=%s', user.id)
        db.session.rollback()

    # Fallback: se nada encontrado, tente derivar a partir das faixas top do usuário
    if len(found) == 0:
        try:
            top_tracks = get_user_top_tracks(access_token, limit=20)
        except Exception:
            top_tracks = []

        for t in top_tracks:
            album_obj = t.get('album')
            if not album_obj:
                continue
            aid = album_obj.get('id')
            rel = parse_release_date(album_obj.get('release_date'))
            if not aid or not rel or rel < cutoff:
                continue
            if aid not in found:
                found[aid] = {
                    'spotify_id': aid,
                    'title': album_obj.get('name'),
                    'image': (album_obj.get('images') or [{}])[0].get('url'),
                    'artist': ', '.join([a.get('name') for a in album_obj.get('artists', []) if a.get('name')]) or None,
                    'release_date': rel,
                    'score': 1.0
                }
        # persiste fallback caso tenha encontrado algo
        if len(found) > 0:
            try:
                WeeklyRelease.query.filter_by(user_id=user.id).delete()
                for v in found.values():
                    wr = WeeklyRelease(
                        user_id=user.id,
                        spotify_id=v['spotify_id'],
                        title=v['title'] or 'Unknown',
                        image=v.get('image'),
                        artist=v.get('artist'),
                        release_date=v.get('release_date'),
                        score=v.get('score', 0.0)
                    )
                    db.session.add(wr)
                db.session.commit()
            except Exception:
                db.session.rollback()

    # Não incluir fallback que não seja baseado em releases com release_date recente.
    # Se `found` estiver vazio, manter a lista vazia (não poluir com álbuns antigos).
    # Fallback adicional: buscar lançamentos recentes em artistas relacionados
    if len(found) == 0 and top_artists:
        related_checked = set()
        for artist in top_artists:
            aid = artist.get('id')
            if not aid:
                continue
            try:
                related = get_related_artists(aid)
            except Exception:
                related = []
            for ra in related[:10]:
                ra_id = ra.get('id')
                if not ra_id or ra_id in related_checked:
                    continue
                related_checked.add(ra_id)
                try:
                    albums = get_artist_albums(ra_id, limit=50)
                except Exception:
                    albums = []
                for alb in albums:
                    rel = parse_release_date(alb.get('release_date'))
                    if not rel or rel < cutoff:
                        continue
                    aid2 = alb.get('id')
                    if not aid2:
                        continue
                    score = 1.0
                    existing = found.get(aid2)
                    if existing:
                        if score > existing['score']:
                            existing['score'] = score
                    else:
                        found[aid2] = {
                            'spotify_id': aid2,
                            'title': alb.get('name'),
                            'image': (alb.get('images') or [{}])[0].get('url'),
                            'artist': ', '.join([a.get('name') for a in alb.get('artists', []) if a.get('name')]) or None,
                            'release_date': rel,
                            'score': score
                        }
        # persiste se encontrou algo
        if len(found) > 0:
            try:
                WeeklyRelease.query.filter_by(user_id=user.id).delete()
                sorted_vals = sorted(found.values(), key=lambda x: x.get('score', 0), reverse=True)[:24]
                for v in sorted_vals:
                    wr = WeeklyRelease(
                        user_id=user.id,
                        spotify_id=v['spotify_id'],
                        title=v['title'] or 'Unknown',
                        image=v.get('image'),
                        artist=v.get('artist'),
                        release_date=v.get('release_date'),
                        score=v.get('score', 0.0)
                    )
                    db.session.add(wr)
                db.session.commit()
            except Exception:
                db.session.rollback()
    # Final fallback: se ainda vazio, use novos lançamentos globais diretamente (garante conteúdo)
    if len(found) == 0:
        try:
            new_albums = get_new_releases(limit=24)
        except Exception:
            new_albums = []
        if new_albums:
            try:
                WeeklyRelease.query.filter_by(user_id=user.id).delete()
                for alb in new_albums:
                    rel = parse_release_date(alb.get('release_date'))
                    wr = WeeklyRelease(
                        user_id=user.id,
                        spotify_id=alb.get('id'),
                        title=alb.get('name') or 'Unknown',
                        image=(alb.get('images') or [{}])[0].get('url'),
                        artist=', '.join([a.get('name') for a in alb.get('artists', []) if a.get('name')]) or None,
                        release_date=rel,
                        score=0.0
                    )
                    db.session.add(wr)
                db.session.commit()
            except Exception:
                db.session.rollback()

    # Último recurso: usar 'new releases' globais e ranquear por similaridade de gêneros
    if len(found) == 0:
        try:
            new_albums = get_new_releases(limit=50)
        except Exception:
            new_albums = []

        # coleta gêneros dos top artists do usuário
        user_genres = set()
        for a in top_artists:
            try:
                art = get_artist(a.get('id'))
                for g in art.get('genres', []) or []:
                    user_genres.add(g)
            except Exception:
                continue

        for alb in new_albums:
            rel = parse_release_date(alb.get('release_date'))
            if not rel:
                continue
            # usar janela maior para global fallback (90 dias)
            gcutoff = (datetime.utcnow() - timedelta(days=90)).date()
            if rel < gcutoff:
                continue
            aid = alb.get('id')
            if not aid:
                continue
            # compute genre overlap score
            album_genres = set()
            for ar in alb.get('artists', []):
                try:
                    art = get_artist(ar.get('id'))
                    for g in art.get('genres', []) or []:
                        album_genres.add(g)
                except Exception:
                    continue
            overlap = len(user_genres & album_genres)
            score = float(overlap)
            if score <= 0:
                # small boost if artist is in user's top artists
                if any(ar.get('id') in [ta.get('id') for ta in top_artists] for ar in alb.get('artists', [])):
                    score = 0.5
                else:
                    # ignore if no similarity
                    continue

            found[aid] = {
                'spotify_id': aid,
                'title': alb.get('name'),
                'image': (alb.get('images') or [{}])[0].get('url'),
                'artist': ', '.join([a.get('name') for a in alb.get('artists', []) if a.get('name')]) or None,
                'release_date': rel,
                'score': score
            }

        if len(found) > 0:
            try:
                WeeklyRelease.query.filter_by(user_id=user.id).delete()
                sorted_vals = sorted(found.values(), key=lambda x: x.get('score', 0), reverse=True)[:24]
                for v in sorted_vals:
                    wr = WeeklyRelease(
                        user_id=user.id,
                        spotify_id=v['spotify_id'],
                        title=v['title'] or 'Unknown',
                        image=v.get('image'),
                        artist=v.get('artist'),
                        release_date=v.get('release_date'),
                        score=v.get('score', 0.0)
                    )
                    db.session.add(wr)
                db.session.commit()
            except Exception:
                db.session.rollback()


def fetch_weekly_all_users():
    users = User.query.filter(User.spotify_refresh_token != None).all()
    for u in users:
        try:
            fetch_weekly_personalized_for_user(u)
        except Exception:
            # ignora falhas por usuário
            continue
