// Solmar Heat — the game itself: player, driving, crime and wanted
// level, police pursuit, combat, busted/wasted, HUD and saves.
// One Game owns the world, the entities and the mission manager.

import { WORLD, PLAYER, CAR, CRIME, COP, START_MONEY, BUSTED_FINE, BUSTED_FINE_RATE,
  KILL_REWARD, SAVE_KEY, copsForStars } from './config.js';
import { buildCity, LANDMARKS } from './city.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { MissionManager } from './missions.js';
import { makePed, makeTrafficCar, makeCopCar, makeEnemy, makeBullet, makeParticle,
  updatePed, updateTrafficCar, updateCopCar, updateEnemy, spawnCrowd } from './entities.js';
import { renderWorld, renderMinimap } from './render.js';
import { clamp, angleDiff, angleTo, dist2, circleRectPush, makeRng } from './rng.js';

export class Game {
  constructor(canvas, minimapCanvas, hud) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimap = minimapCanvas;
    this.minimapCtx = minimapCanvas.getContext('2d');
    this.hud = hud; // { money, healthFill, healthText, stars, objective, banner, bannerTitle, bannerText, speed, prompt, timer, toast }
    this.input = new Input(canvas);
    this.sounds = new SoundBank();
    this.city = buildCity();
    this.missions = new MissionManager(this);
    this.rng = makeRng(4242);

    this.state = 'title'; // title | playing | paused | busted | wasted
    this.time = 0;
    this.stateTimer = 0;

    // Player.
    this.player = {
      x: LANDMARKS.garage.x, y: LANDMARKS.garage.y + 150,
      angle: -Math.PI / 2, health: 100, lastHurt: -99,
      gunTimer: 0, walkPhase: 0, moving: false,
    };
    this.money = START_MONEY;
    this.wanted = 0;
    this.crimeCooldown = 0; // seconds until another crime can raise stars
    this.quietTimer = 0;    // seconds since the last crime

    // Driving.
    this.inCar = false;
    this.car = null; // the car the player drives, when in one

    // World life.
    const crowd = spawnCrowd(this.city);
    this.peds = crowd.peds;
    this.traffic = crowd.traffic;
    this.parkedCars = this.city.parkedCars.slice();
    this.cops = [];
    this.enemies = [];
    this.bullets = [];
    this.particles = [];

    this.cam = { x: 0, y: 0, w: 1280, h: 720 };
    this.objectiveText = 'Talk to Vera — Mission 1 is waiting at the garage.';
    this.promptText = '';
    this.toastText = '';
    this.toastUntil = 0;
    this.shootStarTimer = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.floor(this.canvas.clientHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cam.w = this.canvas.clientWidth;
    this.cam.h = this.canvas.clientHeight;
  }

