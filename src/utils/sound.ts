// Catan-themed sound using Web Audio API
// Generates a medieval horn/trumpet fanfare sound

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

// Very subtle soft tick — barely noticeable background beep
export function playWarningTick(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(330, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

// Same gentle tick, just a touch louder for the final seconds
export function playUrgentTick(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(330, now);
  osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
  filter.type = 'lowpass';
  filter.frequency.value = 400;
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

export function playCatanHorn(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  function createHornLayer(freq: number, startTime: number, duration: number, vol: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq * 0.98, startTime);
    osc.frequency.linearRampToValueAtTime(freq, startTime + 0.05);

    filter.type = 'lowpass';
    filter.frequency.value = freq * 3;
    filter.Q.value = 2;

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.04);
    gain.gain.setValueAtTime(vol, startTime + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // Fanfare: three ascending notes like a medieval herald
  createHornLayer(261.63, now, 0.35, 0.25);
  createHornLayer(523.25, now, 0.35, 0.1);

  createHornLayer(329.63, now + 0.35, 0.35, 0.28);
  createHornLayer(659.25, now + 0.35, 0.35, 0.12);

  createHornLayer(392.0, now + 0.7, 0.7, 0.3);
  createHornLayer(784.0, now + 0.7, 0.7, 0.15);

  createHornLayer(523.25, now + 1.4, 0.9, 0.3);
  createHornLayer(659.25, now + 1.4, 0.9, 0.15);
  createHornLayer(784.0, now + 1.4, 0.9, 0.1);
}

// Must be called from a user gesture to unlock audio on mobile
export function initAudio(): void {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}
