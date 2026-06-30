# The Marked — Simulation Harness

Developer-only playtest simulation tool. Not a player feature.

Simulates long gameplay sessions using AI-controlled player profiles to reveal
balance and design problems in The Marked without requiring manual playtesting.

---

## Quick Start

```bash
# Fastest smoke-test (1h, 3 profiles, runs in ~10 seconds)
python tools/simulation/run_sim.py --preset quick

# OR via npm shortcut
npm run sim:quick

# Full weekly balance pass (8h, all 5 profiles)
npm run sim:full

# Long economy analysis (30 days)
npm run sim:long

# Custom run
python tools/simulation/run_sim.py --duration 7d --profiles minmaxer,ritual_addict --runs 10
```

Reports are written to `tools/simulation/reports/`:
- `latest_report.md` — human-readable
- `latest_report.json` — machine-readable (for AI agent inspection)
- `latest_timeline.csv` — time-series data per sim-hour

---

## CLI Reference

```
python tools/simulation/run_sim.py [OPTIONS]

--preset NAME             Load a named preset (quick, full_pass, long_all, ...)
--duration DURATION       Simulated run duration (1h, 8h, 30d, 2w)
--profiles PROFILE[,...]  Comma-separated list, or 'all'
--runs N                  Runs per profile (default: 3)
--seeds SEED[,...]        Specific integer seeds for reproducibility
--mode mock_mode|live_mode  Simulation mode
--verbose                 Print per-run progress
--output DIR              Report output directory
```

---

## npm Shortcuts

| Command             | Description                                        |
|---------------------|----------------------------------------------------|
| `npm run sim:quick` | Fast smoke-test (1h, 3 profiles)                   |
| `npm run sim:full`  | Full balance pass (8h, all 5 profiles)             |
| `npm run sim:long`  | Deep economy run (30d, all profiles)               |
| `npm run sim:minmaxer` | Exploit/ceiling test (90d, minmaxer)            |
| `npm run sim:idle`  | Offline reward balance (30d, idle_grinder)         |
| `npm run sim:sanity`| Sanity system stress (7d, ritual + cautious)       |
| `npm run sim:lore`  | Signal/lore coverage (14d, explorer)               |
| `npm run sim:verbose` | Quick test with progress output                  |

---

## Architecture

```
tools/simulation/
├── run_sim.py                  ← Entry point
├── simulation_runner.py        ← Orchestrator
├── sim_clock.py                ← Time compression
├── game_state.py               ← Simulated game state
├── metrics_recorder.py         ← Data collection
├── balance_analyzer.py         ← Design analysis
├── report_generator.py         ← Report output
│
├── config/
│   └── simulation_presets.json ← Preset definitions
│
├── agents/                     ← Player behavior profiles
│   ├── player_agent.py         ← Base class
│   ├── minmaxer_agent.py       ← MinMaxerAgent
│   ├── cautious_survivor_agent.py
│   ├── ritual_addict_agent.py
│   ├── explorer_lore_agent.py
│   └── idle_grinder_agent.py
│
├── adapters/                   ← Game connection layer
│   ├── game_adapter.py         ← Base class / interface
│   ├── mock_adapter.py         ← Pure Python simulation (primary)
│   └── live_adapter.py         ← Real game bridge (placeholder)
│
└── reports/                    ← Generated output
    ├── latest_report.md
    ├── latest_report.json
    └── latest_timeline.csv
```

---

## Player Profiles

| Profile            | Description                                              |
|--------------------|----------------------------------------------------------|
| `minmaxer`         | Optimizes damage, farms bosses, finds power ceilings     |
| `cautious_survivor`| Retreats often, protects sanity, avoids risk             |
| `ritual_addict`    | Spams rituals, devours corpses, runs at low sanity       |
| `explorer_lore`    | Reads all signals, cycles all corpse actions, lore-first |
| `idle_grinder`     | Checks in once per day, relies on offline gains          |

---

## What It Detects

**Balance warnings:**
- Death rate too high or too low
- Sanity decaying too fast/slow
- Observation maxing too quickly
- Idle gains triumphing over active play

**Exploit detection:**
- Repeated identical action loops
- Ritual spam patterns
- Infinite gold via idle abuse

**System health:**
- Unused systems (signals, corpses, rituals never touched)
- Overused systems (players stuck in one loop)
- Boss encounter rate too low
- Signal discovery too slow

**Pacing:**
- Death rate disparity between profiles
- Overall content too easy across all profiles

---

## Modes

### mock_mode (default)
Pure Python simulation. Mirrors the real game's systems from:
- `src/state.js` → item generation, gear, classes
- `src/engine.js` → combat, enemies, observation
- `src/idle.js` → offline progress
- `src/systems.js` → sanity decay, tarot, reality traits

Use this during development. Always works, no browser needed.

### live_mode (placeholder)
Bridge to the actual running game build. Adapters available:
- `WebSocket` — inject a WS server into main.js
- `CDP` — Chrome DevTools Protocol (see `adapters/live_adapter.py`)
- `Playwright` — headless browser automation

See `adapters/live_adapter.py` for implementation instructions.

---

## Adding New Systems

When you add a new game mechanic:

1. **Update `game_state.py`** — add new tracked fields
2. **Update `adapters/mock_adapter.py`** — simulate the mechanic
3. **Update relevant agents** — add behavioral responses
4. **Update `balance_analyzer.py`** — add threshold checks
5. **Update `config/simulation_presets.json`** — add thresholds if needed

---

## Reproducibility

Every run uses a fixed seed. To replay a specific run:

```bash
python tools/simulation/run_sim.py --seeds 1234 --profiles minmaxer --runs 1 --verbose
```

Seeds are always recorded in `latest_report.json` under `meta.seeds_used`.

---

## Rules

- **Never auto-edits game files.** This tool reports. You decide what to change.
- **Not a player feature.** Never ship this directory in a release build.
- **Not a full game.** mock_mode is a simplified model; it will diverge from real game behavior. Treat findings as signals, not ground truth.
