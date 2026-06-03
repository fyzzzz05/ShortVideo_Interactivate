/**
 * 短剧互动播放器 — 核心类型定义。
 * 与 ShortVideo-Platform/shared/highlight-contract.json 对齐。
 */

// ── 高光 ──
export interface FacePosition {
  x: number;      // 0-1 相对坐标
  y: number;
  width: number;
  height: number;
}

export interface CharacterInfo {
  type: 'protagonist' | 'villain' | 'supporting';
  name: string;
  facePosition: FacePosition;
  faceIndex?: number;
}

export interface InteractionConfig {
  buttons: string[];
  effect: 'burst' | 'sparkle' | 'heart' | 'none';
  trigger: 'TAP' | 'SLAP' | 'SWIPE' | 'SHAKE';
  hint: string;
  durationSec: number;
}

export interface Highlight {
  id: string;
  episodeId: number | string;
  time: number;            // 触发时间（秒）— 前端使用
  startMs: number;         // 毫秒 — 对齐后端
  endMs: number;
  scene: string;           // 场景类型名称
  type: string;            // 后端 event_type，支持 slap_effect
  confidence: number;
  title: string;
  reason: string;
  interaction: InteractionConfig;
  character: CharacterInfo | null;
  triggered: boolean;
}

// ── 剧集 ──
export interface Episode {
  id: number;
  title: string;
  video: any;              // require() 返回的本地资源
  duration: string;        // 显示用 "2:31"
  thumbnail?: string;
}

// ── 互动 ──
export interface InteractionProps {
  highlight: Highlight;
  onComplete: () => void;
  onComboUpdate: (combo: number) => void;
}

// ── 粒子 ──
export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  opacity: AnimatedValue;
  scale: AnimatedValue;
}

// 避免循环引用
type AnimatedValue = any;
