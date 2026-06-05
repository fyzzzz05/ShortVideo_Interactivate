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

const PUNCH_HIGHLIGHTS: PunchHighlight[] = [
  {
    episodeId: 5,
    startTime: 15,
    endTime: 30,
    title: '点击打脸',
    maxHp: 300,
    bboxData: punchBboxRaw as BboxEntry[],
  },
];

const MATCH_TOLERANCE = 0.08;
const HIT_EXPAND_PX = 8;
const COMBO_WINDOW_MS = 2000;
const KO_RESUME_MS = 1200;
const COMIC_WORDS = ['BANG!!', 'POW!!', 'SMASH!!', 'BOOM!!', 'PUNCH!!'];
const PARTICLE_EMOJIS = ['⭐', '💥', '⚡', '🔥', '💢', '💫', '✨', '🌟'];

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

class ScreenFlash implements Effect {
  dead = false;
  private elapsed = 0;
  constructor(private w: number, private h: number, private duration = 0.2, private color = '#fff') {}
  update(dt: number) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const alpha = Math.max(0, 1 - this.elapsed / this.duration) * 0.48;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }
}

class FistFly implements Effect {
  dead = false;
  private elapsed = 0;
  private sx = -60;
  private sy = -60;
  constructor(private tx: number, private ty: number, private duration = 0.4) {}
  update(dt: number) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const t = Math.min(this.elapsed / this.duration, 1);
    const e = easeOutCubic(t);
    const x = this.sx + (this.tx - this.sx) * e;
    const y = this.sy + (this.ty - this.sy) * e;
    const alpha = t > 0.82 ? Math.max(0, 1 - (t - 0.82) / 0.18) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate((-35 * (1 - e) * Math.PI) / 180);
    ctx.scale(1 + 0.45 * (1 - e), 1 + 0.45 * (1 - e));
    ctx.font = '42px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👊', 0, 0);
    ctx.restore();
  }
}

class Shockwave implements Effect {
  dead = false;
  private elapsed = 0;
  constructor(private x: number, private y: number, private duration = 0.5, private maxR = 125) {}
  update(dt: number) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const t = Math.min(this.elapsed / this.duration, 1);
    const r = this.maxR * t;
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const ri = r - i * 8;
      if (ri <= 0) continue;
      ctx.globalAlpha = (1 - t) * (0.8 - i * 0.18);
      ctx.strokeStyle = i === 0 ? '#ffd60a' : i === 1 ? '#ff3b30' : '#fff';
      ctx.lineWidth = 3 - i * 0.6;
      ctx.beginPath();
      ctx.arc(this.x, this.y, ri, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}

class ParticleBurst implements Effect {
  dead = false;
  private particles: Array<{
    x: number; y: number; vx: number; vy: number; life: number; age: number; emoji: string; rot: number; scale: number;
  }> = [];
  constructor(x: number, y: number, count = randInt(8, 12)) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + rand(-0.25, 0.25);
      const speed = rand(90, 280);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: rand(0.5, 0.85),
        age: 0,
        emoji: PARTICLE_EMOJIS[randInt(0, PARTICLE_EMOJIS.length - 1)],
        rot: rand(-360, 360),
        scale: rand(0.55, 1.25),
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
        p.vy += 155 * dt;
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
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * t * Math.PI) / 180);
      ctx.scale(p.scale, p.scale);
      ctx.font = '22px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
    }
  }
}

