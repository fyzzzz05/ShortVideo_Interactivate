/**
 * 设计系统 Tokens — 移动端暗色沉浸主题。
 * 基准屏幕：iPhone 375×812pt，通过 Dimensions 自动适配。
 */

import { Dimensions } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── 屏幕尺寸 ──
export const SCREEN = {
  width: SCREEN_W,
  height: SCREEN_H,
  isSmall: SCREEN_W < 375,
  isLarge: SCREEN_W >= 414,
};

// ── 配色 ──
export const COLORS = {
  bg: '#000000',                      // AMOLED 纯黑
  surface: 'rgba(20, 20, 20, 0.85)',  // 半透明面板
  surfaceLight: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.1)',

  // 品牌色
  primary: '#FF2D55',                 // 霓虹红 — 复仇/打脸
  sweet: '#FF6B9D',                   // 粉色 — 发糖
  gold: '#FFD60A',                    // 金色 — 名场面
  success: '#34C759',                 // iOS 绿 — 倒计时/成功
  warning: '#FF9500',                 // 橙 — 警告

  // 文字
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textTertiary: 'rgba(255,255,255,0.35)',

  // 特效
  glow: 'rgba(255, 45, 85, 0.4)',
  goldGlow: 'rgba(255, 214, 10, 0.5)',
};

// ── 字体大小（基于 375pt 宽度缩放） ──
const scale = Math.min(SCREEN_W / 375, 1.2);
const fs = (size: number) => Math.round(size * scale);

export const FONT = {
  combo: fs(48),
  title: fs(20),
  body: fs(15),
  caption: fs(13),
  tiny: fs(11),
};

// ── 间距 ──
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// ── 触摸热区 ──
export const TOUCH = {
  min: 48,          // HIG 最低 44pt，我们留 48pt 余量
  buttonHeight: 56,
  iconSize: 28,
};

// ── 粒子参数 ──
export const PARTICLE = {
  maxCount: 20,
  burstMin: 6,
  burstMax: 15,
  lifetimeMs: 600,
  spreadRadius: 80,
};

// ── 动效时长（ms） ──
export const DURATION = {
  fast: 100,
  normal: 200,
  slow: 400,
  particle: 600,
  comboReset: 2000,
  countdownSec: 3,        // 互动倒计时
};

// ── 混合模式 ──
export const GRADIENT = {
  hero: [COLORS.primary, '#FF6B3D'] as const,
  sweet: [COLORS.sweet, '#FF2D55'] as const,
  gold: [COLORS.gold, '#FF9500'] as const,
};
