// audio.js — 全合成 WebAudio 音效：无外部音频文件，全部现算。
// 引擎声随车速变调、警笛双音交替、枪声噪声爆、拾取音、撞击闷响。M 键静音。
export class Sfx {
  constructor() {
    this.ctx = null; this.master = null; this.muted = false;
    this.engineOsc = null; this.engineGain = null; this.sirenTimer = 0; this.sirenHigh = false;
  }
  // 第一次用户交互后调用：创建 AudioContext（浏览器要求手势后才能发声）。
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // 引擎：低频锯齿波 + 低通，音调跟车速走。
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      this.engineOsc.connect(filt); filt.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) { this.ctx = null; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  // 每帧调用：引擎音量/音调跟车速，警笛按通缉等级响。
  update(speedNorm, wanted, dt) {
    if (!this.ctx) return;
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 48 + speedNorm * 130;
      this.engineGain.gain.value = speedNorm > 0.02 ? 0.05 + speedNorm * 0.06 : 0;
    }
    if (wanted > 0) {
      this.sirenTimer -= dt;
      if (this.sirenTimer <= 0) {
        this.sirenTimer = 0.42; this.sirenHigh = !this.sirenHigh;
        this.blip(this.sirenHigh ? 880 : 620, 0.38, 0.05);
      }
    }
  }
  // 短促正弦音（拾取/警笛/提示共用）。
  blip(freq, dur, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
  }
  pickup() { this.blip(880, 0.09, 0.12); setTimeout(() => this.blip(1318, 0.12, 0.12), 70); }
  // 枪声：白噪声爆 + 低频冲击。
  shot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, len = this.ctx.sampleRate * 0.12;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = 0.25;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  // 撞击：低频正弦闷响。
  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.22);
  }
}
