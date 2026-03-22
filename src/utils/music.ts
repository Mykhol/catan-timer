// Background music player — Medieval Fantasy Tavern ambience
// Source: public/tavern-music.mp3

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio('/tavern-music.mp3');
    audio.loop = true;
    audio.volume = 0.4;
  }
  return audio;
}

export function startMusic() {
  const el = getAudio();
  if (!el.paused) return;
  el.play().catch(() => {
    // Browser blocked autoplay — will work after user interaction
  });
}

export function stopMusic() {
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
