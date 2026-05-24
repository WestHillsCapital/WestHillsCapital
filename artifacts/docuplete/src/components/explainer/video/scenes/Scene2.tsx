import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const DOCS = [
  { label: 'Account Application', color: '#1B4FD8' },
  { label: 'Suitability Form', color: '#C49A38' },
  { label: 'Risk Profile', color: '#EF4444' },
  { label: 'Beneficiary Designation', color: '#10B981' },
  { label: 'Transfer Auth', color: '#8B5CF6' },
  { label: 'Compliance Disclosure', color: '#F59E0B' },
];

const STATS = [
  { value: '6', label: 'Documents' },
  { value: '8', label: 'Pages' },
  { value: '50+', label: 'Fields' },
  { value: '7', label: 'Data types' },
];

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 3000),
      setTimeout(() => setPhase(4), 5500),
      setTimeout(() => setPhase(5), 7500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-16"
      initial={{ clipPath: 'inset(0 100% 0 0)' }}
      animate={{ clipPath: 'inset(0 0% 0 0)' }}
      exit={{ clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.p
        className="text-sm uppercase tracking-[0.25em] mb-6"
        style={{ color: '#C49A38', fontFamily: "'JetBrains Mono', monospace" }}
        initial={{ opacity: 0, y: -10 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
        transition={{ duration: 0.4 }}
      >
        The Problem
      </motion.p>

      <motion.h2
        className="text-[4.5vw] font-black text-white leading-tight text-center mb-10"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        initial={{ opacity: 0, y: 30 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        Sally needs Tom to fill out<br />
        <span style={{ color: '#1B4FD8' }}>complex paperwork.</span>
      </motion.h2>

      <div className="grid grid-cols-3 gap-4 mb-10 w-full max-w-4xl">
        {DOCS.map((doc, i) => (
          <motion.div
            key={doc.label}
            className="rounded-xl border bg-white/5 backdrop-blur-sm p-4 flex items-center gap-3"
            style={{ borderColor: doc.color + '44' }}
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.85, y: 20 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
          >
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: doc.color }} />
            <span className="text-sm text-white/80 leading-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>{doc.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="flex gap-8">
        {STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <div className="text-[3.5vw] font-black" style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#C49A38' }}>{stat.value}</div>
            <div className="text-sm text-white/50 uppercase tracking-wider" style={{ fontFamily: "'DM Sans', sans-serif" }}>{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-10 bg-red-500/10 border border-red-500/30 rounded-2xl px-8 py-4 max-w-2xl text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-white/80 text-lg" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          Sally has to <span className="text-red-400 font-semibold">train Tom</span> on every document,
          every field, every format.
        </p>
      </motion.div>
    </motion.div>
  );
}
