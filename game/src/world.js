// 游戏规则与状态，不画画也不碰浏览器：玩家步行/开车、车流与行人 AI、
// 警车追捕、通缉星级、枪战、任务推进、碰撞与粒子。step() 每固定步进
// 一次，返回发生了什么（位标志），主循环据此放音效、报状态。

import {
  BUST_FINE, CAR_ACCEL, CAR_BRAKE, CAR_MAX_SPEED, CAR_REVERSE_MAX, CAR_TURN,
  PLAYER_MAX_HP, POLICE_MAX_SPEED, ROAD_SPACING, ROAD_W, WALK_SPEED,
  WANTED_DECAY_SECONDS, WANTED_DECAY_STEP, WORLD_H, WORLD_W,
} from './config.js';
import { createCity, nearestRoadPoint, onRoad, roadXs, roadYs } from './city.js';
import { completeMission, createMissionState, missionTarget, startMission } from './missions.js';
import { pick, range, rangeInt } from './random.js';

// step() 返回的事件位标志。
export const EVENT_SHOOT = 1;
export const EVENT_ENEMY_SHOOT = 2;
export const EVENT_CRASH = 4;
export const EVENT_STEAL = 8;
export const EVENT_HIT_PED = 16;
export const EVENT_PICKUP = 32;
export const EVENT_MISSION_DONE = 64;
export const EVENT_STORY_DONE = 128;
export const EVENT_BUSTED = 256;
export const EVENT_WASTED = 512;
export const EVENT_TIMER_OUT = 1024;
export const EVENT_KILL = 2048;

const CAR_HALF_W = 26;
const CAR_HALF_H = 13;
const VIEW_W = 960;
const VIEW_H = 600;

/** 两点之间的角度。 */
function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

/** 把角度差收进 [-PI, PI]。 */
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** 点是否在矩形建筑里。 */
function inBuilding(buildings, x, y) {
  for (const b of buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b;
  }
  return null;
}

