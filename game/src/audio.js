// GOLDEN TIDE — audio.js
// One job: every sound, synthesised with WebAudio — no audio files at all.
// Engine hum follows speed, the siren wails while wanted, plus gun, crash,
// pickup and cash blips. M toggles mute. Silent until the first key or click.

export class SoundBank {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false;
    this.engineOsc = null; this.engineGain = null; this.sirenOsc = null;
    this.sirenGain = null; this.sirenTimer = 0;
  }

  // Create the context on first user gesture; browsers block audio before that.
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine: low sawtooth whose pitch follows the car.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: triangle that slides between two notes.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle'; this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) { this.ctx = null; }
  }

  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.35; return this.muted; }

  // Call every frame: engine pitch from speed, siren on/off from wanted level.
  update(speedRatio, wanted) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0.02 + speedRatio * 0.09, t, 0.1);
    this.engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, t, 0.1);
    this.sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.05 : 0, t, 0.2);
    if (wanted > 0) {
      this.sirenTimer += 1;
      this.sirenOsc.frequency.setTargetAtTime(this.sirenTimer % 60 < 30 ? 720 : 980, t, 0.05);
    }
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }

  // Short noise burst: gunshot or crash, louder and harsher for a crash.
  noise(dur, vol, low) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low || 2400;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }

  shoot() { this.noise(0.14, 0.5, 3200); this.blip(180, 0.08, 'square', 0.15); }
  crash() { this.noise(0.25, 0.45, 700); }
  pickup() { this.blip(660, 0.09, 'sine', 0.22); this.blip(990, 0.12, 'sine', 0.2); }
  cash() { this.blip(880, 0.08, 'triangle', 0.25); this.blip(1320, 0.14, 'triangle', 0.22); }
  busted() { this.blip(220, 0.4, 'sawtooth', 0.25); this.blip(165, 0.5, 'sawtooth', 0.22); }
  missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.22), i * 110)); }
}
