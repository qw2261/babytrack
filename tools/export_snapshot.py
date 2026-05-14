#!/usr/bin/env python3
"""导出最近 14 天数据为 snapshot.json。"""
import json
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server import create_app

app = create_app()

with app.app_context():
    from server.models import Event

    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=13)

    start = datetime.combine(start_date, datetime.min.time())
    end = datetime.combine(end_date, datetime.max.time())

    events = Event.query.filter(
        Event.start_time >= start,
        Event.start_time <= end
    ).order_by(Event.start_time.desc()).all()

    data = [e.to_dict() for e in events]

    output_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'docs', 'data'
    )
    os.makedirs(output_dir, exist_ok=True)

    output_path = os.path.join(output_dir, 'snapshot.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f'Exported {len(data)} events to {output_path}')
