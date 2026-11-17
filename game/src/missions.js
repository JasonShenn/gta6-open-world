// Solmar Heat — the story: three missions for a newcomer in Solmar,
// given over the phone by Vera, the fixer who runs the garage.
// Rook (the player) just rolled into town with $120 and a pistol.

import { LANDMARKS } from './city.js';
import { MISSION_REWARDS } from './config.js';

export const STORY_INTRO =
  'You are Rook — new in Solmar, broke, and already on Vera\'s list. ' +
  'She runs a garage on the west side and a dozen quiet errands. ' +
  'Do the jobs, keep the cops off your back, and Solmar starts paying.';

// Each mission is a list of steps. A step completes when the player
// reaches its marker (and presses E where the step asks for it).
export const MISSIONS = [
  {
    id: 'pickup',
    title: 'Mission 1 — The Pickup',
    caller: 'Vera',
    briefing: 'A package is waiting on Sunset Pier. Walk it back to my garage. No guns, no noise — first job, first rule.',
    steps: [
      { kind: 'reach', label: 'Go to Sunset Pier', x: LANDMARKS.pier.x, y: LANDMARKS.pier.y, r: 90, pressE: true, prompt: 'Press E to grab the package' },
      { kind: 'reach', label: 'Bring the package to Vera\'s Garage', x: LANDMARKS.garage.x, y: LANDMARKS.garage.y, r: 110, pressE: true, prompt: 'Press E to hand over the package' },
    ],
    reward: MISSION_REWARDS[0],
    outro: 'Clean. You move quiet, Rook. There is more where that came from.',
  },
  {
    id: 'hotwheels',
    title: 'Mission 2 — Hot Wheels',
    caller: 'Vera',
    briefing: 'A gold coupe is parked by Solmar Plaza. It has an owner, and the owner has friends with guns. Take the car, shake the heat, bring it to Rust & Bolt Yard.',
    steps: [
      { kind: 'steal', label: 'Steal the gold coupe at Solmar Plaza', x: 2080, y: 800, r: 120, prompt: 'Press E near the gold coupe to steal it' },
      { kind: 'deliver', label: 'Deliver the coupe to Rust & Bolt Yard', x: LANDMARKS.chopShop.x, y: LANDMARKS.chopShop.y, r: 130, inCar: true, prompt: 'Drive the coupe into the yard' },
    ],
    reward: MISSION_REWARDS[1],
    outro: 'The coupe is already in pieces. You drive like you mean it.',
    spawnGuards: [{ x: 2020, y: 760 }, { x: 2140, y: 860 }],
  },
  {
    id: 'deadline',
    title: 'Mission 3 — Deadline Run',
    caller: 'Vera',
    briefing: 'Harbor Market has a crate for Lumen Tower. One hundred seconds, and the market crew does not like couriers. Go.',
    steps: [
      { kind: 'reach', label: 'Pick up the crate at Harbor Market', x: LANDMARKS.market.x, y: LANDMARKS.market.y, r: 100, pressE: true, prompt: 'Press E to grab the crate', timed: 100 },
      { kind: 'reach', label: 'Deliver to Lumen Tower — beat the clock!', x: LANDMARKS.tower.x, y: LANDMARKS.tower.y, r: 130, pressE: true, prompt: 'Press E to drop the crate', timed: true },
    ],
    reward: MISSION_REWARDS[2],
    outro: 'Ninety seconds of my life I will never get back. You are hired, Rook. Solmar is yours now.',
    spawnGuards: [{ x: 2280, y: 1840 }, { x: 2400, y: 1760 }],
  },
];

export class MissionManager {
  constructor(game) {
    this.game = game;
    this.index = 0;          // which mission is active (0..2), -1 = story done
    this.step = 0;           // step inside the active mission
    this.active = false;     // a mission is currently running
    this.timer = 0;          // countdown for timed missions (0 = not timed)
    this.timerRunning = false;
    this.completedCount = 0;
    this.banner = null;      // { title, text, until } shown top-centre
    this.waitingForNext = 0; // seconds until the next mission's call
  }

