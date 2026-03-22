import { useEffect, useRef } from 'react';

// Use a real silent MP4 file served from public/
const SILENT_VIDEO = '/silence.mp4';

/** Keep screen awake — Wake Lock API + video fallback for iOS */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    let hasWakeLock = false;

    // Try Wake Lock API first (Chrome, Edge, etc.)
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          hasWakeLock = true;
          return;
        }
      } catch {
        // Not supported or denied
      }
      // Fallback: silent video loop
      startVideoFallback();
    }

    function startVideoFallback() {
      if (videoRef.current) return;

      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.muted = true;
      video.loop = true;
      video.src = SILENT_VIDEO;
      video.style.position = 'fixed';
      video.style.top = '-1px';
      video.style.left = '-1px';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.opacity = '0.01';
      document.body.appendChild(video);
      videoRef.current = video;

      video.play().catch(() => {
        // Will retry on user interaction
      });
    }

    function tryPlayVideo() {
      if (videoRef.current?.paused && activeRef.current) {
        videoRef.current.play().catch(() => {});
      }
    }

    requestWakeLock();

    // On visibility change, re-acquire
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && activeRef.current) {
        if (hasWakeLock) {
          requestWakeLock();
        } else {
          tryPlayVideo();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // On user interaction, start video if needed (iOS requires gesture)
    const handleInteraction = () => {
      if (!hasWakeLock) {
        startVideoFallback();
        tryPlayVideo();
      }
    };
    document.addEventListener('touchstart', handleInteraction);
    document.addEventListener('click', handleInteraction);

    return () => {
      activeRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('click', handleInteraction);
      wakeLockRef.current?.release();
      wakeLockRef.current = null;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, []);
}
