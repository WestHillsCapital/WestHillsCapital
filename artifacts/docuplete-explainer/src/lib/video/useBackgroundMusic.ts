import { useEffect, useRef } from 'react';

export function useBackgroundMusic(enabled = true, src: string = '') {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled || !src) return;

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0;
    audioRef.current = audio;

    // Attempt autoplay — browsers allow muted autoplay
    audio.muted = true;
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Playback started: unmute and fade in volume
          audio.muted = false;
          fadeVolume(audio, 0, 0.18, 3000);
        })
        .catch(() => {
          // Autoplay blocked — resume on first user interaction
          audio.muted = false;
          const resume = () => {
            audio.play().then(() => {
              fadeVolume(audio, 0, 0.18, 3000);
            }).catch(() => {});
            document.removeEventListener('pointerdown', resume);
            document.removeEventListener('keydown', resume);
          };
          document.addEventListener('pointerdown', resume, { once: true });
          document.addEventListener('keydown', resume, { once: true });
        });
    }

    return () => {
      fadeVolume(audio, audio.volume, 0, 1500, () => {
        audio.pause();
        audio.src = '';
        audioRef.current = null;
      });
    };
  }, [enabled, src]);
}

function fadeVolume(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  durationMs: number,
  onComplete?: () => void,
) {
  const steps = 30;
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
