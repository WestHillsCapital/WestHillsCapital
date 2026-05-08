import { useCallback, useEffect, useRef, useState } from 'react';

export function useBackgroundMusic(src: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0;
    audio.muted = true;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [src]);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!started) {
      // First click: start playback and unmute
      audio.muted = false;
      audio.play().then(() => {
        fadeVolume(audio, 0, 0.22, 1500);
        setMuted(false);
        setStarted(true);
      }).catch(() => {});
      return;
    }

    if (muted) {
      audio.muted = false;
      fadeVolume(audio, 0, 0.22, 500);
      setMuted(false);
    } else {
      fadeVolume(audio, audio.volume, 0, 400, () => {
        audio.muted = true;
      });
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
  const steps = 20;
  const stepMs = durationMs / steps;
  const delta = (to - from) / steps;
  let step = 0;
  audio.volume = Math.max(0, Math.min(1, from));

  const id = setInterval(() => {
    step++;
    audio.volume = Math.max(0, Math.min(1, from + delta * step));
    if (step >= steps) {
      clearInterval(id);
      onComplete?.();
    }
  }, stepMs);
}
