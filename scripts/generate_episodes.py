#!/usr/bin/env python3
"""
从后端弹幕高光分析结果生成 episodes.ts
确保每集有冲突/爽点/甜宠等不同类型
"""
import json, os, re
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT = os.path.join(BASE, "backend", "data", "highlights", "danmaku_highlights_final.json")
VIDEO_DIR = os.path.join(BASE, "web", "public", "nvpin")
OUTPUT = os.path.join(BASE, "web", "src", "data", "episodes.ts")

TYPE_UI = {
    "conflict":     ("👊", "slap_effect", "👊 干他",    "💥 暴击"),
    "cool":         ("😎", "conflict",     "😎 帅炸",    "🔥 燃爆"),
    "funny":        ("😂", "funny",        "🤣 哈哈哈",  "💀 笑死"),
    "famous_scene": ("⭐", "reverse",      "⭐ 名场面",  "🔁 再看亿遍"),
    "sweet":        ("💕", "sweet",        "❤️ 嗑到了",  "🎉 锁死"),
    "reverse":      ("⚡", "reverse",      "😱 反转",    "👏 绝了"),
    "suspense":     ("🔍", "reverse",      "😨 细思极恐","🔎 线索"),
}

TYPE_PRIORITY = ["conflict", "cool", "reverse", "sweet", "famous_scene", "funny", "suspense"]


def scan_videos():
    if not os.path.isdir(VIDEO_DIR): return {}
    vids = {}
    for f in os.listdir(VIDEO_DIR):
        if f.endswith(".mp4"):
            nums = re.findall(r'\d+', f)
            if nums: vids[int(nums[0])] = f"/nvpin/{f}"
    return vids


