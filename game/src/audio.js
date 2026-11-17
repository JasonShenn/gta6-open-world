// Solmar Heat — all sound is synthesized live with WebAudio.
// No audio files, no network: oscillators and filtered noise only.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.muted = false;
  }

  // Must be called from a user gesture (the Start button).
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq, type) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.master);
    src.start(t);
  }

  click() { this._tone(660, 0.06, 'square', 0.12); }
  gunshot() { this._noise(0.14, 0.5, 2800, 'highpass'); this._tone(150, 0.1, 'square', 0.22, 60); }
  enemyShot() { this._noise(0.12, 0.28, 1800, 'highpass'); }
  crash() { this._noise(0.28, 0.5, 500); this._tone(90, 0.22, 'sine', 0.3, 45); }
  bump() { this._noise(0.08, 0.18, 700); }
  pickup() { this._tone(523, 0.09, 'sine', 0.2); setTimeout(() => this._tone(784, 0.12, 'sine', 0.2), 90); }
  cash() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.14, 'triangle', 0.22), i * 90));
  }
  missionDone() {
    [392, 523, 659, 784].forEach((f, i) => setTimeout(() => this._tone(f, 0.2, 'triangle', 0.24), i * 110));
  }
  busted() { [330, 262, 196, 131].forEach((f, i) => setTimeout(() => this._tone(f, 0.3, 'sawtooth', 0.16), i * 160)); }
  wasted() { [220, 175, 147, 110].forEach((f, i) => setTimeout(() => this._tone(f, 0.35, 'sawtooth', 0.16), i * 180)); }
  phone() { this._tone(880, 0.12, 'sine', 0.18); setTimeout(() => this._tone(880, 0.12, 'sine', 0.18), 180); }

  // Continuous engine hum while driving; pitch follows speed.
  engineStart() {
    if (!this.ctx || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    this.engineOsc.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }
  engineSet(speedRatio) {
    if (!this.engineOsc) return;
    this.engineOsc.frequency.value = 55 + speedRatio * 130;
    this.engineGain.gain.value = this.muted ? 0 : 0.05 + speedRatio * 0.07;
  }
  engineStop() {
    if (!this.engineOsc) return;
    try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
    this.engineOsc = null; this.engineGain = null;
  }

  // Two-tone police siren while any cruiser is in pursuit.
  sirenStart() {
    if (!this.ctx || this.sirenOsc) return;
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 720;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0.045;
    this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    let high = false;
    this.sirenTimer = setInterval(() => {
      if (!this.sirenOsc) return;
      high = !high;
      this.sirenOsc.frequency.setValueAtTime(high ? 960 : 720, this.ctx.currentTime);
    }, 420);
  }
  sirenStop() {
    if (this.sirenTimer) { clearInterval(this.sirenTimer); this.sirenTimer = null; }
    if (!this.sirenOsc) return;
    try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
    this.sirenOsc = null; this.sirenGain = null;
  }
}
