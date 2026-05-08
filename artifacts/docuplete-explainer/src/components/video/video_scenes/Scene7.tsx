import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const BENEFITS = [
  { icon: '✓', text: 'Accurate — no manual re-entry', color: '#10B981' },
  { icon: '✓', text: 'Complete — all 6 documents', color: '#10B981' },
  { icon: '✓', text: 'Signed — e-signature included', color: '#10B981' },
  { icon: '✓', text: 'Timestamped & sealed', color: '#10B981' },
];

export function Scene7() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2800),
      setTimeout(() => setPhase(4), 5000),
      setTimeout(() => setPhase(5), 7500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center px-16"
      initial={{ clipPath: 'inset(100% 0 0 0)' }}
      animate={{ clipPath: 'inset(0% 0 0 0)' }}
      exit={{ clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 50% 50% at 50% 50%, #10B98115, transparent)',
        }}
      />

      <div className="flex gap-16 items-center w-full max-w-5xl">

        {/* Left: sealed PDF visual */}
        <motion.div
          className="w-64 shrink-0"
          initial={{ opacity: 0, scale: 0.8, rotate: -8 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.8, rotate: -8 }}
          transition={{ duration: 0.7, type: 'spring', stiffness: 200, damping: 22 }}
        >
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden relative">
            {/* PDF header */}
            <div className="bg-[var(--color-primary)] px-5 py-4">
              <div className="text-white font-display font-bold text-sm">Client Document Package</div>
              <div className="text-white/60 font-body text-xs">Thomas Mitchell · 6 documents</div>
            </div>
            <div className="p-5 space-y-3">
              {['Account Application', 'Suitability Form', 'Risk Profile', 'Beneficiary Designation', 'Transfer Auth', 'Compliance Disclosure'].map((name, i) => (
                <motion.div
                  key={name}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
                  transition={{ delay: i * 0.08 + 0.2 }}
                >
                  <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-bold shrink-0">✓</div>
                  <span className="text-xs font-body text-gray-600">{name}</span>
                </motion.div>
              ))}
            </div>

            {/* Seal stamp */}
            <motion.div
              className="absolute -top-4 -right-4 w-20 h-20 rounded-full border-4 border-green-500 bg-white/95 flex flex-col items-center justify-center shadow-lg"
              initial={{ scale: 0, rotate: -30 }}
              animate={phase >= 3 ? { scale: 1, rotate: 12 } : { scale: 0, rotate: -30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.3 }}
            >
              <span className="text-green-500 font-display font-black text-xs leading-none">SEALED</span>
              <span className="text-green-400 font-mono text-[8px] mt-0.5">PDF</span>
            </motion.div>
          </div>
        </motion.div>

        {/* Right: benefits */}
        <div className="flex-1">
          <motion.h2
            className="text-[3.5vw] font-display font-black text-white leading-tight mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            Documents done.<br />
            <span className="text-green-400">Accurate. Complete. Sealed.</span>
          </motion.h2>

          <div className="space-y-4 mb-8">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={b.text}
                className="flex items-center gap-4"
                initial={{ opacity: 0, x: 30 }}
                animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
              >
                <div className="w-8 h-8 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center text-green-400 font-bold text-sm shrink-0">
                  {b.icon}
                </div>
                <span className="text-white/80 font-body text-lg">{b.text}</span>
              </motion.div>
            ))}
          </div>

          {/* Sally + Tom reunion */}
          <motion.div
            className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5"
            initial={{ opacity: 0, y: 20 }}
            animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            <img src={`${import.meta.env.BASE_URL}images/sally.png`} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--color-primary)]" />
            <img src={`${import.meta.env.BASE_URL}images/tom.png`} className="w-12 h-12 rounded-full object-cover border-2 border-[var(--color-accent)] -ml-4" />
            <p className="text-white/70 font-body text-sm ml-2">
              Sally gets compliant paperwork. Tom gets a frictionless experience.
              <span className="text-white font-semibold"> Everyone wins.</span>
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
