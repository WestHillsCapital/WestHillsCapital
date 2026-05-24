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
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, #1B4FD822, transparent)' }}
      />

      <div className="flex flex-col items-center w-full max-w-5xl">
        <motion.p
          className="text-sm uppercase tracking-[0.25em] mb-4"
          style={{ color: '#C49A38', fontFamily: "'JetBrains Mono', monospace" }}
          initial={{ opacity: 0, y: -10 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
        >
          The Solution
        </motion.p>

        <motion.h2
          className="text-[4vw] font-black text-white text-center leading-tight mb-4"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Sally creates a package,{' '}
          <span style={{ color: '#1B4FD8' }}>once.</span>
        </motion.h2>

        <motion.p
          className="text-white/50 text-xl mb-12 text-center"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          For each process, forever.
        </motion.p>

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
                className="absolute inset-0"
                style={{ transformOrigin: 'left', backgroundColor: '#1B4FD808' }}
                initial={{ scaleX: 0 }}
                animate={phase >= 3 ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.6, delay: i * 0.15 + 0.3 }}
              />
              <span className="text-4xl mb-4">{step.icon}</span>
              <h3 className="font-bold text-white text-lg mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{step.label}</h3>
              <p className="text-white/50 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>{step.sub}</p>
              <div className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#1B4FD830' }}>
                <span className="text-xs font-bold" style={{ color: '#1B4FD8', fontFamily: "'JetBrains Mono', monospace" }}>{i + 1}</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="flex items-center gap-6 bg-white/5 border border-white/10 rounded-2xl px-8 py-5"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          <img
            src={`${import.meta.env.BASE_URL}images/sally.png`}
            className="w-14 h-14 rounded-full object-cover border-2"
            style={{ borderColor: '#1B4FD8' }}
          />
          <div>
            <p className="text-white text-lg" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              <span className="font-bold" style={{ color: '#1B4FD8' }}>Sally</span> sets this up once —
            </p>
            <p className="text-white/60" style={{ fontFamily: "'DM Sans', sans-serif" }}>then every future client gets the same seamless experience.</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
