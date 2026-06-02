/**
 * FaceSwellingCanvas.web.tsx — Web 端 Canvas 2D 脸部打肿特效。
 *
 * ═══════════════════════════════════════════════════════════════
 *  技术栈
 * ═══════════════════════════════════════════════════════════════
 *  人脸追踪: MediaPipe Face Mesh (468 关键点, WASM 推理)
 *  特效渲染: Canvas 2D (径向渐变 + requestAnimationFrame)
 *  坐标映射: 关键点归一化坐标 → Canvas 像素坐标
 *
 * ═══════════════════════════════════════════════════════════════
 *  渲染管线 (每帧)
 * ═══════════════════════════════════════════════════════════════
 *  1. MediaPipe 拿 video 帧 → 返回 468 个面部关键点
 *  2. 取颧骨区关键点 (左 116-120, 右 345-349) 作为膨胀中心
 *  3. Canvas clear → 逐包绘制:
 *     a) 径向渐变皮肤隆起 (rgba 肉粉色, 外透明内实)
 *     b) 径向渐变瘀血核心 (深红→紫, 较小半径)
 *     c) 黄绿色瘀伤环 (高 combo, border 效果)
 *     d) 白色镜面高光 (左上偏移, 制造半球体反光)
 *  4. requestAnimationFrame 持续 loop, 60fps
 *
 * ═══════════════════════════════════════════════════════════════
 *  连击等级
 * ═══════════════════════════════════════════════════════════════
 *  combo 1 → 1 个小红包, 弹簧弹入
 *  combo 2 → 2 个中包 + 深红瘀血核
 *  combo 3 → 3 个大包 + 紫红核 + 全脸红底色
 *  combo 4 → 4 个大包 + 深紫核 + 黄边 + 深红脸
 *  combo 5 → 5 个满级包 + 蓝紫核 + 明显黄边 + 抖动
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Platform, View, Dimensions } from 'react-native';
import type { FacePosition } from '../data/types';

// ── 类型 ──

interface SwellBump {
  id: number;
  /** Canvas 像素坐标 */
  x: number;
  y: number;
  /** 目标最大半径 (px) */
  maxRadius: number;
  /** 当前动画半径 */
  radius: number;
  level: number;
  /** performance.now() 创建时间 */
  born: number;
  /** 动画阶段: 'enter'(弹簧弹入) | 'idle'(呼吸脉冲) */
  phase: 'enter' | 'idle';
}

interface FaceRegion {
  /** 颧骨中心 canvas x */
  cx: number;
  cy: number;
  /** 脸部估算宽度 (用于确定肿胀包大小) */
  faceWidth: number;
  /** 脸部估算高度 */
  faceHeight: number;
}

interface Props {
  facePosition?: FacePosition;
  combo: number;
  accentColor?: string;
  /** 视频是否正在播放 (播放时才做 MediaPipe 检测节省性能) */
  videoPlaying?: boolean;
}

// ── 常量 ──

/** MediaPipe 每 N 帧检测一次 (节省性能) */
const DETECT_INTERVAL = 3;
/** 肿胀包入场动画时长 ms */
const ENTER_DURATION = 350;
/** 肿胀包持续存在 (combo 不清零就不消失) */
const BUMP_LIFETIME = Infinity;

/** 皮肤隆起色阶梯 */
const SKIN_COLORS = [
  'rgba(255,175,155,0.38)',
  'rgba(255,145,125,0.48)',
  'rgba(238,108,88,0.55)',
  'rgba(212,78,68,0.60)',
  'rgba(188,55,55,0.66)',
];
/** 瘀血核心色阶梯 */
const BRUISE_COLORS = [
  'transparent',
  'rgba(188,35,35,0.35)',
  'rgba(142,24,48,0.50)',
  'rgba(92,20,65,0.58)',
  'rgba(52,14,82,0.68)',
];
/** 全脸红润底色 */
const FACE_REDNESS_ALPHA = [0, 0, 0, 0.13, 0.24, 0.33];

// ============================================================
//  Canvas 2D 绘制函数
// ============================================================

/** easeOutBack — 模拟弹簧回弹 */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** easeOutElastic — 强弹簧 */
function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
}

