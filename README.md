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

## The Monolith learns

- The Monolith keeps a **dossier**: how you fight (close, evasive, dash-reliant, burst-reliant), where you linger, how you treat
  light, sanity, bargains and the dead. It is shown on the Monolith panel (U) and as the Diagnosis under your name.
- The **Watcher** speaks rarely and only about what it has actually seen: your habits, a corpse you burned, the way you died
  last time. A Fractured mind is lied to; a Broken one is spoken to by name. Whispers are filed under Signals (J).
- From **Studied (50%)** the Monolith starts using what it has learned, with a telegraph for each: *baited dashes* (witnesses
  wind up as you dash, then lunge where you land), *led shots* (they aim where you are going), *slams* (stand at arm's length
  and a ring closes), *burst armour* (no single crit can take more than a share), *bargain traps* (linger at the altar),
  *snuffed flames* (the candles around you go out). One counter at Studied, two at Modeled, three at Known.
- **The Shape** fights with your class, keeps your distance and dashes when you do. A corpse you leave behind may stand up as you
  approach it (always, under the Death card).
- Habits survive death with decay (you are remembered across lives) and are weakened by Obfuscation, so a player who varies
  their play, or hides, reads as Inconclusive.

## The story

The Keeping House was a cathedral that turned confession into debt. The Monolith answers ledgers by writing the rest of the person.
The story is not told, it is found: thirteen Ledger pages unlock from what you do (decoding at the altar, being noticed, meeting
the Seal Mother, putting down your own dead, escaping), and a last entry lets a player who has read it all strike their own name
from the Register. See [docs/STORY.md](docs/STORY.md).

- The signal pylon (E) gives a free warning every so often. Your mind decides whether it is true: Fractured and Broken receivers
  are lied to, and The Moon makes it worse. High Signal Clarity marks the lies.
- The Seal Mother is the Registrar-Matron, who sealed the House to keep the Register from walking out. She fights in three phases
  and speaks at each turn.

## Tests

```bash
npm test      # headless unit tests: the real engine and systems, no browser needed
```

## Simulation harness

`tools/simulation` contains a Python model of the game's systems for balance passes and a static visual/QOL review. See `PLAYTEST_AGENT_INSTRUCTIONS.md` and `tools/simulation/README.md`.

```bash
npm run sim:quick                                              # 1-hour smoke test
uv run tools/simulation/run_sim.py --preset visual_qol_review  # visual / audio / UX review
```
