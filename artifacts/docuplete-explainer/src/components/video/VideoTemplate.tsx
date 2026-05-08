import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';
import { Scene8 } from './video_scenes/Scene8';

// Durations matched exactly to per-scene voiceover clips
export const SCENE_DURATIONS: Record<string, number> = {
  intro:      9038,
  problem1:  15778,
  problem2:  14890,
  solution1: 14759,
  solution2: 12382,
  solution3: 16744,
  solution4: 15621,
  outro:     14811,
};

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  intro: Scene1,
  problem1: Scene2,
  problem2: Scene3,
  solution1: Scene4,
  solution2: Scene5,
  solution3: Scene6,
  solution4: Scene7,
  outro: Scene8,
};

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentScene, currentSceneKey } = useVideoPlayer({ durations, loop });

  useEffect(() => {
    onSceneChange?.(currentSceneKey);
  }, [currentSceneKey, onSceneChange]);

  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '') as keyof typeof SCENE_DURATIONS;
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[var(--color-bg-dark)] font-body text-white">

      {/* Persistent Background Layer */}
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
        />

        <motion.div
          className="absolute w-[80vw] h-[80vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none"
          animate={{
            x: sceneIndex < 3 ? '-20%' : sceneIndex < 6 ? '10%' : '50%',
            y: sceneIndex < 3 ? '-10%' : sceneIndex < 6 ? '-30%' : '-20%',
            backgroundColor: sceneIndex < 3 ? '#EF4444' : '#1B4FD8',
            scale: sceneIndex < 3 ? 1.2 : 1,
            opacity: sceneIndex === 7 ? 0 : 0.15,
          }}
          transition={{ duration: 3, ease: 'easeInOut' }}
        />

        <motion.div
          className="absolute w-[60vw] h-[60vw] rounded-full blur-[100px] mix-blend-screen pointer-events-none"
          animate={{
            right: sceneIndex < 3 ? '-10%' : '10%',
            bottom: sceneIndex < 3 ? '-20%' : '0%',
            backgroundColor: sceneIndex < 3 ? '#F59E0B' : '#C49A38',
            scale: sceneIndex < 3 ? 1 : 1.5,
            opacity: sceneIndex === 7 ? 0 : 0.1,
          }}
          transition={{ duration: 4, ease: 'easeInOut' }}
        />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full h-full">
        <AnimatePresence mode="popLayout">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
      </div>

    </div>
  );
}
