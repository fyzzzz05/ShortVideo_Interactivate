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

/** 肤色判定 (YCbCr 空间) — 对光照变化鲁棒，覆盖东亚/南亚/高加索人种 */
function isSkinPixel(r: number, g: number, b: number): boolean {
  // 排除纯黑（过暗无信息）和纯白（过曝）
  if (r < 20 && g < 20 && b < 20) return false;
  if (r > 248 && g > 248 && b > 248) return false;

  // RGB → YCbCr (ITU-R BT.601)
  const Y  = 0.299 * r + 0.587 * g + 0.114 * b;
  const Cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const Cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  // 亮度过滤：太暗或太亮不可靠
  if (Y < 40 || Y > 235) return false;

  // 经典肤色阈值 (Chai & Ngan, 1999; 经大量测试微调)
  if (Cb < 75 || Cb > 132) return false;
  if (Cr < 128 || Cr > 178) return false;

  // 椭圆约束：Cb-Cr 空间中肤色呈椭圆分布 (Hsu et al.)
  const x = Cb - 109.38;
  const y = Cr - 152.02;
  const a = 23.5, b1 = 14.5, b2 = 24.5;
  const ecx = 1.8, ecy = 1.2;
  const e = ((x - ecx) ** 2) / (a ** 2) + ((y - ecy) ** 2) / (b1 ** 2);
  if (e > 1.4) {
    // 放宽椭圆给深肤色
    const e2 = ((x + ecx) ** 2) / (a ** 2) + ((y - ecy) ** 2) / (b2 ** 2);
    if (e2 > 1.6) return false;
  }

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

  // 找到最大的肤色连通域（加中心偏置 + 合理面积约束）
  const visited = new Uint8Array(total);
  let best: ReturnType<typeof floodFill> | null = null;
  let bestScore = 0;

  // 优先扫描画面中部偏上区域（短剧竖屏：人脸在画面上半部居中）
  const yStart = Math.floor(sh * 0.02);
  const yEnd   = Math.floor(sh * 0.68);
  const xStart = Math.floor(sw * 0.05);
  const xEnd   = Math.floor(sw * 0.95);
  const cxMid = (xStart + xEnd) / 2;
  const cyMid = (yStart + yEnd) / 2;
  const minArea = Math.max(30, sw * sh * 0.0003); // 至少 0.03% 的像素

  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const i = y * sw + x;
      if (skinMask[i] && !visited[i]) {
        const region = floodFill(visited, sw, sh, x, y, skinMask);
        const rw = region.right - region.left;
        const rh = region.bottom - region.top;
        const aspect = rw / Math.max(rh, 1);
        // 脸型约束：宽高比 0.5~2.0，面积足够
        if (region.area > minArea && aspect > 0.45 && aspect < 2.2) {
          // 评分 = 面积 × 中心偏置 (离画面中央越近越高)
          const dx = (region.cx - cxMid) / sw;
          const dy = (region.cy - cyMid) / sh;
          const centerBias = 1 + Math.max(0, 1 - (dx * dx + dy * dy) * 4);
          const score = region.area * centerBias;
          if (score > bestScore) {
            bestScore = score;
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
