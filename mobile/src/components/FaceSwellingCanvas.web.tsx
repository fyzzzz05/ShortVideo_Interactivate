/**
 * FaceSwellingCanvas.web.tsx — Canvas 2D 脸部打肿特效 (Web 端)。
 *
 * ═════════════════════════════════════════════════════
 *  坐标映射核心：
 *
 *  expo-av ResizeMode.COVER → CSS object-fit:cover
 *  视频原始尺寸 ≠ 屏幕显示区域，需要计算渲染偏移：
 *
 *    videoAspect = vw / vh
 *    screenAspect = sw / sh
 *
 *    if videoAspect > screenAspect:  视频更宽→贴高度, 左右裁剪
 *      scale = sh / vh,  offsetX=(sw - vw*scale)/2
 *    else:                           视频更高→贴宽度, 上下裁剪
 *      scale = sw / vw,  offsetY=(sh - vh*scale)/2
 *
 *  MediaPipe 关键点 (0~1 视频坐标) → 屏幕像素:
 *    screenX = lx * vw * scale + offsetX
 *    screenY = ly * vh * scale + offsetY
 * ═════════════════════════════════════════════════════
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Platform, View } from 'react-native';
import type { FacePosition } from '../data/types';

// ── 肿胀包 ──
interface Bump {
  id: number;
  x: number; y: number;         // 屏幕像素坐标
  maxR: number; radius: number; // 当前/最大半径
  level: number;
  phase: 'enter' | 'idle';
  born: number;
}

// ── 调色板 ──
const SKIN = [
  'rgba(255,175,155,0.38)','rgba(255,145,125,0.48)','rgba(238,108,88,0.55)',
  'rgba(212,78,68,0.60)','rgba(188,55,55,0.66)',
];
const BRUISE = [
  'transparent','rgba(188,35,35,0.35)','rgba(142,24,48,0.50)',
  'rgba(92,20,65,0.58)','rgba(52,14,82,0.68)',
];
const REDNESS = [0, 0, 0, 0.13, 0.24, 0.33];

// ── easing ──
function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t-1)**3 + c1 * (t-1)**2;
}

// ── 绘制一个肿胀包 ──
function drawBump(ctx: CanvasRenderingContext2D, b: Bump) {
  const { x, y, radius: r, level } = b;
  if (r < 2) return;

  // ① 皮肤隆起 (径向渐变)
  const sg = ctx.createRadialGradient(x - r*0.15, y - r*0.1, r*0.1, x, y, r);
  sg.addColorStop(0, SKIN[Math.min(level,4)]);
  sg.addColorStop(0.6, SKIN[Math.min(level,4)].replace(/[\d.]+\)$/,'0.2)'));
  sg.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fillStyle = sg; ctx.fill();

  // ② 瘀血核心
  if (level >= 1) {
    const br = r * 0.48;
    const bg = ctx.createRadialGradient(x, y, br*0.05, x, y, br);
    bg.addColorStop(0, BRUISE[Math.min(level,4)]);
    bg.addColorStop(1, 'transparent');
    ctx.beginPath(); ctx.arc(x, y, br, 0, Math.PI*2); ctx.fillStyle = bg; ctx.fill();
  }

  // ③ 黄绿瘀伤环 (高level)
  if (level >= 3) {
    ctx.beginPath(); ctx.arc(x, y, r*0.66, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(175,155,75,${0.22 + level*0.06})`;
    ctx.lineWidth = 2.5; ctx.stroke();
  }

  // ④ 镜面高光 (左上白斑)
  const gr = r * 0.16;
  ctx.beginPath(); ctx.arc(x - r*0.16, y - r*0.14, gr, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fill();

  // ⑤ 次表面散射 (右下弱反光)
  const sr = gr * 0.45;
  ctx.beginPath(); ctx.arc(x + r*0.30, y + r*0.28, sr, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
}

// ── 全脸红润底 ──
function drawRedness(ctx: CanvasRenderingContext2D, cx: number, cy: number, fw: number, fh: number, lv: number) {
  if (lv < 3) return;
  const a = REDNESS[lv];
  const g = ctx.createRadialGradient(cx, cy, fw*0.15, cx, cy, fw*0.8);
  g.addColorStop(0, `rgba(230,35,25,${a})`);
  g.addColorStop(0.5, `rgba(220,30,22,${a*0.55})`);
  g.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.ellipse(cx, cy, fw*0.55, fh*0.55, 0, 0, Math.PI*2);
  ctx.fillStyle = g; ctx.fill();
}

// ── 组件 ──
interface Props {
  facePosition?: FacePosition;
  combo: number;
  accentColor?: string;
  videoPlaying?: boolean;
}

const FaceSwellingCanvas: React.FC<Props> = ({ facePosition, combo, videoPlaying = true }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const faceMeshRef = useRef<any>(null);
  const meshReady = useRef(false);
  // MediaPipe 返回的原始人脸 landmark (0~1 视频坐标系, 多脸)
  const rawLandmarks = useRef<Array<{cx:number;cy:number;fw:number;fh:number}>>([]);
  const bumpsRef = useRef<Bump[]>([]);
  const prevCombo = useRef(0);
  const idGen = useRef(0);
  const rafRef = useRef(0);
  const frameN = useRef(0);

  // ═══ 计算 ResizeMode.COVER 下的视频渲染区域 ═══
  const getVideoRenderRect = useCallback((): {
    ox: number; oy: number; rw: number; rh: number; scale: number;
  } | null => {
    const video = videoElRef.current;
    const wrap = wrapRef.current;
    if (!video || !wrap || !video.videoWidth) return null;
    const vw = video.videoWidth, vh = video.videoHeight;
    const rect = wrap.getBoundingClientRect();
    const sw = rect.width, sh = rect.height;
    if (sw <= 0 || sh <= 0) return null;

    const vAspect = vw / vh, sAspect = sw / sh;
    let rw: number, rh: number, ox: number, oy: number, scale: number;

    if (vAspect > sAspect) {
      // 视频更宽 → 贴高度，左右裁剪
      scale = sh / vh;
      rw = vw * scale; rh = sh;
      ox = (sw - rw) / 2; oy = 0;
    } else {
      // 视频更高 → 贴宽度，上下裁剪
      scale = sw / vw;
      rw = sw; rh = vh * scale;
      ox = 0; oy = (sh - rh) / 2;
    }
    return { ox, oy, rw, rh, scale };
  }, []);

  // ═══ 视频坐标 → 屏幕坐标 ═══
  const videoToScreen = useCallback((lx: number, ly: number): {x:number;y:number} | null => {
    const rr = getVideoRenderRect();
    const video = videoElRef.current;
    if (!rr || !video?.videoWidth) return null;
    return {
      x: lx * video.videoWidth * rr.scale + rr.ox,
      y: ly * video.videoHeight * rr.scale + rr.oy,
    };
  }, [getVideoRenderRect]);

  // ═══ 从 MediaPipe 关键点提取脸部区域 (0~1 视频坐标) ═══
  const extractFaceRegion = useCallback((landmarks: any[]): {cx:number;cy:number;fw:number;fh:number} => {
    const leftCheek = [116,117,118,119,120];
    const rightCheek = [345,346,347,348,349];
    let lx=0,ly=0,rx=0,ry=0;
    leftCheek.forEach(i=>{lx+=landmarks[i].x;ly+=landmarks[i].y});
    rightCheek.forEach(i=>{rx+=landmarks[i].x;ry+=landmarks[i].y});
    lx/=5;ly/=5;rx/=5;ry/=5;
    const cx=(lx+rx)/2, cy=(ly+ry)/2;
    const fw=Math.hypot(rx-lx, ry-ly);
    const fh=Math.hypot(landmarks[10].x-landmarks[152].x, landmarks[10].y-landmarks[152].y);
    return {cx,cy,fw,fh};
  }, []);

  // ═══ 初始化 Canvas + MediaPipe ═══
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const wrap = wrapRef.current;
    if (!wrap) return;

    // --- Canvas ---
    const cvs = document.createElement('canvas');
    cvs.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';
    wrap.appendChild(cvs);
    canvasRef.current = cvs;

    // --- 查找 expo-av 的 <video> ---
    const findVid = () => { const v = document.querySelector('video'); if (v) videoElRef.current = v; };
    findVid();
    const vidT = setInterval(() => { if (!videoElRef.current) findVid(); else clearInterval(vidT); }, 500);

    // --- MediaPipe ---
    let cancelled = false;
    (async () => {
      try {
        const { FaceMesh } = require('@mediapipe/face_mesh');
        const fm = new FaceMesh({
          locateFile: (f: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${f}`,
        });
        fm.setOptions({ maxNumFaces:3, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 });
        fm.onResults((r: any) => {
          if (cancelled || !r.multiFaceLandmarks?.length) return;
          rawLandmarks.current = r.multiFaceLandmarks.map((lm: any[]) => extractFaceRegion(lm));
        });
        await fm.initialize();
        if (!cancelled) { faceMeshRef.current = fm; meshReady.current = true; console.log('[Face] MediaPipe ready'); }
      } catch (e) { console.warn('[Face] MediaPipe failed:', (e as Error).message); meshReady.current = false; }
    })();

    return () => {
      cancelled = true; clearInterval(vidT);
      faceMeshRef.current?.close(); meshReady.current = false;
      cvs.remove(); canvasRef.current = null;
    };
  }, [extractFaceRegion]);

  // ═══ Canvas 尺寸同步 ═══
  const syncSize = useCallback(() => {
    const cvs = canvasRef.current, wrap = wrapRef.current;
    if (!cvs || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const r = wrap.getBoundingClientRect();
    if (cvs.width !== r.width*dpr || cvs.height !== r.height*dpr) {
      cvs.width = r.width * dpr; cvs.height = r.height * dpr;
      cvs.style.width = r.width+'px'; cvs.style.height = r.height+'px';
      cvs.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, []);

  // ═══ 获取脸部屏幕坐标 (MediaPipe优先, 兜底 facePosition) ═══
  const getFaceScreen = useCallback((): Array<{cx:number;cy:number;fw:number;fh:number}> => {
    const rr = getVideoRenderRect();
    if (!rr) return [];

    // 优先用 MediaPipe 检测结果
    if (rawLandmarks.current.length > 0) {
      const video = videoElRef.current;
      if (video?.videoWidth) {
        return rawLandmarks.current.map(f => ({
          cx: f.cx * video.videoWidth * rr.scale + rr.ox,
          cy: f.cy * video.videoHeight * rr.scale + rr.oy,
          fw: f.fw * video.videoWidth * rr.scale,
          fh: f.fh * video.videoHeight * rr.scale,
        }));
      }
    }
    // 兜底 facePosition
    if (facePosition) {
      return [{
        cx: rr.ox + rr.rw * facePosition.x,
        cy: rr.oy + rr.rh * facePosition.y,
        fw: rr.rw * facePosition.width,
        fh: rr.rh * facePosition.height,
      }];
    }
    // 最后兜底：屏幕中心偏上
    return [{ cx: rr.ox + rr.rw/2, cy: rr.oy + rr.rh*0.35, fw: rr.rw*0.28, fh: rr.rh*0.32 }];
  }, [facePosition, getVideoRenderRect]);

  // ═══ combo → 肿胀包 ═══
  const spawnBump = useCallback((level: number, face: {cx:number;cy:number;fw:number;fh:number}): Bump => {
    const angle = Math.random()*Math.PI*2;
    const dist = face.fw * (0.05 + Math.random()*0.28);
    return {
      id: idGen.current++,
      x: face.cx + Math.cos(angle)*dist,
      y: face.cy + Math.sin(angle)*dist*0.65,
      maxR: face.fw * (0.17 + Math.random()*0.11 + level*0.03),
      radius: 0, level: Math.min(level,4),
      phase: 'enter', born: performance.now(),
    };
  }, []);

  useEffect(() => {
    if (combo <= 0) { bumpsRef.current=[]; prevCombo.current=0; idGen.current=0; return; }
    const prev = prevCombo.current;
    if (combo > prev) {
      const faces = getFaceScreen();
      const f = faces[0];
      if (f) for (let i=0;i<combo-prev;i++) bumpsRef.current.push(spawnBump(combo-1, f));
      bumpsRef.current.forEach(b => { b.level = Math.min(b.level+1,4); });
    }
    prevCombo.current = combo;
  }, [combo, spawnBump, getFaceScreen]);

  // ═══ 渲染循环 ═══
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let run = true;

    const loop = async () => {
      if (!run) return;
      syncSize();
      const cvs = canvasRef.current;
      if (!cvs) { rafRef.current = requestAnimationFrame(loop); return; }
      const ctx = cvs.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }
      const dpr = window.devicePixelRatio || 1;
      const cw = cvs.width / dpr, ch = cvs.height / dpr;

      // --- MediaPipe 检测 (每3帧) ---
      frameN.current++;
      const vid = videoElRef.current;
      if (vid && videoPlaying && meshReady.current && faceMeshRef.current && frameN.current%3===0) {
        try { await faceMeshRef.current.send({ image: vid }); }
        catch { /* ignore */ }
      }

      ctx.clearRect(0, 0, cw, ch);

      // ① 全脸红润底
      const rednessLv = Math.min(combo, 5);
      if (rednessLv >= 3) {
        const faces = getFaceScreen();
        if (faces[0]) drawRedness(ctx, faces[0].cx, faces[0].cy, faces[0].fw, faces[0].fh, rednessLv);
      }

      // ② 每个肿胀包
      const now = performance.now();
      const alive: Bump[] = [];
      for (const b of bumpsRef.current) {
        const age = now - b.born;
        if (b.phase === 'enter') {
          const t = Math.min(age/350, 1);
          b.radius = b.maxR * easeOutBack(t);
          if (t >= 1) b.phase = 'idle';
        }
        if (b.phase === 'idle') {
          const idleT = age - 350;
          b.radius = b.maxR * (1 + Math.sin(idleT*0.004 + b.id*0.7)*0.018);
        }
        drawBump(ctx, b);
        alive.push(b);
      }
      bumpsRef.current = alive;

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { run = false; cancelAnimationFrame(rafRef.current); };
  }, [combo, videoPlaying, syncSize, getFaceScreen]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const h = () => syncSize();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [syncSize]);

  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FB = require('./FaceSwelling').default;
    return <FB facePosition={facePosition!} combo={combo} />;
  }

  return <div ref={wrapRef as any} style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }} />;
};

export default FaceSwellingCanvas;
