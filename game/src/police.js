// police.js — 警察：按通缉等级刷出、追捕撞击、包抄、3 星起路障、被捕判定。
import { AVENUES, STREETS } from './city.js';
import { CAR_TYPES } from './config.js';
import { makeRng, range, pick } from './rng.js';

// 目标警车数：1 星 1 辆，2 星 2 辆，3 星 3 辆，4 星 4 辆，5 星 5 辆。
export function wantedPoliceCount(wanted) { return wanted <= 0 ? 0 : Math.min(5, wanted); }

// 在玩家附近的道路上刷一辆警车。
function spawnPolice(S) {
  const rng = S.rng;
  const vertical = rng() < 0.5;
  let x, y;
  if (vertical) { x = pick(rng, AVENUES) + (rng() < 0.5 ? -22 : 22); y = S.player.y + range(rng, -700, 700); }
  else { y = pick(rng, STREETS) + (rng() < 0.5 ? -22 : 22); x = S.player.x + range(rng, -700, 700); }
  x = Math.max(320, Math.min(5150, x)); y = Math.max(40, Math.min(3750, y));
  S.police.push({ x, y, angle: 0, speed: 0, flash: rng() < 0.5 });
}
export function updatePolice(S, dt) {
  const p = S.player;
  const want = wantedPoliceCount(S.wanted);
  // 通缉为 0 时警车逐渐撤离；有通缉时补足数量。
  S.policeTimer -= dt;
  if (S.wanted > 0 && S.police.length < want && S.policeTimer <= 0) {
    spawnPolice(S);
    S.policeTimer = 1.2;
  }
  if (S.wanted === 0 && S.police.length > 0 && S.policeTimer <= 0) {
    S.police.pop(); S.policeTimer = 2;
  }
  for (const c of S.police) {
    // 追捕：朝玩家加速，带一点包抄偏移（左右夹击）。
    const dx = p.x - c.x, dy = p.y - c.y;
    const dist = Math.hypot(dx, dy) || 1;
    const flank = c.flank ?? (c.flank = (S.rng() < 0.5 ? -1 : 1) * 120);
    const tx = p.x + -dy / dist * flank * 0.4, ty = p.y + dx / dist * flank * 0.4;
    const wantAngle = Math.atan2(ty - c.y, tx - c.x);
    let da = wantAngle - c.angle;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    c.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, da));
    const top = 470 + S.wanted * 22;
    c.speed = Math.min(top, c.speed + 420 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
    c.flash = !c.flash;
    // 撞到玩家：步行扣血 / 开车撞击减速 + 震屏。
    if (dist < 34) {
      if (p.car) { p.car.speed *= 0.55; S.shake = 7; S.sfx.crash(); }
      else if (S.hurtCd <= 0) { p.hp -= 12; S.hurtCd = 0.8; S.sfx.crash(); S.shake = 6; }
      c.speed *= 0.4;
    }
    // 警车之间互相推开，避免叠在一起。
    for (const o of S.police) {
      if (o === c) continue;
      const ddx = c.x - o.x, ddy = c.y - o.y, dd = Math.hypot(ddx, ddy);
      if (dd > 0 && dd < 40) { c.x += ddx / dd * 30 * dt; c.y += ddy / dd * 30 * dt; }
    }
  }
  // 3 星起路障：两辆警车横在玩家前方道路上。
  if (S.wanted >= 3 && S.roadblocks.length === 0) {
    const ahead = p.car ? p.angle : p.aim;
    const bx = p.x + Math.cos(ahead) * 420, by = p.y + Math.sin(ahead) * 420;
    S.roadblocks.push({ x: bx, y: by, angle: ahead + Math.PI / 2 });
    S.toast('Roadblock ahead!');
  }
  if (S.wanted < 3) S.roadblocks = [];
  S.hurtCd = Math.max(0, (S.hurtCd || 0) - dt);
  // 被捕：步行且血量耗尽，或被警车贴身困住。
  if (!p.car && p.hp <= 0 && !S.over) {
    S.over = 'busted';
    S.toast('BUSTED!');
  }
}
// 画警车（红蓝闪灯）与路障（横停的警车 + 路锥）。
import { drawCar } from './traffic.js';
export function drawPolice(ctx, S) {
  for (const c of S.police) drawCar(ctx, c.x, c.y, c.angle, 'sedan', { police: true, flash: c.flash });
  for (const r of S.roadblocks) {
    drawCar(ctx, r.x, r.y, r.angle, 'sedan', { police: true, flash: true });
    ctx.fillStyle = '#ff7a1a';
    for (let i = -2; i <= 2; i++) {
      const cx = r.x + Math.cos(r.angle) * i * 46, cy = r.y + Math.sin(r.angle) * i * 46;
      ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx + 7, cy + 6); ctx.lineTo(cx - 7, cy + 6); ctx.closePath(); ctx.fill();
    }
  }
}
