// input.js — 键盘 + 鼠标输入：WASD/方向键、Shift 跑、E 上下车、Space/点击开枪、
// R 补弹药、P 暂停、M 静音。鼠标屏幕坐标换算成世界坐标供瞄准用。
export function makeInput(canvas, S) {
  const input = {
    up: false, down: false, left: false, right: false, run: false,
    mouseX: 640, mouseY: 360, mouseWX: 0, mouseWY: 0, mouseActive: false,
  };
  const keys = {};
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;
    sync();
    if (e.code === 'KeyE') S.queueEnter = true;
    if (e.code === 'KeyP') S.queuePause = true;
    if (e.code === 'KeyM') S.queueMute = true;
    if (e.code === 'KeyR') S.queueRestock = true;
    if (e.code === 'Space') { input.shootHeld = true; e.preventDefault(); }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; sync(); if (e.code === 'Space') input.shootHeld = false; });
  function sync() {
    input.up = keys.KeyW || keys.ArrowUp || false;
    input.down = keys.KeyS || keys.ArrowDown || false;
    input.left = keys.KeyA || keys.ArrowLeft || false;
    input.right = keys.KeyD || keys.ArrowRight || false;
    input.run = keys.ShiftLeft || keys.ShiftRight || false;
  }
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - r.left) * (1280 / r.width);
    input.mouseY = (e.clientY - r.top) * (720 / r.height);
    input.mouseActive = true;
    updateWorld();
  });
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) { input.shootHeld = true; input.mouseActive = true; updateWorld(); S.sfx.ensure(); }
  });
  window.addEventListener('mouseup', () => { input.shootHeld = false; });
  function updateWorld() {
    input.mouseWX = S.cam.x + input.mouseX / S.zoom;
    input.mouseWY = S.cam.y + input.mouseY / S.zoom;
  }
  input.updateWorld = updateWorld;
  return input;
}
