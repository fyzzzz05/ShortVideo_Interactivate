/**
 * ParticleEngine — 轻量粒子特效系统。
 *
 * 粒子池复用策略：
 * - 维护固定数量的粒子（最多 20 个）
 * - burstAt(x, y, color) 在指定屏幕坐标生成 6-15 个粒子
 * - 每个粒子有随机方向、速度、大小，600ms 后回池
 * - 全程 Native Driver
 */

import React, { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import { PARTICLE, COLORS } from '../config/theme';

interface ParticleData {
  id: number;
  originX: number;
  originY: number;
  animX: Animated.Value;
  animY: Animated.Value;
  opacity: Animated.Value;
  scale: Animated.Value;
  size: number;
  color: string;
  alive: boolean;
}

let _nextId = 1;

export interface ParticleEngineHandle {
  burstAt: (x: number, y: number, color?: string) => void;
}

const ParticleEngine = forwardRef<ParticleEngineHandle>((_props, ref) => {
  const particlesRef = useRef<ParticleData[]>([]);

  // 初始化粒子池（只执行一次）
  if (particlesRef.current.length === 0) {
    for (let i = 0; i < PARTICLE.maxCount; i++) {
      particlesRef.current.push({
        id: _nextId++,
        originX: 0,
        originY: 0,
        animX: new Animated.Value(0),
        animY: new Animated.Value(0),
        opacity: new Animated.Value(0),
        scale: new Animated.Value(0),
        size: 4 + Math.random() * 6,
        color: COLORS.primary,
        alive: false,
      });
    }
  }

  const burstAt = useCallback((x: number, y: number, color?: string) => {
    const count = PARTICLE.burstMin + Math.floor(Math.random() * (PARTICLE.burstMax - PARTICLE.burstMin));
    const pool = particlesRef.current;
    const c = color || COLORS.primary;

    let spawned = 0;
    for (const p of pool) {
      if (p.alive) continue;

      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      const dx = Math.cos(angle) * speed;
      const dy = Math.sin(angle) * speed - 35; // 轻微向上偏

      p.originX = x;
      p.originY = y;
      p.color = c;
      p.size = 3 + Math.random() * 7;
      p.animX.setValue(0);
      p.animY.setValue(0);
      p.opacity.setValue(1);
      p.scale.setValue(1);
      p.alive = true;

      Animated.parallel([
        Animated.timing(p.animX, {
          toValue: dx,
          duration: PARTICLE.lifetimeMs,
          useNativeDriver: true,
        }),
        Animated.timing(p.animY, {
          toValue: dy,
          duration: PARTICLE.lifetimeMs,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: PARTICLE.lifetimeMs,
          useNativeDriver: true,
        }),
        Animated.timing(p.scale, {
          toValue: 0.15,
          duration: PARTICLE.lifetimeMs,
          useNativeDriver: true,
        }),
      ]).start(() => {
        p.alive = false;
      });

      spawned++;
      if (spawned >= count) break;
    }
  }, []);

  useImperativeHandle(ref, () => ({ burstAt }), [burstAt]);

  return (
    <View style={styles.container} pointerEvents="none">
      {particlesRef.current.map((p) => (
        <Animated.View
          key={p.id}
          style={[
            styles.particle,
            {
              left: p.originX - p.size / 2,
              top: p.originY - p.size / 2,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.animX },
                { translateY: p.animY },
                { scale: p.scale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
});

export default ParticleEngine;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: 'absolute',
  },
});