  // --- Flow ---------------------------------------------------------------
  startGame(fresh) {
    this.sounds.unlock();
    if (fresh) {
      this.money = START_MONEY;
      this.player.health = 100;
      this.player.x = LANDMARKS.garage.x;
      this.player.y = LANDMARKS.garage.y + 150;
      this.wanted = 0;
      this.missions.index = 0;
      this.missions.completedCount = 0;
      this.clearEnemies();
      this.cops = [];
      this.save();
    }
    this.state = 'playing';
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    if (!this.missions.active && this.missions.index >= 0 && this.missions.index < 3) {
      this.missions.startMission(this.missions.index);
    }
    this.sounds.click();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      document.getElementById('pause-screen').classList.remove('hidden');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      document.getElementById('pause-screen').classList.add('hidden');
    }
  }

  // --- Crime / wanted -------------------------------------------------------
  addWanted(stars, reason) {
    if (this.wanted >= CRIME.maxStars) return;
    this.wanted = Math.min(CRIME.maxStars, this.wanted + stars);
    this.quietTimer = 0;
    this.toast(reason + ' — wanted level up!', 2.5);
  }

  // --- Spawning ---------------------------------------------------------------
  spawnEnemy(x, y) { this.enemies.push(makeEnemy(x, y)); }
  clearEnemies() { this.enemies = []; }
  spawnBullet(x, y, angle, speed, from, damage) {
    this.bullets.push(makeBullet(x, y, angle, speed, from, damage));
  }
  burst(x, y, n, color, speed) {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = (speed || 160) * (0.4 + this.rng() * 0.8);
      this.particles.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + this.rng() * 0.4, color, 2 + this.rng() * 3));
    }
  }

  setObjective(text) { this.objectiveText = text; }
  setPrompt(text) { this.promptText = text; }
  toast(text, seconds) { this.toastText = text; this.toastUntil = this.time + (seconds || 3); }

  // --- Save / load ------------------------------------------------------------
  save() {
    try {
      const data = {
        money: this.money,
        health: Math.round(this.player.health),
        x: Math.round(this.player.x), y: Math.round(this.player.y),
        missionIndex: this.missions.index,
        completedCount: this.missions.completedCount,
        wanted: this.wanted,
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) { /* storage unavailable — the game still plays */ }
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  applySave(data) {
    this.money = data.money ?? START_MONEY;
    this.player.health = data.health ?? 100;
    this.player.x = data.x ?? LANDMARKS.garage.x;
    this.player.y = data.y ?? LANDMARKS.garage.y + 150;
    this.missions.index = data.missionIndex ?? 0;
    this.missions.completedCount = data.completedCount ?? 0;
    this.wanted = 0; // a fresh session starts clean
  }

  // --- Main update --------------------------------------------------------------
  update(dt) {
    this.time += dt;
    // Pause toggles from either side of the pause, so it is checked
    // before the playing-only early return below.
    if (this.input.pressed('Escape') || this.input.pressed('KeyP')) {
      if (this.state === 'playing' || this.state === 'paused') {
        this.togglePause();
        this.input.endFrame();
        return;
      }
    }
    if (this.state !== 'playing') { this.input.endFrame(); return; }

    this.crimeCooldown = Math.max(0, this.crimeCooldown - dt);
    this.quietTimer += dt;
    this.shootStarTimer = Math.max(0, this.shootStarTimer - dt);

    // Wanted decay: stay quiet long enough and one star cools off.
    if (this.wanted > 0 && this.quietTimer > CRIME.decaySeconds) {
      this.wanted--;
      this.quietTimer = 0;
      this.toast('The heat is cooling off…', 2);
    }

    if (this.inCar) this.updateDriving(dt);
    else this.updateOnFoot(dt);

    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.updateCops(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.missions.update(dt);

    // Health regen after a quiet stretch.
    if (this.time - this.player.lastHurt > 6 && this.player.health < 100) {
      this.player.health = Math.min(100, this.player.health + 6 * dt);
    }

    // Replay the story from the garage.
    if (this.input.pressed('KeyR') && this.missions.index === -1) {
      const d = Math.hypot(this.player.x - LANDMARKS.garage.x, this.player.y - LANDMARKS.garage.y);
      if (d < 220) {
        this.missions.index = 0; this.missions.completedCount = 0;
        this.missions.startMission(0);
      }
    }

    // Mute toggle.
    if (this.input.pressed('KeyM')) this.sounds.setMuted(!this.sounds.muted);

    this.updateHud();
    this.input.endFrame();
  }

  // --- On foot ------------------------------------------------------------------
  updateOnFoot(dt) {
    const p = this.player;
    const mv = this.input.moveVector();
    const sprint = this.input.down('ShiftLeft') || this.input.down('ShiftRight');
    const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    p.moving = mv.x !== 0 || mv.y !== 0;
    if (p.moving) {
      p.x += mv.x * speed * dt;
      p.y += mv.y * speed * dt;
      p.angle = Math.atan2(mv.y, mv.x);
      p.walkPhase += dt * 10;
    }
    p.x = clamp(p.x, 20, WORLD.w - 20);
    p.y = clamp(p.y, 20, WORLD.h - 20);
    this.collideCircle(p, PLAYER.radius);

    // Aim follows the mouse; the player faces the cursor when shooting.
    const aim = this.mouseAim();
    if (this.input.mouse.down || this.input.down('Space')) {
      p.angle = aim.angle;
      this.tryShoot(dt);
    }
    p.gunTimer = Math.max(0, p.gunTimer - dt);

    // Enter / exit cars.
    if (this.input.pressed('KeyE')) this.tryEnterCar();
    this.nearCarPrompt();
  }

  mouseAim() {
    const wx = this.cam.x + this.input.mouse.x;
    const wy = this.cam.y + this.input.mouse.y;
    return { x: wx, y: wy, angle: angleTo(this.player.x, this.player.y, wx, wy) };
  }

  tryShoot(dt) {
    const p = this.player;
    if (p.gunTimer > 0) return;
    p.gunTimer = PLAYER.gunCooldown;
    const aim = this.mouseAim();
    const gx = p.x + Math.cos(aim.angle) * 22;
    const gy = p.y + Math.sin(aim.angle) * 22;
    this.spawnBullet(gx, gy, aim.angle, PLAYER.bulletSpeed, 'player', PLAYER.gunDamage);
    this.sounds.gunshot();
    this.burst(gx, gy, 4, '#ffd23e', 220);
    // Firing in public draws heat, but not more than once every few seconds.
    if (this.wanted < CRIME.maxStars && this.shootStarTimer <= 0) {
      this.shootStarTimer = 4;
      this.addWanted(CRIME.shootInPublic, 'Shots fired in public');
    }
  }

  nearCarPrompt() {
    const car = this.nearestCar(PLAYER.interactRange);
    if (car) this.setPrompt('Press E to get in the car');
  }

  nearestCar(range) {
    let best = null, bd = range * range;
    for (const c of this.parkedCars) {
      const d = dist2(this.player.x, this.player.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    for (const c of this.traffic) {
      const d = dist2(this.player.x, this.player.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  tryEnterCar() {
    const car = this.nearestCar(PLAYER.interactRange);
    if (!car) return;
    // Pull the car out of its list and make it the player's ride.
    const pi = this.parkedCars.indexOf(car);
    if (pi >= 0) this.parkedCars.splice(pi, 1);
    const ti = this.traffic.indexOf(car);
    if (ti >= 0) this.traffic.splice(ti, 1);
    this.car = {
      x: car.x, y: car.y, angle: car.angle, speed: 0,
      color: car.color, targetCar: !!car.targetCar, hp: 100,
    };
    this.inCar = true;
    this.sounds.engineStart();
    this.sounds.pickup();
    if (!car.targetCar) this.addWanted(CRIME.stealCar, 'Car stolen');
    else this.toast('Nice wheels. Now get out of here.', 3);
  }

  exitCar() {
    if (!this.car) return;
    const c = this.car;
    this.player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 34;
    this.player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 34;
    this.player.angle = c.angle;
    // The car stays parked where it was left.
    this.parkedCars.push({ x: c.x, y: c.y, angle: c.angle, color: c.color, parked: true, targetCar: c.targetCar });
    this.car = null;
    this.inCar = false;
    this.sounds.engineStop();
  }

  // --- Driving ------------------------------------------------------------------
  updateDriving(dt) {
    const c = this.car;
    const fwd = this.input.down('KeyW') || this.input.down('ArrowUp');
    const back = this.input.down('KeyS') || this.input.down('ArrowDown');
    const left = this.input.down('KeyA') || this.input.down('ArrowLeft');
    const right = this.input.down('KeyD') || this.input.down('ArrowRight');

    if (fwd) c.speed += CAR.accel * dt;
    else if (back) c.speed -= (c.speed > 20 ? CAR.brake : CAR.reverseAccel) * dt;
    else {
      // Rolling drag when no pedal is pressed.
      c.speed -= c.speed * CAR.drag * dt;
      if (Math.abs(c.speed) < 4) c.speed = 0;
    }
    c.speed = clamp(c.speed, -CAR.maxReverse, CAR.maxSpeed);
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    const moving = Math.abs(c.speed) > 12;
    if (steer !== 0 && moving) {
      const dir = c.speed >= 0 ? 1 : -1;
      c.angle += steer * CAR.turnRate * dt * dir * clamp(Math.abs(c.speed) / 220, 0.25, 1);
    }
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    c.x = clamp(nx, 30, WORLD.w - 30);
    c.y = clamp(ny, 30, WORLD.h - 30);
    const hit = this.collideCircle(c, CAR.radius);
    if (hit) {
      if (Math.abs(c.speed) > 240) { this.sounds.crash(); this.burst(c.x, c.y, 10, '#ff9a3d', 260); }
      else if (Math.abs(c.speed) > 60) this.sounds.bump();
      c.speed *= 0.45;
    }
    this.player.x = c.x;
    this.player.y = c.y;
    this.player.angle = c.angle;
    this.sounds.engineSet(Math.abs(c.speed) / CAR.maxSpeed);

    // Hit-and-run: running over a pedestrian is a crime.
    for (const ped of this.peds) {
      if (ped.state !== 'walk') continue;
      if (dist2(c.x, c.y, ped.x, ped.y) < (CAR.radius + 12) * (CAR.radius + 12)) {
        ped.state = 'down'; ped.downTimer = 4;
        this.burst(ped.x, ped.y, 8, '#d94f3d', 180);
        this.sounds.crash();
        this.addWanted(CRIME.hitPedestrian, 'Pedestrian hit');
        for (const other of this.peds) {
          if (dist2(ped.x, ped.y, other.x, other.y) < 300 * 300) other.flee = 2.5;
        }
      }
    }
    // Bump traffic cars aside.
    for (const t of this.traffic) {
      const d2 = dist2(c.x, c.y, t.x, t.y);
      if (d2 < 44 * 44) {
        const d = Math.sqrt(d2) || 1;
        const push = (44 - d) / 2;
        const ux = (t.x - c.x) / d, uy = (t.y - c.y) / d;
        t.x += ux * push; t.y += uy * push;
        c.speed *= 0.7;
        if (Math.abs(c.speed) > 120) this.sounds.bump();
      }
    }

    // Shooting from the car is not allowed; E steps out.
    if (this.input.pressed('KeyE')) this.exitCar();
    this.player.gunTimer = Math.max(0, this.player.gunTimer - dt);
  }

  // Push a circle out of every solid rect. Returns true if it hit anything.
  collideCircle(obj, radius, isCar) {
    let hit = false;
    for (const r of this.city.solidRects()) {
      const push = circleRectPush(obj.x, obj.y, radius, r);
      if (push) { obj.x += push.x; obj.y += push.y; hit = true; }
    }
    return hit;
  }

  // --- World life ---------------------------------------------------------------
  updateTraffic(dt) {
    for (const t of this.traffic) updateTrafficCar(t, dt, this.city, this.rng);
    // Keep the streets full: replace cars that wandered too far.
    if (this.traffic.length < 10) this.traffic.push(makeTrafficCar(this.city, this.rng));
  }

  updatePeds(dt) {
    for (const p of this.peds) updatePed(p, dt, this.city, this.player, this.rng);
    if (this.peds.length < 20) this.peds.push(makePed(this.city, this.rng));
  }

  updateCops(dt) {
    const want = copsForStars(this.wanted);
    const target = this.player;
    const playerSpeed = this.inCar ? Math.abs(this.car.speed) : (this.player.moving ? 200 : 0);
    // Spawn cruisers on the road network, off-screen from the player.
    while (this.cops.length < want) {
      let x = 0, y = 0, tries = 0;
      do {
        const p = this.city.randomRoadPoint();
        x = p.x; y = p.y; tries++;
      } while (Math.hypot(x - target.x, y - target.y) < COP.spawnDistance && tries < 12);
      this.cops.push(makeCopCar(x, y));
    }
    // Despawn the surplus when heat cools, and cruisers left far behind.
    while (this.cops.length > want) this.cops.pop();
    let busted = false;
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      if (Math.hypot(cop.x - target.x, cop.y - target.y) > COP.despawnDistance && this.cops.length > 1) {
        this.cops.splice(i, 1);
        continue;
      }
      if (updateCopCar(cop, dt, target, playerSpeed, this)) busted = true;
      // A cruiser ramming the player's car: a gentle separation every
      // frame, but the hard hit (speed loss, damage, sound) only once
      // per cooldown, so a ram does not glue the cruiser to the player.
      if (this.inCar && this.car) {
        const d2 = dist2(cop.x, cop.y, this.car.x, this.car.y);
        if (d2 < 46 * 46) {
          const d = Math.sqrt(d2) || 1;
          const ux = (this.car.x - cop.x) / d, uy = (this.car.y - cop.y) / d;
          this.car.x += ux * 60 * dt;
          this.car.y += uy * 60 * dt;
          cop.x -= ux * 60 * dt;
          cop.y -= uy * 60 * dt;
          if (cop.ramTimer <= 0) {
            cop.ramTimer = 1.4;
            cop.speed *= 0.55;
            this.car.speed *= 0.85;
            this.sounds.bump();
            this.burst(this.car.x, this.car.y, 6, '#ff9a3d', 200);
            if (Math.abs(this.car.speed) > 150) this.hurtPlayer(COP.ramDamage);
          }
        }
      }
    }
    // Siren only while a pursuit is on.
    if (this.cops.length > 0) this.sounds.sirenStart();
    else this.sounds.sirenStop();
    if (busted) this.getBusted();
  }

  updateEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      updateEnemy(e, dt, this.player, this);
      if (e.hp <= 0) {
        this.money += KILL_REWARD;
        this.burst(e.x, e.y, 14, '#d94f3d', 240);
        this.toast('Thug down — +$' + KILL_REWARD, 2);
        this.sounds.cash();
        this.enemies.splice(i, 1);
        this.save();
      }
    }
  }

  updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > WORLD.w || b.y < 0 || b.y > WORLD.h;
      if (!dead) {
        for (const r of this.city.solidRects()) {
          if (b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h) {
            this.burst(b.x, b.y, 5, '#e8e4c8', 160);
            dead = true; break;
          }
        }
      }
      if (!dead && b.from === 'player') {
        for (const e of this.enemies) {
          if (dist2(b.x, b.y, e.x, e.y) < 20 * 20) {
            e.hp -= b.damage; e.flash = 0.15;
            this.burst(b.x, b.y, 6, '#ffd23e', 200);
            dead = true; break;
          }
        }
        if (!dead) {
          for (const ped of this.peds) {
            if (ped.state === 'walk' && dist2(b.x, b.y, ped.x, ped.y) < 15 * 15) {
              ped.state = 'down'; ped.downTimer = 6;
              this.burst(b.x, b.y, 6, '#d94f3d', 180);
              this.addWanted(CRIME.hitPedestrian, 'Pedestrian shot');
              dead = true; break;
            }
          }
        }
        if (!dead) {
          for (let ci = this.cops.length - 1; ci >= 0; ci--) {
            const cop = this.cops[ci];
            if (dist2(b.x, b.y, cop.x, cop.y) < 24 * 24) {
              cop.hp = (cop.hp || 100) - b.damage;
              this.burst(b.x, b.y, 6, '#9db4ff', 200);
              dead = true;
              if (cop.hp <= 0) {
                this.burst(cop.x, cop.y, 16, '#ff9a3d', 280);
                this.sounds.crash();
                this.cops.splice(ci, 1);
                this.addWanted(1, 'Cruiser disabled');
              }
              break;
            }
          }
        }
      }
      if (!dead && b.from === 'enemy') {
        const r = this.inCar ? CAR.radius : PLAYER.radius;
        if (dist2(b.x, b.y, this.player.x, this.player.y) < r * r) {
          this.hurtPlayer(b.damage);
          this.burst(b.x, b.y, 5, '#d94f3d', 160);
          dead = true;
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.92; p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  // --- Damage, busted, wasted ----------------------------------------------------
  hurtPlayer(dmg) {
    this.player.health -= dmg;
    this.player.lastHurt = this.time;
    if (this.player.health <= 0) {
      this.player.health = 0;
      this.getWasted();
    }
  }

  getBusted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.stateTimer = 2.6;
    const fine = Math.min(this.money, Math.max(BUSTED_FINE, Math.round(this.money * BUSTED_FINE_RATE)));
    this.money -= fine;
    this.sounds.busted();
    this.sounds.sirenStop();
    if (this.inCar) { this.sounds.engineStop(); this.inCar = false; this.car = null; }
    document.getElementById('busted-screen').classList.remove('hidden');
    document.getElementById('busted-fine').textContent = 'Fine paid: $' + fine;
    this.cops = [];
    this.wanted = 0;
    this.missions.restartCurrent();
    this.save();
  }

  getWasted() {
    if (this.state !== 'playing') return;
    this.state = 'wasted';
    this.stateTimer = 2.6;
    const fine = Math.min(this.money, 100);
    this.money -= fine;
    this.sounds.wasted();
    this.sounds.sirenStop();
    if (this.inCar) { this.sounds.engineStop(); this.inCar = false; this.car = null; }
    document.getElementById('wasted-screen').classList.remove('hidden');
    this.cops = [];
    this.wanted = 0;
    this.missions.restartCurrent();
    this.save();
  }

  respawnAtGarage() {
    this.player.x = LANDMARKS.garage.x;
    this.player.y = LANDMARKS.garage.y + 150;
    this.player.health = 100;
    document.getElementById('busted-screen').classList.add('hidden');
    document.getElementById('wasted-screen').classList.add('hidden');
    this.state = 'playing';
  }

  // --- HUD -----------------------------------------------------------------------
  updateHud() {
    const h = this.hud;
    h.money.textContent = '$' + this.money;
    h.healthFill.style.width = Math.max(0, this.player.health) + '%';
    h.healthText.textContent = Math.ceil(this.player.health) + ' HP';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < this.wanted ? '★' : '☆';
    h.stars.textContent = stars;
    h.stars.classList.toggle('hot', this.wanted > 0);
    h.objective.textContent = this.objectiveText;
    const step = this.missions.currentStep;
    h.objective.classList.toggle('hidden', !this.missions.active && this.missions.index === -1);
    if (this.missions.banner && this.time < this.missions.banner.until) {
      h.banner.classList.remove('hidden');
      h.bannerTitle.textContent = this.missions.banner.title;
      h.bannerText.textContent = this.missions.banner.text;
    } else {
      h.banner.classList.add('hidden');
    }
    if (this.inCar && this.car) {
      h.speed.classList.remove('hidden');
      h.speed.textContent = Math.round(Math.abs(this.car.speed) * 0.32) + ' mph';
    } else {
      h.speed.classList.add('hidden');
    }
    h.prompt.textContent = this.promptText;
    h.prompt.classList.toggle('hidden', !this.promptText);
    this.promptText = '';
    if (this.missions.timerRunning && this.missions.timer > 0) {
      h.timer.classList.remove('hidden');
      h.timer.textContent = '⏱ ' + Math.ceil(this.missions.timer) + 's';
      h.timer.classList.toggle('urgent', this.missions.timer < 20);
    } else {
      h.timer.classList.add('hidden');
    }
    if (this.time < this.toastUntil) {
      h.toast.classList.remove('hidden');
      h.toast.textContent = this.toastText;
    } else {
      h.toast.classList.add('hidden');
    }
  }

  // --- Frame ---------------------------------------------------------------------
  frame(now) {
    const dt = Math.min(0.05, (now - (this._last || now)) / 1000 || 0.016);
    this._last = now;
    if (this.state === 'busted' || this.state === 'wasted') {
      this.stateTimer -= dt;
      if (this.stateTimer <= 0) this.respawnAtGarage();
    }
    this.update(dt);
    // Camera follows the player (or the car), clamped to the world.
    const px = this.inCar && this.car ? this.car.x : this.player.x;
    const py = this.inCar && this.car ? this.car.y : this.player.y;
    const tx = clamp(px - this.cam.w / 2, 0, WORLD.w - this.cam.w);
    const ty = clamp(py - this.cam.h / 2, 0, WORLD.h - this.cam.h);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 6);
    renderWorld(this);
    renderMinimap(this);
  }
}
