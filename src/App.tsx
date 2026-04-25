import { useEffect, useState } from 'react';
import { useTelegram } from './hooks/useTelegram';
import Dashboard from './components/Dashboard';
import WaitingRoom from './components/WaitingRoom';

// Production test schedule — set from your .env or a backend config fetch
const TEST_START_TIME = import.meta.env.VITE_TEST_START_TIME || '2026-05-05T09:00:00+05:00';

export default function App() {
  const { webApp, gender, colorScheme } = useTelegram();
  const [isTestLive, setIsTestLive] = useState(false);

  useEffect(() => {
    // Evaluate immediately on mount
    const checkTestStart = () => {
      const now = new Date().getTime();
      const start = new Date(TEST_START_TIME).getTime();
      setIsTestLive(now >= start);
    };
    checkTestStart();

    // Re-check every second for seamless transition from WaitingRoom -> Dashboard
    const interval = setInterval(checkTestStart, 1000);
    return () => clearInterval(interval);
  }, []);

  // Dynamic Theming Effect
  useEffect(() => {
    const root = document.documentElement;
    const isDark = colorScheme === 'dark';

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    if (gender === 'female') {
      root.style.setProperty('--primary-color', '#D946EF');
      root.style.setProperty('--primary-hover', '#C026D3');
      root.style.setProperty('--bg-color', isDark ? '#4A044E' : '#FDF4FF');
      root.style.setProperty('--card-bg', isDark ? '#701A75' : '#FFFFFF');
      root.style.setProperty('--text-main', isDark ? '#FAE8FF' : '#4A044E');
      root.style.setProperty('--text-muted', isDark ? '#F5D0FE' : '#86198F');
    } else {
      root.style.setProperty('--primary-color', '#3B82F6');
      root.style.setProperty('--primary-hover', '#2563EB');
      root.style.setProperty('--bg-color', isDark ? '#172554' : '#EFF6FF');
      root.style.setProperty('--card-bg', isDark ? '#1E3A8A' : '#FFFFFF');
      root.style.setProperty('--text-main', isDark ? '#DBEAFE' : '#172554');
      root.style.setProperty('--text-muted', isDark ? '#BFDBFE' : '#1E40AF');
    }

    if (webApp) {
      try {
        const bgColor = root.style.getPropertyValue('--bg-color');
        webApp.setHeaderColor(bgColor);
        webApp.setBackgroundColor(bgColor);
      } catch (error) {
        console.error("Failed to set native Telegram headers:", error);
      }
    }
  }, [gender, colorScheme, webApp]);

  return (
    <div
      className="min-h-screen w-full transition-colors duration-300 font-sans"
      style={{ backgroundColor: 'var(--bg-color)', color: 'var(--text-main)' }}
    >
      <div className="max-w-md mx-auto min-h-screen relative overflow-x-hidden shadow-2xl">
        {isTestLive ? (
          <Dashboard />
        ) : (
          <WaitingRoom
            startTime={TEST_START_TIME}
            onStart={() => setIsTestLive(true)}
          />
        )}
      </div>
    </div>
  );
}
