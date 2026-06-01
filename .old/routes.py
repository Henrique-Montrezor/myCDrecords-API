import os
import time
import secrets
from flask import Blueprint, render_template, request, redirect, url_for, jsonify, flash, session, abort, current_app
from flask_login import login_user, logout_user, current_user, login_required
from werkzeug.utils import secure_filename
from datetime import datetime

from extensions import db
from models import User, Review, List, ListItem, Favorite, TopAlbum, ListenItem, WeeklyRelease
from billboard_client import get_billboard_albums
from spotify_client import (
    search_albums, get_album, get_new_releases, get_recommendations, get_artist_top_tracks,
    build_authorize_url, exchange_code_for_token, refresh_user_token, get_user_profile, get_user_top_artists, get_recommendations_user,
    get_user_top_tracks, get_artist, get_artist_albums
)
from tasks import fetch_weekly_personalized_for_user
import logging
import threading
from datetime import datetime as _dt

logger = logging.getLogger(__name__)

bp = Blueprint('routes', __name__)

# Simple in-memory status for last started weekly job (for debugging/polling)
last_weekly_job = {
    'last_started_at': None,
    'last_user_id': None
}


@bp.route('/api/run-weekly', methods=['POST'], endpoint='api_run_weekly')
@login_required
def api_run_weekly():
    logger.info('api_run_weekly called by user_id=%s', getattr(current_user, 'id', None))
    app_obj = current_app._get_current_object()
    user_id = getattr(current_user, 'id', None)

    def _bg_job(app_obj, uid):
        try:
            with app_obj.app_context():
                u = User.query.get(uid)
                if u:
                    fetch_weekly_personalized_for_user(u)
                    logger.info('Background fetch completed for user_id=%s', uid)
                else:
                    logger.warning('Background fetch: user not found %s', uid)
        except Exception:
            logger.exception('Exception in background fetch for user_id=%s', uid)

    try:
        t = threading.Thread(target=_bg_job, args=(app_obj, user_id), daemon=True)
        t.start()
        last_weekly_job['last_started_at'] = _dt.utcnow().isoformat()
        last_weekly_job['last_user_id'] = user_id
        logger.info('api_run_weekly started background job for user_id=%s', user_id)
        return jsonify({'success': True, 'started': True}), 202
    except Exception as e:
        logger.exception('api_run_weekly failed to start background job for user_id=%s', user_id)
        return jsonify({'success': False, 'error': str(e)}), 500


@bp.route('/api/weekly-releases', methods=['GET'], endpoint='api_weekly_releases')
@login_required
def api_weekly_releases():
    logger.info('api_weekly_releases called by user_id=%s', getattr(current_user, 'id', None))
    releases = WeeklyRelease.query.filter_by(user_id=current_user.id).order_by(WeeklyRelease.score.desc()).all()
    data = []
    for r in releases:
        data.append({
            'id': r.spotify_id,
            'name': r.title,
            'image': r.image,
            'artist': r.artist
        })
    logger.info('api_weekly_releases returning %s items for user_id=%s', len(data), getattr(current_user, 'id', None))
    return jsonify(data)


@bp.route('/api/weekly-job-status', methods=['GET'], endpoint='api_weekly_job_status')
@login_required
def api_weekly_job_status():
    """Retorna informação mínima sobre a última execução iniciada (debug/polling)."""
    return jsonify(last_weekly_job)


