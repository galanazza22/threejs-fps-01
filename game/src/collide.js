// Emberline — collision and line-of-sight math, allocation-free.
// The map is a list of axis-aligned boxes {x, z, hx, hz, h} (footprint + height).
// All hot paths reuse module-level temporaries: no per-frame allocation here.

// A moving circle (the player / a bot) against the solid boxes, in the XZ plane.
// pos is mutated in place; returns true when a wall blocked the move.
export function collideCircle(pos, r, solids) {
  let hit = false;
  for (let i = 0; i < solids.length; i++) {
    const b = solids[i];
    // A box whose top is within step-up reach of the feet is walked over,
    // not a wall; groundHeight() holds the player on top of it.
    if (pos.y >= b.h - 0.45) continue;
    const nx = Math.max(b.x - b.hx, Math.min(pos.x, b.x + b.hx));
    const nz = Math.max(b.z - b.hz, Math.min(pos.z, b.z + b.hz));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      pos.x += dx * push;
      pos.z += dz * push;
    } else {
      // Centre inside the box: push out along the smallest penetration axis.
      const px = b.hx + r - Math.abs(pos.x - b.x);
      const pz = b.hz + r - Math.abs(pos.z - b.z);
      if (px < pz) pos.x += pos.x < b.x ? -px : px;
      else pos.z += pos.z < b.z ? -pz : pz;
    }
  }
  return hit;
}

// Highest walkable surface under a point: the ground (0) or a low box top.
export function groundHeight(x, z, solids) {
  let g = 0;
  for (let i = 0; i < solids.length; i++) {
    const b = solids[i];
    if (b.h <= 0.55) continue;
    if (x < b.x - b.hx || x > b.x + b.hx || z < b.z - b.hz || z > b.z + b.hz) continue;
    if (b.h > g) g = b.h;
  }
  return g;
}

// Ray vs one AABB (min/max corners, y from 0 to h). Returns distance or Infinity.
export function rayBox(ox, oy, oz, dx, dy, dz, b, maxD) {
  let tmin = 0;
  let tmax = maxD;
  // X slab
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
  // Z slab
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
  // Y slab (0 .. h)
  if (Math.abs(dy) < 1e-9) {
    if (oy < 0 || oy > b.h) return Infinity;
  } else {
    let t1 = (0 - oy) / dy;
    let t2 = (b.h - oy) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  return tmin;
}

// Ray vs a sphere (a bot head). Returns distance or Infinity.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r, maxD) {
  const lx = cx - ox;
  const ly = cy - oy;
  const lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  if (tca < 0 || tca > maxD) return Infinity;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return Infinity;
  return tca - Math.sqrt(r2 - d2);
}

// Segment AB vs boxes: true when nothing blocks the line of sight.
export function losClear(ax, ay, az, bx, by, bz, solids) {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len < 1e-6) return true;
  const ix = dx / len;
  const iy = dy / len;
  const iz = dz / len;
  for (let i = 0; i < solids.length; i++) {
    const t = rayBox(ax, ay, az, ix, iy, iz, solids[i], len);
    if (t !== Infinity && t < len - 0.05) return false;
  }
  return true;
}

// 2D distance helper used by AI and grenades.
export function dist2D(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}
