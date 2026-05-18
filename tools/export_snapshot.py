#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from server import create_app, db
from server.models import Event


def main():
    app = create_app()
    with app.app_context():
        days = int(os.environ.get("SNAPSHOT_DAYS", "14"))
        since = datetime.now(timezone.utc) - timedelta(days=days)
        events = (
            Event.query.filter(Event.start_time >= since)
            .order_by(Event.start_time.desc())
            .all()
        )

        data = {"exported_at": datetime.now(timezone.utc).isoformat(), "events": [e.to_dict() for e in events]}

        output_path = os.environ.get("SNAPSHOT_OUTPUT", str(BASE_DIR / "docs" / "data" / "snapshot.json"))
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

        print(f"Exported {len(events)} events to {output_path}")


if __name__ == "__main__":
    main()
