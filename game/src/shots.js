// shots.js — 四张截图的确定性布景：?shot=<名>&seed=7 时摆好场景、相机与状态。
// 全是玩法画面，没有标题菜单；种子固定，同一命令每次出同一张图。

import { CAR_TYPES } from './config.js';
import { startMission } from './missions.js';
import { setWanted } from './police.js';
import { toast } from './game.js';

// 一辆停好的车：直接放进世界并交给玩家（或停在画面里）。
function placeCar(world, type, color, x, y, angle) {
  const car = {
    x, y, angle, speed: 0, type, color,
    driver: 'none', parked: false,
  };
  world.traffic.cars.push(car);
  return car;
}

// 把玩家放进一辆车并设定车速（km/h 仪表盘换算：px/s ÷ 1.55）。
function driveCar(world, car, kmh) {
  world.player.inCar = car;
  car.driver = 'player';
  world.player.speed = kmh * 1.55;
  world.player.x = car.x;
  world.player.y = car.y;
  world.cam.x = car.x;
  world.cam.y = car.y;
  world.cam.zoom = 1.35;
}

// 步行站位：玩家在某点，相机居中，步行变焦 2.1×。
function standAt(world, x, y, angle) {
  world.player.inCar = null;
  world.player.speed = 0;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  world.cam.x = x;
  world.cam.y = y;
  world.cam.zoom = 2.1;
}

export function stageShot(world, name) {
  const p = world.player;
  // 先清掉 startGame 留下的 M1 toast，免得它飘在截图中央（还盖霓虹）。
  // 3-shootout 会在自己的分支里重新发一条 toast，不受影响。
  const toastEl = document.getElementById('toast');
  if (toastEl) toastEl.style.opacity = '0';
  world.toastTimer = 0;
  if (name === '1-chase') {
    // 封面：橙色跑车 + 两辆警车一前一后 + 3 星 + 高速 + M2 任务。
    startMission(world.missions, 1, world);
    world.missions.stage = 1; // 已偷到车，正在送 Chop Shop
    world.missions.bannerTimer = 0; // 不挡画面中央
    const car = placeCar(world, 'convertible', '#ff8c1a', 1500, 950, Math.PI / 2);
    driveCar(world, car, 207);
    world.shotSpeedKmh = 207;
    // 警车：一辆紧贴在后，一辆在前方路口。
    const cop1 = placeCar(world, 'police', '#2e6fd8', 1500, 1130, Math.PI / 2);
    cop1.driver = 'police';
    const cop2 = placeCar(world, 'police', '#2e6fd8', 1500, 760, -Math.PI / 2);
    cop2.driver = 'police';
    world.police.cars = [cop1, cop2];
    setWanted(world.police, 3);
    world.police.heat = 40;
    p.money = 1250;
    world.missions.garage = ['sedan'];
    world.targetPos = { x: 2500, y: 2080 };
  } else if (name === '2-pier') {
    // 码头步行：玩家红夹克 + 金圈站在木码头上，游艇、棕榈、目标金环都在。
    // 站位离取包点 75px（目标半径 70），不会一开局就触发过关；相机以玩家为中心，游艇正在画面上沿。
    startMission(world.missions, 0, world);
    world.missions.bannerTimer = 0;
    standAt(world, 250, 1130, -Math.PI / 2);
    p.money = 210;
    world.targetPos = { x: 175, y: 1125 };
  } else if (name === '3-shootout') {
    // 码头枪战：玩家带大星形枪口火光，3 名枪手同尺寸、头顶血条。
    startMission(world.missions, 2, world);
    world.missions.bannerTimer = 0;
    standAt(world, 175, 1125, Math.PI / 2);
    // 瞄准最近的枪手，枪口火光常亮（截图瞬间正好在开火）。
    p.angle = Math.atan2(1170 - 1125, 250 - 175);
    p.muzzle = 10; // 截图期间一直亮
    p.fireCooldown = 0;
    p.money = 860;
    p.ammo = 18;
    setWanted(world.police, 2);
    toast(world, 'Gunfire spotted — wanted level 2!');
    world.targetPos = { x: 175, y: 1125 };
  } else if (name === '4-downtown') {
    // 大道驾驶：白色轿车穿过市中心，塔楼霓虹在画面上部（PIER 9 在横幅下方、任务卡已隐藏，不被遮），车流密集。
    startMission(world.missions, 0, world);
    world.missions.stage = 1; // 送货去修车铺
    world.missions.bannerTimer = 0;
    const car = placeCar(world, 'sedan', '#e8e4da', 1900, 950, -Math.PI / 2);
    driveCar(world, car, 167);
    world.shotSpeedKmh = 167;
    p.money = 480;
    world.missions.garage = ['sedan'];
    world.targetPos = { x: 1500, y: 660 };
    // 画面里再加几辆车流，显得拥挤。
    placeCar(world, 'taxi', '#ffd21f', 1900, 1420, Math.PI / 2);
    placeCar(world, 'sports', '#ff7a1a', 1900, 1080, -Math.PI / 2);
    placeCar(world, 'van', '#7fb3d5', 2300, 1150, 0);
  }
  // 截图时不自动存档、不跑任务计时干扰：把 M4 计时之外的状态钉住。
  world.saveTimer = -9999;
}
