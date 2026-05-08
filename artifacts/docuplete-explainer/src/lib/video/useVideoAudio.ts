import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Manages voiceover (primary) + background music (ducked) together.
 * The voiceover is a single continuous track covering the whole video.
 * Background music plays at very low volume underneath.
 */
export function useVideoAudio(voSrc: string, musicSrc: string) {
  const voRef    = useRef<HTMLAudioElement | null>(null);
  const bgRef    = useRef<HTMLAudioElement | null>(null);
  const [muted,   setMuted]   = useState(true);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!voSrc || !musicSrc) return;
    const vo = new Audio(voSrc);
    const bg = new Audio(musicSrc);
    bg.loop   = true;
    bg.volume = 0;
    bg.muted  = true;
    voRef.current = vo;
    bgRef.current = bg;
    return () => {
      vo.pause(); vo.src = '';
      bg.pause(); bg.src = '';
      voRef.current = null;
      bgRef.current = null;
    };
  }, [voSrc, musicSrc]);

  const toggleMute = useCallback(() => {
    const vo = voRef.current;
    const bg = bgRef.current;
    if (!vo || !bg) return;

    if (!started) {
      bg.muted = false;
      bg.play().then(() => fadeVolume(bg, 0, 0.07, 1200)).catch(() => {});
      vo.currentTime = 0;
      vo.play().catch(() => {});
      setMuted(false);
      setStarted(true);
      return;
    }

    if (muted) {
      // Unmute: resume voiceover + bring music back
      vo.play().catch(() => {});
      bg.muted = false;
      fadeVolume(bg, 0, 0.07, 600);
      setMuted(false);
    } else {
      // Mute: pause voiceover + silence music
      vo.pause();
      fadeVolume(bg, bg.volume, 0, 400, () => { bg.muted = true; });
      setMuted(true);
    }
  }, [muted, started]);

  return { muted, toggleMute };
}

function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
  onComplete?: () => void,
) {
  const steps  = 20;
  const stepMs = durationMs / steps;
  const delta  = (to - from) / steps;
  let step = 0;
  audio.volume = Math.max(0, Math.min(1, from));
  const id = setInterval(() => {
    step++;
    audio.volume = Math.max(0, Math.min(1, from + delta * step));
    if (step >= steps) { clearInterval(id); onComplete?.(); }
  }, stepMs);
}
