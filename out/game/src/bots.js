// Emberline — bot AI (the Wardens, defenders of Cinderworks Yard).
// States: 'toHold' (pathing to a hold point) -> 'hold' (scanning a lane) ->
// 'engage' (sees the player: strafe and fire in bursts) -> 'chase' (moves to
// the last seen/heard position) -> 'defuse' (bomb planted: rush the site).
// Bots navigate the waypoint graph (map.js), see with a line-of-sight test,
// and hear gunfire inside BOT.hearRadius.
import { BOT } from './config.js';
import { HOLD_POINTS, WAYPOINTS, nearestWaypoint, findPath } from './map.js';
import { BOXES } from './map.js';
import { collideCircle, losClear, dist2D } from './collide.js';
import { botFire } from './combat.js';

const _path = [];

export function spawnBots(S) {
  S.bots = [];
  const holds = [];
  const a = HOLD_POINTS.A;
  const b = HOLD_POINTS.B;
  // Two bots hold A, two hold B; one of each pair may rotate mid later.
  holds.push(a[0], a[1], b[0], b[1]);
  const spawn = { x: 0, z: -20 };
  for (let i = 0; i < 4; i++) {
    S.bots.push({
      id: i,
      x: spawn.x + (i - 1.5) * 1.2,
      y: 0,
      z: spawn.z + (i % 2) * 1.5,
      vx: 0, vz: 0,
      yaw: Math.PI + (S.rng() - 0.5) * 0.4,
      hp: BOT.hp,
      alive: true,
      state: 'toHold',
      hold: holds[i],
      path: [],
      pathI: 0,
      react: 0,
      burst: 0,
      burstT: 0,
      shotT: 0,
      strafeDir: 1,
      strafeT: 0,
      scanT: 0,
      seenT: 0,
      lastSeenX: 0, lastSeenZ: 0,
      alert: false,
      flinch: 0,
      stuckT: 0,
    });
  }
}

// Does this bot see the player right now?
function canSee(S, bot) {
  const p = S.player;
  if (!p.alive) return false;
  const dx = p.x - bot.x;
  const dz = p.z - bot.z;
  const d = Math.hypot(dx, dz);
  if (d > BOT.sightRange) return false;
  const facing = Math.atan2(-dx, -dz);
  let diff = facing - bot.yaw;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > BOT.sightHalfFov && d > 4) return false;
  return losClear(bot.x, bot.y + 1.45, bot.z, p.x, p.y + p.eyeH * 0.8, p.z, BOXES);
}

function setPath(bot, tx, tz) {
  const from = nearestWaypoint(bot.x, bot.z);
  const to = nearestWaypoint(tx, tz);
  findPath(from, to, _path);
  bot.path = _path.slice();
  bot.pathI = 0;
  // Skip the first node when it is behind the bot.
  if (bot.path.length > 1) bot.pathI = 1;
}

function moveToward(S, bot, tx, tz, dt, speed) {
  const dx = tx - bot.x;
  const dz = tz - bot.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.15) return true;
  const nx = dx / d;
  const nz = dz / d;
  bot.vx += nx * BOT.accel * dt;
  bot.vz += nz * BOT.accel * dt;
  const sp = Math.hypot(bot.vx, bot.vz);
  if (sp > speed) { bot.vx *= speed / sp; bot.vz *= speed / sp; }
  bot.x += bot.vx * dt;
  bot.z += bot.vz * dt;
  collideCircle(bot, BOT.radius, BOXES);
  // Face the direction of travel.
  bot.yaw = Math.atan2(-bot.vx, -bot.vz);
  return false;
}

function followPath(S, bot, dt, speed) {
  if (bot.pathI >= bot.path.length) return true;
  const node = WAYPOINTS[bot.path[bot.pathI]];
  if (moveToward(S, bot, node.x, node.z, dt, speed)) bot.pathI++;
  return bot.pathI >= bot.path.length;
}

