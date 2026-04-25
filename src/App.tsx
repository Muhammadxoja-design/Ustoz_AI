import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTelegram } from './hooks/useTelegram';
import Dashboard from './components/Dashboard';
import WaitingRoom from './components/WaitingRoom';
import AdminPanel from './components/AdminPanel';

interface ActiveTestInfo {
  status: 'active' | 'upcoming' | 'none';
  test: {
    id: string;
    title: string;
    subject: string;
    description: string | null;
    startDate: string;
    endDate: string;
    timeLimitMs: number;
    _count: { questions: number };
  } | null;
}

export default function App() {
  const { webApp, gender, colorScheme } = useTelegram();
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [testInfo, setTestInfo] = useState<ActiveTestInfo | null>(null);
  const [isTestLive, setIsTestLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if we're on the admin route
  const isAdminRoute = window.location.hash === '#/admin' || window.location.pathname === '/admin';

  // Auth and Test Check
  useEffect(() => {
    if (isAdminRoute) {
      setIsLoading(false);
      setIsRegistered(true);
      return;
    }

    const initData = window.Telegram?.WebApp?.initData;

    const checkAuthAndTest = async () => {
      try {
        // 1. Check Registration
        if (initData) {
          const authRes = await fetch('/api/v1/quiz/me', {
            headers: { 'Authorization': `Bearer ${initData}` }
          });
          if (authRes.ok) {
            const authData = await authRes.json();
            setIsRegistered(authData.registered);
          } else {
            setIsRegistered(false);
          }
        } else {
          // If no initData, we might be in a browser or admin testing
          // Let's assume unregistered for safety if not admin
          setIsRegistered(false);
        }

        // 2. Fetch Test Info
        const res = await fetch('/api/v1/quiz/active-test');
        const data: ActiveTestInfo = await res.json();
        setTestInfo(data);

        if (data.status === 'active') {
          setIsTestLive(true);
        } else if (data.status === 'upcoming') {
          setIsTestLive(false);
        } else {
          setIsTestLive(false);
        }
      } catch (error) {
        console.error('Initialization failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndTest();
  }, [isAdminRoute]);

  // Dynamic Theming Effect
  useEffect(() => {
    const root = document.documentElement;
    const tgScheme = colorScheme; // 'dark' | 'light'

    // Apply dark class based on Telegram theme
    if (tgScheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (isAdminRoute) {
      return;
    }

    // For female users: switch to pink/rose accent, keeping purple backbone
    if (gender === 'female') {
      root.style.setProperty('--purple-mid',   '#C026D3');
      root.style.setProperty('--purple-deep',  '#86198F');
      root.style.setProperty('--purple-light', '#F0ABFC');
      root.style.setProperty('--purple-pale',  '#FDF4FF');
    } else {
      root.style.removeProperty('--purple-mid');
      root.style.removeProperty('--purple-deep');
      root.style.removeProperty('--purple-light');
      root.style.removeProperty('--purple-pale');
    }

    if (webApp) {
      try {
        const bg = tgScheme === 'dark' ? '#13111C' : '#F5F3FF';
        webApp.setHeaderColor(bg);
        webApp.setBackgroundColor(bg);
      } catch (error) {
        console.error('Failed to set native Telegram headers:', error);
      }
    }
  }, [gender, colorScheme, webApp, isAdminRoute]);

  // Admin Panel Route
  if (isAdminRoute) {
    return <AdminPanel />;
  }

  return (
    <div className="min-h-screen text-slate-200 selection:bg-indigo-500/30">
      <div className="mesh-bg" />
      <div className="anime-bg-container">
        <img src="/wallpaper.png" className="anime-bg-image" alt="Background" />
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />
      </div>

      <div className="relative z-10">
        {isLoading ? (
          <div className="h-screen flex flex-col items-center justify-center p-6 bg-slate-950">
             <div className="mesh-bg opacity-50" />
             <motion.div 
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               className="glass-card p-12 flex flex-col items-center gap-10 border-white/5 shadow-indigo-500/20"
             >
                <div className="relative">
                   <div className="w-24 h-24 border-4 border-white/5 rounded-full" />
                   <motion.div 
                     animate={{ rotate: 360 }}
                     transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                     className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full"
                   />
                   <div className="absolute inset-0 flex items-center justify-center text-3xl">🛸</div>
                </div>
                <div className="text-center space-y-3">
                   <h1 className="hero-text text-4xl italic">Initializing</h1>
                   <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Establishing Secure Uplink…</p>
                </div>
             </motion.div>
          </div>
        ) : isRegistered === false ? (
          <div className="h-screen flex flex-col items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card p-12 max-w-sm w-full text-center border-rose-500/20 shadow-rose-500/10"
            >
              <div className="w-20 h-20 glass mx-auto mb-8 rounded-[2rem] flex items-center justify-center text-4xl border-rose-500/30 text-rose-500 shadow-2xl">🚫</div>
              <h2 className="hero-text text-3xl mb-4 italic text-rose-500">Access Denied</h2>
              <p className="text-slate-400 text-xs font-medium leading-relaxed mb-10">
                Your biological signature is not registered in our database. You must initialize your profile via the Telegram Bot first.
              </p>
              <a 
                href="https://t.me/UstozAIBot"
                className="btn-premium w-full py-5 text-sm font-black uppercase tracking-widest bg-rose-600 shadow-rose-600/40"
              >
                Return to Bot 🛰️
              </a>
            </motion.div>
          </div>
        ) : !isTestLive && testInfo?.status !== 'upcoming' ? (
          <div className="h-screen flex flex-col items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-12 max-w-sm w-full text-center border-white/5"
            >
              <div className="w-20 h-20 glass mx-auto mb-8 rounded-3xl flex items-center justify-center text-4xl shadow-indigo-500/20">📡</div>
              <h2 className="hero-text text-2xl mb-4 italic">No Link</h2>
              <p className="text-slate-400 text-xs font-medium leading-relaxed mb-8">
                The secure testing protocol is currently offline. Awaiting administrator broadcast.
              </p>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  animate={{ x: [-100, 100] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="w-1/2 h-full bg-indigo-500/50"
                />
              </div>
            </motion.div>
          </div>
        ) : isTestLive ? (
          <Dashboard />
        ) : (
          <WaitingRoom
            startTime={testInfo?.test?.startDate || ''}
            testTitle={testInfo?.test?.title || ''}
            testSubject={testInfo?.test?.subject || ''}
            onStart={() => setIsTestLive(true)}
          />
        )}
      </div>
    </div>
  );
}
