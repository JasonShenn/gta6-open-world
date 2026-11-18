// audio.js — 全合成 WebAudio 音效：没有音频文件，所有声音都是振荡器现算的。
// M 键静音；第一次用户交互后才建 AudioContext（浏览器自动播放策略的要求）。

let ctx = null;
let muted = false;
let engineOsc = null;
let engineGain = null;

// 懒建 AudioContext；用户没点过页面时浏览器不让出声，调用会静默失败也不报错。
export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  } catch { ctx = null; }
}

export function isMuted() { return muted; }
export function setMuted(v) {
  muted = !!v;
  if (engineGain) engineGain.gain.value = 0;
}

// 一段短音：频率、时长、波形、音量，可选滑音到另一个频率。
function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* 出声失败不影响游戏 */ }
}

// 一小撮噪声（枪声、撞击用）：白噪声过一个低通，快速衰减。
function noiseBurst(dur, vol, cutoff) {
  if (!ctx || muted) return;
  try {
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.2;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
  } catch { /* 忽略 */ }
}

// 按名字放音效，游戏各处直接调 sfx('shoot') 这类名字。
export function sfx(name) {
  ensureAudio();
  if (!ctx || muted) return;
  switch (name) {
    case 'shoot': noiseBurst(0.12, 0.35, 2600); blip(220, 0.08, 'square', 0.10, 60); break;
    case 'hit': blip(180, 0.06, 'sawtooth', 0.10, 90); break;
    case 'pickup': blip(660, 0.09, 'sine', 0.14); setTimeout(() => blip(990, 0.12, 'sine', 0.14), 70); break;
    case 'cash': blip(880, 0.08, 'triangle', 0.14); setTimeout(() => blip(1320, 0.14, 'triangle', 0.14), 80); break;
    case 'mission': [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.14), i * 90)); break;
    case 'complete': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'triangle', 0.15), i * 110)); break;
    case 'busted': [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.10), i * 130)); break;
    case 'crash': noiseBurst(0.25, 0.3, 700); blip(90, 0.2, 'sawtooth', 0.12, 40); break;
    case 'enter': blip(300, 0.07, 'square', 0.10, 520); break;
    case 'siren': blip(720, 0.35, 'sine', 0.05, 980); break;
    case 'click': blip(600, 0.05, 'sine', 0.10); break;
    default: break;
  }
}

// 引擎持续嗡鸣：开车时按车速调音调，步行或静音时关掉。
export function engineSound(on, speedRatio) {
  if (!ctx || muted) { stopEngine(); return; }
  try {
    if (!on) { stopEngine(); return; }
    if (!engineOsc) {
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.03;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      engineOsc.connect(f).connect(engineGain).connect(ctx.destination);
      engineOsc.start();
    }
    engineOsc.frequency.value = 55 + (speedRatio || 0) * 130;
    engineGain.gain.value = 0.028 + (speedRatio || 0) * 0.03;
  } catch { /* 忽略 */ }
}

export function stopEngine() {
  try { if (engineOsc) { engineOsc.stop(); engineOsc = null; engineGain = null; } } catch { engineOsc = null; }
}
