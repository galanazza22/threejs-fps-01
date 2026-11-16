// Emberline — combat: hitscan shooting, damage, grenades, tracers.
// Raycasts are hand-rolled against the map boxes and fighter hitboxes
// (body box + head sphere), so a headshot is a real geometric hit, not a
// random roll. No allocations in the shot path: temporaries are module-level.
import { WEAPONS, ARMOR_REDUCTION, BOT } from './config.js';
import { rayBox, raySphere, losClear, dist2D } from './collide.js';
import { BOXES } from './map.js';
import { currentSpread, syncAmmo } from './weapons.js';
import { eyePos } from './player.js';
import { sfx } from './audio.js';

const _eye = { x: 0, y: 0, z: 0 };
const _dir = { x: 0, y: 0, z: 0 };

// Ray against one fighter (player or bot): body box, then head sphere.
// Fighter feet at (fx, fy, fz). Returns {dist, part} or null.
export function rayVsFighter(ox, oy, oz, dx, dy, dz, fx, fy, fz, maxD) {
  // Body box, half extents 0.38 x 0.38, y from +0.15 to +1.45 (in feet space).
  const b = { x: fx, z: fz, hx: 0.38, hz: 0.38, h: 1.45 };
  // rayBoxShifted measures y relative to the fighter's feet (origin pre-shifted).
  const tBody = rayBoxShifted(ox, oy - fy, oz, dx, dy, dz, b, maxD, 0.15);
  const tHead = raySphere(ox, oy, oz, dx, dy, dz, fx, fy + 1.55, fz, 0.17, maxD);
  if (tHead !== Infinity && tHead < tBody) return { dist: tHead, part: 'head' };
  if (tBody !== Infinity) return { dist: tBody, part: 'body' };
  return null;
}

