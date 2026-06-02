import argparse
import json
from pathlib import Path
from typing import Any


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Make a markdown report for danmaku highlights.")
    parser.add_argument("--input", required=True, help="Input refined highlight JSON path.")
    parser.add_argument("--output", required=True, help="Output markdown path.")
    parser.add_argument("--top-n", type=int, default=10)
    args = parser.parse_args()

    highlights = load_json(Path(args.input))[: args.top_n]

    lines = [
        "# 基于弹幕的短剧高光识别结果",
        "",
        "## 方法说明",
        "",
        "当前阶段仅使用弹幕数据进行高光识别。系统将弹幕按“剧名 + 集数 + 15 秒时间窗口”聚合，计算弹幕数量、累计点赞数、情绪关键词密度，并生成高光候选分数。随后使用 Doubao 模型根据弹幕样例对高光类型、标题、识别原因和互动按钮进行精修。",
        "",
        "## 可用于展示的闭环",
        "",
        "弹幕 CSV -> 时间窗口聚合 -> 高光候选打分 -> Doubao 精修 -> 前端互动配置 JSON",
        "",
        "## Top 高光候选",
        "",
        "| 排名 | 短剧 | 集数 | 时间 | 类型 | 置信度 | 标题 |",
        "|---:|---|---|---:|---|---:|---|",
    ]

    for index, item in enumerate(highlights, start=1):
        lines.append(
            f"| {index} | {item.get('drama_title')} | {item.get('episode_id')} | "
            f"{item.get('start_time')}-{item.get('end_time')}s | {item.get('type')} | "
            f"{item.get('confidence')} | {item.get('title')} |"
        )

    lines.extend(["", "## 样例详情", ""])

    for index, item in enumerate(highlights[:5], start=1):
        evidence = item.get("evidence", {})
        buttons = "、".join(item.get("interaction", {}).get("buttons", []))
        lines.extend(
            [
                f"### {index}. {item.get('title')}",
                "",
                f"- 短剧：{item.get('drama_title')} {item.get('episode_id')}",
                f"- 时间：{item.get('start_time')}-{item.get('end_time')} 秒",
                f"- 类型：{item.get('type')}",
                f"- 置信度：{item.get('confidence')}",
                f"- 弹幕数：{evidence.get('danmaku_count')}，点赞数：{evidence.get('like_sum')}，情绪密度：{evidence.get('emotion_density')}",
                f"- 识别原因：{item.get('reason')}",
                f"- 互动按钮：{buttons}",
                "",
            ]
        )

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"Saved report to {output_path}")


if __name__ == "__main__":
    main()
