import json
import argparse
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.db.base import Base
from app.db.models.event import Event
from app.db.session import SessionLocal, engine


def _to_int_episode(value: object, default: int) -> int:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        m = re.search(r"\d+", value)
        if m:
            return int(m.group())
    return default


def _convert_highlights_to_events(rows: list[dict], fallback_episode_id: int) -> list[dict]:
    converted: list[dict] = []
    for idx, row in enumerate(rows, start=1):
        episode_id = _to_int_episode(row.get("episode_id"), fallback_episode_id)

        # 兼容新旧两种格式：
        #   新格式 (DoubaoClient): start_ms / end_ms 直接为毫秒 int
        #   旧格式 (原 shibie):    start_time / end_time 为秒 float
        if "trigger_start_time" in row:
            start_ms = int(float(row["trigger_start_time"]) * 1000)
            end_ms = int(float(row.get("trigger_end_time", row["trigger_start_time"])) * 1000)
        elif "start_ms" in row:
            start_ms = int(row["start_ms"])
            end_ms = int(row.get("end_ms", start_ms + 1000))
        else:
            start_ms = int(float(row.get("start_time", 0)) * 1000)
            end_ms = int(float(row.get("end_time", 0)) * 1000)

        if end_ms <= start_ms:
            end_ms = start_ms + 1000

        interaction = row.get("interaction") or {}
        payload = {
            "reason": row.get("reason", ""),
            "buttons": interaction.get("buttons", []),
            "effect": interaction.get("effect", "burst"),
            "source_format": "highlights_json",
        }

        for key in (
            "drama_id",
            "drama_title",
            "evidence",
            "detection_window",
            "trigger_score",
            "trigger_evidence",
            "refined_by",
        ):
            if key in row:
                payload[key] = row[key]

        # 保留角色信息（如有）
        character = row.get("character")
        if character:
            payload["character"] = character

        dedup = row.get("id") or row.get("segment_id") or f"hl-{episode_id}-{idx}"
        converted.append(
            {
                "episode_id": episode_id,
                "start_ms": start_ms,
                "end_ms": end_ms,
                "type": "highlight",
                "title": str(row.get("title", "高光片段")),
                "confidence": float(row.get("confidence", 0.7)),
                "source": "offline",
                "dedup_key": str(dedup),
                "event_type": str(row.get("type", "highlight")),
                "scene_tag": str(row.get("type", "general")),
                "payload": json.dumps(payload, ensure_ascii=False),
            }
        )
    return converted


def _load_rows(input_file: Path, source_format: str, fallback_episode_id: int) -> list[dict]:
    rows = json.loads(input_file.read_text(encoding="utf-8"))
    if source_format == "events":
        return rows
    return _convert_highlights_to_events(rows, fallback_episode_id)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import offline events into ShortVideo database.")
    parser.add_argument(
        "--input",
        default=str(ROOT_DIR / "data" / "demos" / "events_offline.json"),
        help="Path to input JSON file.",
    )
    parser.add_argument(
        "--source-format",
        choices=["events", "highlights"],
        default="events",
        help="Input JSON format: backend events or highlight module output.",
    )
    parser.add_argument(
        "--episode-id",
        type=int,
        default=1,
        help="Fallback episode_id when source-format=highlights and episode_id is missing/non-numeric.",
    )
    parser.add_argument(
        "--replace-episode",
        action="store_true",
        help="Delete existing events of the same episode before importing.",
    )
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    file_path = Path(args.input)
    rows = _load_rows(file_path, args.source_format, args.episode_id)

    db = SessionLocal()
    try:
        if args.replace_episode:
            episode_ids = {int(row["episode_id"]) for row in rows}
            for eid in episode_ids:
                db.query(Event).filter(Event.episode_id == eid).delete(synchronize_session=False)

        for row in rows:
            db.add(Event(**row))
        db.commit()
        print(f"imported: {len(rows)} from {file_path}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
