// Synthesised sound with WebAudio: engine, siren, gunshots, punches, jingles and a car radio loop.
let ctx = null, master = null, engine = null, siren = null, radio = null, noiseBuf = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // engine: two detuned saws through a lowpass
  const eg = ctx.createGain(); eg.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
  const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 56.5;
  o1.connect(lp); o2.connect(lp); lp.connect(eg); eg.connect(master);
  o1.start(); o2.start();
  engine = { gain: eg, o1, o2, lp };

  const sg = ctx.createGain(); sg.gain.value = 0;
  const so = ctx.createOscillator(); so.type = 'square'; so.frequency.value = 700;
  const sf = ctx.createBiquadFilter(); sf.type = 'bandpass'; sf.frequency.value = 900;
  so.connect(sf); sf.connect(sg); sg.connect(master); so.start();
  siren = { gain: sg, osc: so };

  radio = { gain: ctx.createGain(), nextBar: 0, bar: 0 };
  radio.gain.gain.value = 0; radio.gain.connect(master);
}

function blip(freq, dur, type = 'square', vol = 0.2, when = 0, dest = master) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur, vol, freq) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(200, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
}

export const sfx = {
  gunshot() { noise(0.25, 0.7, 5000); blip(120, 0.12, 'triangle', 0.3); },
  punch() { noise(0.1, 0.4, 900); blip(80, 0.1, 'sine', 0.4); },
  crash() { noise(0.45, 0.6, 1800); },
  pickup() { [660, 880, 1320].forEach((f, i) => blip(f, 0.12, 'square', 0.12, i * 0.07)); },
  missionPassed() { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => blip(f, 0.22, 'triangle', 0.2, i * 0.12)); },
  wanted() { blip(330, 0.15, 'square', 0.15); blip(247, 0.2, 'square', 0.15, 0.15); },
  wasted() { [392, 330, 262, 196].forEach((f, i) => blip(f, 0.35, 'sawtooth', 0.15, i * 0.25)); },
  door() { blip(180, 0.08, 'square', 0.15); blip(120, 0.1, 'square', 0.12, 0.08); },
};

const CHORDS = [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 311]];

// Called every frame: engine pitch from speed, siren from wanted level, radio while driving.
export function updateAudio(state) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const sp = Math.abs(state.carSpeed || 0);
  engine.gain.gain.setTargetAtTime(state.inCar ? 0.07 + sp * 0.002 : 0, t, 0.1);
  const f = 45 + sp * 3.2 + (state.throttle ? 12 : 0);
  engine.o1.frequency.setTargetAtTime(f, t, 0.08);
  engine.o2.frequency.setTargetAtTime(f * 1.012, t, 0.08);
  engine.lp.frequency.setTargetAtTime(400 + sp * 25, t, 0.1);
  const sirenVol = state.stars > 0 ? Math.max(0, 0.08 - state.copDist / 2500) : 0;
  siren.gain.gain.setTargetAtTime(sirenVol, t, 0.2);
  siren.osc.frequency.setTargetAtTime(Math.floor(t * 2) % 2 ? 620 : 860, t, 0.05);
  radio.gain.gain.setTargetAtTime(state.inCar && !state.paused ? 0.6 : 0, t, 0.3);
  if (t > radio.nextBar - 0.1) {
    const start = Math.max(t, radio.nextBar);
    const chord = CHORDS[radio.bar % CHORDS.length];
    for (let b = 0; b < 8; b++) blip(chord[0] / 2, 0.18, 'sawtooth', 0.09, start - t + b * 0.25, radio.gain);
    chord.forEach((n) => blip(n, 1.9, 'triangle', 0.035, start - t, radio.gain));
    blip(chord[2] * 2, 0.2, 'square', 0.03, start - t + 0.75, radio.gain);
    radio.nextBar = start + 2; radio.bar += 1;
  }
}
