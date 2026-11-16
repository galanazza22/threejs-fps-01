// Emberline — weapon state: switching, reloading, spread and recoil.
// Firing itself lives in combat.js (it needs hit detection); this module owns
// the numbers that make stopping to aim pay: bloom from recent shots, spread
// that grows with movement, recoil that climbs the pitch.
import { WEAPONS } from './config.js';
import { speedOf } from './player.js';
import { sfx } from './audio.js';

export function weaponDef(id) { return WEAPONS[id]; }

// Spread in radians for the next shot: rest spread + movement + bloom.
export function currentSpread(S) {
  const p = S.player;
  const w = WEAPONS[p.weapon];
  const spd = speedOf(p);
  const move = (spd / 5.2) * w.moveSpread;
  const air = p.onGround ? 0 : 0.02;
  return w.spread + move + p.bloom + air;
}

// Crosshair gap in pixels for the HUD, from the same spread.
export function crosshairGap(S) {
  return 4 + currentSpread(S) * 900;
}

export function switchWeapon(S, id) {
  const p = S.player;
  if (!p.owned[id] || p.weapon === id || p.reloading > 0) return false;
  p.weapon = id;
  const w = WEAPONS[id];
  p.mag = S['mag_' + id] ?? w.mag;
  p.reserve = S['res_' + id] ?? w.reserve;
  p.cooldown = 0.25;
  p.bloom = 0;
  return true;
}

// Per-weapon ammo lives on the player object under mag_<id> / res_<id> so
// switching back restores the right counts.
export function syncAmmo(S) {
  const p = S.player;
  S['mag_' + p.weapon] = p.mag;
  S['res_' + p.weapon] = p.reserve;
}

export function startReload(S) {
  const p = S.player;
  const w = WEAPONS[p.weapon];
  if (p.reloading > 0 || p.mag >= w.mag || p.reserve <= 0) return false;
  p.reloading = w.reload;
  sfx.reload();
  return true;
}

export function updateWeapon(S, dt) {
  const p = S.player;
  if (p.cooldown > 0) p.cooldown -= dt;
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      p.reloading = 0;
      const w = WEAPONS[p.weapon];
      const need = w.mag - p.mag;
      const take = Math.min(need, p.reserve);
      p.mag += take;
      p.reserve -= take;
      syncAmmo(S);
    }
  }
}

// Buying: returns a message for the HUD, or '' when the purchase lands.
export function buyWeapon(S, id) {
  const p = S.player;
  const w = WEAPONS[id];
  if (p.owned[id]) return 'Already owned';
  if (S.money < w.price) return 'Not enough money';
  S.money -= w.price;
  p.owned[id] = true;
  S['mag_' + id] = w.mag;
  S['res_' + id] = w.reserve;
  sfx.buy();
  return '';
}

export function buyGrenade(S) {
  if (S.money < 300) return 'Not enough money';
  if (S.player.grenades >= 2) return 'Carrying the max (2)';
  S.money -= 300;
  S.player.grenades += 1;
  sfx.buy();
  return '';
}

export function buyArmor(S) {
  if (S.money < 650) return 'Not enough money';
  if (S.player.armor) return 'Already armoured';
  S.money -= 650;
  S.player.armor = true;
  sfx.buy();
  return '';
}

// Refill reserve ammo for owned weapons at round start (CS-style: ammo is
// bought with the weapon; here reserve tops up so a round is never lost to
// an empty magazine the player could not refill).
export function refillAmmo(S) {
  const p = S.player;
  for (const id of Object.keys(p.owned)) {
    const w = WEAPONS[id];
    if (id === p.weapon) {
      p.mag = w.mag;
      p.reserve = w.reserve;
    } else {
      S['mag_' + id] = w.mag;
      S['res_' + id] = w.reserve;
    }
  }
  syncAmmo(S);
}
