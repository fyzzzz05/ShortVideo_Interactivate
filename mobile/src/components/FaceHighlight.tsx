/**
 * FaceHighlight — 脸部高亮光晕 + combo 驱动抖动。
 *
 * 双层光环：内层实色 + 外层径向模糊
 * 脉冲呼吸 + combo 加剧的左右抖动（模拟被打脸）
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Dimensions } from 'react-native';
import { FacePosition } from '../data/types';
import { COLORS, DURATION } from '../config/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  facePosition: FacePosition;
  color?: string;
  visible: boolean;
  /** combo 数 — 越高抖动越猛 */
  combo?: number;
}

const FaceHighlight: React.FC<Props> = ({
  facePosition,
  color = COLORS.primary,
  visible,
  combo = 0,
}) => {
  const pulse = useRef(new Animated.Value(0)).current;
  const shakeX = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const shakeIntensity = useRef(3);

  // combo 变化 → 更新抖动强度
  useEffect(() => {
    shakeIntensity.current = combo >= 5 ? 12 : combo >= 3 ? 8 : combo >= 1 ? 5 : 3;
  }, [combo]);

  useEffect(() => {
    if (visible) {
      // 入场淡入
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: DURATION.normal,
        useNativeDriver: true,
      }).start();

      // 脉冲循环
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoop.start();

      // 抖动循环（强度随 combo 变化）
      let running = true;
      const shakeLoop = () => {
        if (!running) return;
        const int = shakeIntensity.current;
        Animated.sequence([
          Animated.timing(shakeX, { toValue: int, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -int, duration: 80, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: int * 0.6, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: -int * 0.3, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start(() => shakeLoop());
      };
      shakeLoop();

      return () => {
        running = false;
        pulseLoop.stop();
        shakeX.setValue(0);
        glowOpacity.setValue(0);
        pulse.setValue(0);
      };
    } else {
      Animated.timing(glowOpacity, {
        toValue: 0,
        duration: DURATION.normal,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // ── 全屏布局下的脸部坐标 ──
  const faceW = SCREEN_W * facePosition.width;
  const faceH = SCREEN_H * facePosition.height;
  const faceX = SCREEN_W * facePosition.x - faceW / 2;
  const faceY = SCREEN_H * facePosition.y - faceH / 2;

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  // 光晕颜色随 combo 加深
  const glowColor = combo >= 4
    ? '#C0392B'
    : combo >= 2
    ? '#E74C3C'
    : color;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          left: faceX,
          top: faceY,
          width: faceW,
          height: faceH,
          opacity: glowOpacity,
          transform: [{ translateX: shakeX }, { scale: pulseScale }],
        },
      ]}
      pointerEvents="none"
    >
      {/* 外层径向光晕 */}
      <Animated.View
        style={[
          styles.outerGlow,
          {
            borderColor: glowColor,
            shadowColor: glowColor,
            shadowOpacity: Math.min(0.8 + combo * 0.04, 1),
          },
        ]}
      />
      {/* 内层边线 */}
      <Animated.View
        style={[styles.innerBorder, { borderColor: glowColor }]}
      />
    </Animated.View>
  );
};

export default FaceHighlight;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: 12,
  },
  outerGlow: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 8,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderRadius: 12,
    opacity: 0.6,
  },
});
