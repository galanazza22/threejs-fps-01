// Emberline — the map: Cinderworks Yard, a decommissioned solar-panel
// recycling plant at dusk. Original layout, original names.
// Two bomb sites (A: the Furnace, B: the Array Field), three lanes between the
// attacker spawn in the south and the defender spawn in the north.
//
// Boxes are {x, z, hx, hz, h, mat}: centre, half extents, height, material key.
// Collision and rendering both read this one list.
export const MAP = {
  minX: -32, maxX: 32, minZ: -24, maxZ: 24,
  attackerSpawn: { x: 0, z: 20, yaw: 0 }, // faces north, down mid
  defenderSpawn: { x: 0, z: -20, yaw: Math.PI }, // faces south
  sites: {
    A: { name: 'Furnace', x: -24, z: -14, r: 4.5 },
    B: { name: 'Array Field', x: 24, z: -14, r: 4.5 },
  },
};

export const BOXES = [
  // Outer walls (h 4)
  { x: 0, z: -24, hx: 33, hz: 1, h: 4, mat: 'concreteDark' },
  { x: 0, z: 24, hx: 33, hz: 1, h: 4, mat: 'concreteDark' },
  { x: -32, z: 0, hx: 1, hz: 25, h: 4, mat: 'concreteDark' },
  { x: 32, z: 0, hx: 1, hz: 25, h: 4, mat: 'concreteDark' },
  // The Crusher: twin blocks splitting mid into a west gap, a door gap, an east gap
  { x: -5, z: 0, hx: 3, hz: 4, h: 3.2, mat: 'concrete' },
  { x: 5, z: 0, hx: 3, hz: 4, h: 3.2, mat: 'concrete' },
  // Furnace pocket (site A), U-shaped walls open to the east
  { x: -29, z: -14, hx: 1, hz: 6, h: 3.5, mat: 'rust' },
  { x: -24, z: -20, hx: 5, hz: 1, h: 3.5, mat: 'rust' },
  { x: -24, z: -8, hx: 5, hz: 1, h: 3.5, mat: 'rust' },
  { x: -27.5, z: -14, hx: 1.5, hz: 2.5, h: 4.6, mat: 'rust' }, // the furnace itself
  // Array field (site B): tilted panel racks, open sky
  { x: 20, z: -17.5, hx: 2.6, hz: 1.2, h: 1.8, mat: 'teal', tilt: -0.45 },
  { x: 24.5, z: -13.5, hx: 2.6, hz: 1.2, h: 1.8, mat: 'teal', tilt: -0.45 },
  { x: 28, z: -17.5, hx: 2.6, hz: 1.2, h: 1.8, mat: 'amber', tilt: -0.45 },
  { x: 20, z: -10.5, hx: 2.6, hz: 1.2, h: 1.8, mat: 'amber', tilt: -0.45 },
  // Shipping containers: long sightline breakers
  { x: -14, z: 12, hx: 4, hz: 1.5, h: 2.6, mat: 'teal' },
  { x: 14, z: -12, hx: 4, hz: 1.5, h: 2.6, mat: 'rust' },
  { x: -18, z: -2, hx: 1.5, hz: 4, h: 2.6, mat: 'amber' },
  { x: 18, z: 6, hx: 1.5, hz: 4, h: 2.6, mat: 'teal' },
  // Crates: low cover, jumpable
  { x: -3, z: 10, hx: 1.2, hz: 1.2, h: 1.2, mat: 'amber' },
  { x: 3, z: 8, hx: 1.2, hz: 1.2, h: 1.2, mat: 'teal' },
  { x: -4, z: -10, hx: 1.2, hz: 1.2, h: 1.2, mat: 'teal' },
  { x: 4, z: -12, hx: 1.2, hz: 1.2, h: 1.2, mat: 'amber' },
  { x: -12, z: 16, hx: 1.2, hz: 1.2, h: 1.2, mat: 'rust' },
  { x: 12, z: 16, hx: 1.2, hz: 1.2, h: 1.2, mat: 'rust' },
  { x: -26, z: 6, hx: 1.2, hz: 1.2, h: 1.2, mat: 'teal' },
  { x: 26, z: 6, hx: 1.2, hz: 1.2, h: 1.2, mat: 'amber' },
  { x: -20, z: -16, hx: 1.2, hz: 1.2, h: 1.2, mat: 'teal' },
  { x: 20, z: -18, hx: 1.2, hz: 1.2, h: 1.2, mat: 'teal' },
  // Low barriers: waist-high blocks that break sightlines, not movement
  { x: 0, z: 14, hx: 3, hz: 0.5, h: 1.1, mat: 'concrete' },
  { x: 0, z: -14, hx: 3, hz: 0.5, h: 1.1, mat: 'concrete' },
  { x: -10, z: -16, hx: 0.5, hz: 3, h: 1.1, mat: 'concrete' },
  { x: 10, z: -16, hx: 0.5, hz: 3, h: 1.1, mat: 'concrete' },
];

