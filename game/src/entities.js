// Solmar Heat — the living city: pedestrians, traffic cars, police
// cruisers, armed thugs, bullets and particles. Each entity is a plain
// object with an update step; the Game owns the lists.

import { WORLD, ROAD_W, CAR, COP, ENEMY, TRAFFIC_COUNT, PED_COUNT } from './config.js';
import { makeRng, range, rangeInt, pick, clamp, angleDiff, angleTo, dist2, circleRectPush } from './rng.js';

const PED_SHIRTS = ['#e8e8e8', '#3d7bd9', '#d94f3d', '#2fae6e', '#e8c33a', '#7a4fd9', '#e87a2a', '#222831'];
const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8c33a', '#7a4fd9', '#2fae6e', '#e8e8e8', '#222831', '#e87a2a', '#4fb3a9'];

export function makePed(city, rng) {
  const p = city.randomSidewalkPoint();
  return {
    kind: 'ped', x: p.x, y: p.y, angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 55, 95), shirt: pick(rng, PED_SHIRTS),
    tx: p.x, ty: p.y, wait: 0, state: 'walk', downTimer: 0, flee: 0,
  };
}

export function makeTrafficCar(city, rng) {
  const p = city.randomRoadPoint();
  const vertical = p.axis === 'v';
  const dir = rng() < 0.5 ? 1 : -1;
  const roadAt = vertical ? p.x : p.y;
  return {
    kind: 'traffic', x: p.x, y: p.y,
    angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    speed: range(rng, 120, 185), color: pick(rng, CAR_COLORS),
    axis: vertical ? 'v' : 'h', dir, lane: (rng() < 0.5 ? -1 : 1) * 34, roadAt,
  };
}

export function makeCopCar(x, y) {
  return {
    kind: 'cop', x, y, angle: 0, speed: 0, color: '#1c2a4a',
    arrestTimer: 0, ramTimer: 0, sirenPhase: Math.random() * Math.PI * 2,
  };
}

export function makeEnemy(x, y) {
  return {
    kind: 'enemy', x, y, angle: 0, hp: ENEMY.hp, maxHp: ENEMY.hp,
    shootTimer: range(Math.random, 0.4, 1.2), state: 'guard', flash: 0,
  };
}

export function makeBullet(x, y, angle, speed, from, damage) {
  return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.1, from, damage };
}

export function makeParticle(x, y, vx, vy, life, color, size) {
  return { x, y, vx, vy, life, maxLife: life, color, size: size || 3 };
}

// --- Pedestrians -----------------------------------------------------------
export function updatePed(ped, dt, city, player, rng) {
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) { ped.state = 'walk'; ped.flee = 2.5; }
    return;
  }
  // Fleeing from a nearby car or gunfire.
  if (ped.flee > 0) {
    ped.flee -= dt;
    const away = angleTo(player.x, player.y, ped.x, ped.y);
    ped.angle = away;
    ped.x += Math.cos(away) * 150 * dt;
    ped.y += Math.sin(away) * 150 * dt;
    ped.x = clamp(ped.x, 40, WORLD.w - 40);
    ped.y = clamp(ped.y, 40, WORLD.h - 40);
    return;
  }
  if (ped.wait > 0) { ped.wait -= dt; return; }
  const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    ped.wait = range(rng, 0.5, 3);
    const t = city.randomSidewalkPoint();
    ped.tx = t.x; ped.ty = t.y;
    return;
  }
  const target = Math.atan2(dy, dx);
  ped.angle += angleDiff(ped.angle, target) * Math.min(1, dt * 8);
  ped.x += Math.cos(ped.angle) * ped.speed * dt;
  ped.y += Math.sin(ped.angle) * ped.speed * dt;
  // Peds stay out of buildings.
  for (const b of city.buildings) {
    const push = circleRectPush(ped.x, ped.y, 12, b);
    if (push) { ped.x += push.x; ped.y += push.y; }
  }
}

