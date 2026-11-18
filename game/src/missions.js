// GOLDEN TIDE — missions.js
// One job: the story — four missions for Mara, taxi side jobs and hidden cash.
// Each mission is stages with a target circle; reaching it advances the story
// and pays out. The HUD reads currentObjective() for its mission chip.

import { MISSIONS, TAXI_FARE_MIN, TAXI_FARE_MAX } from './config.js';
import { makeCar } from './player.js';

export function makeMissionState() {
  return { index: 0, stage: 0, timer: 0, done: false, allDone: false, taxi: null, taxiFare: 0 };
}

export function currentMission(world) {
  if (world.missions.allDone) return null;
  return MISSIONS[world.missions.index];
}

export function currentObjective(world) {
  const m = currentMission(world);
  if (!m) return { text: 'Free roam — explore Palmera, drive a taxi, find hidden cash.', target: null };
  const st = m.stages[world.missions.stage];
  return { text: m.code + ' · ' + m.title + ' — ' + st.text, target: st.target, code: m.code, title: m.title };
}

function advanceStage(world) {
  const ms = world.missions; const m = MISSIONS[ms.index];
  ms.stage += 1;
  if (ms.stage >= m.stages.length) {
    world.money += m.reward;
    world.toast(m.code + ' COMPLETE — Mara pays $' + m.reward, '#7be382');
    world.sounds.missionDone();
    ms.index += 1; ms.stage = 0; ms.timer = 0;
    if (ms.index >= MISSIONS.length) {
      ms.allDone = true; world.mode = 'complete';
      world.sounds.missionDone();
    } else {
      const next = MISSIONS[ms.index];
      world.banner = { title: next.code + ' — ' + next.title, sub: next.brief, t: 5 };
    }
  } else {
    world.sounds.pickup();
  }
}

export function updateMissions(world, dt) {
  const ms = world.missions;
  // M4 countdown once the van stage starts.
  const m = currentMission(world);
  if (m && m.timeLimit && ms.stage === 1) {
    ms.timer += dt;
    if (ms.timer > m.timeLimit) {
      world.toast('Too slow — the airport run failed. Try again from the garage.', '#ff5f5f');
      ms.stage = 0; ms.timer = 0;
      world.player.x = 1300; world.player.y = 2900;
      if (world.player.car) { world.player.car = null; world.player.onFoot = true; }
    }
  }
  if (!m) { updateTaxi(world, dt); updateCash(world); return; }

  const st = m.stages[ms.stage];
  const p = world.player;
  const d = Math.hypot(p.x - st.target.x, p.y - st.target.y);

  // M2 stage 0 needs the actual steal, not just standing near the car.
  if (m.id === 'm2' && ms.stage === 0) {
    if (p.car && p.car.type === 'sports' && p.car.owned) advanceStage(world);
    return;
  }
  // M3 stage 0 needs the crew beaten and the bag grabbed.
  if (m.id === 'm3' && ms.stage === 0) {
    if (world.gunmen.length > 0 && world.gunmen.every((g) => g.dead) && d < st.target.r) {
      world.money += 200; world.toast('Cash bag grabbed — +$200', '#7be382');
      advanceStage(world);
    }
    return;
  }
  // M4 stage 0 needs the player inside the van.
  if (m.id === 'm4' && ms.stage === 0) {
    if (p.car && p.car.type === 'van') advanceStage(world);
    return;
  }
  if (d < st.target.r) advanceStage(world);

  updateTaxi(world, dt);
  updateCash(world);
}

// Taxi side jobs: drive a cab, a fare marker appears, pick up, drop off, get paid.
export function updateTaxi(world, dt) {
  const ms = world.missions; const p = world.player;
  if (!ms.taxi) {
    if (p.car && p.car.type === 'taxi' && Math.random() < dt * 0.25) {
      const spots = [{ x: 2220, y: 920 }, { x: 2820, y: 1920 }, { x: 1620, y: 2920 }, { x: 4020, y: 1420 }, { x: 1020, y: 2420 }];
      const s = spots[Math.floor(Math.random() * spots.length)];
      ms.taxi = { phase: 'pickup', x: s.x, y: s.y, fare: 0 };
      world.toast('Taxi fare waiting — pick up the passenger.', '#ffd34d');
    }
    return;
  }
  const t = ms.taxi;
  const d = Math.hypot(p.x - t.x, p.y - t.y);
  if (t.phase === 'pickup' && d < 70) {
    t.phase = 'drop';
    const dests = [{ x: 2820, y: 420 }, { x: 4620, y: 2420 }, { x: 1300, y: 3150 }, { x: 2220, y: 3420 }];
    const s = dests[Math.floor(Math.random() * dests.length)];
    t.x = s.x; t.y = s.y;
    t.fare = TAXI_FARE_MIN + Math.floor(Math.random() * (TAXI_FARE_MAX - TAXI_FARE_MIN));
    world.toast('Passenger aboard — drive to the drop-off.', '#ffd34d');
  } else if (t.phase === 'drop' && d < 80) {
    world.money += t.fare;
    world.toast('Fare complete — +$' + t.fare, '#7be382');
    world.sounds.cash();
    ms.taxi = null;
  }
  if (!p.car || p.car.type !== 'taxi') ms.taxi = null;
}

// Hidden cash: walk or drive over a glowing stash to collect $50.
export function updateCash(world) {
  const p = world.player;
  for (const s of world.city.cashSpots) {
    if (!s.taken && Math.hypot(p.x - s.x, p.y - s.y) < 42) {
      s.taken = true; world.money += 50; world.cashFound += 1;
      world.toast('Hidden cash found — +$50 (' + world.cashFound + '/5)', '#7be382');
      world.sounds.cash();
    }
  }
}

// Spawn the story cars: the orange convertible for M2 and the getaway van for M4.
export function ensureMissionCars(world) {
  const ms = world.missions;
  if (ms.index === 1 && !world.cars.some((c) => c.story === 'convertible')) {
    const car = makeCar('sports', 560, 2100, Math.PI / 2, { color: '#ff7a1a' });
    car.story = 'convertible'; world.cars.push(car);
  }
  if (ms.index === 3 && !world.cars.some((c) => c.story === 'van')) {
    const car = makeCar('van', 1300, 2980, 0);
    car.story = 'van'; world.cars.push(car);
  }
}

// M3 gunmen: three pier crew members who shoot at the player until beaten.
export function ensureGunmen(world) {
  if (world.missions.index !== 2) return;
  if (world.gunmen.length === 0) {
    world.gunmen = [
      { x: 300, y: 2280, hp: 100, dead: false, cd: 0 },
      { x: 380, y: 2420, hp: 100, dead: false, cd: 1 },
      { x: 250, y: 2440, hp: 100, dead: false, cd: 2 },
    ];
    world.banner = { title: 'M3 — PIER SHOOTOUT', sub: 'Take down the pier crew, then grab the cash bag.', t: 5 };
  }
}

export function updateGunmen(world, dt) {
  const p = world.player;
  for (const g of world.gunmen) {
    if (g.dead) continue;
    g.cd -= dt;
    const d = Math.hypot(p.x - g.x, p.y - g.y);
    if (d < 520 && g.cd <= 0) {
      g.cd = 1.1 + Math.random() * 0.7;
      const a = Math.atan2(p.y - g.y, p.x - g.x) + (Math.random() - 0.5) * 0.2;
      world.bullets.push({ x: g.x, y: g.y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 0.9, fromPlayer: false });
      world.sounds.shoot();
    }
  }
}
