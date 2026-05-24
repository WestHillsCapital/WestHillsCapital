import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const ERRORS = [
  { text: 'Wrong date format', x: '12%', y: '20%', delay: 0.3 },
  { text: 'Missing field', x: '65%', y: '15%', delay: 0.6 },
  { text: 'Incorrect beneficiary', x: '30%', y: '55%', delay: 0.9 },
  { text: 'Unsigned page 3', x: '72%', y: '50%', delay: 1.1 },
  { text: 'Data mismatch', x: '8%', y: '68%', delay: 1.4 },
  { text: 'Duplicate entry', x: '55%', y: '75%', delay: 1.7 },
];

const DOC_POSITIONS = [
  { x: '5%', y: '10%', rotate: -12, scale: 0.85 },
  { x: '20%', y: '5%', rotate: 5, scale: 0.9 },
  { x: '38%', y: '8%', rotate: -3, scale: 0.88 },
  { x: '55%', y: '12%', rotate: 8, scale: 0.92 },
  { x: '72%', y: '6%', rotate: -7, scale: 0.87 },
  { x: '85%', y: '10%', rotate: 4, scale: 0.9 },
];

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 2500),
      setTimeout(() => setPhase(4), 5000),
      setTimeout(() => setPhase(5), 8000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ scale: 1.08, opacity: 0, filter: 'blur(12px)' }}
      transition={{ duration: 0.6 }}
    >
      <video
        src={`${import.meta.env.BASE_URL}videos/bg-chaos.mp4`}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-20"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#0B1220]/70 via-[#0B1220]/40 to-[#0B1220]/80" />

      {DOC_POSITIONS.map((pos, i) => (
        <motion.div
          key={i}
          className="absolute w-24 h-32 bg-white/10 rounded-lg border border-white/20 backdrop-blur-sm"
          style={{ left: pos.x, top: pos.y, rotate: pos.rotate }}
          initial={{ y: -120, opacity: 0 }}
          animate={phase >= 1 ? { y: 0, opacity: 1, scale: pos.scale } : { y: -120, opacity: 0 }}
          transition={{ duration: 0.5, delay: i * 0.1, type: 'spring', stiffness: 200, damping: 18 }}
        >
          <div className="p-2 space-y-1.5">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="h-1.5 rounded-full bg-white/20" style={{ width: `${60 + j * 8}%` }} />
            ))}
          </div>
        </motion.div>
      ))}

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={phase >= 2 ? { scale: 1, opacity: 1 } : { scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 250, damping: 20 }}
          className="text-center mb-8"
        >
          <h2 className="text-[5vw] font-black text-white leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            High chance of
          </h2>
          <h2 className="text-[5vw] font-black leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#EF4444' }}>
            mistakes.
          </h2>
        </motion.div>

        <div className="relative w-full h-48">
          {ERRORS.map((err, i) => (
            <motion.div
              key={err.text}
              className="absolute bg-red-500/90 text-white text-xs px-3 py-1.5 rounded-full border border-red-400/60 shadow-lg"
              style={{ left: err.x, top: err.y, fontFamily: "'JetBrains Mono', monospace" }}
              initial={{ scale: 0, opacity: 0 }}
              animate={phase >= 3
                ? { scale: 1, opacity: 1, y: [0, -4, 0] }
                : { scale: 0, opacity: 0 }}
              transition={{
                scale: { delay: err.delay, type: 'spring', stiffness: 400, damping: 20 },
                opacity: { delay: err.delay, duration: 0.3 },
                y: { duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: err.delay + 0.5 },
              }}
            >
              ✗ {err.text}
            </motion.div>
          ))}
        </div>
      </div>

      <motion.div
        className="absolute bottom-16 right-20 bg-white/10 border border-white/20 backdrop-blur-md rounded-3xl px-6 py-4 max-w-xs"
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={phase >= 4 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
      >
        <p className="text-white/80 text-sm italic" style={{ fontFamily: "'DM Sans', sans-serif" }}>
          "Which document needs my signature again? And what format was the date?"
        </p>
        <p className="font-bold text-right mt-2" style={{ color: '#C49A38', fontFamily: "'Space Grotesk', sans-serif" }}>— Tom</p>
      </motion.div>
    </motion.div>
  );
}
