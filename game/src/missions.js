// missions.js — 剧情任务、出租车支线、隐藏现金点与存档。
// 任务是线性的：M1 → M2 → M3 → M4，每段一个目标点；出租车随时可接；现金点全图 5 处。

import { MISSIONS, CASH_SPOTS, SAVE_KEY, PLACES } from './config.js';
import { sfx } from './audio.js';

export function createMissions() {
  return {
    index: 0, // 当前任务 0–3，4 表示全通关
    stage: 0, // 当前任务内的第几段
    done: false,
    timer: 0, // M4 限时倒计时
    gunmen: [], // M3 的枪手：{x,y,hp,fireTimer}
    cashBag: null, // M3 掉落的现金袋位置
    taxi: null, // 出租车支线：{phase:'pickup'|'dropoff', x, y, fare}
    cashFound: new Set(), // 已拾的现金点下标
    garage: [], // 车库收藏的车类型名
    bannerTimer: 0, // 任务卡片展示剩余时间
  };
}

// 当前任务与当前目标（全通关返回 null）。
export function currentMission(m) {
  if (m.index >= MISSIONS.length) return null;
  return MISSIONS[m.index];
}
export function currentStage(m) {
  const mis = currentMission(m);
  if (!mis) return null;
  return mis.stages[Math.min(m.stage, mis.stages.length - 1)];
}

// 任务目标点（小地图与导航箭头用）。
export function missionTarget(m) {
  if (m.taxi && m.taxi.phase) return { x: m.taxi.x, y: m.taxi.y };
  const st = currentStage(m);
  if (!st) return null;
  return { x: st.x, y: st.y };
}

// 开始一个任务：重置段数、M4 计时、M3 枪手。
export function startMission(m, idx, world) {
  m.index = idx;
  m.stage = 0;
  m.timer = MISSIONS[idx].timeLimit || 0;
  m.gunmen = [];
  m.cashBag = null;
  m.bannerTimer = 4;
  if (idx === 2) {
    // M3：码头上刷 3 名枪手（站位避开长椅与货箱，也避开中央 toast 带）。
    m.gunmen = [
      { x: 120, y: 1080, hp: 40, fireTimer: 1.2 },
      { x: 250, y: 1170, hp: 40, fireTimer: 1.8 },
      { x: 160, y: 1215, hp: 40, fireTimer: 2.4 },
    ];
  }
  sfx('mission');
}

// 推进一段：返回事件 {type:'stage'|'missionDone'|'complete'}。
export function advanceStage(m, world) {
  const mis = currentMission(m);
  if (!mis) return null;
  m.stage += 1;
  if (m.stage < mis.stages.length) {
    m.bannerTimer = 3;
    return { type: 'stage', text: mis.stages[m.stage].text };
  }
  // 整段任务完成：发钱、进车库、下一个任务。
  world.player.money += mis.pay;
  if (m.index === 1) m.garage.push('convertible');
  if (m.index === 0) m.garage.push('sedan');
  sfx('complete');
  m.index += 1;
  m.stage = 0;
  if (m.index >= MISSIONS.length) {
    m.done = true;
    world.player.money += 0;
    return { type: 'complete', text: `All missions complete — GOLDEN TIDE!` };
  }
  startMission(m, m.index, world);
  return { type: 'missionDone', text: `${mis.id} complete — $${mis.pay} banked.` };
}

