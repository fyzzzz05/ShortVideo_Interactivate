/**
 * EpisodeSelector — 底部剧集选择面板。
 *
 * 弹出式面板，展示所有可用剧集。
 * - 当前集高亮（霓虹红边框）
 * - 滑动选择，点击切换
 * - 半透明毛玻璃背景
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, FONT, SPACING } from '../config/theme';
import { EPISODES } from '../data/episodes';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  visible: boolean;
  currentEpisodeId: number;
  onSelect: (episodeId: number) => void;
  onClose: () => void;
}

const EpisodeSelector: React.FC<Props> = ({
  visible,
  currentEpisodeId,
  onSelect,
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <SafeAreaView style={styles.panel} edges={['bottom']}>
              {/* 手柄 */}
              <View style={styles.handle} />

              <Text style={styles.title}>选择剧集</Text>

              <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.grid}
              >
                {EPISODES.map((ep) => {
                  const isActive = ep.id === currentEpisodeId;
                  return (
                    <TouchableOpacity
                      key={ep.id}
                      style={[
                        styles.episodeCard,
                        isActive && styles.episodeCardActive,
                      ]}
                      onPress={() => {
                        onSelect(ep.id);
                        onClose();
                      }}
                      activeOpacity={0.7}
                    >
                      {/* 缩略图占位 */}
                      <View
                        style={[
                          styles.thumbnail,
                          isActive && styles.thumbnailActive,
                        ]}
                      >
                        <Text style={styles.thumbnailText}>
                          🎬
                        </Text>
                      </View>
                      <View style={styles.episodeInfo}>
                        <Text
                          style={[
                            styles.episodeTitle,
                            isActive && styles.episodeTitleActive,
                          ]}
                        >
                          {ep.title}
                        </Text>
                        <Text style={styles.duration}>
                          {ep.duration} · {isActive ? '正在播放' : '点击播放'}
                        </Text>
                      </View>
                      {isActive && (
                        <View style={styles.playingBadge}>
                          <Text style={styles.playingBadgeText}>播放中</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </SafeAreaView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

export default EpisodeSelector;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  panel: {
    maxHeight: SCREEN_H * 0.65,
    backgroundColor: '#1A1A1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT.title,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  scroll: {
    flexGrow: 0,
  },
  grid: {
    gap: 8,
  },
  episodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  episodeCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(255, 45, 85, 0.06)',
  },
  thumbnail: {
    width: 56,
    height: 40,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  thumbnailActive: {
    backgroundColor: 'rgba(255, 45, 85, 0.12)',
  },
  thumbnailText: {
    fontSize: 20,
  },
  episodeInfo: {
    flex: 1,
  },
  episodeTitle: {
    fontSize: FONT.body,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  episodeTitleActive: {
    color: COLORS.primary,
  },
  duration: {
    fontSize: FONT.tiny,
    color: COLORS.textTertiary,
  },
  playingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  playingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
  },
});
