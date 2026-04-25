import { useState, useEffect, useCallback, useRef } from 'react';

// Matches the exact structure returned by the backend (Prisma schema)
export type QuestionOption = {
  id: string;  // 'A', 'B', 'C', 'D'
  text: string;
};

export type Question = {
  id: string;
  content: string;
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

  const [timeLeft, setTimeLeft] = useState(0);
  const [isFetching, setIsFetching] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use a ref for answers inside the timer closure to avoid stale state bugs
  const answersRef = useRef<Answer[]>([]);
  answersRef.current = answers;

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
        setTimeLeft(data.timeLimit || 300);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsFetching(false);
      }
    }
    fetchQuestions();
  }, []);

  // 2. Strict Client-Side Timer — uses ref to safely auto-submit without stale closure
  useEffect(() => {
    if (isFetching || isSubmitting || score !== null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Use ref to access latest answers in this closure
          submitQuiz(answersRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 3. Submit — sends testId alongside answers
  const submitQuiz = useCallback(async (currentAnswers: Answer[] = answersRef.current) => {
    if (!testId) {
      setError("Quiz session invalid. Please restart.");
      return;
    }
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
  }, [testId]);

  return {
    questions,
    currentIndex,
    currentQuestion: questions[currentIndex],
    answers,
    timeLeft,
    isFetching,
    isSubmitting,
    score,
    error,
    selectOption,
    nextQuestion,
    prevQuestion,
    submitQuiz
  };
}
