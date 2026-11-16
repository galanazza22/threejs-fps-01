// Emberline — bootstrap and the game loop.
// The simulation runs at a fixed 60 Hz step, apart from rendering: each
// animation frame accumulates wall time and steps the sim, then renders the
// latest state. Input, HUD and audio are wired here; the sim lives in the
// modules this file imports.
import { TICK, WEAPONS, ECONOMY, ROUNDS_TO_WIN, MAX_ROUNDS } from './config.js';
import { S } from './state.js';
import { BOXES, MAP } from './map.js';
import { initInput, key, firing, consumeFireEdge, consumeLook, requestLock, exitLock, clearFire } from './input.js';
import { updatePlayer } from './player.js';
import { updateWeapon, startReload, switchWeapon, buyWeapon, buyGrenade, buyArmor } from './weapons.js';
import { playerFire, updateGrenades, throwGrenade } from './combat.js';
import { updateBots } from './bots.js';
import { resetRound, startLive, updateBomb, updateRound, nextRound } from './objective.js';
import { initRender, renderFrame } from './render.js';
import { initHud, updateHud, clearBuyNotice } from './hud.js';
import { ensureAudio, sfx } from './audio.js';

const params = new URLSearchParams(window.location.search);
const shotMode = params.get('shot'); // 'spawn' | 'fight' | 'buy' | 'site' | null
let framesRendered = 0;
let prevKeys = new Set();

function keyEdge(code) {
  return key(code) && !prevKeys.has(code);
}

function snapshotKeys() {
  prevKeys = new Set();
  for (const c of ['KeyR', 'KeyG', 'KeyB', 'Enter', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyK', 'KeyE']) {
    if (key(c)) prevKeys.add(c);
  }
}

function startMatch() {
  ensureAudio();
  S.round = 1;
  S.wins = 0;
  S.losses = 0;
  S.money = ECONOMY.start;
  S.matchWinner = null;
  S.player.owned = { p9: true };
  S.player.weapon = 'p9';
  S.player.grenades = 0;
  S.player.armor = false;
  S.player.kills = 0;
  S.player.deaths = 0;
  resetRound(S);
  clearBuyNotice();
}

// One fixed simulation step.
function step(dt) {
  S.time += dt;
  const p = S.player;

  if (S.phase === 'live' && p.alive) {
    updatePlayer(S, dt, { key, consumeLook }, BOXES);
    updateWeapon(S, dt);
    // Fire: hold for automatic weapons, click for semi-automatic.
    const w = WEAPONS[p.weapon];
    if (w.auto) { if (firing()) playerFire(S); }
    else if (consumeFireEdge()) playerFire(S);
    if (keyEdge('KeyR')) startReload(S);
    if (keyEdge('KeyG')) throwGrenade(S);
    if (keyEdge('Digit1')) switchWeapon(S, 'p9');
    if (keyEdge('Digit2')) switchWeapon(S, 'vk9');
    if (keyEdge('Digit3')) switchWeapon(S, 'ar77');
    if (keyEdge('Digit4')) switchWeapon(S, 'sg12');
  } else {
    consumeFireEdge();
  }

  if (S.phase === 'buy') {
    // The shop is clicked with the mouse: release pointer lock while it is up.
    exitLock();
    if (keyEdge('Digit1')) buyWeapon(S, 'p9');
    if (keyEdge('Digit2')) buyWeapon(S, 'vk9');
    if (keyEdge('Digit3')) buyWeapon(S, 'ar77');
    if (keyEdge('Digit4')) buyWeapon(S, 'sg12');
    if (keyEdge('KeyG')) buyGrenade(S);
    if (keyEdge('KeyK')) buyArmor(S);
    if (keyEdge('Enter')) { startLive(S); requestLock(); }
  }
  if (keyEdge('KeyB') && S.phase === 'buy') { startLive(S); requestLock(); }

  // Bots hold their positions behind the menu; they do not hunt the player
  // while the title screen is up.
  if (S.phase !== 'menu') updateBots(S, dt);
  updateGrenades(S, dt);
  updateBomb(S, dt, key('KeyE'));
  updateRound(S, dt);

  // Visual timers decay.
  if (S.hitmark > 0) S.hitmark -= dt;
  if (S.damageFlash > 0) S.damageFlash -= dt;
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 1.8);
  if (S.messageT > 0) S.messageT -= dt;
  for (let i = S.tracers.length - 1; i >= 0; i--) {
    S.tracers[i].life -= dt;
    if (S.tracers[i].life <= 0) S.tracers.splice(i, 1);
  }
  for (let i = S.flashes.length - 1; i >= 0; i--) {
    S.flashes[i].life -= dt;
    if (S.flashes[i].life <= 0) S.flashes.splice(i, 1);
  }
  for (let i = S.explosions.length - 1; i >= 0; i--) {
    S.explosions[i].life -= dt;
    if (S.explosions[i].life <= 0) S.explosions.splice(i, 1);
  }
  // Kill feed lines expire after 6 seconds.
  while (S.feed.length > 0 && S.time - S.feed[0].t > 6) S.feed.shift();

  snapshotKeys();
}

