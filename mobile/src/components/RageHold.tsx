/**
 * RageHold — 怒气蓄力玩法。
 *
 * 长按屏幕积攒怒气值：
 * - 按住按钮蓄力，进度条渐变填满
 * - 蓄力到 100% 时爆发（火焰粒子 + 重震动 + 裂屏闪白）
 * - 提前松手则怒气释放一部分
 * - 适合冲突/复仇场景
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { InteractionProps } from '../data/types';
import { COLORS, FONT, TOUCH } from '../config/theme';

interface Props extends InteractionProps {
  onParticleBurst: (x: number, y: number, color: string) => void;
  countdown: number;
}

const RageHold: React.FC<Props> = ({
  highlight,
  onComplete,
  onComboUpdate,
  onParticleBurst,
  countdown,
}) => {
  const [rage, setRage] = useState(0);
  const rageRef = useRef(0);
  const btnScale = useRef(new Animated.Value(1)).current;
  const flareOpacity = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasCompleted = useRef(false);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (holdTimer.current) clearInterval(holdTimer.current);
    };
  }, []);

  const startHold = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    btnScale.setValue(0.9);
    Animated.spring(btnScale, {
      toValue: 0.9,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start();

    // 每 80ms 增加 8% 怒气
    holdTimer.current = setInterval(() => {
      rageRef.current = Math.min(rageRef.current + 8, 100);
      setRage(rageRef.current);

      // 不同怒气阶段不同反馈
      if (rageRef.current === 30) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (rageRef.current === 70) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onParticleBurst?.(0, 0, '#FF3B30');
      }

      // 满蓄力 → 爆发
      if (rageRef.current >= 100 && !hasCompleted.current) {
        hasCompleted.current = true;
        if (holdTimer.current) clearInterval(holdTimer.current);

        // 爆裂效果
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        onParticleBurst?.(0, 0, '#FF3B30');
        onComboUpdate(10);

        // 闪白
        Animated.sequence([
          Animated.timing(flareOpacity, {
            toValue: 0.9,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.timing(flareOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();

        setTimeout(() => onComplete(), 300);
      }
    }, 80);
  }, [onComplete, onComboUpdate, onParticleBurst]);

  const endHold = useCallback(() => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }

    // 松手回弹
    btnScale.setValue(0.9);
    Animated.spring(btnScale, {
      toValue: 1,
      friction: 3,
      tension: 120,
      useNativeDriver: true,
    }).start();

    // 未满怒气 → 慢慢衰减
    if (!hasCompleted.current) {
      const decay = setInterval(() => {
        rageRef.current = Math.max(rageRef.current - 5, 0);
        setRage(rageRef.current);
        if (rageRef.current <= 0) clearInterval(decay);
      }, 100);
    }
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: startHold,
      onPanResponderRelease: endHold,
      onPanResponderTerminate: endHold,
    })
  ).current;

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* 闪白 */}
      <Animated.View style={[styles.flare, { opacity: flareOpacity }]} pointerEvents="none" />

      {/* 倒计时 */}
      <View style={[styles.countdownRing, { borderColor: '#FF3B30' }]}>
        <Text style={[styles.countdownText, { color: '#FF3B30' }]}>{countdown}</Text>
      </View>

      <Text style={styles.hint}>长按屏幕蓄力爆发</Text>

      {/* 怒气条 */}
      <View style={styles.rageTrack}>
        <View style={[styles.rageFill, { width: `${rage}%` }]} />
        <View style={[styles.rageGlow, { opacity: rage / 100 * 0.6, width: `${rage}%` }]} />
      </View>
      <Text style={styles.rageText}>{rage}%</Text>

      {/* 按钮 */}
      <Animated.View style={{ transform: [{ scale: btnScale }] }}>
        <View style={styles.holdButton}>
          <Text style={styles.buttonIcon}>🔥</Text>
        </View>
      </Animated.View>

      <Text style={styles.description}>
        {rage < 30 ? '按住不放积蓄怒气...' : rage < 70 ? '怒气上升中！！' : rage < 100 ? '⚡ 即将爆发！' : '💥 MAX!'}
      </Text>
    </View>
  );
};

export default RageHold;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: '25%',
    zIndex: 30,
  },
  flare: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    zIndex: 99,
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
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  rageTrack: {
    width: 200,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  rageFill: {
    height: '100%',
    backgroundColor: '#FF3B30',
    borderRadius: 3,
  },
  rageGlow: {
    position: 'absolute',
    height: '100%',
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    borderRadius: 3,
  },
  rageText: {
    fontSize: FONT.caption,
    color: '#FF3B30',
    fontWeight: '700',
    marginBottom: 20,
  },
  holdButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    borderWidth: 2.5,
    borderColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 32,
  },
  description: {
    fontSize: FONT.caption,
    color: COLORS.textTertiary,
    marginTop: 12,
  },
});