def load_highlights():
    with open(INPUT, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def score_highlight(h):
    t = h.get("type", "")
    conf = h.get("trigger_score", h.get("confidence", 0.5))
    prio = TYPE_PRIORITY.index(t) if t in TYPE_PRIORITY else 99
    return (prio, -conf)


def esc(s):
    """转义 TypeScript 字符串中的特殊字符"""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n").replace("\r", "")


def main():
    hls = load_highlights()
    videos = scan_videos()
    avail = sorted(videos.keys())

    # 按类型分组，每组内按评分排序
    by_type = defaultdict(list)
    for h in hls:
        t = h.get("type", "funny")
        by_type[t].append(h)
    for t in by_type:
        by_type[t].sort(key=lambda h: -(h.get("trigger_score", h.get("confidence", 0.5))))

    # 分配：每集 3-5 个，优先覆盖冲突/爽点/反转/甜宠
    assigned = {n: [] for n in avail}
    targets = [5, 6, 7, 10, 11, 12]  # our episode numbers

    # 先分配稀缺类型
    scarce_order = ["conflict", "reverse", "cool", "sweet", "suspense", "famous_scene", "funny"]
    for t in scarce_order:
        pool = list(by_type.get(t, []))
        for i, h in enumerate(pool):
            ep = targets[i % len(targets)]
            if len(assigned[ep]) < 5:
                assigned[ep].append(h)

    # 时间排序
    for ep in targets:
        assigned[ep].sort(key=lambda h: h.get("trigger_start_time", 0))

    print(f"Backend: {len(hls)} highlights → {len(targets)} episodes")
    for ep in targets:
        types = [h["type"] for h in assigned[ep]]
        times = [h["trigger_start_time"] for h in assigned[ep]]
        print(f"  Ep {ep}: types={types}, times={times}")

    # 生成 TypeScript
    episodes_out = []
    highlights_out = []
    danmaku_out = []

    for ep_num in targets:
        items = assigned[ep_num]
        if not items:
            continue
        src = videos.get(ep_num, f"/nvpin/第{ep_num}集.mp4")
        drama = items[0].get("drama_title", "短剧")
        ep_str = f"第{ep_num}集"

        episodes_out.append(
            f'  {{ id: {ep_num}, title: "逆袭女王 {esc(ep_str)}",\n'
            f'    author: "逆袭女王",\n'
            f'    description: "假千金冒充真千金多年，女主霸气反击 — {esc(drama)}",\n'
            f'    tags: ["复仇","女强","爽文"],\n'
            f'    src: "{src}",\n'
            f'    stats: {{ likes: {20000+ep_num*6000}, comments: {3000+ep_num*1000}, saves: {8000+ep_num*3000} }}\n'
            f'  }}'
        )

        # 去重：同一秒的高光加后缀
        seen_times = {}
        for hi, h in enumerate(items):
            t = h.get("type", "cool")
            ui = TYPE_UI.get(t, TYPE_UI["cool"])
            trigger = h.get("trigger_start_time", 0)
            title = h.get("title", "")
            interaction = h.get("interaction", {})
            buttons = interaction.get("buttons", [])
            confidence = h.get("confidence", 0.5)
            ts_type = ui[1]
            left_btn = esc(buttons[0]) if buttons else ui[2]
            right_btn = esc(buttons[1]) if len(buttons) > 1 else ui[3]

            # 去重 ID
            key = f"{trigger:.0f}"
            seen_times[key] = seen_times.get(key, 0) + 1
            id_suffix = f"_{seen_times[key]}" if seen_times[key] > 1 else ""

            highlights_out.append(
                f'  // {esc(drama)} | {esc(title)} (置信度 {confidence:.0%})\n'
                f'  {{ id: "hl_{ep_num}_{trigger:.0f}{id_suffix}", time: {trigger}, type: "{ts_type}",\n'
                f'    emoji: "{ui[0]}", label: "{esc(title)}",\n'
                f'    leftBtn: "{left_btn}", rightBtn: "{right_btn}",\n'
                f'    facePosition: {{ x: 0.48, y: 0.36, width: 0.28, height: 0.34 }}, faceIndex: 0 }},'
            )

            trigger_ev = h.get("trigger_evidence", {})
            comments = trigger_ev.get("sample_comments", [])
            if comments:
                for ci, cm in enumerate(comments[:4]):
                    txt = esc(cm.get("text", "").strip())
                    tm = cm.get("time", trigger + ci * 0.6)
                    if txt and len(txt) < 50:
                        danmaku_out.append(
                            f'    {{ id: "dm_{ep_num}_{trigger:.0f}_{ci}", text: "{txt}", '
                            f'track: {ci % 4}, speed: {75 + ci * 5}, startTime: {tm:.1f} }},'
                        )
            else:
                evidence = h.get("evidence", {})
                sample = evidence.get("sample_text", "")
                for si, st in enumerate(sample.split("；")[:3]):
                    st = esc(st.strip())
                    if st and len(st) < 50:
                        danmaku_out.append(
                            f'    {{ id: "dm_{ep_num}_{trigger:.0f}_s{si}", text: "{st}", '
                            f'track: {si % 4}, speed: {78 + si * 4}, startTime: {trigger - 1 + si * 0.6:.1f} }},'
                        )

    ts_code = '''import type { Episode, HighlightEvent, DanmakuItem } from "../types";

export const EPISODES: Episode[] = [
''' + ",\n".join(episodes_out) + '''
];

export const HIGHLIGHTS: HighlightEvent[] = [
''' + "\n".join(highlights_out) + '''
];

const DANMAKU_ALL: DanmakuItem[] = [
''' + "\n".join(danmaku_out) + '''
];

export function getDanmakuForEpisode(episodeId: number): DanmakuItem[] {
  return DANMAKU_ALL.filter(d => {
    const parts = d.id.split("_");
    return parts.length >= 2 && parseInt(parts[1]) === episodeId;
  });
}

export const DANMAKU: DanmakuItem[] = DANMAKU_ALL;
'''

    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(ts_code)

    print(f"\nGenerated {OUTPUT}")
    print(f"  {len(episodes_out)} episodes, {len(highlights_out)} highlights, {len(danmaku_out)} danmaku")


if __name__ == "__main__":
    main()