/** 在 canvas 上绘制一个肿胀包 */
function drawBump(ctx: CanvasRenderingContext2D, b: SwellBump) {
  const { x, y, radius, level } = b;
  if (radius < 2) return;

  const r = radius;
  const skinColor = SKIN_COLORS[Math.min(level, 4)];
  const bruiseColor = BRUISE_COLORS[Math.min(level, 4)];

  // ── ① 皮肤隆起 (大圆, 径向渐变: 中心实 → 边缘透明) ──
  const swellGrad = ctx.createRadialGradient(x - r * 0.15, y - r * 0.1, r * 0.15, x, y, r);
  // 解析 rgba 来构建渐变
  const skinMatch = skinColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
  if (skinMatch) {
    const [, sr, sg, sb, sa] = skinMatch;
    swellGrad.addColorStop(0, `rgba(${sr},${sg},${sb},${sa || 0.38})`);
    swellGrad.addColorStop(0.6, `rgba(${sr},${sg},${sb},${parseFloat(sa || '0.38') * 0.5})`);
    swellGrad.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    swellGrad.addColorStop(0, skinColor);
    swellGrad.addColorStop(1, 'transparent');
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = swellGrad;
  ctx.fill();

  // ── ② 瘀血核心 (小圆在肿胀包内部) ──
  if (level >= 1 && bruiseColor !== 'transparent') {
    const br = r * 0.50;
    const bruiseGrad = ctx.createRadialGradient(x, y, br * 0.1, x, y, br);
    const bMatch = bruiseColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
    if (bMatch) {
      const [, brr, brg, brb, bra] = bMatch;
      bruiseGrad.addColorStop(0, `rgba(${brr},${brg},${brb},${bra || 0.5})`);
      bruiseGrad.addColorStop(0.7, `rgba(${brr},${brg},${brb},${parseFloat(bra || '0.5') * 0.4})`);
      bruiseGrad.addColorStop(1, 'rgba(0,0,0,0)');
    }

    ctx.beginPath();
    ctx.arc(x, y, br, 0, Math.PI * 2);
    ctx.fillStyle = bruiseGrad;
    ctx.fill();
  }

  // ── ③ 黄绿色瘀伤边环 (高等级) ──
  if (level >= 3) {
    const yr = r * 0.68;
    ctx.beginPath();
    ctx.arc(x, y, yr, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180,160,80,${0.25 + level * 0.05})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // ── ④ 镜面高光 (左上小白斑, 制造 3D 半球体错觉) ──
  const glintR = r * 0.16;
  const glintX = x - r * 0.16;
  const glintY = y - r * 0.14;
  ctx.beginPath();
  ctx.arc(glintX, glintY, glintR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();

  // ── ⑤ 次表面散射 (右下微弱反光) ──
  const subR = glintR * 0.45;
  const subX = x + r * 0.30;
  const subY = y + r * 0.28;
  ctx.beginPath();
  ctx.arc(subX, subY, subR, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
}

/** 绘制全脸红润底色 */
function drawFaceRedness(
  ctx: CanvasRenderingContext2D,
  face: FaceRegion,
  rednessLevel: number,
) {
  if (rednessLevel < 3) return;
  const alpha = FACE_REDNESS_ALPHA[rednessLevel];
  if (alpha <= 0) return;

  const rx = face.cx - face.faceWidth * 0.55;
  const ry = face.cy - face.faceHeight * 0.5;
  const rw = face.faceWidth * 1.1;
  const rh = face.faceHeight * 1.05;
  const rr = face.faceWidth * 0.15;

  const grad = ctx.createRadialGradient(face.cx, face.cy, rw * 0.2, face.cx, face.cy, rw * 0.7);
  grad.addColorStop(0, `rgba(230,35,25,${alpha})`);
  grad.addColorStop(0.5, `rgba(220,30,22,${alpha * 0.6})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.beginPath();
  ctx.roundRect(rx, ry, rw, rh, rr);
  ctx.fillStyle = grad;
  ctx.fill();
}

// ============================================================
//  React 组件
// ============================================================

const FaceSwellingCanvas: React.FC<Props> = ({
  facePosition,
  combo,
  accentColor: _accentColor,
  videoPlaying = true,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceMeshRef = useRef<any>(null);
  const faceMeshReady = useRef(false);
  const faceRegions = useRef<FaceRegion[]>([]);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  // 肿胀包列表 (用 ref 避免 React 重渲染 — Canvas 自己画)
  const bumpsRef = useRef<SwellBump[]>([]);
  const prevComboRef = useRef(0);
  const bumpIdGen = useRef(0);
  const rafRef = useRef<number>(0);
  const frameCount = useRef(0);

  const SCREEN = Dimensions.get('window');

  // ── 创建 Canvas DOM 元素 ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const container = containerRef.current;
    if (!container) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    container.appendChild(canvas);
    canvasRef.current = canvas;

    // 找 expo-av 渲染的 <video> 元素
    const findVideo = () => {
      const v = document.querySelector('video');
      if (v) videoElRef.current = v;
    };
    findVideo();
    // expo-av 可能延迟创建 video，定时重试
    const vidTimer = setInterval(() => {
      if (!videoElRef.current) findVideo();
      if (videoElRef.current) clearInterval(vidTimer);
    }, 500);

    return () => {
      clearInterval(vidTimer);
      canvas.remove();
      canvasRef.current = null;
    };
  }, []);

  // ── 初始化 MediaPipe Face Mesh ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let cancelled = false;

    const initFaceMesh = async () => {
      try {
        const { FaceMesh } = require('@mediapipe/face_mesh');

        const fm = new FaceMesh({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
        });

        fm.setOptions({
          maxNumFaces: 3,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        fm.onResults((results: any) => {
          if (cancelled) return;
          if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            faceRegions.current = results.multiFaceLandmarks.map(
              (landmarks: any[]) => extractFaceRegion(landmarks),
            );
          }
        });

        await fm.initialize();
        if (!cancelled) {
          faceMeshRef.current = fm;
          faceMeshReady.current = true;
          console.log('[FaceSwelling] MediaPipe Face Mesh ready');
        }
      } catch (err) {
        console.warn('[FaceSwelling] MediaPipe init failed, using fallback:', err);
        faceMeshReady.current = false;
      }
    };

    initFaceMesh();

    return () => {
      cancelled = true;
      faceMeshRef.current?.close();
      faceMeshReady.current = false;
    };
  }, []);

  // ── Canvas 尺寸同步 ──
  const syncCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, []);

  // ── 从 MediaPipe 关键点提取脸部区域 ──
  const extractFaceRegion = (landmarks: any[]): FaceRegion => {
    // 左颧骨: 116-120, 右颧骨: 345-349
    const cheekLeft = [116, 117, 118, 119, 120];
    const cheekRight = [345, 346, 347, 348, 349];
    // 下巴: 152, 额头: 10
    const chin = landmarks[152];
    const forehead = landmarks[10];
    const noseTip = landmarks[1];

    // 计算面部宽度 (左右颧骨距离)
    let lx = 0,
      ly = 0,
      rx = 0,
      ry = 0;
    cheekLeft.forEach((i) => {
      lx += landmarks[i].x;
      ly += landmarks[i].y;
    });
    cheekRight.forEach((i) => {
      rx += landmarks[i].x;
      ry += landmarks[i].y;
    });
    lx /= cheekLeft.length;
    ly /= cheekLeft.length;
    rx /= cheekRight.length;
    ry /= cheekRight.length;

    const faceWidth = Math.hypot(rx - lx, ry - ly);
    const faceHeight = Math.hypot(forehead.x - chin.x, forehead.y - chin.y);

    // 颧骨中心点 (左右平均)
    const cx = (lx + rx) / 2;
    const cy = (ly + ry) / 2;

    return { cx, cy, faceWidth, faceHeight };
  };

  // ── 从 facePosition 兜底数据提取脸部区域 ──
  const getFallbackFace = useCallback((): FaceRegion | null => {
    if (!facePosition) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cw = canvas.width / (window.devicePixelRatio || 1);
    const ch = canvas.height / (window.devicePixelRatio || 1);
    return {
      cx: facePosition.x * cw,
      cy: facePosition.y * ch,
      faceWidth: facePosition.width * cw,
      faceHeight: facePosition.height * ch,
    };
  }, [facePosition]);

  // ── 获取当前可用的脸部区域 (MediaPipe 优先, 兜底 facePosition) ──
  const getFaceTargets = useCallback((): FaceRegion[] => {
    if (faceRegions.current.length > 0) {
      // 将归一化坐标映射到 Canvas 像素
      const canvas = canvasRef.current;
      if (!canvas) return [];
      const cw = canvas.width / (window.devicePixelRatio || 1);
      const ch = canvas.height / (window.devicePixelRatio || 1);
      return faceRegions.current.map((f) => ({
        cx: f.cx * cw,
        cy: f.cy * ch,
        faceWidth: f.faceWidth * cw,
        faceHeight: f.faceHeight * ch,
      }));
    }
    const fb = getFallbackFace();
    return fb ? [fb] : [];
  }, [getFallbackFace]);

  // ── 生成一个新的肿胀包 ──
  const spawnBump = useCallback(
    (level: number, face: FaceRegion): SwellBump => {
      // 在脸部区域内随机偏移
      const angle = Math.random() * Math.PI * 2;
      const dist = face.faceWidth * (0.06 + Math.random() * 0.30);
      const ox = Math.cos(angle) * dist;
      const oy = Math.sin(angle) * dist * 0.65; // 竖向压缩

      const maxR = face.faceWidth * (0.18 + Math.random() * 0.12 + level * 0.03);

      return {
        id: bumpIdGen.current++,
        x: face.cx + ox,
        y: face.cy + oy,
        maxRadius: maxR,
        radius: 0,
        level: Math.min(level, 4),
        born: performance.now(),
        phase: 'enter',
      };
    },
    [],
  );

  // ── combo 变化 → 更新肿胀包 ──
  useEffect(() => {
    if (combo <= 0) {
      bumpsRef.current = [];
      prevComboRef.current = 0;
      bumpIdGen.current = 0;
      return;
    }

    const prev = prevComboRef.current;
    if (combo > prev) {
      const faces = getFaceTargets();
      const targetFace = faces[0]; // 取第一张脸 (反派)

      if (targetFace) {
        for (let i = 0; i < combo - prev; i++) {
          bumpsRef.current.push(spawnBump(combo - 1, targetFace));
        }
      } else {
        // 没有检测到脸 → 用画布中心兜底
        const canvas = canvasRef.current;
        const cw = canvas ? canvas.width / (window.devicePixelRatio || 1) : SCREEN.width;
        const ch = canvas ? canvas.height / (window.devicePixelRatio || 1) : SCREEN.height;
        const fb: FaceRegion = { cx: cw / 2, cy: ch * 0.35, faceWidth: cw * 0.25, faceHeight: ch * 0.3 };
        for (let i = 0; i < combo - prev; i++) {
          bumpsRef.current.push(spawnBump(combo - 1, fb));
        }
      }

      // 升级已有包的等级
      bumpsRef.current.forEach((b) => {
        b.level = Math.min(b.level + 1, 4);
      });
    }

    prevComboRef.current = combo;
  }, [combo, spawnBump, getFaceTargets, SCREEN.width, SCREEN.height]);

  // ── requestAnimationFrame 渲染循环 ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let running = true;

    const loop = async () => {
      if (!running) return;

      syncCanvasSize();
      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const cw = canvas.width / (window.devicePixelRatio || 1);
      const ch = canvas.height / (window.devicePixelRatio || 1);

      // ── MediaPipe 检测 (每 N 帧) ──
      frameCount.current++;
      const video = videoElRef.current;
      if (
        video &&
        videoPlaying &&
        faceMeshReady.current &&
        faceMeshRef.current &&
        frameCount.current % DETECT_INTERVAL === 0
      ) {
        try {
          await faceMeshRef.current.send({ image: video });
        } catch {
          // MediaPipe send 偶尔抛异常，忽略
        }
      }

      // ── 清除画布 ──
      ctx.clearRect(0, 0, cw, ch);

      // ── 绘制全局效果 ──
      const rednessLevel = Math.min(combo, 5);
      if (rednessLevel >= 3) {
        const faces = getFaceTargets();
        if (faces[0]) drawFaceRedness(ctx, faces[0], rednessLevel);
      }

      // ── 绘制每个肿胀包 ──
      const now = performance.now();
      const alive: SwellBump[] = [];

      for (const b of bumpsRef.current) {
        const age = now - b.born;

        // 入场动画
        if (b.phase === 'enter') {
          const t = Math.min(age / ENTER_DURATION, 1);
          b.radius = b.maxRadius * easeOutBack(t);
          if (t >= 1) b.phase = 'idle';
        }

        // 呼吸脉冲 (idle 阶段)
        if (b.phase === 'idle') {
          const idleTime = age - ENTER_DURATION;
          // 正弦脉冲, 不同包不同频率(用 id 做相位偏移)
          const pulse = 1 + Math.sin(idleTime * 0.004 + b.id * 0.7) * 0.018;
          b.radius = b.maxRadius * pulse;
        }

        if (age < BUMP_LIFETIME) {
          drawBump(ctx, b);
          alive.push(b);
        }
      }
      bumpsRef.current = alive;

      rafRef.current = requestAnimationFrame(loop);
    };

    // 启动循环
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [combo, videoPlaying, syncCanvasSize, getFaceTargets]);

  // ── 窗口大小变化时同步 ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onResize = () => syncCanvasSize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [syncCanvasSize]);

  if (Platform.OS !== 'web') {
    // 非 web 平台回退到原生 View 方案
    const FallbackNative = require('./FaceSwelling').default;
    return <FallbackNative facePosition={facePosition!} combo={combo} />;
  }

  return <div ref={containerRef as any} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />;
};

export default FaceSwellingCanvas;
