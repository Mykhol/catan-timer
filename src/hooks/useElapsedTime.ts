import { useState, useEffect } from 'react';

export function useElapsedTime(startedAt: string | null | undefined): string | null {
  const [elapsed, setElapsed] = useState<string | null>(null);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(null);
      return;
    }

    const start = new Date(startedAt).getTime();

    const update = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(
        h > 0
          ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          : `${m}:${s.toString().padStart(2, '0')}`
      );
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}
