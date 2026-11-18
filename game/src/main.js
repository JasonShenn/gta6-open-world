// main.js — 启动入口：建画布、建游戏、标题画面（开始/继续）、进游戏开 M1。
import { createGame, startLoop, loadSave, applySave, bootFromUrl } from './game.js';
import { startMission } from './missions.js';

const canvas = document.getElementById('game');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const S = createGame(canvas, seed);
window.GT = S.debug; // 测试钩子：window.GT.state / .teleport / .setWanted 等
window.GT.started = () => S.started;

const titleEl = document.getElementById('title');
const continueBtn = document.getElementById('btn-continue');
const save = loadSave();
if (save) continueBtn.style.display = 'inline-block';

function begin(fresh) {
  S.sfx.ensure();
  titleEl.style.display = 'none';
  S.started = true;
  if (!fresh && save) { applySave(S, save); S.toast('Welcome back, Cash.'); }
  else startMission(S, 'M1');
  canvas.focus();
}
document.getElementById('btn-start').addEventListener('click', () => begin(true));
continueBtn.addEventListener('click', () => begin(false));
// 标题画面也支持回车开始。
window.addEventListener('keydown', e => {
  if (!S.started && e.code === 'Enter') begin(!!save ? false : true);
  if (S.over && e.code === 'KeyR') location.reload();
});
bootFromUrl(S);
startLoop(S);
