import { useState, useEffect, useRef } from 'react';
import type { GameRow } from '../types';

export function useSyncedTimer(gameState: GameRow | null): number {
  const [timeLeft, setTimeLeft] = useState(() => gameState?.timer_remaining ?? 0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!gameState) {
      setTimeLeft(0);
      return;
    }

    if (gameState.timer_state === 'running' && gameState.timer_started_at) {
      const startTime = new Date(gameState.timer_started_at).getTime();
      const baseRemaining = gameState.timer_remaining;

      const tick = () => {
        const elapsed = (Date.now() - startTime) / 1000;
        const remaining = Math.max(0, baseRemaining - elapsed);
        const ceiled = Math.ceil(remaining);
        setTimeLeft(ceiled);

        if (ceiled > 0) {
          // Schedule next tick exactly when the next whole second boundary hits
          const fractional = remaining - Math.floor(remaining);
          const delay = fractional > 0.01 ? fractional * 1000 : 1000;
          timerRef.current = window.setTimeout(tick, delay);
        }
      };

      tick();
    } else {
      setTimeLeft(gameState.timer_remaining);
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState?.timer_state, gameState?.timer_remaining, gameState?.timer_started_at]);

  return timeLeft;
}
