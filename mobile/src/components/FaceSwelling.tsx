/**
 * FaceSwelling — 扇巴掌后脸部逐渐肿胀的物理级特效。
 *
 * ═══════════════════════════════════════════════════════════
 *  实现原理（纯 View + Animated，没有图片/CSS滤镜/原生模块）
 * ═══════════════════════════════════════════════════════════
 *
 *  每一个"肿胀包"由 5 层 View 叠出一个伪 3D 半球体：
 *
 *    ① 隆起层(大圆)  肉粉色半透明，模拟皮肤被组织液撑开
 *    ② 瘀血核(小圆)  深红→紫→蓝紫，模拟皮下毛细血管破裂
 *    ③ 黄晕环         高combo出现，模拟血清渗出（瘀伤愈合期）
 *    ④ 主高光(白点)  左上角，模拟点光源在肿胀半球上的镜面反射
 *    ⑤ 次高光(弱白)  右下，模拟环境光 → 两点高光共同制造3D立体感
 *
 *  连击等级  颜色变化          物理表现
 *  combo 1   鲜红               1个小包，刚刚挨打
 *  combo 2   鲜红→深红          2个中包，瘀血开始渗出
 *  combo 3   深紫+全脸红底色    3个大包，整张脸开始红肿
 *  combo 4   深紫+黄边+深红脸   4个大包，皮下出血严重
 *  combo 5   蓝紫核+明显黄边    5个满级包，"被打肿了"
 *
 *  入场动画：spring 弹簧 (0→1)，模拟组织液瞬间涌入
 *  持续动画：throb 脉冲 (scale 1.0 ↔ 1.025)，模拟血管跳动
 *  退出动画：TODO (目前 combo 归零直接 unmount)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Animated, Dimensions } from 'react-native';
import { FacePosition } from '../data/types';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ── 瘀伤调色板 ──

/** 皮肤隆起色 — 比肉色稍亮，模拟皮肤被撑开变薄 */
const BUMP_SKIN = [
  'rgba(255,170,150,0.38)',   // lv0 轻微粉
  'rgba(255,140,120,0.48)',   // lv1 红肿
  'rgba(235,105,85,0.55)',    // lv2 紫红
  'rgba(210,75,65,0.60)',     // lv3 深红
  'rgba(185,52,52,0.66)',     // lv4 瘀血红
];

/** 瘀血核心色 */
const BRUISE = [
  'transparent',                       // lv0 没有
  'rgba(185,32,32,0.35)',              // lv1 鲜红瘀点
  'rgba(140,22,45,0.50)',              // lv2 深红瘀斑
  'rgba(90,18,62,0.58)',               // lv3 紫红
  'rgba(50,12,80,0.68)',               // lv4 深紫
];

/** 全脸红润底色 */
const FACE_REDNESS = [
  'transparent',
  'rgba(255,55,35,0.00)',
  'rgba(255,45,30,0.00)',
  'rgba(255,38,28,0.13)',
  'rgba(240,28,22,0.24)',
  'rgba(210,18,18,0.33)',
];

// ── 接口 ──

interface Props {
  facePosition: FacePosition;
  combo: number;
  accentColor?: string;
}

interface Bump {
  id: string;
  /** 在脸框内的相对 x 偏移 (0=中心, -0.5~0.5) */
  ox: number;
  oy: number;
  /** 肿胀包直径 ÷ 脸框宽度 */
  sr: number;
  level: number;
  entry: Animated.Value;   // 0→1 入场弹簧
  throb: Animated.Value;   // 0→1 循环呼吸
}

// ── 组件 ──

