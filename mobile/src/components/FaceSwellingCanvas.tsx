/**
 * FaceSwellingCanvas.tsx — Native 端回退。
 * 直接复用 View + Animated 实现的 FaceSwelling。
 */

import React from 'react';
import FaceSwelling from './FaceSwelling';
import type { FacePosition } from '../data/types';

const FALLBACK_FACE: FacePosition = {
  x: 0.5,
  y: 0.35,
  width: 0.25,
  height: 0.3,
};

interface Props {
  facePosition?: FacePosition;
  combo: number;
  accentColor?: string;
  videoPlaying?: boolean;
}

const FaceSwellingCanvas: React.FC<Props> = ({ facePosition, combo, accentColor, videoPlaying: _vp }) => {
  return <FaceSwelling facePosition={facePosition ?? FALLBACK_FACE} combo={combo} accentColor={accentColor} />;
};

export default FaceSwellingCanvas;
