// GOLDEN TIDE — police.js
// One job: the wanted system — heat rises with crime, stars follow, police
// cruisers chase and ram, roadblocks appear at 3 stars, and getting caught
// on foot with a cruiser on top of you means BUSTED.

import { WORLD, AVENUES, STREETS } from './config.js';
import { makeCar } from './player.js';
import { nearestRoadPoint } from './city.js';

export function makeWanted() {
  return { heat: 0, stars: 0, quietFor: 0, arrest: 0 };
}

function starCount(heat) {
  if (heat < 0.5) return 0;
  if (heat < 1.6) return 1;
  if (heat < 3.0) return 2;
  if (heat < 4.6) return 3;
  if (heat < 6.2) return 4;
  return 5;
}

export function updateWanted(world, dt) {
  const w = world.wanted; const p = world.player;
  // Heat cools off when the player stays clean for a while.
  if (world.time - p.lastCrimeAt > 18) { w.heat = Math.max(0, w.heat - dt * 0.12); w.quietFor += dt; }
  else w.quietFor = 0;
  const stars = starCount(w.heat);
  if (stars !== w.stars) {
    w.stars = stars;
    if (stars >= 3) world.toast('WANTED LEVEL ' + stars + ' — roadblocks ahead!', '#ff5f5f');
    else if (stars > 0) world.toast('Wanted level ' + stars + ' — police responding.', '#ff9a5c');
  }
  updatePolice(world, dt);
}

function updatePolice(world, dt) {
  const w = world.wanted; const p = world.player;
  const wantCount = w.stars === 0 ? 0 : Math.min(2 + w.stars, 7);
  // Spawn cruisers on nearby roads until the wanted level is matched.
  while (world.police.length < wantCount) {
    const spot = nearestRoadPoint(
      p.x + (Math.random() < 0.5 ? -1 : 1) * (500 + Math.random() * 400),
      p.y + (Math.random() < 0.5 ? -1 : 1) * (500 + Math.random() * 400), null);
    const car = makeCar('police', Math.max(280, Math.min(WORLD.w - 60, spot.x)), Math.max(60, Math.min(WORLD.h - 60, spot.y)), 0);
    car.chasing = true; car.siren = Math.random() * 6;
    world.police.push(car); world.cars.push(car);
  }
  // Despawn the surplus when the heat drops.
  while (world.police.length > wantCount) {
    const gone = world.police.pop();
    world.cars = world.cars.filter((c) => c !== gone);
  }
  for (const c of world.police) {
    c.siren += dt;
    const dx = p.x - c.x, dy = p.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    // Chase with a little weaving so cruisers do not all stack on one line.
    const weave = Math.sin(world.time * 1.7 + c.siren) * 0.35;
    let diff = wantAngle + weave - c.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    c.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, diff));
    const top = 300 + w.stars * 34;
    c.speed += ((dist > 260 ? top : top * 0.85) - c.speed) * Math.min(1, dt * 0.9);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    // Ramming the player car slows it and shakes the camera.
    if (p.car && Math.hypot(p.car.x - c.x, p.car.y - c.y) < 52) {
      p.car.speed *= Math.max(0.4, 1 - dt * 1.4);
      c.speed *= 0.9;
      if (Math.abs(p.car.speed) > 80 && Math.random() < dt * 2) world.sounds.crash();
    }
    // On foot and a cruiser right on top of you: arrest meter fills.
    if (p.onFoot && dist < 46) {
      w.arrest += dt * 0.8;
      if (w.arrest >= 1) { bustPlayer(world); return; }
    } else w.arrest = Math.max(0, w.arrest - dt * 0.5);
  }
  // Roadblocks at 3+ stars: a line of cruisers across the road ahead of the player.
  if (w.stars >= 3 && world.roadblocks.length < 2 && Math.random() < dt * 0.12) {
    const ahead = { x: p.x + Math.cos(p.angle) * 700, y: p.y + Math.sin(p.angle) * 700 };
    const spot = nearestRoadPoint(ahead.x, ahead.y, null);
    const block = [];
    for (let i = -1; i <= 1; i++) {
      const car = makeCar('police', spot.x + i * 52, spot.y, Math.PI / 2);
      car.block = true; block.push(car); world.cars.push(car);
    }
    world.roadblocks.push({ cars: block, x: spot.x, y: spot.y, life: 40 });
  }
  for (const rb of world.roadblocks) rb.life -= dt;
  world.roadblocks = world.roadblocks.filter((rb) => {
    if (rb.life > 0) return true;
    for (const c of rb.cars) world.cars = world.cars.filter((x) => x !== c);
    return false;
  });
}

function bustPlayer(world) {
  const p = world.player;
  world.mode = 'busted';
  const fine = Math.min(100, world.money);
  world.money -= fine;
  world.wanted.heat = 0; world.wanted.stars = 0; world.wanted.arrest = 0;
  world.police.forEach((c) => { world.cars = world.cars.filter((x) => x !== c); });
  world.police = [];
  world.roadblocks.forEach((rb) => rb.cars.forEach((c) => { world.cars = world.cars.filter((x) => x !== c); }));
  world.roadblocks = [];
  p.health = 100; p.ammo = 24;
  p.onFoot = true; p.car = null; p.x = 1300; p.y = 2900;
  world.sounds.busted();
  world.bustedFine = fine;
}
