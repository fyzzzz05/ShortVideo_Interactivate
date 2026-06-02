import argparse
import json
from pathlib import Path
from typing import Any


def load_json(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def split_subtitles(subtitles: list[dict[str, Any]], window_seconds: int) -> list[dict[str, Any]]:
    if not subtitles:
        return []

    segments: list[dict[str, Any]] = []
    current_start = float(subtitles[0]["start"])
    current_end = current_start + window_seconds
    current_items: list[dict[str, Any]] = []

    for item in subtitles:
        start = float(item["start"])
        end = float(item["end"])

        if current_items and start >= current_end:
            segments.append(make_segment(len(segments) + 1, current_items))
            current_start = start
            current_end = current_start + window_seconds
            current_items = []

        current_items.append({"start": start, "end": end, "text": str(item["text"])})

    if current_items:
        segments.append(make_segment(len(segments) + 1, current_items))

    return segments


def make_segment(index: int, items: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "segment_id": f"seg_{index:04d}",
        "start": round(float(items[0]["start"]), 3),
        "end": round(float(items[-1]["end"]), 3),
        "text": "".join(str(row["text"]) for row in items),
        "subtitles": items,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Split subtitle JSON into time windows.")
    parser.add_argument("--input", required=True, help="Input subtitle JSON path.")
    parser.add_argument("--output", required=True, help="Output segment JSON path.")
    parser.add_argument("--window", type=int, default=15, help="Window size in seconds.")
    args = parser.parse_args()

    subtitles = load_json(Path(args.input))
    segments = split_subtitles(subtitles, args.window)
    save_json(Path(args.output), segments)
    print(f"Saved {len(segments)} segments to {args.output}")


if __name__ == "__main__":
    main()

