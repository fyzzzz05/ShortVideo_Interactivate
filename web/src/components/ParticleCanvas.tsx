/**
 * ParticleCanvas — 全屏粒子动效层。
 * 绝对定位、pointer-events:none，用 rAF 驱动。
 */
import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { Particle, ParticlePreset } from '../types';
import { generateParticles, updateParticles, drawParticles } from '../utils/particles';

export interface ParticleCanvasHandle {
  fire: (x: number, y: number, preset: ParticlePreset) => void;
}

const ParticleCanvas = forwardRef<ParticleCanvasHandle>((_props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef(0);

  useImperativeHandle(ref, () => ({
    fire(x: number, y: number, preset: ParticlePreset) {
      particlesRef.current.push(...generateParticles(preset, x, y));
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth, h = window.innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(now - last, 50); // cap at 50ms
      last = now;

      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);

      particlesRef.current = updateParticles(particlesRef.current, dt);
      drawParticles(ctx, particlesRef.current);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-30 pointer-events-none"
    />
  );
});

export default ParticleCanvas;