@bp.route('/', endpoint='index')
def index():
    recent_reviews = Review.query.order_by(Review.created_at.desc()).limit(10).all()
    albums = []
    try:
        # Se usuário conectado e existirem lançamentos personalizados, usá-los
        if current_user.is_authenticated:
            releases = WeeklyRelease.query.filter_by(user_id=current_user.id).order_by(WeeklyRelease.score.desc()).limit(12).all()
            if releases and len(releases) > 0:
                albums = []
                for r in releases:
                    albums.append({
                        'id': r.spotify_id,
                        'name': r.title,
                        'images': [{'url': r.image}] if r.image else [],
                        'artists': [{'name': r.artist}] if r.artist else []
                    })
            else:
                albums = get_new_releases(limit=12)
        else:
            albums = get_new_releases(limit=12)
    except Exception:
        albums = []

    billboard_albums = []
    try:
        billboard_albums = get_billboard_albums(range_str='1-12')
    except Exception:
        billboard_albums = []

    recommendations = []
    user_connected_spotify = False
    rec_error = False

    if current_user.is_authenticated and current_user.spotify_access_token:
        access_token = current_user.spotify_access_token
        if current_user.spotify_token_expires and int(current_user.spotify_token_expires) < int(time.time()):
            try:
                token_info = refresh_user_token(current_user.spotify_refresh_token)
                access_token = token_info.get('access_token')
                current_user.spotify_access_token = access_token
                if token_info.get('refresh_token'):
                    current_user.spotify_refresh_token = token_info.get('refresh_token')
                current_user.spotify_token_expires = int(time.time()) + token_info.get('expires_in', 3600)
                db.session.commit()
            except Exception:
                access_token = None

        if access_token:
            user_connected_spotify = True
            raw_tracks = []
            try:
                top_artists = get_user_top_artists(access_token, limit=5)
                seed_artists_ids = [artist['id'] for artist in top_artists if artist.get('id')]
                if seed_artists_ids:
                    raw_tracks = get_recommendations_user(access_token, seed_artists=seed_artists_ids[:3], limit=20)
            except Exception:
                raw_tracks = []

            if not raw_tracks:
                try:
                    raw_tracks = get_user_top_tracks(access_token, limit=20)
                except Exception:
                    rec_error = True

            seen_albums = set()
            for track in raw_tracks:
                album_obj = track.get('album')
                if not album_obj: continue
                album_id = album_obj.get('id')
                if not album_id or album_id in seen_albums: continue
                seen_albums.add(album_id)
                img = album_obj['images'][0]['url'] if album_obj.get('images') else None
                artists_names = ', '.join([a['name'] for a in album_obj.get('artists', [])])
                recommendations.append({
                    'id': album_id,
                    'name': album_obj.get('name'),
                    'artists': artists_names,
                    'image': img,
                    'album_id': album_id
                })
                if len(recommendations) >= 12: break

    return render_template(
        'index.html',
        reviews=recent_reviews,
        albums=albums,
        recommendations=recommendations,
        trending_albums=billboard_albums,
        user_connected_spotify=user_connected_spotify,
        rec_error=rec_error
    )


@bp.route('/health', endpoint='health_check')
def health_check():
    return 'OK', 200


@bp.route('/albums', endpoint='albums_browse')
def albums_browse():
    genre = request.args.get('genre')
    genres = ['pop', 'rock', 'hip-hop', 'indie', 'jazz', 'metal', 'classical', 'electronic', 'folk', 'r-n-b', 'punk', 'alternative']
    albums_list = []
    title_display = "Novidades"
    try:
        if genre:
            title_display = f"Gênero: {genre.capitalize()}"
            albums_list = search_albums(f'genre:{genre}', limit=24)
        else:
            title_display = "Novos Lançamentos"
            if current_user.is_authenticated:
                releases = WeeklyRelease.query.filter_by(user_id=current_user.id).order_by(WeeklyRelease.score.desc()).limit(24).all()
                if releases and len(releases) > 0:
                    albums_list = []
                    for r in releases:
                        albums_list.append({
                            'id': r.spotify_id,
                            'name': r.title,
                            'images': [{'url': r.image}] if r.image else [],
                            'artists': [{'name': r.artist}] if r.artist else []
                        })
                else:
                    albums_list = get_new_releases(limit=24)
            else:
                albums_list = get_new_releases(limit=24)
    except Exception:
        flash('Erro ao carregar álbuns do Spotify.', 'danger')

    return render_template('albums.html', albums=albums_list, genres=genres, current_genre=genre, title_display=title_display)


@bp.route('/weekly-releases', endpoint='weekly_releases')
@login_required
def weekly_releases():
    releases = WeeklyRelease.query.filter_by(user_id=current_user.id).order_by(WeeklyRelease.score.desc()).all()
    # transforme para formato similar ao usado em templates
    albums = []
    for r in releases:
        albums.append({
            'id': r.spotify_id,
            'name': r.title,
            'images': [{'url': r.image}] if r.image else [],
            'artists': [{'name': r.artist}] if r.artist else []
        })
    title_display = 'Lançamentos da Semana pra Você'
    return render_template('albums.html', albums=albums, genres=[], current_genre=None, title_display=title_display)


