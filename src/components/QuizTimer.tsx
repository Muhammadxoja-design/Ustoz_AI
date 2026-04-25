import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface QuizTimerProps {
  timeLimit: number;   // seconds
  startTime: number | null; // ms timestamp
  onTimeUp: () => void;
}

export default function QuizTimer({ timeLimit, startTime, onTimeUp }: QuizTimerProps) {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const onTimeUpRef = useRef(onTimeUp);
  useEffect(() => { onTimeUpRef.current = onTimeUp; }, [onTimeUp]);

  useEffect(() => {
    if (!startTime || timeLimit <= 0) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, timeLimit - Math.floor((Date.now() - startTime) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) { clearInterval(id); onTimeUpRef.current(); }
    }, 1000);
    return () => clearInterval(id);
  }, [startTime, timeLimit]);

  const fmt  = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const pct  = timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 100;
  const crit = timeLeft > 0 && timeLeft < 60;

  return (
    <div className="flex items-center gap-3 mb-5">
      {/* Time label */}
      <motion.div
        animate={crit ? { scale: [1, 1.06, 1] } : {}}
        transition={{ repeat: crit ? Infinity : 0, duration: 0.9 }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm flex-shrink-0"
        style={{
          background: crit ? '#FEF2F2' : 'var(--surface-2)',
          color:      crit ? '#DC2626'  : 'var(--purple-mid)',
          border:     crit ? '1.5px solid #FECACA' : '1.5px solid var(--border)',
        }}
      >
        {crit ? '⚠️' : '⏱'} {fmt(timeLeft)}
      </motion.div>

      {/* Progress bar */}
      <div className="timer-track flex-1">
        <motion.div
          className="timer-fill"
          initial={{ width: '100%' }}
          animate={{ width: `${pct}%`, backgroundColor: crit ? '#EF4444' : '#F97316' }}
          transition={{ ease: 'linear', duration: 1 }}
        />
      </div>
    </div>
  );
}
