from datetime import datetime, timedelta, timezone
from flask import Blueprint, render_template, request, jsonify
from server import db
from server.models import Event

bp = Blueprint('main', __name__)

EVENT_TYPES = ['feed', 'sleep', 'diaper', 'vitamin', 'bath', 'food', 'checkup', 'temperature']


def parse_iso(s):
    if not s:
        return None
    s = s.replace('Z', '+00:00')
    return datetime.fromisoformat(s)


@bp.route('/')
def index():
    return render_template('index.html')


@bp.route('/api/events', methods=['GET'])
def get_events():
    date_str = request.args.get('date', '')
    if date_str:
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
    else:
        date = datetime.now(timezone.utc).date()

    start = datetime.combine(date, datetime.min.time())
    end = start + timedelta(days=1)

    events = Event.query.filter(
        Event.start_time >= start,
        Event.start_time < end
    ).order_by(Event.start_time.desc()).all()

    return jsonify([e.to_dict() for e in events])


@bp.route('/api/events', methods=['POST'])
def create_event():
    data = request.get_json()
    if not data or 'type' not in data:
        return jsonify({'error': 'type is required'}), 400
    if data['type'] not in EVENT_TYPES:
        return jsonify({'error': f'invalid type: {data["type"]}'}), 400

    event = Event(
        type=data['type'],
        start_time=parse_iso(data.get('start_time')),
        end_time=parse_iso(data.get('end_time')),
        amount=data.get('amount'),
        sub_type=data.get('sub_type'),
        color=data.get('color'),
        note=data.get('note'),
    )
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


@bp.route('/api/events/<int:event_id>', methods=['PUT'])
def update_event(event_id):
    event = Event.query.get_or_404(event_id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'no data'}), 400

    if 'type' in data:
        event.type = data['type']
    if 'start_time' in data:
        event.start_time = parse_iso(data['start_time'])
    if 'end_time' in data:
        event.end_time = parse_iso(data['end_time'])
    if 'amount' in data:
        event.amount = data['amount']
    if 'sub_type' in data:
        event.sub_type = data['sub_type']
    if 'color' in data:
        event.color = data['color']
    if 'note' in data:
        event.note = data['note']

    db.session.commit()
    return jsonify(event.to_dict())


@bp.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete_event(event_id):
    event = Event.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return jsonify({'ok': True})


@bp.route('/api/summary/<date>')
def summary(date):
    d = datetime.strptime(date, '%Y-%m-%d').date()
    start = datetime.combine(d, datetime.min.time())
    end = start + timedelta(days=1)

    events = Event.query.filter(
        Event.start_time >= start,
        Event.start_time < end
    ).all()

    result = {
        'feed': {'count': 0, 'total_ml': 0},
        'sleep': {'count': 0, 'total_minutes': 0},
        'diaper': {'count': 0, 'pee': 0, 'poop': 0},
        'vitamin': {'taken': False},
        'bath': {'count': 0, 'total_minutes': 0},
        'food': {'count': 0},
        'checkup': {'count': 0},
        'temperature': {'count': 0},
    }

    for e in events:
        t = e.type
        if t == 'feed':
            result['feed']['count'] += 1
            if e.amount:
                result['feed']['total_ml'] += e.amount
        elif t == 'sleep':
            result['sleep']['count'] += 1
            if e.end_time:
                delta = e.end_time - e.start_time
                result['sleep']['total_minutes'] += int(delta.total_seconds() / 60)
        elif t == 'diaper':
            result['diaper']['count'] += 1
            if e.sub_type == 'pee':
                result['diaper']['pee'] += 1
            elif e.sub_type == 'poop':
                result['diaper']['poop'] += 1
        elif t == 'vitamin':
            result['vitamin']['taken'] = True
        elif t == 'bath':
            result['bath']['count'] += 1
            if e.end_time:
                delta = e.end_time - e.start_time
                result['bath']['total_minutes'] += int(delta.total_seconds() / 60)
        elif t == 'food':
            result['food']['count'] += 1
        elif t == 'checkup':
            result['checkup']['count'] += 1
        elif t == 'temperature':
            result['temperature']['count'] += 1

    return jsonify(result)
