// Voice clip player — plays random Catan narrator clips

const WARNING_CLIPS = 39;
const TIMESUP_CLIPS = 39;

let currentAudio: HTMLAudioElement | null = null;

function getRandomIndex(total: number, lastIndex: number): number {
  let idx: number;
  do {
    idx = Math.floor(Math.random() * total);
  } while (idx === lastIndex && total > 1);
  return idx;
}

function playClip(folder: string, total: number, lastRef: { value: number }): void {
  // Don't overlap
  if (currentAudio && !currentAudio.paused) return;

  const idx = getRandomIndex(total, lastRef.value);
  lastRef.value = idx;
  const num = String(idx + 1).padStart(2, '0');
  currentAudio = new Audio(`/${folder}/clip-${num}.mp3`);
  currentAudio.volume = 0.8;
  currentAudio.play().catch(() => {});
}

const warningRef = { value: -1 };
const timesUpRef = { value: -1 };

/** Play a random "hurry up" voice clip (during countdown) */
export function playRandomVoiceClip(): void {
  playClip('voice-clips', WARNING_CLIPS, warningRef);
}

/** Play a random "time's up" voice clip (when timer hits 0) */
export function playTimesUpClip(): void {
  playClip('voice-timesup', TIMESUP_CLIPS, timesUpRef);
}

export function stopVoiceClip(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}
