/**
 * ComboDisplay — 连击数展示。
 *
 * 大号渐变色数字居中显示，弹入弹出动画。
 * 2 秒无操作后自动消失。
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, Animated } from 'react-native';
import { FONT, COLORS, DURATION } from '../config/theme';

interface Props {
  combo: number;
  color?: string;
}

const ComboDisplay: React.FC<Props> = ({ combo, color = COLORS.primary }) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const prevCombo = useRef(0);

  useEffect(() => {
    if (combo > 0) {
      // 弹入
      scale.setValue(0.3);
      opacity.setValue(0);
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1.15,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: DURATION.fast,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // 回弹到正常大小
        Animated.spring(scale, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }).start();
      });

      prevCombo.current = combo;
    } else if (combo === 0 && prevCombo.current > 0) {
      // 消失
      Animated.timing(opacity, {
        toValue: 0,
        duration: DURATION.slow,
        useNativeDriver: true,
      }).start(() => {
        prevCombo.current = 0;
      });
    }
  }, [combo]);

  if (combo === 0) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity, transform: [{ scale }] },
      ]}
      pointerEvents="none"
    >
      <Text style={[styles.comboNum, { color }]}>{combo}</Text>
      <Text style={styles.label}>连击</Text>
    </Animated.View>
  );
};

export default ComboDisplay;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: '32%',
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 20,
  },
  comboNum: {
    fontSize: FONT.combo,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  label: {
    fontSize: FONT.caption,
    color: COLORS.textSecondary,
    marginTop: -8,
    letterSpacing: 4,
    fontWeight: '600',
  },
});
