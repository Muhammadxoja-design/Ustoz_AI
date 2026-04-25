import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuizEngine } from '../hooks/useQuizEngine';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import DrawingCanvas from './DrawingCanvas';
import VoiceRecorder from './VoiceRecorder';
import QuizTimer from './QuizTimer';
import { QuizSkeleton } from './SkeletonLoader';

interface QuizProps {
  onComplete: () => void;
  onTestIdReceived?: (testId: string) => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export default function Quiz({ onComplete, onTestIdReceived }: QuizProps) {
  const {
    questions,
    currentQuestion,
    currentIndex,
    answers,
    timeLimit,
    startTime,
    isFetching,
    score,
    error,
    testId,
    selectOption: rawSelectOption,
    nextQuestion,
    prevQuestion,
    submitQuiz,
    handleTimeUp,
  } = useQuizEngine();

  const currentAnswer  = answers.find(a => a.questionId === currentQuestion?.id)?.selectedOption;
  const hasSelected    = !!currentAnswer;
  const isLastQuestion = currentIndex === (questions?.length || 0) - 1;

  const hapticFiredRef = useRef(false);
  useEffect(() => {
    if (score !== null && !hapticFiredRef.current) {
      hapticFiredRef.current = true;
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    }
  }, [score]);

  useEffect(() => {
    if (testId && onTestIdReceived) onTestIdReceived(testId);
  }, [testId, onTestIdReceived]);

  const selectOption = (optionId: string) => {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    rawSelectOption(optionId);
  };

  const submitQuizRef     = useRef(submitQuiz);
  submitQuizRef.current   = submitQuiz;
  const stableSubmit      = useCallback(() => submitQuizRef.current(), []);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    if (isLastQuestion && hasSelected) {
      webApp.MainButton.text = 'FINALIZE MISSION';
      webApp.MainButton.color = '#4F46E5';
      webApp.MainButton.show();
      webApp.MainButton.onClick(stableSubmit);
    } else {
      webApp.MainButton.hide();
      webApp.MainButton.offClick(stableSubmit);
    }
    return () => { webApp.MainButton.hide(); webApp.MainButton.offClick(stableSubmit); };
  }, [isLastQuestion, hasSelected, stableSubmit]);

  if (isFetching) return <QuizSkeleton />;

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="w-20 h-20 glass rounded-[2rem] flex items-center justify-center text-4xl border-rose-500/30">❌</div>
        <div>
          <h3 className="font-black text-xl text-white">Transmission Failure</h3>
          <p className="text-sm font-medium text-slate-400 mt-2">{error}</p>
        </div>
        <button onClick={onComplete} className="btn-secondary w-full max-w-xs">Return to Control</button>
      </div>
    );
  }

  if (score !== null) {
    const total  = questions.length;
    const pct    = total > 0 ? Math.round((score / (total * 10)) * 100) : 0;
    const userName = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 'Agent';

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col items-center px-6 pt-10"
      >
        <div className="glass-card w-full p-8 text-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 glass rounded-[2rem] flex items-center justify-center mb-6 border-indigo-500/30 shadow-indigo-500/20 floating">
              <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>

            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2">Protocol Decoded</h2>
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-8">Performance Report: {userName}</p>

            <div className="grid grid-cols-2 gap-4 w-full mb-8">
               <div className="glass p-4 rounded-3xl border-white/5">
                 <p className="text-2xl font-black text-white italic">{score}</p>
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Points</p>
               </div>
               <div className="glass p-4 rounded-3xl border-white/5">
                 <p className="text-2xl font-black text-indigo-400 italic">{pct}%</p>
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Accuracy</p>
               </div>
            </div>

            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Mission accomplished with {pct}% efficiency. Your data has been synchronized with the global leaderboard.
            </p>

            <button onClick={onComplete} className="btn-premium w-full">
              Confirm & Exit
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!questions.length || !currentQuestion) return null;

  const currentOptions = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];

  return (
    <div className="flex flex-col flex-1 px-6 pt-4 pb-32">
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sector Analysis</p>
          <h3 className="text-white font-black italic uppercase tracking-tighter">Phase {currentIndex + 1} of {questions.length}</h3>
        </div>
        <div className="flex gap-1.5">
          {questions.map((_, i) => (
            <motion.div
              key={i}
              animate={{ width: i === currentIndex ? 24 : 8, backgroundColor: i <= currentIndex ? '#6366F1' : 'rgba(255,255,255,0.05)' }}
              className="h-2 rounded-full transition-all duration-300"
            />
          ))}
        </div>
      </div>

      <QuizTimer timeLimit={timeLimit} startTime={startTime} onTimeUp={handleTimeUp} />

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0,  opacity: 1 }}
          exit   ={{ x: -30, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="flex-1 flex flex-col"
        >
          <div className="glass-card p-8 mb-6 border-indigo-500/20 relative group">
            <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12">
               <svg className="w-20 h-20 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
            </div>
            <div className="text-white font-bold text-xl leading-relaxed relative z-10">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {currentQuestion.content}
              </ReactMarkdown>
            </div>
          </div>

          {currentQuestion.mediaUrl && (
            <div className="mb-6 rounded-[2.5rem] overflow-hidden glass border-white/5 p-2">
              <div className="rounded-[2rem] overflow-hidden">
                {currentQuestion.mediaUrl.match(/\.(mp4|webm|ogg)$/i) ? (
                  <video src={currentQuestion.mediaUrl} controls className="w-full h-auto max-h-64 object-contain bg-black" />
                ) : currentQuestion.mediaUrl.match(/\.(mp3|wav|ogg)$/i) ? (
                  <audio src={currentQuestion.mediaUrl} controls className="w-full" />
                ) : (
                  <img src={currentQuestion.mediaUrl} alt="Media" className="w-full h-auto max-h-64 object-contain" />
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {(currentQuestion.type === 'RADIO' || currentQuestion.type === 'TRUE_FALSE') &&
              currentOptions.map((optionObj: any, idx: number) => {
                const isSelected = currentAnswer === optionObj.id;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => selectOption(optionObj.id)}
                    className={`answer-option group ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="option-letter">{OPTION_LABELS[idx] || idx + 1}</div>
                    <div className="flex-1 font-bold text-slate-300 group-hover:text-white transition-colors">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {optionObj.text}
                      </ReactMarkdown>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                      </div>
                    )}
                  </motion.div>
                );
              })}

            {currentQuestion.type === 'TEXT' && (
              <input
                type="text"
                value={currentAnswer || ''}
                onChange={e => selectOption(e.target.value)}
                placeholder="Enter response code…"
                className="input-futuristic py-6 px-8 text-xl italic"
              />
            )}

            {currentQuestion.type === 'RANGE' && (
              <div className="glass-card p-10 flex flex-col items-center gap-6">
                <p className="text-6xl font-black text-indigo-400 italic tracking-tighter">{currentAnswer || 0}</p>
                <input
                  type="range" min="0" max="100"
                  value={currentAnswer || 0}
                  onChange={e => selectOption(e.target.value)}
                  className="w-full h-2 rounded-full appearance-none bg-white/5 accent-indigo-500 cursor-pointer"
                />
              </div>
            )}
            
            {/* DRAWING */}
            {currentQuestion.type === 'DRAWING' && (
              <div className="glass p-4 rounded-3xl relative">
                <DrawingCanvas onSave={url => selectOption(url)} />
                {currentAnswer && (
                  <div className="absolute inset-0 rounded-[2rem] flex flex-col items-center justify-center gap-3 backdrop-blur-md bg-slate-950/60 z-20">
                    <div className="text-4xl">✅</div>
                    <p className="font-bold text-white uppercase tracking-widest text-[10px]">Canvas Captured</p>
                    <button onClick={() => selectOption('')} className="btn-secondary text-[10px] px-6 py-2">Resynchronize</button>
                  </div>
                )}
              </div>
            )}

            {/* VOICE */}
            {currentQuestion.type === 'VOICE' && (
              <div className="glass p-6 rounded-3xl relative">
                <VoiceRecorder onSave={url => selectOption(url)} />
                {currentAnswer && (
                  <div className="absolute inset-0 rounded-[2rem] flex flex-col items-center justify-center gap-3 backdrop-blur-md bg-slate-950/60 z-20">
                    <div className="text-4xl">✅</div>
                    <p className="font-bold text-white uppercase tracking-widest text-[10px]">Frequency Logged</p>
                    <button onClick={() => selectOption('')} className="btn-secondary text-[10px] px-6 py-2">Rerecord</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-10 flex gap-4">
            {currentIndex > 0 && (
              <button onClick={prevQuestion} className="btn-secondary flex-1">
                Back
              </button>
            )}
            {!isLastQuestion && (
              <button
                onClick={nextQuestion}
                disabled={!hasSelected}
                className="btn-premium flex-[2]"
              >
                Proceed Phase
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
