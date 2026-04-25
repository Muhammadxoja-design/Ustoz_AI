import { useState, useEffect, useCallback, useRef } from 'react';

// Matches the exact structure returned by the backend (Prisma schema)
export type QuestionOption = {
  id: string;  // 'A', 'B', 'C', 'D'
  text: string;
};

export type Question = {
  id: string;
  type: string;
  content: string;
  mediaUrl: string | null;
  options: QuestionOption[];
};

export type Answer = {
  questionId: string;
  selectedOption: string; // The option ID: 'A', 'B', 'C', or 'D'
};

export function useQuizEngine() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [testId, setTestId] = useState<string | null>(null); // Must be persisted to send on submit

  const [timeLimit, setTimeLimit] = useState(0); // Static limit in seconds
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use a ref for answers inside the timer closure to avoid stale state bugs
  const answersRef = useRef<Answer[]>([]);
  answersRef.current = answers;

  // Track whether auto-submit has been triggered to prevent double submissions
  const autoSubmittedRef = useRef(false);

  // 1. Fetch Questions securely
  useEffect(() => {
    async function fetchQuestions() {
      try {
        const res = await fetch('/api/v1/quiz/questions', {
          headers: {
            'Authorization': `Bearer ${window.Telegram?.WebApp?.initData}`
          }
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || 'Failed to load quiz');

        setTestId(data.testId);
        setQuestions(data.questions);
        const limit = data.timeLimit || 300;
        setTimeLimit(limit);
        setStartTime(Date.now());
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsFetching(false);
      }
    }
    fetchQuestions();
  }, []);

  // Removed internal timer state to stop Quiz.tsx from re-rendering every second.
  // Timer is now managed by an external QuizTimer component.

  const handleTimeUp = useCallback(() => {
    if (!isFetching && !isSubmitting && score === null && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      submitQuiz(answersRef.current);
    }
  }, [isFetching, isSubmitting, score]);

  const selectOption = (optionId: string) => {
    if (!questions[currentIndex]) return;
    setAnswers(prev => {
      const filtered = prev.filter(a => a.questionId !== questions[currentIndex].id);
      return [...filtered, { questionId: questions[currentIndex].id, selectedOption: optionId }];
    });
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const prevQuestion = () => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  // 4. Submit — sends testId alongside answers
  const submitQuiz = useCallback(async (currentAnswers: Answer[] = answersRef.current) => {
    if (!testId) {
      setError("Quiz session invalid. Please restart.");
      return;
    }
    if (isSubmitting) return; // Guard against double submission
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${window.Telegram?.WebApp?.initData}`
        },
        body: JSON.stringify({ testId, answers: currentAnswers })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit quiz');

      setScore(data.score);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [testId, isSubmitting]);

  return {
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex],
    answers,
    timeLimit,
    startTime,
    isFetching,
    isSubmitting,
    score,
    error,
    testId,
    selectOption,
    nextQuestion,
    prevQuestion,
    submitQuiz,
    handleTimeUp
  };
}
