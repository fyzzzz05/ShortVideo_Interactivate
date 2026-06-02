/**
 * 高光数据 — 为第5-15集每集预配 2-3 个关键时间点。
 * 数据来自于 AI 模型识别结果或手动标注。
 * 将来切换为从后端 GET /api/v1/episodes/{id}/events?mode=offline 加载。
 */

import { Highlight } from './types';

// 默认脸部位置（屏幕中央偏上，约脸部区域）
const DEFAULT_FACE = {
  x: 0.5, y: 0.35, width: 0.25, height: 0.3,
};

function makeHighlight(
  id: string,
  episodeId: number,
  time: number,
  scene: string,
  title: string,
  hint: string,
  overrides: Partial<Highlight> = {},
): Highlight {
  return {
    id,
    episodeId,
    time,
    startMs: Math.round(time * 1000),
    endMs: Math.round((time + 3) * 1000),
    scene,
    type: scene,
    confidence: 0.85,
    title,
    reason: '',
    triggered: false,
    interaction: {
      buttons: overrides.interaction?.buttons || ['点击互动'],
      effect: 'burst',
      trigger: 'TAP',
      hint,
      durationSec: 3,
    },
    character: {
      type: overrides.character?.type || 'villain',
      name: overrides.character?.name || '反派',
      facePosition: overrides.character?.facePosition || DEFAULT_FACE,
    },
    ...overrides,
  };
}

// ── 第5集：扇巴掌复仇 ──
import episode5Raw from './episode5-highlights.json';
const ep5Legacy = (episode5Raw as any).highlights || [];

export const EPISODE_HIGHLIGHTS: Record<number, Highlight[]> = {
  5: ep5Legacy.map((h: any) => makeHighlight(
    h.id, 5, h.time, h.scene || 'REVENGE',
    '惩治反派', h.hint || '点击屏幕帮助主角惩治反派',
    { character: { type: 'villain', name: h.character?.name || '反派', facePosition: h.character?.facePosition || DEFAULT_FACE } },
  )),

  6: [
    makeHighlight('hl_6_1', 6, 18, 'REVENGE', '女主霸气反击', '连续点击帮助主角反击'),
    makeHighlight('hl_6_2', 6, 72, 'CONFLICT', '正面硬刚', '长按屏幕蓄力爆发'),
  ],

  7: [
    makeHighlight('hl_7_1', 7, 22, 'SWEET', '甜蜜对视', '快速点击为 CP 打 call', { character: { type: 'protagonist', name: '女主', facePosition: DEFAULT_FACE } }),
    makeHighlight('hl_7_2', 7, 65, 'REVENGE', '假千金现原形', '连续点击看打脸'),
  ],

  8: [
    makeHighlight('hl_8_1', 8, 15, 'CONFLICT', '激烈争吵', '长按屏幕蓄力爆发'),
    makeHighlight('hl_8_2', 8, 80, 'SUSPENSE', '神秘人出现', '点击屏幕揭晓真相'),
  ],

  9: [
    makeHighlight('hl_9_1', 9, 30, 'REVENGE', '当众揭穿阴谋', '连续点击帮助主角'),
    makeHighlight('hl_9_2', 9, 90, 'SWEET', '男主英雄救美', '快速点击为 CP 打 call', { character: { type: 'protagonist', name: '男主', facePosition: { x: 0.5, y: 0.3, width: 0.3, height: 0.35 } } }),
  ],

  10: [
    makeHighlight('hl_10_1', 10, 20, 'FUNNY', '闺蜜神吐槽', '连点发送哈哈哈'),
    makeHighlight('hl_10_2', 10, 55, 'REVENGE', '律师函警告', '连续点击看打脸'),
    makeHighlight('hl_10_3', 10, 110, 'SUSPENSE', 'DNA 报告揭晓', '点击屏幕揭晓真相'),
  ],

  11: [
    makeHighlight('hl_11_1', 11, 25, 'REVENGE', '赶出家门', '连续点击帮助主角'),
    makeHighlight('hl_11_2', 11, 70, 'CONFLICT', '董事会摊牌', '长按屏幕蓄力爆发'),
  ],

  12: [
    makeHighlight('hl_12_1', 12, 16, 'SWEET', '天台告白', '快速点击为 CP 打 call', { character: { type: 'protagonist', name: '女主', facePosition: DEFAULT_FACE } }),
    makeHighlight('hl_12_2', 12, 60, 'REVENGE', '商业反杀', '连续点击看打脸'),
  ],

  13: [
    makeHighlight('hl_13_1', 13, 32, 'FAMOUS_SCENE', '名场面：霸气宣言', '双击标记名场面'),
    makeHighlight('hl_13_2', 13, 85, 'REVENGE', '最终复仇', '连续点击帮助主角'),
  ],

  14: [
    makeHighlight('hl_14_1', 14, 20, 'SWEET', '婚后日常撒糖', '快速点击为 CP 打 call', { character: { type: 'protagonist', name: '女主', facePosition: DEFAULT_FACE } }),
    makeHighlight('hl_14_2', 14, 65, 'SUSPENSE', '旧账未清', '点击屏幕揭晓真相'),
  ],

  15: [
    makeHighlight('hl_15_1', 15, 30, 'CONFLICT', '大结局对决', '长按屏幕蓄力爆发'),
    makeHighlight('hl_15_2', 15, 100, 'FAMOUS_SCENE', '大结局彩蛋', '双击标记名场面'),
  ],
};
