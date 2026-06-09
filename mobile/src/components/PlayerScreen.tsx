import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Video, AVPlaybackStatus } from 'expo-av';
import { StatusBar } from 'expo-status-bar';

import VideoLayer from './VideoLayer';
import { EPISODES } from '../data/episodes';
import { EPISODE_HIGHLIGHTS } from '../data/highlights';
import { COLORS } from '../config/theme';
import type { Highlight } from '../data/types';
import { safeHaptic } from '../utils/haptics';

const COMBO_WINDOW_MS = 2000;
const COMIC_WORDS = ['BANG', 'POW', 'SMASH', 'BOOM'];
const DANMAKU_SAMPLES = ['太爽了', '打他打他', '这一段名场面', '女主太飒了', '解气！', '这反转绝了'];
const DEFAULT_LAYOUT = { width: 390, height: 844 };

type LiveDanmaku = {
  id: number;
  text: string;
  track: number;
  x: Animated.Value;
};

type HitEffect = {
  id: number;
  x: number;
  y: number;
  combo: number;
  word: string;
  scale: Animated.Value;
  opacity: Animated.Value;
  fly: Animated.Value;
  sparks: Array<{ id: number; dx: number; dy: number; color: string; size: number }>;
};

function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

function getEpisodeStats(index: number) {
  return {
    author: '短剧互动',
    likes: 31800 + index * 1720,
    comments: 926 + index * 81,
    saves: 4180 + index * 232,
    tags: ['逆袭', '打脸', '爽点互动'],
    description: '互动短剧高光片段，点击名场面触发打脸反馈和连击效果。',
  };
}

