"""
分析"十八岁太奶奶驾到，重整家族荣耀第三部"第5集弹幕数据
按15秒时间窗口聚合，识别高光时刻及其类型
"""
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

# Fix Windows GBK encoding issue
sys.stdout.reconfigure(encoding="utf-8")

# --- 配置 ---
DRAMA_TITLE = "十八岁太奶奶驾到，重整家族荣耀第三部"
EPISODE = "第5集"
WINDOW_SECONDS = 15
CSV_PATH = Path(__file__).resolve().parent.parent / "data" / "danmu.csv"
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "highlights" / "ep5_danmaku_analysis.json"

# --- 情绪关键词词典 ---
EMOTION_KEYWORDS = {
    "funny": [
        "哈哈", "笑死", "笑不活", "搞笑", "笑哭", "好笑", "笑喷", "招笑",
        "肚子疼", "憋笑", "绷不住", "我不行", "笑死我", "孝死",
    ],
    "cool": [
        "帅", "好看", "养眼", "好帅", "爱豆", "666", "六六六", "棒棒哒",
        "可爱", "好萌", "萌", "太萌", "喜欢", "爱慕", "送花", "漂亮",
    ],
    "shock": [
        "倒反天罡", "道反天罡", "造反天罡", "大逆不道", "超级加辈",
        "超级加倍", "天罡", "震惊", "我的天", "我的妈", "什么",
        "还有", "居然", "竟然", "不会吧", "啊", "不可能",
    ],
    "suspense": [
        "司机", "一伙", "孩子", "谁的", "DNA", "亲子鉴定", "羊水穿刺",
        "说谎", "骗", "假的", "冒充", "有问题", "不对劲", "猫腻",
        "串通", "串供", "合谋", "被收买", "打配合",
    ],
    "sweet": [
        "老婆", "老公", "甜", "磕", "一对", "般配", "在一起",
        "奥特曼你要有老婆", "你有老婆",
    ],
    "conflict": [
        "可怜", "心疼", "惨", "冤种", "亏", "欺负", "坑",
        "凭什么", "为什么", "不服",
    ],
}

# --- 加载CSV ---
rows = []
with open(CSV_PATH, encoding="utf-8") as f:
    reader = csv.DictReader(f, delimiter="\t")
    for row in reader:
        drama = row.get("剧名称", "").strip()
        ep = row.get("group_title", "").strip()
        if drama == DRAMA_TITLE and ep == EPISODE:
            try:
                time_ms = int(row.get("发弹幕时刻相对于视频起始时间偏移量", "0"))
                likes = int(row.get("累计点赞数", "0"))
            except (ValueError, TypeError):
                continue
            rows.append({
                "time_ms": time_ms,
                "time_sec": time_ms / 1000.0,
                "likes": likes,
                "text": row.get("弹幕内容", "").strip(),
            })

print(f"✅ 共加载 {len(rows)} 条第5集弹幕")

