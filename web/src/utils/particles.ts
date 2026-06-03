import type { Particle, ParticlePreset } from '../types';

// ═══════════════════════════════════════════════════
//  generateParticles — 根据预设生成初始粒子数组
// ═══════════════════════════════════════════════════

const { random, PI, sin, cos } = Math;

export function generateParticles(
  preset: ParticlePreset,
  cx: number,
  cy: number,
): Particle[] {
  const count = 40 + Math.floor(random() * 20); // 40-60 个粒子
  const list: Particle[] = [];

  for (let i = 0; i < count; i++) {
    const p: Particle = {
      x: cx, y: cy, vx: 0, vy: 0,
      life: 800 + random() * 600,
      maxLife: 800 + random() * 600,
      size: 0, color: '', type: 'fragment',
      rotation: 0, rotSpeed: 0,
    };

    switch (preset) {
      case 'conflict': {
        // 红色碎片向四周爆散 + 重力
        const angle = random() * PI * 2;
        const speed = 120 + random() * 250;
        p.type = 'fragment';
        p.size = 3 + random() * 8;
        p.vx = cos(angle) * speed;
        p.vy = sin(angle) * speed - 100;
        p.color = ['#FF2D55', '#FF3B30', '#FF6B3D', '#E74C3C', '#C0392B'][Math.floor(random() * 5)];
        p.rotation = random() * PI * 2;
        p.rotSpeed = (random() - 0.5) * 10;
        break;
      }
      case 'sweet': {
        // 粉色爱心从底部区域飘起
        p.type = 'heart';
        p.x = cx + (random() - 0.5) * 200;
        p.y = cy + random() * 80;
        p.vx = (random() - 0.5) * 60;  // 左右漂移
        p.vy = -(60 + random() * 120);  // 向上飘
        p.size = 6 + random() * 12;
        p.color = ['#FF6B9D', '#FF2D55', '#FF85A1', '#FFC0CB', '#FF1493'][Math.floor(random() * 5)];
        break;
      }
      case 'funny': {
        // 黄色星星旋转爆炸
        const a = random() * PI * 2;
        const sp = 80 + random() * 200;
        p.type = 'star';
        p.size = 5 + random() * 10;
        p.vx = cos(a) * sp;
        p.vy = sin(a) * sp;
        p.color = ['#FFD60A', '#FFCC00', '#FF9500', '#F0E040', '#FFE55C'][Math.floor(random() * 5)];
        p.rotation = random() * PI * 2;
        p.rotSpeed = (random() - 0.5) * 15;
        break;
      }
      case 'reverse': {
        // 蓝白闪电从中心向外扩散
        const a2 = random() * PI * 2;
        const sp2 = 150 + random() * 300;
        p.type = 'lightning';
        p.size = 1.5 + random() * 4;
        p.vx = cos(a2) * sp2;
        p.vy = sin(a2) * sp2;
        p.color = ['#00D4FF', '#FFFFFF', '#4FC3F7', '#E0F7FA', '#80DEEA'][Math.floor(random() * 5)];
        break;
      }
      case 'slap_effect': {
        // 巴掌声波 + 红肿粒子，向脸部四周扩散
        const a3 = random() * PI * 2;
        const sp3 = 60 + random() * 180;
        p.type = 'fragment';
        p.size = 2 + random() * 7;
        p.vx = cos(a3) * sp3;
        p.vy = sin(a3) * sp3 - 50;
        p.color = ['#FF2D55', '#FF3B30', '#C0392B', '#E74C3C', '#FF6B3D', '#8B0000'][Math.floor(random() * 6)];
        p.rotation = random() * PI * 2;
        p.rotSpeed = (random() - 0.5) * 8;
        break;
      }
    }

    list.push(p);
  }
  return list;
}

// ═══════════════════════════════════════════════════
//  updateParticles — 每帧更新粒子状态
// ═══════════════════════════════════════════════════

export function updateParticles(particles: Particle[], dt: number): Particle[] {
  const GRAVITY = 350; // px/s²

  return particles
    .map((p) => {
      const sec = dt / 1000;
      const next = { ...p, life: p.life - dt };

      // 重力（conflict 专属）
      if (p.type === 'fragment') {
        next.vy += GRAVITY * sec;
      }
      // sweet 左右漂移
      if (p.type === 'heart') {
        next.vx += sin(p.life * 0.005) * 30 * sec;
      }

      next.x += p.vx * sec;
      next.y += p.vy * sec;

      if (p.rotSpeed) {
        next.rotation = (p.rotation || 0) + p.rotSpeed * sec;
      }

      return next;
    })
    .filter((p) => p.life > 0);
}

// ═══════════════════════════════════════════════════
//  drawParticles — 绘制所有粒子到 Canvas
// ═══════════════════════════════════════════════════

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const alpha = Math.min(p.life / p.maxLife, 1);
    ctx.save();
    ctx.globalAlpha = alpha;

    switch (p.type) {
      case 'fragment': {
        // 不规则小碎片
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.moveTo(-p.size, -p.size * 0.6);
        ctx.lineTo(p.size * 0.4, -p.size);
        ctx.lineTo(p.size, p.size * 0.3);
        ctx.lineTo(-p.size * 0.3, p.size * 0.8);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'heart': {
        // 爱心
        const s = p.size;
        ctx.translate(p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        const topCurveHeight = s * 0.3;
        ctx.moveTo(0, topCurveHeight);
        // 左半心
        ctx.bezierCurveTo(0, 0, -s * 0.5, 0, -s * 0.5, s * 0.3);
        ctx.bezierCurveTo(-s * 0.5, s * 0.7, 0, s, 0, s * 0.85);
        // 右半心
        ctx.bezierCurveTo(0, s, s * 0.5, s * 0.7, s * 0.5, s * 0.3);
        ctx.bezierCurveTo(s * 0.5, 0, 0, 0, 0, topCurveHeight);
        ctx.fill();
        break;
      }
      case 'star': {
        // 五角星
        const r = p.size;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
          const ir = i === 0 ? r : r * 0.4;
          const x = Math.cos(angle) * (i % 2 === 0 ? r : r * 0.4);
          const y = Math.sin(angle) * (i % 2 === 0 ? r : r * 0.4);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'lightning': {
        // 闪电线条
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 0.03, p.y + p.vy * 0.03);
        ctx.stroke();

        // 光晕
        ctx.strokeStyle = p.color.replace(')', ',0.4)').replace('rgb', 'rgba');
        if (!ctx.strokeStyle.includes('rgba')) ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 2;
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }
}
