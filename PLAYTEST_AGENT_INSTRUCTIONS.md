# PLAYTEST AGENT INSTRUCTIONS — The Marked

## For AI Coding Agents

When the developer says **"run a simulation"**, **"playtest the game"**, **"simulate 30 days"**, or similar — follow this protocol exactly.

---

## Step 1 — Determine Which Command to Run

| Developer says...                          | Command                                                                 |
|--------------------------------------------|-------------------------------------------------------------------------|
| "Run a quick sim" / "smoke test"           | `python tools/simulation/run_sim.py --preset quick`                    |
| "Run a full simulation" / "balance check"  | `python tools/simulation/run_sim.py --preset full_pass`                |
| "Simulate 30 days"                         | `python tools/simulation/run_sim.py --preset long_all`                 |
| "Test minmaxer for 90 days"                | `python tools/simulation/run_sim.py --preset minmaxer_deep`            |
| "Check idle rewards"                       | `python tools/simulation/run_sim.py --preset idle_focus`               |
| "Stress test sanity"                       | `python tools/simulation/run_sim.py --preset sanity_stress`            |
| "Check signal/lore coverage"               | `python tools/simulation/run_sim.py --preset lore_coverage`            |
| "Run a visual/QOL review"                  | `python tools/simulation/run_sim.py --preset visual_qol_review`        |
| Custom (specific profiles/duration)        | `python tools/simulation/run_sim.py --duration Xd --profiles Y --runs N` |

If unclear, default to `--preset quick` and ask if you should run a longer pass.

---

## Step 2 — Run the Command

Execute the appropriate command in the terminal from the project root directory (`c:\Users\raina\Documents\Marked`).

```bash
python tools/simulation/run_sim.py --preset quick
```

Wait for it to complete. The simulation will print progress. It should finish within seconds for quick/full, or a few minutes for long_all.

---

## Step 3 — Read Both Report Files

After the simulation completes, read:

1. **`tools/simulation/reports/latest_report.md`** — human-readable summary
2. **`tools/simulation/reports/latest_report.json`** — structured data

*Note: If you ran a visual/QOL review, look in `tools/simulation/reports/visual_qol/` instead.*

Start with the JSON: look at these top-level keys:
```
overall_summary.critical_issues     ← most important problems
balance_warnings                    ← categorized warnings
exploit_findings                    ← detected exploits
unused_systems                      ← systems agents never touched
pacing_problems                     ← cross-profile pacing issues
strongest_strategies                ← what the minmaxer found
suggested_fixes                     ← specific proposed solutions
```

---

## Step 4 — Summarize the Biggest Findings

Report back to the developer with:

1. **Critical Issues** (from `overall_summary.critical_issues`)
   - Format: `[TYPE] Description`
   - Example: `[CRITICAL] minmaxer: Dying 4.2×/hour — combat overtuned`

2. **Per-Profile Problems** (from `balance_warnings`, grouped by profile)
   - Highlight the most severe: death rate, sanity drain, observation speed

3. **Unused Systems** (from `unused_systems`)
   - Which systems were never reached by any agent?
   - How many runs? What percentage of actions?

4. **Strongest Strategy Found** (from `strongest_strategies`)
   - What did the minmaxer find as the dominant loop?
   - Is it exploitable?

5. **Suggested Fixes** (from `suggested_fixes`)
   - List the top 3–5 suggested design changes
   - Present them clearly, without implementing anything yet

---

## Step 5 — Identify Likely Design Problems

Beyond the report findings, apply judgment:

**Ask yourself:**
- Did any profile die so much the game feels punishing?
- Did any profile never die — suggesting the game is trivially safe?
- Did the idle_grinder outpace the minmaxer in gold? (Should never happen)
- Were rituals never used? (Means costs are too high or access is unclear)
- Were signals decoded less than twice per simulated hour? (System is invisible)
- Did observation max out within the first 30 simulated minutes? (Tension collapses)

---

## Step 6 — Suggest Specific Fixes (Without Implementing Them)

Propose fixes like this:

> **Problem:** `ritual_addict` died 6.3×/hour — health lost to ritual costs is too aggressive.
> **Fix:** Reduce Blood Tithe's health cost from 10 to 5, or add a 20-second cooldown between rituals.
> **File:** `src/engine.js` or `tools/simulation/adapters/mock_adapter.py` (RITUAL_COSTS)

