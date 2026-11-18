// GOLDEN TIDE — player.js
// One job: Cole "Cash" Vega — walking, driving, stealing cars, shooting.
// Movement, car physics, entering/exiting, bullets and damage live here.

import { CAR_TYPES, WORLD, ZOOM } from './config.js';
import { isRoad } from './city.js';

export function makePlayer() {
  return {
    x: 1300, y: 2900, angle: -Math.PI / 2, speed: 0, onFoot: true,
    car: null, health: 100, ammo: 24, aimAngle: 0, shootCd: 0,
    walkPhase: 0, lastCrimeAt: -999, garage: [], // distinct car types collected
  };
}

export function makeCar(type, x, y, angle, opts) {
  const t = CAR_TYPES[type];
  return {
    id: 'c' + Math.random().toString(36).slice(2, 8),
    type, name: t.name, color: (opts && opts.color) || t.color,
    x, y, angle: angle || 0, speed: 0,
    len: t.len, wid: t.wid, top: t.top, accel: t.accel, grip: t.grip,
    npc: !!(opts && opts.npc), police: type === 'police', owned: !!(opts && opts.owned),
    siren: 0, health: 100,
  };
}

// Nearest drivable car within reach of the player (on foot or in a car).
export function nearestCar(world, maxDist) {
  const p = world.player; let best = null, bestD = maxDist;
  for (const c of world.cars) {
    if (c.police && c.chasing) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function updatePlayer(world, input, dt) {
  const p = world.player;
  p.shootCd = Math.max(0, p.shootCd - dt);
  // Aim follows the mouse in world space (mouse is in screen space: un-zoom it).
  const wx = world.camera.x + input.mouse.x / ZOOM, wy = world.camera.y + input.mouse.y / ZOOM;
  p.aimAngle = Math.atan2(wy - p.y, wx - p.x);

  if (p.onFoot) updateOnFoot(world, input, dt);
  else updateDriving(world, input, dt);

  // E: get in / out of a car, or steal the nearest one.
  if (input.hit('e')) {
    if (p.onFoot) {
      const car = nearestCar(world, 64);
      if (car) {
        const wasParked = !car.npc && !car.owned;
        p.car = car; p.onFoot = false; p.x = car.x; p.y = car.y;
        if (!car.owned && !car.npc) {
          car.owned = true; world.wanted.heat += 1.2; p.lastCrimeAt = world.time;
          world.sounds.crash();
          world.toast('Car stolen! The cops are coming.', '#ff9a5c');
          if (!p.garage.includes(car.type)) p.garage.push(car.type);
        } else if (car.npc) {
          car.npc = false; world.wanted.heat += 1.0; p.lastCrimeAt = world.time;
          world.toast('You jacked a ' + car.name + '! Wanted level up.', '#ff9a5c');
          if (!p.garage.includes(car.type)) p.garage.push(car.type);
        }
        world.sounds.pickup();
      }
    } else {
      const car = p.car; p.car = null; p.onFoot = true;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      p.angle = car.angle; p.speed = 0;
    }
  }

  // Shoot: mouse click or Space, on foot or leaning out of the car.
  if ((input.mouse.clicked || input.down(' ')) && p.shootCd <= 0 && p.ammo > 0) {
    p.shootCd = 0.28; p.ammo -= 1;
    const bx = p.x + Math.cos(p.aimAngle) * 26, by = p.y + Math.sin(p.aimAngle) * 26;
    world.bullets.push({ x: bx, y: by, vx: Math.cos(p.aimAngle) * 900, vy: Math.sin(p.aimAngle) * 900, life: 0.6, fromPlayer: true });
    world.particles.push({ x: bx, y: by, vx: 0, vy: 0, life: 0.1, max: 0.1, size: 9, color: '#ffd34d', kind: 'flash' });
    world.sounds.shoot();
    world.wanted.heat += 0.9; p.lastCrimeAt = world.time;
  }
  if (input.hit('r') && p.ammo < 6) { p.ammo = 24; world.toast('Ammo restocked.', '#7be382'); }
}

function updateOnFoot(world, input, dt) {
  const p = world.player;
  let mx = 0, my = 0;
  if (input.down('w', 'arrowup')) my -= 1;
  if (input.down('s', 'arrowdown')) my += 1;
  if (input.down('a', 'arrowleft')) mx -= 1;
  if (input.down('d', 'arrowright')) mx += 1;
  const moving = mx !== 0 || my !== 0;
  const run = input.down('shift') ? 1.6 : 1;
  const sp = 175 * run;
  if (moving) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * sp * dt; p.y += (my / len) * sp * dt;
    p.angle = Math.atan2(my, mx); p.walkPhase += dt * 11;
  }
  p.x = Math.max(30, Math.min(WORLD.w - 30, p.x));
  p.y = Math.max(30, Math.min(WORLD.h - 30, p.y));
  // Buildings block walking: push out of any overlapping facade.
  for (const b of world.city.buildings) {
    if (p.x > b.x - 8 && p.x < b.x + b.w + 8 && p.y > b.y - 8 && p.y < b.y + b.h + 8) {
      const dxl = p.x - (b.x - 8), dxr = (b.x + b.w + 8) - p.x;
      const dyt = p.y - (b.y - 8), dyb = (b.y + b.h + 8) - p.y;
      const m = Math.min(dxl, dxr, dyt, dyb);
      if (m === dxl) p.x = b.x - 8; else if (m === dxr) p.x = b.x + b.w + 8;
      else if (m === dyt) p.y = b.y - 8; else p.y = b.y + b.h + 8;
    }
  }
}

function updateDriving(world, input, dt) {
  const p = world.player; const c = p.car;
  const t = CAR_TYPES[c.type];
  let throttle = 0;
  if (input.down('w', 'arrowup')) throttle = 1;
  if (input.down('s', 'arrowdown')) throttle = -0.6;
  const steer = (input.down('a', 'arrowleft') ? -1 : 0) + (input.down('d', 'arrowright') ? 1 : 0);
  const offroad = isRoad(c.x, c.y) ? 1 : 0.55; // sand and grass slow the car
  c.speed += throttle * c.accel * offroad * dt;
  c.speed -= c.speed * 0.55 * dt; // rolling drag
  if (input.down(' ')) c.speed *= Math.max(0, 1 - dt * 2.2); // handbrake
  c.speed = Math.max(-t.top * 0.45, Math.min(t.top * offroad, c.speed));
  const turnRate = steer * c.grip * 0.9 * Math.min(1, Math.abs(c.speed) / 140) * (c.speed < 0 ? -1 : 1);
  c.angle += turnRate * dt;
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  p.x = c.x; p.y = c.y; p.angle = c.angle;
  // World edges and building collisions: bounce off with a thud.
  if (c.x < 250) { c.x = 250; c.speed *= -0.3; world.sounds.crash(); }
  if (c.x > WORLD.w - 40) { c.x = WORLD.w - 40; c.speed *= -0.3; world.sounds.crash(); }
  if (c.y < 40) { c.y = 40; c.speed *= -0.3; world.sounds.crash(); }
  if (c.y > WORLD.h - 40) { c.y = WORLD.h - 40; c.speed *= -0.3; world.sounds.crash(); }
  for (const b of world.city.buildings) {
    if (c.x > b.x - 12 && c.x < b.x + b.w + 12 && c.y > b.y - 12 && c.y < b.y + b.h + 12) {
      c.speed *= -0.35; c.x -= Math.cos(c.angle) * 18; c.y -= Math.sin(c.angle) * 18;
      if (Math.abs(c.speed) > 60) world.sounds.crash();
    }
  }
  // Bumping traffic cars: both slow down, sparks fly.
  for (const o of world.traffic.cars) {
    if (Math.abs(o.x - c.x) < 44 && Math.abs(o.y - c.y) < 34 && Math.abs(c.speed) > 40) {
      o.stopped = 0.6; c.speed *= 0.55;
      world.particles.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 10, color: '#ffd34d', kind: 'flash' });
      world.sounds.crash();
    }
  }
  if (Math.abs(c.speed) > 30) world.sounds.update(Math.abs(c.speed) / t.top, world.wanted.stars);
}

// Player bullets and gunman bullets: move, hit gunmen / the player, fade.
export function updateBullets(world, dt) {
  for (const b of world.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.fromPlayer) {
      for (const g of world.gunmen) {
        if (!g.dead && Math.hypot(g.x - b.x, g.y - b.y) < 18) {
          g.hp -= 34; b.life = 0;
          world.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 8, color: '#ff5f5f', kind: 'flash' });
          if (g.hp <= 0) { g.dead = true; world.money += 25; world.toast('Crew member down — +$25', '#7be382'); }
        }
      }
    } else if (Math.hypot(world.player.x - b.x, world.player.y - b.y) < 16) {
      world.player.health -= 6; b.life = 0;
      world.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 8, color: '#ff5f5f', kind: 'flash' });
      if (world.player.health <= 0) world.player.health = 0;
    }
  }
  world.bullets = world.bullets.filter((b) => b.life > 0);
}
