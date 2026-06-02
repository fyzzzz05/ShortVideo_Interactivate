import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Dimensions, Animated } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus, Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import highlightsData from '../data/episode5-highlights.json';

const { width, height } = Dimensions.get('window');

interface Highlight {
  id: string;
  time: number;
  scene: string;
  trigger: string;
  duration: number;
  triggered: boolean;
  character: {
    type: string;
    name: string;
    facePosition: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  hint: string;
}

export default function VideoPlayer() {
  const videoRef = useRef<Video>(null);
  const [comboCount, setComboCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<Highlight | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [highlights, setHighlights] = useState<Highlight[]>(highlightsData.highlights);

  const comboTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const slapSound = useRef<Audio.Sound | null>(null);
  const comboSound = useRef<Audio.Sound | null>(null);

  // 动画值
  const faceHighlightAnim = useRef(new Animated.Value(0)).current;
  const slapAnimScale = useRef(new Animated.Value(1)).current;

  // 加载音效
  useEffect(() => {
    loadSounds();
    return () => {
      slapSound.current?.unloadAsync();
      comboSound.current?.unloadAsync();
    };
  }, []);

  const loadSounds = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });
      // 注意：需要实际的音效文件
      // const { sound: slap } = await Audio.Sound.createAsync(
      //   require('../../assets/sounds/slap.mp3')
      // );
      // slapSound.current = slap;
    } catch (error) {
      console.log('音效加载失败（可选功能）:', error);
    }
  };

  // 脸部高亮动画
  useEffect(() => {
    if (activeHighlight) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(faceHighlightAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(faceHighlightAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      faceHighlightAnim.setValue(0);
    }
  }, [activeHighlight]);

  const handlePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSlap = async () => {
    // 震动反馈
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // 播放音效
    try {
      if (comboCount >= 2 && comboSound.current) {
        await comboSound.current.replayAsync();
      } else if (slapSound.current) {
        await slapSound.current.replayAsync();
      }
    } catch (error) {
      console.log('音效播放失败:', error);
    }

    // 巴掌动画
    Animated.sequence([
      Animated.timing(slapAnimScale, {
        toValue: 1.3,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slapAnimScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // 增加连击数
    setComboCount(prev => prev + 1);

    // 重置连击计时器
    if (comboTimerRef.current) {
      clearTimeout(comboTimerRef.current);
    }

    // 2秒后重置连击数
    comboTimerRef.current = setTimeout(() => {
      setComboCount(0);
    }, 2000);

    // 如果在互动模式中，检查是否完成互动
    if (activeHighlight && comboCount >= 0) {
      // 用户已经开始互动，可以继续播放
      handleInteractionComplete();
    }
  };

  const handleInteractionComplete = () => {
    // 清除倒计时
    if (countdownTimerRef.current) {
      clearTimeout(countdownTimerRef.current);
    }

    // 标记该高光点已触发
    if (activeHighlight) {
      setHighlights(prev =>
        prev.map(h =>
          h.id === activeHighlight.id ? { ...h, triggered: true } : h
        )
      );
    }

    // 关闭互动模式
    setActiveHighlight(null);
    setCountdown(3);

    // 继续播放
    videoRef.current?.playAsync();
  };

  const startCountdown = (duration: number) => {
    setCountdown(duration);

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // 倒计时结束，自动继续播放
          handleInteractionComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    countdownTimerRef.current = timer as any;
  };

  const checkHighlightTrigger = (currentTime: number) => {
    const highlight = highlights.find(
      h => Math.abs(h.time - currentTime) < 0.3 && !h.triggered
    );

    if (highlight && !activeHighlight) {
      // 触发高光点
      videoRef.current?.pauseAsync();
      setActiveHighlight(highlight);
      startCountdown(highlight.duration);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);

      if (status.isPlaying) {
        const currentTime = status.positionMillis / 1000;
        checkHighlightTrigger(currentTime);
      }
    }
  };

  // 计算脸部高亮位置
  const getFaceHighlightStyle = () => {
    if (!activeHighlight) return {};

    const { facePosition } = activeHighlight.character;
    const videoHeight = height * 0.7;

    return {
      position: 'absolute' as const,
      left: width * facePosition.x - (width * facePosition.width) / 2,
      top: (height - videoHeight) / 2 + videoHeight * facePosition.y - (videoHeight * facePosition.height) / 2,
      width: width * facePosition.width,
      height: videoHeight * facePosition.height,
      borderWidth: 3,
      borderColor: '#ff0000',
      borderRadius: 10,
      opacity: faceHighlightAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.3, 0.9],
      }),
    };
  };

  return (
    <View style={styles.container}>
      {/* 视频播放器 */}
      <Video
        ref={videoRef}
        source={require('../../shortvedio/nvpin/第5集.mp4')}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={false}
        isLooping={false}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />

      {/* 脸部高亮框 */}
      {activeHighlight && (
        <Animated.View style={getFaceHighlightStyle()} />
      )}

      {/* 互动提示 */}
      {activeHighlight && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>{activeHighlight.hint}</Text>
          <Text style={styles.countdownText}>{countdown}秒</Text>
        </View>
      )}

      {/* 连击数显示 */}
      {comboCount > 0 && (
        <View style={styles.comboContainer}>
          <Text style={styles.comboText}>{comboCount} 连击!</Text>
        </View>
      )}

      {/* 控制按钮区域 */}
      <View style={styles.controlsContainer}>
        {/* 播放/暂停按钮 */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
        >
          <Text style={styles.buttonText}>
            {isPlaying ? '⏸ 暂停' : '▶ 播放'}
          </Text>
        </TouchableOpacity>

        {/* 扇巴掌按钮 */}
        <Animated.View style={{ transform: [{ scale: slapAnimScale }] }}>
          <TouchableOpacity
            style={[
              styles.slapButton,
              activeHighlight && styles.slapButtonActive
            ]}
            onPress={handleSlap}
            activeOpacity={0.7}
          >
            <Text style={styles.slapButtonText}>👋</Text>
            <Text style={styles.slapButtonLabel}>扇巴掌</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: width,
    height: height * 0.7,
  },
  hintContainer: {
    position: 'absolute',
    top: height * 0.55,
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  hintText: {
    color: '#ff0000',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  countdownText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  comboContainer: {
    position: 'absolute',
    top: height * 0.15,
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 20,
  },
  comboText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 50,
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width,
    paddingHorizontal: 20,
  },
  playButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  slapButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
    minWidth: 120,
  },
  slapButtonActive: {
    backgroundColor: '#ff0000',
    shadowColor: '#ff0000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  slapButtonText: {
    fontSize: 32,
  },
  slapButtonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
  },
});