# --- 按15秒窗口聚合 ---
time_max = max(r["time_sec"] for r in rows) if rows else 135
num_windows = int(time_max // WINDOW_SECONDS) + 1

windows = defaultdict(list)
for r in rows:
    w = int(r["time_sec"] // WINDOW_SECONDS)
    windows[w].append(r)

print(f"✅ 时间跨度 0-{time_max:.0f}秒，共 {num_windows} 个窗口\n")

# --- 分析每个窗口 ---
def count_emotion_hits(text: str) -> dict:
    """统计单条弹幕命中的情绪类型"""
    hits = {}
    for etype, keywords in EMOTION_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in text)
        if count > 0:
            hits[etype] = count
    return hits

results = []
for w in sorted(windows.keys()):
    items = windows[w]
    start = w * WINDOW_SECONDS
    end = start + WINDOW_SECONDS
    count = len(items)
    like_sum = sum(r["likes"] for r in items)

    # 情绪密度
    emotion_hits = defaultdict(int)
    for r in items:
        hits = count_emotion_hits(r["text"])
        for etype, n in hits.items():
            emotion_hits[etype] += n

    total_emotion = sum(emotion_hits.values())
    emotion_density = round(total_emotion / count, 4) if count > 0 else 0

    # 主要情绪类型
    primary_emotion = max(emotion_hits, key=emotion_hits.get) if emotion_hits else "unknown"

    # 弹幕评分（综合密度、点赞、情绪）
    max_count = max(len(items2) for items2 in windows.values())
    max_likes = max(sum(r2["likes"] for r2 in items2) for items2 in windows.values())
    max_emotion = 1
    for items2 in windows.values():
        emo_sum = 0
        for r2 in items2:
            for kws in EMOTION_KEYWORDS.values():
                emo_sum += sum(1 for kw in kws if kw in r2["text"])
        max_emotion = max(max_emotion, emo_sum)

    norm_count = count / max_count if max_count > 0 else 0
    norm_likes = like_sum / max_likes if max_likes > 0 else 0
    norm_emotion = total_emotion / max_emotion if max_emotion > 0 else 0

    danmaku_score = round(0.4 * norm_count + 0.2 * norm_likes + 0.4 * norm_emotion, 4)

    # Top 弹幕样本（按点赞排序）
    top_samples = sorted(items, key=lambda x: x["likes"], reverse=True)[:8]

    results.append({
        "window": w,
        "start_time": start,
        "end_time": end,
        "danmaku_count": count,
        "like_sum": like_sum,
        "emotion_hits": dict(emotion_hits),
        "total_emotion_hits": total_emotion,
        "emotion_density": emotion_density,
        "primary_emotion": primary_emotion,
        "danmaku_score": danmaku_score,
        "top_samples": [
            {"text": s["text"], "likes": s["likes"], "time_sec": round(s["time_sec"], 1)}
            for s in top_samples
        ],
    })

# --- 排序 & 输出 ---
results_sorted = sorted(results, key=lambda x: x["danmaku_score"], reverse=True)

# 高光类型中文名
TYPE_CN = {
    "funny": "搞笑/笑点密集 😂",
    "cool": "帅炸/角色高光 ✨",
    "shock": "震惊/反转/倒反天罡 🤯",
    "suspense": "悬念/猜测/推理 🔍",
    "sweet": "甜蜜/磕CP 💕",
    "conflict": "冲突/心疼/虐点 💔",
    "unknown": "综合高能 ⚡",
}

print("=" * 80)
print(f"📊 第5集弹幕高光分析 — Top 15 窗口")
print("=" * 80)

for i, r in enumerate(results_sorted[:15], 1):
    etype = r["primary_emotion"]
    type_label = TYPE_CN.get(etype, TYPE_CN["unknown"])
    bar = "█" * int(r["danmaku_score"] * 40)

    print(f"\n{'─' * 70}")
    print(f"  #{i:2d}  ⏱ {r['start_time']:3d}s - {r['end_time']:3d}s  |  "
          f"弹幕: {r['danmaku_count']:4d}  点赞: {r['like_sum']:4d}  "
          f"情绪密度: {r['emotion_density']:.4f}  评分: {r['danmaku_score']:.4f}")
    print(f"       类型: {type_label}")
    print(f"       热度: {bar}")
    print(f"       情绪分布: {dict(sorted(r['emotion_hits'].items(), key=lambda x: -x[1]))}")
    print(f"       典型弹幕:")
    for s in r["top_samples"][:5]:
        likes_str = f"👍{s['likes']}" if s["likes"] > 0 else ""
        print(f"         · [{s['time_sec']:.0f}s] {s['text'][:45]} {likes_str}")

# --- 按类型聚合 Top 时刻 ---
print(f"\n\n{'=' * 80}")
print(f"📌 按高光类型分类 — Top 时刻")
print(f"{'=' * 80}")

type_windows = defaultdict(list)
for r in results_sorted:
    etype = r["primary_emotion"]
    type_windows[etype].append(r)

for etype in ["funny", "cool", "shock", "suspense", "sweet", "conflict"]:
    tw = type_windows.get(etype, [])
    if not tw:
        continue
    best = tw[0]
    print(f"\n  {TYPE_CN.get(etype, etype)}")
    print(f"    最佳窗口: {best['start_time']}s - {best['end_time']}s "
          f"(弹幕{best['danmaku_count']}条, 点赞{best['like_sum']}, 评分{best['danmaku_score']:.4f})")
    # 列出该类型 top 3 窗口
    for j, w in enumerate(tw[:3]):
        print(f"    #{j+1} {w['start_time']}s-{w['end_time']}s "
              f"(弹幕{w['danmaku_count']}, 点赞{w['like_sum']}, 评分{w['danmaku_score']:.4f})")

# --- 保存 JSON ---
output_data = {
    "drama_title": DRAMA_TITLE,
    "episode_id": EPISODE,
    "total_danmaku": len(rows),
    "window_seconds": WINDOW_SECONDS,
    "num_windows": len(results),
    "windows": results_sorted,
    "top_highlights": [
        {
            "rank": i,
            "start_time": r["start_time"],
            "end_time": r["end_time"],
            "type": r["primary_emotion"],
            "danmaku_score": r["danmaku_score"],
            "danmaku_count": r["danmaku_count"],
            "like_sum": r["like_sum"],
            "emotion_density": r["emotion_density"],
            "emotion_hits": r["emotion_hits"],
            "sample_comments": [
                {"text": s["text"], "likes": s["likes"]}
                for s in r["top_samples"][:5]
            ],
        }
        for i, r in enumerate(results_sorted[:20], 1)
    ],
}

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
OUTPUT_PATH.write_text(json.dumps(output_data, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\n\n✅ 分析结果已保存到: {OUTPUT_PATH}")
