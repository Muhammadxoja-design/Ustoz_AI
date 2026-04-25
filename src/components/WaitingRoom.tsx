import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface WaitingRoomProps {
  startTime: string; // ISO string
  onStart?: () => void;
}

export default function WaitingRoom({ startTime, onStart }: WaitingRoomProps) {
  const [timeLeft, setTimeLeft] = useState<Countdown | null>(null);

  useEffect(() => {
    const targetDate = new Date(startTime).getTime();

    const calculateTime = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference <= 0) {
        setTimeLeft(null);
        if (onStart) onStart();
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60),
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [startTime, onStart]);

  if (!timeLeft) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center bg-[var(--bg-color)]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-10 rounded-[32px] shadow-2xl border border-black/5 bg-[var(--card-bg)]"
      >
        <div className="w-20 h-20 mx-auto mb-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center animate-pulse">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="text-3xl font-black mb-2" style={{ color: 'var(--text-main)' }}>Get Ready!</h1>
        <p className="text-sm font-bold mb-10 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          The Test Begins In
        </p>

        <div className="grid grid-cols-4 gap-3 mb-10">
          {[
            { label: 'Days', value: timeLeft.days },
            { label: 'Hrs', value: timeLeft.hours },
            { label: 'Min', value: timeLeft.minutes },
            { label: 'Sec', value: timeLeft.seconds },
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-black/5 flex items-center justify-center text-2xl font-black shadow-inner" style={{ color: 'var(--primary-color)' }}>
                {item.value.toString().padStart(2, '0')}
              </div>
              <span className="text-[10px] font-black uppercase mt-2 tracking-tighter" style={{ color: 'var(--text-muted)' }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>

        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold leading-relaxed">
           Stay on this page. The test will automatically launch the moment the countdown reaches zero.
        </div>
      </motion.div>

      <div className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        Ustoz AI Secure Testing Protocol V9.6
      </div>
    </div>
  );
}
