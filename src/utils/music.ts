// Background music player — Medieval Fantasy Tavern ambience

let audio: HTMLAudioElement | null = null;
let pendingPlay = false;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/tavern-music.mp3');
    audio.loop = true;
    audio.volume = 0.3;
  }
  return audio;
}

// Retry playing on first user interaction if autoplay was blocked
function setupAutoplayRetry() {
  const tryPlay = () => {
    if (pendingPlay && audio) {
      audio.play().then(() => {
        pendingPlay = false;
      }).catch(() => {});
    }
    document.removeEventListener('click', tryPlay);
    document.removeEventListener('touchstart', tryPlay);
  };
  document.addEventListener('click', tryPlay, { once: true });
  document.addEventListener('touchstart', tryPlay, { once: true });
}

export function startMusic() {
  const el = getAudio();
  if (!el.paused) return;
  el.play().catch(() => {
    // Autoplay blocked — retry on next user interaction
    pendingPlay = true;
    setupAutoplayRetry();
  });
}

export function stopMusic() {
  pendingPlay = false;
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

export function setMusicVolume(volume: number) {
  const el = getAudio();
  el.volume = Math.max(0, Math.min(1, volume / 100));
}

export function isMusicPlaying(): boolean {
  return !!audio && !audio.paused;
}
