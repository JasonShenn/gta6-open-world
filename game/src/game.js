// GOLDEN TIDE — game.js
// One job: the game state machine — create the world, step it every frame,
// save and load the run, and own the camera. Systems plug in here; the loop
// lives in main.js, the drawing in render.js.

import { WORLD, VIEW, START_MONEY, SAVE_KEY, MISSIONS, CAR_TYPES, ZOOM } from './config.js';
import { buildCity } from './city.js';
import { createTraffic, updateTraffic } from './traffic.js';
import { makePlayer, updatePlayer, updateBullets } from './player.js';
import { makeWanted, updateWanted } from './police.js';
import { makeMissionState, updateMissions, ensureMissionCars, ensureGunmen, updateGunmen } from './missions.js';
import { SoundBank } from './audio.js';
import { stageShot } from './shots.js';

export class Game {
  constructor(seed) {
    this.seed = seed;
    this.city = buildCity(seed);
    this.traffic = createTraffic(this.city, seed);
    this.player = makePlayer();
    this.wanted = makeWanted();
    this.missions = makeMissionState();
    this.sounds = new SoundBank();
    this.cars = []; // every drivable car in the world (traffic NPCs live in traffic.cars too)
    this.police = [];
    this.roadblocks = [];
    this.gunmen = [];
    this.bullets = [];
    this.particles = [];
    this.toasts = [];
    this.banner = null;
    this.mode = 'title';
    this.time = 0;
    this.money = START_MONEY;
    this.cashFound = 0;
    this.bustedFine = 0;
    this.frozen = false;
    this.saveExists = false;
    this.camera = { x: 660, y: 2540 };
    this.shake = 0;
    // A few parked cars around the garage so the player can drive right away.
    this._seedParkedCars();
    this.loadSave();
  }

  _seedParkedCars() {
    // Parked cars near the garage, built from the same type table as makeCar.
    const defs = [
      { type: 'sedan', x: 1150, y: 2980, a: 0 },
      { type: 'taxi', x: 1450, y: 2980, a: Math.PI },
      { type: 'sports', x: 1150, y: 3120, a: Math.PI / 2 },
    ];
    for (const d of defs) {
      const t = CAR_TYPES[d.type];
      this.cars.push({ id: 'park-' + d.type, type: d.type, name: t.name, color: t.color, x: d.x, y: d.y, angle: d.a, speed: 0, len: t.len, wid: t.wid, top: t.top, accel: t.accel, grip: t.grip, npc: false, police: false, owned: false, siren: 0, health: 100 });
    }
  }

  toast(text, color) {
    this.toasts.push({ text, color: color || '#fff', t: 4 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  start(fresh) {
    this.sounds.ensure();
    if (fresh) {
      this.money = START_MONEY; this.missions = makeMissionState(); this.cashFound = 0;
      for (const s of this.city.cashSpots) s.taken = false;
      this.player = makePlayer();
      this.wanted = makeWanted();
      this.saveExists = false;
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
    }
    this.mode = 'play';
    this.banner = { title: 'M1 — FIRST JOB', sub: MISSIONS[0].brief, t: 5 };
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.money, missionIndex: this.missions.index, missionStage: this.missions.stage,
        cashFound: this.cashFound, garage: this.player.garage,
        cashTaken: this.city.cashSpots.map((s) => s.taken),
      }));
    } catch (e) { /* storage unavailable */ }
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.saveExists = true;
      this.money = s.money ?? START_MONEY;
      this.missions.index = Math.min(s.missionIndex ?? 0, MISSIONS.length - 1);
      this.missions.stage = s.missionStage ?? 0;
      this.cashFound = s.cashFound ?? 0;
      this.player.garage = s.garage ?? [];
      (s.cashTaken || []).forEach((taken, i) => { if (this.city.cashSpots[i]) this.city.cashSpots[i].taken = taken; });
    } catch (e) { /* corrupt save: start fresh */ }
  }

  update(input, dt) {
    if (this.mode === 'title' || this.mode === 'paused' || this.frozen) return;
    if (this.mode === 'busted' || this.mode === 'complete') {
      // Click to get back in: the click is consumed by main.js calling resume().
      return;
    }
    this.time += dt;
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    for (const pt of this.particles) pt.life -= dt;
    this.particles = this.particles.filter((pt) => pt.life > 0);

    ensureMissionCars(this);
    ensureGunmen(this);
    updatePlayer(this, input, dt);
    updateBullets(this, dt);
    updateGunmen(this, dt);
    updateTraffic(this, dt);
    updateWanted(this, dt);
    updateMissions(this, dt);

    // Camera follows the player with a little speed look-ahead, plus shake on rams.
    // The visible world rect is the viewport divided by the zoom.
    const p = this.player;
    const look = p.car ? Math.min(120, Math.abs(p.car.speed) * 0.25) : 0;
    const tx = p.x - (VIEW.w / ZOOM) / 2 + Math.cos(p.angle) * look;
    const ty = p.y - (VIEW.h / ZOOM) / 2 + Math.sin(p.angle) * look;
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 5);
    this.camera.x = Math.max(0, Math.min(WORLD.w - VIEW.w / ZOOM, this.camera.x));
    this.camera.y = Math.max(0, Math.min(WORLD.h - VIEW.h / ZOOM, this.camera.y));
    if (p.car && Math.abs(p.car.speed) > 380) this.shake = 2;
    else this.shake = Math.max(0, this.shake - dt * 8);

    // Autosave every few seconds while playing.
    this._saveTimer = (this._saveTimer || 0) + dt;
    if (this._saveTimer > 6) { this._saveTimer = 0; this.save(); }
  }

  // Screenshot staging: freeze the world on one composed frame.
  applyShot(name) {
    stageShot(this, name);
  }

  resume() {
    if (this.mode === 'busted' || this.mode === 'complete') {
      const wasComplete = this.mode === 'complete';
      this.mode = 'play';
      this.banner = { title: wasComplete ? 'FREE ROAM' : 'BACK ON THE STREET', sub: 'Palmera is still yours for the taking.', t: 4 };
    }
  }
}
