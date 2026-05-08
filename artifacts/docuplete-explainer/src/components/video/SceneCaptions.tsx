import { useEffect, useState } from 'react';
import { SCENE_CAPTIONS, type Caption } from '@/lib/video/captions';

interface SceneCaptionsProps {
  sceneKey: string;
}

export function SceneCaptions({ sceneKey }: SceneCaptionsProps) {
  const baseKey = sceneKey.replace(/_r[12]$/, '');
  const captions: Caption[] = SCENE_CAPTIONS[baseKey] ?? [];

  const [activeIndex, setActiveIndex] = useState<number>(0);

  useEffect(() => {
    setActiveIndex(0);
    if (captions.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    captions.forEach((cap, i) => {
      // Activate this line at its start time
      timers.push(setTimeout(() => setActiveIndex(i), cap.start));
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [sceneKey]);

  if (captions.length === 0) return null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex flex-col items-center gap-1.5 pb-6 px-10 pointer-events-none">
      {captions.map((cap, i) => {
        const isActive = i === activeIndex;
        const isPast   = i < activeIndex;
        return (
          <div
            key={i}
            className="max-w-3xl w-full text-center rounded-xl px-5 py-2 transition-all duration-300"
            style={{
              background: isActive ? 'rgba(0,0,0,0.82)' : 'rgba(0,0,0,0.38)',
            }}
          >
            <p
              className="font-body leading-snug tracking-wide transition-all duration-300"
              style={{
                fontSize:   isActive ? '1.125rem' : '0.95rem',
                color:      isActive ? '#ffffff'  : isPast ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.55)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {cap.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}
