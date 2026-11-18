// main.js — 启动入口：建世界、接 HUD 按钮、跑主循环。
// 两处 v3 教训写死在这里：
// ① 无头环境的 rAF 会被压到约 4fps，游戏时间会慢 5 倍——50ms 看门狗补帧 + update 子步化（每步 ≤1/30 秒）；
// ② 暂停 / 静音在循环层（按键事件）消费，不放在 update 里，否则暂停后永远解不开。

import { createGame, startGame, updateGame, showOverlay, togglePause, toast, debugApi } from './game.js';
import { bindInput, keys } from './input.js';
import { setMuted, isMuted, ensureAudio } from './audio.js';
import { drawGame } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);

// 画布铺满窗口。
function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const world = createGame(canvas, { seed });
bindInput(canvas);
window.__game = debugApi(world);

// 标题画面：新游戏 / 继续。
showOverlay(world, 'title');

// P 暂停、M 静音：在按键事件层处理（循环层），与 update 无关。
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && (world.mode === 'play' || world.mode === 'paused')) {
    e.preventDefault();
    togglePause(world);
  }
  if (e.code === 'KeyM') {
    e.preventDefault();
    setMuted(!isMuted());
    if (world.mode === 'play') toast(world, isMuted() ? 'Sound muted.' : 'Sound on.');
  }
  if (e.code === 'Enter' && world.mode === 'title') startGame(world, false);
  if (e.code === 'Escape' && world.mode === 'play') togglePause(world, true);
});

// 右下角 SOUND 按钮（在车速框上方，不重叠）。
const soundBtn = document.getElementById('sound-btn');
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    ensureAudio();
    setMuted(!isMuted());
  });
}
// 第一次点击页面就解锁音频。
window.addEventListener('pointerdown', ensureAudio, { once: true });

// —— 截图模式：?shot=1-chase&seed=7 直接摆好确定性布景进 play，不经过标题。
if (params.get('shot')) {
  const name = params.get('shot');
  world.shotMode = name;
  startGame(world, false);
  stageShot(world, name);
  world.shotReady = true;
}

// —— 主循环：看门狗 + 子步化。
let last = performance.now();
let watchdog = null;
function frame(now) {
  requestAnimationFrame(frame);
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25; // 切后台回来不跳变
  // 子步化：每步最多 1/30 秒，保证无头低帧率下游戏时间不慢。
  let remaining = elapsed;
  while (remaining > 0) {
    const step = Math.min(remaining, 1 / 30);
    updateGame(world, step);
    remaining -= step;
  }
  drawGame(world);
  // 看门狗：rAF 长时间不回调（无头被压帧）时，用定时器补帧。
  if (watchdog) clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    const t = performance.now();
    const gap = (t - last) / 1000;
    last = t;
    let rem = Math.min(gap, 0.25);
    while (rem > 0) {
      const step = Math.min(rem, 1 / 30);
      updateGame(world, step);
      rem -= step;
    }
    drawGame(world);
  }, 50);
}
requestAnimationFrame(frame);
