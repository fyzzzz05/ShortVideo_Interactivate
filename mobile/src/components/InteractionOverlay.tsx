/**
 * InteractionOverlay — 互动分发器。
 *
 * 根据高光场景类型自动渲染对应的互动玩法组件。
 * 同时承载粒子引擎和连击展示。
 */

import React, { useRef, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { Highlight } from '../data/types';
import { SCENE_MAP, resolveScene } from '../config/sceneMap';
import SlapGame from './SlapGame';
import HeartTap from './HeartTap';
import RageHold from './RageHold';
import ParticleEngine, { ParticleEngineHandle } from './ParticleEngine';

interface Props {
  highlight: Highlight;
  countdown: number;
  onComplete: () => void;
  onComboUpdate: (combo: number) => void;
}

const InteractionOverlay: React.FC<Props> = ({
  highlight,
  countdown,
  onComplete,
  onComboUpdate,
}) => {
  const particleRef = useRef<ParticleEngineHandle>(null);

  const handleParticleBurst = useCallback(
    (x: number, y: number, color: string) => {
      particleRef.current?.burstAt(x, y, color);
    },
    []
  );

  const sceneType = resolveScene(highlight.scene || highlight.type);
  const config = SCENE_MAP[sceneType];

  const gameProps = {
    highlight,
    onComplete,
    onComboUpdate,
    onParticleBurst: handleParticleBurst,
    countdown,
  };

  const renderGame = () => {
    switch (config.component) {
      case 'SlapGame':
        return <SlapGame {...gameProps} />;
      case 'HeartTap':
        return <HeartTap {...gameProps} />;
      case 'RageHold':
        return <RageHold {...gameProps} />;
      default:
        return <SlapGame {...gameProps} />;
    }
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* 粒子引擎 */}
      <ParticleEngine ref={particleRef} />

      {/* 互动玩法 */}
      {renderGame()}
    </View>
  );
};

export default InteractionOverlay;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
});
