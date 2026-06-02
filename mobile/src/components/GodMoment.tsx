/**
 * GodMoment — 名场面封神动画。
 *
 * 双击触发：
 * - 全屏金色闪白（80ms 内到峰值，再 500ms 衰减）
 * - "封神时刻 ⭐" 文字从中央弹入 + 飘起
 * - 金色粒子爆发
 */

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, Text, Animated } from 'react-native';
import { COLORS, FONT, DURATION } from '../config/theme';

export interface GodMomentHandle {
  trigger: () => void;
}

interface Props {
  onParticleBurst?: (x: number, y: number, color: string) => void;
}

const GodMoment = forwardRef<GodMomentHandle, Props>(({ onParticleBurst }, ref) => {
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const textScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const textY = useRef(new Animated.Value(0)).current;

  const trigger = () => {
    // 金色闪白
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 0.9,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // 文字弹入
    textScale.setValue(0);
    textOpacity.setValue(1);
    textY.setValue(0);
    Animated.sequence([
      Animated.spring(textScale, {
        toValue: 1.2,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
      Animated.spring(textScale, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start();

    // 文字飘起 + 消失
    Animated.parallel([
      Animated.timing(textY, {
        toValue: -80,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(textOpacity, {
        toValue: 0,
        duration: 1200,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // 金色粒子
    onParticleBurst?.(0, 0, COLORS.gold);
  };

  useImperativeHandle(ref, () => ({ trigger }), [trigger]);

  return (
    <>
      {/* 全屏闪白 */}
      <Animated.View
        style={[styles.flash, { opacity: flashOpacity }]}
        pointerEvents="none"
      />

      {/* 封神文字 */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
            transform: [
              { scale: textScale },
              { translateY: textY },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.icon}>⭐</Text>
        <Text style={styles.text}>封神时刻</Text>
      </Animated.View>
    </>
  );
});

export default GodMoment;

const styles = StyleSheet.create({
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.gold,
    zIndex: 100,
  },
  textContainer: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 101,
  },
  icon: {
    fontSize: 48,
  },
  text: {
    fontSize: FONT.title,
    fontWeight: '900',
    color: COLORS.gold,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    marginTop: 4,
  },
});
