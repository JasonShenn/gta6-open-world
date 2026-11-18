// game.js — 游戏状态与主循环：创建世界、每帧更新、自动存档、胜负判定、测试钩子。
import { WORLD, MISSIONS, PLAYER, SAVE_KEY } from './config.js';
import { buildCity, prerenderCity } from './city.js';
import { makeRng } from './rng.js';
import { Sfx } from './audio.js';
import { makeTraffic, updateTraffic } from './traffic.js';
import { updateOnFoot, updateDriving, tryEnterExitCar, shoot, updateBullets } from './player.js';
import { updatePolice } from './police.js';
import { updateMissions, updateEnemies, startMission } from './missions.js';
import { render } from './render.js';
import { makeInput } from './input.js';
import { applyShot } from './shots.js';

export function createGame(canvas, seed) {
  const city = buildCity(seed);
  prerenderCity(city); // 静态城市一次性画进离屏画布，每帧只贴图
  const sp = city.spots;
  const S = {
    seed, city, time: 0, zoom: 2.1, cam: { x: 0, y: 0, w: 1280, h: 720 },
    rng: makeRng(seed + 99),
    sfx: new Sfx(),
    traffic: makeTraffic(seed),
    player: {
      x: sp.playerStart.x, y: sp.playerStart.y, angle: -Math.PI / 2, aim: -Math.PI / 2,
      hp: PLAYER.hpMax, ammo: PLAYER.ammoMax, car: null, moving: false,
    },
    cars: city.parked.map(c => ({ ...c, speed: 0, parked: true })), // 停着的可偷车（parked 标记=偷车判据）
    owned: [], police: [], roadblocks: [], enemies: [], bullets: [], particles: [],
    wanted: 0, money: PLAYER.startMoney, cashFound: 0, garage: [], done: [],
    mission: null, m4Timer: 0, cashBag: null, stashes: sp.stashes.map(s => ({ ...s, got: false })),
    taxi: null, toasts: [], banner: null, paused: false, over: null,
    shootCd: 0, muzzle: 0, hurtCd: 0, shake: 0, policeTimer: 0, saveTimer: 5, saveSoon: false,
    queueEnter: false, queuePause: false, queueMute: false, queueRestock: false,
    started: false, shotMode: false, freezeWorld: false,
  };
  S.ctx = canvas.getContext('2d');
  S.input = makeInput(canvas, S);
  S.missionTitle = () => (S.mission ? MISSIONS[S.mission.id].title : '');
  S.toast = text => {
    S.toasts.push({ text, t: 4 });
    if (S.toasts.length > 4) S.toasts.shift();
  };
  // 测试与调试钩子（window.GT）：玩法测试用，不影响正常游玩。
  S.debug = {
    state: S,
    setWanted(n) { S.wanted = n; S.policeTimer = 0; },
    clearCops() { S.wanted = 0; S.police = []; S.roadblocks = []; },
    heal() { S.player.hp = PLAYER.hpMax; },
    teleport(x, y) { S.player.x = x; S.player.y = y; if (S.player.car) { S.player.car.x = x; S.player.car.y = y; } },
    giveAmmo(n) { S.player.ammo = n; },
    startMission(id) { startMission(S, id); },
    spawnPolice(n) { for (let i = 0; i < n; i++) S.police.push({ x: S.player.x + 200 + i * 60, y: S.player.y - 200, angle: 0, speed: 300, flash: true }); },
  };
  return S;
}

