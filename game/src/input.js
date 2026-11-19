// Keyboard and mouse state, with pointer-lock mouse look and one-shot "pressed" queries.
const down = new Set();
const pressed = new Set();
const mouse = { dx: 0, dy: 0, left: false, leftPressed: false, locked: false };

export function initInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.left = true; mouse.leftPressed = true; }
    if (!mouse.locked && canvas.requestPointerLock) canvas.requestPointerLock();
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.left = false; });
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement === canvas;
  });
  window.addEventListener('mousemove', (e) => {
    if (mouse.locked) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  });
}

export const isDown = (code) => down.has(code);
export const wasPressed = (code) => pressed.has(code);

export function axis(neg, pos) {
  return (isDown(pos) ? 1 : 0) - (isDown(neg) ? 1 : 0);
}

export function moveAxes() {
  return {
    x: axis('KeyA', 'KeyD') || axis('ArrowLeft', 'ArrowRight'),
    y: axis('KeyS', 'KeyW') || axis('ArrowDown', 'ArrowUp'),
  };
}

export function consumeMouse() {
  const m = { dx: mouse.dx, dy: mouse.dy, left: mouse.left, leftPressed: mouse.leftPressed };
  mouse.dx = 0; mouse.dy = 0; mouse.leftPressed = false;
  return m;
}

export function endFrame() { pressed.clear(); }

export function releasePointer() {
  if (document.exitPointerLock && mouse.locked) document.exitPointerLock();
}
