import { useState, useEffect, useRef } from 'react';
import type { GameRow } from '../types';

export function useSyncedTimer(gameState: GameRow | null): number {
  const [timeLeft, setTimeLeft] = useState(() => gameState?.timer_remaining ?? 0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!gameState) {
      setTimeLeft(0);
      return;
    }

    if (gameState.timer_state === 'running' && gameState.timer_started_at) {
      const compute = () => {
        const elapsed = (Date.now() - new Date(gameState.timer_started_at!).getTime()) / 1000;
        const remaining = Math.max(0, Math.ceil(gameState.timer_remaining - elapsed));
        setTimeLeft(remaining);
      };
      compute();
      intervalRef.current = window.setInterval(compute, 200);
    } else {
      setTimeLeft(gameState.timer_remaining);
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [gameState?.timer_state, gameState?.timer_remaining, gameState?.timer_started_at]);

  return timeLeft;
}
