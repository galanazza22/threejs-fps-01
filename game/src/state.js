// Emberline — the single state store.
// Every module reads and writes this one object; nothing else keeps game state.
// Rendering reads it, the fixed-step simulation mutates it, the HUD polls it.
import { BOT_COUNT, ECONOMY, ROUND_TIME, BUY_TIME } from './config.js';

// Deterministic RNG (mulberry32): bot decisions replay from the round seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createState() {
  return {
    // Phase machine: 'menu' | 'buy' | 'live' | 'roundEnd' | 'matchEnd'
    phase: 'menu',
    phaseTime: 0, // seconds in the current phase
    round: 1,
    wins: 0,
    losses: 0,
    money: ECONOMY.start,
    timer: ROUND_TIME,
    buyTime: BUY_TIME,
    roundWinner: null, // 'attack' | 'defense' | null
    roundReason: '',
    matchWinner: null,
    rng: mulberry32(13),

    player: {
      x: 0, y: 0, z: 0, // feet position
      vx: 0, vy: 0, vz: 0,
      yaw: 0, pitch: 0,
      hp: 100, armor: false, alive: true,
      crouch: false, onGround: true,
      eyeH: 1.62,
      weapon: 'p9',
      owned: { p9: true },
      mag: 12, reserve: 36,
      reloading: 0, // seconds left, 0 = not reloading
      cooldown: 0, // seconds until the next shot may fire
      bloom: 0, // accumulated spread from recent shots
      recoilPitch: 0, // unrecovered recoil applied to the camera
      grenades: 0,
      kills: 0, deaths: 0,
      planting: 0, // plant progress 0..1, 0 = not planting
    },

    bots: [], // filled by resetRound: {id,x,y,z,vx,vz,yaw,hp,alive,state,...}
    bomb: {
      state: 'carried', // 'carried' | 'planted' | 'detonated' | 'defused'
      site: null, // 'A' | 'B'
      x: 0, z: 0,
      fuse: 0, // seconds left once planted
      defuse: 0, // defuse progress 0..1
      defuser: -1,
      beep: 0, // beep timer
    },
    grenades: [], // {x,y,z,vx,vy,vz,fuse}
    tracers: [], // visual only: {x1,y1,z1,x2,y2,z2,life}
    flashes: [], // muzzle flashes: {x,y,z,life}
    explosions: [], // {x,y,z,life}
    feed: [], // kill feed lines: {text, t}
    message: '', // centre-screen banner
    messageT: 0,
    shake: 0, // screen shake magnitude
    hitmark: 0, // hitmarker timer
    hitmarkKill: false,
    damageFlash: 0, // red vignette timer
    shot: false, // set for one tick when the player fires (bots hear it)
    shotX: 0, shotZ: 0,
    time: 0, // total simulation time
  };
}

export const S = createState();