const FaceSwelling: React.FC<Props> = ({ facePosition, combo }) => {
  const [bumps, setBumps] = useState<Bump[]>([]);
  const prevCombo = useRef(0);
  const idGen = useRef(0);

  const spawn = useCallback((lvl: number): Bump => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.06 + Math.random() * 0.34;
    return {
      id: `b${idGen.current++}`,
      ox: Math.cos(angle) * dist,
      oy: Math.sin(angle) * dist * 0.65,
      sr: 0.20 + Math.random() * 0.14 + lvl * 0.035,
      level: Math.min(lvl, 4),
      entry: new Animated.Value(0),
      throb: new Animated.Value(0),
    };
  }, []);

  // ── combo → bumps 映射 ──
  useEffect(() => {
    if (combo <= 0) {
      prevCombo.current = 0;
      setBumps([]);
      idGen.current = 0;
      return;
    }
    const prev = prevCombo.current;
    if (combo > prev) {
      const fresh: Bump[] = [];
      for (let i = 0; i < combo - prev; i++) fresh.push(spawn(combo - 1));
      setBumps(old => {
        return [...old.map(b => ({ ...b, level: Math.min(b.level + 1, 4) })), ...fresh];
      });
    }
    prevCombo.current = combo;
  }, [combo, spawn]);

  // ── 入场 spring ──
  useEffect(() => {
    bumps.forEach(b => {
      Animated.spring(b.entry, {
        toValue: 1,
        friction: 4,
        tension: 100,
        useNativeDriver: true,
      }).start();
    });
  }, [bumps.length]);

  // ── 呼吸脉冲循环 ──
  useEffect(() => {
    const loopers = bumps.map(b =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b.throb, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(b.throb, { toValue: 0, duration: 450, useNativeDriver: true }),
        ]),
      ),
    );
    loopers.forEach(l => l.start());
    return () => loopers.forEach(l => l.stop());
  }, [bumps]);

  if (combo <= 0 || bumps.length === 0) return null;

  // ── 脸框屏幕坐标 ──
  const fcx = facePosition.x * SCREEN_W;            // 脸中心 x
  const fcy = facePosition.y * SCREEN_H;            // 脸中心 y
  const fw = facePosition.width * SCREEN_W;          // 脸宽
  const fh = facePosition.height * SCREEN_H;         // 脸高

  const rednessLevel = Math.min(combo, 5);

  return (
    <View style={S.root} pointerEvents="none">
      {/* ═══ 全脸红润底色 ═══ */}
      {rednessLevel >= 3 && (
        <View
          style={[
            S.faceRedness,
            {
              left: fcx - fw / 2,
              top: fcy - fh / 2,
              width: fw,
              height: fh,
              borderRadius: fw * 0.18,
              backgroundColor: FACE_REDNESS[rednessLevel],
            },
          ]}
        />
      )}

      {/* ═══ 每一个肿胀包 ═══ */}
      {bumps.map(b => {
        const diam = fw * b.sr;
        const bx = fcx + b.ox * fw;     // 包中心 x（屏幕坐标）
        const by = fcy + b.oy * fh;     // 包中心 y
        const r = diam / 2;

        const skinColor = BUMP_SKIN[b.level];
        const bruiseColor = BRUISE[b.level];
        const hasYellow = b.level >= 3;

        // 瘀血核大小
        const bruiseD = diam * 0.50;
        const bruiseR = bruiseD / 2;
        const bruiseOff = r - bruiseR;  // 居中偏移

        // 黄边
        const yellowD = bruiseD * 1.3;
        const yellowR = yellowD / 2;
        const yellowOff = r - yellowR;

        // 主高光
        const glintD = diam * 0.16;
        const glintOffX = -diam * 0.13;
        const glintOffY = -diam * 0.11;

        // 入场缩放
        const entryS = b.entry.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] });
        // 呼吸脉冲
        const throbS = b.throb.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });

        return (
          <Animated.View
            key={b.id}
            style={[
              S.bumpWrap,
              {
                left: bx - r,
                top: by - r,
                width: diam,
                height: diam,
                transform: [{ scale: entryS }],
              },
            ]}
          >
            {/* ① 皮肤隆起 */}
            <Animated.View
              style={[
                S.swell,
                {
                  width: diam,
                  height: diam,
                  borderRadius: r,
                  backgroundColor: skinColor,
                  transform: [{ scale: throbS }],
                },
              ]}
            />

            {/* ② 瘀血核心 — 手动居中 */}
            {b.level >= 1 && (
              <View
                style={[
                  S.bruise,
                  {
                    width: bruiseD,
                    height: bruiseD,
                    borderRadius: bruiseR,
                    backgroundColor: bruiseColor,
                    left: bruiseOff,
                    top: bruiseOff,
                  },
                ]}
              />
            )}

            {/* ③ 黄晕（血清渗出） */}
            {hasYellow && (
              <View
                style={[
                  S.yellowRing,
                  {
                    width: yellowD,
                    height: yellowD,
                    borderRadius: yellowR,
                    left: yellowOff,
                    top: yellowOff,
                  },
                ]}
              />
            )}

            {/* ④ 镜面高光（左上白斑）*/}
            <View
              style={[
                S.glint,
                {
                  width: glintD,
                  height: glintD,
                  borderRadius: glintD / 2,
                  top: r + glintOffY,
                  left: r + glintOffX,
                },
              ]}
            />

            {/* ⑤ 次表面散射高光（右下弱光）*/}
            <View
              style={[
                S.glintSub,
                {
                  width: glintD * 0.45,
                  height: glintD * 0.45,
                  borderRadius: glintD * 0.225,
                  bottom: diam * 0.18,
                  right: diam * 0.20,
                },
              ]}
            />
          </Animated.View>
        );
      })}
    </View>
  );
};

export default FaceSwelling;

// ── 样式 ──

const S = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
  },
  faceRedness: {
    position: 'absolute',
  },
  bumpWrap: {
    position: 'absolute',
  },
  swell: {
    position: 'absolute',
  },
  bruise: {
    position: 'absolute',
  },
  yellowRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: 'rgba(175,155,75,0.35)',
  },
  glint: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  glintSub: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
});
