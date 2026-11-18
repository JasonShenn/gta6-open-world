// GOLDEN TIDE — input.js
// One job: keyboard and mouse state. WASD/arrows to move and drive, E to enter
// or steal a car, Space or click to shoot, P pause, M mute, R restart a run.

export class Input {
  constructor(canvas) {
    this.keys = {};
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.pressed = {}; // keys pressed since last frame (edge-triggered)
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys[e.key.toLowerCase()]) this.pressed[e.key.toLowerCase()] = true;
      this.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => { this.mouse.down = true; this.mouse.clicked = true; });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    window.addEventListener('blur', () => { this.keys = {}; this.mouse.down = false; });
  }

  down(...names) { return names.some((n) => this.keys[n]); }
  hit(...names) { return names.some((n) => this.pressed[n]); }
  // Call at the end of each frame so edge triggers fire exactly once.
  endFrame() { this.pressed = {}; this.mouse.clicked = false; }
}