// Screenshot modes: real game states, no pointer lock, for headless capture.
function setupShot(mode) {
  startMatch();
  const p = S.player;
  if (mode === 'buy') {
    // Buy phase at round 1, with money to spend: the shop is open.
    S.money = 4700;
    return;
  }
  startLive(S);
  if (mode === 'spawn') {
    p.yaw = 0;
    p.pitch = 0;
  } else if (mode === 'fight') {
    p.x = 0; p.z = 8; p.yaw = 0; p.pitch = 0.01;
    S.player.owned.ar77 = true;
    S['mag_ar77'] = 25; S['res_ar77'] = 75;
    switchWeapon(S, 'ar77');
    // Two Wardens in the lane ahead, mid-engagement, facing the player.
    const b0 = S.bots[0];
    const b1 = S.bots[1];
    b0.x = 1.5; b0.z = -1; b0.yaw = Math.PI; b0.state = 'engage'; b0.burst = 3;
    b1.x = -3.5; b1.z = -4; b1.yaw = Math.PI - 0.3; b1.state = 'engage'; b1.burst = 3;
    S.tracers.push({ x1: 0, y1: 1.5, z1: 13, x2: 2, y2: 1.3, z2: -2, life: 0.07 });
    S.message = 'Round 1 — plant the charge at Furnace or the Array Field';
    S.messageT = 3;
  } else if (mode === 'site') {
    p.x = -18; p.z = -10; p.yaw = 0.9; p.pitch = 0.02;
    S.bomb.state = 'planted';
    S.bomb.site = 'A';
    S.bomb.x = MAP.sites.A.x;
    S.bomb.z = MAP.sites.A.z;
    S.bomb.fuse = 28;
    const b0 = S.bots[0];
    b0.x = -22.5; b0.z = -13; b0.yaw = 0.5; b0.state = 'defuse';
    S.bomb.defuse = 0.45;
    S.message = 'Charge planted at Furnace — defend it!';
    S.messageT = 3;
  }
}

function boot() {
  const el = document.getElementById('game');
  initRender(el);
  initInput(el, (locked) => {
    if (!locked && S.phase === 'live' && !shotMode) {
      // Pointer lock lost mid-round: the game keeps running; click to re-lock.
    }
  });
  initHud(S, {
    onPlay: () => {
      ensureAudio();
      startMatch();
      sfx.click();
    },
    onRestart: () => {
      ensureAudio();
      startMatch();
      sfx.click();
    },
    onDeploy: () => { if (S.phase === 'buy') { startLive(S); requestLock(); } },
  });

  if (shotMode) {
    setupShot(shotMode);
  } else {
    // Menu backdrop: a live-looking yard behind the title, bots holding.
    resetRound(S);
    S.phase = 'menu';
  }

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dtWall = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dtWall;
    let steps = 0;
    while (acc >= TICK && steps < 5) {
      step(TICK);
      acc -= TICK;
      steps++;
    }
    if (steps === 5) acc = 0;
    renderFrame(S, now / 1000);
    updateHud(S);
    framesRendered++;
    if (framesRendered === 3) window.__ready = true;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('error', (e) => { window.__gameError = String(e.message || e.error); });
boot();
