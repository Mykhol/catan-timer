import { useEffect, useRef } from 'react';

/** Keep screen awake on all platforms including iOS Safari.
 *
 *  Strategy:
 *  1. Try Wake Lock API (Chrome, Edge, Firefox)
 *  2. Fallback: play a silent video NOT muted — iOS requires unmuted
 *     media with an audio track to prevent sleep.
 *     Volume is set to near-zero so it's inaudible.
 */
export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    let usingWakeLock = false;

    async function tryWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          usingWakeLock = true;
        }
      } catch {
        // Not supported or denied
      }
    }

    function createVideo() {
      if (videoRef.current) return;

      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.loop = true;
      // NOT muted — iOS needs unmuted audio to prevent sleep
      video.muted = false;
      video.volume = 0.001;
      video.src = '/silence.mp4';
      video.style.cssText = 'position:fixed;top:-10px;left:-10px;width:1px;height:1px;opacity:0.01;pointer-events:none;z-index:-9999';
      // iOS sometimes ignores loop — manually restart on end
      video.addEventListener('ended', () => {
        video.currentTime = 0;
        video.play().catch(() => {});
      });
      document.body.appendChild(video);
      videoRef.current = video;
    }

    function playVideo() {
      if (!videoRef.current || !videoRef.current.paused) return;
      videoRef.current.play().catch(() => {});
    }

    function startFallback() {
      createVideo();
      playVideo();
    }

    // Try wake lock first, set up video fallback regardless (for iOS)
    tryWakeLock();

    // Start video on first user interaction
    const handleInteraction = () => {
      if (!usingWakeLock) {
        startFallback();
      }
    };
    document.addEventListener('touchstart', handleInteraction);
    document.addEventListener('click', handleInteraction);

    // Re-acquire on visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && activeRef.current) {
        if (usingWakeLock) {
          tryWakeLock();
        } else {
          playVideo();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      activeRef.current = false;
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('visibilitychange', handleVisibility);
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
