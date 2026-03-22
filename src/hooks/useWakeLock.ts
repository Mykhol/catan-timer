import { useEffect, useRef } from 'react';

// Tiny 1-second silent MP4 video encoded as base64
// iOS keeps the screen on while a video element is playing
const SILENT_VIDEO = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAdttZGF0AAACrQYF//+p3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE1MiByMjg1NCBlOWE1OTAzIC0gSC4yNjQvTVBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNyAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaHRtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3VibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxsaXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0aHJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRfbWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmPTIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAABhZYiEAD//8m+P5OXfBeLGOfKE3xkODvFZuBflHv/+VwJIta6164QxyMTkc3JOXGBn0U/xGMsYRaHzBRcFBx2MIr9RmMFR6MBu7jGFGJLIw2S2kHOKDGN8VmCPEGEPjkJAAAAFEGaJGxDP/6eEAACbx5CXAO6AAAACQAAAAMAAAMAAAMAA//kQBViAAAAB0GaRMAn/wAAAAMAAAADAAADAAADAIAAAAVBmmRsQr8AAAADAAADAAADAAADAiAAAARBnoJFNSwn/wAAAAMAAAADAAADAAAMqQAAABNBnqBFESwr/wAAAAMAAAADAAADE0EAAAAGQb6hRREsK/8AAAADAAADAAADAAAMuAAAAAlBvsJFFSwn/wAAAAwAAAADAAADAAAMuQAAAAlBvuNFNSwn/wAAAAwAAAADAAADAAAMuQ==';

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
