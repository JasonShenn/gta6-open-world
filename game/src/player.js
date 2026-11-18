// player.js — 玩家：步行/驾驶物理、上下车与偷车、射击、受伤与拾取。
import { CAR_TYPES, PLAYER } from './config.js';
import { cityCollides } from './city.js';

// 步行更新：WASD 移动（Shift 跑），撞墙则沿墙滑行。
export function updateOnFoot(S, input, dt) {
  const p = S.player;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx || my) {
    const len = Math.hypot(mx, my); mx /= len; my /= len;
    const sp = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.moving = true;
    p.angle = Math.atan2(my, mx);
    const nx = p.x + mx * sp * dt, ny = p.y + my * sp * dt;
    if (!cityCollides(S.city, nx, p.y, PLAYER.radius)) p.x = nx;
    if (!cityCollides(S.city, p.x, ny, PLAYER.radius)) p.y = ny;
  } else p.moving = false;
  // 瞄准方向：鼠标在屏幕上的位置换算成世界方向。
  if (input.mouseActive) p.aim = Math.atan2(input.mouseWY - p.y, input.mouseWX - p.x);
  else if (p.moving) p.aim = p.angle;
}

// 驾驶更新：W 前进/S 刹车倒车，A/D 转向（速度越快转向越稳），撞楼减速。
export function updateDriving(S, input, dt) {
  const p = S.player, car = p.car;
  const def = CAR_TYPES[car.type];
  const fwd = (input.up ? 1 : 0) - (input.down ? 0.7 : 0);
  car.speed += fwd * def.accel * dt;
  car.speed -= car.speed * 0.55 * dt; // 阻力
  if (Math.abs(car.speed) > def.top) car.speed = Math.sign(car.speed) * def.top;
  if (Math.abs(car.speed) > 12) {
    const steer = ((input.left ? 1 : 0) - (input.right ? 1 : 0)) * def.turn * dt * Math.sign(car.speed);
    car.angle += steer * Math.min(1, Math.abs(car.speed) / 140);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (cityCollides(S.city, nx, ny, 16)) {
    if (Math.abs(car.speed) > 120) { S.sfx.crash(); S.shake = 6; }
    car.speed *= -0.25; // 撞墙反弹减速
  } else { car.x = nx; car.y = ny; }
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  // 出界拉回
  car.x = Math.max(170, Math.min(5180, car.x));
  car.y = Math.max(20, Math.min(3780, car.y));
}

// E 键：附近有车则上车（停着的车=偷，通缉+2）；在车上则下车。
export function tryEnterExitCar(S) {
  const p = S.player;
  if (p.car) {
    const car = p.car; p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 26;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 26;
    if (!S.cars.includes(car)) S.cars.push(car); // 下车后车留在原地，可再上
    S.toast('You got out.');
    return;
  }
  let best = null, bd = 70;
  for (const c of S.cars) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  p.car = best;
  if (best.parked) {
    best.parked = false;
    S.cars = S.cars.filter(c => c !== best);
    S.owned.push(best);
    addWanted(S, 2, 'Car stolen — wanted level 2!');
    S.toast('Stolen! The cops are coming.');
    if (CAR_TYPES[best.type].collect && !S.garage.includes(best.type)) {
      S.garage.push(best.type);
      S.toast(`New ride for the garage: ${CAR_TYPES[best.type].name} (${S.garage.length}/5)`);
    }
  } else {
    S.toast(`Driving the ${CAR_TYPES[best.type].name}.`);
  }
}

// 通缉等级变化（上限 5），到 2 星以上刷出警车。
export function addWanted(S, n, msg) {
  const before = S.wanted;
  S.wanted = Math.min(5, S.wanted + n);
  if (msg) S.toast(msg);
  if (S.wanted >= 2 && before < 2) S.policeTimer = 0; // 立即开始刷警车
}

// 开枪：朝鼠标方向发射，耗 1 发弹药，涨 1 星热度（封顶到 2 星以内不叠加刷屏）。
export function shoot(S, input) {
  const p = S.player;
  if (p.ammo <= 0) { S.toast('Out of ammo — press R to restock ($20).'); return; }
  if (S.shootCd > 0) return;
  S.shootCd = 0.22;
  p.ammo--;
  const a = input.mouseActive ? Math.atan2(input.mouseWY - p.y, input.mouseWX - p.x) : p.aim;
  S.bullets.push({ x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, from: 'player', life: 0.7 });
  S.muzzle = 0.09; // 枪口火光持续 0.09 秒
  S.sfx.shot();
  if (S.wanted < 2) addWanted(S, 1, 'Gunfire spotted — wanted level 2!');
}

// 子弹更新：命中敌人/玩家/建筑，溅出火花粒子。
export function updateBullets(S, dt) {
  for (const b of S.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.from === 'player') {
      for (const e of S.enemies) {
        if (e.hp > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 16) {
          e.hp -= 34; b.life = 0;
          S.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ff5a3a', r: 5 });
          if (e.hp <= 0) { S.toast('Crew member down!'); S.money += 25; }
          break;
        }
      }
    } else {
      const p = S.player;
      if (Math.hypot(p.x - b.x, p.y - b.y) < 13) {
        p.hp -= 8; b.life = 0;
        S.particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ff5a3a', r: 5 });
      }
    }
    if (cityCollides(S.city, b.x, b.y, 2)) b.life = 0;
  }
  S.bullets = S.bullets.filter(b => b.life > 0);
  for (const pt of S.particles) { pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; }
  S.particles = S.particles.filter(pt => pt.life > 0);
}

// 画步行玩家：约 17 世界单位高（步行 2.1× 变焦下约 36px），红夹克 + 手枪 + 金圈。
export function drawPlayer(ctx, S) {
  const p = S.player;
  if (p.car) return;
  const bob = p.moving ? Math.sin(S.time * 14) * 2 : 0;
  ctx.save(); ctx.translate(p.x, p.y);
  // 长影朝东
  ctx.fillStyle = 'rgba(58,32,12,0.4)';
  ctx.beginPath(); ctx.ellipse(10, 6, 12, 7, 0, 0, 6.29); ctx.fill();
  // 金圈（玩家标记）
  ctx.strokeStyle = 'rgba(255,210,90,0.9)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, 6.29); ctx.stroke();
  // 身体朝向瞄准方向
  ctx.rotate(p.aim);
  ctx.fillStyle = '#d83a2e'; ctx.beginPath(); ctx.roundRect(-7, -8, 15, 16, 5); ctx.fill(); // 红夹克
  ctx.fillStyle = '#2a2118'; ctx.beginPath(); ctx.arc(4, 0, 6, 0, 6.29); ctx.fill();          // 头
  ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.arc(4, -2, 2, 0, 6.29); ctx.fill();         // 金发
  // 手枪（看得见的枪管）
  ctx.fillStyle = '#1c1c22'; ctx.fillRect(8, -2, 13, 4);
  ctx.fillStyle = '#3a3a44'; ctx.fillRect(8, -2, 13, 1.5);
  // 枪口火光：大而亮的星形
  if (S.muzzle > 0) {
    ctx.fillStyle = 'rgba(255,220,90,0.95)';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r = i % 2 ? 6 : 17;
      ctx.lineTo(21 + Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,150,40,0.7)';
    ctx.beginPath(); ctx.arc(21, 0, 8, 0, 6.29); ctx.fill();
  }
  ctx.restore();
  void bob;
}
