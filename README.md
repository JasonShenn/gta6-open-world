# Solmar Heat — a 2D open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/JasonShenn/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/JasonShenn/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Heat** is a top-down 2D open-world crime game built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). You are **Rook**,
new in the sun-soaked seaside city of **Solmar** — broke, armed with a
pistol, and already on **Vera's** list. She runs a garage on the west side
and a dozen quiet errands. Do the jobs, keep the Solmar PD off your back,
and the city starts paying.

Everything is original: the city, the characters, the story, the art
(drawn in code on canvas) and the sound (synthesised live with WebAudio).
No Rockstar / GTA names, characters, map, art or music, and no external
assets at all — the game is static files under `game/` and makes zero
network requests.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static file server and open `index.html`.

## The city

- A 5×4 road grid with sidewalks, blocks of buildings, a central park
  with a pond, a plaza with a fountain, a beach and a marina with docks
  and moored boats — all generated from a fixed seed, so Solmar is the
  same city every time you load it.
- Landmarks: Vera's Garage, Solmar Plaza, Lumen Tower, Harbor Market,
  Rust & Bolt Yard and Sunset Pier.
- Living streets: pedestrians strolling the sidewalks (and fleeing when
  things get loud) and traffic cars driving the grid, turning at
  intersections.

## What you can do

- **Walk and drive** — WASD / arrows to move, Shift to sprint on foot.
- **Steal cars** — walk up to any parked or traffic car and press **E**.
  Driving has acceleration, steering, braking/reverse, building and
  traffic collisions, and a speedometer.
- **Wanted level** — stealing a car, hitting a pedestrian or firing your
  gun raises your stars (0–5). Stay quiet and the heat cools off.
- **Police** — cruisers spawn to match your stars, chase, ram, and grab
  you if you sit still next to them. Getting **busted** costs a fine and
  restarts the current job at the garage.
- **Combat** — aim with the mouse, click or Space to shoot. Armed thugs
  have health bars, shoot back, and pay $50 when they go down.
- **Three story missions** from Vera, with a phone-call briefing, a
  pulsing gold marker, a mission timer on the last one, and cash rewards:
  1. *The Pickup* — fetch a package from Sunset Pier ($300).
  2. *Hot Wheels* — steal the gold coupe at the plaza, shake the heat,
     deliver it to Rust & Bolt Yard ($500).
  3. *Deadline Run* — a crate from Harbor Market to Lumen Tower in 100
     seconds, with an ambush waiting ($700).
  Finish all three and the story replays from the garage with **R**.
- **HUD** — money and health, wanted stars, mission objective, live
  minimap (player, cops, thugs, mission marker), speed, timer, and
  context prompts.
- **Save** — progress (money, health, position, mission) is stored in
  `localStorage`; the title screen offers Continue.
- **Sound** — engine hum that follows your speed, two-tone sirens,
  gunshots, crashes, cash and mission jingles, all synthesised.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Walk / drive |
| E | Steal a car / get out / pick up |
| Mouse / Space | Aim / shoot |
| Shift | Sprint on foot |
| Esc / P | Pause |
| M | Mute |

## Layout

```
game/
  index.html        entry point + HUD + menus
  src/
    config.js       tuning constants, palette, crime/wanted rules
    rng.js          seeded RNG + geometry helpers
    city.js         the city: roads, blocks, park, beach, marina
    audio.js        WebAudio synthesised sound effects
    input.js        keyboard + mouse input
    entities.js     pedestrians, traffic, police, thugs, bullets
    missions.js     the three-mission story + mission manager
    game.js         game state: driving, wanted, combat, saves, HUD
    render.js       canvas renderer + minimap
    main.js         bootstrap, menus, frame loop, test hooks
tests/
  helpers.mjs       static server + Playwright harness
  playtest.mjs      36 real-interaction checks (walk/drive/wanted/
                    missions/shooting/busted/save, zero console errors)
  shots.mjs         stages and captures the 4 screenshots
screenshots/        4 real gameplay screenshots (1-chase.jpg is the cover)
main.ts             submission program: copies game/ + screenshots/ to
                    /output and writes dossier.json
```

## Tests

```sh
node tests/playtest.mjs   # 36 checks, exit 0 when all pass
node tests/shots.mjs      # regenerates screenshots/
```

## License

MIT — see [LICENSE](LICENSE).
