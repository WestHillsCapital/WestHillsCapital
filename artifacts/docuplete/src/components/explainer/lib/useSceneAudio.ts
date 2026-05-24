import { useEffect, useRef } from 'react';

export function useSceneAudio(
  clips: Record<string, string>,
  activeKey: string,
  enabled: boolean,
) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!enabled) {
      audioRef.current?.pause();
      return;
    }

    const src = clips[activeKey];
    if (!src) {
      audioRef.current?.pause();
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }

    const audio = new Audio(src);
    audioRef.current = audio;
    audio.play().catch(() => {});

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [activeKey, enabled]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);
}
