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
      className="absolute inset-0 flex items-center justify-center px-10"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '-100%', opacity: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex gap-10 items-start w-full max-w-5xl">

        <div className="flex-1">
          <motion.div
            className="flex items-center gap-4 mb-4"
            initial={{ opacity: 0, x: -20 }}
            animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
          >
            <img
              src={`${import.meta.env.BASE_URL}images/tom.png`}
              className="w-14 h-14 rounded-full object-cover border-2"
              style={{ borderColor: '#C49A38' }}
            />
            <div>
              <h3 className="text-2xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Tom</h3>
              <p className="text-white/50 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>Filling out one simple questionnaire</p>
            </div>
          </motion.div>

          <motion.div
            className="bg-white rounded-2xl p-4 shadow-2xl"
            initial={{ opacity: 0, y: 30 }}
            animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, type: 'spring', stiffness: 200, damping: 22 }}
          >
            <div className="border-b border-gray-100 pb-3 mb-3">
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: '#1B4FD8', fontFamily: "'JetBrains Mono', monospace" }}>Docuplete</div>
              <h4 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Client Questionnaire</h4>
              <p className="text-xs text-gray-400" style={{ fontFamily: "'DM Sans', sans-serif" }}>Please fill in your information below</p>
            </div>

            <div className="space-y-2">
              {FIELDS.map((field, i) => (
                <div key={field.label}>
                  <label className="block text-xs text-gray-400 mb-0.5 uppercase tracking-wide" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                    {field.label}
                  </label>
                  <motion.div
                    className="h-8 rounded-lg border-2 flex items-center px-3 relative overflow-hidden"
                    style={{
                      borderColor: typedField >= i ? field.color + '66' : '#E5E7EB',
                      backgroundColor: typedField >= i ? field.color + '08' : '#F9FAFB',
                    }}
                    animate={{ borderColor: typedField >= i ? field.color + '88' : '#E5E7EB' }}
                    transition={{ duration: 0.3 }}
                  >
                    {typedField >= i && (
                      <motion.span
                        className="text-sm"
                        style={{
                          color: field.color,
                          fontStyle: (field as any).italic ? 'italic' : 'normal',
                          fontWeight: 600,
                          fontFamily: "'DM Sans', sans-serif",
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
              className="mt-3 text-white text-center py-2 rounded-xl font-bold text-sm"
              style={{ backgroundColor: '#1B4FD8', fontFamily: "'Space Grotesk', sans-serif" }}
              initial={{ opacity: 0 }}
              animate={phase >= 4 ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              Submit
            </motion.div>
          </motion.div>
        </div>

        <div className="w-72 flex flex-col gap-4 pt-8">
          <motion.div
            className="rounded-2xl p-6 border"
            style={{ backgroundColor: '#1B4FD810', borderColor: '#1B4FD830' }}
            initial={{ opacity: 0, x: 30 }}
            animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="text-[3vw] font-black mb-1" style={{ color: '#1B4FD8', fontFamily: "'Space Grotesk', sans-serif" }}>1</div>
            <div className="text-white font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>Questionnaire</div>
            <div className="text-white/50 text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>That's all Tom has to fill out</div>
          </motion.div>

          <motion.div
            className="rounded-2xl p-6 border"
            style={{ backgroundColor: '#C49A3810', borderColor: '#C49A3830' }}
            initial={{ opacity: 0, x: 30 }}
            animate={phase >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 30 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="text-white/60 text-sm italic" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              "He doesn't need to know which forms he needs or what data goes where."
            </div>
            <div className="font-bold text-sm mt-2" style={{ color: '#C49A38', fontFamily: "'Space Grotesk', sans-serif" }}>— Sally</div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
