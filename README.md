# Sunset Run — a Vista Coral story

[![make.fun bounty: Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Leaderboard rank](https://make.fun/badge/gta6-01/sandiawan-kielo-dale/gta6-round2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![Reward](https://make.fun/badge/gta6-01/sandiawan-kielo-dale/gta6-round2/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the browser, set in **Vista Coral** — a sun-soaked coastal city
frozen at golden hour. Rae Solano is back in town and the coast owes her money. Steal cars, outrun the
Coral PD, take on the Red Tide crew and work through a six-mission story, all in static files with no
build step and no network requests (three.js r158 is vendored as `game/vendor/three.min.js`; textures
and sound are generated at runtime).

## Features

- A procedurally laid-out city: a 9 × 8 road grid with downtown glass towers, pastel mid-rises and
  beach-front hotels, parks, a palm-lined boulevard, a sandy beach with umbrellas and lifeguard towers,
  and Gull Pier with its Ferris wheel.
- On foot: walk, sprint, jump, punch and shoot (fists and a pistol with ammo).
- Driving: four civilian models plus a police interceptor, arcade handling with a drifting handbrake,
  damage, smoke and wrecks. Press E to enter a parked car or drag a driver out of a moving one.
- Living streets: lane-following traffic that turns at intersections and brakes for obstacles, and
  pedestrians that stroll sidewalks and the beach and panic at gunfire.
- A 0–5 star wanted level: police cars are dispatched by road, chase you, dismount to arrest you on
  foot, open fire from 3 stars, and lose you once you stay out of sight long enough (search zone on the minimap).
- Six story missions with objectives, timers, a 3D marker beam and an on-screen arrow:
  Homecoming, Borrowed Wheels, Pier Pressure, Heat Wave, Debt Collector and Last Light.
- HUD with health/armor, cash, weapon/ammo, wanted stars, speedometer, district name and a rotating minimap.
- Start, pause, WASTED and BUSTED screens; progress saves to localStorage (auto after missions, or from the pause menu).
- WebAudio sound: engine, siren, gunshots, punches, jingles and an in-car synth radio loop.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| Mouse (click to lock) | Look around |
| Shift | Sprint |
| Space | Jump (on foot) / handbrake (in a car) |
| E | Enter, exit or steal a car |
| Left mouse / F | Attack with the current weapon |
| 1 / 2 | Fists / pistol (pistol unlocks in mission 2) |
| C | Look back while driving |
| Esc / P | Pause |

## Running it

Serve `game/` with any static server, e.g. `node serve.ts`, then open http://localhost:8080 in desktop
Chrome. `?shot=chase|drive|combat|start` stages the scenes used for the screenshots.

To hand the entry in: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## File layout

```
main.ts                 copies game/ and screenshots/ to /output and writes dossier.json
serve.ts                local static server
vendor/makefun-game.ts  make.fun dossier library (unchanged)
game/index.html         canvas, HUD and menu markup
game/style.css          HUD and menu styling
game/vendor/three.min.js  three.js r158
game/src/
  config.js      tunable constants, palette, districts
  random.js      seeded RNG
  input.js       keyboard / mouse / pointer lock
  textures.js    procedural canvas textures and sky
  city.js        road grid, lots, buildings, beach, pier, palms, landmarks
  physics.js     building collision, line of sight
  characters.js  low-poly humanoid meshes and animation
  player.js      on-foot movement, health, entering/exiting cars
  vehicles.js    car models, arcade driving physics, damage
  traffic.js     road graph and civilian traffic AI
  peds.js        pedestrians, panic, hostile crew
  wanted.js      wanted stars, police dispatch, pursuit, arrests
  weapons.js     fists and pistol hitscan
  effects.js     tracers, puffs, smoke
  missions.js    story mission chain and objective marker
  hud.js         HUD and minimap
  audio.js       WebAudio synthesis
  save.js        localStorage save/load
  camera.js      third-person and chase camera
  screens.js     start / pause / wasted / busted screens
  shots.js       screenshot staging
  main.js        scene setup and main loop
screenshots/            four in-game screenshots (the first is the cover)
```

All names, characters, places and art are original to this game.

## License

MIT — see [LICENSE](LICENSE).
