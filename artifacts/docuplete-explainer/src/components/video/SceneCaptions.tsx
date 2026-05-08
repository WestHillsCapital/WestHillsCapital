import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SCENE_CAPTIONS, type Caption } from '@/lib/video/captions';

interface SceneCaptionsProps {
  sceneKey: string;
}

export function SceneCaptions({ sceneKey }: SceneCaptionsProps) {
  const baseKey = sceneKey.replace(/_r[12]$/, '');
  const captions: Caption[] = SCENE_CAPTIONS[baseKey] ?? [];

  const [activeIndex, setActiveIndex] = useState<number>(-1);

  useEffect(() => {
    setActiveIndex(-1);
    if (captions.length === 0) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    captions.forEach((cap, i) => {
      timers.push(
        setTimeout(() => setActiveIndex(i), cap.start),
        setTimeout(() => setActiveIndex(prev => (prev === i ? -1 : prev)), cap.end),
      );
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [sceneKey]);

  const activeCaption = activeIndex >= 0 ? captions[activeIndex] : null;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 flex justify-center pb-8 px-12 pointer-events-none">
      <AnimatePresence mode="wait">
        {activeCaption && (
          <motion.div
            key={`${sceneKey}-${activeIndex}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-black/75 backdrop-blur-sm rounded-xl px-6 py-3 max-w-3xl text-center"
          >
            <p className="text-white text-lg font-body leading-snug tracking-wide">
              {activeCaption.text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
