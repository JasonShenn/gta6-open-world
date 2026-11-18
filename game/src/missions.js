// missions.js — 剧情任务 M1–M4、出租车支线、隐藏现金点、M3 枪手。
import { MISSIONS, CAR_TYPES } from './config.js';
import { findFreeSpot } from './city.js';
import { addWanted } from './player.js';

// 当前任务目标点（小地图标记与导航用）。
export function currentTarget(S) {
  const m = S.mission;
  if (!m) return null;
  const sp = S.city.spots;
  if (m.id === 'M1') return m.stage === 0 ? sp.pierPickup : sp.mara;
  if (m.id === 'M2') return m.stage === 0 ? sp.convertible : sp.chop;
  if (m.id === 'M3') return m.stage === 0 ? { x: 220, y: 1570 } : sp.pierPickup;
  if (m.id === 'M4') return sp.airport;
  return null;
}
export function currentObjective(S) {
  const m = S.mission;
  if (!m) return 'All missions complete — free roam Palmera!';
  const def = MISSIONS[m.id];
  return m.stage === 0 ? def.brief : def.step2;
}

// 开始任务：设横幅 + 目标 chip。
export function startMission(S, id) {
  const def = MISSIONS[id];
  S.mission = { id, stage: 0 };
  S.banner = { title: `${def.code.split(' · ')[0]} — ${def.title}`, sub: def.banner, t: 4 };
  S.toast(`${def.code}: ${def.brief}`);
  if (id === 'M3') spawnCrew(S); // 码头枪手
  if (id === 'M4') {
    S.m4Timer = 90;
    // M4 逃逸厢车停在玩家附近（若已被开走则在原地再刷一辆）。
    if (!S.cars.some(c => c.type === 'van')) {
      const v = S.city.spots.vanSpawn;
      S.cars.push({ x: v.x, y: v.y, angle: Math.PI / 2, speed: 0, type: 'van', parked: true });
    }
    S.toast('Get in the van — 90 seconds!');
  }
}
// M3 枪手：在码头刷 4 名敌人（与玩家同尺寸、头顶血条、会还击）。
function spawnCrew(S) {
  S.enemies = [];
  const spots = [[150, 1520], [260, 1620], [330, 1540], [180, 1640]];
  for (const [x, y] of spots)
    S.enemies.push({ x, y, hp: 100, max: 100, angle: 0, shootCd: 1.5 + Math.random() });
}
// 敌人更新：靠近玩家开枪（子弹朝玩家），被打死后掉落现金袋。
export function updateEnemies(S, dt) {
  const p = S.player;
  for (const e of S.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    e.angle = Math.atan2(p.y - e.y, p.x - e.x);
    e.shootCd -= dt;
    if (d < 620 && e.shootCd <= 0 && !p.car) {
      e.shootCd = 1.6;
      S.bullets.push({ x: e.x + Math.cos(e.angle) * 20, y: e.y + Math.sin(e.angle) * 20, vx: Math.cos(e.angle) * 520, vy: Math.sin(e.angle) * 520, from: 'enemy', life: 1.2 });
      S.sfx.shot();
    }
    // 敌人缓慢逼近玩家。
    if (d > 260) { e.x += Math.cos(e.angle) * 42 * dt; e.y += Math.sin(e.angle) * 42 * dt; }
  }
  const alive = S.enemies.filter(e => e.hp > 0).length;
  if (S.mission?.id === 'M3' && S.mission.stage === 0 && S.enemies.length > 0 && alive === 0) {
    S.mission.stage = 1;
    S.cashBag = { x: 220, y: 1570 };
    S.toast('Crew cleared — grab the cash bag!');
  }
}
// 任务推进：靠近目标点即触发阶段切换/完成。
export function updateMissions(S, dt) {
  const p = S.player, m = S.mission;
  if (!m) return;
  const t = currentTarget(S);
  const d = t ? Math.hypot(p.x - t.x, p.y - t.y) : 9999;
  if (m.id === 'M1' && m.stage === 0 && d < 46) {
    m.stage = 1; S.toast('Package picked up — take it to Mara\'s Garage!');
    S.sfx.pickup();
  } else if (m.id === 'M1' && m.stage === 1 && d < 60) completeMission(S);
  else if (m.id === 'M2' && m.stage === 0 && p.car?.type === 'sports') {
    m.stage = 1; S.toast('You got the convertible — lose the cops, then hit the Chop Shop!');
  } else if (m.id === 'M2' && m.stage === 1 && p.car?.type === 'sports' && d < 70) {
    if (S.wanted > 0) S.toast('Too hot! Lose the cops first.');
    else completeMission(S);
  } else if (m.id === 'M3' && m.stage === 1 && S.cashBag && Math.hypot(p.x - S.cashBag.x, p.y - S.cashBag.y) < 40) {
    S.cashBag = null; completeMission(S);
  } else if (m.id === 'M4') {
    S.m4Timer -= dt;
    if (d < 80 && p.car?.type === 'van') completeMission(S);
    else if (S.m4Timer <= 0) {
      S.toast('Too slow — the airport run failed. Try again!');
      S.mission = null; S.m4Timer = 0;
      setTimeout(() => startMission(S, 'M4'), 1500);
    }
  }
  // 隐藏现金点：走过即 +$50。
  for (const s of S.stashes) {
    if (!s.got && Math.hypot(p.x - s.x, p.y - s.y) < 34) {
      s.got = true; S.money += 50; S.cashFound++;
      S.sfx.pickup(); S.toast(`Hidden cash found! +$50 (${S.cashFound}/5)`);
    }
  }
  // 出租车支线：开出租车时自动接客 → 送客 +$40。
  updateTaxi(S, dt);
}
function completeMission(S) {
  const def = MISSIONS[S.mission.id];
  S.money += def.pay;
  S.done.push(S.mission.id);
  S.sfx.pickup();
  S.toast(`${def.code} complete! +$${def.pay}`);
  S.banner = { title: `${def.title} COMPLETE`, sub: `+$${def.pay} — Mara is pleased.`, t: 3.5 };
  const order = ['M1', 'M2', 'M3', 'M4'];
  const next = order[order.indexOf(S.mission.id) + 1];
  S.mission = null;
  S.saveSoon = true;
  if (next) setTimeout(() => startMission(S, next), 1200);
  else { S.over = 'win'; }
}
function updateTaxi(S, dt) {
  const p = S.player;
  if (p.car?.type !== 'taxi') { S.taxi = null; return; }
  if (!S.taxi) {
    // 乘客随机出现在附近路口。
    const a = Math.random() * 6.28, r = 500 + Math.random() * 500;
    const tx = Math.max(350, Math.min(5100, p.x + Math.cos(a) * r));
    const ty = Math.max(60, Math.min(3700, p.y + Math.sin(a) * r));
    const f = findFreeSpot(S.city, tx, ty);
    const dx = Math.max(350, Math.min(5100, f.x + (Math.random() < 0.5 ? -900 : 900)));
    const dy = Math.max(60, Math.min(3700, f.y + (Math.random() < 0.5 ? -700 : 700)));
    const d2 = findFreeSpot(S.city, dx, dy);
    S.taxi = { stage: 0, px: f.x, py: f.y, dx: d2.x, dy: d2.y };
    S.toast('Taxi fare waiting — pick up the passenger!');
  }
  const t = S.taxi;
  const dest = t.stage === 0 ? { x: t.px, y: t.py } : { x: t.dx, y: t.dy };
  if (Math.hypot(p.x - dest.x, p.y - dest.y) < 60) {
    if (t.stage === 0) { t.stage = 1; S.toast('Passenger aboard — drive to the destination!'); }
    else { S.money += 40; S.sfx.pickup(); S.toast('Fare complete! +$40'); S.taxi = null; }
  }
  void dt;
}
// 画任务标记：目标金色光柱 + 脉冲圆环；现金袋；枪手血条。
export function drawMissionMarks(ctx, S) {
  const t = currentTarget(S);
  if (t && !S.over) {
    const pulse = 1 + 0.12 * Math.sin(S.time * 4);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,210,90,0.9)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(t.x, t.y, 30 * pulse, 0, 6.29); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,90,0.25)';
    ctx.beginPath(); ctx.arc(t.x, t.y, 30 * pulse, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffd25a';
    ctx.beginPath(); ctx.moveTo(t.x, t.y - 26); ctx.lineTo(t.x + 9, t.y - 8); ctx.lineTo(t.x - 9, t.y - 8); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (S.cashBag) {
    ctx.fillStyle = '#3f7a3a'; ctx.beginPath(); ctx.arc(S.cashBag.x, S.cashBag.y, 12, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffd25a'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('$', S.cashBag.x, S.cashBag.y + 5);
  }
  // 未拾取的现金点画小绿光（靠近才显眼）。
  for (const s of S.stashes) {
    if (s.got) continue;
    ctx.fillStyle = 'rgba(80,220,120,0.8)';
    ctx.beginPath(); ctx.arc(s.x, s.y, 6 + 2 * Math.sin(S.time * 3 + s.x), 0, 6.29); ctx.fill();
  }
  // 枪手：与玩家同尺寸 + 头顶血条。
  for (const e of S.enemies) {
    if (e.hp <= 0) continue;
    ctx.save(); ctx.translate(e.x, e.y);
    ctx.fillStyle = 'rgba(58,32,12,0.4)';
    ctx.beginPath(); ctx.ellipse(9, 6, 11, 6, 0, 0, 6.29); ctx.fill();
    ctx.rotate(e.angle);
    ctx.fillStyle = '#3a3a44'; ctx.beginPath(); ctx.roundRect(-7, -8, 15, 16, 5); ctx.fill();
    ctx.fillStyle = '#e8dcc8'; ctx.beginPath(); ctx.arc(4, 0, 6, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#1c1c22'; ctx.fillRect(8, -2, 12, 4);
    ctx.restore();
    // 血条
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(e.x - 16, e.y - 30, 32, 6);
    ctx.fillStyle = '#ff4a3a'; ctx.fillRect(e.x - 15, e.y - 29, 30 * Math.max(0, e.hp / e.max), 4);
  }
  // 出租车乘客/目的地标记。
  if (S.taxi) {
    const d = S.taxi.stage === 0 ? { x: S.taxi.px, y: S.taxi.py } : { x: S.taxi.dx, y: S.taxi.dy };
    ctx.fillStyle = S.taxi.stage === 0 ? '#37e0d8' : '#ffd25a';
    ctx.beginPath(); ctx.arc(d.x, d.y, 10, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#222'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(S.taxi.stage === 0 ? 'P' : '$', d.x, d.y + 4);
  }
}
