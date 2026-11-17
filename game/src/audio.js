// 全部音效都用 WebAudio 现場合成，零外部音频文件：
// 引擎是随车速变调的锯齿波，警笛是双音来回，枪声是噪声爆裂，
// 拾取与任务完成是短旋律。第一次按键才建 AudioContext（浏览器要求手势后才能出声）。

/** 造一个音效器：调用前先 ensure()（用户手势里调一次即可）。 */
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  /** 用户手势后调用：建 AudioContext 与常驻的引擎/警笛声源。 */
  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // 引擎：低音锯齿波 + 低通，音调跟车速走。
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();

    // 警笛：正弦波在 660 与 880 之间来回，通缉时才出声。
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 660;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  }

  /** 一段短促的噪声：枪声、撞击都用它，参数不同而已。 */
  function noiseBurst(duration, volume, filterFreq) {
    if (!ctx) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  /** 一个纯音：频率、时长、音量、波形都可调。 */
  function tone(freq, duration, volume, type = 'sine', when = 0) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const start = ctx.currentTime + when;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  return {
    ensure,
    /** 开关静音。 */
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** 每帧调：引擎音量与音调跟车速，警笛跟通缉等级。 */
    update(speed01, wanted) {
      if (!ctx) return;
      const now = ctx.currentTime;
      if (engineGain) {
        engineGain.gain.setTargetAtTime(speed01 > 0.02 ? 0.05 + speed01 * 0.06 : 0, now, 0.1);
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, now, 0.1);
      }
      if (sirenGain && sirenOsc) {
        sirenGain.gain.setTargetAtTime(wanted > 0 ? 0.045 : 0, now, 0.2);
        // 双音警笛：每 0.45 秒在两个音高之间切换。
        const high = Math.floor(now / 0.45) % 2 === 0;
        sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, now, 0.05);
      }
    },
    shoot() {
      noiseBurst(0.09, 0.5, 3200);
    },
    enemyShoot() {
      noiseBurst(0.09, 0.25, 1800);
    },
    crash() {
      noiseBurst(0.25, 0.7, 500);
      tone(70, 0.2, 0.4, 'triangle');
    },
    pickup() {
      tone(880, 0.12, 0.35);
      tone(1318, 0.18, 0.35, 'sine', 0.09);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, 0.22, 0.35, 'triangle', i * 0.11));
    },
    busted() {
      [392, 330, 262].forEach((freq, i) => tone(freq, 0.3, 0.35, 'sawtooth', i * 0.16));
    },
    click() {
      tone(660, 0.06, 0.25, 'square');
    },
  };
}