// Waypoint graph for bot navigation: nodes with x/z, edges by index pair.
export const WAYPOINTS = [
  { x: 0, z: 20 },    // 0 attacker spawn
  { x: 0, z: 12 },    // 1 mid south
  { x: 0, z: 0 },     // 2 mid door gap
  { x: 0, z: -8 },    // 3 mid north
  { x: 0, z: -20 },   // 4 defender spawn
  { x: -12, z: 16 },  // 5 west-mid south
  { x: -12, z: 6 },   // 6 west-mid
  { x: -12, z: -6 },  // 7 west-mid north
  { x: -12, z: -14 }, // 8 west-mid site approach
  { x: 12, z: 16 },   // 9 east-mid south
  { x: 12, z: 6 },    // 10 east-mid
  { x: 12, z: -6 },   // 11 east-mid north
  { x: 12, z: -14 },  // 12 east-mid site approach
  { x: -26, z: 14 },  // 13 west lane south
  { x: -26, z: 0 },   // 14 west lane
  { x: -26, z: -8 },  // 15 west lane north
  { x: -21, z: -14 }, // 16 site A mouth
  { x: -24, z: -14 }, // 17 site A
  { x: 26, z: 14 },   // 18 east lane south
  { x: 26, z: 0 },    // 19 east lane
  { x: 26, z: -8 },   // 20 east lane north
  { x: 21, z: -14 },  // 21 site B mouth
  { x: 24, z: -14 },  // 22 site B
  { x: -8, z: -18 },  // 23 defender west
  { x: 8, z: -18 },   // 24 defender east
  { x: -20, z: -14 }, // 25 site A cover
  { x: 20, z: -14 },  // 26 site B cover
];
export const EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [0, 9], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12], [5, 13], [9, 18], [13, 14], [14, 15],
  [15, 16], [16, 17], [16, 25], [8, 16], [8, 23], [18, 19], [19, 20],
  [20, 21], [21, 22], [21, 26], [12, 21], [12, 24], [4, 23], [4, 24],
  [23, 8], [24, 12], [3, 7], [3, 11], [7, 15], [11, 20], [1, 5], [1, 9],
  [2, 6], [2, 10], [6, 14], [10, 19], [25, 17], [26, 22], [23, 25], [24, 26],
];

// Bot hold positions per site (defenders split 2/2, one may rotate mid).
export const HOLD_POINTS = {
  A: [{ x: -21, z: -11 }, { x: -20, z: -17 }, { x: -25, z: -10 }],
  B: [{ x: 21, z: -11 }, { x: 20, z: -17 }, { x: 25, z: -10 }],
  MID: [{ x: 0, z: -8 }, { x: -12, z: -6 }, { x: 12, z: -6 }],
};

// Nearest waypoint index to a point (linear scan: 27 nodes, cheap).
export function nearestWaypoint(x, z) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const dx = WAYPOINTS[i].x - x;
    const dz = WAYPOINTS[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// Breadth-first path over the waypoint graph. Returns an array of node indices
// from `from` to `to` (inclusive), or [to] when already there. Reuses the
// caller-provided scratch arrays to avoid allocation in the hot path.
const _prev = new Int16Array(WAYPOINTS.length);
const _seen = new Int16Array(WAYPOINTS.length);
const _queue = new Int16Array(WAYPOINTS.length);
let _stamp = 0;
const ADJ = WAYPOINTS.map(() => []);
for (const [a, b] of EDGES) { ADJ[a].push(b); ADJ[b].push(a); }

export function findPath(from, to, out) {
  out.length = 0;
  if (from === to) { out.push(to); return out; }
  _stamp++;
  let qh = 0;
  let qt = 0;
  _queue[qt++] = from;
  _seen[from] = _stamp;
  _prev[from] = -1;
  while (qh < qt) {
    const n = _queue[qh++];
    if (n === to) break;
    const adj = ADJ[n];
    for (let i = 0; i < adj.length; i++) {
      const m = adj[i];
      if (_seen[m] === _stamp) continue;
      _seen[m] = _stamp;
      _prev[m] = n;
      _queue[qt++] = m;
    }
  }
  if (_seen[to] !== _stamp) { out.push(to); return out; }
  // Walk back from `to`, then reverse into `out`.
  let n = to;
  let len = 0;
  while (n !== -1) { _queue[len++] = n; n = _prev[n]; }
  for (let i = len - 1; i >= 0; i--) out.push(_queue[i]);
  return out;
}
