"""
The Marked — BalanceAnalyzer
Inspects per-profile simulation results and generates:
  - Balance warnings
  - Exploit detections
  - Unused/overused system flags
  - Pacing problem detection
  - Strongest strategy identification
  - Suggested design fixes

This module does NOT edit game files. It only produces analysis text
and structured warnings for the report. Design changes require explicit
developer approval.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import List, Dict, Any, Optional


# ─── Thresholds (mirror config/simulation_presets.json) ──────────────────────

THRESHOLDS = {
    "death_rate_per_hour_high":          3.0,
    "death_rate_per_hour_low":           0.05,
    "sanity_broken_time_pct_high":       0.30,
    "obs_reached_too_fast_hours":        0.5,
    "idle_gains_exceeding_active_ratio": 3.0,
    "unused_system_threshold":           0.02,   # < 2% interaction rate = unused
    "overused_system_threshold":         0.70,   # > 70% of actions = overused
    "boss_attempt_rate_min":             0.01,   # per sim-hour
    "signal_find_rate_min":              0.5,    # per sim-hour
    "ritual_find_rate_min":              0.1,    # per sim-hour
}


class BalanceAnalyzer:
    """
    Analyzes simulation batch results and produces human + machine-readable findings.
    All findings include an actionable suggested fix.
    """

    def __init__(self, thresholds: dict = None):
        self.thresholds = thresholds or THRESHOLDS

    def analyze(
        self,
        per_profile_summary: Dict[str, Dict[str, Any]],
        all_runs: List[Dict[str, Any]],
        batch_config: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Run full analysis. Returns structured findings dict.
        """
        t = self.thresholds
        findings = {
            "balance_warnings":   [],
            "exploit_findings":   [],
            "unused_systems":     [],
            "overused_systems":   [],
            "pacing_problems":    [],
            "strongest_strategies": [],
            "weakest_systems":    [],
            "suggested_fixes":    [],
        }

        duration_hours = batch_config.get("duration_seconds", 3600) / 3600

        for profile, stats in per_profile_summary.items():
            n_runs = max(1, stats.get("runs", 1))
            avg_deaths = stats.get("avg_deaths", 0)
            avg_life_h = stats.get("avg_average_life_hours", 0)
            avg_rituals = stats.get("avg_rituals_used", 0)
            avg_signals = stats.get("avg_signals_found", 0)
            avg_bosses  = stats.get("avg_bosses_attempted", 0)
            avg_sanity  = stats.get("avg_sanity_lost", 0)
            avg_obs     = stats.get("avg_final_observation", 0)
            idle_ratio  = stats.get("gold_idle_vs_active_ratio", 0)
            exploits    = stats.get("exploit_flags", [])
            best_rarity = stats.get("best_rarity_seen", "Worn")

            death_rate = avg_deaths / max(0.01, duration_hours)

            # ── Death rate warnings ─────────────────────────────────────────
            if death_rate > t["death_rate_per_hour_high"]:
                findings["balance_warnings"].append({
                    "profile": profile,
                    "type":    "death_rate_too_high",
                    "value":   round(death_rate, 2),
                    "message": f"{profile}: Dying {death_rate:.1f}×/hour. Combat or sanity damage may be overtuned.",
                })
                findings["suggested_fixes"].append(
                    f"[{profile}] Reduce early enemy damage by 15–20%, or increase starting HP by 20."
                )

            if death_rate < t["death_rate_per_hour_low"] and duration_hours > 2:
                findings["balance_warnings"].append({
                    "profile": profile,
                    "type":    "death_rate_too_low",
                    "value":   round(death_rate, 3),
                    "message": f"{profile}: Almost never dying ({death_rate:.3f}×/hr). Content may be too safe.",
                })
                findings["suggested_fixes"].append(
                    f"[{profile}] Introduce a recurring pressure event around hour {duration_hours/3:.0f} (e.g., forced observation spike, Watcher confrontation)."
                )

            # ── Sanity warnings ────────────────────────────────────────────
            if avg_sanity > 80 * duration_hours:  # rough "always broken" check
                findings["balance_warnings"].append({
                    "profile": profile,
                    "type":    "sanity_critically_high_drain",
                    "value":   round(avg_sanity, 1),
                    "message": f"{profile}: Sanity drained {avg_sanity:.0f} pts avg. Sanity may decay too fast.",
                })
                findings["suggested_fixes"].append(
                    f"[{profile}] Reduce passive sanity decay by 25%, or add more accessible sanity restoration (more shards, cheaper candle radius)."
                )

            # ── Observation warnings ────────────────────────────────────────
            if avg_obs >= 99 and duration_hours <= t["obs_reached_too_fast_hours"]:
                findings["balance_warnings"].append({
                    "profile": profile,
                    "type":    "observation_maxed_too_fast",
                    "value":   round(avg_obs, 1),
                    "message": f"{profile}: Observation hit 100% too quickly. Monolith tension collapses early.",
                })
                findings["suggested_fixes"].append(
                    f"[{profile}] Reduce passive observation gain rate by ~30%, or increase obfuscation upgrade effectiveness."
                )

            if avg_obs < 10 and duration_hours > 4:
                findings["balance_warnings"].append({
                    "profile": profile,
                    "type":    "observation_never_builds",
                    "value":   round(avg_obs, 1),
                    "message": f"{profile}: Observation barely moved ({avg_obs:.1f}%). The Monolith feels absent.",
                })
                findings["suggested_fixes"].append(
                    f"[{profile}] Increase base observation gain from active combat by 2×. The system should feel present within 30 minutes."
                )

            # ── Idle balance warnings ──────────────────────────────────────
            if idle_ratio > t["idle_gains_exceeding_active_ratio"]:
                findings["balance_warnings"].append({
                    "profile": profile,
                    "type":    "idle_dominates_active",
                    "value":   idle_ratio,
                    "message": f"{profile}: Idle gold = {idle_ratio:.1f}× active gold. Idle trivializes active play.",
                })
                findings["suggested_fixes"].append(
                    f"[{profile}] Cap offline gold rate at 2× active farming rate. Add exclusive active-only rewards (boss loot, ritual access)."
                )

            # ── Boss engagement warnings ────────────────────────────────────
            boss_rate = avg_bosses / max(0.01, duration_hours)
            if boss_rate < t["boss_attempt_rate_min"] and duration_hours > 4:
                findings["weakest_systems"].append({
                    "profile": profile,
                    "system":  "boss_encounters",
                    "message": f"{profile}: Boss attempted {avg_bosses:.1f} times avg over {duration_hours:.0f}h. Boss may be too hidden or too scary.",
                })
                findings["suggested_fixes"].append(
                    f"[{profile}] Make Seal Mother spawn more visible (announcement signal). Consider scaling boss HP for early levels."
                )

            # ── Signal system warnings ──────────────────────────────────────
            signal_rate = avg_signals / max(0.01, duration_hours)
            if signal_rate < t["signal_find_rate_min"] and duration_hours > 2:
                findings["unused_systems"].append({
                    "profile": profile,
                    "system":  "signals",
                    "message": f"{profile}: Only {avg_signals:.1f} signals found avg. Signal system may be invisible.",
                })
                findings["suggested_fixes"].append(
                    f"[{profile}] Increase parchment drop rate from enemy kills. The signal system should be accessible within 15 minutes."
                )

            # ── Ritual system warnings ──────────────────────────────────────
            ritual_rate = avg_rituals / max(0.01, duration_hours)
            if ritual_rate < t["ritual_find_rate_min"] and duration_hours > 2:
                findings["unused_systems"].append({
                    "profile": profile,
                    "system":  "rituals",
                    "message": f"{profile}: Only {avg_rituals:.1f} rituals used avg. Ritual altars may be inaccessible or costs too high.",
                })
                findings["suggested_fixes"].append(
                    f"[{profile}] Lower the entry-cost ritual (Static Communion). Add a tutorial trigger pointing players toward the altar."
                )

            # ── Exploit detection ──────────────────────────────────────────
            for flag in exploits:
                findings["exploit_findings"].append({
                    "profile": profile,
                    "flag":    flag,
                    "message": f"{profile}: Exploit detected — {flag}",
                })
                if "patrol_room" in flag:
                    findings["suggested_fixes"].append(
                        f"[{profile}] Add diminishing returns on patrolling the same room. After 10 identical actions, remove gold/loot rewards."
                    )
                elif "ritual_spam" in flag:
                    findings["suggested_fixes"].append(
                        f"[{profile}] Add a ritual cooldown (global 30s cooldown) or observation cost that stacks per ritual per minute."
                    )

            # ── Strongest strategies ───────────────────────────────────────
            if best_rarity in ("Abyssal", "Impossible"):
                findings["strongest_strategies"].append({
                    "profile": profile,
                    "strategy": f"High-rarity gear ({best_rarity}) reached",
                    "message": f"{profile} reached {best_rarity} tier. Check if this power level feels appropriate for the run length.",
                })

            diagnoses = stats.get("diagnosis_modes", [])
            if diagnoses:
                findings["strongest_strategies"].append({
                    "profile":  profile,
                    "strategy": diagnoses[0],
                    "message":  f"{profile} consistently diagnosed as: {diagnoses[0]}",
                })

        # ── Cross-profile pacing ──────────────────────────────────────────────
        self._analyze_pacing(per_profile_summary, duration_hours, findings)

        return findings

    def _analyze_pacing(
        self,
        summary: Dict[str, Dict],
        duration_hours: float,
        findings: Dict,
    ):
        """Look for pacing problems across all profiles."""
        all_death_rates = []
        for profile, stats in summary.items():
            avg_deaths = stats.get("avg_deaths", 0)
            rate = avg_deaths / max(0.01, duration_hours)
            all_death_rates.append((profile, rate))

        if not all_death_rates:
            return

        max_rate = max(r for _, r in all_death_rates)
        min_rate = min(r for _, r in all_death_rates)

        # If one profile dies 10× more than another, pacing is inconsistent
        if min_rate > 0 and max_rate / min_rate > 10:
            worst = max(all_death_rates, key=lambda x: x[1])
            best  = min(all_death_rates, key=lambda x: x[1])
            findings["pacing_problems"].append({
                "type":    "death_rate_disparity",
                "message": (
                    f"Death rate varies wildly: {worst[0]} dies {worst[1]:.1f}×/hr "
                    f"vs {best[0]} at {best[1]:.3f}×/hr. "
                    f"The game may be too easy for cautious players and too punishing for aggressive ones."
                ),
            })
            findings["suggested_fixes"].append(
                "Review enemy damage scaling. Consider adding adaptive difficulty: "
                "if the player hasn't died in 2h, introduce a minor escalation event."
            )

        # If total average deaths < 0.1/hr across ALL profiles for long run
        avg_all = sum(r for _, r in all_death_rates) / len(all_death_rates)
        if avg_all < 0.05 and duration_hours > 8:
            findings["pacing_problems"].append({
                "type":    "overall_content_too_easy",
                "message": (
                    f"Average death rate across all profiles: {avg_all:.3f}/hr. "
                    "Game may lack meaningful tension for all player types."
                ),
            })