@bp.route('/tasks/run-weekly', endpoint='run_weekly')
@login_required
def run_weekly():
    logger.info('run_weekly triggered by user_id=%s', getattr(current_user, 'id', None))
    app_obj = current_app._get_current_object()
    user_id = getattr(current_user, 'id', None)

    def _bg_job(app_obj, uid):
        try:
            with app_obj.app_context():
                u = User.query.get(uid)
                if u:
                    fetch_weekly_personalized_for_user(u)
                    logger.info('Background run_weekly completed for user_id=%s', uid)
        except Exception:
            logger.exception('Exception in background run_weekly for user_id=%s', uid)

    try:
        t = threading.Thread(target=_bg_job, args=(app_obj, user_id), daemon=True)
        t.start()
        last_weekly_job['last_started_at'] = _dt.utcnow().isoformat()
        last_weekly_job['last_user_id'] = user_id
        flash('Coleta de lançamentos iniciada em segundo plano.', 'success')
        logger.info('run_weekly started background job for user_id=%s', user_id)
    except Exception:
        logger.exception('run_weekly failed to start background job for user_id=%s', user_id)
        flash('Falha ao iniciar coleta de lançamentos.', 'danger')
    return redirect(request.referrer or url_for('index'))


# --- ROTAS DE PERFIL E SOCIAL ---

@bp.route('/perfil/<username>', endpoint='profile')
@login_required
def profile(username):
    user = User.query.filter_by(username=username).first_or_404()
    user_reviews = user.reviews.order_by(Review.created_at.desc()).limit(20).all()
    user_lists = user.lists.order_by(List.created_at.desc()).limit(5).all()
    top_albums_query = user.top_albums.all()
    top_albums_map = {ta.position: ta for ta in top_albums_query}
    listen_list = user.listen_list.order_by(ListenItem.added_at.desc()).limit(4).all()
    listen_list_count = user.listen_list.count()
    favorites = user.favorites
    followers_count = user.followers.count()
    following_count = user.followed.count()
    is_following = False
    if current_user.id != user.id:
        is_following = current_user.is_following(user)

    member_since_str = "Recentemente"
    if user.created_at:
        now = datetime.utcnow()
        diff = now - user.created_at
        if diff.days > 365:
            years = diff.days // 365
            member_since_str = f"{years} ano{'s' if years > 1 else ''}"
        elif diff.days > 30:
            months = diff.days // 30
            member_since_str = f"{months} mês{'es' if months > 1 else ''}"
        else:
            member_since_str = f"{diff.days} dia{'s' if diff.days != 1 else ''}"

    return render_template('profile.html', 
                           user=user, 
                           reviews=user_reviews, 
                           lists=user_lists, 
                           top_albums_map=top_albums_map,
                           listen_list=listen_list,
                           listen_list_count=listen_list_count,
                           favorites=favorites, 
                           followers_count=followers_count, 
                           following_count=following_count, 
                           is_following=is_following,
                           member_since=member_since_str)


@bp.route('/follow/<username>', endpoint='follow')
@login_required
def follow(username):
    user = User.query.filter_by(username=username).first()
    if user is None:
        flash('Usuário não encontrado.', 'danger')
        return redirect(url_for('index'))
    if user == current_user:
        flash('Você não pode seguir a si mesmo!', 'warning')
        return redirect(url_for('profile', username=username))
    current_user.follow(user)
    db.session.commit()
    flash(f'Você agora está seguindo {username}!', 'success')
    return redirect(url_for('profile', username=username))


@bp.route('/unfollow/<username>', endpoint='unfollow')
@login_required
def unfollow(username):
    user = User.query.filter_by(username=username).first()
    if user is None:
        flash('Usuário não encontrado.', 'danger')
        return redirect(url_for('index'))
    current_user.unfollow(user)
    db.session.commit()
    flash(f'Você deixou de seguir {username}.', 'info')
    return redirect(url_for('profile', username=username))


# --- CONFIGURAÇÕES DO USUÁRIO ---

