// Web Audio API sound engine — no external files needed
let ctx = null;
let muted = localStorage.getItem('uno_muted') === 'true';

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isMuted() { return muted; }
export function setMuted(val) {
  muted = val;
  localStorage.setItem('uno_muted', val);
}
export function toggleMute() {
  setMuted(!muted);
  return muted;
}

function playTone({ frequency = 440, type = 'sine', duration = 0.15, volume = 0.3, attack = 0.01, decay = 0.05, startFreq, endFreq }) {
  if (muted) return;
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = type;
    const now = c.currentTime;
    if (startFreq && endFreq) {
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    } else {
      osc.frequency.setValueAtTime(frequency, now);
    }
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.start(now);
    osc.stop(now + duration + decay);
  } catch (e) {}
}

export function soundCardPlace() {
  playTone({ frequency: 180, type: 'triangle', duration: 0.08, volume: 0.35, attack: 0.005 });
  setTimeout(() => playTone({ frequency: 900, type: 'sine', duration: 0.06, volume: 0.15, attack: 0.002 }), 30);
}
export function soundCardDraw() {
  playTone({ startFreq: 300, endFreq: 180, type: 'sine', duration: 0.12, volume: 0.2, attack: 0.01 });
}
export function soundWild() {
  [0, 60, 120, 180].forEach((delay, i) => {
    const freqs = [440, 550, 660, 880];
    setTimeout(() => playTone({ frequency: freqs[i], type: 'sine', duration: 0.18, volume: 0.18, attack: 0.01 }), delay);
  });
}
export function soundUno() {
  [0, 100, 200].forEach((delay, i) => {
    const freqs = [523, 659, 784];
    setTimeout(() => playTone({ frequency: freqs[i], type: 'square', duration: 0.15, volume: 0.12, attack: 0.005 }), delay);
  });
}
export function soundCatch() {
  playTone({ startFreq: 600, endFreq: 200, type: 'sawtooth', duration: 0.25, volume: 0.2, attack: 0.01 });
}
export function soundSkip() {
  playTone({ startFreq: 800, endFreq: 400, type: 'square', duration: 0.1, volume: 0.12, attack: 0.005 });
}
export function soundDraw2() {
  playTone({ frequency: 350, type: 'triangle', duration: 0.08, volume: 0.2, attack: 0.005 });
  setTimeout(() => playTone({ frequency: 350, type: 'triangle', duration: 0.08, volume: 0.2, attack: 0.005 }), 100);
}
export function soundYourTurn() {
  playTone({ frequency: 660, type: 'sine', duration: 0.3, volume: 0.15, attack: 0.02 });
}
export function soundReaction() {
  playTone({ frequency: 440, type: 'sine', duration: 0.1, volume: 0.1, attack: 0.005 });
}
