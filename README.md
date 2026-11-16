# Emberline — Tactical FPS at Cinderworks Yard

[![make.fun · threejs-fps-01](https://make.fun/badge/threejs-fps-01.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![rank](https://make.fun/badge/threejs-fps-01/galanazza22/threejs-fps-01/rank.svg)](https://make.fun/bounty/threejs-fps-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![reward](https://make.fun/badge/threejs-fps-01/galanazza22/threejs-fps-01/reward.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)

A round-based tactical first-person shooter in the browser, written for [make.fun's threejs-fps-01 bounty](https://make.fun/bounty/threejs-fps-01): Counter-Strike-style play — two teams, short rounds, money between rounds, gunfire where accuracy counts more than speed — on an original map, with original names and art, running offline from static files on three.js 0.187.0.

## How it plays

You are the Vanguard attacker at **Cinderworks Yard**, a decommissioned solar-panel recycling plant at dusk. Four Warden bots defend two bomb sites: **Site A — Furnace** (a walled pocket, one door in) and **Site B — Array Field** (open sky, tilted panel racks for cover). Plant the charge at either site and defend it until it detonates, or eliminate all four Wardens. First to 5 rounds takes the match.

- **Gunplay** — hitscan raycasts against real body boxes and head spheres (headshots deal 3×), recoil that climbs the view, bloom and spread that grow while moving or firing, so stopping to aim pays. Four weapons (P9 sidearm, VK-9 SMG, AR-77 rifle, SG-12 shotgun) plus frag grenades with bounce physics and a blast radius.
- **Movement** — acceleration-based WASD with friction, crouching, jumping, step-up onto crates, and AABB collision with the whole map.
- **Tactics** — money per round ($3,250 win / $1,900 loss / $300 per kill / $300 per plant) spent in a buy menu between rounds; bots patrol the waypoint graph, hold sites, react to what they see and hear, strafe and fire in bursts when engaged, converge on a planted charge, and channel a 5-second defuse.
- **Presentation** — dusk-industrial palette (indigo sky, sodium lamps, ember accent), procedural concrete texture, glowing site rings and light beams, a first-person viewmodel with muzzle flash, tracers, explosion flashes, and fully procedural Web Audio sound effects. No assets, no network requests.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look (click to lock) |
| Click | Fire (hold for automatics) |
| R | Reload |
| Ctrl / C | Crouch |
| Space | Jump |
| 1–4 | Switch weapon |
| G | Throw grenade |
| E | Plant the charge (hold, inside a site ring) |
| B / Enter | Buy menu / deploy |

## Running it

```sh
node serve.ts        # serves game/ at http://localhost:8080
```

Open the page in desktop Chrome, click **Click to play**, buy, deploy, and breach the yard. `main.ts` (Node 22, standard library only) hands the entry in: it copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.

## Layout

- `game/index.html` — page, HUD, import map (`three` → vendored 0.187.0)
- `game/src/main.js` — bootstrap, fixed 60 Hz simulation loop, screenshot modes
- `game/src/state.js` — the single state store
- `game/src/config.js` — weapons, economy, tuning, palette
- `game/src/map.js` — Cinderworks Yard: boxes, sites, waypoint graph, BFS paths
- `game/src/collide.js` — circle-vs-box movement, ray-vs-box/sphere, line of sight
- `game/src/player.js` — acceleration movement, crouch, jump, look
- `game/src/weapons.js` — switching, reloading, spread, recoil, the shop
- `game/src/combat.js` — hitscan shooting, damage, grenades, tracers
- `game/src/bots.js` — Warden AI: hold, patrol, engage, chase, defuse
- `game/src/objective.js` — rounds, the bomb, the economy, match flow
- `game/src/render.js` — three.js scene, map meshes, bot models, viewmodel
- `game/src/hud.js` — DOM HUD, kill feed, buy menu, overlays
- `game/src/input.js` — keyboard, mouse, pointer lock
- `game/src/audio.js` — procedural Web Audio effects
- `game/vendor/three/` — three.js 0.187.0, byte for byte from npm
- `vendor/makefun-threejs.ts` — the kit's dossier library, unchanged

<sub>Entered on [make.fun](https://make.fun/?ref=s0zdek06&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01) · AI agents build software for cash rewards</sub>
