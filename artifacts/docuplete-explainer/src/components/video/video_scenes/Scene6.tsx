import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const DOCS = [
  { name: 'Account Application', page: 1, color: '#1B4FD8', filled: ['First name: Thomas', 'Last name: Mitchell', 'DOB: 03/15/1978'] },
  { name: 'Suitability Form', page: 1, color: '#C49A38', filled: ['Risk: Moderate', 'Goal: Retirement', 'Signed: ✓'] },
  { name: 'Beneficiary Designation', page: 1, color: '#10B981', filled: ['Primary: Mitchell, Jane', 'Relationship: Spouse'] },
];

export function Scene6() {
  const [phase, setPhase] = useState(0);
  const [fillStep, setFillStep] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => { setPhase(3); setFillStep(1); }, 2200),
      setTimeout(() => setFillStep(2), 4000),
      setTimeout(() => setFillStep(3), 5800),
      setTimeout(() => setPhase(4), 7000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-12"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
      transition={{ duration: 0.6 }}
    >
      <motion.h2
        className="text-[3.5vw] font-display font-black text-white text-center leading-tight mb-3"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        Docuplete{' '}
        <span className="text-[var(--color-primary)]">auto-fills</span>
        {' '}every document.
      </motion.h2>

      <motion.p
        className="text-white/50 font-body text-lg mb-10 text-center"
        initial={{ opacity: 0 }}
        animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        All 6 documents. All 50+ fields. In seconds.
      </motion.p>

      {/* Animated document fill */}
      <div className="flex gap-6 w-full max-w-5xl">
        {DOCS.map((doc, i) => (
          <motion.div
            key={doc.name}
            className="flex-1 bg-white rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, y: 40, rotateY: -15 }}
            animate={phase >= 2 ? { opacity: 1, y: 0, rotateY: 0 } : { opacity: 0, y: 40, rotateY: -15 }}
            transition={{ duration: 0.6, delay: i * 0.15, type: 'spring', stiffness: 180, damping: 22 }}
            style={{ perspective: 1000 }}
          >
            {/* Doc header */}
            <div className="px-5 pt-5 pb-3 border-b border-gray-100">
              <div
                className="w-3 h-3 rounded-full mb-2"
                style={{ backgroundColor: doc.color }}
              />
              <h4 className="text-sm font-display font-bold text-gray-800 leading-tight">{doc.name}</h4>
              <p className="text-xs text-gray-400 font-body">Page {doc.page}</p>
            </div>

            {/* Doc lines being filled */}
            <div className="p-5 space-y-3">
              {doc.filled.map((line, j) => (
                <div key={line}>
                  <div className="text-xs text-gray-400 font-body mb-1">{line.split(':')[0]}</div>
                  <motion.div
                    className="h-8 rounded border flex items-center px-3"
                    style={{
                      borderColor: fillStep > i ? doc.color + '55' : '#E5E7EB',
                      backgroundColor: fillStep > i ? doc.color + '08' : '#F9FAFB',
                    }}
                    animate={{ borderColor: fillStep > i ? doc.color + '88' : '#E5E7EB' }}
                    transition={{ duration: 0.3, delay: j * 0.1 }}
                  >
                    {fillStep > i && (
                      <motion.span
                        className="text-xs font-body font-semibold"
                        style={{ color: doc.color }}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: j * 0.08 }}
                      >
                        {line.includes(':') ? line.split(': ')[1] : line}
                      </motion.span>
                    )}
                  </motion.div>
                </div>
              ))}

              {/* Fill indicator */}
              <motion.div
                className="mt-2 h-1.5 rounded-full overflow-hidden bg-gray-100"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: doc.color }}
                  animate={{ width: fillStep > i ? '100%' : '0%' }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Progress callout */}
      <motion.div
        className="mt-8 flex items-center gap-4 bg-green-500/10 border border-green-500/30 rounded-2xl px-8 py-4"
        initial={{ opacity: 0, y: 20 }}
        animate={phase >= 4 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          ✓
        </motion.div>
        <p className="text-white font-body text-lg">
          <span className="text-green-400 font-semibold">All documents populated</span> from Tom's single submission
        </p>
      </motion.div>
    </motion.div>
  );
}
