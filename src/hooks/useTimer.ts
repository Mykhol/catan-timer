import { useState, useRef, useCallback, useEffect } from 'react';

interface UseTimerReturn {
  timeLeft: number;
  isRunning: boolean;
  isPaused: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: (newTime?: number) => void;
}

export function useTimer(
  initialTime: number,
  onTick?: (timeLeft: number) => void,
  onComplete?: () => void
): UseTimerReturn {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timeLeftRef = useRef(initialTime);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    clearTimer();
    setIsRunning(true);
    setIsPaused(false);
    intervalRef.current = window.setInterval(() => {
      timeLeftRef.current -= 1;
      const newTime = timeLeftRef.current;
      setTimeLeft(newTime);
      onTick?.(newTime);
      if (newTime <= 0) {
        clearTimer();
        setIsRunning(false);
        onComplete?.();
      }
    }, 1000);
  }, [clearTimer, onTick, onComplete]);

  const pause = useCallback(() => {
    clearTimer();
    setIsPaused(true);
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (!isPaused) return;
    setIsPaused(false);
    intervalRef.current = window.setInterval(() => {
      timeLeftRef.current -= 1;
      const newTime = timeLeftRef.current;
      setTimeLeft(newTime);
      onTick?.(newTime);
      if (newTime <= 0) {
        clearTimer();
        setIsRunning(false);
        onComplete?.();
      }
    }, 1000);
  }, [isPaused, clearTimer, onTick, onComplete]);

  const reset = useCallback((newTime?: number) => {
    clearTimer();
    const t = newTime ?? initialTime;
    timeLeftRef.current = t;
    setTimeLeft(t);
    setIsRunning(false);
    setIsPaused(false);
  }, [clearTimer, initialTime]);

  useEffect(() => {
    return clearTimer;
  }, [clearTimer]);

  return { timeLeft, isRunning, isPaused, start, pause, resume, reset };
}
