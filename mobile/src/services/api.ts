/**
 * ShortVideo Platform API 客户端。
 *
 * 从后端拉取高光数据，转换为前端 Highlight 类型。
 * 网络不可用时上层应 fallback 到本地缓存。
 */

import { Highlight } from '../data/types';

// ── 配置 ──
// 开发时指向本地后端；生产环境替换为实际域名
const API_BASE_URL = __DEV__
  ? 'http://192.168.1.100:8000/api/v1'  // 替换为你的开发机 IP
  : 'https://api.shortvideo.example.com/api/v1';

const REQUEST_TIMEOUT_MS = 5000;

// ── 工具 ──

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ── 数据转换 ──

/**
 * 将后端 Event 格式转换为前端 Highlight 格式。
 * 后端返回的 Event 可能来自 events 表（旧格式）或新的 highlights Schema。
 */
function transformEventToHighlight(raw: any): Highlight {
  const payload = raw.payload || {};
  const startMs = raw.start_ms || 0;

  return {
    id: raw.dedup_key || raw.id || `event_${Date.now()}`,
    episodeId: raw.episode_id,
    time: startMs / 1000,
    startMs,
    endMs: raw.end_ms || startMs + 3000,
    scene: raw.scene_tag || raw.event_type || 'REVENGE',
    type: raw.event_type || raw.type || 'REVENGE',
    confidence: raw.confidence || 0.85,
    title: raw.title || '',
    reason: payload.reason || '',
    interaction: {
      buttons: payload.buttons || ['点击互动'],
      effect: payload.effect || 'burst',
      trigger: 'TAP',
      hint: payload.hint || '',
      durationSec: 3,
    },
    character: payload.character || null,
    triggered: false,
  };
}

// ── API 方法 ──

/**
 * 获取指定集数的高光点列表。
 * @param episodeId 集数 ID
 * @param mode "offline" | "hybrid" — hybrid 含实时检测
 */
export async function fetchHighlights(
  episodeId: number,
  mode: 'offline' | 'hybrid' = 'offline',
): Promise<Highlight[]> {
  const url = `${API_BASE_URL}/episodes/${episodeId}/events?mode=${mode}`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const events = data.events || [];

  return events.map(transformEventToHighlight);
}

/**
 * 获取所有剧集列表。
 */
export async function fetchDramas(): Promise<any[]> {
  const url = `${API_BASE_URL}/dramas`;
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.dramas || data || [];
}

/**
 * 上报互动点击。
 */
export async function reportClick(
  episodeId: number,
  highlightId: string,
  comboCount: number,
): Promise<void> {
  const url = `${API_BASE_URL}/interactions/click`;
  try {
    await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episode_id: episodeId,
        highlight_id: highlightId,
        combo_count: comboCount,
        timestamp: Date.now(),
      }),
    });
  } catch {
    // 静默失败
  }
}

/**
 * 上报点赞。
 */
export async function reportLike(
  episodeId: number,
  highlightId: string,
): Promise<void> {
  const url = `${API_BASE_URL}/interactions/like`;
  try {
    await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        episode_id: episodeId,
        highlight_id: highlightId,
        timestamp: Date.now(),
      }),
    });
  } catch {
    // 静默失败
  }
}
