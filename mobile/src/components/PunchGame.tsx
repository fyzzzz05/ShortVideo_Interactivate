/**
 * PunchGame — 打击互动组件。
 *
 * 替代 SlapGame 的「扇巴掌」交互，新增 HP 打击系统。
 * 用户直接点击视频中反派脸部区域进行打击，
 * 不再用 HP 限制互动时长，用户可以一直打，手动继续播放。
 *
 * 集成 usePunchModule Hook + PunchHUD。
 * 与 SlapGame 共享 InteractionProps 接口，可无缝切换。
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
import { InteractionProps } from '../data/types';
import { SCENE_MAP, SceneType } from '../config/sceneMap';
import { COLORS, FONT, DURATION } from '../config/theme';
import { usePunchModule, PunchModuleAPI, BboxEntry } from '../hooks/usePunchModule';
import { safeHaptic } from '../utils/haptics';
import PunchHUD from './PunchHUD';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props extends InteractionProps {
  onParticleBurst: (x: number, y: number, color: string) => void;
  countdown: number;
  /** HP 上限，默认 100；当前仅用于兼容旧接口 */
  maxHp?: number;
  /** KO 回调；当前无限击打模式下不会触发 */
  onKO?: () => void;
}

const PunchGame: React.FC<Props> = ({
  highlight,
  onComplete,
  onComboUpdate,
  onParticleBurst,
  countdown,
  maxHp = 100,
  onKO,
}) => {
  const [showMiss, setShowMiss] = useState(false);
  const [hitCount, setHitCount] = useState(0);
  const missOpacity = useRef(new Animated.Value(0)).current;
  const targetPulse = useRef(new Animated.Value(1)).current;

  const sceneType = highlight.scene as SceneType;
  const sceneConfig = SCENE_MAP[sceneType] || SCENE_MAP.REVENGE;
  const accentColor = sceneConfig.color;

  // ── 计算脸部屏幕坐标 ──
  const facePos = useMemo(() => {
    const fp = highlight.character?.facePosition;
    if (!fp) {
      return {
        x: SCREEN_W / 2,
        y: SCREEN_H * 0.35,
        w: SCREEN_W * 0.3,
        h: SCREEN_H * 0.25,
      };
    }
    return {
      x: fp.x * SCREEN_W,
      y: fp.y * SCREEN_H,
      w: fp.width * SCREEN_W,
      h: fp.height * SCREEN_H,
    };
  }, [highlight.character?.facePosition]);

  // ── Bbox 数据（兼容 web punch-module 格式） ──
  const bboxEntries: BboxEntry[] = useMemo(() => {
    if (highlight.character?.facePosition) {
      return [{
        time: highlight.time,
        bbox: {
          x: highlight.character.facePosition.x,
          y: highlight.character.facePosition.y,
          w: highlight.character.facePosition.width,
          h: highlight.character.facePosition.height,
        },
      }];
    }
    return [];
  }, [highlight]);

  // ── 打击模块 ──
  const pm: PunchModuleAPI = usePunchModule({
    maxHp,
    damage: 0,
    hitExpandPx: 12,
    comboResetMs: 2500,
    minHitIntervalMs: 200,
    onHit: (d) => {
      setHitCount((prev) => prev + 1);
      onComboUpdate(d.combo);

      // 粒子爆发在左右脸颊交替
      const side = d.combo % 2 === 0 ? -1 : 1;
      const cheekX = facePos.x + side * facePos.w * 0.28;
      const cheekY = facePos.y + facePos.h * 0.05;

      // 颜色随连击加深
      const colors = [accentColor, '#FF3B30', '#C0392B', '#8B1A2B', '#5B0E2A'];
      const burstColor = colors[Math.min(d.combo, 5)];
      onParticleBurst(cheekX, cheekY, burstColor);
    },
    onMiss: (x, y) => {
      // 未命中反馈
      showMissAnimation();
    },
  });

  // 加载 bbox 数据
  React.useEffect(() => {
    pm.loadBboxData(bboxEntries);
  }, [bboxEntries]);

  const state = pm.getState();

  // ── 未命中动画 ──
  const showMissAnimation = useCallback(() => {
    setShowMiss(true);
    missOpacity.setValue(0.6);
    Animated.timing(missOpacity, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(() => setShowMiss(false));
  }, []);

  // ── 目标 zone 脉冲 ──
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(targetPulse, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(targetPulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── 脸部点击处理 ──
  const handleFaceTap = useCallback(() => {
    // 用脸部中心坐标调用 punchAt
    const centerX = facePos.x;
    const centerY = facePos.y;
    const result = pm.punchAt(centerX, centerY, SCREEN_W, SCREEN_H, highlight.time);

    // Haptic（punchAt 内部已触发，此处追加脸部点击的本地反馈）
    if (result) {
      safeHaptic(result.combo >= 5 ? 'heavy' : result.combo >= 3 ? 'medium' : 'light');
    }
  }, [pm, facePos, highlight.time]);

  // ── 背景点击（未命中） ──
  const handleBackgroundTap = useCallback(
    (evt: any) => {
      const { locationX, locationY } = evt.nativeEvent;
      // 检查是否在脸部区域内
      const inFaceX = Math.abs(locationX - facePos.x) < facePos.w * 0.65;
      const inFaceY = Math.abs(locationY - facePos.y) < facePos.h * 0.5;
      if (!inFaceX || !inFaceY) {
        showMissAnimation();
      }
    },
    [facePos, showMissAnimation],
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* ── 背景点击区（未命中检测） ── */}
      <TouchableOpacity
        style={styles.backgroundZone}
        onPress={handleBackgroundTap}
        activeOpacity={1}
      >
        {/* 显示 MISS 文字 */}
        {showMiss && (
          <Animated.View style={[styles.missIndicator, { opacity: missOpacity }]}>
            <Text style={styles.missText}>MISS</Text>
          </Animated.View>
        )}
      </TouchableOpacity>

      {/* ── 脸部打击区 ── */}
      <Animated.View
        style={[
          styles.faceTarget,
          {
            left: facePos.x - facePos.w * 0.6,
            top: facePos.y - facePos.h * 0.55,
            width: facePos.w * 1.2,
            height: facePos.h * 1.1,
            borderColor: state.isKO ? '#FF2D55' : accentColor,
            transform: [{ scale: targetPulse }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.faceTouchable}
          onPress={handleFaceTap}
          activeOpacity={0.9}
        >
          <Text style={[styles.targetIcon, { color: accentColor }]}>
            {state.isKO ? '💀' : '👊'}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── 提示 ── */}
      <View style={styles.hintContainer}>
        <TouchableOpacity
          style={styles.resumeButton}
          onPress={onComplete}
          activeOpacity={0.85}
        >
          <Text style={styles.resumeText}>继续播放</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          {highlight.interaction.hint || '点击脸部打击反派'}
        </Text>
        {highlight.interaction.buttons[1] && (
          <Text style={styles.secondaryHint}>
            {highlight.interaction.buttons[1]}
          </Text>
        )}
      </View>

      {/* ── HP HUD ── */}
      <PunchHUD
        hp={state.hp}
        maxHp={state.maxHp}
        combo={state.combo}
        isKO={state.isKO}
        visible={true}
        accentColor={accentColor}
        hitCount={hitCount}
        mode="hits"
      />

      {/* ── 伤害建议 ── */}
      <Text style={styles.damageHint}>
        {state.combo < 3
          ? '想打多久都可以'
          : state.combo < 5
          ? `${state.combo} 连击！继续打`
          : '🔥 暴击连打！'}
      </Text>
    </View>
  );
};

export default PunchGame;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  backgroundZone: {
    ...StyleSheet.absoluteFillObject,
  },

  // ── 脸部打击区 ──
  faceTarget: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 3,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceTouchable: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  targetIcon: {
    fontSize: 40,
    opacity: 0.7,
  },

  // ── 未命中 ──
  missIndicator: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  missText: {
    fontSize: FONT.body,
    color: COLORS.textTertiary,
    fontWeight: '700',
    letterSpacing: 4,
  },

  // ── 提示 ──
  hintContainer: {
    position: 'absolute',
    bottom: '35%',
    alignSelf: 'center',
    alignItems: 'center',
  },
  resumeButton: {
    minWidth: 104,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  resumeText: {
    fontSize: FONT.caption,
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  hint: {
    fontSize: FONT.body,
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  secondaryHint: {
    fontSize: FONT.caption,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── 伤害建议 ──
  damageHint: {
    position: 'absolute',
    bottom: '28%',
    alignSelf: 'center',
    fontSize: FONT.caption,
    color: COLORS.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
