// game.js — 游戏总装：世界状态机、每帧更新、HUD 同步、存档、调试接口。
// 模式：title（标题）/ play（游玩）/ paused（暂停）/ busted（被捕）/ complete（通关）。

import { WORLD, ZOOM_FOOT, MISSIONS, CASH_SPOTS, SAVE_KEY } from './config.js';
import { makeRng } from './rng.js';
import { keys, mouse, moveAxis, isDown } from './input.js';
import { sfx, engineSound, stopEngine, setMuted, isMuted } from './audio.js';
import { buildCity, prerenderCity } from './city.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { createPlayer, updateOnFoot, updateDriving, tryEnterCar, shoot, hurtPlayer } from './player.js';
import { createPolice, updatePolice, addHeat, setWanted, hitRoadblock } from './police.js';
import { createMissions, currentMission, currentStage, missionTarget, startMission, updateMissions, saveGame, loadGame, applySave } from './missions.js';
import { drawGame, drawMinimap, updateCamera, screenToWorld } from './render.js';

// 任务横幅用短文案（v3 的毛病：长文案被截断）。只显示编号、标题与短目标。
const BANNER_SHORT = {
  'M1-0': 'Marina Pier', 'M1-1': "Mara's Garage",
  'M2-0': 'Steal the convertible', 'M2-1': 'Chop Shop',
  'M3-0': 'Clear the pier crew', 'M3-1': 'Grab the cash bag',
  'M4-0': 'Airport gate — beat the clock',
};

// 建一个新世界：城市、车流、玩家、警察、任务全部就位。
export function createGame(canvas, opts = {}) {
  const seed = opts.seed ?? 7;
  const city = buildCity(seed);
  const staticCanvas = prerenderCity(city);
  const world = {
    canvas, ctx: canvas.getContext('2d'),
    seed, city, staticCanvas,
    traffic: createTraffic(seed),
    player: createPlayer(),
    police: createPolice(seed),
    missions: createMissions(),
    cashSpots: CASH_SPOTS,
    bullets: [], particles: [],
    toasts: [], toastTimer: 0,
    mode: 'title',
    time: 0, saveTimer: 0,
    cam: { x: 300, y: 1400, zoom: ZOOM_FOOT },
    targetPos: null,
    prevE: false,
    shotMode: null,
  };
  world.mini = document.getElementById('minimap');
  return world;
}

// 开始新游戏（或继续存档）：进 play 模式，M1 开场卡片。
export function startGame(world, useSave) {
  const data = useSave ? loadGame() : null;
  if (data) applySave(world, data);
  else startMission(world.missions, 0, world);
  world.mode = 'play';
  world.saveTimer = 0;
  showOverlay(world, null);
  toast(world, useSave ? 'Welcome back to Palmera.' : 'M1 — First Job: pick up the package at the Marina Pier.');
}

// 发一条 toast（屏幕中上方短暂显示）。
export function toast(world, text) {
  world.toasts = [{ text, t: 3 }];
  world.toastTimer = 3;
  const el = document.getElementById('toast');
  if (el) { el.textContent = text; el.style.opacity = '1'; }
}

// 覆盖层（标题 / 暂停 / 被捕 / 通关）：传 null 隐藏。
export function showOverlay(world, kind) {
  const ov = document.getElementById('overlay');
  if (!ov) return;
  if (!kind) { ov.style.display = 'none'; return; }
  const title = document.getElementById('overlay-title');
  const body = document.getElementById('overlay-body');
  const btns = document.getElementById('overlay-buttons');
  ov.style.display = 'flex';
  if (kind === 'title') {
    title.textContent = 'GOLDEN TIDE';
    body.innerHTML = 'Palmera, golden hour. Cole “Cash” Vega is back in town —<br>four jobs, six cars to steal, and every cop in the city to lose.<br><br>WASD move / drive · E enter or steal a car · Click / Space shoot<br>Shift run · P pause · M mute';
    btns.innerHTML = `<button data-act="new">▶ New Game</button>` +
      (loadGame() ? `<button data-act="continue">↻ Continue — $${loadGame().money}</button>` : '');
  } else if (kind === 'paused') {
    title.textContent = 'PAUSED';
    body.textContent = 'Take a breath. Palmera waits.';
    btns.innerHTML = `<button data-act="resume">▶ Resume</button><button data-act="restart">↻ Restart from save</button>`;
  } else if (kind === 'busted') {
    title.textContent = 'BUSTED!';
    body.textContent = 'The Palmera PD caught up with you. $100 bail, back on the street.';
    btns.innerHTML = `<button data-act="retry">↻ Back on the street</button>`;
  } else if (kind === 'complete') {
    title.textContent = 'GOLDEN TIDE — COMPLETE';
    body.innerHTML = `All four jobs done. Cole walks away with <b>$${world.player.money}</b>.<br>Palmera is yours.`;
    btns.innerHTML = `<button data-act="free">▶ Keep cruising Palmera</button>`;
  }
  btns.querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      sfx('click');
      const act = b.dataset.act;
      if (act === 'new') startGame(world, false);
      else if (act === 'continue') startGame(world, true);
      else if (act === 'resume') togglePause(world, false);
      else if (act === 'restart') { const d = loadGame(); if (d) applySave(world, d); togglePause(world, false); }
      else if (act === 'retry') {
        world.player.money = Math.max(0, world.player.money - 100);
        world.player.hp = 100;
        world.player.x = 300; world.player.y = 1400;
        world.player.inCar = null; world.player.speed = 0;
        setWanted(world.police, 0);
        world.mode = 'play';
        showOverlay(world, null);
        toast(world, 'Out on bail — keep it clean out there.');
      } else if (act === 'free') { world.mode = 'play'; showOverlay(world, null); }
    };
  });
}

