import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EPISODES } from '../data/episodes';
import punchBboxRaw from '../data/punch_bbox.json';

type BboxEntry = {
  time: number;
  bbox: { x: number; y: number; w: number; h: number };
};

type LiveDanmaku = { id: number; text: string; track: number; createdAt: number };

type PunchHighlight = {
  episodeId: number;
  startTime: number;
  endTime: number;
  title: string;
  maxHp: number;
  bboxData: BboxEntry[];
};

type ActiveBbox = BboxEntry & {
  px: number;
  py: number;
  pw: number;
  ph: number;
};

type Effect = {
  dead: boolean;
  update: (dt: number) => void;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

type DomHitEffect = {
  id: number;
  x: number;
  y: number;
  combo: number;
  word: string;
  sparks: Array<{ id: number; dx: number; dy: number; size: number; color: string; delay: number }>;
};

const PUNCH_HIGHLIGHTS: PunchHighlight[] = [
  {
    episodeId: 5,
    startTime: 15,
    endTime: 30,
    title: '点击打脸',
    maxHp: 100,
    bboxData: punchBboxRaw as BboxEntry[],
  },
];

const MATCH_TOLERANCE = 0.08;
const HIT_EXPAND_PX = 8;
const COMBO_WINDOW_MS = 2000;
const COMIC_WORDS = ['BANG', 'POW', 'SMASH', 'BOOM'];
const PARTICLE_EMOJIS = ['⭐', '💥', '⚡', '🔥', '💢', '💫', '✨', '🌟'];
const EMOJI_SPRITES = new Map<string, HTMLCanvasElement>();

function fmtNum(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function getEmojiSprite(emoji: string): HTMLCanvasElement {
  const cached = EMOJI_SPRITES.get(emoji);
  if (cached) return cached;

  const size = 40;
  const cvs = document.createElement('canvas');
  cvs.width = size;
  cvs.height = size;
  const ctx = cvs.getContext('2d');
  if (ctx) {
    ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, size / 2, size / 2 + 1);
  }
  EMOJI_SPRITES.set(emoji, cvs);
  return cvs;
}

class ScreenFlash implements Effect {
  dead = false;
  private elapsed = 0;
  constructor(private w: number, private h: number, private duration = 0.18, private color = '#fff') {}
  update(dt: number) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const alpha = Math.max(0, 1 - this.elapsed / this.duration) * 0.45;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }
}

class Shockwave implements Effect {
  dead = false;
  private elapsed = 0;
  constructor(private x: number, private y: number, private duration = 0.45, private maxR = 122) {}
  update(dt: number) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const t = Math.min(this.elapsed / this.duration, 1);
    const r = this.maxR * t;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const ri = r - i * 7;
      if (ri <= 0) continue;
      ctx.globalAlpha = (1 - t) * (0.72 - i * 0.17);
      ctx.strokeStyle = i === 0 ? '#ffd60a' : i === 1 ? '#ff3b30' : '#fff';
      ctx.lineWidth = 2.8 - i * 0.55;
      ctx.beginPath();
      ctx.arc(this.x, this.y, ri, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class HitSparks implements Effect {
  dead = false;
  private particles: Array<{
    x: number; y: number; vx: number; vy: number; life: number; age: number; size: number; color: string;
  }> = [];
  constructor(x: number, y: number, count = 7) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + rand(-0.25, 0.25);
      const speed = rand(80, 180);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.18, 0.32),
        age: 0,
        size: rand(2, 4),
        color: i % 2 === 0 ? '#ffd60a' : '#ff3b30',
      });
    }
  }
  update(dt: number) {
    let alive = false;
    for (const p of this.particles) {
      p.age += dt;
      if (p.age < p.life) {
        alive = true;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 80 * dt;
        p.vx *= 0.97;
        p.vy *= 0.97;
      }
    }
    this.dead = !alive;
  }
  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      if (p.age >= p.life) continue;
      const t = p.age / p.life;
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

class EmojiBurst implements Effect {
  dead = false;
  private particles: Array<{
    x: number; y: number; vx: number; vy: number; life: number; age: number; rot: number; scale: number; sprite: HTMLCanvasElement;
  }> = [];

