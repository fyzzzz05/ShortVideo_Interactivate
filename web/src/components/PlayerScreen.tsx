/**
 * PlayerScreen — 移动端短剧播放器 (全内联)。
 *
 * Canvas 统一渲染：粒子 + 脸部打肿肿胀包
 * 全部用 ref 驱动，无闭包陷阱
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { EPISODES, HIGHLIGHTS, DANMAKU } from '../data/episodes';
import type { HighlightEvent, ParticlePreset, FacePosition } from '../types';
import { detectFaceFromVideo, resolveFacePosition } from '../engine/FaceDetector';

// ═══ Icons ═══
const IconArrowLeft = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
);
const IconShare = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
);
const IconHeart = ({ filled }: { filled: boolean }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill={filled ? '#FF2D55' : 'none'} stroke={filled ? '#FF2D55' : 'white'} strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
);
const IconComment = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);
const IconStar = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);

function fmtNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// ═══════════════════════════════════════════════════════════
//  Canvas 渲染引擎：粒子 + 肿胀包
// ═══════════════════════════════════════════════════════════

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string;
  type: 'fragment' | 'heart' | 'star' | 'lightning';
  rotation: number; rotSpeed: number;
}

interface SwellBump {
  id: number;
  x: number; y: number;
  maxR: number; radius: number;
  level: number;
  born: number;
  phase: 'enter' | 'idle';
}

const SKIN_COLORS = [
  'rgba(255,180,160,0.42)','rgba(255,148,128,0.52)',
  'rgba(238,110,90,0.58)','rgba(212,78,66,0.64)','rgba(186,55,55,0.70)',
];
const BRUISE_COLORS = [
  'transparent','rgba(190,38,38,0.40)','rgba(145,26,50,0.55)',
  'rgba(95,22,68,0.64)','rgba(55,14,85,0.74)',
];

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

function genParticles(preset: ParticlePreset, cx: number, cy: number): Particle[] {
  const count = 40 + Math.floor(Math.random() * 20);
  const list: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const base: Particle = {
      x: cx, y: cy, vx: 0, vy: 0,
      life: 800 + Math.random() * 600, maxLife: 0,
      size: 0, color: '', type: 'fragment',
      rotation: Math.random() * Math.PI * 2, rotSpeed: 0,
    };
    switch (preset) {
      case 'slap_effect':
      case 'conflict': {
        const a = Math.random() * Math.PI * 2;
        const s = 80 + Math.random() * 250;
        base.type = 'fragment';
        base.size = 3 + Math.random() * 8;
        base.vx = Math.cos(a) * s;
        base.vy = Math.sin(a) * s - 80;
        base.color = ['#FF2D55','#FF3B30','#E74C3C','#C0392B','#FF6B3D','#8B0000'][Math.floor(Math.random() * 6)];
        base.rotSpeed = (Math.random() - 0.5) * 10;
        break;
      }
      case 'sweet': {
        base.type = 'heart';
        base.x = cx + (Math.random() - 0.5) * 200;
        base.y = cy + Math.random() * 80;
        base.vx = (Math.random() - 0.5) * 60;
        base.vy = -(60 + Math.random() * 120);
        base.size = 6 + Math.random() * 12;
        base.color = ['#FF6B9D','#FF2D55','#FF85A1','#FFC0CB','#FF1493'][Math.floor(Math.random() * 5)];
        break;
      }
      case 'funny': {
        const a = Math.random() * Math.PI * 2;
        const s = 80 + Math.random() * 200;
        base.type = 'star';
        base.size = 5 + Math.random() * 10;
        base.vx = Math.cos(a) * s;
        base.vy = Math.sin(a) * s;
        base.color = ['#FFD60A','#FFCC00','#FF9500','#F0E040','#FFE55C'][Math.floor(Math.random() * 5)];
        base.rotSpeed = (Math.random() - 0.5) * 15;
        break;
      }
      case 'reverse': {
        const a = Math.random() * Math.PI * 2;
        const s = 150 + Math.random() * 300;
        base.type = 'lightning';
        base.size = 1.5 + Math.random() * 4;
        base.vx = Math.cos(a) * s;
        base.vy = Math.sin(a) * s;
        base.color = ['#00D4FF','#FFFFFF','#4FC3F7','#E0F7FA','#80DEEA'][Math.floor(Math.random() * 5)];
        break;
      }
    }
    base.maxLife = base.life;
    list.push(base);
  }
  return list;
}

function updateParticles(ps: Particle[], dt: number): Particle[] {
  const sec = dt / 1000;
  return ps
    .map(p => {
      const n = { ...p, life: p.life - dt };
      if (p.type === 'fragment') n.vy += 350 * sec;
      if (p.type === 'heart') n.vx += Math.sin(p.life * 0.005) * 30 * sec;
      n.x += p.vx * sec;
      n.y += p.vy * sec;
      if (p.rotSpeed) n.rotation += p.rotSpeed * sec;
      return n;
    })
    .filter(p => p.life > 0);
}

function drawParticles(ctx: CanvasRenderingContext2D, ps: Particle[]) {
  for (const p of ps) {
    const alpha = Math.min(p.life / p.maxLife, 1);
    ctx.globalAlpha = alpha;
    switch (p.type) {
      case 'fragment': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.size, -p.size * 0.6);
        ctx.lineTo(p.size * 0.4, -p.size);
        ctx.lineTo(p.size, p.size * 0.3);
        ctx.lineTo(-p.size * 0.3, p.size * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'heart': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        const s = p.size;
        const tc = s * 0.3;
        ctx.moveTo(0, tc);
        ctx.bezierCurveTo(0, 0, -s * 0.5, 0, -s * 0.5, s * 0.3);
        ctx.bezierCurveTo(-s * 0.5, s * 0.7, 0, s, 0, s * 0.85);
        ctx.bezierCurveTo(0, s, s * 0.5, s * 0.7, s * 0.5, s * 0.3);
        ctx.bezierCurveTo(s * 0.5, 0, 0, 0, 0, tc);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'star': {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? p.size : p.size * 0.4;
          const fx = Math.cos(a) * r;
          const fy = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(fx, fy);
          else ctx.lineTo(fx, fy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'lightning': {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.03, p.y + p.vy * 0.03);
        ctx.stroke();
        break;
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawBump(ctx: CanvasRenderingContext2D, b: SwellBump) {
  const { x, y, radius: r, level } = b;
  if (r < 2) return;

  // ① 皮肤隆起
  const sg = ctx.createRadialGradient(x - r * 0.15, y - r * 0.1, r * 0.1, x, y, r);
  sg.addColorStop(0, SKIN_COLORS[Math.min(level, 4)]);
  sg.addColorStop(0.6, SKIN_COLORS[Math.min(level, 4)].replace(/[\d.]+\)$/, '0.18)'));
  sg.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = sg;
  ctx.fill();

  // ② 瘀血核心
  if (level >= 1) {
    const br = r * 0.46;
    const bg = ctx.createRadialGradient(x, y, br * 0.05, x, y, br);
    bg.addColorStop(0, BRUISE_COLORS[Math.min(level, 4)]);
    bg.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(x, y, br, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();
  }

  // ③ 黄绿瘀伤环
  if (level >= 3) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.64, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(175,155,75,${0.20 + level * 0.06})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // ④ 镜面高光
  const gr = r * 0.16;
  ctx.beginPath();
  ctx.arc(x - r * 0.16, y - r * 0.14, gr, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  ctx.fill();

  // ⑤ 次高光
  const sr = gr * 0.45;
  ctx.beginPath();
  ctx.arc(x + r * 0.28, y + r * 0.26, sr, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.11)';
  ctx.fill();
}

// ═══════════════════════════════════════════════════════════
//  DanmakuLayer (内联)
// ═══════════════════════════════════════════════════════════
const DanmakuLayer: React.FC<{ currentTime: number; paused: boolean }> = ({ currentTime, paused }) => {
  const [active, setActive] = useState<Array<{ id: string; text: string; track: number; speed: number } | null>>([null, null, null, null]);
  const shown = useRef(new Set<string>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const overdue = DANMAKU.filter(d => d.startTime <= currentTime && !shown.current.has(d.id));
    for (const dm of overdue) {
      shown.current.add(dm.id);
      const dur = (375 + 200) / dm.speed * 1000;
      timers.current.set(dm.id, setTimeout(() => {
        setActive(p => p.map(x => x?.id === dm.id ? null : x));
        timers.current.delete(dm.id);
      }, dur));
      setActive(p => {
        const idx = p.findIndex(x => !x);
        const n = [...p];
        if (idx >= 0 && idx < 4) n[idx] = dm;
        else { n.push(dm); n.shift(); }
        return n;
      });
    }
  }, [currentTime]);

  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach(v => clearTimeout(v)); };
  }, []);

  return (
    <div className="absolute z-20 pointer-events-none overflow-hidden" style={{ top: '10%', bottom: '30%', left: 0, right: 0 }}>
      {active.filter(Boolean).map((dm, i) => (
        dm && <div key={dm.id} className="absolute whitespace-nowrap font-semibold" style={{
          top: `${dm.track * 22}%`,
          right: '-200px',
          fontSize: '14px',
          color: '#fff',
          textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
          animation: `dmScroll ${(375 + 200) / dm.speed}s linear forwards`,
          animationPlayState: paused ? 'paused' : 'running',
        }}>{dm.text}</div>
      ))}
      <style>{`@keyframes dmScroll{from{transform:translateX(0)}to{transform:translateX(-${375 + 400}px)}}`}</style>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
//  HighlightPop (内联)
// ═══════════════════════════════════════════════════════════
const HL_TIMEOUT = 5000;
const HighlightPop: React.FC<{
  highlight: HighlightEvent;
  onAction: () => void;
  onDismiss: () => void;
}> = ({ highlight, onAction, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dead = useRef(false);

  const resetT = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!dead.current) {
        dead.current = true;
        setVisible(false);
        setTimeout(onDismiss, 300);
      }
    }, HL_TIMEOUT);
  }, [onDismiss]);

  useEffect(() => {
    dead.current = false;
    requestAnimationFrame(() => setVisible(true));
    resetT();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [resetT]);

  const doAction = useCallback(() => {
    if (dead.current) return;
    onAction();
    resetT();
  }, [onAction, resetT]);

  return (
    <div
      className={`absolute bottom-[30%] left-1/2 z-40 transition-all duration-250 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[40px]'}`}
      style={{ transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, 40px)' }}
    >
      <div
        className="flex flex-col items-center gap-3 px-6 py-5 rounded-3xl border border-white/20"
        style={{
          background: 'rgba(20,20,20,0.82)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          minWidth: '240px',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-3xl">{highlight.emoji}</span>
          <span className="text-white text-[17px] font-semibold">{highlight.label}</span>
        </div>
        <div className="flex gap-3 w-full">
          <button
            onClick={doAction}
            className="flex-1 py-2.5 px-4 rounded-full text-white text-[14px] font-medium bg-white/10 border border-white/20 active:bg-white/20 active:scale-95 transition-all"
          >
            {highlight.leftBtn}
          </button>
          <button
            onClick={doAction}
            className="flex-1 py-2.5 px-4 rounded-full text-white text-[14px] font-medium bg-white/10 border border-white/20 active:bg-white/20 active:scale-95 transition-all"
          >
            {highlight.rightBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
//  PlayerScreen — 主组件
// ═══════════════════════════════════════════════════════════
const PlayerScreen: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const [epIdx, setEpIdx] = useState(0);
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeB, setLikeB] = useState(false);
  const [swipeY, setSwipeY] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [hl, setHl] = useState<HighlightEvent | null>(null);
  const [progX, setProgX] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [iconType, setIconType] = useState<'play' | 'pause'>('play');

  // ⭐ 全用 ref，不用 state 追踪 combo — 避免闭包陷阱
  const comboRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const bumpsRef = useRef<SwellBump[]>([]);
  const bumpIdRef = useRef(0);
  const shakeRef = useRef({ decay: 0, offset: 0 });
  const faceDataRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const detectTimerRef = useRef(0); // 脸部检测间隔计数器
  const [, forceTick] = useState(0);

  const ep = EPISODES[epIdx] ?? EPISODES[0];
  const prog = duration > 0 ? (time / duration) * 100 : 0;

  // ═══ 视频渲染区域 (object-fit: cover) ═══
  const getVideoRect = useCallback(() => {
    const vid = videoRef.current;
    if (!vid?.videoWidth) return null;
    const vw = vid.videoWidth, vh = vid.videoHeight;
    const sw = window.innerWidth, sh = window.innerHeight;
    if (sw <= 0 || sh <= 0) return null;
    const vA = vw / vh, sA = sw / sh;
    if (vA > sA) {
      const scale = sh / vh;
      return { ox: (sw - vw * scale) / 2, oy: 0, rw: vw * scale, rh: sh, scale };
    }
    const scale = sw / vw;
    return { ox: 0, oy: (sh - vh * scale) / 2, rw: sw, rh: vh * scale, scale };
  }, []);

  // ═══ 脸部屏幕坐标 ═══
  const getFaceScreen = useCallback(() => {
    const rr = getVideoRect();
    if (!rr) return null;
    const fd = faceDataRef.current || { x: 0.5, y: 0.38, w: 0.28, h: 0.34 };
    return {
      cx: rr.ox + rr.rw * fd.x,
      cy: rr.oy + rr.rh * fd.y,
      fw: rr.rw * fd.w,
      fh: rr.rh * fd.h,
    };
  }, [getVideoRect]);

  // ═══ 创建肿胀包 ═══
  const spawnBump = useCallback((level: number) => {
    const f = getFaceScreen();
    if (!f) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = f.fw * (0.04 + Math.random() * 0.26);
    bumpsRef.current.push({
      id: bumpIdRef.current++,
      x: f.cx + Math.cos(angle) * dist,
      y: f.cy + Math.sin(angle) * dist * 0.55,
      maxR: f.fw * (0.16 + Math.random() * 0.10 + level * 0.03),
      radius: 0,
      level: Math.min(level, 4),
      phase: 'enter',
      born: performance.now(),
    });
    console.log(`[Bump] spawned at (${f.cx.toFixed(0)},${f.cy.toFixed(0)}), level=${Math.min(level,4)}, total=${bumpsRef.current.length}`);
  }, [getFaceScreen]);

  // ═══ 触发打脸 ═══
  const triggerSlap = useCallback(() => {
    const nc = comboRef.current + 1;
    comboRef.current = nc;

    // 抖动
    shakeRef.current.decay = Math.min(8 + nc * 2, 18);

    // 粒子
    const f = getFaceScreen();
    if (f) {
      particlesRef.current.push(...genParticles('slap_effect', f.cx, f.cy));
    }

    // 肿胀包
    spawnBump(nc - 1);
    bumpsRef.current.forEach(b => { b.level = Math.min(b.level + 1, 4); });

    forceTick(t => t + 1);
    console.log(`[Slap] combo=${nc}, bumps=${bumpsRef.current.length}, particles=${particlesRef.current.length}`);
  }, [getFaceScreen, spawnBump]);

  // ═══ 重置 ═══
  const resetSlap = useCallback(() => {
    comboRef.current = 0;
    bumpsRef.current = [];
    bumpIdRef.current = 0;
    shakeRef.current = { decay: 0, offset: 0 };
    particlesRef.current = [];
    // 注意：不重置 faceDataRef，保留上次检测到的脸部位置
    forceTick(t => t + 1);
  }, []);

  // ═══ Canvas rAF 渲染循环 ═══
  useEffect(() => {
    let run = true;
    let last = performance.now();

    const loop = () => {
      if (!run) return;
      const now = performance.now();
      const dt = Math.min(now - last, 50);
      last = now;

      const cvs = canvasRef.current;
      if (!cvs) { rafRef.current = requestAnimationFrame(loop); return; }
      const ctx = cvs.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      // 同步 Canvas 尺寸
      const dpr = window.devicePixelRatio || 1;
      const tw = window.innerWidth, th = window.innerHeight;
      if (cvs.width !== tw * dpr || cvs.height !== th * dpr) {
        cvs.width = tw * dpr;
        cvs.height = th * dpr;
        cvs.style.width = tw + 'px';
        cvs.style.height = th + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const cw = cvs.width / dpr;

      // ── 0. 脸部检测（每 6 帧 ≈ 100ms，播放时运⾏）───
      detectTimerRef.current++;
      const vid2 = videoRef.current;
      if (vid2 && !vid2.paused && detectTimerRef.current % 6 === 0 && vid2.videoWidth > 0) {
        const detected = detectFaceFromVideo(vid2);
        if (detected && detected.confidence > 0.2) {
          faceDataRef.current = { x: detected.x, y: detected.y, w: detected.w, h: detected.h };
        }
      }

      ctx.clearRect(0, 0, cw, cvs.height / dpr);

      // ── 1. 抖动 ──
      const sk = shakeRef.current;
      if (sk.decay > 0.01) {
        sk.decay *= Math.exp(-dt / 250);
        sk.offset = sk.decay * Math.sin(now * 0.001 * 60 * Math.PI * 2);
      } else {
        sk.decay = 0;
        sk.offset = 0;
      }
      ctx.save();
      if (Math.abs(sk.offset) > 0.1) ctx.translate(sk.offset, 0);

      // ── 2. 全脸红底 ──
      const cl = Math.min(comboRef.current, 5);
      if (cl >= 3) {
        const fc = getFaceScreen();
        if (fc) {
          const g = ctx.createRadialGradient(fc.cx, fc.cy, fc.fw * 0.12, fc.cx, fc.cy, fc.fw * 0.75);
          const a = [0, 0, 0, 0.14, 0.26, 0.35][cl];
          g.addColorStop(0, `rgba(230,35,25,${a})`);
          g.addColorStop(0.55, `rgba(220,30,22,${a * 0.5})`);
          g.addColorStop(1, 'transparent');
          ctx.beginPath();
          ctx.ellipse(fc.cx, fc.cy, fc.fw * 0.55, fc.fh * 0.55, 0, 0, Math.PI * 2);
          ctx.fillStyle = g;
          ctx.fill();
        }
      }

      // ── 3. 肿胀包更新 + 绘制 ──
      bumpsRef.current = bumpsRef.current.filter(b => {
        const age = now - b.born;
        if (b.phase === 'enter') {
          const t = Math.min(age / 350, 1);
          b.radius = b.maxR * easeOutBack(t);
          if (t >= 1) b.phase = 'idle';
        }
        if (b.phase === 'idle') {
          b.radius = b.maxR * (1 + Math.sin((age - 350) * 0.004 + b.id * 0.7) * 0.016);
        }
        drawBump(ctx, b);
        return true;
      });

      ctx.restore();

      // ── 3.5. 脸部检测调试框（当没有肿胀包/粒子时显⽰）───
      if (bumpsRef.current.length === 0 && particlesRef.current.length === 0) {
        const fc = getFaceScreen();
        if (fc && faceDataRef.current) {
          ctx.save();
          ctx.strokeStyle = 'rgba(0,255,100,0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(fc.cx - fc.fw / 2, fc.cy - fc.fh / 2, fc.fw, fc.fh);
          ctx.fillStyle = 'rgba(0,255,100,0.7)';
          ctx.font = '10px monospace';
          ctx.fillText('FACE', fc.cx - fc.fw / 2, fc.cy - fc.fh / 2 - 4);
          ctx.restore();
        }
      }

      // ── 4. 粒子更新 + 绘制 ──
      particlesRef.current = updateParticles(particlesRef.current, dt);
      drawParticles(ctx, particlesRef.current);

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => { run = false; cancelAnimationFrame(rafRef.current); };
  }, [getFaceScreen]);

  // resize
  useEffect(() => {
    const h = () => { };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // ═══ 视频事件 ═══
  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    setTime(t);
    if (!duration) setDuration(v.duration || 0);
    // 高光点检测
    for (const h of HIGHLIGHTS) {
      if ((h as any)._fired) continue;
      if (Math.abs(h.time - t) < 0.35) {
        (h as any)._fired = true;
        setHl(h);
        // ⭐ 先⽤肤色检测采样当前帧（视频还没暂停，能读到像素）
        const detected = v.videoWidth > 0 ? detectFaceFromVideo(v) : null;
        const resolved = resolveFacePosition(detected, h.facePosition);
        if (resolved) {
          faceDataRef.current = resolved;
          console.log(`[Face] 检测: ${detected ? '肤色' : '兜底'}, pos=(${(resolved.x*100).toFixed(0)}%,${(resolved.y*100).toFixed(0)}%), conf=${detected?.confidence?.toFixed(2) ?? '-'}`);
        }
        resetSlap();
        videoRef.current?.pause();
        setPaused(true);
        break;
      }
    }
  }, [duration, resetSlap]);

  const onLoaded = useCallback(() => {
    const v = videoRef.current;
    if (v) setDuration(v.duration || 0);
  }, []);

  // ═══ 播放控制 ═══
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => { });
      setPaused(false);
      setIconType('pause');
    } else {
      v.pause();
      setPaused(true);
      setIconType('play');
    }
    setShowIcon(true);
    setTimeout(() => setShowIcon(false), 1500);
  }, []);

  // ═══ 滑动手势 ═══
  const swipe = useRef({ sy: 0, dy: 0 });
  const onTS = useCallback((e: React.TouchEvent) => {
    swipe.current = { sy: e.touches[0].clientY, dy: 0 };
    setSwiping(true);
    setSwipeY(0);
  }, []);
  const onTM = useCallback((e: React.TouchEvent) => {
    if (!swiping) return;
    const dy = e.touches[0].clientY - swipe.current.sy;
    swipe.current.dy = dy;
    setSwipeY(dy);
  }, [swiping]);
  const onTE = useCallback(() => {
    setSwiping(false);
    const dy = swipe.current.dy;
    if (Math.abs(dy) > 80) {
      const dir = dy > 0 ? -1 : 1;
      const next = Math.max(0, Math.min(EPISODES.length - 1, epIdx + dir));
      if (next !== epIdx) {
        setSwipeY(0);
        setEpIdx(next);
        HIGHLIGHTS.forEach((h: any) => { h._fired = false; });
        resetSlap();
        videoRef.current?.load();
        setTimeout(() => videoRef.current?.play().catch(() => { }), 200);
        setPaused(false);
      } else {
        setSwipeY(0);
      }
    } else {
      setSwipeY(0);
    }
  }, [epIdx, swiping, resetSlap]);

  // ═══ 高光互动 ═══
  const onHLAct = useCallback(() => {
    if (hl?.type === 'slap_effect' || hl?.type === 'conflict') triggerSlap();
  }, [hl, triggerSlap]);
  const onHLDis = useCallback(() => {
    setHl(null);
    videoRef.current?.play().catch(() => { });
    setPaused(false);
  }, []);

  // ═══ 进度条点击 ═══
  const onProgTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const v = videoRef.current;
    if (v && duration) {
      v.currentTime = ratio * duration;
      setTime(ratio * duration);
    }
  }, [duration]);

  return (
    <div
      className="relative w-[375px] h-screen max-h-[812px] bg-black overflow-hidden mx-auto"
      onTouchStart={onTS}
      onTouchMove={onTM}
      onTouchEnd={onTE}
    >
      {/* ═══ 视频 ═══ */}
      <div
        className="absolute inset-0 transition-transform duration-200"
        style={{ transform: `translateY(${swiping ? swipeY : 0}px)` }}
      >
        <video
          ref={videoRef}
          key={ep.id}
          className="absolute inset-0 w-full h-full object-cover"
          src={ep.src}
          playsInline
          preload="auto"
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoaded}
          onEnded={() => {
            const next = Math.min(EPISODES.length - 1, epIdx + 1);
            if (next !== epIdx) { setEpIdx(next); setPaused(false); }
          }}
        />
      </div>

      {/* ═══ 中央点击 (播放/暂停) ═══ */}
      <div
        className="absolute inset-0 z-5 flex items-center justify-center"
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
      >
        {showIcon && (
          <div className="animate-fade-out">
            {iconType === 'play' ? (
              <svg width="52" height="52" viewBox="0 0 24 24" fill="white" opacity="0.85">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            ) : (
              <svg width="52" height="52" viewBox="0 0 24 24" fill="white" opacity="0.85">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* ═══ 顶部导航 ═══ */}
      <div className="absolute top-0 left-0 right-0 z-10 mask-top" style={{ height: 120 }}>
        <div className="safe-top flex items-center justify-between px-4 pt-3">
          <button className="w-9 h-9 flex items-center justify-center"><IconArrowLeft /></button>
          <span className="text-white text-[16px] font-song tracking-wider truncate max-w-[200px]">{ep.title}</span>
          <button className="w-9 h-9 flex items-center justify-center"><IconShare /></button>
        </div>
      </div>

      {/* ═══ 右侧操作栏 ═══ */}
      <div
        className="absolute right-3 z-10 flex flex-col items-center gap-5"
        style={{ bottom: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="relative">
          <div className="w-[48px] h-[48px] rounded-full bg-gradient-to-br from-pink-400 to-purple-500 border-2 border-white/30 overflow-hidden">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${ep.author}`} alt="" className="w-full h-full" />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center border border-white">
            <span className="text-white text-[8px] font-bold leading-none">+</span>
          </div>
        </div>
        <div
          className="flex flex-col items-center gap-0.5 cursor-pointer"
          onClick={() => {
            if (!liked) { setLikeB(true); setTimeout(() => setLikeB(false), 300); }
            setLiked(p => !p);
          }}
        >
          <div className={likeB ? 'animate-heart-bounce' : ''}><IconHeart filled={liked} /></div>
          <span className="text-white text-[12px] font-song">{fmtNum(ep.stats.likes + (liked ? 1 : 0))}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5"><IconComment /><span className="text-white text-[12px] font-song">{fmtNum(ep.stats.comments)}</span></div>
        <div className="flex flex-col items-center gap-0.5"><IconStar /><span className="text-white text-[12px] font-song">{fmtNum(ep.stats.saves)}</span></div>
        <div className="flex flex-col items-center gap-0.5"><IconShare /><span className="text-white text-[12px] font-song">分享</span></div>
      </div>

      {/* ═══ 底部信息 ═══ */}
      <div
        className="absolute bottom-0 left-0 right-0 z-10 mask-bottom pb-safe"
        style={{ height: 200 }}
        onClick={(e) => { e.stopPropagation(); setProgX(p => !p); }}
      >
        <div className="absolute bottom-10 left-4 right-4 flex flex-col gap-1.5">
          <span className="text-white text-[14px] font-medium">@{ep.author}</span>
          <p className="text-white/80 text-[13px] leading-[1.4] line-clamp-2">{ep.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-0.5 overflow-x-auto">
            {ep.tags.map(t => (
              <span key={t} className="text-[11px] text-white/70 border border-white/25 rounded-full px-2 py-0.5 whitespace-nowrap">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ 进度条 + 高光标记 ═══ */}
      <div
        className="absolute bottom-2 left-3 right-3 z-10 cursor-pointer"
        style={{ height: progX ? 32 : 16 }}
        onClick={(e) => { e.stopPropagation(); onProgTap(e); }}
      >
        {/* 高光标记点 */}
        <div className="absolute left-0 right-0" style={{ top: 0, height: progX ? 12 : 8 }}>
          {HIGHLIGHTS.map(h => {
            const pos = duration > 0 ? (h.time / duration) * 100 : 0;
            if (pos <= 0 || pos >= 100) return null;
            const isNear = duration > 0 && Math.abs(time - h.time) < 1.5;
            const cols: Record<string, string> = {
              conflict: '#FF2D55', sweet: '#FF6B9D', funny: '#FFD60A', reverse: '#4FC3F7', slap_effect: '#FF1744',
            };
            const col = cols[h.type] || '#FFD60A';
            return (
              <div
                key={h.id}
                className="absolute" title={`${h.emoji} ${h.label}`}
                style={{
                  left: `${pos}%`, top: '50%', transform: 'translate(-50%,-50%)',
                  width: progX ? (isNear ? 10 : 7) : 5,
                  height: progX ? (isNear ? 10 : 7) : 5,
                  borderRadius: '50%', backgroundColor: col,
                  boxShadow: isNear ? `0 0 ${progX ? 10 : 6}px ${col},0 0 ${progX ? 20 : 10}px ${col}` : `0 0 3px ${col}`,
                  transition: 'all 0.3s ease', zIndex: isNear ? 5 : 1,
                }}
              />
            );
          })}
        </div>
        {/* 轨道 */}
        <div
          className="absolute left-0 rounded-full transition-all duration-200 bg-white/20"
          style={{ top: progX ? 12 : 8, width: '100%', height: progX ? 8 : 2 }}
        >
          <div
            className="absolute left-0 top-0 rounded-full bg-white transition-[width] duration-100"
            style={{ width: `${prog}%`, height: '100%' }}
          />
          {progX && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg transition-all"
              style={{ left: `calc(${prog}% - 8px)` }}
            />
          )}
        </div>
      </div>

      {/* ═══ 弹幕 ═══ */}
      <DanmakuLayer currentTime={time} paused={paused} />

      {/* ═══ 统一 Canvas（粒子 + 脸部肿胀）═══ */}
      <canvas ref={canvasRef} className="absolute inset-0 z-30 pointer-events-none" />

      {/* ═══ 高光互动浮层 ═══ */}
      {hl && <HighlightPop highlight={hl} onAction={onHLAct} onDismiss={onHLDis} />}
    </div>
  );
};

export default PlayerScreen;
