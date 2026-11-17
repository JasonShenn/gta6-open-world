// Solmar Heat — bootstrap: wire the canvas, HUD and menus to the Game,
// run the frame loop, and expose a small debug handle the automated
// tests (and only the tests) drive.

import { Game } from './game.js';
import { STORY_INTRO } from './missions.js';

const canvas = document.getElementById('game-canvas');
const minimap = document.getElementById('minimap');

const hud = {
  money: document.getElementById('hud-money'),
  healthFill: document.getElementById('hud-health-fill'),
  healthText: document.getElementById('hud-health-text'),
  stars: document.getElementById('hud-stars'),
  objective: document.getElementById('hud-objective'),
  banner: document.getElementById('hud-banner'),
  bannerTitle: document.getElementById('hud-banner-title'),
  bannerText: document.getElementById('hud-banner-text'),
  speed: document.getElementById('hud-speed'),
  prompt: document.getElementById('hud-prompt'),
  timer: document.getElementById('hud-timer'),
  toast: document.getElementById('hud-toast'),
};

const game = new Game(canvas, minimap, hud);
document.getElementById('story-intro').textContent = STORY_INTRO;

// The Continue button only shows when a save exists.
const save = game.loadSave();
const continueBtn = document.getElementById('btn-continue');
if (save) {
  continueBtn.classList.remove('hidden');
  continueBtn.textContent = `↻ CONTINUE — $${save.money} · Job ${Math.min(3, (save.completedCount || 0) + 1)}/3`;
}

document.getElementById('btn-start').addEventListener('click', () => game.startGame(true));
continueBtn.addEventListener('click', () => {
  const s = game.loadSave();
  if (s) game.applySave(s);
  game.startGame(false);
});
document.getElementById('btn-resume').addEventListener('click', () => game.togglePause());
document.getElementById('btn-quit-title').addEventListener('click', () => {
  document.getElementById('pause-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.remove('hidden');
  game.state = 'title';
});

// Autosave when the tab is left, so progress is never lost silently.
window.addEventListener('beforeunload', () => { if (game.state === 'playing') game.save(); });

function loop(now) {
  game.frame(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Debug handle for the automated playtests. It only moves the player,
// sets state and reads it back — it cannot change the shipped game.
window.__solmar = {
  game,
  state() {
    return {
      state: game.state,
      x: Math.round(game.player.x), y: Math.round(game.player.y),
      money: game.money, health: Math.round(game.player.health),
      wanted: game.wanted, inCar: game.inCar,
      speed: game.inCar && game.car ? Math.round(Math.abs(game.car.speed)) : 0,
      cops: game.cops.length, enemies: game.enemies.length,
      peds: game.peds.length, traffic: game.traffic.length,
      mission: game.missions.index, missionActive: game.missions.active,
      missionStep: game.missions.step, completed: game.missions.completedCount,
      objective: game.objectiveText,
    };
  },
  teleport(x, y) {
    if (game.inCar && game.car) { game.car.x = x; game.car.y = y; }
    game.player.x = x; game.player.y = y;
  },
  setWanted(n) { game.wanted = n; game.quietTimer = 0; },
  startMission(i) { game.missions.startMission(i); },
  nearestParkedCar() {
    let best = null, bd = Infinity;
    for (const c of game.parkedCars) {
      const d = (c.x - game.player.x) ** 2 + (c.y - game.player.y) ** 2;
      if (d < bd) { bd = d; best = { x: c.x, y: c.y, targetCar: !!c.targetCar }; }
    }
    return best;
  },
  targetCar() {
    const c = game.parkedCars.find((p) => p.targetCar);
    return c ? { x: c.x, y: c.y } : null;
  },
  aimAt(x, y) {
    game.input.mouse.x = x - game.cam.x;
    game.input.mouse.y = y - game.cam.y;
  },
  shootAt(x, y) {
    game.input.mouse.x = x - game.cam.x;
    game.input.mouse.y = y - game.cam.y;
    game.player.gunTimer = 0;
    game.tryShoot(0);
  },
  hurt(n) { game.hurtPlayer(n); },
};
