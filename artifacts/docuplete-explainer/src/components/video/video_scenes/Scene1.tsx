import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { sceneTransitions, staggerConfigs, charVariants } from '@/lib/video/animations';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),   // Show Sally
      setTimeout(() => setPhase(2), 2000),  // Show Tom
      setTimeout(() => setPhase(3), 3500),  // Show context text
      setTimeout(() => setPhase(4), 5000),  // Exit
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center"
      {...sceneTransitions.fadeBlur}
    >
      <div className="flex flex-row items-center justify-center gap-24 w-full px-20">
        
        {/* Sally Side */}
        <div className="flex flex-col items-center gap-8">
          <motion.div 
            className="relative w-48 h-48 rounded-full bg-[var(--color-bg-muted)] overflow-hidden shadow-2xl border-4 border-[var(--color-primary)]"
            initial={{ scale: 0, rotate: -15, opacity: 0 }}
            animate={phase >= 1 ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 0, rotate: -15, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <img src={`${import.meta.env.BASE_URL}images/sally.png`} className="w-full h-full object-cover" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <h2 className="text-4xl font-display font-bold text-white">Sally</h2>
            <p className="text-xl text-[var(--color-text-muted)] font-body">Financial Advisor</p>
          </motion.div>
        </div>

        {/* Connection Line */}
        <motion.div 
          className="h-1 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] relative"
          initial={{ width: 0, opacity: 0 }}
          animate={phase >= 2 ? { width: '20vw', opacity: 1 } : { width: 0, opacity: 0 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        >
          <motion.div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[var(--color-bg-dark)] px-4 py-2 rounded-full border border-white/20 whitespace-nowrap"
            initial={{ scale: 0, opacity: 0 }}
            animate={phase >= 3 ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
            transition={{ type: 'spring', delay: 0.5 }}
          >
            <span className="text-sm font-mono tracking-widest text-white/80 uppercase">NEEDS PAPERWORK DONE</span>
          </motion.div>
        </motion.div>

        {/* Tom Side */}
        <div className="flex flex-col items-center gap-8">
          <motion.div 
            className="relative w-48 h-48 rounded-full bg-[var(--color-bg-muted)] overflow-hidden shadow-2xl border-4 border-[var(--color-accent)]"
            initial={{ scale: 0, rotate: 15, opacity: 0 }}
            animate={phase >= 2 ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 0, rotate: 15, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <img src={`${import.meta.env.BASE_URL}images/tom.png`} className="w-full h-full object-cover" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ delay: 0.2 }}
            className="text-center"
          >
            <h2 className="text-4xl font-display font-bold text-white">Tom</h2>
            <p className="text-xl text-[var(--color-text-muted)] font-body">New Client</p>
          </motion.div>
        </div>

      </div>
    </motion.div>
  );
}
