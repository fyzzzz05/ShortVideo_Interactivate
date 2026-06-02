/**
 * ProgressBar — 可拖拽进度条（web + native 兼容）。
 *
 * 使用 onTouchStart/onTouchMove + measureInWindow 获取精确位置，
 * 替代 PanResponder（在 web 上不可靠）。
 */

import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, TouchableWithoutFeedback } from 'react-native';
import { COLORS } from '../config/theme';
import type { Highlight } from '../data/types';

interface Props {
  currentMs: number;
  durationMs: number;
  highlights: Highlight[];
  onSeek: (ms: number) => void;
}

const ProgressBar: React.FC<Props> = ({ currentMs, durationMs, highlights, onSeek }) => {
  const barRef = useRef<View>(null);
  const [barWidth, setBarWidth] = useState(100);
  const barLeftRef = useRef(0);

  const progress = durationMs > 0 ? Math.min(currentMs / durationMs, 1) : 0;

  const calcSeek = useCallback(
    (pageX: number) => {
      if (durationMs <= 0) return;
      const localX = pageX - barLeftRef.current;
      const ratio = Math.max(0, Math.min(localX / barWidth, 1));
      onSeek(ratio * durationMs);
    },
    [durationMs, barWidth, onSeek],
  );

  // 测量进度条在屏幕上的绝对位置
  const measureBar = useCallback(() => {
    barRef.current?.measureInWindow?.((x: number, _y: number, w: number) => {
      if (w > 0) {
        barLeftRef.current = x;
        setBarWidth(w);
      }
    });
  }, []);

  return (
    <View
      ref={barRef}
      style={styles.container}
      onLayout={measureBar}
      // ═══ 直接触摸事件（web + native 都能用）═══
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => calcSeek(e.nativeEvent.pageX)}
      onResponderMove={(e) => calcSeek(e.nativeEvent.pageX)}
    >
      {/* 轨道 */}
      <View style={styles.track}>
        {/* 已播放 */}
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        {/* 拖拽手柄 */}
        <View style={[styles.thumb, { left: `${progress * 100}%` }]} />
        {/* 高光标记点 */}
        {highlights
          .filter((h) => !h.triggered)
          .map((h) => {
            const ms = h.startMs || h.time * 1000;
            const dotRatio = durationMs > 0 ? ms / durationMs : 0;
            if (dotRatio <= 0 || dotRatio >= 1) return null;
            return (
              <View
                key={h.id}
                style={[
                  styles.dot,
                  {
                    left: `${dotRatio * 100}%`,
                    backgroundColor: h.scene === 'SWEET' ? COLORS.sweet : COLORS.gold,
                  },
                ]}
              />
            );
          })}
      </View>
    </View>
  );
};

export default ProgressBar;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: 48,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'visible',
    marginHorizontal: 10,
  },
  fill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    marginLeft: -8,
  },
  dot: {
    position: 'absolute',
    top: -6,
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
  },
});