class ComicText implements Effect {
  dead = false;
  private elapsed = 0;
  private text = COMIC_WORDS[randInt(0, COMIC_WORDS.length - 1)];
  constructor(private x: number, private y: number, private duration = 0.7) {}
  update(dt: number) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.dead = true;
  }
  draw(ctx: CanvasRenderingContext2D) {
    const t = Math.min(this.elapsed / this.duration, 1);
    const alpha = t < 0.12 ? t / 0.12 : 1 - t;
    const scale = t < 0.12 ? 0.35 + 0.65 * (t / 0.12) : 1 + 0.15 * t;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.x, this.y - 50 * t);
    ctx.scale(scale, scale);
    ctx.font = '900 30px "Arial Black","PingFang SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    ctx.strokeText(this.text, 0, 0);
    const g = ctx.createLinearGradient(0, -18, 0, 18);
    g.addColorStop(0, '#fff176');
    g.addColorStop(0.5, '#ff6333');
    g.addColorStop(1, '#ff1744');
    ctx.fillStyle = g;
    ctx.fillText(this.text, 0, 0);
    ctx.restore();
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
  const activeBboxesRef = useRef<ActiveBbox[]>([]);
  const bboxCursorRef = useRef(0);
  const shakeRef = useRef({ until: 0, intensity: 0 });
  const firedRef = useRef<Record<number, boolean>>({});
  const hpRef = useRef(300);
  const comboRef = useRef(0);
  const totalHitsRef = useRef(0);
  const lastHitAtRef = useRef(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const koTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [punchHp, setPunchHp] = useState(300);
  const [punchCombo, setPunchCombo] = useState(0);
  const [isKO, setIsKO] = useState(false);

  const dmIdRef = useRef(0);
  const ep = EPISODES[epIdx] ?? EPISODES[0];
  const punchHighlight = useMemo(() => PUNCH_HIGHLIGHTS.find(h => h.episodeId === ep.id) ?? null, [ep.id]);
  const prog = duration > 0 ? (time / duration) * 100 : 0;

  useEffect(() => { punchModeRef.current = punchMode; }, [punchMode]);

  const resetPunch = useCallback((maxHp = punchHighlight?.maxHp ?? 300) => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    if (koTimerRef.current) clearTimeout(koTimerRef.current);
    hpRef.current = maxHp;
    comboRef.current = 0;
    totalHitsRef.current = 0;
    lastHitAtRef.current = 0;
    activeBboxesRef.current = [];
    effectsRef.current = [];
    setPunchHp(maxHp);
    setPunchCombo(0);
    setIsKO(false);
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
    shakeRef.current = { until: 0, intensity: 0 };
    bboxCursorRef.current = 0;
    setIsKO(false);
    setPunchCombo(0);
    setTimeout(() => {
      videoRef.current?.play().catch(() => {});
      setPaused(false);
    }, 30);
  }, []);

  const enterPunchMode = useCallback((highlight: PunchHighlight) => {
    const v = videoRef.current;
    if (!v) return;
    resetPunch(highlight.maxHp);
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

  const triggerPunch = useCallback((hitX: number, hitY: number) => {
    if (!punchHighlight || isKO) return;
    const now = performance.now();
    comboRef.current = now - lastHitAtRef.current <= COMBO_WINDOW_MS ? comboRef.current + 1 : 1;
    lastHitAtRef.current = now;
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      comboRef.current = 0;
      setPunchCombo(0);
    }, COMBO_WINDOW_MS);

    const damage = 8 + randInt(0, 12) + Math.min(comboRef.current * 2, 20);
    hpRef.current = Math.max(0, hpRef.current - damage);
    totalHitsRef.current += 1;
    setPunchHp(hpRef.current);
    setPunchCombo(comboRef.current);

    const { w, h } = getContainerSize();
    effectsRef.current.push(
      new ScreenFlash(w, h),
      new FistFly(hitX, hitY),
      new Shockwave(hitX, hitY),
      new ParticleBurst(hitX, hitY),
      new ComicText(hitX, hitY),
    );

    shakeRef.current = { until: performance.now() + 260, intensity: 7 };

    if (hpRef.current <= 0) {
      setIsKO(true);
      effectsRef.current.push(new ScreenFlash(getContainerSize().w, getContainerSize().h, 0.6, '#ff0000'));
      koTimerRef.current = setTimeout(exitPunchAndResume, KO_RESUME_MS);
    }
  }, [exitPunchAndResume, getContainerSize, isKO, punchHighlight]);

  const handlePunchPoint = useCallback((clientX: number, clientY: number) => {
    if (!punchModeRef.current || isKO) return false;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return false;
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
  }, [isKO, triggerPunch]);

  useEffect(() => {
    let run = true;
    let last = performance.now();
    const loop = () => {
      if (!run) return;
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const cvs = canvasRef.current;
      const ctx = cvs?.getContext('2d');
      if (!cvs || !ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const { w, h } = getContainerSize();
      if (cvs.width !== Math.round(w * dpr) || cvs.height !== Math.round(h * dpr)) {
        cvs.width = Math.round(w * dpr);
        cvs.height = Math.round(h * dpr);
        cvs.style.width = `${w}px`;
        cvs.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (punchModeRef.current) {
        activeBboxesRef.current = findActiveBboxes(videoRef.current?.currentTime ?? 0);
      } else {
        activeBboxesRef.current = [];
      }

      const shake = shakeRef.current;
      if (shake.until > now) {
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
      if (shake.until > now) ctx.restore();

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
      enterPunchMode(punchHighlight);
    }
  }, [duration, enterPunchMode, ep.id, punchHighlight]);

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
        resetPunch(PUNCH_HIGHLIGHTS.find(h => h.episodeId === EPISODES[next]?.id)?.maxHp ?? 300);
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

  const hpPct = punchHighlight ? Math.max(0, (punchHp / punchHighlight.maxHp) * 100) : 100;
  const aliveHearts = punchHighlight ? Math.ceil((punchHp / punchHighlight.maxHp) * 3) : 3;

  return (
    <div
      ref={containerRef}
      className="relative w-[375px] h-screen max-h-[812px] bg-black overflow-hidden mx-auto"
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

      {punchMode && (
        <div className="absolute top-14 left-3 right-3 z-40 pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex gap-1 text-[18px]">
              {[0, 1, 2].map(i => <span key={i} className={i < aliveHearts ? '' : 'opacity-25 grayscale'}>❤️</span>)}
            </div>
            <div className="flex-1 h-2 rounded-full bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${hpPct}%`,
                  background: hpPct < 25 ? 'linear-gradient(90deg,#ff0000,#cc0000)' : hpPct < 50 ? 'linear-gradient(90deg,#ff4757,#ff6348)' : 'linear-gradient(90deg,#ff4757,#ff6348,#ffa502,#2ed573)',
                }}
              />
            </div>
          </div>
          <div className="flex justify-between items-start">
            <div className="px-3 py-1.5 rounded-full bg-black/45 border border-white/15 text-white text-[12px] font-semibold backdrop-blur-md">
              点击红框打脸
            </div>
            <div className={`px-3 py-1.5 rounded-full text-white text-[13px] font-black tracking-wide transition-all ${punchCombo >= 2 ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`} style={{ background: 'linear-gradient(135deg,#ff3300,#ff6b35)', boxShadow: '0 2px 10px rgba(255,40,0,.45)' }}>
              🔥 {punchCombo} COMBO
            </div>
          </div>
        </div>
      )}

      {isKO && (
        <div className="absolute inset-0 z-50 pointer-events-none flex flex-col items-center justify-center">
          <div className="text-[54px] font-black tracking-[6px] text-red-600" style={{ textShadow: '0 0 28px #f00,0 0 60px #ff6b00,0 3px 8px #000' }}>💀 K.O.</div>
          <div className="mt-2 text-[16px] text-yellow-300 tracking-[3px] font-bold" style={{ textShadow: '0 2px 8px #000' }}>坏人被打倒了！</div>
        </div>
      )}

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
    </div>
  );
};

export default PlayerScreen;
