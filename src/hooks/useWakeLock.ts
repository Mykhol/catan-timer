import { useEffect, useRef } from 'react';

/** Keep screen awake — uses Wake Lock API where supported,
 *  falls back to a silent audio loop for iOS Safari */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let useAudioFallback = false;

    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          return;
        }
      } catch {
        // Failed or not supported
      }
      // Fallback for iOS Safari
      useAudioFallback = true;
      startAudioFallback();
    }

    function startAudioFallback() {
      if (audioRef.current) return;

      // Create a silent audio context that plays continuously
      // iOS keeps the screen on while audio is playing
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.001; // Nearly silent
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();

      // Also use a no-src video trick as extra insurance
      const audio = document.createElement('audio');
      audio.setAttribute('loop', 'true');
      // Tiny silent WAV base64
      audio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      audio.volume = 0.01;
      audio.play().catch(() => {});
      audioRef.current = audio;

      // Periodically re-trigger play to keep iOS happy
      intervalRef.current = window.setInterval(() => {
        if (audioRef.current?.paused) {
          audioRef.current.play().catch(() => {});
        }
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
      }, 10000);
    }

    requestWakeLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (useAudioFallback) {
          startAudioFallback();
        } else {
          requestWakeLock();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Also start audio fallback on first touch (iOS requires user gesture)
    const handleTouch = () => {
      if (useAudioFallback && audioRef.current?.paused) {
        audioRef.current.play().catch(() => {});
      }
      document.removeEventListener('touchstart', handleTouch);
    };
    document.addEventListener('touchstart', handleTouch);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('touchstart', handleTouch);
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
      audioRef.current?.pause();
      audioRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);
}
