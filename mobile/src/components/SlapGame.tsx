/**
 * SlapGame — 扇巴掌连击玩法。
 *
 * 核心互动模式：
 * - 用户快速点击屏幕中央大按钮
 * - 每次点击触发 Haptic 震动 + 粒子爆发
 * - 连击计数实时显示
 * - 3-5 连击以上触发强化视觉效果
 * - 倒计时结束或点够一定次数后自动完成
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { InteractionProps } from '../data/types';
import { SCENE_MAP, SceneType } from '../config/sceneMap';
import { COLORS, FONT, TOUCH, DURATION, PARTICLE } from '../config/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props extends InteractionProps {
  onParticleBurst: (x: number, y: number, color: string) => void;
  countdown: number;
}

const SlapGame: React.FC<Props> = ({
  highlight,
  onComplete,
  onComboUpdate,
  onParticleBurst,
  countdown,
}) => {
  const [combo, setCombo] = useState(0);
  const comboRef = useRef(0);
  const btnScale = useRef(new Animated.Value(1)).current;
  const ripple = useRef(new Animated.Value(0)).current;

  const sceneType = highlight.scene as SceneType;
  const sceneConfig = SCENE_MAP[sceneType] || SCENE_MAP.REVENGE;
  const accentColor = sceneConfig.color;

  // 计算脸部屏幕坐标（用于粒子爆发定位）
  const facePos = useMemo(() => {
    const fp = highlight.character?.facePosition;
    if (!fp) return { x: SCREEN_W / 2, y: SCREEN_H * 0.35 };
    return {
      x: fp.x * SCREEN_W,
      y: fp.y * SCREEN_H,
    };
  }, [highlight.character?.facePosition]);

  // 瘀伤色调色板（粒子颜色随连击加深）
  const BRUISE_COLORS = [
    accentColor,                           // combo 0-1: 场景原色
    '#FF3B30',                              // combo 2: 鲜红
    '#C0392B',                              // combo 3: 深红
    '#8B1A2B',                              // combo 4: 紫红
    '#5B0E2A',                              // combo 5: 深紫
  ];

  const handlePress = useCallback(() => {
    // Haptic
    Haptics.impactAsync(
      comboRef.current >= 3
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium
    );

    // 更新连击
    const newCombo = comboRef.current + 1;
    comboRef.current = newCombo;
    setCombo(newCombo);
    onComboUpdate(newCombo);

    // 按钮缩放动画
    btnScale.setValue(0.85);
    Animated.spring(btnScale, {
      toValue: 1,
      friction: 3,
      tension: 150,
      useNativeDriver: true,
    }).start();

    // 波纹扩散
    ripple.setValue(0);
    Animated.timing(ripple, {
      toValue: 1,
      duration: DURATION.slow,
      useNativeDriver: true,
    }).start();

    // 粒子爆发 — 在脸部位置生成，颜色随连击加深
    const burstColor = BRUISE_COLORS[Math.min(newCombo, 5)];
    onParticleBurst(facePos.x, facePos.y, burstColor);

    // 5 连击自动完成
    if (newCombo >= 5) {
      setTimeout(() => onComplete(), 200);
    }
  }, [onComplete, onComboUpdate, onParticleBurst, accentColor]);

  return (
    <View style={styles.container}>
      {/* 倒计时环 */}
      <View style={styles.countdownRing}>
        <Text style={[styles.countdownText, { color: accentColor }]}>
          {countdown}
        </Text>
      </View>

      {/* 提示文字 */}
      <Text style={styles.hint}>{sceneConfig.hint}</Text>

      {/* 中央按钮 */}
      <Animated.View style={{ transform: [{ scale: btnScale }] }}>
        <TouchableOpacity
          style={[styles.mainButton, { borderColor: accentColor }]}
          onPress={handlePress}
          activeOpacity={0.7}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          {/* 波纹 */}
          <Animated.View
            style={[
              styles.ripple,
              {
                borderColor: accentColor,
                opacity: ripple.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
                transform: [
                  {
                    scale: ripple.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 2],
                    }),
                  },
                ],
              },
            ]}
          />

          <Text style={styles.buttonIcon}>{sceneConfig.icon}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* 说明 */}
      <Text style={styles.description}>
        {combo < 3
          ? '连续点击获得更高连击'
          : combo < 5
          ? `${combo} 连击！继续加油`
          : '🔥 满连击！'}
      </Text>
    </View>
  );
};

export default SlapGame;

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
    borderColor: COLORS.primary,
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
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  mainButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 45, 85, 0.15)',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ripple: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 44,
    borderWidth: 2,
  },
  buttonIcon: {
    fontSize: 36,
  },
  description: {
    fontSize: FONT.caption,
    color: COLORS.textTertiary,
    marginTop: 12,
  },
});
