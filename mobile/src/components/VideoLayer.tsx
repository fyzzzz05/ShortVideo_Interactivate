/**
 * VideoLayer — 视频渲染层，全屏自适应。
 * 使用 StyleSheet.absoluteFill 填满父容器，
 * resizeMode=COVER 保证视频覆盖全部可用区域。
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { COLORS } from '../config/theme';

interface Props {
  videoRef: React.RefObject<Video>;
  source: any;
  onStatusUpdate: (status: AVPlaybackStatus) => void;
}

const VideoLayer: React.FC<Props> = ({ videoRef, source, onStatusUpdate }) => {
  return (
    <Video
      ref={videoRef}
      source={source}
      style={styles.video}
      resizeMode={ResizeMode.COVER}
      shouldPlay={false}
      isLooping={false}
      progressUpdateIntervalMillis={200}
      onPlaybackStatusUpdate={onStatusUpdate}
    />
  );
};

export default VideoLayer;

const styles = StyleSheet.create({
  video: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
  },
});