Always include:
- What the problem is
- What to change
- Which file(s) to change
- What the expected impact is

**Do NOT make any changes to game files without explicit developer approval.**

---

## Step 7 — Ask for Approval Before Changing Balance

After presenting findings, ask:

> "I've identified [N] balance issues and [M] suggested fixes. Which ones should I implement?"

Then wait for the developer to specify which fixes to apply.

Do NOT automatically adjust numbers in `src/engine.js`, `src/state.js`, `src/systems.js`, or `src/idle.js`.

Do NOT adjust `config/simulation_presets.json` thresholds to suppress warnings.

---

## Step 8 — Handling Visual / QOL / Audio Reviews

If the developer specifically asks for a visual review, QOL review, graphics review, VFX review, sound review, or game feel review:

1. Run `python tools/simulation/run_sim.py --preset visual_qol_review`
2. Inspect the generated screenshots and read `tools/simulation/reports/visual_qol/latest_visual_review.json`
3. Summarize the biggest problems across visual, UI/QOL, VFX, sound, and game feel
4. Suggest concrete fixes based on the static analysis findings
5. Do NOT make changes to assets, UI, sound, or VFX unless explicitly approved by the developer.

---

## Additional Agent Rules

### When running simulations as part of a larger task:
1. Always run `--preset quick` first as a sanity check
2. If quick passes cleanly, run the appropriate deeper preset
3. Report findings before proceeding with code changes

### When a run fails:
- Check for Python version issues (requires Python 3.8+)
- Check that you're running from the project root
- If `live_mode` fails, fall back to `mock_mode`
- If `mock_mode` fails, read the traceback and investigate `adapters/mock_adapter.py`

### When the developer says "just fix the balance":
- Do NOT automatically fix without specific approval
- Ask which findings to address
- Show the proposed changes first (as diffs or descriptions)
- Apply only what is explicitly approved

### When the developer asks "what's the game's balance status?":
- Run `--preset quick` (if no recent report exists)
- Read the report
- Summarize in 5 bullet points: what works, what doesn't, what to fix first

---

## Report File Reference

| File                                        | Purpose                                      |
|---------------------------------------------|----------------------------------------------|
| `tools/simulation/reports/latest_report.md` | Human-readable. Developer reads this.        |
| `tools/simulation/reports/latest_report.json` | AI-readable. Agent reads this.             |
| `tools/simulation/reports/latest_timeline.csv` | Time-series per-sim-hour. For deep analysis.|

Seeds are stored in `meta.seeds_used` in the JSON. Use them to reproduce any run exactly.

---

## Do Not

- Do not open the browser to run a simulation (mock_mode works headless)
- Do not edit game source files after a simulation unless explicitly asked
- Do not dismiss balance warnings by adjusting thresholds
- Do not ship or reference this directory in player-facing code
- Do not treat `mock_mode` results as exact matches to the real game — they are model signals, not ground truth

---

## Example Response Format

When reporting simulation findings to the developer:

---

**Simulation Results — The Marked (quick preset, 1h, 3 profiles)**

**🔴 Critical Issues:**
- `[EXPLOIT] ritual_addict: exploit_ritual_spam detected`
- `[CRITICAL] minmaxer: Dying 3.8×/hour — combat may be overtuned`

**⚠️ Balance Warnings:**
- `cautious_survivor` never attempted a boss (boss too scary or too hidden)
- `idle_grinder` offline gold = 4.2× active gold (idle trivializes active play)

**📭 Unused Systems:**
- Signals: `explorer_lore` decoded 0.3/hour (way below target of 0.5/hour)
- Corpse broadcast: never used by any agent

**🏆 Strongest Strategy:**
- MinMaxer reached Cursed rarity in 45 simulated minutes via body upgrade spam + boss kill loop

**💡 Top Suggested Fixes:**
1. Add ritual spam cooldown (30s global)
2. Reduce idle gold rate by 30%
3. Increase parchment drop rate by 2× from enemy kills
4. Make Seal Mother spawn more visible (Watcher warning signal before spawn)

**Seeds for reproduction:** `1001, 2002, 3003`

Shall I implement any of these? If so, which ones?

---

*Note: This report is advisory only. No game files were modified.*
