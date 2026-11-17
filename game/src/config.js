// Solmar Heat 的全部常量：世界尺寸、道路网格、速度、通缉、任务数值。
// 改这里就能调手感，不用翻别的模块。

// 世界：一座 3200 x 2400 的海滨城市，道路每 400 一格。
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_SPACING = 400;
export const ROAD_W = 96;
export const LANE = ROAD_W / 2 - 14;

// 步行与驾驶的手感数值。
export const WALK_SPEED = 210;
export const CAR_ACCEL = 620;
export const CAR_BRAKE = 900;
export const CAR_REVERSE_MAX = 220;
export const CAR_MAX_SPEED = 560;
export const CAR_TURN = 2.6;
export const POLICE_MAX_SPEED = 590;

// 生命、金钱与通缉。
export const PLAYER_MAX_HP = 100;
export const BUST_FINE = 150;
export const WANTED_DECAY_SECONDS = 18;
export const WANTED_DECAY_STEP = 8;

// 任务奖励（美元）。
export const REWARD_PICKUP = 50;
export const REWARD_ESCAPE = 200;
export const REWARD_DELIVERY = 400;
export const DELIVERY_TIME_LIMIT = 75;

// 存档键与固定步长。
export const SAVE_KEY = 'solmar-heat-save-v1';
export const STEP = 1 / 60;

// 阳光海滨配色：暖色沥青、米色人行道、彩色屋顶、绿地公园。
export const PALETTE = {
  grass: '#7fae5a',
  park: '#69a24e',
  road: '#3a3f4a',
  roadLine: '#e8d44f',
  sidewalk: '#c9bda6',
  block: '#8a7f6a',
  water: '#3f8fb5',
  sand: '#e6d199',
};