// --- Traffic ---------------------------------------------------------------
export function updateTrafficCar(car, dt, city, rng) {
  // Follow the car's own road; at an intersection sometimes turn.
  // car.roadAt is the centre line the car is following, so it never
  // jumps sideways when another road passes closer.
  const speed = car.speed;
  let nx = car.x + Math.cos(car.angle) * speed * dt;
  let ny = car.y + Math.sin(car.angle) * speed * dt;

  if (car.axis === 'v') {
    for (const hy of [360, 880, 1400, 1920]) {
      if (Math.abs(ny - hy) < 46 && rng() < 0.35) {
        car.axis = 'h';
        car.dir = rng() < 0.5 ? 1 : -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
        car.lane = (rng() < 0.5 ? -1 : 1) * 34;
        car.roadAt = hy;
        ny = hy + car.lane;
        break;
      }
    }
    nx = car.roadAt + car.lane;
    ny = clamp(ny, 60, WORLD.h - 60);
    if (ny <= 62 || ny >= WORLD.h - 62) { car.dir *= -1; car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  } else {
    for (const vx of [360, 980, 1600, 2220, 2840]) {
      if (Math.abs(nx - vx) < 46 && rng() < 0.35) {
        car.axis = 'v';
        car.dir = rng() < 0.5 ? 1 : -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.lane = (rng() < 0.5 ? -1 : 1) * 34;
        car.roadAt = vx;
        nx = vx + car.lane;
        break;
      }
    }
    ny = car.roadAt + car.lane;
    nx = clamp(nx, 60, WORLD.w - 60);
    if (nx <= 62 || nx >= WORLD.w - 62) { car.dir *= -1; car.angle = car.dir > 0 ? 0 : Math.PI; }
  }
  car.x = nx; car.y = ny;
}

// --- Police ------------------------------------------------------------------
export function updateCopCar(cop, dt, target, playerSpeed, game) {
  const d = Math.hypot(target.x - cop.x, target.y - cop.y);
  const want = angleTo(cop.x, cop.y, target.x, target.y);
  cop.angle += clamp(angleDiff(cop.angle, want), -COP.turnRate * dt, COP.turnRate * dt);
  // Cops close in fast but overshoot a little, so a good driver can shake them.
  const desired = d > 260 ? COP.maxSpeed : COP.maxSpeed * 0.82;
  cop.speed += (desired - cop.speed) * Math.min(1, dt * 1.6);
  cop.x += Math.cos(cop.angle) * cop.speed * dt;
  cop.y += Math.sin(cop.angle) * cop.speed * dt;
  cop.x = clamp(cop.x, 40, WORLD.w - 40);
  cop.y = clamp(cop.y, 40, WORLD.h - 40);
  // Bumping into buildings slows a cruiser down hard.
  for (const b of game.city.solidRects()) {
    const push = circleRectPush(cop.x, cop.y, CAR.radius, b);
    if (push) { cop.x += push.x; cop.y += push.y; cop.speed *= 0.5; }
  }
  // Arrest: close and slow for long enough.
  if (d < COP.arrestRange && playerSpeed < 55) {
    cop.arrestTimer += dt;
  } else {
    cop.arrestTimer = Math.max(0, cop.arrestTimer - dt * 2);
  }
  cop.sirenPhase += dt * 6;
  cop.ramTimer = Math.max(0, (cop.ramTimer || 0) - dt);
  return cop.arrestTimer >= COP.arrestSeconds;
}

// --- Enemies -------------------------------------------------------------------
export function updateEnemy(e, dt, player, game) {
  const d = Math.hypot(player.x - e.x, player.y - e.y);
  e.flash = Math.max(0, e.flash - dt);
  if (d < ENEMY.shootRange) {
    e.state = 'combat';
    e.angle = angleTo(e.x, e.y, player.x, player.y);
    if (d > 260) {
      e.x += Math.cos(e.angle) * ENEMY.speed * dt;
      e.y += Math.sin(e.angle) * ENEMY.speed * dt;
    }
    e.shootTimer -= dt;
    if (e.shootTimer <= 0) {
      e.shootTimer = ENEMY.shootCooldown * range(Math.random, 0.85, 1.25);
      const spread = range(Math.random, -0.14, 0.14);
      game.spawnBullet(e.x + Math.cos(e.angle) * 20, e.y + Math.sin(e.angle) * 20,
        e.angle + spread, 620, 'enemy', ENEMY.damage);
      game.sounds.enemyShot();
    }
  } else {
    e.state = 'guard';
  }
  for (const b of game.city.buildings) {
    const push = circleRectPush(e.x, e.y, ENEMY.radius, b);
    if (push) { e.x += push.x; e.y += push.y; }
  }
}

// --- Shared spawners ------------------------------------------------------------
export function spawnCrowd(city) {
  const rng = makeRng(777);
  const peds = [];
  for (let i = 0; i < PED_COUNT; i++) peds.push(makePed(city, rng));
  const traffic = [];
  for (let i = 0; i < TRAFFIC_COUNT; i++) traffic.push(makeTrafficCar(city, rng));
  return { peds, traffic, rng };
}
