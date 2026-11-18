// config.js — GOLDEN TIDE v4 的全部常量：世界尺寸、道路网格、车辆、任务与存档键。
// 所有模块都从这里读数，改数值只改这一个文件。

// 世界是一张 3400×2600 的俯视地图：西边是大海与码头，东边是机场，中间是 Palmera 市区。
export const WORLD = { w: 3400, h: 2600 };

// 道路网格：纵向大道与横向街道的中心线，路宽 116。
export const ROADS_X = [300, 700, 1100, 1500, 1900, 2300, 2700, 3100];
export const ROADS_Y = [250, 600, 950, 1300, 1650, 2000, 2350];
export const ROAD_W = 116;

// 海洋在西侧，x < 250 的区域都是水；码头从岸边向海里伸出去。
export const SEA_X = 250;
// 沙滩在南侧，y > 2380 的东段是沙地与棕榈。
export const BEACH_Y = 2380;
// 机场在东侧，x > 3150 的一段是跑道与机库。
export const AIRPORT_X = 3150;

// 视角：步行放大 2.1 倍（玩家约 36px 高），开车 1.35 倍。
export const ZOOM_FOOT = 2.1;
export const ZOOM_CAR = 1.35;

// 六种可偷的车：名字、极速（km/h 仪表盘换算用）、加速、颜色。
export const CAR_TYPES = {
  sedan: { name: 'Sedan', top: 168, accel: 210, color: '#e8e4da' },
  sports: { name: 'Sunset Sports', top: 218, accel: 300, color: '#ff7a1a' },
  convertible: { name: 'Convertible', top: 205, accel: 280, color: '#ff8c1a' },
  taxi: { name: 'Taxi', top: 165, accel: 200, color: '#ffd21f' },
  van: { name: 'Van', top: 142, accel: 160, color: '#7fb3d5' },
  pickup: { name: 'Pickup', top: 175, accel: 220, color: '#c0392b' },
  police: { name: 'Police Cruiser', top: 212, accel: 320, color: '#2e6fd8' },
};

// 四个剧情任务：每段由若干小目标串起来，目标点都在路边或地标上。
export const MISSIONS = [
  {
    id: 'M1', title: 'FIRST JOB', pay: 150,
    brief: 'Pick up the package at the Marina Pier.',
    stages: [
      { text: 'Pick up the package at the Marina Pier.', x: 175, y: 1125, r: 70 },
      { text: "Deliver the package to Mara's Garage.", x: 1500, y: 660, r: 80 },
    ],
  },
  {
    id: 'M2', title: 'SUNSET STEAL', pay: 300,
    brief: 'Steal the orange convertible, lose the cops.',
    stages: [
      { text: 'Steal the orange convertible.', x: 1650, y: 980, r: 90 },
      { text: 'Deliver the convertible to the Chop Shop.', x: 2500, y: 2080, r: 90 },
    ],
  },
  {
    id: 'M3', title: 'PIER SHOOTOUT', pay: 400,
    brief: 'Fight the pier crew and grab the cash bag.',
    stages: [
      { text: 'Clear the pier crew — three gunmen.', x: 175, y: 1125, r: 130 },
      { text: 'Grab the cash bag on the pier.', x: 175, y: 1125, r: 70 },
    ],
  },
  {
    id: 'M4', title: 'GOLDEN GETAWAY', pay: 800,
    brief: 'Outrun the roadblocks to the airport gate.',
    stages: [
      { text: 'Reach the airport gate before the timer ends.', x: 3240, y: 2000, r: 90 },
    ],
    timeLimit: 90,
  },
];

// 五个隐藏现金点：每处 +$60，踩到即拾取，存档里记着。
// 全部放在路边、公园或沙滩上，保证步行能踩到（不压在楼里）。
export const CASH_SPOTS = [
  { x: 700, y: 470, amount: 60 },
  { x: 2300, y: 920, amount: 60 },
  { x: 900, y: 1470, amount: 60 },
  { x: 2700, y: 1620, amount: 60 },
  { x: 2050, y: 2430, amount: 60 },
];

// 码头取包点、修车铺、Chop Shop、机场门的位置（任务目标共用）。
export const PLACES = {
  pierPickup: { x: 175, y: 1125 },
  garage: { x: 1500, y: 660 },
  chopShop: { x: 2500, y: 2080 },
  airportGate: { x: 3240, y: 2000 },
  convertibleSpot: { x: 1650, y: 980 },
};

// 存档键与初始金钱。
export const SAVE_KEY = 'golden-tide-v4-save';
export const START_MONEY = 210;

// 通缉：偷车至少 2 星，开枪 +1，3 星起出现路障。
export const WANTED_MAX = 5;
export const ROADBLOCK_FROM = 3;

// 玩家数值。
export const PLAYER = {
  walkSpeed: 175, runSpeed: 265, radius: 15, hp: 100, ammo: 24, ammoMax: 48,
};
