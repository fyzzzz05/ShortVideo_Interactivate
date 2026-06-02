import argparse
import json
import re
from pathlib import Path
from typing import Any

from openai import OpenAI

from config import get_ark_api_key, get_ark_base_url, get_ark_model


SYSTEM_PROMPT = """你是短剧弹幕高光识别模型。

你只能根据弹幕内容、弹幕数量、点赞数和时间窗口来推断高光类型。
不要假装看过视频，不要编造具体剧情。

高光类型只能从下面选择：
- conflict：冲突争吵
- reverse：剧情反转
- famous_scene：名场面
- sweet：甜蜜撒糖
- cool：爽点打脸
- suspense：悬念
- funny：搞笑

请只输出 JSON，不要输出 Markdown，不要输出解释文字。
"""


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.S)
        if not match:
            raise
        return json.loads(match.group(0))


def build_prompt(highlight: dict[str, Any]) -> str:
    evidence = highlight.get("evidence", {})
    return f"""请根据下面的弹幕高热窗口，判断它更像哪类短剧高光，并生成前端互动配置。

剧名：{highlight.get("drama_title")}
集数：{highlight.get("episode_id")}
时间窗口：{highlight.get("start_time")} 秒 - {highlight.get("end_time")} 秒
弹幕数量：{evidence.get("danmaku_count")}
累计点赞：{evidence.get("like_sum")}
情绪密度：{evidence.get("emotion_density")}
弹幕样例：
{evidence.get("sample_text")}

输出格式：
{{
  "type": "funny",
  "confidence": 0.86,
  "title": "一句短标题，不能编造具体剧情",
  "reason": "只基于弹幕说明为什么这里像高光",
  "interaction_buttons": ["笑不活了", "太好笑了", "绷不住了"],
  "effect": "float"
}}
"""


def refine_one(client: OpenAI, model: str, highlight: dict[str, Any]) -> dict[str, Any]:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_prompt(highlight)},
        ],
        temperature=0.2,
    )

    content = response.choices[0].message.content or "{}"
    try:
        raw = extract_json(content)
    except json.JSONDecodeError:
        raw = {
            "type": highlight.get("type", "unknown"),
            "confidence": highlight.get("confidence", 0),
            "title": highlight.get("title", ""),
            "reason": highlight.get("reason", ""),
            "interaction_buttons": highlight.get("interaction", {}).get("buttons", []),
            "effect": highlight.get("interaction", {}).get("effect", "burst"),
        }

    refined = dict(highlight)
    refined["type"] = str(raw.get("type", highlight.get("type", "unknown")))
    refined["confidence"] = round(float(raw.get("confidence", highlight.get("confidence", 0))), 3)
    refined["title"] = str(raw.get("title", highlight.get("title", "")))
    refined["reason"] = str(raw.get("reason", highlight.get("reason", "")))
    refined["interaction"] = {
        "buttons": [str(item) for item in raw.get("interaction_buttons", [])[:3]],
        "effect": str(raw.get("effect", highlight.get("interaction", {}).get("effect", "burst"))),
    }
    refined["refined_by"] = "doubao_danmaku_only"
    return refined


def main() -> None:
    parser = argparse.ArgumentParser(description="Refine danmaku-only highlights with Doubao.")
    parser.add_argument("--input", required=True, help="Input danmaku highlight JSON path.")
    parser.add_argument("--output", required=True, help="Output refined highlight JSON path.")
    parser.add_argument("--limit", type=int, default=20, help="Number of highlights to refine.")
    parser.add_argument("--resume", action="store_true", help="Skip highlights that already have refined_by.")
    args = parser.parse_args()

    highlights = load_json(Path(args.input))
    selected = highlights[: args.limit]
    untouched = highlights[args.limit :]

    client = OpenAI(api_key=get_ark_api_key(), base_url=get_ark_base_url())
    model = get_ark_model()
    refined: list[dict[str, Any]] = []
    output_path = Path(args.output)

    for index, highlight in enumerate(selected, start=1):
        if args.resume and highlight.get("refined_by"):
            refined.append(highlight)
            continue

        item = refine_one(client, model, highlight)
        refined.append(item)
        save_json(output_path, refined + selected[index:] + untouched)
        print(f'[{index}/{len(selected)}] {item["drama_title"]} {item["episode_id"]} {item["start_time"]}-{item["end_time"]}s: {item["type"]}')

    save_json(output_path, refined + untouched)
    print(f"Saved {len(refined)} refined highlights to {args.output}")


if __name__ == "__main__":
    main()
