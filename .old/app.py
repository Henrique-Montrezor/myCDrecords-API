import os
import time
import secrets
#from flask import Flask, render_template, request, redirect, url_for, jsonify, flash, session, abort
#from flask_login import LoginManager, login_user, logout_user, current_user, login_required
from werkzeug.utils import secure_filename
from datetime import datetime

# Importa o db do extensions para evitar erro circular
from extensions import db
# Importa os modelos
from models import User, Review, List, ListItem, Favorite, TopAlbum, ListenItem
from billboard_client import get_billboard_albums
# Importa o cliente Spotify
from spotify_client import (
    search_albums, get_album, get_new_releases, get_recommendations, get_artist_top_tracks,
    build_authorize_url, exchange_code_for_token, refresh_user_token, get_user_profile, get_user_top_artists, get_recommendations_user,
    get_user_top_tracks, get_artist, get_artist_albums
)

from dotenv import load_dotenv, find_dotenv
DOTENV_PATH = find_dotenv()
if DOTENV_PATH:
    load_dotenv(DOTENV_PATH)
else:
    load_dotenv()

#app = Flask(__name__)

import logging
logging.basicConfig(level=logging.INFO)

# Configurações do App
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'uma_chave_secreta_muito_forte_padrao')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
UPLOAD_FOLDER = os.path.join('static', 'profile_pics')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'  # Nome da função da sua rota de login
login_manager.login_message = "Por favor, faça login para acessar esta página."
login_manager.login_message_category = "info"

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Chaves API (Opcional)
MUSIC_API_KEY = os.environ.get('MUSIC_API_KEY')
MUSIC_API_URL = os.environ.get('MUSIC_API_URL', 'https://api.themoviedb.org/3')

# Routes are moved to `routes.py` to keep app structure clean
from routes import bp as routes_bp
app.register_blueprint(routes_bp)

# Scheduler de tarefas (lançamentos semanais)
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    from tasks import fetch_weekly_all_users
    _HAS_SCHEDULER = True
except Exception:
    _HAS_SCHEDULER = False

# Compatibilidade: cria aliases sem prefixo para endpoints do blueprint
for rule in list(app.url_map.iter_rules()):
    ep = rule.endpoint
    if ep.startswith(f"{routes_bp.name}."):
        short = ep.split('.', 1)[1]
        # evita sobrescrever endpoints já existentes
        if short not in app.view_functions:
            view = app.view_functions.get(ep)
            if view:
                app.add_url_rule(rule.rule, endpoint=short, view_func=view, methods=rule.methods)

if __name__ == '__main__':
    db.init_app(app)
    with app.app_context():
        db.create_all()
        if _HAS_SCHEDULER:
            scheduler = BackgroundScheduler()
            # Executa toda segunda às 02:00 (ajuste conforme necessário)
            scheduler.add_job(fetch_weekly_all_users, 'cron', day_of_week='mon', hour=2)
            scheduler.start()
    app.run(debug=True, port=5000)