/** 圆（玩家/车）撞上建筑时推出去，返回撞到的建筑或 null。 */
function pushOutOfBuildings(buildings, obj, radius) {
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(obj.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(obj.y, b.y + b.h));
    const dx = obj.x - cx;
    const dy = obj.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 === 0) {
      obj.x = b.x - radius;
      return b;
    }
    const d = Math.sqrt(d2);
    obj.x = cx + (dx / d) * radius;
    obj.y = cy + (dy / d) * radius;
    return b;
  }
  return null;
}

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    city,
    time: 0,
    // 玩家：Rook Calloway，索尔玛湾的跑腿司机。
    player: {
      x: city.spawn.x, y: city.spawn.y, angle: -Math.PI / 2,
      hp: PLAYER_MAX_HP, money: 0, wanted: 0,
      car: null, shootCooldown: 0, hurtTimer: 0, bustedTimer: 0,
    },
    cars: [],
    peds: [],
    police: [],
    enemies: [],
    bullets: [],
    particles: [],
    texts: [],
    mission: null,
    camera: { x: city.spawn.x, y: city.spawn.y },
    timeSinceCrime: 999,
    wantedCooldown: 0,
    shotWantedAt: -99,
    saved: null,
  };

  // —— 生成：车流、停着的车、行人 ——
  function spawnTrafficCar() {
    const horizontal = random() < 0.5;
    const road = horizontal ? pick(random, roadYs()) : pick(random, roadXs());
    const dir = random() < 0.5 ? 1 : -1;
    const lane = ROAD_W / 2 - 14;
    return {
      id: state.cars.length + 1,
      kind: 'traffic',
      x: horizontal ? range(random, 100, WORLD_W - 100) : road + (dir > 0 ? -lane : lane),
      y: horizontal ? road + (dir > 0 ? lane : -lane) : range(random, 100, WORLD_H - 100),
      angle: horizontal ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(random, 110, 175),
      color: pick(random, city.carColors),
      hp: 100, driver: true, axis: horizontal ? 'h' : 'v', coord: road, dir,
      turnCooldown: range(random, 1, 4),
    };
  }

  function spawnParkedCar() {
    const horizontal = random() < 0.5;
    const road = horizontal ? pick(random, roadYs()) : pick(random, roadXs());
    const side = random() < 0.5 ? 1 : -1;
    const along = range(random, 150, (horizontal ? WORLD_W : WORLD_H) - 150);
    return {
      id: state.cars.length + 1,
      kind: 'parked',
      x: horizontal ? along : road + side * (ROAD_W / 2 + 12),
      y: horizontal ? road + side * (ROAD_W / 2 + 12) : along,
      angle: horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2),
      speed: 0,
      color: pick(random, city.carColors),
      hp: 100, driver: false, axis: horizontal ? 'h' : 'v', coord: road, dir: 1,
      turnCooldown: 0,
    };
  }

  function spawnPed() {
    const horizontal = random() < 0.5;
    const road = horizontal ? pick(random, roadYs()) : pick(random, roadXs());
    const side = random() < 0.5 ? 1 : -1;
    const along = range(random, 100, (horizontal ? WORLD_W : WORLD_H) - 100);
    return {
      x: horizontal ? along : road + side * (ROAD_W / 2 + 18),
      y: horizontal ? road + side * (ROAD_W / 2 + 18) : along,
      angle: horizontal ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2),
      speed: range(random, 38, 68),
      color: pick(random, city.shirtColors),
      state: 'walk', timer: range(random, 2, 8), downTimer: 0,
    };
  }

  function reset() {
    state.time = 0;
    state.player.x = city.spawn.x;
    state.player.y = city.spawn.y;
    state.player.angle = -Math.PI / 2;
    state.player.hp = PLAYER_MAX_HP;
    state.player.money = state.saved ? state.saved.money : 0;
    state.player.wanted = 0;
    state.player.car = null;
    state.player.shootCooldown = 0;
    state.player.hurtTimer = 0;
    state.player.bustedTimer = 0;
    state.cars = [];
    for (let i = 0; i < 14; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < 10; i += 1) state.cars.push(spawnParkedCar());
    state.peds = [];
    for (let i = 0; i < 26; i += 1) state.peds.push(spawnPed());
    state.police = [];
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.texts = [];
    state.timeSinceCrime = 999;
    state.wantedCooldown = 0;
    state.camera.x = city.spawn.x;
    state.camera.y = city.spawn.y;
    // 任务线从第一单开始（读档后从存档的任务接着做）。
    state.mission = createMissionState();
    const startIndex = state.saved ? Math.min(state.saved.missionIndex, 2) : 0;
    startMission(state.mission, startIndex);
    if (startIndex === 1) state.player.wanted = 2;
    if (startIndex === 2) spawnThugs();
  }

  // 任务三的埋伏：Rival 帮的枪手，沿灯塔路一字排开。
  function spawnThugs() {
    const spots = [
      { x: 2900, y: 800 }, { x: 3100, y: 620 }, { x: 2890, y: 430 },
      { x: 2600, y: 600 }, { x: 2400, y: 200 },
    ];
    state.enemies = spots.map((spot) => ({
      x: spot.x, y: spot.y, hp: 3, angle: 0, cooldown: range(random, 0.4, 1.2),
      flash: 0, wander: range(random, 0, Math.PI * 2),
    }));
  }

  function addWanted(n) {
    state.player.wanted = Math.min(5, state.player.wanted + n);
    state.timeSinceCrime = 0;
  }

  function addText(x, y, text, color) {
    state.texts.push({ x, y, text, color, life: 1.6 });
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random() * Math.PI * 2;
      const s = range(random, speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(random, 0.25, 0.6), maxLife: 0.6, color, size: range(random, 2, 5) });
    }
  }

  function smoke(x, y) {
    state.particles.push({ x, y, vx: range(random, -12, 12), vy: range(random, -30, -8), life: range(random, 0.5, 1), maxLife: 1, color: '#5a5a5a', size: range(random, 5, 9) });
  }

  // —— 驾驶：油门、刹车、转向、撞建筑、撞车 ——
  function stepCar(car, dt, dir, isPlayer) {
    if (dir.y < 0) car.speed += CAR_ACCEL * dt;
    else if (dir.y > 0) car.speed -= CAR_BRAKE * dt;
    else car.speed *= Math.max(0, 1 - 1.6 * dt);
    if (car.speed > CAR_MAX_SPEED) car.speed = CAR_MAX_SPEED;
    if (car.speed < -CAR_REVERSE_MAX) car.speed = -CAR_REVERSE_MAX;
    if (Math.abs(car.speed) < 4 && dir.y === 0) car.speed = 0;
    const steer = dir.x * CAR_TURN * dt * Math.max(-1, Math.min(1, car.speed / 220));
    car.angle += steer;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(30, Math.min(WORLD_W - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD_H - 30, car.y));
    const hit = pushOutOfBuildings(city.buildings, car, 24);
    if (hit) {
      if (Math.abs(car.speed) > 220 && isPlayer) {
        burst(car.x, car.y, '#e8c33a', 10, 160);
      }
      if (Math.abs(car.speed) > 120) car.speed *= -0.25;
      else car.speed *= 0.5;
      return true;
    }
    return false;
  }

  // —— 车流 AI：沿路开，路口随机转弯，出界绕回另一头 ——
  function stepTraffic(car, dt) {
    car.turnCooldown -= dt;
    if (car.axis === 'h') {
      car.x += car.dir * car.speed * dt;
      car.y = car.coord + (car.dir > 0 ? ROAD_W / 2 - 14 : -(ROAD_W / 2 - 14));
      car.angle = car.dir > 0 ? 0 : Math.PI;
      if (car.x < 60) { car.x = 60; car.dir = 1; }
      if (car.x > WORLD_W - 60) { car.x = WORLD_W - 60; car.dir = -1; }
      // 路口：有机会拐进纵路。
      const nearX = roadXs().find((rx) => Math.abs(car.x - rx) < 9);
      if (nearX !== undefined && car.turnCooldown <= 0 && random() < 0.22) {
        car.axis = 'v';
        car.coord = nearX;
        car.dir = random() < 0.5 ? 1 : -1;
        car.turnCooldown = 3;
      }
    } else {
      car.y += car.dir * car.speed * dt;
      car.x = car.coord + (car.dir > 0 ? ROAD_W / 2 - 14 : -(ROAD_W / 2 - 14));
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (car.y < 60) { car.y = 60; car.dir = 1; }
      if (car.y > WORLD_H - 60) { car.y = WORLD_H - 60; car.dir = -1; }
      const nearY = roadYs().find((ry) => Math.abs(car.y - ry) < 9);
      if (nearY !== undefined && car.turnCooldown <= 0 && random() < 0.22) {
        car.axis = 'h';
        car.coord = nearY;
        car.dir = random() < 0.5 ? 1 : -1;
        car.turnCooldown = 3;
      }
    }
  }

  // —— 行人 AI：沿人行道走，路口随机换向，被车撞倒后爬起来跑开 ——
  function stepPed(ped, dt) {
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        // 爬起来，跑到远处的人行道重新开始走。
        const fresh = spawnPed();
        ped.x = fresh.x;
        ped.y = fresh.y;
        ped.angle = fresh.angle;
        ped.state = 'walk';
        ped.timer = range(random, 2, 8);
      }
      return;
    }
    ped.timer -= dt;
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    if (ped.x < 60 || ped.x > WORLD_W - 60 || ped.y < 60 || ped.y > WORLD_H - 60 || ped.timer <= 0) {
      // 路口或走得够久：换个方向继续走。
      const horizontal = Math.abs(Math.sin(ped.angle)) < 0.5;
      const road = horizontal ? pick(random, roadYs()) : pick(random, roadXs());
      const side = random() < 0.5 ? 1 : -1;
      if (horizontal) {
        ped.y = road + side * (ROAD_W / 2 + 18);
        ped.angle = random() < 0.5 ? 0 : Math.PI;
      } else {
        ped.x = road + side * (ROAD_W / 2 + 18);
        ped.angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
      }
      ped.timer = range(random, 3, 9);
    }
  }

  // —— 警车 AI：朝玩家追，撞玩家车减速撞人，贴身抓捕 ——
  function stepPolice(car, dt, events) {
    const p = state.player;
    const targetX = p.car ? p.car.x : p.x;
    const targetY = p.car ? p.car.y : p.y;
    const desired = angleTo(car.x, car.y, targetX, targetY);
    car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, angleDiff(car.angle, desired)));
    const dist = Math.hypot(targetX - car.x, targetY - car.y);
    const want = dist > 90 ? POLICE_MAX_SPEED : POLICE_MAX_SPEED * 0.55;
    car.speed += (want - car.speed) * Math.min(1, 1.4 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    pushOutOfBuildings(city.buildings, car, 24);
    // 撞上玩家车：两边都掉速掉血（带 0.9 秒冷却，免得一秒撞十次把车撞报废）。
    if (p.car) {
      const d = Math.hypot(p.car.x - car.x, p.car.y - car.y);
      car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
      if (d < 52 && Math.abs(car.speed) > 60 && car.ramCooldown <= 0) {
        car.ramCooldown = 0.9;
        p.car.speed *= 0.55;
        p.car.hp -= 8;
        car.speed *= 0.6;
        burst((p.car.x + car.x) / 2, (p.car.y + car.y) / 2, '#e8c33a', 8, 140);
        events |= EVENT_CRASH;
      }
    }
    return events;
  }

  // —— 枪战：子弹飞、命中、敌人的血条 ——
  function stepBullets(dt) {
    let events = 0;
    const p = state.player;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H || inBuilding(city.buildings, b.x, b.y)) {
        if (inBuilding(city.buildings, b.x, b.y)) burst(b.x, b.y, '#c9bda6', 4, 90);
        state.bullets.splice(i, 1);
        continue;
      }
      if (b.from === 'player') {
        for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
          const e = state.enemies[j];
          if (Math.hypot(e.x - b.x, e.y - b.y) < 18) {
            e.hp -= 1;
            e.flash = 0.15;
            burst(b.x, b.y, '#e5534b', 6, 120);
            state.bullets.splice(i, 1);
            if (e.hp <= 0) {
              p.money += 25;
              addText(e.x, e.y - 20, '+$25', '#4fae62');
              burst(e.x, e.y, '#e5534b', 16, 200);
              state.enemies.splice(j, 1);
              events |= EVENT_KILL;
            }
            break;
          }
        }
      } else if (!p.car && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        p.hp -= 8;
        p.hurtTimer = 5;
        burst(b.x, b.y, '#e5534b', 6, 120);
        state.bullets.splice(i, 1);
      }
    }
    return events;
  }

  function stepEnemies(dt) {
    let events = 0;
    const p = state.player;
    for (const e of state.enemies) {
      if (e.flash > 0) e.flash -= dt;
      const tx = p.car ? p.car.x : p.x;
      const ty = p.car ? p.car.y : p.y;
      const dist = Math.hypot(tx - e.x, ty - e.y);
      if (dist < 460) {
        e.angle = angleTo(e.x, e.y, tx, ty);
        e.cooldown -= dt;
        if (e.cooldown <= 0 && dist > 60) {
          e.cooldown = range(random, 0.8, 1.4);
          const spread = range(random, -0.14, 0.14);
          state.bullets.push({
            x: e.x + Math.cos(e.angle) * 20, y: e.y + Math.sin(e.angle) * 20,
            vx: Math.cos(e.angle + spread) * 430, vy: Math.sin(e.angle + spread) * 430,
            from: 'enemy', life: 1.6,
          });
          events |= EVENT_ENEMY_SHOOT;
        }
      } else {
        // 闲着时小范围踱步。
        e.wander += dt * 0.4;
        e.x += Math.cos(e.wander) * 12 * dt;
        e.y += Math.sin(e.wander) * 12 * dt;
      }
    }
    return events;
  }

  // —— 被捕 / 被干掉：罚钱、回出生点、当前任务重开 ——
  function bustPlayer(events, wasted) {
    const p = state.player;
    const fine = Math.min(p.money, BUST_FINE);
    p.money -= fine;
    p.hp = PLAYER_MAX_HP;
    p.wanted = 0;
    p.bustedTimer = 0;
    if (p.car) {
      p.car.kind = 'parked';
      p.car.speed = 0;
      p.car = null;
    }
    p.x = city.spawn.x;
    p.y = city.spawn.y;
    state.police = [];
    state.bullets = [];
    // 当前任务重开（任务二重开时条子照旧追来）。
    const index = Math.min(state.mission.index, 2);
    startMission(state.mission, index);
    if (index === 1) p.wanted = 2;
    if (index === 2) spawnThugs();
    return events | (wasted ? EVENT_WASTED : EVENT_BUSTED);
  }

  /**
   * 一固定步。input：{ dir, shooting, aim（世界坐标）, actions }。
   * actions 用 input.js 的 ACTION_* 位。返回事件位标志。
   */
  function step(dt, input, actions) {
    let events = 0;
    const p = state.player;
    const m = state.mission;
    state.time += dt;
    state.timeSinceCrime += dt;
    if (m.bannerTimer > 0) m.bannerTimer -= dt;

    // 通缉自然消退：很久没犯事，星星一颗一颗掉。
    if (p.wanted > 0 && state.timeSinceCrime > WANTED_DECAY_SECONDS) {
      state.wantedCooldown += dt;
      if (state.wantedCooldown >= WANTED_DECAY_STEP) {
        state.wantedCooldown = 0;
        p.wanted -= 1;
      }
    }

    // 警车数量跟通缉走：1 星 1 辆，2–3 星 2 辆，4–5 星 3 辆。
    const wantPolice = p.wanted === 0 ? 0 : p.wanted >= 4 ? 3 : p.wanted >= 2 ? 2 : 1;
    while (state.police.length < wantPolice) {
      const near = nearestRoadPoint(p.car ? p.car.x : p.x, p.car ? p.car.y : p.y);
      const a = random() * Math.PI * 2;
      const x = Math.max(80, Math.min(WORLD_W - 80, near.x + Math.cos(a) * 650));
      const y = Math.max(80, Math.min(WORLD_H - 80, near.y + Math.sin(a) * 650));
      state.police.push({
        id: state.police.length + 1, kind: 'police', x, y,
        angle: angleTo(x, y, p.x, p.y), speed: 200, color: '#1c2733', hp: 100,
        driver: true, axis: 'h', coord: y, dir: 1, turnCooldown: 0,
      });
    }
    if (p.wanted === 0 && state.police.length > 0) {
      // 没通缉了：警车开走（直接撤掉，省得满屏警车）。
      state.police = [];
    }

    // —— 玩家：步行或开车 ——
    if (p.car) {
      const crashed = stepCar(p.car, dt, input.dir, true);
      if (crashed && Math.abs(p.car.speed) > 120) events |= EVENT_CRASH;
      p.x = p.car.x;
      p.y = p.car.y;
      p.angle = p.car.angle;
      if (p.car.hp <= 0) {
        // 车撞报废了：人被甩出来，车留在原地冒烟。
        burst(p.car.x, p.car.y, '#5a5a5a', 20, 180);
        p.car.kind = 'parked';
        p.car.speed = 0;
        p.x = p.car.x + 40;
        p.y = p.car.y;
        p.car = null;
        events |= EVENT_CRASH;
      }
      // 人还在车上才继续：撞行人、下车都以车在为准。
      if (p.car) {
        // 车撞行人：行人倒地，涨一星。
        for (const ped of state.peds) {
          if (ped.state !== 'walk') continue;
          const d = Math.hypot(ped.x - p.x, ped.y - p.y);
          if (d < 26 && Math.abs(p.car.speed) > 90) {
            ped.state = 'down';
            ped.downTimer = 3;
            addWanted(1);
            addText(ped.x, ped.y - 18, '撞人了！ +★', '#e5534b');
            burst(ped.x, ped.y, '#e8c33a', 8, 120);
            events |= EVENT_HIT_PED;
          }
        }
        // 下车。
        if (actions & 4) { // ACTION_ENTER
          const car = p.car;
          car.kind = 'parked';
          car.speed = 0;
          p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 36;
          p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 36;
          p.car = null;
        }
      }
    } else {
      // 步行：WASD 移动，撞墙推出去。
      const len = Math.hypot(input.dir.x, input.dir.y);
      if (len > 0) {
        p.x += (input.dir.x / len) * WALK_SPEED * dt;
        p.y += (input.dir.y / len) * WALK_SPEED * dt;
        p.angle = Math.atan2(input.dir.y, input.dir.x);
      }
      p.x = Math.max(20, Math.min(WORLD_W - 20, p.x));
      p.y = Math.max(20, Math.min(WORLD_H - 20, p.y));
      pushOutOfBuildings(city.buildings, p, 13);
      // 瞄准方向跟鼠标走。
      if (input.aim) p.angle = angleTo(p.x, p.y, input.aim.x, input.aim.y);
      // 开枪。
      p.shootCooldown -= dt;
      if (input.shooting && p.shootCooldown <= 0) {
        p.shootCooldown = 0.18;
        const a = p.angle;
        state.bullets.push({
          x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
          vx: Math.cos(a) * 750, vy: Math.sin(a) * 750, from: 'player', life: 0.9,
        });
        state.particles.push({
          x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 26,
          vx: 0, vy: 0, life: 0.07, maxLife: 0.07, color: '#ffd94a', size: 7,
        });
        events |= EVENT_SHOOT;
        // 当街开枪：涨一星，但 3 秒内连开只算一次（不然一梭子就 5 星）。
        if (state.time - state.shotWantedAt > 3) {
          state.shotWantedAt = state.time;
          addWanted(1);
        }
      }
      // 上车 / 偷车（任务一取货区内按 E 优先取货，不上车）。
      const atPickup = m.index === 0 && m.stage === 'interact';
      if ((actions & 4) && !atPickup) { // ACTION_ENTER
        let best = null;
        let bestD = 78;
        for (const car of state.cars) {
          if (car.kind === 'police') continue;
          if (car.hp <= 0) continue; // 报废的车开不了，不让上。
          const d = Math.hypot(car.x - p.x, car.y - p.y);
          if (d < bestD) {
            bestD = d;
            best = car;
          }
        }
        if (best) {
          if (best.kind === 'traffic' && best.driver) {
            // 抢正在开的车：司机跳车跑开，涨一星。
            best.driver = false;
            const flee = spawnPed();
            flee.x = best.x + 30;
            flee.y = best.y + 30;
            flee.state = 'walk';
            state.peds.push(flee);
            addWanted(1);
            addText(best.x, best.y - 24, '抢车！ +★', '#e5534b');
            events |= EVENT_STEAL;
          }
          best.kind = 'player';
          best.speed = 0;
          p.car = best;
        }
      }
    }

    // 开车撞到别的车：互相减速。
    if (p.car) {
      for (const car of state.cars) {
        if (car === p.car || car.kind === 'player') continue;
        const d = Math.hypot(car.x - p.car.x, car.y - p.car.y);
        if (d < 50) {
          const push = (50 - d) / 2;
          const a = Math.atan2(p.car.y - car.y, p.car.x - car.x);
          p.car.x += Math.cos(a) * push;
          p.car.y += Math.sin(a) * push;
          if (car.kind === 'traffic') {
            car.x -= Math.cos(a) * push;
            car.y -= Math.sin(a) * push;
            car.speed *= 0.5;
          }
          if (Math.abs(p.car.speed) > 150) {
            p.car.speed *= 0.6;
            p.car.hp -= 6;
            events |= EVENT_CRASH;
          }
        }
      }
    }

    // —— 车流、行人、警车、敌人、子弹 ——
    for (const car of state.cars) {
      if (car.kind === 'traffic') stepTraffic(car, dt);
    }
    for (const ped of state.peds) stepPed(ped, dt);
    for (const car of state.police) events |= stepPolice(car, dt, 0);
    events |= stepEnemies(dt);
    events |= stepBullets(dt);

    // 警车贴身抓捕（只针对步行的玩家）。
    if (!p.car && state.police.length > 0) {
      let touching = false;
      for (const car of state.police) {
        if (Math.hypot(car.x - p.x, car.y - p.y) < 46) touching = true;
      }
      if (touching) {
        p.bustedTimer += dt;
        if (p.bustedTimer > 1.2) events = bustPlayer(events, false);
      } else {
        p.bustedTimer = 0;
      }
    } else {
      p.bustedTimer = 0;
    }

    // 生命：受伤 5 秒后缓慢回血。
    if (p.hurtTimer > 0) p.hurtTimer -= dt;
    else if (p.hp < PLAYER_MAX_HP) p.hp = Math.min(PLAYER_MAX_HP, p.hp + 3 * dt);
    if (p.hp <= 0) events = bustPlayer(events, true);

    // —— 任务推进 ——
    const target = missionTarget(m, city.landmarks);
    if (target && m.index < 3) {
      const dist = Math.hypot(target.x - p.x, target.y - p.y);
      if (m.index === 0) {
        // 任务一：走到码头，按 E 取货。
        if (dist < 80) {
          m.stage = 'interact';
          if (actions & 4) { // ACTION_ENTER
            const result = completeMission(m);
            p.money += result.reward;
            events |= EVENT_PICKUP | EVENT_MISSION_DONE;
            addText(p.x, p.y - 26, '+$' + result.reward, '#4fae62');
            // 任务二开场：条子盯上来了。
            p.wanted = 2;
            state.timeSinceCrime = 0;
          }
        } else {
          m.stage = 'go';
        }
      } else if (m.index === 1) {
        // 任务二：开着偷来的车到修车行。
        if (p.car && dist < 100) {
          const result = completeMission(m);
          p.money += result.reward;
          p.wanted = 0;
          state.police = [];
          events |= EVENT_MISSION_DONE;
          addText(p.x, p.y - 26, '+$' + result.reward, '#4fae62');
          spawnThugs();
        }
      } else if (m.index === 2) {
        // 任务三：限时送货。
        m.timer -= dt;
        if (dist < 100) {
          const result = completeMission(m);
          p.money += result.reward;
          events |= EVENT_MISSION_DONE | EVENT_STORY_DONE;
          addText(p.x, p.y - 26, '+$' + result.reward, '#4fae62');
        } else if (m.timer <= 0) {
          // 超时：本单重开。
          startMission(m, 2);
          spawnThugs();
          events |= EVENT_TIMER_OUT;
        }
      }
    }

    // —— 粒子与飘字 ——
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.y -= 22 * dt;
      t.life -= dt;
      if (t.life <= 0) state.texts.splice(i, 1);
    }
    // 开车冒烟：车况越差烟越多。
    if (p.car && p.car.hp < 60 && random() < 0.3) {
      smoke(p.car.x - Math.cos(p.car.angle) * 20, p.car.y - Math.sin(p.car.angle) * 20);
    }

    // —— 相机跟随玩家， clamp 在世界里 ——
    const px = p.car ? p.car.x : p.x;
    const py = p.car ? p.car.y : p.y;
    state.camera.x += (px - state.camera.x) * Math.min(1, 6 * dt);
    state.camera.y += (py - state.camera.y) * Math.min(1, 6 * dt);
    state.camera.x = Math.max(VIEW_W / 2, Math.min(WORLD_W - VIEW_W / 2, state.camera.x));
    state.camera.y = Math.max(VIEW_H / 2, Math.min(WORLD_H - VIEW_H / 2, state.camera.y));

    return events;
  }

  reset();
  return { state, reset, step, addWanted };
}
