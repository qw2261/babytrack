from datetime import datetime, timezone
from server import db


class Event(db.Model):
    __tablename__ = 'events'

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(20), nullable=False)
    start_time = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    end_time = db.Column(db.DateTime, nullable=True)
    amount = db.Column(db.Integer, nullable=True)
    sub_type = db.Column(db.String(20), nullable=True)
    color = db.Column(db.String(20), nullable=True)
    note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'amount': self.amount,
            'sub_type': self.sub_type,
            'color': self.color,
            'note': self.note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