// —— 存档：localStorage 自动保存（每 5 秒 + 任务完成时）——
export function saveGame(S) {
  try {
    const d = {
      money: S.money, hp: S.player.hp, ammo: S.player.ammo,
      cashFound: S.cashFound, garage: S.garage, done: S.done,
      x: S.player.x, y: S.player.y,
      stashes: S.stashes.map(s => s.got),
      next: S.done.length < 4 ? ['M1', 'M2', 'M3', 'M4'][S.done.length] : null,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(d));
  } catch (e) { /* 无痕模式等存不下也不崩 */ }
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
export function applySave(S, d) {
  S.money = d.money; S.player.hp = d.hp; S.player.ammo = d.ammo;
  S.cashFound = d.cashFound; S.garage = d.garage || []; S.done = d.done || [];
  S.player.x = d.x; S.player.y = d.y;
  d.stashes?.forEach((g, i) => { if (g && S.stashes[i]) S.stashes[i].got = true; });
  if (d.next) startMission(S, d.next);
  else if (S.done.length >= 4) S.over = 'win';
}

// —— 主循环 ——
// 驱动：rAF 为主（真机上跟随显示器刷新）；另有 50ms 看门狗——无头 swiftshader 下
// rAF 会被压到约 4 帧/秒，只靠它游戏时间会比真实时间慢 5 倍。看门狗在 rAF 停顿时
// 补帧；每步按真实流逝时间推进，并把 update 拆成 ≤1/30 秒的子步，物理不穿墙。
export function startLoop(S) {
  let last = performance.now();
  function step(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    // 暂停/静音在循环层消费（不能放 update 里：暂停时 update 不跑，按 P 就永远解不开暂停）。
    if (S.queuePause) { S.queuePause = false; S.paused = !S.paused; }
    if (S.queueMute) { S.queueMute = false; S.sfx.setMuted(!S.sfx.muted); S.toast(S.sfx.muted ? 'Sound muted.' : 'Sound on.'); }
    if (!S.paused) {
      S.time += dt;
      S.shootCd = Math.max(0, S.shootCd - dt);
      S.muzzle = Math.max(0, S.muzzle - dt);
      if (S.banner) S.banner.t -= dt;
      for (const t of S.toasts) t.t -= dt;
      S.toasts = S.toasts.filter(t => t.t > 0);
      if (!S.freezeWorld && S.started && !S.over) {
        let rem = dt;
        while (rem > 0) { const h = Math.min(rem, 1 / 30); update(S, h); rem -= h; }
        S.saveTimer -= dt;
        if (S.saveTimer <= 0 || S.saveSoon) { saveGame(S); S.saveTimer = 5; S.saveSoon = false; }
      }
      // 通缉自然消退：10 秒内无警车靠近就降 1 星。
      if (S.wanted > 0 && !S.freezeWorld) {
        S.coolTimer = (S.coolTimer || 0) + dt;
        const near = S.police.some(c => Math.hypot(c.x - S.player.x, c.y - S.player.y) < 450);
        if (!near && S.coolTimer > 10) { S.wanted = Math.max(0, S.wanted - 1); S.coolTimer = 0; S.toast('You lost them — wanted level down.'); }
        if (near) S.coolTimer = 0;
      }
      S.sfx.update(S.player.car ? Math.abs(S.player.car.speed) / 560 : 0, S.wanted, dt);
    }
    render(S);
  }
  function raf(now) { step(now); requestAnimationFrame(raf); }
  requestAnimationFrame(raf);
  setInterval(() => {
    const now = performance.now();
    if (now - last > 120) step(now); // rAF 停顿超过 120ms 时补一帧
  }, 50);
}

function update(S, dt) {
  const input = S.input;
  input.updateWorld();
  // 队列按键（input 层只置标志，主循环消费，避免重复触发）。
  if (S.queueEnter) { S.queueEnter = false; tryEnterExitCar(S); }
  if (S.queueRestock) {
    S.queueRestock = false;
    if (S.player.ammo < PLAYER.ammoMax && S.money >= 20) {
      S.money -= 20; S.player.ammo = PLAYER.ammoMax; S.toast('Ammo restocked. -$20');
    } else if (S.player.ammo >= PLAYER.ammoMax) S.toast('Ammo already full.');
    else S.toast('Not enough cash to restock.');
  }
  if (S.over) return;
  if (S.player.car) updateDriving(S, input, dt);
  else updateOnFoot(S, input, dt);
  if (input.shootHeld && !S.player.car) shoot(S, input);
  updateBullets(S, dt);
  updateTraffic(S.traffic, dt, S.city);
  updatePolice(S, dt);
  updateEnemies(S, dt);
  updateMissions(S, dt);
  // 血量回满（脱战缓慢恢复，避免卡死）。
  if (S.player.hp > 0 && S.player.hp < PLAYER.hpMax && S.wanted === 0) S.player.hp = Math.min(PLAYER.hpMax, S.player.hp + 2 * dt);
  // 掉出世界或血量见底：被捕画面（步行）/ 撞毁重生（开车）。
  if (S.player.hp <= 0 && S.player.car) {
    S.player.hp = 40; S.player.car.speed = 0;
    S.toast('Your car is wrecked — you crawl out.');
    tryEnterExitCar(S);
  }
}

// —— 截图模式入口：?shot=<名>&seed=<数> 时直接进游戏并摆布景 ——
export function bootFromUrl(S) {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (shot) {
    S.started = true;
    document.getElementById('title').style.display = 'none';
    applyShot(S, shot);
    return true;
  }
  return false;
}
export { applyShot };
