// Emberline — configuration: weapons, economy, tuning, palette.
// One place for every number the design leans on, so balancing is an edit here,
// not a hunt through the simulation.
export const GAME_NAME = 'Emberline';
export const MAP_NAME = 'Cinderworks Yard';

export const TICK = 1 / 60; // fixed simulation step (s)
export const ROUND_TIME = 100; // seconds per round
export const BUY_TIME = 15; // seconds of buy phase between rounds
export const ROUNDS_TO_WIN = 5; // first to 5 takes the match
export const MAX_ROUNDS = 9;
export const BOT_COUNT = 4;
export const BOMB_FUSE = 35; // seconds from plant to detonation
export const PLANT_TIME = 3; // seconds holding E at a site
export const DEFUSE_TIME = 5; // seconds a bot channels at the bomb

export const ECONOMY = {
  start: 800,
  win: 3250,
  loss: 1900,
  kill: 300,
  plant: 300,
  defuse: 300,
};

// Weapons. damage is per pellet at close range; headMul multiplies on head hits.
// spread is radians of cone half-angle at rest; moveSpread adds while moving.
export const WEAPONS = {
  p9: {
    id: 'p9', name: 'P9 Sidearm', price: 0, slot: 1,
    damage: 26, headMul: 3, mag: 12, reserve: 36, auto: false,
    interval: 0.16, spread: 0.004, moveSpread: 0.028, recoil: 0.012,
    reload: 1.1, range: 60, pellets: 1, kick: 0.5, zoom: 1,
  },
  vk9: {
    id: 'vk9', name: 'VK-9 Ripper', price: 1500, slot: 2,
    damage: 21, headMul: 3, mag: 30, reserve: 120, auto: true,
    interval: 0.085, spread: 0.009, moveSpread: 0.034, recoil: 0.009,
    reload: 1.9, range: 55, pellets: 1, kick: 0.42, zoom: 1,
  },
  ar77: {
    id: 'ar77', name: 'AR-77 Longshot', price: 2700, slot: 3,
    damage: 33, headMul: 3, mag: 25, reserve: 75, auto: true,
    interval: 0.11, spread: 0.003, moveSpread: 0.026, recoil: 0.014,
    reload: 2.4, range: 90, pellets: 1, kick: 0.62, zoom: 1,
  },
  sg12: {
    id: 'sg12', name: 'SG-12 Breacher', price: 1700, slot: 4,
    damage: 12, headMul: 3, mag: 6, reserve: 24, auto: false,
    interval: 0.8, spread: 0.05, moveSpread: 0.05, recoil: 0.05,
    reload: 2.8, range: 28, pellets: 8, kick: 1.4, zoom: 1,
  },
};
export const WEAPON_ORDER = ['p9', 'vk9', 'ar77', 'sg12'];

export const GRENADE_PRICE = 300;
export const ARMOR_PRICE = 650;
export const ARMOR_REDUCTION = 0.4; // fraction of damage armor absorbs

// Dusk-industrial palette: deep indigo dusk, warm sodium light, ember accent.
export const PALETTE = {
  sky: 0x252f47,
  fog: 0x2a3247,
  ground: 0x4b5158,
  concrete: 0x6d7480,
  concreteDark: 0x4c525a,
  rust: 0x7a4a2e,
  teal: 0x2e6b6b,
  amber: 0xb07a2a,
  hazard: 0xd8a020,
  ember: 0xff7a2a,
  siteA: 0xff5a3c,
  siteB: 0x37c8ff,
  botBody: 0xc2541f,
  botDark: 0x2b2e33,
  visor: 0xffd27a,
  playerGun: 0x22252a,
};

// Bot tuning.
export const BOT = {
  hp: 100,
  speed: 3.4,
  accel: 26,
  radius: 0.38,
  reactionMin: 0.35,
  reactionMax: 0.7,
  burstMin: 3,
  burstMax: 5,
  shotInterval: 0.13,
  burstPause: 0.85,
  damage: 13, // per hit at close range
  damageFalloff: 45, // metres at which damage halves
  spread: 0.035, // radians of cone half-angle
  hearRadius: 30, // metres; gunfire this close is heard
  sightRange: 42,
  sightHalfFov: 0.62, // radians off the facing direction
};

// Player tuning.
export const PLAYER = {
  hp: 100,
  radius: 0.35,
  eyeStand: 1.62,
  eyeCrouch: 1.08,
  walkSpeed: 5.2,
  crouchSpeed: 2.7,
  accel: 42,
  friction: 11,
  airAccel: 12,
  jumpVel: 5.6,
  gravity: 14.5,
};
