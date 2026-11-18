// GOLDEN TIDE — shots.js
// One job: deterministic screenshot staging. Each named shot places Cole, the
// cars, the police and the mission in one fixed frame, so the same seed always
// renders the same picture. Used only through ?shot=…&seed=….

import { makeCar } from './player.js';
import { ZOOM } from './config.js';

function putPlayerInCar(world, type, x, y, angle, speed) {
  const car = makeCar(type, x, y, angle);
  car.speed = speed; car.owned = true;
  world.cars.push(car);
  world.player.car = car; world.player.onFoot = false;
  world.player.x = x; world.player.y = y; world.player.angle = angle;
  if (!world.player.garage.includes(type)) world.player.garage.push(type);
  return car;
}

function addPoliceChase(world, spots) {
  for (const s of spots) {
    const car = makeCar('police', s.x, s.y, s.angle);
    car.chasing = true; car.speed = 320; car.siren = s.x % 6;
    world.police.push(car); world.cars.push(car);
  }
}

function addTrafficRow(world, list) {
  for (const t of list) {
    const car = makeCar(t.type, t.x, t.y, t.angle, { color: t.color });
    car.npc = true; car.speed = 100;
    world.traffic.cars.push(car); // traffic draws from the traffic list
  }
}

export function stageShot(world, name) {
  const p = world.player;
  world.mode = 'play';
  if (name === 'chase') {
    // Cover: golden-hour chase down a downtown avenue, 3 stars, two cruisers.
    putPlayerInCar(world, 'sports', 2220, 1700, Math.PI / 2, 380);
    addPoliceChase(world, [
      { x: 2220, y: 1480, angle: Math.PI / 2 },
      { x: 2140, y: 1580, angle: Math.PI / 2 },
    ]);
    addTrafficRow(world, [
      { type: 'sedan', x: 2300, y: 1860, angle: -Math.PI / 2, color: '#c94f42' },
      { type: 'taxi', x: 2300, y: 1920, angle: -Math.PI / 2 },
      { type: 'sedan', x: 2140, y: 1900, angle: Math.PI / 2, color: '#4a7fb5' },
    ]);
    world.wanted.heat = 4.0; world.wanted.stars = 3;
    world.missions.index = 1; world.missions.stage = 1;
    world.money = 1250;
    world.banner = { title: 'M2 — SUNSET STEAL', sub: 'Lose the cops — deliver the convertible to the Chop Shop.', t: 99 };
  } else if (name === 'pier') {
    // On foot at the marina pier: pedestrians, traffic, the package marker, 1 star.
    p.x = 420; p.y = 1750; p.angle = 0; p.onFoot = true; p.car = null;
    addTrafficRow(world, [
      { type: 'sedan', x: 420, y: 1560, angle: Math.PI / 2, color: '#e8b64c' },
      { type: 'taxi', x: 420, y: 1850, angle: -Math.PI / 2 },
      { type: 'truck', x: 420, y: 1980, angle: -Math.PI / 2, color: '#b8573f' },
    ]);
    world.wanted.heat = 1.0; world.wanted.stars = 1;
    world.missions.index = 0; world.missions.stage = 0;
    world.money = 210;
    world.banner = { title: 'M1 — FIRST JOB', sub: 'Pick up the package at the Marina Pier.', t: 99 };
  } else if (name === 'shootout') {
    // Pier gunfight: muzzle flash, gunmen with health bars, 2 stars.
    p.x = 480; p.y = 2350; p.angle = 0; p.onFoot = true; p.car = null;
    p.aimAngle = Math.PI;
    world.gunmen = [
      { x: 300, y: 2280, hp: 66, dead: false, cd: 2 },
      { x: 380, y: 2420, hp: 100, dead: false, cd: 2 },
      { x: 250, y: 2440, hp: 40, dead: false, cd: 2 },
    ];
    world.bullets.push({ x: 460, y: 2345, vx: -900, vy: 0, life: 0.4, fromPlayer: true });
    world.particles.push({ x: 500, y: 2350, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 9, color: '#ffd34d', kind: 'flash' });
    world.wanted.heat = 2.4; world.wanted.stars = 2;
    world.missions.index = 2; world.missions.stage = 0;
    world.money = 860; p.ammo = 18;
    world.banner = { title: 'M3 — PIER SHOOTOUT', sub: 'Shooting raised the heat — take the cash bag!', t: 99 };
    world.toasts.push({ text: 'Gunfire spotted — wanted level 2!', color: '#ff9a5c', t: 99 });
  } else if (name === 'downtown') {
    // Downtown avenue drive: dense traffic, glass towers, delivery objective.
    putPlayerInCar(world, 'sedan', 2820, 2100, -Math.PI / 2, 300);
    addTrafficRow(world, [
      { type: 'taxi', x: 2820, y: 1900, angle: -Math.PI / 2 },
      { type: 'sedan', x: 2900, y: 1950, angle: -Math.PI / 2, color: '#c94f42' },
      { type: 'sports', x: 2740, y: 1900, angle: -Math.PI / 2, color: '#ff7a1a' },
      { type: 'truck', x: 2900, y: 2250, angle: Math.PI / 2, color: '#5fb8a6' },
      { type: 'sedan', x: 2740, y: 2300, angle: Math.PI / 2, color: '#8a6a9e' },
    ]);
    world.wanted.heat = 0; world.wanted.stars = 0;
    world.missions.index = 0; world.missions.stage = 1;
    world.money = 480;
    world.banner = { title: 'M1 — FIRST JOB', sub: 'Deliver the package to Mara\u2019s Garage.', t: 99 };
  }
  // Frame the player and freeze the clock: one fixed frame, every time.
  // The visible world rect is the viewport divided by the zoom.
  const vw = 1280 / ZOOM, vh = 720 / ZOOM;
  world.camera.x = Math.max(0, Math.min(5200 - vw, p.x - vw / 2));
  world.camera.y = Math.max(0, Math.min(3800 - vh, p.y - vh / 2));
  world.time = 14.0;
  world.frozen = true;
}
