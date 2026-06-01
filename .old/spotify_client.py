import os
import time
import base64
import requests
try:
    import certifi
    CA_BUNDLE = certifi.where()
except Exception:
    CA_BUNDLE = True

_token = None
_token_expires = 0

def get_spotify_token():
    global _token, _token_expires
    if _token and time.time() < _token_expires - 60:
        return _token
    
    client_id = os.environ.get('SPOTIFY_CLIENT_ID')
    client_secret = os.environ.get('SPOTIFY_CLIENT_SECRET')
    if not client_id or not client_secret:
        raise RuntimeError('Spotify credentials not configured')
    
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    try:
        resp = requests.post('https://accounts.spotify.com/api/token',
                             data={'grant_type':'client_credentials'},
                             headers={'Authorization': f'Basic {auth}'},
                             verify=CA_BUNDLE,
                             timeout=10)
        resp.raise_for_status()
        data = resp.json()
        _token = data['access_token']
        _token_expires = time.time() + data.get('expires_in', 3600)
        return _token
    except requests.exceptions.RequestException as e:
        print(f"Erro ao obter token Spotify: {e}")
        raise

def search_albums(query, limit=10):
    token = get_spotify_token()
    resp = requests.get('https://api.spotify.com/v1/search',
                        headers={'Authorization': f'Bearer {token}'},
                        params={'q': query, 'type': 'album', 'limit': limit},
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json().get('albums', {}).get('items', [])

def get_album(album_id):
    token = get_spotify_token()
    resp = requests.get(f'https://api.spotify.com/v1/albums/{album_id}',
                        headers={'Authorization': f'Bearer {token}'},
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json()

# --- NOVAS FUNÇÕES PARA ARTISTA ---

def get_artist(artist_id):
    """ Busca informações detalhadas do artista """
    token = get_spotify_token()
    resp = requests.get(f'https://api.spotify.com/v1/artists/{artist_id}',
                        headers={'Authorization': f'Bearer {token}'},
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json()

def get_artist_albums(artist_id, limit=50, include_groups='album,single'):
    """ Busca a discografia do artista (álbuns e singles) """
    token = get_spotify_token()
    resp = requests.get(f'https://api.spotify.com/v1/artists/{artist_id}/albums',
                        headers={'Authorization': f'Bearer {token}'},
                        params={'limit': limit, 'include_groups': include_groups, 'market': 'US'}, # Market ajuda a evitar duplicatas regionais
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json().get('items', [])


def get_related_artists(artist_id):
    """Retorna artistas relacionados para um artista."""
    token = get_spotify_token()
    resp = requests.get(f'https://api.spotify.com/v1/artists/{artist_id}/related-artists',
                        headers={'Authorization': f'Bearer {token}'},
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json().get('artists', [])

# ----------------------------------

def get_new_releases(limit=10, country=None):
    token = get_spotify_token()
    params = {'limit': limit}
    if country:
        params['country'] = country
    resp = requests.get('https://api.spotify.com/v1/browse/new-releases',
                        headers={'Authorization': f'Bearer {token}'},
                        params=params,
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json().get('albums', {}).get('items', [])

def get_recommendations(seed_artists=None, seed_tracks=None, limit=10):
    token = get_spotify_token()
    params = {'limit': limit}
    # Removi o 'market' forçado para deixar a API decidir o padrão
    if seed_artists:
        params['seed_artists'] = ','.join(seed_artists)
    if seed_tracks:
        params['seed_tracks'] = ','.join(seed_tracks)
    
    resp = requests.get('https://api.spotify.com/v1/recommendations',
                        headers={'Authorization': f'Bearer {token}'},
                        params=params,
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json().get('tracks', [])

def get_artist_top_tracks(artist_id, country='US'):
    token = get_spotify_token()
    resp = requests.get(f'https://api.spotify.com/v1/artists/{artist_id}/top-tracks',
                        headers={'Authorization': f'Bearer {token}'},
                        params={'country': country},
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json().get('tracks', [])

def build_authorize_url(redirect_uri, state=None, scope='user-top-read user-read-private user-read-email'):
    client_id = os.environ.get('SPOTIFY_CLIENT_ID')
    if not client_id:
        raise RuntimeError('SPOTIFY_CLIENT_ID not configured')
    params = {
        'response_type': 'code',
        'client_id': client_id,
        'scope': scope,
        'redirect_uri': redirect_uri
    }
    if state:
        params['state'] = state
    from urllib.parse import urlencode
    return f"https://accounts.spotify.com/authorize?{urlencode(params)}"

def exchange_code_for_token(code, redirect_uri):
    client_id = os.environ.get('SPOTIFY_CLIENT_ID')
    client_secret = os.environ.get('SPOTIFY_CLIENT_SECRET')
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    resp = requests.post('https://accounts.spotify.com/api/token',
                         data={'grant_type': 'authorization_code', 'code': code, 'redirect_uri': redirect_uri},
                         headers={'Authorization': f'Basic {auth}'},
                         verify=CA_BUNDLE,
                         timeout=10)
    resp.raise_for_status()
    return resp.json()

def refresh_user_token(refresh_token):
    client_id = os.environ.get('SPOTIFY_CLIENT_ID')
    client_secret = os.environ.get('SPOTIFY_CLIENT_SECRET')
    auth = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    resp = requests.post('https://accounts.spotify.com/api/token',
                         data={'grant_type': 'refresh_token', 'refresh_token': refresh_token},
                         headers={'Authorization': f'Basic {auth}'},
                         verify=CA_BUNDLE,
                         timeout=10)
    resp.raise_for_status()
    return resp.json()

def get_user_profile(access_token):
    resp = requests.get('https://api.spotify.com/v1/me', 
                        headers={'Authorization': f'Bearer {access_token}'}, 
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json()

def get_user_top_artists(access_token, limit=5, time_range='medium_term'):
    resp = requests.get('https://api.spotify.com/v1/me/top/artists', 
                        headers={'Authorization': f'Bearer {access_token}'}, 
                        params={'limit': limit, 'time_range': time_range}, 
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json().get('items', [])

# NOVA FUNÇÃO: Adiciona fallback de Top Tracks do usuário
def get_user_top_tracks(access_token, limit=10, time_range='short_term'):
    """
    Busca as faixas mais ouvidas do próprio usuário.
    Útil como fallback quando as recomendações falham.
    """
    resp = requests.get('https://api.spotify.com/v1/me/top/tracks', 
                        headers={'Authorization': f'Bearer {access_token}'}, 
                        params={'limit': limit, 'time_range': time_range}, 
                        verify=CA_BUNDLE,
                        timeout=10)
    resp.raise_for_status()
    return resp.json().get('items', [])

def get_recommendations_user(access_token, seed_artists=None, seed_tracks=None, seed_genres=None, limit=10):
    """
    Tenta buscar recomendações. Se falhar ou seeds forem inválidos, retorna lista vazia.
    """
    params = {'limit': limit}
    # Removemos market='from_token' pois em algumas contas gera erro 404 se o catálogo não bater
    
    count = 0
    
    # Limita seeds e monta string
    if seed_artists:
        if isinstance(seed_artists, str): seed_artists = [seed_artists]
        chosen = seed_artists[:5]
        params['seed_artists'] = ','.join(chosen)
        count += len(chosen)
    
    if seed_tracks and count < 5:
        if isinstance(seed_tracks, str): seed_tracks = [seed_tracks]
        chosen = seed_tracks[:5-count]
        params['seed_tracks'] = ','.join(chosen)
        count += len(chosen)

    if seed_genres and count < 5:
        if isinstance(seed_genres, str): seed_genres = [seed_genres]
        chosen = seed_genres[:5-count]
        params['seed_genres'] = ','.join(chosen)

    if count == 0:
        return []

    # Requisição padrão limpa
    resp = requests.get('https://api.spotify.com/v1/recommendations', 
                        headers={'Authorization': f'Bearer {access_token}'}, 
                        params=params, 
                        verify=CA_BUNDLE,
                        timeout=10)
    
    resp.raise_for_status()
    return resp.json().get('tracks', [])