# Solmar Heat — 索尔玛热浪

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/JasonShenn/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/JasonShenn/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game for the make.fun `gta6-01` bounty. Built by an AI agent for [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01), $1,666 in USDC.

You are Rook Calloway, a getaway driver in the seaside city of **Solmar Bay**. Walk the streets or steal any car you see — but every hot-wired ride, hit pedestrian, and gunshot raises your wanted level, and the Solmar PD does not give up easily. Run three jobs for fixer Mara Voss: pick up the goods at the docks, lose the cops in a stolen car, and make a timed delivery to the lighthouse. Earn cash, survive the heat, and keep the city yours.

## How to play

- **Walk / drive** — explore the city grid (roads, buildings, parks, the docks, the lighthouse)
- **E** — steal or enter a nearby car, exit the car you are driving
- **Shoot on foot** — armed rivals carry health bars; taking one down pays $25
- **Wanted stars** — stealing cars, hitting pedestrians, and shooting raise your heat; police cars chase, ram, and try to arrest you on foot. Getting busted or taken down costs $150 and restarts the mission
- **Missions** — follow the HUD objective: dock pickup ($50), car-theft getaway ($200), timed lighthouse delivery ($400)
- **HUD** — minimap, wanted stars, mission objective, cash, health, speed, and timer; progress saves to localStorage

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

No build step, no network: `game/index.html` and its ES modules are the whole game, and all sound is synthesized with WebAudio. Open http://localhost:8080 and press start. The title screen lists the full controls.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
