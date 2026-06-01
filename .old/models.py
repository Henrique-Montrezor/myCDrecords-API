from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from extensions import db  # Importa do extensions.py
from datetime import datetime

# --- TABELA DE ASSOCIAÇÃO PARA SEGUIDORES ---
followers = db.Table('followers',
    db.Column('follower_id', db.Integer, db.ForeignKey('user.id')),
    db.Column('followed_id', db.Integer, db.ForeignKey('user.id'))
)

# --- MODELOS ---

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    
    # Perfil e Tempo de Casa
    profile_image = db.Column(db.String(255), nullable=True)
    banner_image = db.Column(db.String(255), nullable=True) # Banner do perfil
    bio = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow) # Data de registro
    
    # Integração Spotify
    spotify_id = db.Column(db.String(128), nullable=True)
    spotify_access_token = db.Column(db.String(512), nullable=True)
    spotify_refresh_token = db.Column(db.String(512), nullable=True)
    spotify_token_expires = db.Column(db.Integer, nullable=True)
    
    # Relacionamentos
    reviews = db.relationship('Review', backref='author', lazy='dynamic')
    lists = db.relationship('List', backref='creator', lazy='dynamic')
    favorites = db.relationship('Favorite', backref='user', lazy=True) # Favoritos Gerais
    top_albums = db.relationship('TopAlbum', backref='user', lazy='dynamic') # Top 4 (Defining Albums)
    listen_list = db.relationship('ListenItem', backref='user', lazy='dynamic') # Quero Ouvir

    # Seguidores (Many-to-Many)
    followed = db.relationship(
        'User', secondary=followers,
        primaryjoin=(followers.c.follower_id == id),
        secondaryjoin=(followers.c.followed_id == id),
        backref=db.backref('followers', lazy='dynamic'), lazy='dynamic'
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def follow(self, user):
        if not self.is_following(user):
            self.followed.append(user)

    def unfollow(self, user):
        if self.is_following(user):
            self.followed.remove(user)

    def is_following(self, user):
        return self.followed.filter(
            followers.c.followed_id == user.id).count() > 0

class TopAlbum(db.Model):
    """ Modelo para os 4 álbuns 'Defining' do perfil com posição fixa """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    position = db.Column(db.Integer, nullable=False) # 0, 1, 2, 3
    album_id = db.Column(db.String(50), nullable=False)
    album_title = db.Column(db.String(200), nullable=False)
    album_image = db.Column(db.String(500), nullable=True)
    album_artist = db.Column(db.String(200), nullable=True)


class WeeklyRelease(db.Model):
    """Lançamentos semanais personalizados por usuário."""
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    spotify_id = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(300), nullable=False)
    image = db.Column(db.String(500), nullable=True)
    artist = db.Column(db.String(300), nullable=True)
    release_date = db.Column(db.Date, nullable=True)
    score = db.Column(db.Float, default=0.0)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

class ListenItem(db.Model):
    """ Watchlist / Quero Ouvir """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    album_id = db.Column(db.String(50), nullable=False)
    album_title = db.Column(db.String(200), nullable=False)
    album_image = db.Column(db.String(500), nullable=True)
    album_artist = db.Column(db.String(200), nullable=True)
    added_at = db.Column(db.DateTime, default=datetime.utcnow)


class Favorite(db.Model):
    """ Favoritos Gerais (Like) """
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    album_id = db.Column(db.String(50), nullable=False)
    album_title = db.Column(db.String(200), nullable=False)
    album_image = db.Column(db.String(500), nullable=True)
    album_artist = db.Column(db.String(200), nullable=True)

# --- Funções utilitárias para tendências globais ---
from sqlalchemy import func

def get_trending_albums(limit=12):
    """
    Retorna os álbuns mais populares considerando favoritos, listen list e reviews.
    """
    # Conta favoritos
    favs = db.session.query(Favorite.album_id, Favorite.album_title, Favorite.album_image, Favorite.album_artist, func.count(Favorite.id).label('fav_count'))\
        .group_by(Favorite.album_id).subquery()
    # Conta listen list
    listens = db.session.query(ListenItem.album_id, func.count(ListenItem.id).label('listen_count'))\
        .group_by(ListenItem.album_id).subquery()
    # Conta reviews
    reviews = db.session.query(Review.album_id, func.count(Review.id).label('review_count'))\
        .group_by(Review.album_id).subquery()

    # Junta tudo por album_id
    q = db.session.query(
        favs.c.album_id,
        favs.c.album_title,
        favs.c.album_image,
        favs.c.album_artist,
        (func.coalesce(favs.c.fav_count, 0) + func.coalesce(listens.c.listen_count, 0) + func.coalesce(reviews.c.review_count, 0)).label('score')
    )\
    .outerjoin(listens, favs.c.album_id == listens.c.album_id)\
    .outerjoin(reviews, favs.c.album_id == reviews.c.album_id)\
    .order_by(func.coalesce(favs.c.fav_count, 0) + func.coalesce(listens.c.listen_count, 0) + func.coalesce(reviews.c.review_count, 0).desc())\
    .limit(limit)
    return q.all()

class Review(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    album_id = db.Column(db.String(50), nullable=False)
    album_title = db.Column(db.String(200), nullable=False)
    album_image = db.Column(db.String(500), nullable=True)
    rating = db.Column(db.Integer, nullable=False)
    text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class List(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    items = db.relationship('ListItem', backref='list', cascade="all, delete-orphan", lazy=True)

class ListItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('list.id'), nullable=False)
    album_id = db.Column(db.String(50), nullable=False)
    album_title = db.Column(db.String(200), nullable=False)
    album_image = db.Column(db.String(500), nullable=True)
    album_artist = db.Column(db.String(200), nullable=True) 
    added_at = db.Column(db.DateTime, default=datetime.utcnow)
    notes = db.Column(db.Text, nullable=True)