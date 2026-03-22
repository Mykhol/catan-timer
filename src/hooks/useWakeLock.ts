import { useEffect, useRef } from 'react';

/** Request a screen wake lock to prevent the display from sleeping */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    async function request() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Wake lock denied or not supported
      }
    }

    request();

    // Re-acquire on visibility change (e.g. user switches back to tab)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        request();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
    };
  }, []);
}
