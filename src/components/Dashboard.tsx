import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelegram } from '../hooks/useTelegram';
import { useAntiCheat } from '../hooks/useAntiCheat';
import Quiz from './Quiz';
import Leaderboard from './Leaderboard';

type ActiveTab = 'home' | 'quiz' | 'leaderboard';

interface UserStats {
  totalScore: number;
  testsCompleted: number;
  rank: number | null;
}

const Icon3D = ({ children, color = 'indigo' }: { children: React.ReactNode, color?: string }) => (
  <div className="icon-3d group relative">
    <div className={`absolute inset-0 bg-${color}-500/20 blur-xl rounded-full scale-110 group-hover:scale-150 transition-transform duration-500`} />
    <div className="relative transform transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
      {children}
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useTelegram();
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');
  const [testId, setTestId] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats>({ totalScore: 0, testsCompleted: 0, rank: null });

  const { violations } = useAntiCheat(activeTab === 'quiz', testId);

  useEffect(() => {
    async function fetchStats() {
      try {
        const initData = window.Telegram?.WebApp?.initData;
        if (!initData) return;
        const res = await fetch('/api/v1/quiz/leaderboard/overall', {
          headers: { 'Authorization': `Bearer ${initData}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
        if (!userId) return;
        const myEntry = data.leaderboard?.find((e: any) => e.userId === userId.toString());
        const myRank  = data.leaderboard?.findIndex((e: any) => e.userId === userId.toString());
        if (myEntry) {
          setStats({ totalScore: myEntry.totalScore || 0, testsCompleted: 1, rank: myRank >= 0 ? myRank + 1 : null });
        }
      } catch (err) {
        console.error('Stats fetch failed:', err);
      }
    }
    if (activeTab === 'home') fetchStats();
  }, [activeTab]);

  const firstName = user?.first_name || 'Explorer';

  const categories = [
    { icon: <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.628.251a2 2 0 01-1.068.077l-2.828-.471a2 2 0 00-1.226.188l-1.414.707a2 2 0 01-1.068.077L2 15.111l2.428 2.428a2 2 0 002.828 0l1.414-1.414a2 2 0 011.414 0l1.414 1.414a2 2 0 002.828 0l1.414-1.414a2 2 0 011.414 0l1.414 1.414a2 2 0 002.828 0l2.428-2.428-1.226-1.226z"/></svg>, label: 'Science' },
    { icon: <svg className="w-8 h-8 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>, label: 'Logic' },
    { icon: <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 002 2h1.5a3.5 3.5 0 013.5 3.5V17m-11-3h.01M16 11h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>, label: 'Geography' },
    { icon: <svg className="w-8 h-8 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>, label: 'History' },
  ];

  const pageTransition = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -20 },
    transition: { type: 'spring', damping: 25, stiffness: 120 }
  };

  return (
    <div className="flex flex-col min-h-dvh pb-32">
      {/* Header Area */}
      <div className="px-6 pt-12 pb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 glass rounded-[2rem] flex items-center justify-center border-white/20 shadow-indigo-500/20 overflow-hidden relative group">
              <img src="/wallpaper.png" className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-700" alt="Avatar" />
              <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/40 to-transparent" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 border-4 border-slate-950 rounded-full" />
          </div>
          <div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] italic">Operator Linked</p>
            <h1 className="text-white font-black text-2xl tracking-tighter leading-none mt-1 uppercase italic">{firstName}</h1>
          </div>
        </div>
        <div className="glass px-4 py-2 rounded-2xl border-indigo-500/30 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,1)]" />
          <span className="text-white font-black tracking-tighter text-sm italic">{stats.totalScore} XP</span>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'home' && (
          <motion.div key="home" {...pageTransition} className="px-6 space-y-8">
            
            {/* Mission Card */}
            <motion.section 
              whileHover={{ y: -5, scale: 1.02 }}
              className="glass-card p-1 relative overflow-hidden group border-white/5"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 transition-transform duration-700 group-hover:scale-125 group-hover:rotate-6">
                <svg className="w-32 h-32 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L1 21h22L12 2zm0 3.45l8.27 14.3H3.73L12 5.45zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
              </div>
              <div className="p-8 space-y-8 relative z-10">
                <div className="space-y-1">
                  <h2 className="text-white font-black text-3xl uppercase italic tracking-tighter">Current Protocol</h2>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">Status: Authorized for Initialization</p>
                </div>

                <div className="flex items-center gap-8">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
                    <Icon3D color="indigo">
                      <div className="w-24 h-24 glass rounded-[2.5rem] flex items-center justify-center text-5xl shadow-2xl border-white/10 relative z-10 group-hover:border-indigo-500/40 transition-colors">
                        🛰️
                      </div>
                    </Icon3D>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex justify-between items-end">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 italic">Sync Progress</p>
                      <p className="text-sm font-black text-indigo-400 italic">{Math.min(100, (stats.testsCompleted / 5) * 100)}%</p>
                    </div>
                    <div className="timer-track h-2.5 bg-white/5 p-[2px]">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (stats.testsCompleted / 5) * 100)}%` }}
                        transition={{ type: 'spring', damping: 20, stiffness: 50 }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                      />
                    </div>
                    <p className="text-[9px] font-bold text-slate-600 italic uppercase tracking-widest">Sector Identified: #{stats.rank || 0}</p>
                  </div>
                </div>

                <button onClick={() => setActiveTab('quiz')} className="btn-premium w-full py-5 text-base shadow-indigo-500/40 border-t border-white/10">
                  <span className="relative z-10">Initialize Terminal</span>
                  <svg className="w-6 h-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </button>
              </div>
            </motion.section>

            {/* Topics */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white/50 text-[10px] font-black uppercase tracking-[0.3em]">Data Channels</h2>
                <div className="h-[1px] flex-1 mx-4 bg-white/5" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {categories.map((c, i) => (
                  <motion.button 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    key={c.label} 
                    onClick={() => setActiveTab('quiz')}
                    className="flex flex-col items-center gap-3 group"
                  >
                    <div className="w-16 h-16 glass rounded-2xl flex items-center justify-center border-white/5 group-hover:border-indigo-500/50 transition-colors shadow-inner group-hover:shadow-indigo-500/10">
                      {c.icon}
                    </div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-white transition-colors">{c.label}</span>
                  </motion.button>
                ))}
              </div>
            </section>

            {/* Quick Stats */}
            <section className="grid grid-cols-2 gap-4">
               <div className="glass-card p-6 border-white/5 flex flex-col gap-4">
                 <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                 </div>
                 <div>
                   <p className="text-2xl font-black text-white italic">{stats.testsCompleted}</p>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Logs Processed</p>
                 </div>
               </div>
               <div className="glass-card p-6 border-white/5 flex flex-col gap-4">
                 <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
                 </div>
                 <div>
                   <p className="text-2xl font-black text-white italic">#{stats.rank || '—'}</p>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Global Sector Rank</p>
                 </div>
               </div>
            </section>

            {violations > 0 && (
              <div className="glass-card border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-4 slide-up">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-500 text-xl">⚠️</div>
                <div>
                  <p className="text-xs font-black text-rose-400 uppercase tracking-widest">Security Alert</p>
                  <p className="text-[10px] font-bold text-rose-500/70">Protocol Violation Detected: {violations} flags</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'quiz' && (
          <motion.div key="quiz" {...pageTransition} className="flex-1 flex flex-col">
            <Quiz onComplete={() => setActiveTab('home')} onTestIdReceived={(id) => setTestId(id)} />
          </motion.div>
        )}

        {activeTab === 'leaderboard' && (
          <motion.div key="leaderboard" {...pageTransition} className="flex-1 flex flex-col px-6">
            <Leaderboard />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <div className="fixed bottom-8 left-6 right-6 z-50">
        <nav className="glass rounded-[3rem] p-2.5 flex justify-between items-center shadow-2xl shadow-black/50 border-white/5 backdrop-blur-[40px]">
          {[
            { key: 'home', label: 'Terminal', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"/></svg> },
            { key: 'quiz', label: 'Mission', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> },
            { key: 'leaderboard', label: 'Status', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg> },
          ].map(n => (
            <button 
              key={n.key} 
              onClick={() => setActiveTab(n.key as ActiveTab)}
              className={`flex items-center gap-3 px-8 py-4 rounded-[2.5rem] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] relative ${activeTab === n.key ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {activeTab === n.key && (
                <motion.div 
                  layoutId="nav-bg"
                  className="absolute inset-0 bg-indigo-500 rounded-[2.5rem] shadow-lg shadow-indigo-500/40"
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                />
              )}
              <span className="relative z-10">{n.icon}</span>
              {activeTab === n.key && <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="relative z-10 text-[10px] font-black uppercase tracking-[0.2em]">{n.label}</motion.span>}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