@bp.route('/settings', methods=['GET', 'POST'], endpoint='settings')
@login_required
def settings():
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'update_info':
            new_username = request.form.get('username')
            new_email = request.form.get('email')
            new_bio = request.form.get('bio')
            user_exist = User.query.filter(User.username == new_username, User.id != current_user.id).first()
            email_exist = User.query.filter(User.email == new_email, User.id != current_user.id).first()
            if user_exist:
                flash('Este nome de usuário já está em uso.', 'danger')
            elif email_exist:
                flash('Este email já está associado a outra conta.', 'danger')
            else:
                current_user.username = new_username
                current_user.email = new_email
                current_user.bio = new_bio
                if 'profile_image' in request.files:
                    file = request.files['profile_image']
                    if file and file.filename != '':
                        filename = secure_filename(f"user_{current_user.id}_avatar_{int(time.time())}_{file.filename}")
                        file_path = os.path.join(current_app.root_path, current_app.config['UPLOAD_FOLDER'], filename)
                        try:
                            if current_user.profile_image and os.path.exists(os.path.join(current_app.root_path, 'static', current_user.profile_image)):
                                try: os.remove(os.path.join(current_app.root_path, 'static', current_user.profile_image))
                                except: pass
                            file.save(file_path)
                            current_user.profile_image = f"profile_pics/{filename}"
                        except Exception: pass
                if 'banner_image' in request.files:
                    file = request.files['banner_image']
                    if file and file.filename != '':
                        filename = secure_filename(f"user_{current_user.id}_banner_{int(time.time())}_{file.filename}")
                        file_path = os.path.join(current_app.root_path, current_app.config['UPLOAD_FOLDER'], filename)
                        try:
                            file.save(file_path)
                            current_user.banner_image = f"profile_pics/{filename}"
                        except Exception: pass
                db.session.commit()
                flash('Informações atualizadas com sucesso!', 'success')
        elif action == 'change_password':
            current_pw = request.form.get('current_password')
            new_pw = request.form.get('new_password')
            confirm_pw = request.form.get('confirm_password')
            if not current_user.check_password(current_pw):
                flash('Sua senha atual está incorreta.', 'danger')
            elif new_pw != confirm_pw:
                flash('As novas senhas não coincidem.', 'danger')
            elif len(new_pw) < 6:
                flash('A nova senha deve ter pelo menos 6 caracteres.', 'danger')
            else:
                current_user.set_password(new_pw)
                db.session.commit()
                flash('Senha alterada com sucesso!', 'success')
        return redirect(url_for('settings'))
    return render_template('settings.html')


# --- SPOTIFY AUTH ---

@bp.route('/spotify/connect', endpoint='spotify_connect')
@login_required
def spotify_connect():
    session['next_url'] = request.referrer or url_for('index')
    redirect_uri = url_for('spotify_callback', _external=True)
    state = secrets.token_urlsafe(16)
    session['spotify_oauth_state'] = state
    try:
        auth_url = build_authorize_url(redirect_uri, state=state)
    except Exception:
        flash('Erro na configuração do Spotify.', 'danger')
        return redirect(url_for('index'))
    return redirect(auth_url)


@bp.route('/spotify/callback', endpoint='spotify_callback')
def spotify_callback():
    error = request.args.get('error')
    code = request.args.get('code')
    state = request.args.get('state')
    saved_state = session.pop('spotify_oauth_state', None)
    next_url = session.pop('next_url', url_for('index'))
    if error or not code or not state or state != saved_state:
        flash('Erro de validação do Spotify.', 'danger')
        return redirect(next_url)
    redirect_uri = url_for('spotify_callback', _external=True)
    try:
        token_data = exchange_code_for_token(code, redirect_uri)
        profile_data = get_user_profile(token_data.get('access_token'))
        current_user.spotify_id = profile_data.get('id')
        current_user.spotify_access_token = token_data.get('access_token')
        current_user.spotify_refresh_token = token_data.get('refresh_token')
        current_user.spotify_token_expires = int(time.time()) + int(token_data.get('expires_in'))
        db.session.commit()
        # Tenta popular lançamentos semanais na conexão inicial
        try:
            fetch_weekly_personalized_for_user(current_user)
        except Exception:
            pass
        flash('Spotify conectado com sucesso!', 'success')
    except Exception:
        flash('Erro ao conectar com Spotify.', 'danger')
    return redirect(next_url)


@bp.route('/spotify/disconnect', endpoint='spotify_disconnect')
@login_required
def spotify_disconnect():
    current_user.spotify_id = None
    current_user.spotify_access_token = None
    current_user.spotify_refresh_token = None
    current_user.spotify_token_expires = None
    db.session.commit()
    flash('Spotify desconectado.', 'info')
    return redirect(request.referrer or url_for('settings'))


