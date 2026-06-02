import argparse
import json
import re
from pathlib import Path
from typing import Any


TIME_RE = re.compile(
    r"(?P<start>\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(?P<end>\d{2}:\d{2}:\d{2},\d{3})"
)


def parse_time(value: str) -> float:
    hour, minute, rest = value.split(":")
    second, millisecond = rest.split(",")
    return int(hour) * 3600 + int(minute) * 60 + int(second) + int(millisecond) / 1000


def parse_srt(text: str) -> list[dict[str, Any]]:
    blocks = re.split(r"\n\s*\n", text.strip())
    subtitles: list[dict[str, Any]] = []

    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 2:
            continue

        time_line_index = 0
        if "-->" not in lines[0] and len(lines) > 1:
            time_line_index = 1

        match = TIME_RE.search(lines[time_line_index])
        if not match:
            continue

        content_lines = lines[time_line_index + 1 :]
        text_content = "".join(content_lines)

        subtitles.append(
            {
                "start": round(parse_time(match.group("start")), 3),
                "end": round(parse_time(match.group("end")), 3),
                "text": text_content,
            }
        )

    return subtitles


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert SRT subtitles to JSON.")
    parser.add_argument("--input", required=True, help="Input SRT path.")
    parser.add_argument("--output", required=True, help="Output JSON path.")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)

    text = input_path.read_text(encoding="utf-8-sig")
    subtitles = parse_srt(text)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(subtitles, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(subtitles)} subtitles to {output_path}")


if __name__ == "__main__":
    main()
