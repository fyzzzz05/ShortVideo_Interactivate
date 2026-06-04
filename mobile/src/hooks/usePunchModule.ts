/**
 * usePunchModule — 打击系统核心 Hook。
 *
 * 从独立 web punch-module.js 迁移到 React Native。
 * 核心职责：HP 管理、连击追踪、bbox 命中检测、KO 判定。
 *
 * 与 web 版 API 保持对齐：
 *   loadBboxData / punchAt / reset / getState / setEnabled
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { safeHaptic } from '../utils/haptics';

// ── 类型 ──

/** 归一化 bbox（对齐 highlight-contract 的 face_position） */
export interface BboxEntry {
  time: number;            // 视频时间（秒）
  bbox: {
    x: number;            // 0~1 归一化中心 x
    y: number;            // 0~1 归一化中心 y
    w: number;            // 0~1 归一化宽度
    h: number;            // 0~1 归一化高度
  };
}

export interface PunchHitData {
  combo: number;
  damage: number;
  hp: number;
  maxHp: number;
  bbox: BboxEntry | null;
  /** 命中点在 bbox 内的相对位置（-1~1，0=正中） */
  accuracy: { x: number; y: number };
}

export interface PunchKOData {
  totalHits: number;
  totalDamage: number;
  bbox: BboxEntry | null;
}

export interface PunchModuleState {
  hp: number;
  maxHp: number;
  combo: number;
  isKO: boolean;
  enabled: boolean;
  totalHits: number;
  totalDamage: number;
}

export interface PunchModuleOptions {
  /** HP 上限，默认 100 */
  maxHp?: number;
  /** 每次命中伤害，默认 10。可传函数做动态伤害 */
  damage?: number | ((state: PunchModuleState) => number);
  /** 热区外扩（像素），手指比鼠标粗，默认 8 */
  hitExpandPx?: number;
  /** 连击重置时间（ms），默认 2000 */
  comboResetMs?: number;
  /** KO 后冷却（ms），期间忽略输入，默认 1500 */
  koCooldownMs?: number;
  /** 最短命中间隔（ms），防止单次触摸触发多次，默认 300 */
  minHitIntervalMs?: number;
  /** 每次命中回调 */
  onHit?: (data: PunchHitData) => void;
  /** KO 回调（HP 降到 0） */
  onKO?: (data: PunchKOData) => void;
  /** 连击变化回调 */
  onComboChange?: (combo: number) => void;
  /** HP 变化回调 */
  onHpChange?: (hp: number, maxHp: number) => void;
  /** 未命中回调 */
  onMiss?: (x: number, y: number) => void;
}

/** usePunchModule 返回值（web API 镜像） */
export interface PunchModuleAPI {
  loadBboxData: (data: BboxEntry[]) => void;
  punchAt: (
    touchX: number,
    touchY: number,
    videoW: number,
    videoH: number,
    currentTime: number,
  ) => PunchHitData | null;
  reset: () => void;
  setEnabled: (enabled: boolean) => void;
  getState: () => PunchModuleState;
}

// ── 默认值 ──

const DEFAULT_MAX_HP = 100;
const DEFAULT_DAMAGE = 10;
const DEFAULT_HIT_EXPAND_PX = 8;
const DEFAULT_COMBO_RESET_MS = 2000;
const DEFAULT_KO_COOLDOWN_MS = 1500;
const DEFAULT_MIN_HIT_INTERVAL_MS = 300;

// ── 内部纯函数 ──

/** 归一化坐标 → 像素坐标，返回 { cx, cy, w, h } */
function bboxToPixel(
  bbox: BboxEntry['bbox'],
  videoW: number,
  videoH: number,
): { cx: number; cy: number; w: number; h: number } {
  return {
    cx: bbox.x * videoW,
    cy: bbox.y * videoH,
    w: bbox.w * videoW,
    h: bbox.h * videoH,
  };
}

/** 检测点 (px,py) 是否落在 bbox 内（含外扩容差） */
function isInsideBbox(
  px: number,
  py: number,
  bboxPx: { cx: number; cy: number; w: number; h: number },
  expand: number,
): boolean {
  const left = bboxPx.cx - bboxPx.w / 2 - expand;
  const right = bboxPx.cx + bboxPx.w / 2 + expand;
  const top = bboxPx.cy - bboxPx.h / 2 - expand;
  const bottom = bboxPx.cy + bboxPx.h / 2 + expand;
  return px >= left && px <= right && py >= top && py <= bottom;
}

/** 查找当前视频时间对应的 bbox 条目 */
function findBboxAtTime(entries: BboxEntry[], time: number, toleranceSec = 0.5): BboxEntry | null {
  // bbox 数据按 time 升序，取最接近且在容差内的
  let best: BboxEntry | null = null;
  let bestDist = toleranceSec;
  for (const e of entries) {
    const dist = Math.abs(e.time - time);
    if (dist < bestDist) {
      best = e;
      bestDist = dist;
    }
  }
  return best;
}

// ── Hook ──

