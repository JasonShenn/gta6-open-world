// 启动与主循环：输入每帧读一次，世界按固定 1/60 秒步进，
// 渲染器画出当前界面。界面：标题 → 游玩 → 暂停 / 被捕 / 被干掉 / 剧情完成。
//
// ?seed=N 固定城市。?shot=chase|pickup|shootout|title 摆好场景、画两帧、
// 置 window.__shotReady，截图脚本就按这个拍。
// 调试口：window.__game = { state, world, input, screen }，测试脚本用它读状态。

import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION_DONE, EVENT_PICKUP, EVENT_SHOOT, EVENT_STEAL, EVENT_STORY_DONE, EVENT_TIMER_OUT, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_STORY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { stageShot } from './shots.js';

/** 一帧最多追赶 0.25 秒；切后台回来丢掉积压，不快进。 */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

/** 读存档：钱包、做到第几单、历史最高钱包。 */
function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 0, missionIndex: 0, best: 0 };
    const parsed = JSON.parse(raw);
    return {
      money: Number(parsed.money) || 0,
      missionIndex: Math.min(2, Number(parsed.missionIndex) || 0),
      best: Number(parsed.best) || 0,
    };
  } catch {
    return { money: 0, missionIndex: 0, best: 0 };
  }
}

/** 写存档：钱包 + 任务进度 + 最高钱包。 */
function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // 隐私窗口存不了：这局的进度只活到关页面。
  }
}

// 存档先进世界（开局钱包与任务接着做），再进渲染器（标题上显示）。
const save = readSave();
world.state.saved = { money: save.money, missionIndex: save.missionIndex };
world.reset();

/** 截图模式：摆场景、画两帧、报就绪。 */
function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, save);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

/** 正常游玩模式。 */
function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // 调试口：测试脚本读状态、注入按键。
  window.__game = { state: world.state, world, input, get screen() { return screen; } };

  function announce(message) {
    status.textContent = message;
  }

  /** 同步存档：钱包、任务进度、最高钱包。 */
  function syncSave() {
    save.money = world.state.player.money;
    save.missionIndex = Math.min(2, world.state.mission.index);
    save.best = Math.max(save.best, save.money);
    writeSave(save);
  }

  function startGame() {
    audio.ensure();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Mission: ' + world.state.mission.index + 1);
  }

  function endTo(nextScreen) {
    screen = nextScreen;
    syncSave();
  }

  /** 世界事件 → 音效与播报。 */
  function handleEvents(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_STEAL) announce('Stole a car. Wanted level up.');
    if (events & EVENT_PICKUP) {
      audio.pickup();
      announce('Package collected.');
    }
    if (events & EVENT_MISSION_DONE) {
      audio.missionDone();
      syncSave();
    }
    if (events & EVENT_STORY_DONE) {
      endTo(SCREEN_STORY);
      announce('Story complete.');
    }
    if (events & EVENT_TIMER_OUT) announce('Out of time. Mission restarted.');
    if (events & EVENT_BUSTED) {
      audio.busted();
      endTo(SCREEN_BUSTED);
      announce('Busted.');
    }
    if (events & EVENT_WASTED) {
      audio.busted();
      endTo(SCREEN_WASTED);
      announce('Wasted.');
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED || screen === SCREEN_STORY)) {
      audio.ensure();
      if (screen === SCREEN_TITLE) startGame();
      else {
        // 被捕/被干掉/剧情完成之后：回到标题，再按一次开新局。
        screen = SCREEN_TITLE;
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      syncSave();
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      // 标题背景：城市自己动，玩家不动。
      world.step(STEP, { dir: { x: 0, y: 0 }, shooting: false, aim: null }, 0);
      return;
    }
    const dir = input.direction();
    const aim = renderer.screenToWorld(input.mouse.x, input.mouse.y);
    const events = world.step(STEP, { dir, shooting: input.shooting, aim }, actions);
    handleEvents(events);
    // 引擎与警笛跟车速、通缉走。
    const speed01 = world.state.player.car
      ? Math.abs(world.state.player.car.speed) / 560
      : 0;
    audio.update(speed01, world.state.player.wanted);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // 每帧只取一次动作：先分给界面（确认/暂停/静音），再分给世界（上下车/取货），
    // 剩下的固定步进不再重复消费。
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, save);
  }

  // 切后台自动暂停，回来再继续。
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      syncSave();
      announce('Paused.');
    }
  });

  announce('Solmar Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
