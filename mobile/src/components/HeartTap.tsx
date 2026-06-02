/**
 * HeartTap — KSWL 爱心连点（发糖场景专用）。
 *
 * 甜蜜轻盈的互动体验：
 * - 粉色爱心按钮，点击时长出小爱心飘起
 * - 柔和的 Haptic + 粉色粒子
 * - CP 热度值替代连击数
 * - 温暖的完成提示
 */

import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { InteractionProps } from '../data/types';
import { COLORS, FONT, TOUCH, DURATION } from '../config/theme';

interface Props extends InteractionProps {
  onParticleBurst: (x: number, y: number, color: string) => void;
  countdown: number;
}

const HeartTap: React.FC<Props> = ({
  highlight,
  onComplete,
  onComboUpdate,
  onParticleBurst,
  countdown,
}) => {
  const [hits, setHits] = useState(0);
  const hitsRef = useRef(0);
  const heartScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    hitsRef.current += 1;
    setHits(hitsRef.current);
    onComboUpdate(hitsRef.current);

    // 心跳动画
    heartScale.setValue(0.85);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.2,
        friction: 3,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // 光晕脉冲
    glowOpacity.setValue(0.8);
    Animated.timing(glowOpacity, {
      toValue: 0.3,
      duration: 600,
      useNativeDriver: true,
    }).start();

    // 粉色粒子
    onParticleBurst(0, 0, COLORS.sweet);

    if (hitsRef.current >= 8) {
      setTimeout(() => onComplete(), 200);
    }
  }, [onComplete, onComboUpdate, onParticleBurst]);

  return (
    <View style={styles.container}>
      {/* 倒计时 */}
      <View style={[styles.countdownRing, { borderColor: COLORS.sweet }]}>
        <Text style={[styles.countdownText, { color: COLORS.sweet }]}>
          {countdown}
        </Text>
      </View>

      <Text style={styles.hint}>快速点击为 CP 打 call</Text>

      {/* CP 热度 */}
      <Text style={styles.heatText}>
        💕 CP 热度 <Text style={styles.heatNum}>{Math.min(hits * 12, 100)}%</Text>
      </Text>

      {/* 爱心按钮 */}
      <Animated.View style={{ transform: [{ scale: heartScale }] }}>
        <TouchableOpacity
          style={styles.heartButton}
          onPress={handlePress}
          activeOpacity={0.7}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Animated.View style={[styles.heartGlow, { opacity: glowOpacity }]} />
          <Text style={styles.heartIcon}>💕</Text>
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.description}>
        {hits < 3 ? '点一点，甜一甜' : hits < 6 ? 'kswl！！' : '💖 甜度爆表！'}
      </Text>
    </View>
  );
};

export default HeartTap;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: '25%',
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 30,
  },
  countdownRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  countdownText: {
    fontSize: FONT.body,
    fontWeight: '800',
  },
  hint: {
    fontSize: FONT.body,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heatText: {
    fontSize: FONT.caption,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  heatNum: {
    color: COLORS.sweet,
    fontWeight: '800',
    fontSize: FONT.body,
  },
  heartButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 107, 157, 0.12)',
    borderWidth: 2,
    borderColor: COLORS.sweet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 44,
    backgroundColor: COLORS.sweet,
    opacity: 0.3,
  },
  heartIcon: {
    fontSize: 36,
  },
  description: {
    fontSize: FONT.caption,
    color: COLORS.textTertiary,
    marginTop: 12,
  },
});