export function usePunchModule(options: PunchModuleOptions = {}): PunchModuleAPI {
  const {
    maxHp = DEFAULT_MAX_HP,
    damage = DEFAULT_DAMAGE,
    hitExpandPx = DEFAULT_HIT_EXPAND_PX,
    comboResetMs = DEFAULT_COMBO_RESET_MS,
    koCooldownMs = DEFAULT_KO_COOLDOWN_MS,
    minHitIntervalMs = DEFAULT_MIN_HIT_INTERVAL_MS,
    onHit,
    onKO,
    onComboChange,
    onHpChange,
    onMiss,
  } = options;

  // ── 状态 ──
  const [hp, setHp] = useState(maxHp);
  const [combo, setCombo] = useState(0);
  const [isKO, setIsKO] = useState(false);
  const [enabled, setEnabledState] = useState(true);

  // ── Ref（避免闭包陈旧值） ──
  const bboxDataRef = useRef<BboxEntry[]>([]);
  const hpRef = useRef(maxHp);
  const comboRef = useRef(0);
  const isKORef = useRef(false);
  const enabledRef = useRef(true);
  const totalHitsRef = useRef(0);
  const totalDamageRef = useRef(0);
  const lastHitTimeRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const koTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 回调 ref（避免 effect 重新订阅）
  const callbacksRef = useRef({ onHit, onKO, onComboChange, onHpChange, onMiss });
  callbacksRef.current = { onHit, onKO, onComboChange, onHpChange, onMiss };

  // ── 清理 ──
  useEffect(() => {
    return () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      if (koTimerRef.current) clearTimeout(koTimerRef.current);
    };
  }, []);

  // ── 重置连击计时器 ──
  const resetComboTimer = useCallback(() => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
      callbacksRef.current.onComboChange?.(0);
    }, comboResetMs);
  }, [comboResetMs]);

  // ── API: loadBboxData ──
  const loadBboxData = useCallback((data: BboxEntry[]) => {
    // 按 time 升序
    bboxDataRef.current = [...data].sort((a, b) => a.time - b.time);
  }, []);

  // ── API: punchAt ──
  const punchAt = useCallback(
    (
      touchX: number,
      touchY: number,
      videoW: number,
      videoH: number,
      currentTime: number,
    ): PunchHitData | null => {
      if (!enabledRef.current || isKORef.current) return null;

      // 命中间隔防抖
      const now = Date.now();
      if (now - lastHitTimeRef.current < minHitIntervalMs) return null;
      lastHitTimeRef.current = now;

      // 查找当前 bbox
      const entry = findBboxAtTime(bboxDataRef.current, currentTime);
      if (!entry) {
        callbacksRef.current.onMiss?.(touchX, touchY);
        return null;
      }

      const bboxPx = bboxToPixel(entry.bbox, videoW, videoH);

      // 命中检测
      if (!isInsideBbox(touchX, touchY, bboxPx, hitExpandPx)) {
        callbacksRef.current.onMiss?.(touchX, touchY);
        return null;
      }

      // ── 命中！ ──
      const dmg = typeof damage === 'function'
        ? damage({ hp: hpRef.current, maxHp, combo: comboRef.current, isKO: false, enabled: true, totalHits: totalHitsRef.current, totalDamage: totalDamageRef.current })
        : damage;

      const newCombo = comboRef.current + 1;
      const newHp = Math.max(0, hpRef.current - dmg);
      const isNowKO = newHp <= 0;

      // 更新 ref
      comboRef.current = newCombo;
      hpRef.current = newHp;
      totalHitsRef.current += 1;
      totalDamageRef.current += dmg;

      // 更新 state
      setCombo(newCombo);
      setHp(newHp);

      // 连击计时
      resetComboTimer();

      // 触觉反馈
      if (newCombo >= 5) {
        safeHaptic('heavy');
      } else if (newCombo >= 3) {
        safeHaptic('medium');
      } else {
        safeHaptic('light');
      }

      // 精度计算（命中点相对 bbox 中心的偏移）
      const accuracy = {
        x: (touchX - bboxPx.cx) / (bboxPx.w / 2 || 1),
        y: (touchY - bboxPx.cy) / (bboxPx.h / 2 || 1),
      };

      const hitData: PunchHitData = {
        combo: newCombo,
        damage: dmg,
        hp: newHp,
        maxHp,
        bbox: entry,
        accuracy,
      };

      callbacksRef.current.onHit?.(hitData);
      callbacksRef.current.onComboChange?.(newCombo);
      callbacksRef.current.onHpChange?.(newHp, maxHp);

      // KO 判定
      if (isNowKO && !isKORef.current) {
        isKORef.current = true;
        setIsKO(true);

        const koData: PunchKOData = {
          totalHits: totalHitsRef.current,
          totalDamage: totalDamageRef.current,
          bbox: entry,
        };
        callbacksRef.current.onKO?.(koData);

        // KO 冷却后自动重置
        koTimerRef.current = setTimeout(() => {
          // 不自动重置，由外部控制（可以在 onKO 中调用 reset）
        }, koCooldownMs);
      }

      return hitData;
    },
    [maxHp, damage, hitExpandPx, minHitIntervalMs, koCooldownMs, resetComboTimer],
  );

  // ── API: reset ──
  const reset = useCallback(() => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    if (koTimerRef.current) clearTimeout(koTimerRef.current);
    hpRef.current = maxHp;
    comboRef.current = 0;
    isKORef.current = false;
    totalHitsRef.current = 0;
    totalDamageRef.current = 0;
    lastHitTimeRef.current = 0;
    setHp(maxHp);
    setCombo(0);
    setIsKO(false);
    callbacksRef.current.onHpChange?.(maxHp, maxHp);
    callbacksRef.current.onComboChange?.(0);
  }, [maxHp]);

  // ── API: setEnabled ──
  const setEnabled = useCallback((val: boolean) => {
    enabledRef.current = val;
    setEnabledState(val);
  }, []);

  // ── API: getState ──
  const getState = useCallback((): PunchModuleState => ({
    hp: hpRef.current,
    maxHp,
    combo: comboRef.current,
    isKO: isKORef.current,
    enabled: enabledRef.current,
    totalHits: totalHitsRef.current,
    totalDamage: totalDamageRef.current,
  }), [maxHp]);

  return {
    loadBboxData,
    punchAt,
    reset,
    setEnabled,
    getState,
  };
}
