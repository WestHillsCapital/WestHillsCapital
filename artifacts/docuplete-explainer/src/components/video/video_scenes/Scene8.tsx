import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const TAGLINE_WORDS = ['One', 'questionnaire.', 'Every', 'document.', 'Done.'];

export function Scene8() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1600),
      setTimeout(() => setPhase(3), 3400),
      setTimeout(() => setPhase(4), 5500),
      setTimeout(() => setPhase(5), 6800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.8 }}
    >
      {/* Deep radial glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, #1B4FD820, transparent)' }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Logo */}
      <motion.div
        className="flex items-center gap-4 mb-12"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={phase >= 1 ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
          style={{ backgroundColor: '#1B4FD8' }}
        >
          <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
            <path d="M8 8h8.5a3.5 3.5 0 0 1 0 7H8V8Z" fill="white" opacity="0.9" />
            <path d="M8 15h9a3.5 3.5 0 0 1 0 7H8v-7Z" fill="white" />
            <path d="M17.5 19.5 L21 19.5" stroke="#1B4FD8" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-[2.5vw] font-display font-black text-white tracking-tight">Docuplete</span>
      </motion.div>

      {/* Tagline word-by-word */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 max-w-3xl mb-10 px-8">
        {TAGLINE_WORDS.map((word, i) => (
          <motion.span
            key={word + i}
            className="font-display font-black leading-none"
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 5rem)',
              color: word === 'Done.' ? '#C49A38' : 'white',
            }}
            initial={{ opacity: 0, y: 40, rotateX: -40 }}
            animate={phase >= 2 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 40, rotateX: -40 }}
            transition={{
              delay: i * 0.12,
              type: 'spring',
              stiffness: 350,
              damping: 28,
            }}
          >
            {word}
          </motion.span>
        ))}
      </div>

      {/* Sub tagline */}
      <motion.p
        className="text-white/50 font-body text-xl text-center max-w-lg"
        initial={{ opacity: 0, filter: 'blur(12px)' }}
        animate={phase >= 3 ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(12px)' }}
        transition={{ duration: 0.7 }}
      >
        Document automation for financial advisors, insurance agents, and compliance-driven teams.
      </motion.p>

      {/* Industry tags */}
      <motion.div
        className="flex gap-3 flex-wrap justify-center mt-8"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        {['Financial Services', 'Insurance', 'Real Estate', 'Legal', 'Healthcare'].map((tag, i) => (
          <motion.span
            key={tag}
            className="px-4 py-2 rounded-full border border-white/15 text-white/50 font-body text-sm"
            animate={{ borderColor: ['rgba(255,255,255,0.15)', 'rgba(27,79,216,0.5)', 'rgba(255,255,255,0.15)'] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
          >
            {tag}
          </motion.span>
        ))}
      </motion.div>

      {/* URL */}
      <motion.p
        className="text-[var(--color-accent)] font-mono text-lg mt-10 tracking-wide"
        initial={{ opacity: 0 }}
        animate={phase >= 5 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.6 }}
      >
        docuplete.com
      </motion.p>
    </motion.div>
  );
}
