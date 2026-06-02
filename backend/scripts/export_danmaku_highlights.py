import argparse
import json
from pathlib import Path
from typing import Any


BUTTONS_BY_TYPE = {
    "cool": ["爽到了", "打脸成功", "继续上强度"],
    "reverse": ["这也能反转", "真相来了", "再看一遍"],
    "funny": ["笑不活了", "太好笑了", "绷不住了"],
    "sweet": ["磕到了", "甜到了", "锁死"],
    "conflict": ["怼回去", "吵起来了", "火药味来了"],
    "suspense": ["快继续", "怎么回事", "等不及了"],
    "famous_scene": ["名场面", "高能来了", "封神一刻"],
    "unknown": ["高能", "一起看", "来了"],
}


EFFECT_BY_TYPE = {
    "cool": "burst",
    "reverse": "shock",
    "funny": "float",
    "sweet": "heart",
    "conflict": "shake",
    "suspense": "pulse",
    "famous_scene": "spotlight",
    "unknown": "burst",
}


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def normalize_id(text: str) -> str:
    return (
        text.replace("：", "_")
        .replace("，", "_")
        .replace(" ", "_")
        .replace("/", "_")
        .replace("\\", "_")
    )


def export_highlights(samples: list[dict[str, Any]], top_n: int, per_type: int) -> list[dict[str, Any]]:
    positives = [item for item in samples if item.get("label") == 1]
    positives = sorted(positives, key=lambda item: item.get("danmaku_score", 0), reverse=True)

    if per_type > 0:
        selected: list[dict[str, Any]] = []
        seen_ids: set[int] = set()
        type_order = ["cool", "reverse", "suspense", "sweet", "conflict", "famous_scene", "funny", "unknown"]

        for highlight_type in type_order:
            rows = [item for item in positives if item.get("highlight_type") == highlight_type]
            for item in rows[:per_type]:
                selected.append(item)
                seen_ids.add(id(item))

        for item in positives:
            if len(selected) >= top_n:
                break
            if id(item) not in seen_ids:
                selected.append(item)
                seen_ids.add(id(item))

        positives = selected[:top_n]
    else:
        positives = positives[:top_n]

    highlights: list[dict[str, Any]] = []
    for index, item in enumerate(positives, start=1):
        highlight_type = item.get("highlight_type") or "unknown"
        drama_title = item["drama_title"]
        episode_id = item["episode_id"]
        start_time = item["start_time"]
        end_time = item["end_time"]
        score = item.get("danmaku_score", 0)

        highlights.append(
            {
                "id": f"danmaku_{index:04d}",
                "drama_title": drama_title,
                "drama_id": normalize_id(drama_title),
                "episode_id": episode_id,
                "start_time": start_time,
                "end_time": end_time,
                "type": highlight_type,
                "confidence": round(float(score), 3),
                "title": f"弹幕高热高光：{episode_id} {start_time}-{end_time}s",
                "reason": (
                    f"该时间窗口弹幕热度较高，弹幕数 {item.get('danmaku_count', 0)}，"
                    f"累计点赞 {item.get('like_sum', 0)}，情绪密度 {item.get('emotion_density', 0)}。"
                ),
                "evidence": {
                    "source": "danmaku",
                    "danmaku_count": item.get("danmaku_count", 0),
                    "like_sum": item.get("like_sum", 0),
                    "emotion_density": item.get("emotion_density", 0),
                    "sample_text": item.get("text", ""),
                },
                "interaction": {
                    "buttons": BUTTONS_BY_TYPE.get(highlight_type, BUTTONS_BY_TYPE["unknown"]),
                    "effect": EFFECT_BY_TYPE.get(highlight_type, "burst"),
                },
            }
        )

    return highlights


def main() -> None:
    parser = argparse.ArgumentParser(description="Export danmaku pseudo-labels as highlight JSON.")
    parser.add_argument("--input", required=True, help="Input danmaku training JSON path.")
    parser.add_argument("--output", required=True, help="Output highlight JSON path.")
    parser.add_argument("--top-n", type=int, default=80, help="Number of top positive windows to export.")
    parser.add_argument("--per-type", type=int, default=0, help="When > 0, export up to N windows per type first.")
    args = parser.parse_args()

    samples = load_json(Path(args.input))
    highlights = export_highlights(samples, args.top_n, args.per_type)
    save_json(Path(args.output), highlights)
    print(f"Saved {len(highlights)} danmaku highlights to {args.output}")


if __name__ == "__main__":
    main()
