// Catan-themed sound using Web Audio API
// Generates a medieval horn/trumpet fanfare sound

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

// Gentle wooden tick — soft sine with quick decay, like a board game piece tapping
export function playWarningTick(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  // Low warm tone
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);

  // Soft click layer
  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = 'triangle';
  click.frequency.value = 800;
  clickGain.gain.setValueAtTime(0.06, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
  click.connect(clickGain);
  clickGain.connect(ctx.destination);
  click.start(now);
  click.stop(now + 0.05);
}

// Slightly more intense version — same character, a bit louder + higher
export function playUrgentTick(): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(520, now);
  osc.frequency.exponentialRampToValueAtTime(260, now + 0.15);
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  gain.gain.setValueAtTime(0.16, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);

  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = 'triangle';
  click.frequency.value = 900;
  clickGain.gain.setValueAtTime(0.08, now);
  clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  click.connect(clickGain);
  clickGain.connect(ctx.destination);
  click.start(now);
  click.stop(now + 0.06);
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
