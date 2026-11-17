// 键盘 + 鼠标输入：WASD/方向键移动，E 上下车，空格或左键开火，
// Enter 确认，P/Esc 暂停，M 静音。把原始按键折成每帧的动作，
// 世界模块只读这份动作，不直接碰 DOM。

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_MUTE = 16;

/** 造一个输入器：监听 canvas 所在窗口的按键与鼠标。 */
export function createInput(canvas) {
  const keys = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let actions = 0;

  const down = (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'Space') actions |= ACTION_SHOOT;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  };
  const up = (event) => keys.delete(event.code);
  const mouseMove = (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  };
  const mouseDownHandler = (event) => {
    mouseMove(event);
    mouseDown = true;
    // 点击也算确认：标题画面点一下就能开局。
    actions |= ACTION_CONFIRM;
  };
  const mouseUpHandler = () => {
    mouseDown = false;
  };

  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDownHandler);
  window.addEventListener('mouseup', mouseUpHandler);

  return {
    /** 本帧按下的方向：x 右正，y 下正（-1/0/1）。 */
    direction() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
        - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    /** 是否正按着开火键（空格或鼠标左键）。 */
    get shooting() {
      return mouseDown || keys.has('Space');
    },
    /** 鼠标在画布上的位置（像素，CSS 坐标）。 */
    get mouse() {
      return { x: mouseX, y: mouseY };
    },
    /** 取走并清空本帧攒下的瞬时动作（确认/暂停/上下车/静音）。 */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** 供截图脚本直接注入按键（测试用，不经过真实键盘）。 */
    inject(code, pressed) {
      if (pressed) keys.add(code);
      else keys.delete(code);
    },
    injectMouse(x, y, downNow) {
      mouseX = x;
      mouseY = y;
      mouseDown = downNow;
    },
    injectAction(action) {
      actions |= action;
    },
  };
}
