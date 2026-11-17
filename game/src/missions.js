// 任务线：三段连续剧情，主角 Rook Calloway 是索尔玛湾的跑腿司机，
// 委托人是中间人 Mara Voss。任务只管“目标是什么、怎么算完成”，
// 具体的车、人、警察由 world.js 管。

import { DELIVERY_TIME_LIMIT, REWARD_DELIVERY, REWARD_ESCAPE, REWARD_PICKUP } from './config.js';

export const MISSION_PICKUP = 0;
export const MISSION_ESCAPE = 1;
export const MISSION_DELIVERY = 2;

// 任务标题与剧情台词（原创，与任何商业游戏无关）。
export const MISSIONS = [
  {
    id: 'pickup',
    title: '任务 1：码头取货',
    intro: 'Mara Voss：去西南码头，找 Dex 拿那个“包裹”。别多问，别多看。',
    objective: '走到码头标记处，按 E 取货',
    reward: REWARD_PICKUP,
  },
  {
    id: 'escape',
    title: '任务 2：甩掉条子',
    intro: 'Mara Voss：货到手了，但条子盯上你了。随便偷辆车，开到东边修车行，甩掉他们！',
    objective: '偷一辆车（靠近按 E），开到修车行标记处',
    reward: REWARD_ESCAPE,
  },
  {
    id: 'delivery',
    title: '任务 3：限时送货',
    intro: 'Mara Voss：最后一单：75 秒内把货送到东北灯塔。Rival 帮的人在路上等你，小心枪。',
    objective: '在限时内把货送到灯塔标记处',
    reward: REWARD_DELIVERY,
  },
];

/** 新开一局时的任务状态。 */
export function createMissionState() {
  return {
    index: 0, // 当前任务 0/1/2；3 表示三单全做完
    stage: 'go', // go：赶往目标；interact：到点按 E；done：本单完成
    timer: 0, // 任务三的倒计时
    done: [false, false, false],
    banner: '', // 屏幕中央飘过的提示
    bannerTimer: 0,
  };
}

/** 当前任务的目标点（世界坐标 + 名字）。 */
export function missionTarget(mission, landmarks) {
  if (mission.index === MISSION_PICKUP) return { x: landmarks.pier.x, y: landmarks.pier.y, label: '码头' };
  if (mission.index === MISSION_ESCAPE) return { x: landmarks.garage.x, y: landmarks.garage.y, label: '修车行' };
  if (mission.index === MISSION_DELIVERY) return { x: landmarks.lighthouse.x, y: landmarks.lighthouse.y, label: '灯塔' };
  return null;
}

/** 当前任务的目标文案（HUD 上显示的那行）。 */
export function missionObjective(mission) {
  if (mission.index >= MISSIONS.length) return '剧情完成！自由探索索尔玛湾';
  return MISSIONS[mission.index].objective;
}

/** 开始第 index 个任务：重置阶段与计时，返回开场台词。 */
export function startMission(mission, index) {
  mission.index = index;
  mission.stage = 'go';
  mission.timer = index === MISSION_DELIVERY ? DELIVERY_TIME_LIMIT : 0;
  mission.banner = MISSIONS[index].title;
  mission.bannerTimer = 3;
  return MISSIONS[index].intro;
}

/** 完成当前任务：发奖励、记完成、切到下一个；返回是否全线完成。 */
export function completeMission(mission) {
  const index = mission.index;
  mission.done[index] = true;
  mission.index += 1;
  if (mission.index >= MISSIONS.length) {
    mission.stage = 'done';
    mission.banner = '剧情完成！+$' + MISSIONS[index].reward;
    mission.bannerTimer = 4;
    return { allDone: true, reward: MISSIONS[index].reward };
  }
  mission.stage = 'go';
  mission.timer = mission.index === MISSION_DELIVERY ? DELIVERY_TIME_LIMIT : 0;
  mission.banner = '任务完成 +$' + MISSIONS[index].reward + '  ·  ' + MISSIONS[mission.index].title;
  mission.bannerTimer = 3.5;
  return { allDone: false, reward: MISSIONS[index].reward, intro: MISSIONS[mission.index].intro };
}
