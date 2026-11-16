// Emberline — keyboard, mouse and pointer lock.
// One module owns every raw device event; the simulation reads the snapshot
// (keys held, look deltas, fire edge) through the accessors below.
const keys = new Set();
let lookDX = 0;
let lookDY = 0;
let fireHeld = false;
let fireEdge = false;
let locked = false;
let lockEl = null;

export function initInput(el, onLockChange) {
  lockEl = el;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === lockEl;
    if (onLockChange) onLockChange(locked);
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    lookDX += e.movementX;
    lookDY += e.movementY;
  });
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (!locked) { requestLock(); return; }
    fireHeld = true;
    fireEdge = true;
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) fireHeld = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function requestLock() {
  if (!lockEl || locked) return;
  try { const p = lockEl.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* pointer lock unavailable */ }
}

export function exitLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

export function isLocked() { return locked; }
export function key(code) { return keys.has(code); }
export function consumeLook() {
  const r = { dx: lookDX, dy: lookDY };
  lookDX = 0;
  lookDY = 0;
  return r;
}
export function firing() { return fireHeld; }
export function consumeFireEdge() {
  const f = fireEdge;
  fireEdge = false;
  return f;
}
export function clearFire() { fireHeld = false; fireEdge = false; }
