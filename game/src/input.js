// input.js — 键盘与鼠标状态：游戏每帧读它，测试也能直接往里写键。

// 按下的键集合（存 e.code，如 KeyW、Space、ShiftLeft）。
export const keys = new Set();

// 鼠标在画布上的位置、是否按住、以及本帧是否点过（点击只消费一次）。
export const mouse = { x: 0, y: 0, down: false, clicked: false, clickX: 0, clickY: 0 };

// 把键盘与鼠标事件绑到画布与窗口上。
export function bindInput(canvas) {
  window.addEventListener('keydown', (e) => {
    // 方向键与空格会滚动页面，玩游戏时拦住它们。
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    mouse.down = true;
    mouse.clicked = true;
    const r = canvas.getBoundingClientRect();
    mouse.clickX = e.clientX - r.left;
    mouse.clickY = e.clientY - r.top;
    e.preventDefault();
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// 本帧是否按下了某个键（传 e.code）。
export function isDown(code) {
  return keys.has(code);
}

// 取消费一次点击：返回点击位置，没有点击返回 null。
export function takeClick() {
  if (!mouse.clicked) return null;
  mouse.clicked = false;
  return { x: mouse.clickX, y: mouse.clickY };
}

// WASD / 方向键合成的移动向量（已归一化）。
export function moveAxis() {
  let x = 0, y = 0;
  if (isDown('KeyA') || isDown('ArrowLeft')) x -= 1;
  if (isDown('KeyD') || isDown('ArrowRight')) x += 1;
  if (isDown('KeyW') || isDown('ArrowUp')) y -= 1;
  if (isDown('KeyS') || isDown('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  return { x, y };
}

// 供测试直接模拟按键：按下 / 松开。
export function pressKey(code) { keys.add(code); }
export function releaseKey(code) { keys.delete(code); }
export function clearKeys() { keys.clear(); }