// rayBox with a y-offset for the box floor (used for fighter bodies).
function rayBoxShifted(ox, oy, oz, dx, dy, dz, b, maxD, floor) {
  let tmin = 0;
  let tmax = maxD;
  if (Math.abs(dx) < 1e-9) {
    if (ox < b.x - b.hx || ox > b.x + b.hx) return Infinity;
  } else {
    let t1 = (b.x - b.hx - ox) / dx;
    let t2 = (b.x + b.hx - ox) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dz) < 1e-9) {
    if (oz < b.z - b.hz || oz > b.z + b.hz) return Infinity;
  } else {
    let t1 = (b.z - b.hz - oz) / dz;
    let t2 = (b.z + b.hz - oz) / dz;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (Math.abs(dy) < 1e-9) {
    if (oy < floor || oy > b.h) return Infinity;
  } else {
    let t1 = (floor - oy) / dy;
    let t2 = (b.h - oy) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

// One shot from the player: pellets, spread, recoil, wall and bot hits.
export function playerFire(S) {
  const p = S.player;
  const w = WEAPONS[p.weapon];
  if (p.cooldown > 0 || p.reloading > 0 || !p.alive) return false;
  if (p.mag <= 0) { sfx.dry(); p.cooldown = 0.25; return false; }
  p.mag -= 1;
  syncAmmo(S);
  p.cooldown = w.interval;
  p.bloom = Math.min(0.05, p.bloom + w.recoil * 0.55);
  p.recoilPitch = Math.min(0.09, p.recoilPitch + w.recoil);
  sfx.shot(p.weapon);
  S.shot = true;
  S.shotX = p.x;
  S.shotZ = p.z;

  eyePos(S, _eye);
  const baseYaw = p.yaw;
  const basePitch = p.pitch;
  const spread = currentSpread(S);
  let anyHit = false;
  let anyKill = false;

  for (let pi = 0; pi < w.pellets; pi++) {
    // Random direction inside the spread cone (deterministic RNG).
    const a = S.rng() * Math.PI * 2;
    const r = spread * Math.sqrt(S.rng());
    const yaw = baseYaw + Math.cos(a) * r;
    const pitch = basePitch + Math.sin(a) * r;
    const cp = Math.cos(pitch);
    _dir.x = -Math.sin(yaw) * cp;
    _dir.y = Math.sin(pitch);
    _dir.z = -Math.cos(yaw) * cp;

    // Nearest wall.
    let wallD = w.range;
    for (let i = 0; i < BOXES.length; i++) {
      const t = rayBox(_eye.x, _eye.y, _eye.z, _dir.x, _dir.y, _dir.z, BOXES[i], wallD);
      if (t < wallD) wallD = t;
    }
    // Nearest bot.
    let hitBot = null;
    let hitPart = null;
    let hitD = wallD;
    for (let i = 0; i < S.bots.length; i++) {
      const bot = S.bots[i];
      if (!bot.alive) continue;
      const h = rayVsFighter(_eye.x, _eye.y, _eye.z, _dir.x, _dir.y, _dir.z, bot.x, bot.y, bot.z, hitD);
      if (h && h.dist < hitD) { hitD = h.dist; hitBot = bot; hitPart = h.part; }
    }
    const hx = _eye.x + _dir.x * hitD;
    const hy = _eye.y + _dir.y * hitD;
    const hz = _eye.z + _dir.z * hitD;
    S.tracers.push({ x1: _eye.x, y1: _eye.y, z1: _eye.z, x2: hx, y2: hy, z2: hz, life: 0.07 });
    S.flashes.push({ x: _eye.x + _dir.x * 0.5, y: _eye.y - 0.12, z: _eye.z + _dir.z * 0.5, life: 0.05 });
    if (hitBot) {
      anyHit = true;
      const fall = hitD > w.range * 0.6
        ? 1 - 0.5 * ((hitD - w.range * 0.6) / (w.range * 0.4))
        : 1;
      let dmg = w.damage * fall * (hitPart === 'head' ? w.headMul : 1);
      if (damageBot(S, hitBot, dmg, hitPart)) anyKill = true;
    }
  }
  if (anyHit) { S.hitmark = 0.25; S.hitmarkKill = anyKill; sfx.hit(); if (anyKill) sfx.kill(); }
  // Recoil climbs the view AFTER the shot leaves the barrel, so the shot
  // itself goes where the player aimed; the next shot must be re-aimed.
  p.pitch += w.recoil * 0.55;
  return true;
}

// Damage a bot. Returns true when the shot killed it.
export function damageBot(S, bot, dmg, part) {
  bot.hp -= dmg;
  bot.flinch = 0.25;
  bot.lastSeenX = S.player.x;
  bot.lastSeenZ = S.player.z;
  bot.alert = true;
  if (bot.hp <= 0 && bot.alive) {
    bot.alive = false;
    bot.hp = 0;
    S.player.kills += 1;
    S.money += 300;
    addFeed(S, `You eliminated Warden-${bot.id + 1}${part === 'head' ? ' (headshot)' : ''}`);
    return true;
  }
  return false;
}

// Damage the player (bot bullets, grenades). Returns true on death.
export function damagePlayer(S, dmg, fromX, fromZ) {
  const p = S.player;
  if (!p.alive) return false;
  if (p.armor) dmg *= 1 - ARMOR_REDUCTION;
  p.hp -= dmg;
  S.damageFlash = 0.5;
  sfx.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    p.deaths += 1;
    return true;
  }
  return false;
}

export function addFeed(S, text) {
  S.feed.push({ text, t: S.time });
  if (S.feed.length > 5) S.feed.shift();
}

// A bot fires one hitscan shot at the player.
export function botFire(S, bot) {
  const p = S.player;
  if (!p.alive) return;
  const muzzleY = bot.y + 1.35;
  const dx = p.x - bot.x;
  const dz = p.z - bot.z;
  const dist = Math.hypot(dx, dz);
  const eyeY = p.y + p.eyeH;
  // Aim at the player's chest with bot spread.
  const yaw = Math.atan2(-dx, -dz) + (S.rng() - 0.5) * 2 * BOT.spread * (1 + dist / 30);
  const pitch = Math.atan2(eyeY - muzzleY, dist) + (S.rng() - 0.5) * 2 * BOT.spread * (1 + dist / 30);
  const cp = Math.cos(pitch);
  _dir.x = -Math.sin(yaw) * cp;
  _dir.y = Math.sin(pitch);
  _dir.z = -Math.cos(yaw) * cp;
  let wallD = dist + 4;
  for (let i = 0; i < BOXES.length; i++) {
    const t = rayBox(bot.x, muzzleY, bot.z, _dir.x, _dir.y, _dir.z, BOXES[i], wallD);
    if (t < wallD) wallD = t;
  }
  const h = rayVsFighter(bot.x, muzzleY, bot.z, _dir.x, _dir.y, _dir.z, p.x, p.y, p.z, wallD);
  const hitD = h ? h.dist : wallD;
  S.tracers.push({
    x1: bot.x, y1: muzzleY, z1: bot.z,
    x2: bot.x + _dir.x * hitD, y2: muzzleY + _dir.y * hitD, z2: bot.z + _dir.z * hitD,
    life: 0.07,
  });
  sfx.enemyShot(dist);
  if (h) {
    const fall = Math.max(0.5, 1 - dist / (BOT.damageFalloff * 2));
    const dmg = BOT.damage * fall * (h.part === 'head' ? 2 : 1);
    damagePlayer(S, dmg, bot.x, bot.z);
  }
}

// Throw a frag grenade from the player's view.
export function throwGrenade(S) {
  const p = S.player;
  if (p.grenades <= 0 || !p.alive) return false;
  p.grenades -= 1;
  eyePos(S, _eye);
  const cp = Math.cos(p.pitch);
  S.grenades.push({
    x: _eye.x, y: _eye.y - 0.1, z: _eye.z,
    vx: -Math.sin(p.yaw) * cp * 17,
    vy: Math.sin(p.pitch) * 17 + 4.5,
    vz: -Math.cos(p.yaw) * cp * 17,
    fuse: 2.2,
  });
  sfx.click();
  return true;
}

export function updateGrenades(S, dt) {
  for (let i = S.grenades.length - 1; i >= 0; i--) {
    const g = S.grenades[i];
    g.vy -= 12 * dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.z += g.vz * dt;
    g.fuse -= dt;
    // Bounce off the ground and walls (simple: ground plane + box push-out).
    if (g.y < 0.12) { g.y = 0.12; g.vy = Math.abs(g.vy) * 0.45; g.vx *= 0.7; g.vz *= 0.7; }
    // Cheap wall test: clamp against the map bounds and push out of boxes.
    for (let j = 0; j < BOXES.length; j++) {
      const b = BOXES[j];
      if (g.y > b.h) continue;
      if (g.x > b.x - b.hx - 0.12 && g.x < b.x + b.hx + 0.12 &&
          g.z > b.z - b.hz - 0.12 && g.z < b.z + b.hz + 0.12) {
        // Reverse the dominant velocity component.
        const px = Math.min(g.x - (b.x - b.hx), (b.x + b.hx) - g.x);
        const pz = Math.min(g.z - (b.z - b.hz), (b.z + b.hz) - g.z);
        if (px < pz) { g.vx = -g.vx * 0.45; g.x += g.vx > 0 ? 0.15 : -0.15; }
        else { g.vz = -g.vz * 0.45; g.z += g.vz > 0 ? 0.15 : -0.15; }
      }
    }
    if (g.fuse <= 0) {
      explodeGrenade(S, g);
      S.grenades.splice(i, 1);
    }
  }
}

function explodeGrenade(S, g) {
  sfx.explosion();
  S.shake = 0.7;
  S.explosions.push({ x: g.x, y: Math.max(0.3, g.y), z: g.z, life: 0.5 });
  const R = 6;
  // Player.
  const pd = Math.hypot(S.player.x - g.x, S.player.z - g.z);
  if (S.player.alive && pd < R && losClear(g.x, g.y, g.z, S.player.x, S.player.y + 1.2, S.player.z, BOXES)) {
    damagePlayer(S, 95 * (1 - pd / R) + 10, g.x, g.z);
  }
  // Bots.
  for (const bot of S.bots) {
    if (!bot.alive) continue;
    const d = dist2D(bot.x, bot.z, g.x, g.z);
    if (d < R && losClear(g.x, g.y, g.z, bot.x, bot.y + 1.2, bot.z, BOXES)) {
      damageBot(S, bot, 95 * (1 - d / R) + 10, 'body');
      bot.alert = true;
      bot.lastSeenX = S.player.x;
      bot.lastSeenZ = S.player.z;
    }
  }
}
