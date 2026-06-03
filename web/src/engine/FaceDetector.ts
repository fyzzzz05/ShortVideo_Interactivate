/**
 * FaceDetector — 基于 Canvas 像素分析的轻量级人脸检测。
 *
 * 原理：利用肤色在 RGB 空间的分布特征，对视频帧逐像素扫描，
 * 找到最大的肤色连通区域作为预估脸部位置。
 *
 * ═══════════════════════════════════════════════════════════
 *  零外部依赖，不需要 CDN，纯 CPU 计算
 * ═══════════════════════════════════════════════════════════
 *
 * 性能：
 *  - 缩放因子 0.25（1920 视频 → 480 采样列，每帧 < 5ms）
 *  - 每 6 帧检测一次（~100ms 间隔，60fps 下几乎无感知）
 */

export interface DetectedFace {
  /** 中心 x，相对于视频宽度 (0~1) */
  x: number;
  /** 中心 y，相对于视频高度 (0~1) */
  y: number;
  /** 脸宽，相对于视频宽度 (0~1) */
  w: number;
  /** 脸高，相对于视频高度 (0~1) */
  h: number;
  /** 置信度：肤色像素占比 (0~1) */
  confidence: number;
}

/** 肤色判定 (RGB 空间) — 覆盖东亚/南亚/高加索人种 */
function isSkinPixel(r: number, g: number, b: number): boolean {
  // 排除过暗/过亮
  if (r < 60 || g < 30 || b < 15) return false;
  if (r > 250 && g > 250 && b > 250) return false;
  // RGB 色差约束：肤色中红色分量占优
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx - mn < 12) return false;
  // 红 > 绿 > 蓝 是肤色的典型特征
  if (r <= g || g <= b) return false;
  // 色调范围约束 (归一化 rg)
  const sum = r + g + b;
  const rg = r / sum;
  const gg = g / sum;
  if (rg < 0.33 || rg > 0.55) return false;
  if (gg < 0.28 || gg > 0.38) return false;
  return true;
}

/** 简易连通域分析 (4-邻域 flood fill, 限制深度防爆栈) */
function floodFill(
  visited: Uint8Array,
  w: number, h: number,
  sx: number, sy: number,
  isSkin: Uint8Array,
): { cx: number; cy: number; left: number; right: number; top: number; bottom: number; area: number } {
  const stack: [number, number][] = [[sx, sy]];
  let area = 0;
  let sumX = 0, sumY = 0;
  let left = sx, right = sx, top = sy, bottom = sy;
  const idx = (x: number, y: number) => y * w + x;

  while (stack.length > 0 && area < 50000) {
    const [x, y] = stack.pop()!;
    const i = idx(x, y);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    if (visited[i]) continue;
    if (!isSkin[i]) continue;
    visited[i] = 1;
    area++;
    sumX += x; sumY += y;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
    stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }

  return {
    cx: sumX / area, cy: sumY / area,
    left, right, top, bottom,
    area,
  };
}

/**
 * 从视频帧检测最大的肤色区域（≈ 人脸位置）。
 * 返回相对坐标 (0~1)，失败返回 null。
 */
export function detectFaceFromVideo(video: HTMLVideoElement): DetectedFace | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  // 缩放因子：限制采样分辨率，保证 < 10ms
  const SCALE = Math.min(0.25, 240 / Math.max(vw, vh));
  const sw = Math.floor(vw * SCALE);
  const sh = Math.floor(vh * SCALE);

  // 用离屏 Canvas 截取当前帧
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, sw, sh);

  const imgData = ctx.getImageData(0, 0, sw, sh);
  const pixels = imgData.data;
  const total = sw * sh;

  // 构建肤色二值图
  const skinMask = new Uint8Array(total);
  let totalSkin = 0;
  for (let i = 0; i < total; i++) {
    const pi = i * 4;
    if (isSkinPixel(pixels[pi], pixels[pi + 1], pixels[pi + 2])) {
      skinMask[i] = 1;
      totalSkin++;
    }
  }

  if (totalSkin < sw * sh * 0.01) {
    // 肤色像素不足 1% → 检测失败（可能是暗场景/远景）
    return null;
  }

  // 找到最大的肤色连通域
  const visited = new Uint8Array(total);
  let best: ReturnType<typeof floodFill> | null = null;

  // 优先扫描画面中部偏上区域（人脸大概率在这里）
  const yStart = Math.floor(sh * 0.05);
  const yEnd = Math.floor(sh * 0.65);
  const xStart = Math.floor(sw * 0.1);
  const xEnd = Math.floor(sw * 0.9);

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const i = y * sw + x;
      if (skinMask[i] && !visited[i]) {
        const region = floodFill(visited, sw, sh, x, y, skinMask);
        // 脸应该有合适的宽高比 (0.5~2.0) 和足够的面积
        const rw = region.right - region.left;
        const rh = region.bottom - region.top;
        const aspect = rw / Math.max(rh, 1);
        if (region.area > 15 && aspect > 0.4 && aspect < 2.5) {
          if (!best || region.area > best.area) {
            best = region;
          }
        }
      }
    }
  }

  if (!best) return null;

  // 转换为相对坐标 (0~1)
  const faceW = (best.right - best.left) / sw;
  const faceH = (best.bottom - best.top) / sw; // 用 sw 保持比例
  const confidence = Math.min(best.area / (sw * sh * 0.15), 1);

  return {
    x: best.cx / sw,
    y: best.cy / sh,
    w: Math.max(faceW, 0.12),
    h: Math.max(faceH, 0.16),
    confidence,
  };
}

/**
 * 从预设数据 + 视频帧检测结果，智能融合输出最终脸部位置。
 * - 如果有视频帧检测结果（高置信度），优先使用
 * - 否则使用预设的 facePosition 兜底数据
 */
export function resolveFacePosition(
  detected: DetectedFace | null,
  preset?: { x: number; y: number; width: number; height: number },
): { x: number; y: number; w: number; h: number } | null {
  if (detected && detected.confidence > 0.3) {
    return { x: detected.x, y: detected.y, w: detected.w, h: detected.h };
  }
  if (preset) {
    return { x: preset.x, y: preset.y, w: preset.width, h: preset.height };
  }
  if (detected) {
    return { x: detected.x, y: detected.y, w: detected.w, h: detected.h };
  }
  return null;
}