  constructor(x: number, y: number, count = randInt(8, 12)) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + rand(-0.28, 0.28);
      const speed = rand(90, 250);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.42, 0.72),
        age: 0,
        rot: rand(-Math.PI, Math.PI),
        scale: rand(0.55, 1.15),
        sprite: getEmojiSprite(PARTICLE_EMOJIS[randInt(0, PARTICLE_EMOJIS.length - 1)]),
      });
    }
  }

  update(dt: number) {
    let alive = false;
    for (const p of this.particles) {
      p.age += dt;
      if (p.age < p.life) {
        alive = true;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 135 * dt;
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.rot += dt * 5;
      }
    }
    this.dead = !alive;
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      if (p.age >= p.life) continue;
      const t = p.age / p.life;
      const size = 34 * p.scale * (1 - t * 0.16);
      ctx.save();
      ctx.globalAlpha = 1 - t;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.drawImage(p.sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }
}

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

const PlayerScreen: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const effectsRef = useRef<Effect[]>([]);
  const canvasDirtyRef = useRef(false);
  const activeBboxesRef = useRef<ActiveBbox[]>([]);
  const bboxCursorRef = useRef(0);
  const shakeRef = useRef({ until: 0, intensity: 0 });
  const firedRef = useRef<Record<number, boolean>>({});
  const hpRef = useRef(100);
  const comboRef = useRef(0);
  const visibleComboRef = useRef(0);
  const totalHitsRef = useRef(0);
  const lastHitAtRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const punchModeRef = useRef(false);

  const [epIdx, setEpIdx] = useState(0);
  const [paused, setPaused] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeB, setLikeB] = useState(false);
  const [swipeY, setSwipeY] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [progX, setProgX] = useState(false);
  const [showIcon, setShowIcon] = useState(false);
  const [iconType, setIconType] = useState<'play' | 'pause'>('play');
  const [danmakuList, setDanmakuList] = useState<LiveDanmaku[]>([]);
  const [showDmInput, setShowDmInput] = useState(false);
  const [punchMode, setPunchMode] = useState(false);
  const [punchCombo, setPunchCombo] = useState(0);
  const [punchHits, setPunchHits] = useState(0);
  const [pendingPunch, setPendingPunch] = useState<PunchHighlight | null>(null);
  const [skipArmed, setSkipArmed] = useState(false);
  const [domEffects, setDomEffects] = useState<DomHitEffect[]>([]);
  const [shakeFlip, setShakeFlip] = useState(false);

  const dmIdRef = useRef(0);
  const ep = EPISODES[epIdx] ?? EPISODES[0];
  const punchHighlight = useMemo(() => PUNCH_HIGHLIGHTS.find(h => h.episodeId === ep.id) ?? null, [ep.id]);
  const prog = duration > 0 ? (time / duration) * 100 : 0;

  useEffect(() => { punchModeRef.current = punchMode; }, [punchMode]);

  const resetPunch = useCallback(() => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    hpRef.current = punchHighlight?.maxHp ?? 100;
    comboRef.current = 0;
    visibleComboRef.current = 0;
    totalHitsRef.current = 0;
    lastHitAtRef.current = 0;
    activeBboxesRef.current = [];
    effectsRef.current = [];
    canvasDirtyRef.current = false;
    setDomEffects([]);
    setPunchCombo(0);
    setPunchHits(0);
    setPendingPunch(null);
    setSkipArmed(false);
  }, [punchHighlight?.maxHp]);

  const getContainerSize = useCallback(() => {
    const r = containerRef.current?.getBoundingClientRect();
    return { w: r?.width || window.innerWidth, h: r?.height || window.innerHeight };
  }, []);

  const getVideoRect = useCallback(() => {
    const vid = videoRef.current;
    if (!vid?.videoWidth) return null;
    const { w: sw, h: sh } = getContainerSize();
    const vA = vid.videoWidth / vid.videoHeight;
    const sA = sw / sh;
    if (vA > sA) {
      const scale = sh / vid.videoHeight;
      return { ox: (sw - vid.videoWidth * scale) / 2, oy: 0, rw: vid.videoWidth * scale, rh: sh };
    }
    const scale = sw / vid.videoWidth;
    return { ox: 0, oy: (sh - vid.videoHeight * scale) / 2, rw: sw, rh: vid.videoHeight * scale };
  }, [getContainerSize]);

  const findActiveBboxes = useCallback((currentTime: number): ActiveBbox[] => {
    if (!punchHighlight) return [];
    const rr = getVideoRect();
    if (!rr) return [];
    const data = punchHighlight.bboxData;
    if (data.length === 0) return [];
    let cursor = bboxCursorRef.current;
    if (cursor >= data.length || data[cursor]?.time > currentTime + MATCH_TOLERANCE) cursor = 0;
    while (cursor < data.length && data[cursor].time < currentTime - MATCH_TOLERANCE) cursor++;
    bboxCursorRef.current = cursor;
    const result: ActiveBbox[] = [];
    for (let i = cursor; i < data.length; i++) {
      const entry = data[i];
      if (entry.time > currentTime + MATCH_TOLERANCE) break;
      result.push({
        ...entry,
        px: rr.ox + entry.bbox.x * rr.rw,
        py: rr.oy + entry.bbox.y * rr.rh,
        pw: entry.bbox.w * rr.rw,
        ph: entry.bbox.h * rr.rh,
      });
    }
    return result;
  }, [getVideoRect, punchHighlight]);

  const exitPunchAndResume = useCallback(() => {
    setPunchMode(false);
    punchModeRef.current = false;
    activeBboxesRef.current = [];
    effectsRef.current = [];
    canvasDirtyRef.current = false;
    setDomEffects([]);
    shakeRef.current = { until: 0, intensity: 0 };
    bboxCursorRef.current = 0;
    setPunchCombo(0);
    setPendingPunch(null);
    setSkipArmed(false);
    setTimeout(() => {
      videoRef.current?.play().catch(() => {});
      setPaused(false);
    }, 30);
  }, []);

  const enterPunchMode = useCallback((highlight: PunchHighlight) => {
    const v = videoRef.current;
    if (!v) return;
    resetPunch();
    v.pause();
    v.currentTime = highlight.startTime;
    bboxCursorRef.current = 0;
    setTime(highlight.startTime);
    setPaused(true);
    setPunchMode(true);
    punchModeRef.current = true;
    setIconType('pause');
    setShowIcon(false);
  }, [resetPunch]);

  const showPunchPrompt = useCallback((highlight: PunchHighlight) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = highlight.startTime;
    setTime(highlight.startTime);
    setPaused(true);
    setPendingPunch(highlight);
    setSkipArmed(false);
    setIconType('pause');
    setShowIcon(false);
  }, []);

  const skipPunchAndResume = useCallback(() => {
    if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    setSkipArmed(true);
    promptTimerRef.current = setTimeout(() => {
      setPendingPunch(null);
      setSkipArmed(false);
      videoRef.current?.play().catch(() => {});
      setPaused(false);
    }, 2000);
  }, []);

  const triggerPunch = useCallback((hitX: number, hitY: number) => {
    if (!punchHighlight) return;
    const now = performance.now();
    comboRef.current = now - lastHitAtRef.current <= COMBO_WINDOW_MS ? comboRef.current + 1 : 1;
    lastHitAtRef.current = now;
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      comboRef.current = 0;
      if (visibleComboRef.current !== 0) {
        visibleComboRef.current = 0;
        setPunchCombo(0);
      }
    }, COMBO_WINDOW_MS);

    totalHitsRef.current += 1;
    setPunchHits(totalHitsRef.current);
    if (visibleComboRef.current !== comboRef.current) {
      visibleComboRef.current = comboRef.current;
      setPunchCombo(comboRef.current);
    }

    const { w, h } = getContainerSize();
    effectsRef.current.push(
      new ScreenFlash(w, h),
      new Shockwave(hitX, hitY),
      new HitSparks(hitX, hitY),
      new EmojiBurst(hitX, hitY, comboRef.current >= 3 ? 12 : 9),
    );
    if (effectsRef.current.length > 14) {
      effectsRef.current.splice(0, effectsRef.current.length - 14);
    }

    const effectId = totalHitsRef.current;
    const sparkCount = comboRef.current >= 3 ? 10 : 7;
    setDomEffects(prev => [
      ...prev.slice(-2),
      {
        id: effectId,
        x: hitX,
        y: hitY,
        combo: comboRef.current,
        word: COMIC_WORDS[randInt(0, COMIC_WORDS.length - 1)],
        sparks: Array.from({ length: sparkCount }, (_, i) => {
          const angle = (Math.PI * 2 * i) / sparkCount + rand(-0.25, 0.25);
          const dist = rand(38, comboRef.current >= 3 ? 82 : 62);
          return {
            id: i,
            dx: Math.cos(angle) * dist,
            dy: Math.sin(angle) * dist,
            size: rand(5, 9),
            color: i % 3 === 0 ? '#fff176' : i % 3 === 1 ? '#ff3b30' : '#ff9f0a',
            delay: i * 8,
          };
        }),
      },
    ]);
    window.setTimeout(() => {
      setDomEffects(prev => prev.filter(effect => effect.id !== effectId));
    }, 520);

    shakeRef.current = { until: performance.now() + 180, intensity: comboRef.current >= 3 ? 6 : 4 };
    setShakeFlip(prev => !prev);
  }, [getContainerSize, punchHighlight]);

  const handlePunchPoint = useCallback((clientX: number, clientY: number) => {
    if (!punchModeRef.current) return false;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return false;
    activeBboxesRef.current = findActiveBboxes(videoRef.current?.currentTime ?? 0);
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const hit = activeBboxesRef.current.find(b =>
      x >= b.px - HIT_EXPAND_PX &&
      x <= b.px + b.pw + HIT_EXPAND_PX &&
      y >= b.py - HIT_EXPAND_PX &&
      y <= b.py + b.ph + HIT_EXPAND_PX,
    );
    if (!hit) return false;
    triggerPunch(hit.px + hit.pw / 2, hit.py + hit.ph / 2);
    return true;
  }, [findActiveBboxes, triggerPunch]);

  useEffect(() => {
    let run = true;
    let last = performance.now();
    let lastPaint = 0;
    const loop = () => {
      if (!run) return;
      const now = performance.now();

      const cvs = canvasRef.current;
      const ctx = cvs?.getContext('2d');
      if (!cvs || !ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const dpr = 1;
      const { w, h } = getContainerSize();
      if (cvs.width !== Math.round(w * dpr) || cvs.height !== Math.round(h * dpr)) {
        cvs.width = Math.round(w * dpr);
        cvs.height = Math.round(h * dpr);
        cvs.style.width = `${w}px`;
        cvs.style.height = `${h}px`;
      }
      if (!punchModeRef.current) {
        activeBboxesRef.current = [];
      }

      const shake = shakeRef.current;
      const hasShake = shake.until > now;
      const hasEffects = effectsRef.current.length > 0;
      if (!hasEffects && !hasShake) {
        if (canvasDirtyRef.current) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, w, h);
          canvasDirtyRef.current = false;
        }
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      if (now - lastPaint < 16) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      lastPaint = now;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      canvasDirtyRef.current = true;

      if (hasShake) {
        const t = 1 - (shake.until - now) / 260;
        const amp = Math.max(0, (1 - t) * shake.intensity);
        ctx.save();
        ctx.translate(rand(-amp, amp), rand(-amp, amp));
      }

      for (let i = effectsRef.current.length - 1; i >= 0; i--) {
        const fx = effectsRef.current[i];
        fx.update(dt);
        fx.draw(ctx);
        if (fx.dead) effectsRef.current.splice(i, 1);
      }
      if (hasShake) ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      run = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [findActiveBboxes, getContainerSize]);

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const t = v.currentTime;
    setTime(t);
    if (!duration) setDuration(v.duration || 0);
    if (punchHighlight && !firedRef.current[ep.id] && t >= punchHighlight.startTime && t < punchHighlight.endTime) {
      firedRef.current[ep.id] = true;
      showPunchPrompt(punchHighlight);
    }
  }, [duration, ep.id, punchHighlight, showPunchPrompt]);

  const onLoaded = useCallback(() => {
    const v = videoRef.current;
    if (v) setDuration(v.duration || 0);
  }, []);

  const togglePlay = useCallback(() => {
    if (punchModeRef.current) return;
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
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

  const swipe = useRef({ sy: 0, dy: 0 });
  const onTS = useCallback((e: React.TouchEvent) => {
    if (punchModeRef.current) return;
    swipe.current = { sy: e.touches[0].clientY, dy: 0 };
    setSwiping(true);
    setSwipeY(0);
  }, []);
  const onTM = useCallback((e: React.TouchEvent) => {
    if (!swiping || punchModeRef.current) return;
    const dy = e.touches[0].clientY - swipe.current.sy;
    swipe.current.dy = dy;
    setSwipeY(dy);
  }, [swiping]);
  const onTE = useCallback(() => {
    if (punchModeRef.current) return;
    setSwiping(false);
    const dy = swipe.current.dy;
    if (Math.abs(dy) > 80) {
      const dir = dy > 0 ? -1 : 1;
      const next = Math.max(0, Math.min(EPISODES.length - 1, epIdx + dir));
      if (next !== epIdx) {
        const nextEpisodeId = EPISODES[next]?.id;
        if (nextEpisodeId !== undefined) firedRef.current[nextEpisodeId] = false;
        setSwipeY(0);
        setEpIdx(next);
        setDanmakuList([]);
        setPunchMode(false);
        resetPunch();
        videoRef.current?.load();
        setTimeout(() => videoRef.current?.play().catch(() => {}), 200);
        setPaused(false);
      } else {
        setSwipeY(0);
      }
    } else {
      setSwipeY(0);
    }
  }, [epIdx, resetPunch]);

  const sendDanmaku = useCallback((text: string) => {
    const dm: LiveDanmaku = { id: dmIdRef.current++, text, track: Math.floor(Math.random() * 4), createdAt: Date.now() };
    setDanmakuList(prev => [...prev.slice(-40), dm]);
    setTimeout(() => setDanmakuList(prev => prev.filter(d => d.id !== dm.id)), 6000);
  }, []);

  const onProgTap = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (punchModeRef.current) return;
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
      ref={containerRef}
      className={`relative w-[375px] h-screen max-h-[812px] bg-black overflow-hidden mx-auto ${
        shakeFlip ? 'punch-screen-shake-a' : 'punch-screen-shake-b'
      }`}
      onTouchStart={onTS}
      onTouchMove={onTM}
      onTouchEnd={onTE}
    >
      <div className="absolute inset-0 transition-transform duration-200" style={{ transform: `translateY(${swiping ? swipeY : 0}px)` }}>
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
            if (next !== epIdx) {
              const nextEpisodeId = EPISODES[next]?.id;
              if (nextEpisodeId !== undefined) firedRef.current[nextEpisodeId] = false;
              setEpIdx(next);
              setPaused(false);
            }
          }}
        />
      </div>

      <div className="absolute inset-0 z-5 flex items-center justify-center" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
        {showIcon && (
          <div className="animate-fade-out">
            {iconType === 'play' ? (
              <svg width="52" height="52" viewBox="0 0 24 24" fill="white" opacity="0.85"><polygon points="5 3 19 12 5 21 5 3" /></svg>
            ) : (
              <svg width="52" height="52" viewBox="0 0 24 24" fill="white" opacity="0.85"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
            )}
          </div>
        )}
      </div>

      <div className="absolute top-0 left-0 right-0 z-10 mask-top" style={{ height: 120 }}>
        <div className="safe-top flex items-center justify-between px-4 pt-3">
          <button className="w-9 h-9 flex items-center justify-center"><IconArrowLeft /></button>
          <span className="text-white text-[16px] font-song tracking-wider truncate max-w-[200px]">{ep.title}</span>
          <button className="w-9 h-9 flex items-center justify-center"><IconShare /></button>
        </div>
      </div>

      <div className="absolute right-3 z-10 flex flex-col items-center gap-5" style={{ bottom: 'calc(120px + env(safe-area-inset-bottom, 0px))' }}>
        <div className="relative">
          <div className="w-[48px] h-[48px] rounded-full bg-gradient-to-br from-pink-400 to-purple-500 border-2 border-white/30 overflow-hidden">
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${ep.author}`} alt="" className="w-full h-full" />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center border border-white">
            <span className="text-white text-[8px] font-bold leading-none">+</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-0.5 cursor-pointer" onClick={() => { if (!liked) { setLikeB(true); setTimeout(() => setLikeB(false), 300); } setLiked(p => !p); }}>
          <div className={likeB ? 'animate-heart-bounce' : ''}><IconHeart filled={liked} /></div>
          <span className="text-white text-[12px] font-song">{fmtNum(ep.stats.likes + (liked ? 1 : 0))}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 cursor-pointer" onClick={() => setShowDmInput(p => !p)}>
          <IconComment />
          <span className="text-white text-[12px] font-song">{fmtNum(ep.stats.comments)}</span>
        </div>
        <div className="flex flex-col items-center gap-0.5"><IconStar /><span className="text-white text-[12px] font-song">{fmtNum(ep.stats.saves)}</span></div>
        <div className="flex flex-col items-center gap-0.5"><IconShare /><span className="text-white text-[12px] font-song">分享</span></div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 mask-bottom pb-safe" style={{ height: 200 }} onClick={(e) => { e.stopPropagation(); setProgX(p => !p); }}>
        <div className="absolute bottom-10 left-4 right-4 flex flex-col gap-1.5">
          <span className="text-white text-[14px] font-medium">@{ep.author}</span>
          <p className="text-white/80 text-[13px] leading-[1.4] line-clamp-2">{ep.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-0.5 overflow-x-auto">
            {ep.tags.map(t => <span key={t} className="text-[11px] text-white/70 border border-white/25 rounded-full px-2 py-0.5 whitespace-nowrap">{t}</span>)}
          </div>
        </div>
      </div>

      <div className="absolute bottom-2 left-3 right-3 z-10 cursor-pointer" style={{ height: progX ? 32 : 16 }} onClick={(e) => { e.stopPropagation(); onProgTap(e); }}>
        <div className="absolute left-0 right-0" style={{ top: 0, height: progX ? 12 : 8 }}>
          {punchHighlight && duration > 0 && (
            <div
              className="absolute"
              title={punchHighlight.title}
              style={{
                left: `${(punchHighlight.startTime / duration) * 100}%`,
                top: '50%',
                transform: 'translate(-50%,-50%)',
                width: progX ? 10 : 6,
                height: progX ? 10 : 6,
                borderRadius: '50%',
                backgroundColor: '#ff1744',
                boxShadow: '0 0 8px #ff1744,0 0 18px #ff1744',
              }}
            />
          )}
        </div>
        <div className="absolute left-0 rounded-full transition-all duration-200 bg-white/20" style={{ top: progX ? 12 : 8, width: '100%', height: progX ? 8 : 2 }}>
          <div className="absolute left-0 top-0 rounded-full bg-white transition-[width] duration-100" style={{ width: `${prog}%`, height: '100%' }} />
          {progX && <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg transition-all" style={{ left: `calc(${prog}% - 8px)` }} />}
        </div>
      </div>

      <div className="absolute z-20 pointer-events-none overflow-hidden" style={{ top: '10%', bottom: '30%', left: 0, right: 0 }}>
        {danmakuList.map(dm => (
          <div key={dm.id} className="absolute whitespace-nowrap font-semibold" style={{
            top: `${dm.track * 22}%`,
            right: '-200px',
            fontSize: '14px',
            color: '#fff',
            textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
            animation: 'dmScroll 7s linear forwards',
            animationPlayState: paused ? 'paused' : 'running',
          }}>{dm.text}</div>
        ))}
        <style>{'@keyframes dmScroll{from{transform:translateX(0)}to{transform:translateX(-600px)}}'}</style>
      </div>

      {showDmInput && (
        <div className="absolute bottom-[100px] left-3 right-3 z-35 flex items-center gap-2">
          <input
            type="text"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const t = (e.target as HTMLInputElement).value;
                if (t.trim()) {
                  sendDanmaku(t);
                  (e.target as HTMLInputElement).value = '';
                }
              }
            }}
            placeholder="发条弹幕..."
            maxLength={50}
            className="flex-1 px-3 py-2 rounded-full text-white text-[13px] bg-white/10 border border-white/20 placeholder-white/40 outline-none"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
          />
          <button
            onClick={(e) => {
              const inp = e.currentTarget.previousElementSibling as HTMLInputElement;
              if (inp?.value.trim()) {
                sendDanmaku(inp.value);
                inp.value = '';
              }
            }}
            className="px-4 py-2 rounded-full text-white text-[13px] font-medium bg-white/15 border border-white/20 active:bg-white/25 transition-all"
          >
            发送
          </button>
        </div>
      )}

      {pendingPunch && !punchMode && (
        <div className="absolute inset-0 z-[45] flex items-center justify-center bg-black/45 px-7" onClick={(e) => e.stopPropagation()}>
          <div className="w-full rounded-xl border border-white/15 bg-black/75 px-5 py-5 text-center shadow-[0_16px_48px_rgba(0,0,0,.45)] backdrop-blur-xl">
            <div className="text-[13px] font-semibold text-white/65">{ep.title}</div>
            <div className="mt-2 text-[22px] font-black tracking-wide text-white">{pendingPunch.title}</div>
            <div className="mt-2 text-[13px] leading-5 text-white/70">
              {skipArmed ? '已跳过，2 秒后继续播放' : '要进入击打互动吗？'}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className="h-11 rounded-lg bg-[#ff3b30] text-[14px] font-black text-white active:scale-95 disabled:opacity-50"
                disabled={skipArmed}
                onClick={() => enterPunchMode(pendingPunch)}
              >
                开始击打
              </button>
              <button
                className="h-11 rounded-lg border border-white/20 bg-white/10 text-[14px] font-semibold text-white active:scale-95 disabled:opacity-50"
                disabled={skipArmed}
                onClick={skipPunchAndResume}
              >
                不打
              </button>
            </div>
          </div>
        </div>
      )}

      {punchMode && (
        <div className="absolute top-14 left-3 right-3 z-40 pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            <div className="min-w-[86px] px-2.5 py-1 rounded-md bg-black/55 border border-white/15 text-white text-[12px] font-black tracking-wide">
              HIT {punchHits}
            </div>
            <button
              className="pointer-events-auto ml-auto h-8 rounded-md border border-white/15 bg-white/10 px-3 text-[12px] font-semibold text-white active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                exitPunchAndResume();
              }}
            >
              继续播放
            </button>
          </div>
          <div className="flex justify-between items-start">
            <div className="px-3 py-1.5 rounded-full bg-black/45 border border-white/15 text-white text-[12px] font-semibold backdrop-blur-md">
              点击脸部打击，想打多久都可以
            </div>
            <div className={`px-3 py-1.5 rounded-full text-white text-[13px] font-black tracking-wide transition-all ${punchCombo >= 2 ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} style={{ background: 'linear-gradient(135deg,#ff3300,#ff6b35)', boxShadow: '0 2px 10px rgba(255,40,0,.45)' }}>
              🔥 {punchCombo} COMBO
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 z-35 pointer-events-none overflow-hidden">
        {domEffects.map(effect => (
          <div key={effect.id} className="absolute left-0 top-0" style={{ transform: `translate(${effect.x}px, ${effect.y}px)` }}>
            <div className="punch-fist">👊</div>
            <div className={`punch-word ${effect.combo >= 3 ? 'hot' : ''}`}>{effect.word}</div>
            {effect.sparks.map(spark => (
              <span
                key={spark.id}
                className="punch-spark"
                style={{
                  width: spark.size,
                  height: spark.size,
                  backgroundColor: spark.color,
                  ['--dx' as string]: `${spark.dx}px`,
                  ['--dy' as string]: `${spark.dy}px`,
                  animationDelay: `${spark.delay}ms`,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        className={`absolute inset-0 z-30 ${punchMode ? 'pointer-events-auto' : 'pointer-events-none'}`}
        onClick={(e) => {
          if (!punchMode) return;
          e.stopPropagation();
          handlePunchPoint(e.clientX, e.clientY);
        }}
        onTouchStart={(e) => {
          if (!punchMode) return;
          e.stopPropagation();
          const t = e.touches[0];
          if (handlePunchPoint(t.clientX, t.clientY)) e.preventDefault();
        }}
      />
      <style>{`
        @keyframes punchScreenShakeA {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          12% { transform: translate3d(-5px, 3px,0) rotate(-.25deg); }
          25% { transform: translate3d(5px, -4px,0) rotate(.25deg); }
          38% { transform: translate3d(-4px, -2px,0) rotate(-.18deg); }
          52% { transform: translate3d(4px, 3px,0) rotate(.18deg); }
          70% { transform: translate3d(-2px, 1px,0) rotate(-.08deg); }
          100% { transform: translate3d(0,0,0) rotate(0deg); }
        }
        @keyframes punchScreenShakeB {
          0% { transform: translate3d(0,0,0) rotate(0deg); }
          12% { transform: translate3d(-5px, 3px,0) rotate(-.25deg); }
          25% { transform: translate3d(5px, -4px,0) rotate(.25deg); }
          38% { transform: translate3d(-4px, -2px,0) rotate(-.18deg); }
          52% { transform: translate3d(4px, 3px,0) rotate(.18deg); }
          70% { transform: translate3d(-2px, 1px,0) rotate(-.08deg); }
          100% { transform: translate3d(0,0,0) rotate(0deg); }
        }
        .punch-screen-shake-a {
          animation: punchScreenShakeA 190ms cubic-bezier(.2,.85,.25,1) both;
          will-change: transform;
        }
        .punch-screen-shake-b {
          animation: punchScreenShakeB 190ms cubic-bezier(.2,.85,.25,1) both;
          will-change: transform;
        }
        @keyframes punchFistFly {
          0% { transform: translate(-170px, -160px) rotate(-34deg) scale(1.35); opacity: 0; }
          16% { opacity: 1; }
          62% { transform: translate(-12px, -10px) rotate(-8deg) scale(1.12); opacity: 1; }
          100% { transform: translate(5px, 4px) rotate(4deg) scale(.72); opacity: 0; }
        }
        @keyframes punchWordPop {
          0% { transform: translate(-50%, -50%) scale(.25) rotate(-9deg); opacity: 0; }
          15% { opacity: 1; }
          42% { transform: translate(-50%, -82%) scale(1.08) rotate(2deg); opacity: 1; }
          100% { transform: translate(-50%, -150%) scale(.92) rotate(7deg); opacity: 0; }
        }
        @keyframes punchSparkBurst {
          0% { transform: translate(-50%, -50%) scale(.55); opacity: 1; }
          70% { opacity: .9; }
          100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(.2); opacity: 0; }
        }
        .punch-fist {
          position: absolute;
          left: -18px;
          top: -18px;
          font-size: 44px;
          line-height: 1;
          transform-origin: 50% 50%;
          animation: punchFistFly 360ms cubic-bezier(.16,.9,.2,1) both;
          filter: drop-shadow(0 8px 10px rgba(0,0,0,.5));
          will-change: transform, opacity;
        }
        .punch-word {
          position: absolute;
          left: 0;
          top: -26px;
          transform: translate(-50%, -50%);
          font-family: Arial Black, Impact, PingFang SC, sans-serif;
          font-size: 30px;
          font-weight: 900;
          letter-spacing: .5px;
          color: #ff3b30;
          -webkit-text-stroke: 3px #111;
          paint-order: stroke fill;
          text-shadow: 0 2px 0 #ffd60a, 0 6px 14px rgba(0,0,0,.55);
          animation: punchWordPop 520ms cubic-bezier(.16,.9,.2,1) both;
          will-change: transform, opacity;
        }
        .punch-word.hot {
          color: #ffd60a;
          text-shadow: 0 2px 0 #ff3b30, 0 0 18px rgba(255,59,48,.75), 0 6px 14px rgba(0,0,0,.55);
        }
        .punch-spark {
          position: absolute;
          left: 0;
          top: 0;
          border-radius: 999px;
          box-shadow: 0 0 10px currentColor;
          animation: punchSparkBurst 420ms cubic-bezier(.12,.8,.2,1) both;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
};

export default PlayerScreen;
