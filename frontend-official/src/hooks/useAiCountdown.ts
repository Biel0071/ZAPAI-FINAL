import { useState, useEffect } from 'react';
import { differenceInSeconds } from 'date-fns';

export function useAiCountdown(reactivateAt: string | null | undefined) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [isWaiting, setIsWaiting] = useState(false);

  useEffect(() => {
    if (!reactivateAt) {
      setTimeLeft(null);
      setIsWaiting(false);
      return;
    }

    const targetDate = new Date(reactivateAt);

    const updateTimer = () => {
      const now = new Date();
      const diff = differenceInSeconds(targetDate, now);

      if (diff <= 0) {
        setTimeLeft(null);
        setIsWaiting(false);
        return;
      }

      setIsWaiting(true);
      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;
      
      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);
      
      setTimeLeft(parts.join(' '));
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [reactivateAt]);

  return { timeLeft, isWaiting };
}
