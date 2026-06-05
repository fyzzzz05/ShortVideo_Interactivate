import argparse
import csv
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.db.base import Base
from app.db.models.danmaku import Danmaku
from app.db.session import SessionLocal, engine


DRAMA_COL = "剧名称"
EPISODE_COL = "group_title"
TIME_COL = "发弹幕时刻相对于视频起始时间偏移量"
LIKE_COL = "累计点赞数"
CONTENT_COL = "弹幕内容"


def _to_int(value: object, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(float(str(value).strip()))
    except ValueError:
        return default


def _episode_id(title: str) -> int | None:
    match = re.search(r"\d+", title or "")
    if not match:
        return None
    return int(match.group())


def _iter_rows(csv_path: Path):
    with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file, delimiter="\t")
        for row in reader:
            content = (row.get(CONTENT_COL) or "").strip()
            drama_title = (row.get(DRAMA_COL) or "").strip()
            episode_title = (row.get(EPISODE_COL) or "").strip()
            if not content or not drama_title or not episode_title:
                continue
            yield Danmaku(
                drama_title=drama_title,
                episode_title=episode_title,
                episode_id=_episode_id(episode_title),
                time_ms=_to_int(row.get(TIME_COL)),
                like_count=_to_int(row.get(LIKE_COL)),
                content=content,
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Import danmaku CSV into ShortVideo database.")
    parser.add_argument(
        "--input",
        default=str(ROOT_DIR / "data" / "danmu.csv"),
        help="Path to tab-separated danmaku CSV.",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Delete existing danmaku rows before importing.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Commit rows in batches.",
    )
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    imported = 0
    skipped = 0
    batch: list[Danmaku] = []

    try:
        if args.replace:
            db.query(Danmaku).delete(synchronize_session=False)
            db.commit()

        for item in _iter_rows(Path(args.input)):
            batch.append(item)
            if len(batch) < args.batch_size:
                continue
            db.bulk_save_objects(batch)
            try:
                db.commit()
                imported += len(batch)
            except Exception:
                db.rollback()
                skipped += len(batch)
            batch.clear()

        if batch:
            db.bulk_save_objects(batch)
            try:
                db.commit()
                imported += len(batch)
            except Exception:
                db.rollback()
                skipped += len(batch)

        print(f"imported: {imported}")
        print(f"skipped: {skipped}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