// 每帧任务逻辑：目标到达检测、M4 计时、枪手开火、出租车、现金点。
// 返回本帧产生的事件数组（game.js 拿去发 toast / 结算）。
export function updateMissions(dt, m, world) {
  const events = [];
  const player = world.player;
  if (m.done) return events;
  const mis = currentMission(m);
  if (!mis) return events;
  const st = currentStage(m);

  // M4 限时：超时任务失败，回退到本任务开头。
  if (mis.timeLimit) {
    m.timer -= dt;
    if (m.timer <= 0) {
      startMission(m, m.index, world);
      events.push({ type: 'toast', text: 'Too slow — the getaway window closed. Try again!' });
      return events;
    }
  }

  // M3 枪手：朝玩家开火（子弹慢、伤害低，给玩家反应时间）。
  if (m.index === 2 && m.gunmen.length > 0) {
    for (const g of m.gunmen) {
      g.fireTimer -= dt;
      const d = Math.hypot(player.x - g.x, player.y - g.y);
      if (g.fireTimer <= 0 && d < 560 && !player.inCar) {
        g.fireTimer = 1.6;
        const a = Math.atan2(player.y - g.y, player.x - g.x);
        world.bullets.push({
          x: g.x + Math.cos(a) * 22, y: g.y + Math.sin(a) * 22,
          vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: 1.4, from: 'enemy',
        });
        sfx('shoot');
      }
    }
    // 枪手全灭 → 现金袋出现。
    if (m.gunmen.length === 0 && !m.cashBag && m.stage === 0) {
      m.cashBag = { x: PLACES.pierPickup.x, y: PLACES.pierPickup.y };
      events.push({ type: 'toast', text: 'Crew down — grab the cash bag!' });
    }
  }

  // 目标到达检测。
  if (st) {
    const d = Math.hypot(player.x - st.x, player.y - st.y);
    // M2 第一段要求开上敞篷车：目标点就是车的位置，上车即算到达。
    if (m.index === 1 && m.stage === 0) {
      if (player.inCar && player.inCar.type === 'convertible') {
        events.push(advanceStage(m, world));
        return events;
      }
    } else if (m.index === 2 && m.stage === 0) {
      if (m.gunmen.length === 0) {
        m.stage = 1;
        m.bannerTimer = 3;
        events.push({ type: 'stage', text: 'Grab the cash bag on the pier.' });
      }
    } else if (m.index === 2 && m.stage === 1) {
      if (m.cashBag && d < st.r) {
        m.cashBag = null;
        player.money += 0; // 现金袋的钱算在任务报酬里
        events.push(advanceStage(m, world));
        return events;
      }
    } else if (d < st.r) {
      const ev = advanceStage(m, world);
      if (ev) events.push(ev);
      if (ev && ev.type === 'missionDone') events.push({ type: 'toast', text: ev.text });
      return events;
    }
  }

  // 出租车支线：坐上出租车出活，接客 → 送客 → +$40，可反复接。
  if (player.inCar && player.inCar.type === 'taxi' && !m.taxi) {
    m.taxi = { phase: 'pickup', x: 1100, y: 1300, fare: 40 };
    events.push({ type: 'toast', text: 'Taxi fare: pick up the passenger.' });
  }
  if (m.taxi) {
    const d = Math.hypot(player.x - m.taxi.x, player.y - m.taxi.y);
    if (d < 70) {
      if (m.taxi.phase === 'pickup') {
        m.taxi = { phase: 'dropoff', x: 2300, y: 600, fare: 40 };
        events.push({ type: 'toast', text: 'Passenger aboard — drop them downtown.' });
      } else {
        player.money += m.taxi.fare;
        sfx('cash');
        events.push({ type: 'toast', text: `Fare complete — +$${m.taxi.fare}.` });
        m.taxi = null;
      }
    }
    // 下了出租车，单子作废。
    if (!player.inCar || player.inCar.type !== 'taxi') m.taxi = null;
  }

  // 隐藏现金点：踩到 +$60。
  CASH_SPOTS.forEach((c, i) => {
    if (m.cashFound.has(i)) return;
    if (Math.hypot(player.x - c.x, player.y - c.y) < 42) {
      m.cashFound.add(i);
      player.money += c.amount;
      sfx('cash');
      events.push({ type: 'toast', text: `Hidden cash found — +$${c.amount}! (${m.cashFound.size}/5)` });
    }
  });

  if (m.bannerTimer > 0) m.bannerTimer -= dt;
  return events;
}

// —— 存档：localStorage，存钱、任务进度、车库、现金点、玩家位置。
export function saveGame(world) {
  try {
    const data = {
      money: world.player.money,
      hp: world.player.hp,
      ammo: world.player.ammo,
      missionIndex: world.missions.index,
      stage: world.missions.stage,
      cashFound: [...world.missions.cashFound],
      garage: world.missions.garage,
      x: world.player.x, y: world.player.y,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function hasSave() {
  return loadGame() !== null;
}

// 把存档套回世界（继续游戏用）。
export function applySave(world, data) {
  const p = world.player;
  p.money = data.money ?? 210;
  p.hp = data.hp ?? 100;
  p.ammo = data.ammo ?? 24;
  p.x = data.x ?? 175;
  p.y = data.y ?? 1180;
  world.missions.index = data.missionIndex ?? 0;
  world.missions.stage = data.stage ?? 0;
  world.missions.cashFound = new Set(data.cashFound ?? []);
  world.missions.garage = data.garage ?? [];
  world.missions.bannerTimer = 3;
  if (world.missions.index === 2) {
    world.missions.gunmen = [
      { x: 120, y: 1080, hp: 40, fireTimer: 1.2 },
      { x: 250, y: 1170, hp: 40, fireTimer: 1.8 },
      { x: 160, y: 1215, hp: 40, fireTimer: 2.4 },
    ];
  }
}