  get mission() { return this.index >= 0 && this.index < MISSIONS.length ? MISSIONS[this.index] : null; }
  get currentStep() {
    const m = this.mission;
    return m && this.active ? m.steps[this.step] : null;
  }

  showBanner(title, text, seconds) {
    this.banner = { title, text, until: this.game.time + (seconds || 6) };
  }

  startMission(i) {
    const m = MISSIONS[i];
    if (!m) return;
    this.index = i;
    this.step = 0;
    this.active = true;
    this.timer = 0;
    this.timerRunning = false;
    this.game.sounds.phone();
    this.showBanner(m.title, `${m.caller}: “${m.briefing}”`, 8);
    if (m.spawnGuards) {
      for (const g of m.spawnGuards) this.game.spawnEnemy(g.x, g.y);
    }
    this.game.setObjective(this.currentStep ? this.currentStep.label : '');
  }

  // Called when the player fails (busted / flatlined): restart the
  // current mission from its first step.
  restartCurrent() {
    if (!this.mission) return;
    this.game.clearEnemies();
    this.startMission(this.index);
  }

  completeMission() {
    const m = this.mission;
    if (!m) return;
    this.active = false;
    this.timerRunning = false;
    this.completedCount++;
    this.game.money += m.reward;
    this.game.sounds.missionDone();
    this.showBanner('Job done — $' + m.reward, `${m.caller}: “${m.outro}”`, 7);
    this.game.setObjective('');
    this.game.save();
    if (this.index + 1 < MISSIONS.length) {
      this.waitingForNext = 4;
    } else {
      this.index = -1;
      this.showBanner('Solmar is yours', 'All three jobs done. Free roam — press R at the garage to replay the story.', 9);
    }
  }

  failTimed() {
    this.game.sounds.busted();
    this.showBanner('Too slow', 'The crate missed its window. Vera is not happy — try again.', 6);
    this.restartCurrent();
  }

  update(dt) {
    const g = this.game;
    if (this.banner && g.time > this.banner.until) this.banner = null;
    if (this.waitingForNext > 0) {
      this.waitingForNext -= dt;
      if (this.waitingForNext <= 0) this.startMission(this.index + 1);
      return;
    }
    if (!this.active || !this.mission) return;
    const step = this.currentStep;
    if (!step) return;

    // Timed missions: the clock starts on the first step and runs
    // through the whole mission.
    if (step.timed === true || (typeof step.timed === 'number')) {
      if (!this.timerRunning) {
        this.timer = typeof step.timed === 'number' ? step.timed : this.timer;
        this.timerRunning = true;
      }
      this.timer -= dt;
      if (this.timer <= 0) { this.failTimed(); return; }
    }

    const px = g.player.x, py = g.player.y;
    const d = Math.hypot(px - step.x, py - step.y);

    if (step.kind === 'steal') {
      // Complete when the player is sitting in the gold target car.
      if (g.inCar && g.car && g.car.targetCar) this.advance();
      return;
    }
    if (step.kind === 'deliver') {
      if (d < step.r && g.inCar && g.car && g.car.targetCar) this.advance();
      return;
    }
    // 'reach' steps: stand in the ring, press E where asked.
    if (d < step.r) {
      if (step.pressE) {
        g.setPrompt(step.prompt);
        if (g.input.pressed('KeyE')) this.advance();
      } else {
        this.advance();
      }
    }
  }

  advance() {
    const g = this.game;
    g.sounds.pickup();
    this.step++;
    const m = this.mission;
    if (this.step >= m.steps.length) {
      this.completeMission();
    } else {
      g.setObjective(this.currentStep.label);
    }
  }

  // Marker the HUD/minimap draw for the current step (null when idle).
  marker() {
    const s = this.currentStep;
    return s ? { x: s.x, y: s.y, r: s.r, label: s.label } : null;
  }
}
