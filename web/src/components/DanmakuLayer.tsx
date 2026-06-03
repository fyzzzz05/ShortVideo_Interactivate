/**
 * DanmakuLayer — 弹幕浮层。
 * 绝对定位在视频中间60%区域，从右向左滚动。
 * 最多同时显示4条，4个独立轨道。
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { DanmakuItem } from '../types';

interface Props {
  items: DanmakuItem[];
  /** 当前视频时间 (秒)，控制哪些弹幕已出现 */
  currentTime: number;
  paused?: boolean;
}

const MAX_TRACKS = 4;
const SCREEN_W = 375; // px — 弹幕轨道全宽（仅用于滚动逻辑）

const DanmakuLayer: React.FC<Props> = ({ items, currentTime, paused = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // 每条 track 上当前显示的弹幕
  const [tracks, setTracks] = useState<(DanmakuItem | null)[]>([null, null, null, null]);
  const shownRef = useRef(new Set<string>());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const scheduleNext = useCallback((time: number) => {
    // 找到所有应该在当前时间点出现但尚未显示的弹幕
    const overdue = items
      .filter((d) => d.startTime <= time && !shownRef.current.has(d.id))
      .sort((a, b) => a.startTime - b.startTime);

    for (const dm of overdue) {
      // 找一条空闲轨道
      setTracks((prev) => {
        const idx = prev.findIndex((t) => t === null);
        if (idx === -1) return prev; // 4条全满
        const next = [...prev];
        next[idx] = dm;
        shownRef.current.add(dm.id);

        // 弹幕滚完后自动清除
        const dur = (SCREEN_W + 200) / dm.speed * 1000; // 滚动总时长 ms
        timersRef.current.set(dm.id, setTimeout(() => {
          setTracks((p) => {
            const n = [...p];
            if (n[idx]?.id === dm.id) n[idx] = null;
            return n;
          });
          timersRef.current.delete(dm.id);
        }, dur));

        return next;
      });
    }
  }, [items]);

  useEffect(() => {
    scheduleNext(currentTime);
  }, [currentTime, scheduleNext]);

  // 暂停/恢复动画
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const kids = container.querySelectorAll<HTMLDivElement>('[data-danmaku]');
    kids.forEach((el) => {
      el.style.animationPlayState = paused ? 'paused' : 'running';
    });
  }, [paused]);

  // cleanup
  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach((t) => clearTimeout(t)); };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute z-20 pointer-events-none overflow-hidden"
      style={{
        top: '10%',
        bottom: '30%',
        left: 0,
        right: 0,
      }}
    >
      {tracks.map((dm, i) => {
        if (!dm) return <div key={`empty-${i}`} className="absolute" style={{ top: `${i * 25}%`, height: '25%' }} />;
        return (
          <div
            key={dm.id}
            data-danmaku
            className="absolute whitespace-nowrap"
            style={{
              top: `${dm.track * 25}%`,
              right: '-200px',
              fontSize: '14px',
              color: '#fff',
              fontWeight: 600,
              textShadow: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000',
              animation: `danmakuScroll ${(SCREEN_W + 200) / dm.speed}s linear forwards`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          >
            {dm.text}
          </div>
        );
      })}
      <style>{`
        @keyframes danmakuScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-${SCREEN_W + 400}px); }
        }
      `}</style>
    </div>
  );
};

export default DanmakuLayer;
