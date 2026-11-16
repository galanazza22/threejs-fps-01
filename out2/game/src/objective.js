// Emberline — rounds, the bomb objective, and the economy.
// Round flow: buy (15 s, shop open) -> live (100 s) -> roundEnd (4 s banner)
// -> next buy, until one side takes 5 rounds. The player is the attacker:
// win by eliminating all Wardens or detonating the bomb; lose by dying,
// by the timer, or by a defuse.
import {
  BUY_TIME, ROUND_TIME, ROUNDS_TO_WIN, MAX_ROUNDS, ECONOMY,
  PLANT_TIME, DEFUSE_TIME, BOMB_FUSE,
} from './config.js';
import { MAP } from './map.js';
import { dist2D } from './collide.js';
import { spawnBots, botsAlive } from './bots.js';
import { refillAmmo } from './weapons.js';
import { addFeed } from './combat.js';
import { sfx } from './audio.js';
import { mulberry32 } from './state.js';

export function resetRound(S) {
  S.rng = mulberry32(S.round * 7919 + 13);
  S.timer = ROUND_TIME;
  S.phase = 'buy';
  S.phaseTime = 0;
  S.buyTime = BUY_TIME;
  S.roundWinner = null;
  S.roundReason = '';
  S.bomb = { state: 'carried', site: null, x: 0, z: 0, fuse: 0, defuse: 0, defuser: -1, beep: 0 };
  S.grenades = [];
  S.tracers = [];
  S.flashes = [];
  S.explosions = [];
  const p = S.player;
  p.x = MAP.attackerSpawn.x;
  p.z = MAP.attackerSpawn.z;
  p.y = 0;
  p.vx = 0; p.vy = 0; p.vz = 0;
  p.yaw = MAP.attackerSpawn.yaw;
  p.pitch = 0;
  p.hp = 100;
  p.alive = true;
  p.reloading = 0;
  p.cooldown = 0;
  p.bloom = 0;
  p.recoilPitch = 0;
  p.planting = 0;
  refillAmmo(S);
  spawnBots(S);
}

export function startLive(S) {
  S.phase = 'live';
  S.phaseTime = 0;
  S.message = `Round ${S.round} — plant the charge at Furnace or the Array Field`;
  S.messageT = 3;
}

function endRound(S, winner, reason) {
  if (S.phase === 'roundEnd') return;
  S.phase = 'roundEnd';
  S.phaseTime = 0;
  S.roundWinner = winner;
  S.roundReason = reason;
  if (winner === 'attack') {
    S.wins += 1;
    S.money += ECONOMY.win;
    S.message = `Round won — ${reason}`;
    sfx.win();
  } else {
    S.losses += 1;
    S.money += ECONOMY.loss;
    S.message = `Round lost — ${reason}`;
    sfx.lose();
  }
  S.messageT = 4;
  addFeed(S, S.message);
  if (S.wins >= ROUNDS_TO_WIN || S.losses >= ROUNDS_TO_WIN || S.round >= MAX_ROUNDS) {
    S.matchWinner = S.wins > S.losses ? 'attack' : 'defense';
    S.phase = 'matchEnd';
  }
}

export function nextRound(S) {
  S.round += 1;
  resetRound(S);
}

// Planting: hold E inside a site radius while carrying the bomb.
export function updateBomb(S, dt, holdingE) {
  const p = S.player;
  const bomb = S.bomb;
  // Defuse progress decays when nobody is on the charge.
  if (bomb.state === 'planted') {
    let defusing = false;
    for (const bot of S.bots) {
      if (bot.alive && Math.hypot(bot.x - bomb.x, bot.z - bomb.z) < 1.6) { defusing = true; break; }
    }
    if (!defusing && bomb.defuse > 0) bomb.defuse = Math.max(0, bomb.defuse - dt / 10);
  }
  if (bomb.state === 'carried' && S.phase === 'live' && p.alive) {
    let site = null;
    for (const key of ['A', 'B']) {
      const s = MAP.sites[key];
      if (dist2D(p.x, p.z, s.x, s.z) < s.r) { site = key; break; }
    }
    if (site && holdingE) {
      p.planting += dt / PLANT_TIME;
      if (p.planting >= 1) {
        p.planting = 0;
        bomb.state = 'planted';
        bomb.site = site;
        bomb.x = MAP.sites[site].x;
        bomb.z = MAP.sites[site].z;
        bomb.fuse = BOMB_FUSE;
        bomb.defuse = 0;
        S.money += ECONOMY.plant;
        S.message = `Charge planted at ${MAP.sites[site].name} — defend it!`;
        S.messageT = 3;
        addFeed(S, `Charge planted at site ${site}`);
        sfx.plant();
      }
    } else {
      p.planting = 0;
    }
  } else if (bomb.state === 'planted') {
    bomb.fuse -= dt;
    bomb.beep -= dt;
    if (bomb.beep <= 0) {
      sfx.beep(bomb.fuse < 10);
      bomb.beep = bomb.fuse < 10 ? 0.5 : 1;
    }
    if (bomb.defuse >= 1) {
      bomb.state = 'defused';
      S.money += 0;
      endRound(S, 'defense', 'the charge was defused');
      sfx.defuse();
      return;
    }
    if (bomb.fuse <= 0) {
      bomb.state = 'detonated';
      S.explosions.push({ x: bomb.x, y: 0.5, z: bomb.z, life: 0.8 });
      S.shake = 1;
      sfx.explosion();
      endRound(S, 'attack', 'the charge detonated');
      return;
    }
  }
}

// Win/loss checks run every tick while live.
export function updateRound(S, dt) {
  if (S.phase === 'buy') {
    S.buyTime -= dt;
    S.phaseTime += dt;
    if (S.buyTime <= 0) startLive(S);
    return;
  }
  if (S.phase === 'roundEnd') {
    S.phaseTime += dt;
    if (S.phaseTime >= 4) {
      if (S.matchWinner) { S.phase = 'matchEnd'; return; }
      nextRound(S);
    }
    return;
  }
  if (S.phase !== 'live') return;
  S.phaseTime += dt;
  S.timer -= dt;

  if (!S.player.alive) {
    // With the charge planted the round plays out: a detonation still wins,
    // a defuse still loses. Without a plant, death ends the round.
    if (S.bomb.state === 'planted') return;
    endRound(S, 'defense', 'you were eliminated');
    return;
  }
  if (botsAlive(S) === 0) {
    endRound(S, 'attack', 'all Wardens eliminated');
    return;
  }
  if (S.timer <= 0) {
    endRound(S, 'defense', S.bomb.state === 'planted' ? 'time expired before detonation' : 'time expired — the sites held');
  }
}
