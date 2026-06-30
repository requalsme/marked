"""
The Marked — MetricsRecorder
Collects per-tick and per-event data during a simulation run.
Builds the timeline CSV and per-run JSON blobs.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import csv
import json
import time
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from game_state import GameState, SIGNAL_TYPES, CORPSE_ACTIONS


@dataclass
class TimelinePoint:
    """One snapshot on the simulation timeline."""
    sim_time: float
    real_time: float
    profile: str
    seed: int
    run_index: int
    level: int
    health: float
    health_pct: float
    sanity: float
    observation: float
    sanity_tier: str
    observation_tier: str
    deaths: int
    gold: int
    enemies_defeated: int
    rituals_used: int
    signals_found: int
    idle_sessions: int
    diagnosis: str


class MetricsRecorder:
    """
    Records timeline snapshots, per-run summaries, and cross-run aggregates.
    One MetricsRecorder per simulation batch.
    """

    def __init__(self, output_dir: str = "tools/simulation/reports"):
        self.output_dir = output_dir
        self._run_results: List[Dict[str, Any]] = []
        self._timeline: List[TimelinePoint] = []
        self._real_start = time.time()

    # ─── Per-run recording ────────────────────────────────────────────────────

    def record_snapshot(
        self,
        state: GameState,
        profile_name: str,
        run_index: int,
    ):
        """Record a timeline snapshot (called every sim-hour)."""
        point = TimelinePoint(
            sim_time      = state.simulated_time,
            real_time     = time.time() - self._real_start,
            profile       = profile_name,
            seed          = state.seed,
            run_index     = run_index,
            level         = state.level,
            health        = state.health,
            health_pct    = round(state.health / max(1, state.max_health) * 100, 1),
            sanity        = round(state.sanity, 1),
            observation   = round(state.observation, 1),
            sanity_tier   = state.get_sanity_tier(),
            observation_tier = state.get_observation_tier(),
            deaths        = state.deaths,
            gold          = state.gold,
            enemies_defeated = state.enemies_defeated,
            rituals_used  = len(state.rituals_used),
            signals_found = len(state.signals_found),
            idle_sessions = len(state.idle_sessions),
            diagnosis     = state.active_diagnosis,
        )
        self._timeline.append(point)

    def record_run_end(
        self,
        metrics: Dict[str, Any],
        profile_name: str,
        run_index: int,
        duration_seconds: float,
    ):
        """Record the final metrics for one completed run."""
        metrics["_profile"]   = profile_name
        metrics["_run_index"] = run_index
        metrics["_duration"]  = duration_seconds
        self._run_results.append(metrics)

    # ─── Aggregation ──────────────────────────────────────────────────────────

    def get_per_profile_summary(self) -> Dict[str, Dict[str, Any]]:
        """Aggregate all runs by profile."""
        by_profile: Dict[str, List[Dict]] = {}
        for r in self._run_results:
            p = r["_profile"]
            by_profile.setdefault(p, []).append(r)

        summary = {}
        for profile, runs in by_profile.items():
            n = len(runs)

            def avg(key):
                vals = [r.get(key, 0) for r in runs if r.get(key) is not None]
                return round(sum(vals) / len(vals), 2) if vals else 0

            def total(key):
                return sum(r.get(key, 0) for r in runs)

            all_causes = []
            for r in runs:
                all_causes.extend(r.get("death_causes", []))

            all_exploits = []
            for r in runs:
                all_exploits.extend(r.get("exploit_flags", []))

            all_rituals = []
            for r in runs:
                all_rituals.extend(r.get("rituals_used_names", []))

            summary[profile] = {
                "runs":                    n,
                "avg_deaths":              avg("deaths"),
                "avg_level":               avg("level"),
                "avg_gold":                avg("gold"),
                "avg_longest_life_hours":  round(avg("longest_life_seconds") / 3600, 2),
                "avg_average_life_hours":  round(avg("average_life_seconds") / 3600, 2),
                "avg_enemies_defeated":    avg("enemies_defeated"),
                "avg_bosses_attempted":    avg("bosses_attempted"),
                "avg_bosses_defeated":     avg("bosses_defeated"),
                "avg_rituals_used":        avg("rituals_used_count"),
                "avg_signals_found":       avg("signals_found_count"),
                "avg_idle_sessions":       avg("idle_sessions_count"),
                "avg_sanity_lost":         avg("sanity_lost_total"),
                "avg_final_observation":   avg("final_observation"),
                "avg_gear_equipped":       avg("gear_equipped_count"),
                "best_rarity_seen":        self._best_rarity(runs),
                "top_death_causes":        _top_n(all_causes, 3),
                "exploit_flags":           list(set(all_exploits)),
                "rituals_used_across_runs": list(set(all_rituals)),
                "gold_idle_vs_active_ratio": self._idle_ratio(runs),
                "diagnosis_modes":         _top_n([r.get("active_diagnosis","?") for r in runs], 3),
            }

        return summary

    def _best_rarity(self, runs):
        order = ["Impossible", "Abyssal", "Relic", "Cursed", "Unsettling", "Worn"]
        for rarity in order:
            if any(r.get("highest_rarity_found") == rarity for r in runs):
                return rarity
        return "Worn"

    def _idle_ratio(self, runs) -> float:
        active_sum = sum(r.get("gold_gained_active", 0) for r in runs)
        idle_sum   = sum(r.get("gold_gained_idle", 0) for r in runs)
        if active_sum == 0:
            return 999.0
        return round(idle_sum / max(1, active_sum), 2)

    def get_all_run_results(self) -> List[Dict[str, Any]]:
        return self._run_results

    def get_timeline(self) -> List[TimelinePoint]:
        return self._timeline

    # ─── Export ───────────────────────────────────────────────────────────────

    def write_timeline_csv(self, filename: str = None):
        path = filename or os.path.join(self.output_dir, "latest_timeline.csv")
        os.makedirs(os.path.dirname(path), exist_ok=True)

        if not self._timeline:
            return path

        fieldnames = [
            "sim_time", "real_time", "profile", "seed", "run_index",
            "level", "health", "health_pct", "sanity", "observation",
            "sanity_tier", "observation_tier", "deaths", "gold",
            "enemies_defeated", "rituals_used", "signals_found",
            "idle_sessions", "diagnosis",
        ]
        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for pt in self._timeline:
                writer.writerow({k: getattr(pt, k) for k in fieldnames})

        return path

    def write_json_report(self, summary: Dict[str, Any], filename: str = None):
        path = filename or os.path.join(self.output_dir, "latest_report.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, default=str)
        return path


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _top_n(items: list, n: int) -> list:
    """Return the N most common items in a list."""
    from collections import Counter
    if not items:
        return []
    return [item for item, _ in Counter(items).most_common(n)]
