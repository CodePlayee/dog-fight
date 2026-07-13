# Ace of Dawn — WW2 Dogfight

A single-page WW2 dogfight game built with [Three.js](https://threejs.org/).
Fly an arcade-physics warbird, down 8 bandits, and don't hit the deck.

## Run

Requires Node.js `^20.19.0` or `>=22.12.0`.

```bash
npm install
npm run dev      # dev server with HMR (auto-opens browser)
```

## Build

```bash
npm run build    # production bundle -> dist/
npm run preview  # serve the built bundle locally
```

## Test

```bash
npx playwright install chromium  # first run only
npm test                         # desktop and touch gameplay checks
npm run test:prod                # smoke-test the built bundle
npm run check                    # build + development and production checks
```

## Controls

| Key | Action |
|-----|--------|
| `W` / `S` | Pitch (dive / climb) |
| `A` / `D` | Roll left / right |
| `Q` / `E` | Yaw rudder |
| `Shift` / `Ctrl` | Throttle up / down |
| `Space` / LMB | Fire .50 machine guns |
| `F` / RMB | Fire 20mm cannon |
| `V` | Cockpit / chase camera |
| `P` / `Esc` | Pause |

On touch screens, use the left directional pad to pitch and roll. The right controls fire the machine guns or cannon and adjust throttle; `CAM` switches camera and the pause button pauses or resumes the sortie. Touch controls support simultaneous steering and firing.

## Project layout

The game is split into focused ES modules under `src/`:

| File | Responsibility |
|------|----------------|
| `config.js`  | Tunables (`CFG`), shared scratch vectors, math helpers |
| `core.js`    | Renderer, scene, camera, bloom composer, resize |
| `world.js`   | Lights, sky shader, terrain, scatter, clouds, `terrainH()` |
| `models.js`  | `buildWarbird()` procedural aircraft mesh |
| `audio.js`   | Procedural WebAudio synth (`SFX`) |
| `vfx.js`     | Particle + debris pools, muzzle/impact/smoke/explosion |
| `bullets.js` | Pooled tracers, segment-vs-sphere collision |
| `ballistics.js` | Shared gravity- and velocity-aware intercept solver |
| `player.js`  | Player flight model, weapons, damage |
| `enemy.js`   | Enemy AI (engage/evade), lead-pursuit firing |
| `hud.js`     | SVG gunsight, brackets, lead pip, gauges, killfeed |
| `input.js`   | Keyboard, mouse, and touch state |
| `camera.js`  | Chase / cockpit rig, shake, FOV kick |
| `game.js`    | Match state, win/lose, overlays, target lock |
| `main.js`    | Entry point: game loop + boot wiring |
| `styles.css` | All UI / HUD styling |

`player.js`, `enemy.js`, and `input.js` reference `game.js` and vice-versa;
this circular reference is resolved by ES module live bindings because
`game` is only accessed inside methods at runtime, never at module load.

## Tech

- Three.js 0.160 (local npm dependency)
- Vite 8 build / dev server
- No art assets — geometry, textures, sky, and audio are all generated at runtime.
