# 🩸 The Marked — Comprehensive Audit Results

We ran the **"long_all"** simulation (50 simulated 30-day runs across 5 player profiles, testing 10 seeds each) and executed the **Visual/QOL/Game-Feel** review harness. 

Here is the unvarnished truth about the current state of the game:

## 🔴 Critical Balance & Exploit Issues
The simulation harness flagged **7 Balance Warnings** and **9 Exploit Flags**:
1. **Idle Dominates Active Play**: The `idle_grinder` profile generated **19,000x** more gold idling than active players. Offline/idle progress completely trivializes the actual game.
2. **Infinite Loop Exploits**: Bots discovered that repeating the same action 50+ times (e.g., `patrol_room`, `retreat`, `collect_loot`) can be exploited indefinitely without diminishing returns.
3. **Zero Tension**: The average death rate across all profiles is **0.001 deaths per hour**. The game is too safe; players are almost never dying.
4. **Ritual Spam**: The `ritual_addict` profile abused rituals with no cooldowns or ramping costs.

## 🔴 Critical Visual & Game Feel Issues
The visual review harness flagged **33 issues**, with these being the most severe:
1. **No Audio System**: The codebase entirely lacks an audio manager. There are no ambient horror loops, hit sounds, death stings, or UI click feedback. This critically undermines the horror atmosphere.
2. **Missing Sanity Break VFX**: When a player's sanity breaks, there is no visual distortion or vignette effect to communicate the danger.
3. **Sluggish Movement & Combat**: Player speed is at a slow `1.5` making dodging frustrating. There is also **no knockback** on hits, making combat feel weightless.
4. **Undramatic Deaths**: The death timer is currently set to `0.0` frames, making deaths feel like an instant, anticlimactic cut rather than a heavy, punishing event.
5. **UI Accessibility**: Several canvas text elements (like the Monolith runes) are rendered at `9px`, which is too small for standard displays.

## 💡 Recommended Next Steps
We can tackle these issues in whatever order you prefer. Here are three suggested focus areas:

### Option A: The "Game Feel & Audio" Overhaul
- Implement a robust `AudioManager` (ambient loops, UI clicks, hit sounds).
- Add screen shake, hit knockback, and a dramatic death animation.
- Add Sanity VFX (vignettes, screen distortion).

### Option B: The "Anti-Exploit & Balance" Pass
- Cap idle gold generation at 2x the active rate.
- Add diminishing returns for spamming the same action.
- Introduce a recurring pressure event (e.g., Watcher confrontation) around hour 240 to increase the death rate and tension.

### Option C: The "UX Polish" Pass
- Scale up minimum font sizes to `11px`.
- Add dramatic UI alerts at Observation thresholds (25%, 50%, 75%).
- Add a "LEVEL UP" celebration banner.

---
**How would you like to proceed?** We can start with any of the options above, or I can push these reports directly to GitHub first.