// 暂停开关（由 main.js 的按键监听调，循环层消费，暂停时 update 停了也能解开）。
export function togglePause(world, force) {
  if (world.mode !== 'play' && world.mode !== 'paused') return;
  const toPaused = force !== undefined ? force : world.mode === 'play';
  world.mode = toPaused ? 'paused' : 'play';
  if (toPaused) { showOverlay(world, 'paused'); stopEngine(); }
  else showOverlay(world, null);
}

// —— 每帧更新（只在 play 模式跑）。
export function updateGame(world, dt) {
  if (world.mode !== 'play') return;
  world.time += dt;
  const p = world.player;

  // E 键边沿：上车 / 下车。
  const eDown = isDown('KeyE');
  if (eDown && !world.prevE) {
    const ev = tryEnterCar(p, world.city, world.traffic);
    if (ev === 'steal') {
      setWanted(world.police, Math.max(world.police.wanted, 2));
      toast(world, 'Car stolen — wanted level 2!');
    } else if (ev === 'enter') {
      toast(world, 'Behind the wheel.');
    } else if (ev === 'exit') {
      // 下车无提示，保持画面干净。
    }
  }
  world.prevE = eDown;

  // 移动。
  let driveInfo = null;
  if (p.inCar) driveInfo = updateDriving(dt, p, { isDown }, world.city, world.traffic);
  else updateOnFoot(dt, p, { isDown, moveAxis }, world.city);

  // 开枪：鼠标按住或空格，朝鼠标方向打。
  if (!p.inCar && (mouse.down || isDown('Space'))) {
    const aim = screenToWorld(world, mouse.x || world.canvas.width / 2, mouse.y || world.canvas.height / 2);
    const a = Math.atan2(aim.y - p.y, aim.x - p.x);
    if (shoot(p, a, world.bullets)) addHeat(world.police, 12);
  }

  // 子弹：飞、命中枪手 / 玩家、过期。
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && b.from === 'player') {
      for (let gi = world.missions.gunmen.length - 1; gi >= 0; gi--) {
        const g = world.missions.gunmen[gi];
        if (Math.hypot(g.x - b.x, g.y - b.y) < 24) {
          g.hp -= 20;
          spawnSparks(world, b.x, b.y, 6, '#ffd94a');
          sfx('hit');
          if (g.hp <= 0) {
            world.missions.gunmen.splice(gi, 1);
            spawnSparks(world, g.x, g.y, 12, '#ff6b5e');
            toast(world, `Gunman down — ${world.missions.gunmen.length} left.`);
          }
          dead = true;
          break;
        }
      }
    } else if (!dead && b.from === 'enemy') {
      if (!p.inCar && Math.hypot(p.x - b.x, p.y - b.y) < 18) {
        hurtPlayer(p, 8);
        dead = true;
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }

  // 车流、警察、路障。
  updateTraffic(dt, world.traffic, world.city);
  const busted = updatePolice(dt, world.police, p, world.city);
  if (p.inCar) hitRoadblock(world.police, p);
  // 截图布景：钉住 staged 车速（否则松油门 1 秒后仪表盘就掉下来）。
  if (world.shotSpeedKmh && p.inCar) p.speed = world.shotSpeedKmh * 1.55;

  // 任务。
  const events = updateMissions(dt, world.missions, world);
  for (const ev of events) {
    if (ev.type === 'toast') toast(world, ev.text);
    else if (ev.type === 'missionDone') { toast(world, ev.text); saveGame(world); }
    else if (ev.type === 'complete') {
      world.mode = 'complete';
      stopEngine();
      showOverlay(world, 'complete');
      saveGame(world);
    }
  }

  // 被捕 / 血条见底 → 被捕画面。
  if (busted || p.hp <= 0) {
    world.mode = 'busted';
    stopEngine();
    sfx('busted');
    showOverlay(world, 'busted');
    return;
  }

  // 粒子与 toast 计时。
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const pt = world.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(i, 1);
  }
  if (world.toastTimer > 0) {
    world.toastTimer -= dt;
    if (world.toastTimer <= 0) {
      const el = document.getElementById('toast');
      if (el) el.style.opacity = '0';
    }
  }

  // 自动存档：每 5 秒写一次。
  world.saveTimer += dt;
  if (world.saveTimer > 5) { world.saveTimer = 0; saveGame(world); }

  // 目标点（小地图与金环用）。
  world.targetPos = missionTarget(world.missions);

  // 引擎声。
  engineSound(!!p.inCar, driveInfo ? driveInfo.spdRatio : 0);

  // 相机跟随。
  updateCamera(world, dt);

  // HUD。
  syncHud(world, driveInfo);
}

