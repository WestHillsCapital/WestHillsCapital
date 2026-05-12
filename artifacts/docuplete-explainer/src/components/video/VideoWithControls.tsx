import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Repeat, Volume2, VolumeX } from 'lucide-react';
import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';
import { useSceneAudio } from '@/lib/video/useSceneAudio';

const BASE = import.meta.env.BASE_URL;

// Map each scene key → its voiceover clip URL
const VOICEOVER_CLIPS: Record<string, string> = {
  intro:     `${BASE}audio/scene-intro.mp3`,
  problem1:  `${BASE}audio/scene-problem1.mp3`,
  problem2:  `${BASE}audio/scene-problem2.mp3`,
  solution1: `${BASE}audio/scene-solution1.mp3`,
  solution2: `${BASE}audio/scene-solution2.mp3`,
  solution3: `${BASE}audio/scene-solution3.mp3`,
  solution4: `${BASE}audio/scene-solution4.mp3`,
  outro:     `${BASE}audio/scene-outro.mp3`,
};

const PROGRESS_TICK_MS = 60;

function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  ms: number,
  onDone?: () => void,
) {
  const steps = 20;
  const delta = (to - from) / steps;
  let step = 0;
  audio.volume = Math.max(0, Math.min(1, from));
  const id = setInterval(() => {
    step++;
    audio.volume = Math.max(0, Math.min(1, from + delta * step));
    if (step >= steps) { clearInterval(id); onDone?.(); }
  }, ms / steps);
}

// ---------- sub-components ----------

function ProgressSegments({
  sceneKeys,
  activeIndex,
  activeDuration,
  tick,
  onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  tick: number;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsed(performance.now() - start);
    }, PROGRESS_TICK_MS);
    return () => window.clearInterval(id);
  }, [tick]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;

  return (
    <div className="flex-1 flex items-center gap-1.5">
      {sceneKeys.map((key, i) => {
        const isActive = i === activeIndex;
        const isPast   = i < activeIndex;
        const fill     = isActive ? progress * 100 : isPast ? 100 : 0;
        return (
          <button
            key={key}
            onClick={() => onJumpTo(i)}
            className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-4 hover:bg-white/25 transition-all relative min-h-[12px]"
            aria-label={`Jump to scene ${i + 1}`}
            aria-current={isActive ? 'true' : undefined}
          >
            <div
              className="absolute inset-y-0 left-0 bg-white/90 rounded-full transition-[width] duration-100"
              style={{ width: `${fill}%` }}
            />
          </button>
        );
      })}
    </div>
  );
}

interface ControlBarProps {
  visible: boolean;
  collapsed: boolean;
  locked: boolean;
  muted: boolean;
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  tick: number;
  onToggleLock: () => void;
  onToggleSound: () => void;
  onJumpTo: (index: number) => void;
  onToggleCollapsed: () => void;
}

