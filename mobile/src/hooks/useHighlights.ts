/**
 * useHighlights Hook — 网络优先 + 本地兜底的高光数据加载。
 *
 * 策略：
 *   1. 启动时尝试从后端 API 拉取最新高光数据
 *   2. 成功 → 缓存到 AsyncStorage，使用网络数据
 *   3. 失败 → fallback 到本地 JSON 文件
 *
 * 注意：当前不含 AsyncStorage（需安装 @react-native-async-storage/async-storage），
 *       缓存逻辑以注释预留，第二阶段启用。
 */

import { useState, useEffect, useCallback } from 'react';
import { Highlight } from '../data/types';
import { fetchHighlights } from '../services/api';

// ── 本地兜底数据（从原 episode5-highlights.json 转换） ──
// 实际项目中此 import 路径按需调整
// import fallbackData from '../data/episode5-highlights.json';

interface UseHighlightsResult {
  highlights: Highlight[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useHighlights(
  episodeId: number,
  mode: 'offline' | 'hybrid' = 'offline',
): UseHighlightsResult {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. 尝试从后端拉取
      const data = await fetchHighlights(episodeId, mode);
      setHighlights(data);

      // 2. 缓存到本地（AsyncStorage — 待启用）
      // await AsyncStorage.setItem(
      //   `highlights_ep_${episodeId}`,
      //   JSON.stringify(data),
      // );

    } catch (networkError) {
      console.warn('[useHighlights] 网络请求失败，尝试本地兜底:', networkError);

      try {
        // 3. 尝试从缓存加载（AsyncStorage — 待启用）
        // const cached = await AsyncStorage.getItem(`highlights_ep_${episodeId}`);
        // if (cached) {
        //   setHighlights(JSON.parse(cached));
        //   setError('使用了缓存数据');
        //   return;
        // }

        // 4. 最后兜底：本地 JSON 文件
        // const localData = await import(
        //   `../data/episode${episodeId}-highlights.json`
        // );
        // setHighlights(localData.highlights || localData.default?.highlights || []);
        setHighlights([]);
        setError(`无法加载高光数据: ${(networkError as Error).message}`);

      } catch (localError) {
        setHighlights([]);
        setError('所有数据源均不可用');
      }
    } finally {
      setLoading(false);
    }
  }, [episodeId, mode]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    highlights,
    loading,
    error,
    refresh: load,
  };
}
