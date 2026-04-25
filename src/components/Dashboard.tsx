import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelegram } from '../hooks/useTelegram';
import { useAntiCheat } from '../hooks/useAntiCheat';

export default function Dashboard() {
  const { user } = useTelegram();
  const [activeTab, setActiveTab] = useState<'home' | 'quiz'>('home');
  
  // The strict anti-cheat is only initialized and active when taking a quiz.
  const { violations } = useAntiCheat(activeTab === 'quiz', null);

  // Framer Motion Animation Variants for GPU acceleration
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.4, staggerChildren: 0.1 }
    },
    exit: { opacity: 0, y: -20, transition: { duration: 0.2 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex flex-col min-h-screen p-5">
      {/* Dynamic Header */}
      <motion.div 
        className="flex items-center justify-between mb-8 pt-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[var(--primary-color)] to-[var(--primary-hover)] flex items-center justify-center text-white text-xl font-bold shadow-lg">
            {user?.first_name?.charAt(0) || 'U'}
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-main)' }}>
              Hello, {user?.first_name || 'Student'}! 👋
            </h1>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Ready to learn today?
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {activeTab === 'home' ? (
          <motion.div
            key="home"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-1 flex flex-col gap-5"
          >
            {/* Stats Card */}
            <motion.div variants={itemVariants} className="p-5 rounded-3xl shadow-sm border border-black/5" style={{ backgroundColor: 'var(--card-bg)' }}>
              <h2 className="text-lg font-semibold mb-4">Your Progress</h2>
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <p className="text-3xl font-black" style={{ color: 'var(--primary-color)' }}>12</p>
                  <p className="text-xs uppercase tracking-wider mt-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Quizzes</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-black" style={{ color: 'var(--primary-color)' }}>85%</p>
                  <p className="text-xs uppercase tracking-wider mt-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Score</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-black" style={{ color: 'var(--primary-color)' }}>#4</p>
                  <p className="text-xs uppercase tracking-wider mt-1 font-semibold" style={{ color: 'var(--text-muted)' }}>Rank</p>
                </div>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mt-2">
              <motion.button 
                variants={itemVariants}
                whileTap={{ scale: 0.93 }}
                onClick={() => setActiveTab('quiz')}
                className="py-10 px-4 rounded-3xl flex flex-col items-center justify-center gap-3 shadow-md"
                style={{ backgroundColor: 'var(--primary-color)', color: '#ffffff' }}
              >
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                <span className="font-bold text-lg">Daily Quiz</span>
              </motion.button>
              
              <motion.button 
                variants={itemVariants}
                whileTap={{ scale: 0.93 }}
                className="py-10 px-4 rounded-3xl flex flex-col items-center justify-center gap-3 shadow-sm border-2"
                style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--primary-color)' }}
              >
                <svg className="w-10 h-10" style={{ color: 'var(--primary-color)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                <span className="font-bold text-lg" style={{ color: 'var(--text-main)' }}>Leaderboard</span>
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="quiz"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex-1 flex flex-col items-center justify-center"
          >
            <div className="w-full p-8 rounded-3xl text-center shadow-2xl border border-black/5" style={{ backgroundColor: 'var(--card-bg)' }}>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center animate-pulse" style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}>
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </div>
              <h2 className="text-3xl font-black mb-3">Quiz Active</h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Anti-cheat protocol is armed. <br/> Do not switch tabs, use split-screen, or minimize the app!
              </p>
              
              {violations > 0 && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-6 p-4 rounded-2xl bg-red-100 text-red-700 text-sm font-bold border-2 border-red-300 shadow-inner"
                >
                  ⚠️ Security Penalty Recorded: {violations}
                </motion.div>
              )}

              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setActiveTab('home')}
                className="w-full py-5 rounded-2xl font-bold text-lg shadow-lg"
                style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
              >
                End Quiz
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