# --- DETALHES DE ÁLBUM E ARTISTA ---

@bp.route('/album/<album_id>', endpoint='album_details')
def album_details(album_id):
    album_data = None
    try:
        album_data = get_album(album_id)
    except:
        pass
    album_reviews = Review.query.filter_by(album_id=album_id).all()
    user_lists = []
    is_favorite = False
    in_listen_list = False
    is_top_album = False
    if current_user.is_authenticated:
        user_lists = List.query.filter_by(user_id=current_user.id).order_by(List.title).all()
        is_favorite = Favorite.query.filter_by(user_id=current_user.id, album_id=album_id).first() is not None
        in_listen_list = ListenItem.query.filter_by(user_id=current_user.id, album_id=album_id).first() is not None
        is_top_album = TopAlbum.query.filter_by(user_id=current_user.id, album_id=album_id).first() is not None
    return render_template('album_details.html', 
                           album=album_data, 
                           reviews=album_reviews, 
                           user_lists=user_lists, 
                           is_favorite=is_favorite,
                           in_listen_list=in_listen_list,
                           is_top_album=is_top_album)


@bp.route('/artist/<artist_id>', endpoint='artist_details')
def artist_details(artist_id):
    try:
        artist = get_artist(artist_id)
        albums = get_artist_albums(artist_id, limit=50)
        top_tracks = get_artist_top_tracks(artist_id)
        return render_template('artist_details.html', artist=artist, albums=albums, top_tracks=top_tracks)
    except:
        return redirect(url_for('index'))


# --- AUTHENTICATION ---

@bp.route('/login', methods=['GET', 'POST'], endpoint='login')
def login():
    if request.method == 'POST':
        user = User.query.filter_by(email=request.form.get('email')).first()
        if user and user.check_password(request.form.get('password')):
            login_user(user, remember=True)
            return redirect(url_for('index'))
        else:
            flash('Email ou senha incorretos.', 'danger')
    return render_template('login.html')


