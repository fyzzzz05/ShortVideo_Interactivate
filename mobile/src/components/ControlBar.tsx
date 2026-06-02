/**
 * ControlBar — 底部控制栏。
 *
 * 播放/暂停按钮 + 下一集按钮 + 剧集选择入口。
 * 玻璃质感半透明背景，不遮挡视频。
 */

import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { COLORS, FONT, TOUCH, SPACING } from '../config/theme';

interface Props {
  isPlaying: boolean;
  hasNext: boolean;
  episodeTitle: string;
  onPlayPause: () => void;
  onNext: () => void;
  onEpisodes: () => void;
}

const ControlBar: React.FC<Props> = ({
  isPlaying,
  hasNext,
  episodeTitle,
  onPlayPause,
  onNext,
  onEpisodes,
}) => {
  return (
    <View style={styles.container}>
      {/* 集数标签 */}
      <TouchableOpacity
        style={styles.episodeTag}
        onPress={onEpisodes}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.episodeText}>{episodeTitle}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      {/* 中间：播放/暂停 */}
      <TouchableOpacity
        style={styles.playBtn}
        onPress={onPlayPause}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
      </TouchableOpacity>

      {/* 下一集 */}
      <TouchableOpacity
        style={[styles.nextBtn, !hasNext && styles.nextBtnDisabled]}
        onPress={onNext}
        disabled={!hasNext}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.nextText, !hasNext && styles.nextTextDisabled]}>
          下一集 ▶
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default ControlBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: 'rgba(10,10,10,0.6)',
  },
  episodeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: TOUCH.min,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
  },
  episodeText: {
    fontSize: FONT.caption,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  chevron: {
    fontSize: FONT.caption,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 16,
  },
  nextBtn: {
    minWidth: TOUCH.min,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    opacity: 0.3,
  },
  nextText: {
    fontSize: FONT.caption,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  nextTextDisabled: {
    color: COLORS.textTertiary,
  },
});
