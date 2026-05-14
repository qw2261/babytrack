import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')

os.makedirs(DATA_DIR, exist_ok=True)

SECRET_KEY = os.environ.get('SECRET_KEY', 'babytrack-dev-secret-key-change-in-production')
SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', f'sqlite:///{os.path.join(DATA_DIR, "babytrack.db")}')
SQLALCHEMY_TRACK_MODIFICATIONS = False
