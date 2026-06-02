/**
 * FaceSwellingCanvas.tsx — Native 端回退。
 * 直接复用 View + Animated 实现的 FaceSwelling。
 */

import React from 'react';
import FaceSwelling from './FaceSwelling';
import type { FacePosition } from '../data/types';

interface Props {
  facePosition?: FacePosition;
  combo: number;
  accentColor?: string;
  videoPlaying?: boolean;
}

const FaceSwellingCanvas: React.FC<Props> = ({ facePosition, combo, accentColor, videoPlaying: _vp }) => {
  if (!facePosition) return null;
  return <FaceSwelling facePosition={facePosition} combo={combo} accentColor={accentColor} />;
};

export default FaceSwellingCanvas;