export function spawnSparks(world, x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 60 + Math.random() * 140;
    world.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.4, max: 0.4, size: 3 + Math.random() * 3, color,
    });
  }
}

// —— HUD 同步：金钱、血条、通缉星、横幅、任务卡、车速、静音按钮。
function syncHud(world, driveInfo) {
  const p = world.player;
  const $ = (id) => document.getElementById(id);
  const money = $('hud-money');
  if (money) money.textContent = `$${p.money.toLocaleString('en-US')}`;
  const hp = $('hp-fill');
  if (hp) hp.style.width = `${Math.max(0, p.hp)}%`;
  const stats = $('hud-stats');
  if (stats) stats.textContent = `HP ${Math.round(p.hp)} · AMMO ${p.ammo} · CASH ${world.missions.cashFound.size}/5 · GARAGE ${world.missions.garage.length}/5`;
  const stars = $('wanted-stars');
  if (stars) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < world.police.wanted ? '★' : '☆';
    stars.textContent = s;
    stars.className = world.police.wanted > 0 ? 'hot' : '';
  }
  // 横幅：短文案，保证一行完整显示。
  const banner = $('banner');
  const mis = currentMission(world.missions);
  if (banner) {
    if (mis) {
      const key = `${mis.id}-${world.missions.stage}`;
      banner.textContent = `${mis.id} · ${mis.title} — ${BANNER_SHORT[key] || mis.brief}`;
      banner.style.display = 'block';
    } else if (world.missions.done) {
      banner.textContent = 'ALL JOBS DONE — free roam';
      banner.style.display = 'block';
    } else banner.style.display = 'none';
  }
  // 任务卡：任务开始后显示几秒。
  const card = $('mission-card');
  if (card) {
    const st = currentStage(world.missions);
    if (mis && st && world.missions.bannerTimer > 0) {
      card.style.display = 'block';
      $('mission-card-title').textContent = `${mis.id} — ${mis.title}`;
      const obj = world.missions.index === 3 && mis.timeLimit
        ? `${st.text} (${Math.max(0, Math.ceil(world.missions.timer))}s left)`
        : st.text;
      $('mission-card-obj').textContent = obj;
    } else card.style.display = 'none';
  }
  // 车速：只在开车时显示。
  const speedBox = $('speed-box');
  if (speedBox) {
    if (p.inCar && driveInfo) {
      speedBox.style.display = 'block';
      $('speed-value').textContent = `${Math.round(Math.abs(p.speed) / 1.55)}`;
      $('speed-label').textContent = (world.player.inCar.type && world.player.inCar.type !== 'police')
        ? (world.player.inCar.type === 'taxi' ? 'TAXI' : (world.player.inCar.type === 'convertible' ? 'CONVERTIBLE' : world.player.inCar.type.toUpperCase()))
        : 'POLICE';
    } else speedBox.style.display = 'none';
  }
  // 静音按钮文字。
  const snd = $('sound-btn');
  if (snd) snd.textContent = isMuted() ? '🔇 MUTED' : '🔊 SOUND';
  // 小地图。
  if (world.mini) drawMinimap(world, world.mini);
}

// —— 调试图接口：测试与截图脚本用。
export function debugApi(world) {
  return {
    version: 'v4',
    world,
    state() {
      return {
        mode: world.mode,
        money: world.player.money,
        hp: Math.round(world.player.hp),
        ammo: world.player.ammo,
        wanted: world.police.wanted,
        missionIndex: world.missions.index,
        stage: world.missions.stage,
        cashFound: world.missions.cashFound.size,
        garage: world.missions.garage.length,
        inCar: !!world.player.inCar,
        carType: world.player.inCar ? world.player.inCar.type : null,
        x: Math.round(world.player.x),
        y: Math.round(world.player.y),
        speedKmh: Math.round(Math.abs(world.player.speed) / 1.55),
        policeCars: world.police.cars.length,
        gunmen: world.missions.gunmen.length,
        saveExists: !!localStorage.getItem(SAVE_KEY),
      };
    },
    teleport(x, y) { world.player.x = x; world.player.y = y; if (world.player.inCar) { world.player.inCar.x = x; world.player.inCar.y = y; } world.cam.x = x; world.cam.y = y; },
    setWanted(n) { setWanted(world.police, n); },
    setMoney(n) { world.player.money = n; },
    setAmmo(n) { world.player.ammo = n; },
    skipToMission(i) { startMission(world.missions, i, world); },
    start(useSave) { startGame(world, useSave); },
    save() { return saveGame(world); },
  };
}
