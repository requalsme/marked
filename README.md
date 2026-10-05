# The Marked

A grim 2D horror idle ARPG that runs in the browser. Survive in the Keeping House while the Monolith studies you: the longer you live, the more it learns, and the harder it pushes back.

## Running

```bash
npm start          # serves the game at http://localhost:8080
```

Any static file server works; the game is plain ES modules with no build step.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| Click / Space | Attack (auto-combat is on by default) |
| Shift | Dash (brief invulnerability) |
| E | Interact (altar, pylon, shrine, chest, corpses, exit door) |
| I / R / J / C / U | Gear, Rituals, Signals, Corpses, Monolith panels |
| T | Toggle auto-combat |
| M | Mute |
| Esc | Close panel |

## How a descent plays out

- **Observation** rises as you survive, move and fight. At 25 / 50 / 75 / 100% you become Noticed, Studied, Modeled and Known.
- Every 10 minutes alive, a **Watcher Confrontation** sends an escalating wave.
- At 75% Observation the **Seal Mother** wakes. Defeat her and use the exit door to secure the record.
- **Sanity** drains faster in the dark. Stay near candles and collect sanity shards. Blood vials restore Flesh.
- Rituals grow hungrier with every bargain signed in a descent, and offline progress can never outpace active play.

## Simulation harness

`tools/simulation` contains a Python model of the game's systems for balance passes and a static visual/QOL review. See `PLAYTEST_AGENT_INSTRUCTIONS.md` and `tools/simulation/README.md`.

```bash
npm run sim:quick                                              # 1-hour smoke test
uv run tools/simulation/run_sim.py --preset visual_qol_review  # visual / audio / UX review
```