function ControlBar({
  visible,
  collapsed,
  locked,
  muted,
  sceneKeys,
  activeIndex,
  activeDuration,
  tick,
  onToggleLock,
  onToggleSound,
  onJumpTo,
  onToggleCollapsed,
}: ControlBarProps) {
  return (
    <div
      className={`flex items-center gap-3 bg-black/50 backdrop-blur-sm px-5 py-4 transition-all duration-200 ease-out ${
        visible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-full opacity-0 pointer-events-none'
      }`}
      aria-hidden={!visible}
    >
      {/* Scene lock */}
      <button
        onClick={onToggleLock}
        className={`w-14 h-14 flex items-center justify-center transition-colors rounded-lg shrink-0 ${
          locked
            ? 'text-white bg-white/15 hover:bg-white/25'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        title={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
        aria-pressed={locked}
      >
        <Repeat className="w-8 h-8" />
      </button>

      {/* Sound toggle */}
      <button
        onClick={onToggleSound}
        className={`w-14 h-14 flex items-center justify-center transition-colors rounded-lg shrink-0 ${
          !muted
            ? 'text-white bg-white/15 hover:bg-white/25'
            : 'text-white/60 hover:text-white hover:bg-white/10'
        }`}
        title={muted ? 'Click to play voiceover' : 'Mute'}
        aria-label={muted ? 'Click to play voiceover' : 'Mute'}
        aria-pressed={!muted}
      >
        {muted ? <VolumeX className="w-8 h-8" /> : <Volume2 className="w-8 h-8" />}
      </button>

      <div className="w-px self-stretch bg-white/15" aria-hidden="true" />

      <ProgressSegments
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        activeDuration={activeDuration}
        tick={tick}
        onJumpTo={onJumpTo}
      />

      <div className="text-xl text-white/60 font-mono tabular-nums shrink-0">
        {activeIndex + 1}/{sceneKeys.length}
      </div>

      <button
        onClick={onToggleCollapsed}
        className="w-14 h-14 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors rounded-lg shrink-0"
        title={collapsed ? 'Show controls' : 'Hide controls'}
        aria-label={collapsed ? 'Show controls' : 'Hide controls'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronUp className="w-10 h-10" /> : <ChevronDown className="w-10 h-10" />}
      </button>
    </div>
  );
}

// ---------- main component ----------

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;

  // Audio state
  const [muted,   setMuted]   = useState(true);
  const [started, setStarted] = useState(false);
  const bgRef = useRef<HTMLAudioElement | null>(null);

  // Set up background music and attempt auto-play when iframed
  useEffect(() => {
    const bg = new Audio(`${BASE}audio/background.wav`);
    bg.loop = true; bg.volume = 0; bg.muted = true;
    bgRef.current = bg;

    // When embedded, try to start immediately — the parent page's click
    // gesture propagates through the iframe's allow="autoplay" attribute.
    if (isIframed) {
      bg.muted = false;
      bg.play()
        .then(() => {
          fadeVolume(bg, 0, 0.07, 1200);
          setMuted(false);
          setStarted(true);
        })
        .catch(() => {
          bg.muted = true;
          // Falls back to manual start via the sound button or postMessage
        });
    }

    return () => { bg.pause(); bg.src = ''; bgRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also listen for postMessage from the parent page (fallback if autoplay was blocked)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== 'docuplete-play') return;
      const bg = bgRef.current;
      if (!bg || started) return;
      bg.muted = false;
      bg.play()
        .then(() => {
          fadeVolume(bg, 0, 0.07, 1200);
          setMuted(false);
          setStarted(true);
        })
        .catch(() => { bg.muted = true; });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [started]);

  const {
    sceneKeys,
    activeIndex,
    locked,
    mountKey,
    tick,
    durations,
    activeDuration,
    onSceneChange,
    jumpTo,
    toggleLock,
  } = useSceneControls(SCENE_DURATIONS);

  const activeSceneKey = sceneKeys[activeIndex] ?? 'intro';

  // Per-scene voiceover
  useSceneAudio(VOICEOVER_CLIPS, activeSceneKey, !muted);

  // Ended state
  const [isEnded, setIsEnded] = useState(false);

  const handleVideoEnd = useCallback(() => {
    setIsEnded(true);
    const bg = bgRef.current;
    if (bg) fadeVolume(bg, bg.volume, 0, 1500, () => { bg.muted = true; });
    setMuted(true);
  }, []);

  const handlePlayAgain = useCallback(() => {
    setIsEnded(false);
    setMuted(false);
    jumpTo(0);
    const bg = bgRef.current;
    if (bg) {
      bg.currentTime = 0;
      bg.muted = false;
      bg.play().then(() => fadeVolume(bg, 0, 0.07, 800)).catch(() => {});
    }
    setStarted(true);
  }, [jumpTo]);

  const toggleMute = useCallback(() => {
    const bg = bgRef.current;
    if (!bg) return;

    if (!started) {
      bg.muted = false;
      bg.play().then(() => fadeVolume(bg, 0, 0.07, 1200)).catch(() => {});
      setMuted(false);
      setStarted(true);
      return;
    }
    if (muted) {
      bg.muted = false;
      fadeVolume(bg, 0, 0.07, 500);
      setMuted(false);
    } else {
      fadeVolume(bg, bg.volume, 0, 400, () => { bg.muted = true; });
      setMuted(true);
    }
  }, [muted, started]);

  // Control bar visibility
  const sensorRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering,  setHovering]  = useState(false);
  const [tapPinned, setTapPinned] = useState(false);

  const handlePointerEnter = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHovering(true);
  }, []);
  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') setHovering(false);
  }, []);
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse') return;
      if (collapsed) setTapPinned(true);
    },
    [collapsed],
  );
  const handleToggleCollapsed = useCallback(() => {
    setCollapsed(c => {
      if (!c) { setHovering(false); setTapPinned(false); }
      return !c;
    });
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return;
      const sensor = sensorRef.current;
      if (sensor && !sensor.contains(e.target as Node)) setTapPinned(false);
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [collapsed, tapPinned]);

  const barVisible = !collapsed || hovering || tapPinned;

  if (!isIframed) return <VideoTemplate />;

  return (
    <div className="relative w-full h-full">
      <VideoTemplate
        key={mountKey}
        durations={durations}
        loop={false}
        onSceneChange={onSceneChange}
        onVideoEnd={handleVideoEnd}
      />

      {/* Play Again overlay — shown when the video finishes */}
      {isEnded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <button
            onClick={handlePlayAgain}
            className="flex items-center gap-3 bg-white text-[#0B1220] font-bold text-xl px-10 py-5 rounded-2xl shadow-2xl hover:bg-white/90 active:scale-95 transition-all"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
              <path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
            </svg>
            Play Again
          </button>
        </div>
      )}

      <div
        ref={sensorRef}
        className="absolute bottom-0 left-0 right-0 z-50 flex flex-col justify-end"
        style={{ height: '25%' }}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
      >
        <div className="flex-1 w-full" aria-hidden="true" />
        <ControlBar
          visible={barVisible && !isEnded}
          collapsed={collapsed}
          locked={locked}
          muted={muted}
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          tick={tick}
          onToggleLock={toggleLock}
          onToggleSound={toggleMute}
          onJumpTo={jumpTo}
          onToggleCollapsed={handleToggleCollapsed}
        />
      </div>
    </div>
  );
}
