// Solmar Heat — keyboard + mouse input. Keys are tracked by code so
// layouts do not matter; mouse position is kept in screen pixels and
// converted to world aim by the game.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this._pressed = new Set(); // edge-triggered keys, consumed each frame
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      if (!e.repeat) this._pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this.mouse.down = true;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }

  // True once on the frame the key went down.
  pressed(code) { return this._pressed.has(code); }

  // WASD / arrows as a normalised movement vector.
  moveVector() {
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  endFrame() { this._pressed.clear(); }
}
