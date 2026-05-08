import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const FIELDS = [
  { label: 'First name', value: 'Thomas', color: '#1B4FD8' },
  { label: 'Last name', value: 'Mitchell', color: '#C49A38' },
  { label: 'Date of birth', value: '03 / 15 / 1978', color: '#10B981' },
  { label: 'Risk tolerance', value: 'Moderate', color: '#8B5CF6' },
  { label: 'Investment goal', value: 'Retirement', color: '#F59E0B' },
  { label: 'Signature', value: 'Thomas Mitchell', color: '#1B4FD8', italic: true },
];

export function Scene5() {
  const [phase, setPhase] = useState(0);
  const [typedField, setTypedField] = useState<number>(-1);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => { setPhase(3); setTypedField(0); }, 2500),
      setTimeout(() => setTypedField(1), 3400),
      setTimeout(() => setTypedField(2), 4200),
      setTimeout(() => setTypedField(3), 4900),
      setTimeout(() => setTypedField(4), 5600),
      setTimeout(() => setTypedField(5), 6400),
      setTimeout(() => setPhase(4), 7500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center px-16"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex gap-16 items-start w-full max-w-5xl">

        {/* Left: Tom filling form */}
        <div className="flex-1">
          <motion.div
            className="flex items-center gap-4 mb-8"
            initial={{ opacity: 0, x: -20 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
          >
            <img
              src={`${import.meta.env.BASE_URL}images/tom.png`}
              className="w-14 h-14 rounded-full object-cover border-2 border-[var(--color-accent)]"
            />
            <div>
              <h3 className="text-2xl font-display font-bold text-white">Tom</h3>
              <p className="text-white/50 font-body text-sm">Filling out one simple questionnaire</p>
            </div>
          </motion.div>

          {/* Form card */}
          <motion.div
            className="bg-white rounded-2xl p-6 shadow-2xl"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 22 }}
          >
            <div className="border-b border-gray-100 pb-4 mb-5">
              <div className="text-xs font-mono text-[var(--color-primary)] uppercase tracking-widest mb-1">Docuplete</div>
              <h4 className="text-lg font-display font-bold text-gray-900">Client Questionnaire</h4>
              <p className="text-xs text-gray-400 font-body">Please fill in your information below</p>
            </div>

            <div className="space-y-4">
              {FIELDS.map((field, i) => (
                <div key={field.label}>
                  <label className="block text-xs font-body text-gray-400 mb-1 uppercase tracking-wide">
                    {field.label}
                  </label>
                  <motion.div
                    className="h-10 rounded-lg border-2 flex items-center px-3 relative overflow-hidden"
                    style={{
                      borderColor: typedField >= i ? field.color + '66' : '#E5E7EB',
                      backgroundColor: typedField >= i ? field.color + '08' : '#F9FAFB',
                    }}
                    animate={{
                      borderColor: typedField >= i ? field.color + '88' : '#E5E7EB',
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {typedField >= i && (
                      <motion.span
                        className="text-sm font-body"
                        style={{
                          color: field.color,
                          fontStyle: field.italic ? 'italic' : 'normal',
                          fontWeight: 600,
                        }}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        {field.value}
                      </motion.span>
                    )}
                    {typedField === i - 1 && (
                      <motion.div
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gray-400"
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                  </motion.div>
                </div>
              ))}
            </div>

            <motion.div
              className="mt-5 bg-[var(--color-primary)] text-white text-center py-3 rounded-xl font-display font-bold text-sm"
              initial={{ opacity: 0 }}
              animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              Submit
            </motion.div>
          </motion.div>
        </div>

        {/* Right: callout */}
        <div className="w-72 flex flex-col gap-6 pt-20">
          <motion.div
            className="bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 rounded-2xl p-6"
            initial={{ opacity: 0, x: 30 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="text-[3vw] font-display font-black text-[var(--color-primary)] mb-1">1</div>
            <div className="text-white font-body font-semibold">Questionnaire</div>
            <div className="text-white/50 font-body text-sm">That's all Tom has to fill out</div>
          </motion.div>

          <motion.div
            className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 rounded-2xl p-6"
            initial={{ opacity: 0, x: 30 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="text-white/60 font-body text-sm italic">
              "He doesn't need to know which forms he needs or what data goes where."
            </div>
            <div className="text-[var(--color-accent)] font-display font-bold text-sm mt-2">— Sally</div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
