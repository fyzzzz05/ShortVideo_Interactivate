/**
 * 场景 → 互动玩法映射。
 * 不同剧情类型自动触发对应的交互体验。
 */

import { COLORS } from './theme';

export type SceneType =
  | 'REVENGE'
  | 'SWEET'
  | 'CONFLICT'
  | 'SUSPENSE'
  | 'FUNNY'
  | 'FAMOUS_SCENE';

export type GameComponent =
  | 'SlapGame'
  | 'HeartTap'
  | 'RageHold'
  | 'TapDecide'
  | 'PunchGame';

export interface SceneConfig {
  component: GameComponent;
  color: string;
  hint: string;
  icon: string;
  description: string;
}

export const SCENE_MAP: Record<SceneType, SceneConfig> = {
  REVENGE: {
    component: 'PunchGame',
    color: COLORS.primary,
    hint: '点击脸部打击反派',
    icon: '👊',
    description: '打击反派（HP 系统）',
  },
  SWEET: {
    component: 'HeartTap',
    color: COLORS.sweet,
    hint: '快速点击为 CP 打 call',
    icon: '💕',
    description: '甜蜜撒糖',
  },
  CONFLICT: {
    component: 'RageHold',
    color: '#FF3B30',
    hint: '长按屏幕蓄力爆发',
    icon: '🔥',
    description: '怒气蓄力',
  },
  SUSPENSE: {
    component: 'TapDecide',
    color: COLORS.gold,
    hint: '点击屏幕揭晓真相',
    icon: '⚡',
    description: '悬念揭晓',
  },
  FUNNY: {
    component: 'SlapGame',
    color: '#00D4AA',
    hint: '连点发送哈哈哈',
    icon: '😂',
    description: '搞笑互动',
  },
  FAMOUS_SCENE: {
    component: 'SlapGame',
    color: COLORS.gold,
    hint: '双击标记名场面',
    icon: '⭐',
    description: '名场面封神',
  },
};

/** 向后兼容：兼容后端返回的 scene_tag 格式 */
export function resolveScene(sceneTag: string): SceneType {
  const upper = sceneTag.toUpperCase();
  if (upper in SCENE_MAP) return upper as SceneType;
  // 模糊匹配
  if (upper.includes('REVENGE') || upper.includes('复仇') || upper.includes('SLAP')) return 'REVENGE';
  if (upper.includes('SWEET') || upper.includes('糖') || upper.includes('HEART')) return 'SWEET';
  if (upper.includes('CONFLICT') || upper.includes('冲突') || upper.includes('COOL')) return 'CONFLICT';
  if (upper.includes('SUSPENSE') || upper.includes('悬念')) return 'SUSPENSE';
  if (upper.includes('FUNNY') || upper.includes('搞笑')) return 'FUNNY';
  if (upper.includes('FAMOUS') || upper.includes('名场面')) return 'FAMOUS_SCENE';
  return 'REVENGE'; // 默认扇巴掌
}
