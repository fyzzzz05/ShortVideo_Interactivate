/**
 * PlayerScreen — 全屏视频播放器 + 互动中枢。
 *
 * 布局：视频占满屏幕，底部控件浮在视频上方。
 * web 端去掉 SafeAreaView，直接全屏。
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Video, AVPlaybackStatus } from 'expo-av';
import { StatusBar } from 'expo-status-bar';

import VideoLayer from './VideoLayer';
import ProgressBar from './ProgressBar';
import ControlBar from './ControlBar';
import EpisodeSelector from './EpisodeSelector';
import InteractionOverlay from './InteractionOverlay';
import FaceHighlight from './FaceHighlight';
import FaceSwellingCanvas from './FaceSwellingCanvas';
import ComboDisplay from './ComboDisplay';
import GodMoment, { GodMomentHandle } from './GodMoment';

import { COLORS, DURATION } from '../config/theme';
import type { Highlight } from '../data/types';
import { EPISODES } from '../data/episodes';
import { EPISODE_HIGHLIGHTS } from '../data/highlights';
import { SCENE_MAP, SceneType, resolveScene } from '../config/sceneMap';

const { width: W, height: H } = Dimensions.get('window');

const PlayerScreen: React.FC = () => {
  const videoRef = useRef<Video>(null);
  const [epId, setEpId] = useState(5);
  const [playing, setPlaying] = useState(false);
  const [timeMs, setTimeMs] = useState(0);
  const [durMs, setDurMs] = useState(0);

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [pendingHl, setPendingHl] = useState<Highlight | null>(null);
  const [activeHl, setActiveHl] = useState<Highlight | null>(null);
  const [cd, setCd] = useState(DURATION.countdownSec);
  const [combo, setCombo] = useState(0);
  const [skipArmed, setSkipArmed] = useState(false);
  const [showEps, setShowEps] = useState(false);

  const cdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gmRef = useRef<GodMomentHandle>(null);

  const ep = EPISODES.find((e) => e.id === epId) ?? EPISODES[0];
  const epIdx = EPISODES.findIndex((e) => e.id === epId);
  const hasNext = epIdx < EPISODES.length - 1;

  useEffect(() => {
    setHighlights(EPISODE_HIGHLIGHTS[epId] ?? []);
    setPendingHl(null);
    setActiveHl(null);
    setCombo(0);
    setCd(DURATION.countdownSec);
    setSkipArmed(false);
  }, [epId]);

  const onStatus = useCallback(
    (s: AVPlaybackStatus) => {
      if (!s.isLoaded) return;
      setPlaying(s.isPlaying);
      setTimeMs(s.positionMillis);
      if (s.durationMillis) setDurMs(s.durationMillis);
      if (s.isPlaying && !activeHl && !pendingHl) {
        const sec = s.positionMillis / 1000;
        const m = highlights.find((h) => !h.triggered && Math.abs(h.time - sec) < 0.5);
        if (m) triggerHl(m);
      }
      if (s.didJustFinish) goNext();
    },
    [highlights, activeHl, pendingHl],
  );

  const triggerHl = useCallback(async (h: Highlight) => {
    await videoRef.current?.pauseAsync();
    setPendingHl(h);
    setSkipArmed(false);
    setCombo(0);
    setCd(h.interaction?.durationSec ?? DURATION.countdownSec);
  }, []);

  useEffect(() => {
    if (!activeHl) return;
    if (resolveScene(activeHl.scene || activeHl.type) === 'REVENGE') return;
    cdTimer.current = setInterval(() => {
      setCd((p) => {
        if (p <= 1) { clearInterval(cdTimer.current!); finishInteraction(); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => { if (cdTimer.current) clearInterval(cdTimer.current); };
  }, [activeHl]);

  useEffect(() => {
    return () => {
      if (skipTimer.current) clearTimeout(skipTimer.current);
    };
  }, []);

  const finishInteraction = useCallback(() => {
    if (cdTimer.current) clearInterval(cdTimer.current);
    if (activeHl) {
      setHighlights((p) => p.map((h) => (h.id === activeHl.id ? { ...h, triggered: true } : h)));
    }
    setActiveHl(null);
    setCd(DURATION.countdownSec);
    videoRef.current?.playAsync();
  }, [activeHl]);

  const startPendingInteraction = useCallback(() => {
    if (!pendingHl) return;
    if (skipTimer.current) clearTimeout(skipTimer.current);
    setActiveHl(pendingHl);
    setPendingHl(null);
    setSkipArmed(false);
    setCombo(0);
    setCd(pendingHl.interaction?.durationSec ?? DURATION.countdownSec);
  }, [pendingHl]);

  const skipPendingInteraction = useCallback(() => {
    if (!pendingHl) return;
    if (skipTimer.current) clearTimeout(skipTimer.current);
    setSkipArmed(true);
    skipTimer.current = setTimeout(() => {
      setHighlights((p) => p.map((h) => (h.id === pendingHl.id ? { ...h, triggered: true } : h)));
      setPendingHl(null);
      setSkipArmed(false);
      videoRef.current?.playAsync();
    }, 2000);
  }, [pendingHl]);

  const onCombo = useCallback((n: number) => {
    setCombo(n);
    if (cboTimer.current) clearTimeout(cboTimer.current);
    if (n > 0) cboTimer.current = setTimeout(() => setCombo(0), DURATION.comboReset);
  }, []);

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    if (playing) await videoRef.current.pauseAsync();
    else await videoRef.current.playAsync();
  }, [playing]);

  const goNext = useCallback(() => { if (hasNext) setEpId(EPISODES[epIdx + 1].id); }, [hasNext, epIdx]);
  const seek = useCallback(async (ms: number) => { await videoRef.current?.setPositionAsync(ms); setTimeMs(ms); }, []);

  const accent = activeHl
    ? (SCENE_MAP[activeHl.scene as SceneType] ?? SCENE_MAP.REVENGE).color
    : COLORS.primary;
  const isSlapInteraction = activeHl?.type === 'slap_effect' || activeHl?.interaction.trigger === 'SLAP';

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {/* ═══ 视频层（填满整个屏幕）═══ */}
      <VideoLayer videoRef={videoRef} source={ep.video} onStatusUpdate={onStatus} />

      {/* ═══ 覆盖层：特效 + 互动 ═══ */}
      <View style={styles.overlay} pointerEvents="box-none">
        {activeHl?.character?.facePosition && (
          <FaceHighlight facePosition={activeHl.character.facePosition} color={accent} visible combo={combo} />
        )}
        {activeHl && combo > 0 && (isSlapInteraction || activeHl.character?.facePosition) && (
          <FaceSwellingCanvas facePosition={activeHl.character?.facePosition} combo={combo} accentColor={accent} videoPlaying={playing} />
        )}
        {activeHl && combo > 0 && <ComboDisplay combo={combo} color={accent} />}
        <GodMoment ref={gmRef} />
        {activeHl && (
          <InteractionOverlay
            highlight={activeHl}
            countdown={cd}
            onComplete={finishInteraction}
            onComboUpdate={onCombo}
          />
        )}
      </View>

      {pendingHl && (
        <View style={styles.promptOverlay} pointerEvents="auto">
          <View style={styles.promptCard}>
            <Text style={styles.promptEpisode}>{ep.title}</Text>
            <Text style={styles.promptTitle}>{pendingHl.title}</Text>
            <Text style={styles.promptHint}>
              {skipArmed ? '已跳过，2 秒后继续播放' : '要进入击打互动吗？'}
            </Text>
            <View style={styles.promptActions}>
              <TouchableOpacity
                style={[styles.promptButton, styles.punchButton, skipArmed && styles.disabledButton]}
                activeOpacity={0.85}
                disabled={skipArmed}
                onPress={startPendingInteraction}
              >
                <Text style={styles.primaryButtonText}>开始击打</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.promptButton, styles.skipButton, skipArmed && styles.disabledButton]}
                activeOpacity={0.85}
                disabled={skipArmed}
                onPress={skipPendingInteraction}
              >
                <Text style={styles.secondaryButtonText}>不打</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ═══ 底部遮罩 ═══ */}
      <View style={styles.bottomMask} pointerEvents="none" />

      {/* ═══ 底部控件 ═══ */}
      <View style={styles.controls}>
        <ProgressBar currentMs={timeMs} durationMs={durMs} highlights={highlights} onSeek={seek} />
        <ControlBar
          isPlaying={playing}
          hasNext={hasNext}
          episodeTitle={ep.title}
          onPlayPause={togglePlay}
          onNext={goNext}
          onEpisodes={() => setShowEps(true)}
        />
      </View>

      {/* ═══ 剧集面板 ═══ */}
      <EpisodeSelector
        visible={showEps}
        currentEpisodeId={epId}
        onSelect={setEpId}
        onClose={() => setShowEps(false)}
      />
    </View>
  );
};

export default PlayerScreen;

const styles = StyleSheet.create({
  // 根容器：填满整个窗口
  screen: {
    flex: 1,
    width: W,
    height: H,
    backgroundColor: COLORS.bg,
    overflow: 'hidden',
  },
  // 特效 + 互动浮层
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  // 底部遮罩（让白色控件文字可见）
  bottomMask: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  // 底部控件区
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 24,
    zIndex: 20,
  },
  promptOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  promptCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(0,0,0,0.78)',
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  promptEpisode: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  promptTitle: {
    marginTop: 8,
    fontSize: 22,
    color: COLORS.textPrimary,
    fontWeight: '900',
    textAlign: 'center',
  },
  promptHint: {
    marginTop: 8,
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  promptActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  promptButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  punchButton: {
    backgroundColor: COLORS.primary,
  },
  skipButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
});