export function updateBots(S, dt) {
  for (const bot of S.bots) {
    if (!bot.alive) continue;
    if (bot.flinch > 0) bot.flinch -= dt;
    const p = S.player;

    // Hearing: a fresh gunshot or explosion nearby alerts the bot.
    if (S.shot && dist2D(bot.x, bot.z, S.shotX, S.shotZ) < BOT.hearRadius) {
      bot.alert = true;
      bot.lastSeenX = S.shotX;
      bot.lastSeenZ = S.shotZ;
    }

    const sees = canSee(S, bot);
    if (sees) {
      bot.lastSeenX = p.x;
      bot.lastSeenZ = p.z;
      bot.seenT = 0;
      if (bot.state !== 'engage') {
        if (bot.react <= 0) bot.react = BOT.reactionMin + S.rng() * (BOT.reactionMax - BOT.reactionMin);
        bot.react -= dt;
        if (bot.react <= 0) {
          bot.state = 'engage';
          bot.burst = BOT.burstMin + Math.floor(S.rng() * (BOT.burstMax - BOT.burstMin + 1));
          bot.shotT = 0;
        }
      }
    } else {
      bot.seenT += dt;
      if (bot.state === 'engage' && bot.seenT > 2) {
        bot.state = 'chase';
        setPath(bot, bot.lastSeenX, bot.lastSeenZ);
      }
    }

    // Bomb planted: every living bot converges on the site to defuse.
    if (S.bomb.state === 'planted' && bot.state !== 'engage') {
      if (bot.state !== 'defuse') { bot.state = 'defuse'; setPath(bot, S.bomb.x, S.bomb.z); }
    }

    switch (bot.state) {
      case 'toHold': {
        if (followPath(S, bot, dt, BOT.speed)) bot.state = 'hold';
        break;
      }
      case 'hold': {
        // Slow scan: sweep the yaw across the lane.
        bot.scanT += dt;
        bot.yaw += Math.sin(bot.scanT * 0.5) * dt * 0.35;
        if (bot.alert) { bot.state = 'chase'; bot.alert = false; setPath(bot, bot.lastSeenX, bot.lastSeenZ); }
        break;
      }
      case 'chase': {
        if (followPath(S, bot, dt, BOT.speed * 1.15)) {
          bot.state = 'hold';
          bot.alert = false;
        }
        break;
      }
      case 'engage': {
        if (bot.flinch > 0) break;
        // Face the player, strafe sideways, keep 8-20 m.
        const dx = p.x - bot.x;
        const dz = p.z - bot.z;
        const d = Math.hypot(dx, dz) || 1;
        bot.yaw = Math.atan2(-dx, -dz);
        bot.strafeT -= dt;
        if (bot.strafeT <= 0) {
          bot.strafeDir = S.rng() < 0.5 ? -1 : 1;
          bot.strafeT = 0.6 + S.rng() * 0.9;
        }
        const px = -dz / d * bot.strafeDir; // perpendicular
        const pz = dx / d * bot.strafeDir;
        const radial = d > 20 ? 1 : d < 8 ? -1 : 0;
        const mx = px * 0.8 + (dx / d) * radial;
        const mz = pz * 0.8 + (dz / d) * radial;
        bot.vx += mx * BOT.accel * dt;
        bot.vz += mz * BOT.accel * dt;
        const sp = Math.hypot(bot.vx, bot.vz);
        const cap = BOT.speed * 0.75;
        if (sp > cap) { bot.vx *= cap / sp; bot.vz *= cap / sp; }
        bot.x += bot.vx * dt;
        bot.z += bot.vz * dt;
        collideCircle(bot, BOT.radius, BOXES);
        // Fire in bursts with pauses.
        bot.shotT -= dt;
        if (bot.burst > 0) {
          if (bot.shotT <= 0) {
            botFire(S, bot);
            bot.burst -= 1;
            bot.shotT = BOT.shotInterval;
          }
        } else {
          bot.burstT -= dt;
          if (bot.burstT <= 0) {
            bot.burst = BOT.burstMin + Math.floor(S.rng() * (BOT.burstMax - BOT.burstMin + 1));
            bot.burstT = BOT.burstPause;
          }
        }
        break;
      }
      case 'defuse': {
        const d = dist2D(bot.x, bot.z, S.bomb.x, S.bomb.z);
        if (d < 1.6) {
          // Channel the defuse; the player must stop the defuser.
          S.bomb.defuse += dt / 5;
          S.bomb.defuser = bot.id;
          bot.yaw = Math.atan2(-(S.bomb.x - bot.x), -(S.bomb.z - bot.z));
        } else if (followPath(S, bot, dt, BOT.speed * 1.2)) {
          setPath(bot, S.bomb.x, S.bomb.z);
        }
        break;
      }
      default: break;
    }

    // Separation: bots do not stack on each other.
    for (const other of S.bots) {
      if (other === bot || !other.alive) continue;
      const dx = bot.x - other.x;
      const dz = bot.z - other.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 0.9 * 0.9 && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        const push = (0.9 - d) * 0.5;
        bot.x += (dx / d) * push;
        bot.z += (dz / d) * push;
      }
    }
  }
  S.shot = false;
}

export function botsAlive(S) {
  let n = 0;
  for (const b of S.bots) if (b.alive) n++;
  return n;
}
