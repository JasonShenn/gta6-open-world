// shots.js — 确定性截图布景：?shot=<名>&seed=<数> 时按固定剧本摆好场景，
// 供 tests/shots.mjs 渲染 4 张 1280×720 截图。布景全是玩法画面，无标题菜单。
import { startMission } from './missions.js';
import { addWanted } from './player.js';

// 每张图的固定布景（与 shots.json 的 query 对应）。
export function applyShot(S, name) {
  const p = S.player, sp = S.city.spots;
  S.shotMode = true;
  if (name === 'chase') {
    // 封面：橙色跑车 + 2 辆警车 + 3 星 + 任务目标 + 高车速（市中心高楼段）。
    p.car = { x: 2820, y: 1000, angle: Math.PI / 2, speed: 460, type: 'sports', parked: false };
    S.owned.push(p.car);
    p.x = p.car.x; p.y = p.car.y;
    S.wanted = 3;
    S.police = [
      { x: 2798, y: 900, angle: Math.PI / 2, speed: 420, flash: true },
      { x: 2842, y: 1160, angle: -Math.PI / 2, speed: 420, flash: false },
    ];
    S.mission = { id: 'M2', stage: 1 };
    S.banner = { title: 'M2 — SUNSET STEAL', sub: 'Lose the cops — deliver the convertible to the Chop Shop.', t: 30 };
    S.money = 1250; S.garage = ['sports'];
    // 附近再摆几辆车流（全部压在车道上，不进街区），显出追逐密度。
    S.traffic.cars[0] = { type: 'sedan', x: 2798, y: 1240, angle: Math.PI / 2, speed: 160, vertical: true, road: 2820, dir: 1 };
    S.traffic.cars[1] = { type: 'taxi', x: 3050, y: 902, angle: 0, speed: 150, vertical: false, road: 880, dir: 1 };
    S.traffic.cars[2] = { type: 'van', x: 2600, y: 902, angle: 0, speed: 140, vertical: false, road: 880, dir: 1 };
  } else if (name === 'pier') {
    // 码头步行：玩家站在码头木栈道上，大变焦，玩家约 36px。
    p.x = 250; p.y = 1570; p.aim = -Math.PI / 2; p.car = null;
    S.zoom = 2.1;
    startMission(S, 'M1');
    S.toasts = []; // 只留横幅，不叠重复提示
    S.banner = { title: 'M1 — FIRST JOB', sub: 'Pick up the package at the Marina Pier.', t: 30 };
    S.money = 210;
    // 码头上两个散步的行人。
    S.traffic.peds[0] = { x: 330, y: 1600, angle: Math.PI, speed: 0, color: '#c96f5a', vertical: false, t: 5 };
    S.traffic.peds[1] = { x: 140, y: 1540, angle: 0, speed: 0, color: '#5f8f7a', vertical: false, t: 5 };
  } else if (name === 'shootout') {
    // 码头枪战：玩家持枪 + 3 名枪手 + 枪口火光 + 2 星 + 开枪提示。
    p.x = 430; p.y = 1620; p.aim = Math.PI; p.car = null; p.ammo = 18;
    S.zoom = 2.1;
    startMission(S, 'M3');
    S.enemies = S.enemies.filter(e => e.hp > 0).slice(0, 3);
    S.enemies[0].x = 300; S.enemies[0].y = 1520;
    if (S.enemies[1]) { S.enemies[1].x = 330; S.enemies[1].y = 1640; }
    if (S.enemies[2]) { S.enemies[2].x = 180; S.enemies[2].y = 1600; }
    S.wanted = 2;
    S.muzzle = 30; // 截图瞬间保持火光
    S.banner = { title: 'M3 — PIER SHOOTOUT', sub: 'Shooting raised the heat — take the cash bag!', t: 30 };
    S.toasts = [{ text: 'Gunfire spotted — wanted level 2!', t: 30 }]; // 只留这一条提示
    S.money = 860;
  } else if (name === 'downtown') {
    // 大道驾驶：市中心高楼 + 密集车流 + 送货任务 + 车速。
    p.car = { x: 3420, y: 1000, angle: Math.PI / 2, speed: 370, type: 'sedan', parked: false };
    S.owned.push(p.car);
    p.x = p.car.x; p.y = p.car.y;
    S.mission = { id: 'M1', stage: 1 };
    S.banner = { title: 'M1 — FIRST JOB', sub: "Deliver the package to Mara's Garage.", t: 30 };
    S.money = 480; S.garage = ['sedan'];
    // 大道上摆满车流（全部压在 3420 大道车道上）。
    const spots = [[3398, 820, 1], [3442, 1180, -1], [3398, 700, 1], [3442, 900, -1], [3398, 1150, 1], [3442, 760, -1]];
    spots.forEach(([x, y, d], i) => {
      S.traffic.cars[i] = { type: ['sedan', 'taxi', 'van', 'pickup', 'sports', 'sedan'][i], x, y, angle: d > 0 ? Math.PI / 2 : -Math.PI / 2, speed: 150, vertical: true, road: 3420, dir: d };
    });
  }
  // 截图模式：全部定格布景（不推进世界，构图与车速保持设定值）。
  S.freezeWorld = true;
  void addWanted;
}
