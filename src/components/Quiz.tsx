import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuizEngine } from '../hooks/useQuizEngine';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

export default function Quiz({ onComplete }: { onComplete: () => void }) {
  const {
    questions,
    currentQuestion,
    currentIndex,
    answers,
    timeLeft,
    isFetching,
    isSubmitting,
    score,
    error,
    selectOption: rawSelectOption,
    nextQuestion,
    prevQuestion,
    submitQuiz
  } = useQuizEngine();

  const totalTime = 300; 
  const progressPercentage = (timeLeft / totalTime) * 100;
  const isTimeCritical = timeLeft < 60; 

  const currentAnswer = answers.find(a => a.questionId === currentQuestion?.id)?.selectedOption;
  const hasSelected = !!currentAnswer;
  const isLastQuestion = currentIndex === (questions?.length || 0) - 1;

  // Intercept selection to trigger native Haptic Feedback
  const selectOption = (optionId: string) => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    rawSelectOption(optionId);
  };

  // Native Telegram MainButton integration for the final submit
  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;

    if (isLastQuestion && hasSelected) {
      webApp.MainButton.text = "FINISH QUIZ";
      // Adjust color to match your Tech Blue theme natively
      webApp.MainButton.color = "#2563EB";
      webApp.MainButton.show();
      webApp.MainButton.onClick(submitQuiz);
    } else {
      webApp.MainButton.hide();
      webApp.MainButton.offClick(submitQuiz);
    }

    return () => {
      webApp.MainButton.hide();
      webApp.MainButton.offClick(submitQuiz);
    };
  }, [isLastQuestion, hasSelected, submitQuiz]);

  if (isFetching) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-14 h-14 border-4 rounded-full border-t-[var(--primary-color)] border-r-transparent border-b-transparent border-l-transparent"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center min-h-screen flex flex-col items-center justify-center">
        <div className="text-red-500 font-bold text-2xl mb-4">API Error</div>
        <p className="text-lg font-medium mb-8" style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button 
          onClick={onComplete}
          className="w-full max-w-xs py-4 rounded-2xl font-bold shadow-lg"
          style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (score !== null) {
    // Trigger success haptic
    if (window.Telegram?.WebApp?.HapticFeedback) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
    }

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center min-h-screen p-6 text-center select-none"
      >
        <div className="w-28 h-28 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-8 shadow-inner border border-green-200">
          <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-4xl font-black mb-3" style={{ color: 'var(--text-main)' }}>Quiz Completed!</h2>
        <p className="text-xl font-medium mb-10" style={{ color: 'var(--text-muted)' }}>
          You scored <span className="font-black text-2xl" style={{ color: 'var(--primary-color)' }}>{score} Points</span>
        </p>
        <button
          onClick={onComplete}
          className="w-full max-w-sm py-5 rounded-2xl font-bold text-lg shadow-xl"
          style={{ backgroundColor: 'var(--primary-color)', color: 'white' }}
        >
          Return to Dashboard
        </button>
      </motion.div>
    );
  }

  if (!questions.length || !currentQuestion) return null;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Helper to safely parse Json options array from Prisma
  const currentOptions = Array.isArray(currentQuestion.options) ? currentQuestion.options : [];

  return (
    <div className="flex flex-col min-h-screen p-5 select-none touch-manipulation">
      <div className="flex items-center justify-between mb-5 pt-2">
        <span className="font-bold text-xs tracking-widest uppercase" style={{ color: 'var(--text-muted)' }}>
          Question {currentIndex + 1} of {questions.length}
        </span>
        
        <motion.div 
          animate={isTimeCritical ? { scale: [1, 1.08, 1], color: ['#ef4444', '#dc2626', '#ef4444'] } : {}}
          transition={{ repeat: isTimeCritical ? Infinity : 0, duration: 1 }}
          className={`px-4 py-1.5 rounded-full font-bold text-sm border-2 ${
            isTimeCritical ? 'border-red-500 text-red-600 bg-red-50 dark:bg-red-900/30' : 'border-transparent'
          }`}
          style={{ 
            backgroundColor: isTimeCritical ? undefined : 'var(--card-bg)',
            color: isTimeCritical ? undefined : 'var(--text-main)' 
          }}
        >
          ⏱ {formatTime(timeLeft)}
        </motion.div>
      </div>

      <div className="w-full h-2 rounded-full mb-8 overflow-hidden bg-black/10 dark:bg-white/10">
        <motion.div 
          className="h-full rounded-full"
          style={{ backgroundColor: isTimeCritical ? '#ef4444' : 'var(--primary-color)' }}
          initial={{ width: '100%' }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ ease: "linear", duration: 1 }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -30, opacity: 0 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 25 }}
          className="flex-1 flex flex-col"
        >
          <div className="text-2xl md:text-3xl font-bold mb-8 leading-snug break-words" style={{ color: 'var(--text-main)' }}>
            <ReactMarkdown 
              remarkPlugins={[remarkMath]} 
              rehypePlugins={[rehypeKatex]}
            >
              {currentQuestion.content}
            </ReactMarkdown>
          </div>

          <div className="flex flex-col gap-4">
            {currentOptions.map((optionObj: any, idx) => {
              const isSelected = currentAnswer === optionObj.id;
              return (
                <motion.button
                  key={idx}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => selectOption(optionObj.id)}
                  className={`p-5 rounded-2xl border-2 text-left transition-all duration-200 flex items-center justify-between ${
                    isSelected 
                      ? 'border-[var(--primary-color)] shadow-md' 
                      : 'border-black/5 dark:border-white/5 shadow-sm active:bg-black/5 dark:active:bg-white/5'
                  }`}
                  style={{
                    backgroundColor: isSelected ? 'var(--primary-color)' : 'var(--card-bg)',
                    color: isSelected ? 'white' : 'var(--text-main)'
                  }}
                >
                  <div className="font-semibold text-[17px] leading-snug pr-4 pointer-events-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {optionObj.text}
                    </ReactMarkdown>
                  </div>
                  
                  {isSelected && (
                    <svg className="w-7 h-7 text-white flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex gap-4 pb-6">
        {currentIndex > 0 && (
          <button
            onClick={prevQuestion}
            className="flex-1 py-4 rounded-2xl font-bold text-lg shadow-sm active:scale-95 transition-transform"
            style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-main)' }}
          >
            Back
          </button>
        )}
        
        {isLastQuestion ? (
          <button
            onClick={() => submitQuiz()}
            disabled={!hasSelected || isSubmitting}
            className="flex-[2] py-4 rounded-2xl font-bold text-lg text-white shadow-xl transition-all disabled:opacity-40 disabled:shadow-none active:scale-95 disabled:active:scale-100 hidden md:block"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            {isSubmitting ? 'Evaluating...' : 'Finish Quiz'}
          </button>
        ) : (
          <button
            onClick={nextQuestion}
            disabled={!hasSelected}
            className="flex-[2] py-4 rounded-2xl font-bold text-lg text-white shadow-xl transition-all disabled:opacity-40 disabled:shadow-none active:scale-95 disabled:active:scale-100"
            style={{ backgroundColor: 'var(--primary-color)' }}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
