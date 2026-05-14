from flask import Flask
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app():
    app = Flask(__name__)
    app.config.from_object('config')
    db.init_app(app)

    with app.app_context():
        from server import models  # noqa: F401
        db.create_all()

    from server import routes  # noqa: F401
    app.register_blueprint(routes.bp)

    return app
