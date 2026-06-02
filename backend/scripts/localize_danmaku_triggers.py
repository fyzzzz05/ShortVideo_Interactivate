import argparse
import csv
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any


DRAMA_COL = "剧名称"
EPISODE_COL = "group_title"
OFFSET_COL = "发弹幕时刻相对于视频起始时间偏移量"
LIKE_COL = "累计点赞数"
TEXT_COL = "弹幕内容"


KEYWORDS = {
    "cool": ["爽", "解气", "打脸", "牛", "燃", "霸气", "帅", "绝", "太强", "开挂"],
    "reverse": ["反转", "居然", "竟然", "原来", "没想到", "真相", "身份", "藏", "秘密"],
    "funny": ["哈哈", "笑", "捂脸", "大笑", "乐", "笑死", "搞笑"],
    "sweet": ["甜", "磕", "喜欢", "爱", "亲", "送心", "爱慕", "好配"],
    "conflict": ["吵", "骂", "打", "怼", "滚", "贱", "离婚", "复仇", "报仇"],
    "suspense": ["啊", "？", "?", "怎么", "为什么", "快", "急", "后面", "然后呢"],
    "famous_scene": ["名场面", "高能", "来了", "经典", "泪目", "哭", "封神"],
}


def open_csv(path: Path):
    for encoding in ("utf-8-sig", "gb18030", "gbk"):
        try:
            file = path.open("r", encoding=encoding, newline="")
            file.read(2048)
            file.seek(0)
            return file
        except UnicodeDecodeError:
            continue
    raise RuntimeError("Cannot detect CSV encoding")


def to_int(value: str, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def emotion_hits(text: str) -> int:
    hits = 0
    for words in KEYWORDS.values():
        for word in words:
            if word in text:
                hits += 1
    return hits


def load_danmaku(csv_path: Path) -> dict[tuple[str, str], list[dict[str, Any]]]:
    rows_by_episode: dict[tuple[str, str], list[dict[str, Any]]] = {}

    with open_csv(csv_path) as file:
        reader = csv.DictReader(file)
        required = {DRAMA_COL, EPISODE_COL, OFFSET_COL, LIKE_COL, TEXT_COL}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise RuntimeError(f"CSV 缺少列: {', '.join(sorted(missing))}")

        for row in reader:
            drama = row[DRAMA_COL].strip()
            episode = row[EPISODE_COL].strip()
            item = {
                "time": to_int(row[OFFSET_COL]) / 1000,
                "likes": to_int(row[LIKE_COL]),
                "text": row[TEXT_COL].strip(),
            }
            rows_by_episode.setdefault((drama, episode), []).append(item)

    return rows_by_episode


def build_subwindows(start: float, end: float, subwindow_seconds: int) -> list[dict[str, Any]]:
    windows: list[dict[str, Any]] = []
    current = start
    while current < end:
        windows.append(
            {
                "start": current,
                "end": min(current + subwindow_seconds, end),
                "danmaku_count": 0,
                "like_sum": 0,
                "emotion_hits": 0,
                "comments": [],
            }
        )
        current += subwindow_seconds
    return windows


def localize_one(
    highlight: dict[str, Any],
    episode_rows: list[dict[str, Any]],
    subwindow_seconds: int,
) -> dict[str, Any]:
    start = float(highlight["start_time"])
    end = float(highlight["end_time"])
    subwindows = build_subwindows(start, end, subwindow_seconds)

    for row in episode_rows:
        time = float(row["time"])
        if time < start or time >= end:
            continue

        index = min(int((time - start) // subwindow_seconds), len(subwindows) - 1)
        window = subwindows[index]
        window["danmaku_count"] += 1
        window["like_sum"] += int(row["likes"])
        window["emotion_hits"] += emotion_hits(str(row["text"]))
        if len(window["comments"]) < 8:
            window["comments"].append({"text": row["text"], "likes": row["likes"], "time": round(time, 3)})

    max_count = max((item["danmaku_count"] for item in subwindows), default=1) or 1
    max_like = max((item["like_sum"] for item in subwindows), default=1) or 1

    for window in subwindows:
        density = window["emotion_hits"] / max(window["danmaku_count"], 1)
        window["emotion_density"] = round(density, 4)
        window["trigger_score"] = round(
            0.55 * (window["danmaku_count"] / max_count)
            + 0.25 * (math.log1p(window["like_sum"]) / math.log1p(max_like))
            + 0.20 * min(density, 1.0),
            4,
        )
        window["comments"] = sorted(window["comments"], key=lambda item: item["likes"], reverse=True)[:3]

    best = max(subwindows, key=lambda item: item["trigger_score"]) if subwindows else None
    refined = dict(highlight)
    refined["detection_window"] = {
        "start_time": start,
        "end_time": end,
        "window_seconds": round(end - start, 3),
    }

    if best:
        refined["trigger_start_time"] = round(float(best["start"]), 3)
        refined["trigger_end_time"] = round(float(best["end"]), 3)
        refined["trigger_duration"] = round(float(best["end"]) - float(best["start"]), 3)
        refined["trigger_score"] = best["trigger_score"]
        refined["trigger_evidence"] = {
            "subwindow_seconds": subwindow_seconds,
            "danmaku_count": best["danmaku_count"],
            "like_sum": best["like_sum"],
            "emotion_density": best["emotion_density"],
            "sample_comments": best["comments"],
            "all_subwindows": [
                {
                    "start_time": round(float(item["start"]), 3),
                    "end_time": round(float(item["end"]), 3),
                    "danmaku_count": item["danmaku_count"],
                    "like_sum": item["like_sum"],
                    "emotion_density": item["emotion_density"],
                    "trigger_score": item["trigger_score"],
                }
                for item in subwindows
            ],
        }

    return refined


def main() -> None:
    parser = argparse.ArgumentParser(description="Localize 15s danmaku highlights into 4-5s trigger windows.")
    parser.add_argument("--csv", required=True, help="Original danmaku CSV path.")
    parser.add_argument("--input", required=True, help="Input refined highlight JSON path.")
    parser.add_argument("--output", required=True, help="Output localized highlight JSON path.")
    parser.add_argument("--subwindow", type=int, default=5, help="Subwindow size in seconds.")
    args = parser.parse_args()

    rows_by_episode = load_danmaku(Path(args.csv))
    highlights = json.loads(Path(args.input).read_text(encoding="utf-8"))
    localized: list[dict[str, Any]] = []

    for highlight in highlights:
        key = (highlight["drama_title"], highlight["episode_id"])
        localized.append(localize_one(highlight, rows_by_episode.get(key, []), args.subwindow))

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(localized, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(localized)} localized highlights to {output_path}")


if __name__ == "__main__":
    main()
