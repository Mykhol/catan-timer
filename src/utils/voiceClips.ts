// Voice clip player — plays random Catan narrator clips during the timer

const TOTAL_CLIPS = 39;
let lastPlayedIndex = -1;

function getRandomClipIndex(): number {
  // Avoid repeating the same clip twice in a row
  let idx: number;
  do {
    idx = Math.floor(Math.random() * TOTAL_CLIPS);
  } while (idx === lastPlayedIndex && TOTAL_CLIPS > 1);
  lastPlayedIndex = idx;
  return idx;
}

let currentAudio: HTMLAudioElement | null = null;

export function playRandomVoiceClip(): void {
  // Don't overlap — skip if one is already playing
  if (currentAudio && !currentAudio.paused) return;

  const idx = getRandomClipIndex();
  const num = String(idx + 1).padStart(2, '0');
  currentAudio = new Audio(`/voice-clips/clip-${num}.mp3`);
  currentAudio.volume = 0.8;
  currentAudio.play().catch(() => {
    // Browser blocked autoplay
  });
}

export function stopVoiceClip(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}
