# gta6-open-world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/JasonShenn/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/JasonShenn/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**GOLDEN TIDE** — a complete 2D top-down open-world crime game in the sun-soaked seaside city of Palmera: drive and steal cars, outrun the police, run four story missions for Mara, and take the city for yourself.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — no build step, no network, just static files under `game/`.

## How to play

You are Cole “Cash” Vega. Mara runs a beach garage and has jobs for you:

- **M1 — First Job**: pick up a package at the Marina Pier, deliver it to Mara's Garage.
- **M2 — Sunset Steal**: steal the orange convertible at the marina, lose the cops, drop it at the Chop Shop.
- **M3 — Pier Shootout**: fight the pier crew, grab the cash bag, escape with a 3-star wanted level.
- **M4 — Airport Run**: drive the getaway van through roadblocks to Palmera Airport before the timer runs out.

Plus side work: drive a taxi cab for fares, and find 5 hidden cash stashes around the city. Progress, money and collected cars save automatically (localStorage) — click **Continue** on the title screen to pick up where you left off.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk or drive (Shift to run) |
| E | Enter / exit a car, steal a parked car |
| Mouse click / Space | Shoot (aim with the mouse) |
| R | Restock ammo ($20) |
| P | Pause |
| M | Mute |

## Systems

- **Open world**: six districts — Marina & Pier, Downtown glass towers, Old Town, South Beach, East Docks, Palm Heights — with traffic, pedestrians, yachts, pools and palm trees, all under one golden-hour sun with long shadows. Every block is filled: tower clusters downtown, mid-rise streets with parked cars, and parks with paths, ponds and benches instead of empty grass.
- **Wanted 0–5 stars**: stealing and shooting raise the heat; police cruisers chase and ram, roadblocks appear at 3 stars, and getting caught on foot means BUSTED.
- **Vehicles**: sedan, sports car, taxi, van, pickup and dock truck — each with its own speed and handling. Steal five types to fill the garage.
- **Combat**: pistol with ammo, big muzzle flash, enemy health bars; the pier crew shoots back.
- **HUD**: money, health, wanted stars, minimap with mission marker, objective chip, speedometer, toasts and mission banners.
- **Sound**: fully synthesised WebAudio — engine hum that follows speed, police siren, gunshots, crashes and cash blips.
- **Camera**: follows the player — zoomed in on foot so the character reads clearly, pulled back while driving.

## Layout

- `game/index.html` — page shell; `game/src/` — one file per system (`config`, `rng`, `audio`, `city`, `traffic`, `player`, `police`, `missions`, `render`, `input`, `shots`, `game`, `main`).
- `tests/playtest.mjs` — 16 gameplay checks (Playwright, port 8129); `tests/shots.mjs` — renders the 4 screenshots.
- `shots.json` — the four deterministic screenshot scenes (`?shot=…&seed=7`).
- `main.ts` — the submission program (Node 22, standard library): copies `game/` and `screenshots/` to the output and writes `dossier.json` with `vendor/makefun-game.ts`.

## Screenshots

1. `1-chase.jpg` — orange sports car chased by two cruisers, 3 stars, 207 km/h.
2. `2-pier.jpg` — Cole on foot at the Marina Pier, first job.
3. `3-shootout.jpg` — pier gunfight: muzzle flash, enemy health bars, 2 stars.
4. `4-downtown.jpg` — downtown avenue drive with dense traffic, 167 km/h.

## License

MIT — see [LICENSE](LICENSE).
