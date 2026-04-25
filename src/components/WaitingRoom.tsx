import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';

interface Countdown { days: number; hours: number; minutes: number; seconds: number; }
interface WaitingRoomProps {
  startTime: string;
  testTitle?: string;
  testSubject?: string;
  onStart?: () => void;
}

export default function WaitingRoom({ startTime, testTitle, testSubject, onStart }: WaitingRoomProps) {
  const [timeLeft, setTimeLeft] = useState<Countdown | null>(null);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  useEffect(() => {
    const target = new Date(startTime).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft(null); onStartRef.current?.(); return; }
      setTimeLeft({
        days:    Math.floor(diff / 864e5),
        hours:   Math.floor((diff / 36e5) % 24),
        minutes: Math.floor((diff / 6e4) % 60),
        seconds: Math.floor((diff / 1e3) % 60),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);

  if (!timeLeft) return null;

  const pad = (n: number) => String(n).padStart(2, '0');
  const units = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hrs',  value: timeLeft.hours },
    { label: 'Min',  value: timeLeft.minutes },
    { label: 'Sec',  value: timeLeft.seconds },
  ];

  return (
    <div className="min-h-screen flex flex-col p-6 pt-20 bg-slate-950 relative overflow-hidden">
      <div className="mesh-bg opacity-30" />
      <div className="anime-bg-container">
        <img src="/wallpaper.png" className="anime-bg-image" alt="Background" />
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" />
      </div>
      
      <div className="flex-1 flex flex-col items-center text-center relative z-10">
        <motion.div
          animate={{ scale: [1, 1.05, 1], rotate: [0, 2, 0, -2, 0] }}
          transition={{ repeat: Infinity, duration: 5 }}
          className="icon-3d mb-12 floating scale-125"
        >
          <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
          <svg className="w-20 h-20 text-indigo-400 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </motion.div>

        <h1 className="hero-text mb-2 italic">Syncing Protocol</h1>
        <p className="text-slate-400 font-medium leading-relaxed max-w-xs mb-10 text-xs">
          The exam gateway will open upon target synchronization. Please maintain secure connection.
        </p>

        {testTitle && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 w-full mb-10 border-indigo-500/20 bg-indigo-500/5 shadow-indigo-500/10"
          >
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2 italic">Authorized Mission</p>
            <h2 className="text-white font-black text-2xl italic uppercase tracking-tighter">{testTitle}</h2>
            {testSubject && <p className="text-slate-500 text-[10px] font-black mt-2 uppercase tracking-[0.2em]">{testSubject}</p>}
          </motion.div>
        )}

        <div className="grid grid-cols-4 gap-4 w-full mb-12">
          {units.map((u, i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="glass aspect-square rounded-3xl flex items-center justify-center font-black text-3xl text-white border-white/10 shadow-2xl italic tracking-tighter shadow-black/40">
                {pad(u.value)}
              </div>
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 italic">
                {u.label}
              </span>
            </div>
          ))}
        </div>

        <div className="glass-card p-6 w-full border-white/5 bg-white/5">
          <div className="flex items-center gap-4 justify-center text-slate-500">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,1)]" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] italic">Awaiting Terminal Uplink…</p>
          </div>
        </div>
      </div>

      <div className="pb-10 flex justify-center relative z-10">
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-700 italic">
          BrainStorm AI • Control Shell v4.0
        </p>
      </div>
    </div>
  );
}
