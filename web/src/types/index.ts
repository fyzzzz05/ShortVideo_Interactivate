// ── 剧集 ──
export interface Episode {
  id: number;
  title: string;
  author: string;
  description: string;
  tags: string[];
  /** 视频相对于 public/ 的路径 */
  src: string;
  /** 右侧栏数据 */
  stats: { likes: number; comments: number; saves: number };
}

// ── 高光互动事件 ──
export type HighlightType = 'conflict' | 'sweet' | 'funny' | 'reverse' | 'slap_effect';

/** 预设脸部位置 (0~1 相对视频坐标, 兜底用) */
export interface FacePosition {
  x: number; y: number; width: number; height: number;
}

export interface HighlightEvent {
  id: string;
  /** 触发时间 (秒) */
  time: number;
  type: HighlightType;
  emoji: string;
  label: string;
  leftBtn: string;
  rightBtn: string;
  /** slap_effect 专用：兜底脸部位置 + 反派第几张脸 */
  facePosition?: FacePosition;
  faceIndex?: number;     // MediaPipe 检测到的第几张脸 (0-index)
  /** 运行时标记，防止重复触发 (不算入数据字段) */
  _fired?: boolean;
}

// ── 弹幕 ──
export interface DanmakuItem {
  id: string;
  text: string;
  track: number;       // 0-3 轨道编号
  speed: number;       // px/s
  startTime: number;   // 出现时间 (视频秒)
}

// ── 粒子 ──
export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number;        // 剩余生命 ms
  maxLife: number;
  size: number;
  color: string;
  type: 'fragment' | 'heart' | 'star' | 'lightning';
  rotation?: number;
  rotSpeed?: number;
}

export type ParticlePreset = 'conflict' | 'sweet' | 'funny' | 'reverse' | 'slap_effect';
