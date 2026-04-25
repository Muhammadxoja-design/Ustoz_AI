import { useEffect, useState } from 'react';

export function useAntiCheat(isActiveTest: boolean, testId: string | null) {
  const [violations, setViolations] = useState(0);

  useEffect(() => {
    if (!isActiveTest || !testId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setViolations((prev) => prev + 1);

        // Dispatch penalty to the correct backend endpoint
        fetch('/api/v1/quiz/penalty', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.Telegram?.WebApp?.initData}`
          },
          body: JSON.stringify({
            testId,
            reason: 'TAB_SWITCHED',
            timestamp: new Date().toISOString()
          })
        }).catch(err => console.error("Anti-Cheat network failure:", err));
      }
    };

    const handleBlur = () => {
      if (!document.hidden) handleVisibilityChange();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [isActiveTest, testId]);

  return { violations };
}
