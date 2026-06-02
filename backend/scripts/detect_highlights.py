"""CLI 工具 — 批量识别短剧高光点。

用法:
    python scripts/detect_highlights.py \
        --input data/subtitles/sample.json \
        --output data/highlights/sample_highlights.json \
        --drama-title "示例短剧"

此脚本复用 app.integrations.doubao_client.DoubaoClient，
与 API 端点共享同一代码路径。
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

# 确保能从 backend/ 根目录加载 .env 和 import app
_BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

# DoubaoClient 内部自行加载 .env，此处只需确保 sys.path 正确
from app.integrations.doubao_client import DoubaoClient


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)


def main() -> None:
    parser = argparse.ArgumentParser(description="Detect drama highlights with Doubao.")
    parser.add_argument("--input", required=True, help="Input segment JSON path.")
    parser.add_argument("--output", required=True, help="Output highlight JSON path.")
    parser.add_argument("--drama-id", default="drama_001")
    parser.add_argument("--drama-title", default="示例短剧")
    parser.add_argument("--episode-id", default="ep_01")
    parser.add_argument(
        "--min-confidence", type=float, default=0.55, help="Minimum confidence threshold."
    )
    args = parser.parse_args()

    segments = load_json(Path(args.input))
    client = DoubaoClient()

    highlights = client.detect_highlights(
        segments=segments,
        drama_id=args.drama_id,
        drama_title=args.drama_title,
        episode_id=args.episode_id,
        min_confidence=args.min_confidence,
    )

    for h in highlights:
        print(f'[HIGH] {h["segment_id"]}: {h["title"]} (confidence={h["confidence"]})')

    save_json(Path(args.output), highlights)
    print(f"\nSaved {len(highlights)} highlights to {args.output}")


if __name__ == "__main__":
    main()
