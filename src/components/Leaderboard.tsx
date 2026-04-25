import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface LeaderboardEntry {
  userId: string;
  fullName: string;
  region: string;
  status: string;
  totalScore: number;
  fastestTimeMs: number | null;
  prizeRank?: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  winners: LeaderboardEntry[];
}

export default function Leaderboard() {
  const [data, setData]         = useState<LeaderboardData | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const initData = window.Telegram?.WebApp?.initData;
      const res = await fetch('/api/v1/quiz/leaderboard/overall', {
        headers: { 'Authorization': `Bearer ${initData || ''}` }
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to load leaderboard');
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaderboard(); }, []);

  const currentUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 pt-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-[72px] rounded-[18px]" style={{ animationDelay: `${i * 0.08}s` }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="text-5xl">😕</span>
        <p className="font-black text-lg" style={{ color: 'var(--text-head)' }}>Failed to load</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button onClick={fetchLeaderboard} className="btn-primary px-6 py-3 text-sm">Retry</button>
      </div>
    );
  }

  if (!data || !data.leaderboard.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <span className="text-5xl">🏆</span>
        <p className="font-black text-lg" style={{ color: 'var(--text-head)' }}>Hali natijalar yo'q</p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Test tugatilgandan keyin natijalar bu yerda ko'rinadi.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-4">
      {/* Top 3 podium */}
      {data.winners.length > 0 && (
        <div className="glass-card p-8 border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12">
            <svg className="w-24 h-24 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-6 italic">Elite Personnel synchronized</p>
          <div className="flex flex-col gap-4 relative z-10">
            {data.winners.slice(0, 3).map((w, i) => (
              <div key={w.userId} className="flex items-center gap-5">
                <div className={`w-12 h-12 rounded-2xl glass flex items-center justify-center text-xl border-white/10 ${i === 0 ? 'shadow-indigo-500/40 text-indigo-400' : 'text-slate-400'}`}>
                   {i === 0 ? '1' : i === 1 ? '2' : '3'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black text-sm uppercase italic tracking-tight truncate">{w.fullName}</p>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{w.region}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-white italic tracking-tighter">{w.totalScore}</p>
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Efficiency</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rows */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white/50 text-[10px] font-black uppercase tracking-[0.3em]">Full Registry</h3>
          <button onClick={fetchLeaderboard} className="text-[9px] font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors">
            Resync Feed 🔄
          </button>
        </div>

        {data.leaderboard.map((entry, idx) => {
          const isMe = currentUserId && entry.userId === currentUserId;
          return (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`glass-card p-5 flex items-center gap-5 border-white/5 group hover:border-indigo-500/30 transition-all ${isMe ? 'bg-indigo-500/10 border-indigo-500/30' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl glass flex items-center justify-center font-black text-xs italic border-white/5 group-hover:border-indigo-500/50 ${isMe ? 'bg-indigo-500 text-white' : 'text-slate-500'}`}>
                #{idx + 1}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate uppercase tracking-tight">
                  {entry.fullName} {isMe && <span className="text-indigo-400 text-[10px] italic ml-1">(IDENTIFIED)</span>}
                </p>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  {entry.region}
                </p>
              </div>

              <div className="text-right">
                <p className={`font-black text-lg italic tracking-tighter ${isMe ? 'text-indigo-400' : 'text-white'}`}>
                  {entry.totalScore}
                </p>
                {entry.fastestTimeMs && (
                  <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                    {Math.round(entry.fastestTimeMs / 1000)}s Latency
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
