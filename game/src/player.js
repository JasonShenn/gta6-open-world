// player.js — 主角 Cole "Cash" Vega：步行、开车、抢车、开枪。
// 步行是俯视小人（红夹克 + 手枪 + 金圈）；开车是街机式街机物理：加速、转向随车速变化。

import { PLAYER, CAR_TYPES, WORLD } from './config.js';
import { collidesCircle, nearestParkedCar } from './city.js';
import { nearestTrafficCar } from './traffic.js';
import { sfx } from './audio.js';

export function createPlayer() {
  return {
    x: 300, y: 1400, angle: Math.PI, // 码头东侧路边出生，面朝码头（离 M1 取包点够远，不会开局即过关）
    hp: PLAYER.hp, money: 210, ammo: PLAYER.ammo,
    inCar: null, speed: 0, // 步行速度为 0 时用走路；开车时 speed 是车速（px/s）
    walkX: 0, walkY: 0, // 步行朝向（画小人用）
    fireCooldown: 0, muzzle: 0, // 开火冷却与枪口火光剩余时间
    invuln: 0, // 受击后短暂无敌，避免一帧连掉血
  };
}

// 步行更新：WASD 移动，Shift 跑，撞楼/撞水就滑开。
export function updateOnFoot(dt, player, input, city) {
  const ax = input.moveAxis();
  const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  const sp = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (ax.x !== 0 || ax.y !== 0) {
    player.walkX = ax.x; player.walkY = ax.y;
    player.angle = Math.atan2(ax.y, ax.x);
  }
  const nx = player.x + ax.x * sp * dt;
  const ny = player.y + ax.y * sp * dt;
  // 分轴移动：x 能走就走 x，y 能走就走 y，贴着墙滑行。
  if (!collidesCircle(city, nx, player.y, PLAYER.radius)) player.x = nx;
  if (!collidesCircle(city, player.x, ny, PLAYER.radius)) player.y = ny;
  player.x = Math.max(20, Math.min(WORLD.w - 20, player.x));
  player.y = Math.max(20, Math.min(WORLD.h - 20, player.y));
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.muzzle = Math.max(0, player.muzzle - dt);
  player.invuln = Math.max(0, player.invuln - dt);
}

// 开车更新：W 加速、S 刹车/倒车、A/D 转向（车速越快转向越灵，但倒车时反向）。
export function updateDriving(dt, player, input, city, traffic) {
  const car = player.inCar;
  const spec = CAR_TYPES[car.type] || CAR_TYPES.sedan;
  const topSpeed = spec.top * 1.55; // px/s：仪表盘 km/h = speed / 1.55
  const fwd = input.isDown('KeyW') || input.isDown('ArrowUp');
  const back = input.isDown('KeyS') || input.isDown('ArrowDown');
  const left = input.isDown('KeyA') || input.isDown('ArrowLeft');
  const right = input.isDown('KeyD') || input.isDown('ArrowRight');
  if (fwd) player.speed += spec.accel * dt;
  else if (back) player.speed -= (player.speed > 0 ? 320 : 150) * dt;
  else player.speed *= Math.max(0, 1 - dt * 0.9); // 松油门滑行减速
  player.speed = Math.max(-topSpeed * 0.35, Math.min(topSpeed, player.speed));
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const spdRatio = Math.min(1, Math.abs(player.speed) / topSpeed);
  car.angle += steer * 2.1 * spdRatio * dt * Math.sign(player.speed || 1);
  const nx = car.x + Math.cos(car.angle) * player.speed * dt;
  const ny = car.y + Math.sin(car.angle) * player.speed * dt;
  // 撞楼或撞水：弹一下、减速、响一声。
  if (collidesCircle(city, nx, ny, 22)) {
    if (Math.abs(player.speed) > 120) sfx('crash');
    player.speed *= -0.25;
  } else {
    car.x = nx; car.y = ny;
  }
  car.x = Math.max(30, Math.min(WORLD.w - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.h - 30, car.y));
  player.x = car.x; player.y = car.y;
  player.angle = car.angle;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.muzzle = Math.max(0, player.muzzle - dt);
  player.invuln = Math.max(0, player.invuln - dt);
  return { topSpeed, spdRatio };
}

// 按 E 上车 / 下车：返回事件字符串（game.js 用来发 toast 与涨通缉）。
export function tryEnterCar(player, city, traffic) {
  if (player.inCar) {
    // 下车：停稳后在车边下车。
    const car = player.inCar;
    player.inCar = null;
    player.speed = 0;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    if (collidesCircle(city, player.x, player.y, PLAYER.radius)) {
      player.x = car.x - Math.cos(car.angle + Math.PI / 2) * 34;
      player.y = car.y - Math.sin(car.angle + Math.PI / 2) * 34;
    }
    car.driver = 'none';
    sfx('enter');
    return 'exit';
  }
  // 先找停着的车，再找路过的车流。
  let car = nearestParkedCar(city, player.x, player.y, 56);
  let stolen = false;
  if (car) {
    car.taken = true;
    car.parked = false;
    stolen = true; // 停着的车是别人的，偷走涨通缉
  } else {
    car = nearestTrafficCar(traffic, player.x, player.y, 56);
    if (car) { stolen = true; car.driver = 'player'; }
  }
  if (!car) return null;
  player.inCar = car;
  car.driver = 'player';
  player.speed = 0;
  sfx('enter');
  return stolen ? 'steal' : 'enter';
}

// 开枪：鼠标瞄准方向射出一发子弹，耗 1 发弹药，枪口火光亮 0.08 秒。
export function shoot(player, aimAngle, bullets) {
  if (player.inCar) return false; // 车里不开枪
  if (player.fireCooldown > 0 || player.ammo <= 0) return false;
  player.ammo -= 1;
  player.fireCooldown = 0.22;
  player.muzzle = 0.09;
  player.angle = aimAngle;
  bullets.push({
    x: player.x + Math.cos(aimAngle) * 24,
    y: player.y + Math.sin(aimAngle) * 24,
    vx: Math.cos(aimAngle) * 720, vy: Math.sin(aimAngle) * 720,
    life: 0.7, from: 'player',
  });
  sfx('shoot');
  return true;
}

// 受击：扣血并给 0.5 秒无敌。
export function hurtPlayer(player, dmg) {
  if (player.invuln > 0) return false;
  player.hp = Math.max(0, player.hp - dmg);
  player.invuln = 0.5;
  sfx('hit');
  return true;
}
