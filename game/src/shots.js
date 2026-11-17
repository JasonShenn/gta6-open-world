// 截图场景：?shot=chase|pickup|shootout|title。每个场景都从真实规则出发，
// 用自动驾驶/自动走路把世界开到那个状态，再由主循环画出来，
// 所以截图就是一段真实游戏的样子，同一个 seed 每次同一帧。

import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './missions.js';
import { EVENT_BUSTED, EVENT_MISSION_DONE, EVENT_WASTED } from './world.js';

// 自动驾驶：朝指定点开，油门踩满，方向盘跟着目标转。
function driveAutopilot(state, tx, ty) {
  const p = state.player;
  const car = p.car;
  if (!car) return { dir: { x: 0, y: 0 }, shooting: false, aim: null };
  const desired = Math.atan2(ty - car.y, tx - car.x);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return {
    dir: { x: diff > 0.15 ? 1 : diff < -0.15 ? -1 : 0, y: -1 },
    shooting: false,
    aim: null,
  };
}

// 自动走路：朝目标点直线走。
function walkAutopilot(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    dir: { x: Math.abs(dx / len) > 0.3 ? Math.sign(dx) : 0, y: Math.abs(dy / len) > 0.3 ? Math.sign(dy) : 0 },
    shooting: false,
    aim: { x: tx, y: ty },
  };
}

function simulate(world, seconds, pilot) {
  let events = 0;
  for (let t = 0; t < seconds; t += STEP) {
    events |= world.step(STEP, pilot(world.state), 0);
    if (events & (EVENT_BUSTED | EVENT_WASTED)) break;
  }
  return events;
}

/**
 * 把世界摆成指定场景，返回要画的界面。
 * chase：封面——开车逃亡，3 星通缉，两辆警车追在后面，任务目标在 HUD 上。
 * pickup：步行去码头取货，街上行人车流。
 * shootout：限时送货，枪手开火，子弹横飞。
 * title：标题画面。
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();

  if (name === 'pickup') {
    // 走到码头附近：接头人 Dex 就站在标记旁。
    state.player.x = 320;
    state.player.y = 2160;
    state.camera.x = 480;
    state.camera.y = 2100;
    simulate(world, 2.5, (s) => walkAutopilot(s, 200, 2280));
    return { screen: SCREEN_PLAY };
  }

  if (name === 'shootout') {
    // 任务三进行中：开到灯塔路中段，枪手已经开火。
    startMission(state.mission, 2);
    state.mission.timer = 48;
    // 临时摆好：玩家步行在路口，枪手在附近。
    state.player.x = 2850;
    state.player.y = 700;
    state.player.money = 250;
    state.enemies = [
      { x: 2900, y: 800, hp: 3, angle: 0, cooldown: 0.1, flash: 0, wander: 0 },
      { x: 3100, y: 620, hp: 2, angle: 0, cooldown: 0.3, flash: 0.1, wander: 0 },
      { x: 2890, y: 430, hp: 3, angle: 0, cooldown: 0.6, flash: 0, wander: 0 },
    ];
    state.camera.x = 2900;
    state.camera.y = 620;
    // 让枪手先开几枪，子弹留在画面里。
    simulate(world, 1.2, (s) => ({ dir: { x: 0, y: 0 }, shooting: true, aim: { x: 2900, y: 800 } }));
    return { screen: SCREEN_PLAY };
  }

  if (name === 'title') {
    // 标题：城市自己动 4 秒当背景。
    simulate(world, 4, () => ({ dir: { x: 0, y: 0 }, shooting: false, aim: null }));
    return { screen: SCREEN_TITLE };
  }

  // 默认 chase（封面）：任务二进行中，玩家开车沿中路向东逃，
  // 3 星通缉，两辆警车咬在后面；车停在离修车行足够远的地方，
  // 模拟 2 秒也到不了终点，任务不会提前完成。
  startMission(state.mission, 1);
  const car = state.cars.find((c) => c.kind === 'parked') || state.cars[0];
  car.kind = 'player';
  car.speed = 0;
  car.x = 1400;
  car.y = 1000;
  car.angle = 0;
  state.player.car = car;
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.money = 50; // 第一单已结，钱包里有 50。
  state.player.wanted = 3;
  state.timeSinceCrime = 0;
  state.camera.x = car.x;
  state.camera.y = car.y;
  // 两辆警车预先摆在身后（数量正好等于 3 星应有的 2 辆，不会再刷）。
  state.police = [
    { id: 1, kind: 'police', x: 1150, y: 986, angle: 0, speed: 320, color: '#1c2733', hp: 100, driver: true, axis: 'h', coord: 1000, dir: 1, turnCooldown: 0, ramCooldown: 0 },
    { id: 2, kind: 'police', x: 1240, y: 1062, angle: 0, speed: 300, color: '#1c2733', hp: 100, driver: true, axis: 'h', coord: 1000, dir: 1, turnCooldown: 0, ramCooldown: 0 },
  ];
  simulate(world, 2, (s) => driveAutopilot(s, 2400, 1000));
  return { screen: SCREEN_PLAY };
}
