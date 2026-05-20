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
        <svg width="64" height="64" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 4h18l6 6v22H6V4z" fill="white" opacity="0.15" />
          <path d="M24 4l6 6h-6V4z" fill="#C49A38" />
          <rect x="10" y="14" width="10" height="1.5" rx="0.75" fill="white" opacity="0.5" />
          <rect x="10" y="18" width="14" height="1.5" rx="0.75" fill="white" opacity="0.5" />
          <rect x="10" y="22" width="8" height="1.5" rx="0.75" fill="white" opacity="0.5" />
          <circle cx="26" cy="28" r="5" fill="#C49A38" />
          <path d="M23.5 28l2 2 3.5-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
