import argparse
import csv
import json
import math
from collections import Counter, defaultdict
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
            file.read(1024)
            file.seek(0)
            return file
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, "Cannot detect CSV encoding")


def to_int(value: str, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def classify_text(text: str) -> tuple[str, int]:
    scores: Counter[str] = Counter()
    for label, words in KEYWORDS.items():
        for word in words:
            if word in text:
                scores[label] += 1

    if not scores:
        return "unknown", 0

    label, score = scores.most_common(1)[0]
    return label, score


def build_features(csv_path: Path, window_seconds: int) -> list[dict[str, Any]]:
    groups: dict[tuple[str, str, int], dict[str, Any]] = {}

    with open_csv(csv_path) as file:
        reader = csv.DictReader(file)
        missing = {DRAMA_COL, EPISODE_COL, OFFSET_COL, LIKE_COL, TEXT_COL} - set(reader.fieldnames or [])
        if missing:
            raise RuntimeError(f"CSV 缺少列: {', '.join(sorted(missing))}")

        for row in reader:
            drama = row[DRAMA_COL].strip()
            episode = row[EPISODE_COL].strip()
            offset_ms = to_int(row[OFFSET_COL])
            offset_sec = offset_ms / 1000
            window_start = int(offset_sec // window_seconds) * window_seconds
            window_end = window_start + window_seconds
            likes = to_int(row[LIKE_COL])
            text = row[TEXT_COL].strip()
            label, emotion_hits = classify_text(text)
            key = (drama, episode, window_start)

            if key not in groups:
                groups[key] = {
                    "drama_title": drama,
                    "episode_id": episode,
                    "start_time": window_start,
                    "end_time": window_end,
                    "danmaku_count": 0,
                    "like_sum": 0,
                    "emotion_hits": 0,
                    "type_votes": Counter(),
                    "comments": [],
                }

            group = groups[key]
            group["danmaku_count"] += 1
            group["like_sum"] += likes
            group["emotion_hits"] += emotion_hits
            if label != "unknown":
                group["type_votes"][label] += 1
            if len(group["comments"]) < 20:
                group["comments"].append({"text": text, "likes": likes})

    by_episode: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for group in groups.values():
        by_episode[(group["drama_title"], group["episode_id"])].append(group)

    features: list[dict[str, Any]] = []
    for episode_key, rows in by_episode.items():
        max_count = max(row["danmaku_count"] for row in rows) or 1
        max_like = max(row["like_sum"] for row in rows) or 1

        for row in rows:
            type_votes: Counter[str] = row.pop("type_votes")
            highlight_type = type_votes.most_common(1)[0][0] if type_votes else "unknown"
            emotion_density = row["emotion_hits"] / max(row["danmaku_count"], 1)
            score = (
                0.5 * (row["danmaku_count"] / max_count)
                + 0.25 * (math.log1p(row["like_sum"]) / math.log1p(max_like))
                + 0.25 * min(emotion_density, 1.0)
            )

            row["highlight_type"] = highlight_type
            row["danmaku_score"] = round(score, 4)
            row["emotion_density"] = round(emotion_density, 4)
            row["sample_comments"] = sorted(
                row.pop("comments"),
                key=lambda item: item["likes"],
                reverse=True,
            )[:5]
            features.append(row)

    return sorted(
        features,
        key=lambda item: (
            item["drama_title"],
            item["episode_id"],
            item["start_time"],
        ),
    )


def build_training_samples(features: list[dict[str, Any]], top_k: int) -> list[dict[str, Any]]:
    by_episode: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for item in features:
        by_episode[(item["drama_title"], item["episode_id"])].append(item)

    samples: list[dict[str, Any]] = []
    for (drama_title, episode_id), rows in by_episode.items():
        ranked = sorted(rows, key=lambda item: item["danmaku_score"], reverse=True)
        positive_ids = {id(row) for row in ranked[:top_k]}
        negative_candidates = sorted(rows, key=lambda item: item["danmaku_score"])[:top_k]
        negative_ids = {id(row) for row in negative_candidates}

        for row in rows:
            if id(row) not in positive_ids and id(row) not in negative_ids:
                continue

            label = 1 if id(row) in positive_ids else 0
            samples.append(
                {
                    "drama_title": drama_title,
                    "episode_id": episode_id,
                    "start_time": row["start_time"],
                    "end_time": row["end_time"],
                    "label": label,
                    "highlight_type": row["highlight_type"] if label else "none",
                    "danmaku_score": row["danmaku_score"],
                    "danmaku_count": row["danmaku_count"],
                    "like_sum": row["like_sum"],
                    "emotion_density": row["emotion_density"],
                    "text": "；".join(comment["text"] for comment in row["sample_comments"]),
                }
            )

    return sorted(
        samples,
        key=lambda item: (
            item["drama_title"],
            item["episode_id"],
            -item["label"],
            -item["danmaku_score"],
        ),
    )


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build highlight training data from danmaku CSV.")
    parser.add_argument("--input", required=True, help="Input danmaku CSV path.")
    parser.add_argument("--features-output", required=True, help="Output feature JSON path.")
    parser.add_argument("--training-output", required=True, help="Output pseudo-label training JSON path.")
    parser.add_argument("--window", type=int, default=15, help="Aggregation window in seconds.")
    parser.add_argument("--top-k", type=int, default=8, help="Positive/negative sample count per episode.")
    args = parser.parse_args()

    features = build_features(Path(args.input), args.window)
    training_samples = build_training_samples(features, args.top_k)

    save_json(Path(args.features_output), features)
    save_json(Path(args.training_output), training_samples)

    positives = sum(1 for item in training_samples if item["label"] == 1)
    negatives = sum(1 for item in training_samples if item["label"] == 0)
    print(f"Saved {len(features)} feature windows to {args.features_output}")
    print(f"Saved {len(training_samples)} training samples to {args.training_output}")
    print(f"Positive samples: {positives}; negative samples: {negatives}")


if __name__ == "__main__":
    main()
