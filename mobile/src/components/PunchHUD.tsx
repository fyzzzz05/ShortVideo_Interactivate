/**
 * PunchHUD — 打击系统 HUD（HP 条 + 连击 + KO 特效）。
 *
 * 直接覆盖在视频上层：
 * - 顶部 HP 条（格斗游戏风格）
 * - 中央连击数字
 * - KO 闪屏特效
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Animated, Dimensions } from 'react-native';
import { COLORS, FONT } from '../config/theme';

const { width: SCREEN_W } = Dimensions.get('window');

// ── 配色阶梯 ──
const HP_COLORS = [
  { threshold: 0.6, color: '#34C759' },   // 绿
  { threshold: 0.3, color: '#FF9500' },   // 橙
  { threshold: 0.0, color: '#FF2D55' },   // 红
];

function hpColor(ratio: number): string {
  for (const c of HP_COLORS) {
    if (ratio >= c.threshold) return c.color;
  }
  return HP_COLORS[HP_COLORS.length - 1].color;
}

interface Props {
  hp: number;
  maxHp: number;
  combo: number;
  isKO: boolean;
  visible: boolean;
  /** 连击颜色（从场景配置来） */
  accentColor?: string;
}

const PunchHUD: React.FC<Props> = ({
  hp,
  maxHp,
  combo,
  isKO,
  visible,
  accentColor = COLORS.primary,
}) => {
  const ratio = Math.max(0, hp / maxHp);
  const barW = SCREEN_W * 0.7;
  const fillColor = isKO ? '#FF2D55' : hpColor(ratio);

  // 动画值
  const fillAnim = useRef(new Animated.Value(ratio)).current;
  const koFlash = useRef(new Animated.Value(0)).current;
  const barShake = useRef(new Animated.Value(0)).current;
  const prevRatio = useRef(ratio);

  // HP 变化 → 填充条动画
  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: ratio,
      duration: 200,
      useNativeDriver: false,
    }).start();

    // 扣血抖动
    if (ratio < prevRatio.current) {
      Animated.sequence([
        Animated.timing(barShake, { toValue: 4, duration: 50, useNativeDriver: true }),
        Animated.timing(barShake, { toValue: -4, duration: 50, useNativeDriver: true }),
        Animated.timing(barShake, { toValue: 2, duration: 40, useNativeDriver: true }),
        Animated.timing(barShake, { toValue: 0, duration: 40, useNativeDriver: true }),
      ]).start();
    }
    prevRatio.current = ratio;
  }, [ratio]);

  // KO 闪屏
  useEffect(() => {
    if (isKO) {
      Animated.sequence([
        Animated.timing(koFlash, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(koFlash, { toValue: 0.6, duration: 200, useNativeDriver: true }),
        Animated.timing(koFlash, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(koFlash, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    } else {
      koFlash.setValue(0);
    }
  }, [isKO]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {/* ── KO 闪屏 ── */}
      <Animated.View
        style={[styles.koFlash, { opacity: koFlash }]}
      />

      {/* ── HP 条 ── */}
      <View style={styles.hpBarOuter}>
        <Animated.View style={[styles.hpBarInner, { transform: [{ translateX: barShake }] }]}>
          <Animated.View
            style={[
              styles.hpFill,
              {
                width: fillAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: fillColor,
              },
            ]}
          />
        </Animated.View>

        {/* HP 数值 */}
        <View style={styles.hpLabels}>
          <Text style={styles.hpLabel}>{isKO ? 'KO!' : `${hp}/${maxHp}`}</Text>
          {combo >= 3 && (
            <Text style={[styles.comboLabel, { color: accentColor }]}>
              {combo}x
            </Text>
          )}
        </View>
      </View>

      {/* ── 连击大字 ── */}
      {combo >= 5 && (
        <View style={styles.bigComboWrap}>
          <Text style={[styles.bigCombo, { color: accentColor }]}>
            {combo} 连击!
          </Text>
        </View>
      )}

      {/* ── KO 大字 ── */}
      {isKO && (
        <View style={styles.koTextWrap}>
          <Text style={styles.koText}>K.O.!</Text>
        </View>
      )}
    </View>
  );
};

export default PunchHUD;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
  },
  koFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 0, 0, 0.25)',
  },

  // ── HP 条 ──
  hpBarOuter: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    width: SCREEN_W * 0.7,
    alignItems: 'center',
  },
  hpBarInner: {
    width: '100%',
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    borderRadius: 7,
  },
  hpLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
    paddingHorizontal: 2,
  },
  hpLabel: {
    fontSize: FONT.caption,
    color: COLORS.textSecondary,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  comboLabel: {
    fontSize: FONT.caption,
    fontWeight: '900',
  },

  // ── 连击大字 ──
  bigComboWrap: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
  },
  bigCombo: {
    fontSize: FONT.combo,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },

  // ── KO ──
  koTextWrap: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
  },
  koText: {
    fontSize: 72,
    fontWeight: '900',
    color: '#FF2D55',
    textShadowColor: 'rgba(255, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 16,
  },
});