const PlayerScreen: React.FC = () => {
  const videoRef = useRef<Video>(null);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dmIdRef = useRef(0);
  const effectIdRef = useRef(0);
  const firedRef = useRef<Record<number, boolean>>({});
  const panStartY = useRef(0);
  const progressWidthRef = useRef(DEFAULT_LAYOUT.width - 24);
  const progressLeftRef = useRef(12);

  const shakeX = useRef(new Animated.Value(0)).current;
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [epIdx, setEpIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [durMs, setDurMs] = useState(0);
  const [liked, setLiked] = useState(false);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [showDmInput, setShowDmInput] = useState(false);
  const [dmText, setDmText] = useState('');
  const [danmakuList, setDanmakuList] = useState<LiveDanmaku[]>([]);
  const [pendingPunch, setPendingPunch] = useState<Highlight | null>(null);
  const [skipArmed, setSkipArmed] = useState(false);
  const [punchMode, setPunchMode] = useState(false);
  const [combo, setCombo] = useState(0);
  const [hitCount, setHitCount] = useState(0);
  const [hitEffects, setHitEffects] = useState<HitEffect[]>([]);

  const ep = EPISODES[epIdx] ?? EPISODES[0];
  const stats = getEpisodeStats(epIdx);
  const highlights = EPISODE_HIGHLIGHTS[ep.id] ?? [];
  const punchHighlight = useMemo(
    () => highlights.find((h) => h.type === 'slap_effect' || h.interaction.trigger === 'SLAP') ?? highlights[0] ?? null,
    [highlights],
  );

  const screenW = layout.width;
  const screenH = layout.height;
  const progress = durMs > 0 ? Math.min(100, (timeMs / durMs) * 100) : 0;
  const face = punchHighlight?.character?.facePosition ?? { x: 0.5, y: 0.34, width: 0.28, height: 0.28 };
  const faceCenter = { x: face.x * screenW, y: face.y * screenH };
  const faceRect = {
    left: faceCenter.x - (face.width * screenW) / 2,
    top: faceCenter.y - (face.height * screenH) / 2,
    width: Math.max(72, face.width * screenW),
    height: Math.max(72, face.height * screenH),
  };

  useEffect(() => {
    setPendingPunch(null);
    setPunchMode(false);
    setCombo(0);
    setHitCount(0);
    setHitEffects([]);
    setDanmakuList([]);
    setLiked(false);
  }, [ep.id]);

  useEffect(() => {
    const seedTimer = setInterval(() => {
      if (!playing || punchMode) return;
      const text = DANMAKU_SAMPLES[randInt(0, DANMAKU_SAMPLES.length - 1)];
      sendDanmaku(text, false);
    }, 2800);
    return () => clearInterval(seedTimer);
  }, [playing, punchMode]);

  const sendDanmaku = useCallback((text: string, manual = true) => {
    const clean = text.trim();
    if (!clean) return;
    const dm: LiveDanmaku = {
      id: dmIdRef.current++,
      text: clean,
      track: randInt(0, 3),
      x: new Animated.Value(screenW + 80),
    };
    setDanmakuList((prev) => [...prev.slice(-16), dm]);
    Animated.timing(dm.x, {
      toValue: -screenW - 220,
      duration: 7000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(() => {
      setDanmakuList((prev) => prev.filter((item) => item.id !== dm.id));
    });
    if (manual) {
      setDmText('');
      safeHaptic('light');
    }
  }, [screenW]);

  const togglePlay = useCallback(async () => {
    if (punchMode || pendingPunch) return;
    if (playing) {
      await videoRef.current?.pauseAsync();
    } else {
      await videoRef.current?.playAsync();
    }
    setShowPlayIcon(true);
    setTimeout(() => setShowPlayIcon(false), 900);
  }, [pendingPunch, playing, punchMode]);

  const showPunchPrompt = useCallback(async (h: Highlight) => {
    await videoRef.current?.pauseAsync();
    if (h.startMs) await videoRef.current?.setPositionAsync(h.startMs);
    setPendingPunch(h);
    setSkipArmed(false);
  }, []);

  const onStatus = useCallback((s: AVPlaybackStatus) => {
    if (!s.isLoaded) return;
    setPlaying(s.isPlaying);
    setTimeMs(s.positionMillis);
    if (s.durationMillis) setDurMs(s.durationMillis);

    if (s.isPlaying && punchHighlight && !firedRef.current[ep.id] && s.positionMillis >= punchHighlight.startMs) {
      firedRef.current[ep.id] = true;
      showPunchPrompt(punchHighlight);
    }
    if (s.didJustFinish && epIdx < EPISODES.length - 1) {
      setEpIdx((idx) => idx + 1);
    }
  }, [ep.id, epIdx, punchHighlight, showPunchPrompt]);

  const enterPunchMode = useCallback(() => {
    if (!pendingPunch) return;
    setPunchMode(true);
    setPendingPunch(null);
    setCombo(0);
    setHitCount(0);
    safeHaptic('medium');
  }, [pendingPunch]);

  const skipPunchAndResume = useCallback(() => {
    setSkipArmed(true);
    setTimeout(() => {
      setPendingPunch(null);
      setSkipArmed(false);
      videoRef.current?.playAsync();
    }, 1600);
  }, []);

  const exitPunchAndResume = useCallback(() => {
    setPunchMode(false);
    setCombo(0);
    setHitEffects([]);
    videoRef.current?.playAsync();
  }, []);

  const triggerShake = useCallback(() => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: -5, duration: 28, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 5, duration: 42, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -3, duration: 36, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 42, useNativeDriver: true }),
    ]).start();
  }, [shakeX]);

  const seekToScreenX = useCallback((screenX: number) => {
    if (!durMs) return;
    const localX = screenX - progressLeftRef.current;
    const ratio = Math.max(0, Math.min(1, localX / Math.max(progressWidthRef.current, 1)));
    const next = ratio * durMs;
    videoRef.current?.setPositionAsync(next);
    setTimeMs(next);
  }, [durMs]);

  const triggerPunch = useCallback((x = faceCenter.x, y = faceCenter.y) => {
    if (!punchMode) return;
    const nextCombo = combo + 1;
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => setCombo(0), COMBO_WINDOW_MS);

    setCombo(nextCombo);
    setHitCount((prev) => prev + 1);
    safeHaptic(nextCombo >= 5 ? 'heavy' : nextCombo >= 3 ? 'medium' : 'light');
    triggerShake();

    const id = effectIdRef.current++;
    const fxX = x + rand(-10, 10);
    const fxY = y + rand(-8, 10);
    const fx: HitEffect = {
      id,
      x: fxX,
      y: fxY,
      combo: nextCombo,
      word: COMIC_WORDS[randInt(0, COMIC_WORDS.length - 1)],
      scale: new Animated.Value(0.2),
      opacity: new Animated.Value(1),
      fly: new Animated.Value(0),
      sparks: Array.from({ length: nextCombo >= 3 ? 5 : 3 }, (_, i) => {
        const count = nextCombo >= 3 ? 5 : 3;
        const angle = (Math.PI * 2 * i) / count;
        const dist = rand(28, nextCombo >= 3 ? 58 : 42);
        return {
          id: i,
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: rand(5, 9),
          color: i % 3 === 0 ? '#FFF176' : i % 3 === 1 ? '#FF3B30' : '#FF9F0A',
        };
      }),
    };

    setHitEffects((prev) => [...prev.slice(-1), fx]);
    Animated.parallel([
      Animated.spring(fx.scale, { toValue: 1, friction: 4, tension: 150, useNativeDriver: true }),
      Animated.timing(fx.fly, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fx.opacity, { toValue: 0, duration: 520, delay: 120, useNativeDriver: true }),
    ]).start(() => {
      setHitEffects((prev) => prev.filter((item) => item.id !== id));
    });
  }, [combo, faceCenter.x, faceCenter.y, punchMode, triggerShake]);

  const handlePunchAt = useCallback((x: number, y: number) => {
    if (!punchMode) return;
    triggerPunch(x, y);
  }, [punchMode, triggerPunch]);

  const onScreenLayout = useCallback((evt: LayoutChangeEvent) => {
    const { width, height } = evt.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setLayout((prev) => (
        Math.abs(prev.width - width) > 1 || Math.abs(prev.height - height) > 1
          ? { width, height }
          : prev
      ));
    }
  }, []);

  const onProgressLayout = useCallback((evt: LayoutChangeEvent) => {
    const { width, x } = evt.nativeEvent.layout;
    if (width > 0) progressWidthRef.current = width;
    progressLeftRef.current = x;
  }, []);

  const progressResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      seekToScreenX(evt.nativeEvent.pageX || evt.nativeEvent.locationX + progressLeftRef.current);
    },
    onPanResponderMove: (evt) => {
      seekToScreenX(evt.nativeEvent.pageX || evt.nativeEvent.locationX + progressLeftRef.current);
    },
  }), [seekToScreenX]);

  const punchResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => punchMode,
    onMoveShouldSetPanResponder: () => false,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      handlePunchAt(locationX, locationY);
    },
  }), [handlePunchAt, punchMode]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => !punchMode && !pendingPunch && Math.abs(gesture.dy) > 12,
    onPanResponderGrant: (_, gesture) => {
      panStartY.current = gesture.y0;
    },
    onPanResponderRelease: (_, gesture) => {
      const dy = gesture.moveY - panStartY.current;
      if (Math.abs(dy) < 70) return;
      const dir = dy > 0 ? -1 : 1;
      const next = Math.max(0, Math.min(EPISODES.length - 1, epIdx + dir));
      if (next !== epIdx) {
        setEpIdx(next);
        setTimeout(() => videoRef.current?.playAsync(), 180);
      }
    },
  }), [epIdx, pendingPunch, punchMode]);

  return (
    <View style={styles.screen} onLayout={onScreenLayout} {...panResponder.panHandlers}>
      <StatusBar hidden />
      <VideoLayer videoRef={videoRef} source={ep.video} onStatusUpdate={onStatus} />

      <Pressable style={styles.tapLayer} onPress={togglePlay}>
        {showPlayIcon && (
          <View style={styles.playToast}>
            <Text style={styles.playToastText}>{playing ? '▶' : 'Ⅱ'}</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.topMask} pointerEvents="none" />
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconButton}><Text style={styles.iconText}>‹</Text></TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{ep.title}</Text>
        <TouchableOpacity style={styles.iconButton}><Text style={styles.iconSmall}>↗</Text></TouchableOpacity>
      </View>

      <View style={styles.rightRail}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}><Text style={styles.avatarText}>短</Text></View>
          <View style={styles.followBadge}><Text style={styles.followText}>+</Text></View>
        </View>
        <TouchableOpacity style={styles.railItem} onPress={() => setLiked((p) => !p)}>
          <Text style={[styles.railIcon, liked && styles.liked]}>♥</Text>
          <Text style={styles.railText}>{fmtNum(stats.likes + (liked ? 1 : 0))}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railItem} onPress={() => setShowDmInput((p) => !p)}>
          <Text style={styles.railIcon}>☰</Text>
          <Text style={styles.railText}>{fmtNum(stats.comments)}</Text>
        </TouchableOpacity>
        <View style={styles.railItem}>
          <Text style={styles.railIcon}>☆</Text>
          <Text style={styles.railText}>{fmtNum(stats.saves)}</Text>
        </View>
        <View style={styles.railItem}>
          <Text style={styles.railIcon}>↗</Text>
          <Text style={styles.railText}>分享</Text>
        </View>
      </View>

      <View style={styles.danmakuLayer} pointerEvents="none">
        {danmakuList.map((dm) => (
          <Animated.Text
            key={dm.id}
            style={[
              styles.danmaku,
              {
                top: `${dm.track * 23}%`,
                transform: [{ translateX: dm.x }],
              },
            ]}
          >
            {dm.text}
          </Animated.Text>
        ))}
      </View>

      <View style={styles.bottomMask} pointerEvents="none" />
      <View style={styles.bottomInfo}>
        <Text style={styles.author}>@{stats.author}</Text>
        <Text style={styles.desc} numberOfLines={2}>{stats.description}</Text>
        <View style={styles.tags}>
          {stats.tags.map((tag) => <Text key={tag} style={styles.tag}>#{tag}</Text>)}
        </View>
      </View>

      <Pressable
        style={styles.progressWrap}
        onLayout={onProgressLayout}
        {...progressResponder.panHandlers}
      >
        {punchHighlight && durMs > 0 && (
          <View
            style={[
              styles.hotPoint,
              { left: `${Math.min(100, (punchHighlight.startMs / durMs) * 100)}%` },
            ]}
          />
        )}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </Pressable>

      {showDmInput && (
        <KeyboardAvoidingView
          style={styles.dmInputRow}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TextInput
            value={dmText}
            onChangeText={setDmText}
            placeholder="发条弹幕..."
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={styles.dmInput}
            maxLength={50}
            returnKeyType="send"
            onSubmitEditing={() => sendDanmaku(dmText)}
          />
          <TouchableOpacity style={styles.dmSend} onPress={() => sendDanmaku(dmText)}>
            <Text style={styles.dmSendText}>发送</Text>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      )}

      {pendingPunch && !punchMode && (
        <View style={styles.promptOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptEpisode}>{ep.title}</Text>
            <Text style={styles.promptTitle}>{pendingPunch.title || '点击打脸'}</Text>
            <Text style={styles.promptHint}>{skipArmed ? '已跳过，马上继续播放' : '要进入击打互动吗？'}</Text>
            <View style={styles.promptActions}>
              <TouchableOpacity style={[styles.promptButton, styles.startButton]} disabled={skipArmed} onPress={enterPunchMode}>
                <Text style={styles.promptPrimary}>开始击打</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.promptButton, styles.skipButton]} disabled={skipArmed} onPress={skipPunchAndResume}>
                <Text style={styles.promptSecondary}>不打</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {punchMode && (
        <View style={styles.punchLayer} pointerEvents="box-none">
          <View style={styles.punchTouchLayer} {...punchResponder.panHandlers} />
          <View style={styles.punchHud}>
            <Text style={styles.hitPill}>HIT {hitCount}</Text>
            <TouchableOpacity style={styles.resumeButton} onPress={exitPunchAndResume}>
              <Text style={styles.resumeText}>继续播放</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.punchHintRow}>
            <Text style={styles.punchHint}>点击任意位置打击，特效会在点击处爆发</Text>
            <Text style={[styles.comboPill, combo >= 2 ? styles.comboVisible : styles.comboHidden]}>🔥 {combo} COMBO</Text>
          </View>
        </View>
      )}

      <View style={styles.hitEffectLayer} pointerEvents="none">
        {hitEffects.map((fx) => (
          <Animated.View
            key={fx.id}
            style={[
              styles.hitEffect,
              {
                left: fx.x,
                top: fx.y,
                opacity: fx.opacity,
                transform: [
                  { translateY: fx.fly.interpolate({ inputRange: [0, 1], outputRange: [0, -82] }) },
                  { scale: fx.scale },
                ],
              },
            ]}
          >
            <Text style={styles.fist}>👊</Text>
            <Text style={[styles.hitWord, fx.combo >= 3 && styles.hitWordHot]}>{fx.word}</Text>
            {fx.sparks.map((spark) => (
              <View
                key={spark.id}
                style={[
                  styles.spark,
                  {
                    width: spark.size,
                    height: spark.size,
                    backgroundColor: spark.color,
                    transform: [{ translateX: spark.dx }, { translateY: spark.dy }],
                  },
                ]}
              />
            ))}
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

export default PlayerScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.bg,
    overflow: 'hidden',
  },
  tapLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playToast: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playToastText: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
  },
  topMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 124,
    zIndex: 8,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  topBar: {
    position: 'absolute',
    top: 36,
    left: 12,
    right: 12,
    zIndex: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#fff',
    fontSize: 42,
    lineHeight: 42,
  },
  iconSmall: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  topTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  rightRail: {
    position: 'absolute',
    right: 12,
    bottom: 118,
    zIndex: 20,
    alignItems: 'center',
    gap: 18,
  },
  avatarWrap: {
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: '#c026d3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  followBadge: {
    marginTop: -10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ff2d55',
    borderWidth: 1,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  railItem: {
    alignItems: 'center',
  },
  railIcon: {
    color: '#fff',
    fontSize: 31,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 8,
  },
  liked: {
    color: '#ff2d55',
  },
  railText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  danmakuLayer: {
    position: 'absolute',
    top: '11%',
    bottom: '32%',
    left: 0,
    right: 0,
    zIndex: 15,
    overflow: 'hidden',
  },
  danmaku: {
    position: 'absolute',
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bottomMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 210,
    zIndex: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 82,
    bottom: 42,
    zIndex: 12,
  },
  author: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 5,
  },
  desc: {
    color: 'rgba(255,255,255,0.84)',
    fontSize: 13,
    lineHeight: 19,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
  },
  tag: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  progressWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    height: 20,
    zIndex: 22,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  hotPoint: {
    position: 'absolute',
    top: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#ff1744',
    shadowColor: '#ff1744',
    shadowOpacity: 1,
    shadowRadius: 8,
    zIndex: 2,
  },
  dmInputRow: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 92,
    zIndex: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dmInput: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#fff',
    paddingHorizontal: 14,
    fontSize: 13,
  },
  dmSend: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  dmSendText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  promptOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 45,
    backgroundColor: 'rgba(0,0,0,0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  promptCard: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(0,0,0,0.78)',
    padding: 20,
    alignItems: 'center',
  },
  promptEpisode: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '700',
  },
  promptTitle: {
    marginTop: 8,
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  promptHint: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '600',
  },
  promptActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
    marginTop: 20,
  },
  promptButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: '#ff3b30',
  },
  skipButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  promptPrimary: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  promptSecondary: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  punchLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
  },
  punchTouchLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  punchHud: {
    position: 'absolute',
    top: 58,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  hitPill: {
    minWidth: 86,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 7,
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    fontSize: 12,
    fontWeight: '900',
  },
  resumeButton: {
    height: 34,
    borderRadius: 7,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  resumeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  punchHintRow: {
    position: 'absolute',
    top: 102,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    zIndex: 2,
  },
  punchHint: {
    flexShrink: 1,
    maxWidth: '62%',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  comboPill: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#ff3b30',
  },
  comboVisible: {
    opacity: 1,
  },
  comboHidden: {
    opacity: 0,
  },
  faceTarget: {
    position: 'absolute',
    minWidth: 86,
    minHeight: 86,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceHitArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  hitEffectLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  hitEffect: {
    position: 'absolute',
    width: 1,
    height: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fist: {
    position: 'absolute',
    left: -18,
    top: -21,
    fontSize: 38,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 8,
  },
  hitWord: {
    position: 'absolute',
    top: -48,
    color: '#ff3b30',
    fontSize: 26,
    fontWeight: '900',
    textShadowColor: '#111',
    textShadowRadius: 4,
  },
  hitWordHot: {
    color: '#ffd60a',
    textShadowColor: '#ff3b30',
    textShadowRadius: 9,
  },
  spark: {
    position: 'absolute',
    left: -3,
    top: -3,
    borderRadius: 999,
  },
});
