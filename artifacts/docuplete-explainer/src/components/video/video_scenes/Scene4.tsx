import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const STEPS = [
  { icon: '📁', label: 'Upload documents', sub: 'All 6 forms in one place' },
  { icon: '🔗', label: 'Map the fields', sub: 'Tag each data point once' },
  { icon: '📋', label: 'Create questionnaire', sub: 'One form for everything' },
];

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
      setTimeout(() => setPhase(4), 5500),
      setTimeout(() => setPhase(5), 8000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center px-16"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ clipPath: 'circle(0% at 50% 50%)' }}
      transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Glowing background accent */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, #1B4FD822, transparent)',
        }}
      />

      <div className="flex flex-col items-center w-full max-w-5xl">
        <motion.p
          className="text-[var(--color-accent)] text-sm font-mono uppercase tracking-[0.25em] mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
        >
          The Solution
        </motion.p>

        <motion.h2
          className="text-[4vw] font-display font-black text-white text-center leading-tight mb-4"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Sally creates a{' '}
          <span className="text-[var(--color-primary)]">Docuplete package.</span>
        </motion.h2>

        <motion.p
          className="text-white/50 font-body text-xl mb-12 text-center"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          Once. For every client, forever.
        </motion.p>

        {/* Steps */}
        <div className="flex gap-6 w-full mb-12">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.label}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center relative overflow-hidden"
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={phase >= 3 ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 40, scale: 0.9 }}
              transition={{ duration: 0.5, delay: i * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
            >
              <motion.div
                className="absolute inset-0 bg-[var(--color-primary)]/5"
                initial={{ scaleX: 0 }}
                animate={phase >= 3 ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.6, delay: i * 0.15 + 0.3 }}
                style={{ transformOrigin: 'left' }}
              />
              <span className="text-4xl mb-4">{step.icon}</span>
              <h3 className="font-display font-bold text-white text-lg mb-2">{step.label}</h3>
              <p className="text-white/50 font-body text-sm">{step.sub}</p>

              {/* Step number */}
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[var(--color-primary)]/30 flex items-center justify-center">
                <span className="text-xs font-mono text-[var(--color-primary)] font-bold">{i + 1}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sally avatar + action */}
        <motion.div
          className="flex items-center gap-6 bg-white/5 border border-white/10 rounded-2xl px-8 py-5"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          <img
            src={`${import.meta.env.BASE_URL}images/sally.png`}
            className="w-14 h-14 rounded-full object-cover border-2 border-[var(--color-primary)]"
          />
          <div>
            <p className="text-white font-body text-lg">
              <span className="font-bold text-[var(--color-primary)]">Sally</span> sets this up once —
            </p>
            <p className="text-white/60 font-body">then every future client gets the same seamless experience.</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
