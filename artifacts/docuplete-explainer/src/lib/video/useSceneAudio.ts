import { useEffect, useRef } from 'react';

/**
 * Plays a per-scene voiceover clip.
 * When `activeKey` changes, the current clip stops and the new one starts immediately.
 * Background music is managed separately (already ducked in useVideoAudio).
 */
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

    // Stop previous clip
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);
}
