// GOLDEN TIDE — main.js
// One job: boot the game — canvas, the frame loop, title clicks, pause and
// mute keys, and the ?shot=… staging hook the screenshot driver uses.

import { Game } from './game.js';
import { Input } from './input.js';
import { renderWorld, renderHUD, renderOverlay } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || 7);
const shot = params.get('shot');

const game = new Game(seed);
const input = new Input(canvas);
window.GT = game; // play-test hook: the driver reads and steers the game here

// Title screen: click starts a fresh run, or continues the saved one.
canvas.addEventListener('mousedown', () => {
  game.sounds.ensure();
  if (game.mode === 'title') game.start(false);
  else if (game.mode === 'busted' || game.mode === 'complete') game.resume();
});

let last = performance.now();
let shotReady = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // P pause, M mute — edge-triggered, checked before the update.
  if (input.hit('p')) {
    if (game.mode === 'play') game.mode = 'paused';
    else if (game.mode === 'paused') game.mode = 'play';
  }
  if (input.hit('m')) {
    const muted = game.sounds.toggleMute();
    game.toast(muted ? 'Sound muted (M to unmute).' : 'Sound on.', '#ffe9a8');
  }

  game.update(input, dt);

  // Camera shake: a few pixels of jitter while the car screams.
  ctx.save();
  if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  renderWorld(ctx, game);
  ctx.restore();
  if (game.mode !== 'title') renderHUD(ctx, game);
  renderOverlay(ctx, game);
  input.endFrame();

  if (shot && !shotReady) {
    shotReady = true;
    window.__shotReady = true; // the screenshot driver waits for this flag
  }
  requestAnimationFrame(frame);
}

// Screenshot mode: stage the named scene, render it frozen, flag ready.
if (shot) {
  game.applyShot(shot);
  // One warm-up render so fonts and the first frame settle, then the loop
  // keeps drawing the same frozen frame (update() returns early when frozen).
  renderWorld(ctx, game);
  renderHUD(ctx, game);
}
requestAnimationFrame(frame);
