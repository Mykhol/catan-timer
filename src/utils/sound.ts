// Catan-themed sound using Web Audio API
// Generates a medieval horn/trumpet fanfare sound

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

export function playWarningTick(): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 800;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
}

export function playUrgentTick(): void {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = 1200;
  osc.type = 'square';
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
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