@bp.route('/logout', endpoint='logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))


@bp.route('/registrar', methods=['GET', 'POST'], endpoint='register')
def register():
    if request.method == 'POST':
        if User.query.filter_by(email=request.form.get('email')).first():
            flash('Este email já está em uso.', 'danger')
        elif User.query.filter_by(username=request.form.get('username')).first():
            flash('Este nome de usuário já está em uso.', 'danger')
        else:
            u = User(username=request.form.get('username'), email=request.form.get('email'))
            u.set_password(request.form.get('password'))
            db.session.add(u)
            db.session.commit()
            flash('Conta criada com sucesso! Faça login.', 'success')
            return redirect(url_for('login'))
    return render_template('register.html')


# --- LISTAS ---

@bp.route('/lists', endpoint='lists_index')
def lists_index():
    all_lists = List.query.order_by(List.created_at.desc()).limit(20).all()
    return render_template('lists.html', lists=all_lists)


@bp.route('/list/new', methods=['GET', 'POST'], endpoint='create_list')
@login_required
def create_list():
    if request.method == 'POST':
        title = request.form.get('title')
        if not title:
            flash('O título é obrigatório.', 'danger')
        else:
            l = List(title=title, description=request.form.get('description'), user_id=current_user.id)
            db.session.add(l)
            db.session.commit()
            return redirect(url_for('list_details', list_id=l.id))
    return render_template('create_list.html')


@bp.route('/list/<int:list_id>', endpoint='list_details')
def list_details(list_id):
    album_list = db.session.get(List, list_id)
    if not album_list:
        abort(404)
    return render_template('list_details.html', album_list=album_list)


# --- APIS INTERNAS (AJAX) ---

@bp.route('/api/list/add_album', methods=['POST'], endpoint='add_album_to_list')
@login_required
def add_album_to_list():
    data = request.get_json(silent=True)
    if not data: return jsonify({'error': 'Dados inválidos'}), 400
    l = db.session.get(List, data.get('list_id'))
    if not l or l.user_id != current_user.id:
        return jsonify({'error': 'Permissão negada ou lista não encontrada'}), 403
    if ListItem.query.filter_by(list_id=l.id, album_id=data.get('album_id')).first():
        return jsonify({'error': 'Este álbum já está na lista'}), 400
    new_item = ListItem(
        list_id=l.id,
        album_id=data.get('album_id'),
        album_title=data.get('album_title'),
        album_image=data.get('album_image'),
        album_artist=data.get('album_artist'),
        notes=data.get('notes')
    )
    db.session.add(new_item)
    db.session.commit()
    return jsonify({'status': 'success'})


@bp.route('/api/list/remove_item', methods=['POST'], endpoint='remove_item_from_list')
@login_required
def remove_item_from_list():
    data = request.get_json(silent=True)
    item = db.session.get(ListItem, data.get('item_id'))
    if not item or item.list.user_id != current_user.id:
        return jsonify({'error': 'Permissão negada'}), 403
    db.session.delete(item)
    db.session.commit()
    return jsonify({'status': 'success'})


@bp.route('/api/search_album', endpoint='api_search_album')
def api_search_album():
    query = request.args.get('q')
    if not query: return jsonify([])
    try:
        results = search_albums(query, limit=10)
        formatted = []
        for i in results:
            artists = ', '.join([a['name'] for a in i.get('artists', [])])
            img = i['images'][0]['url'] if i.get('images') else None
            formatted.append({
                'id': i['id'],
                'name': i['name'],
                'artists': artists,
                'image': img
            })
        return jsonify(formatted)
    except:
        return jsonify([])


@bp.route('/api/review/add', methods=['POST'], endpoint='api_add_review')
@login_required
def api_add_review():
    data = request.get_json(silent=True)
    if not data: return jsonify({'error': 'Dados inválidos'}), 400
    try:
        review = Review(
            album_id=data['album_id'],
            album_title=data['album_title'],
            album_image=data.get('album_image'),
            rating=int(data['rating']),
            text=data.get('text', ''),
            user_id=current_user.id
        )
        db.session.add(review)
        db.session.commit()
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@bp.route('/api/favorite/toggle', methods=['POST'], endpoint='toggle_favorite')
@login_required
def toggle_favorite():
    data = request.get_json(silent=True)
    if not data: return jsonify({'error': 'Dados inválidos'}), 400
    album_id = data.get('album_id')
    fav = Favorite.query.filter_by(user_id=current_user.id, album_id=album_id).first()
    if fav:
        db.session.delete(fav)
        db.session.commit()
        return jsonify({'status': 'removed', 'message': 'Removido dos favoritos'})
    else:
        new_fav = Favorite(
            user_id=current_user.id,
            album_id=album_id,
            album_title=data.get('album_title'),
            album_image=data.get('album_image'),
            album_artist=data.get('album_artist')
        )
        db.session.add(new_fav)
        db.session.commit()
        return jsonify({'status': 'added', 'message': 'Adicionado aos favoritos'})


@bp.route('/api/listen_list/toggle', methods=['POST'], endpoint='toggle_listen_list')
@login_required
def toggle_listen_list():
    data = request.get_json(silent=True)
    if not data: return jsonify({'error': 'Dados inválidos'}), 400
    album_id = data.get('album_id')
    item = ListenItem.query.filter_by(user_id=current_user.id, album_id=album_id).first()
    if item:
        db.session.delete(item)
        db.session.commit()
        return jsonify({'status': 'removed', 'message': 'Removido da Listen List'})
    else:
        new_item = ListenItem(
            user_id=current_user.id,
            album_id=album_id,
            album_title=data.get('album_title'),
            album_image=data.get('album_image'),
            album_artist=data.get('album_artist')
        )
        db.session.add(new_item)
        db.session.commit()
        return jsonify({'status': 'added', 'message': 'Adicionado à Listen List'})


@bp.route('/api/top_album/set', methods=['POST'], endpoint='set_top_album')
@login_required
def set_top_album():
    data = request.get_json(silent=True)
    if not data: return jsonify({'error': 'Dados inválidos'}), 400
    slot = int(data.get('slot'))
    if slot < 0 or slot > 3:
        return jsonify({'error': 'Slot inválido'}), 400
    existing = TopAlbum.query.filter_by(user_id=current_user.id, position=slot).first()
    if existing:
        db.session.delete(existing)
    if data.get('album_id'):
        new_top = TopAlbum(
            user_id=current_user.id,
            position=slot,
            album_id=data.get('album_id'),
            album_title=data.get('album_title'),
            album_image=data.get('album_image'),
            album_artist=data.get('album_artist')
        )
        db.session.add(new_top)
    db.session.commit()
    return jsonify({'status': 'success'})
