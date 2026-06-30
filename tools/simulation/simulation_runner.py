"""
The Marked — SimulationRunner
Orchestrates the full simulation loop:
  - Loads config/preset
  - Initializes adapter, agents, clock, recorder
  - Runs N seeds × N profiles × N runs
  - Collects metrics and timeline data
  - Triggers balance analysis
  - Generates reports
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import logging
import random
import time
from typing import List, Dict, Any, Optional

from sim_clock import SimulationClock
from game_state import GameState
from metrics_recorder import MetricsRecorder
from balance_analyzer import BalanceAnalyzer
from report_generator import ReportGenerator
from adapters import get_adapter
from agents import get_agent, ALL_PROFILES

logger = logging.getLogger("SimulationRunner")


class SimulationRunner:
    """
    Orchestrates a complete simulation batch.
    One SimulationRunner per invocation of run_sim.py.
    """

    # Actions-per-tick: how many agent decisions to make per simulated second
    ACTIONS_PER_TICK = 1

    def __init__(
        self,
        config: Dict[str, Any],
        verbose: bool = False,
    ):
        self.config       = config
        self.verbose      = verbose
        self.mode         = config.get("mode", "mock_mode")
        self.output_dir   = config.get("output_dir", "tools/simulation/reports")
        self.recorder     = MetricsRecorder(output_dir=self.output_dir)
        self.analyzer     = BalanceAnalyzer()
        self.reporter     = ReportGenerator(output_dir=self.output_dir)

    def run(self) -> Dict[str, str]:
        """
        Execute the full batch. Returns paths to generated report files.
        """
        config       = self.config
        profiles     = config.get("profiles", ["minmaxer"])
        runs_per     = config.get("runs_per_profile", 3)
        duration_sec = config.get("duration_seconds", 3600)
        seeds        = config.get("seeds", [])
        mode         = config.get("mode", "mock_mode")

        # Resolve seeds
        if seeds == "auto" or not seeds:
            seed_count = config.get("auto_seed_count", 5)
            seeds = [random.randint(1000, 9999) for _ in range(seed_count)]
        config["seeds"] = seeds

        total_runs = len(profiles) * runs_per
        completed  = 0
        real_start = time.time()

        logger.info(f"=== The Marked — Simulation Harness ===")
        logger.info(f"Mode:     {mode}")
        logger.info(f"Profiles: {', '.join(profiles)}")
        logger.info(f"Duration: {_fmt_duration(duration_sec)} per run")
        logger.info(f"Runs:     {runs_per} per profile, seeds: {seeds}")
        logger.info(f"Total:    {total_runs} runs\n")

        for profile_name in profiles:
            logger.info(f"── Profile: {profile_name} ──")

            try:
                agent = get_agent(profile_name)
            except ValueError as e:
                logger.error(str(e))
                continue

            class_type = agent.get_preferred_class()

            for run_idx in range(runs_per):
                # Cycle through seeds; repeat if fewer seeds than runs
                seed = seeds[run_idx % len(seeds)]

                logger.info(
                    f"  Run {run_idx + 1}/{runs_per}  seed={seed}  class={class_type}"
                )

                try:
                    run_metrics = self._execute_single_run(
                        profile_name  = profile_name,
                        agent         = agent,
                        seed          = seed,
                        class_type    = class_type,
                        duration_sec  = duration_sec,
                        run_idx       = run_idx,
                        mode          = mode,
                    )
                    self.recorder.record_run_end(
                        run_metrics, profile_name, run_idx, duration_sec
                    )
                    completed += 1

                    if self.verbose:
                        self._print_run_summary(run_metrics, profile_name)

                except NotImplementedError:
                    logger.error(
                        f"  SKIPPED: {mode} is not implemented. "
                        "Falling back to mock_mode."
                    )
                    # Auto-retry with mock
                    config["mode"] = "mock_mode"
                    run_metrics = self._execute_single_run(
                        profile_name  = profile_name,
                        agent         = agent,
                        seed          = seed,
                        class_type    = class_type,
                        duration_sec  = duration_sec,
                        run_idx       = run_idx,
                        mode          = "mock_mode",
                    )
                    self.recorder.record_run_end(
                        run_metrics, profile_name, run_idx, duration_sec
                    )
                    completed += 1

                except Exception as e:
                    logger.error(f"  ERROR in run {run_idx}: {e}")
                    import traceback
                    traceback.print_exc()

        # Aggregate, analyze, report
        logger.info(f"\n✓ {completed}/{total_runs} runs completed.")
        logger.info("Analyzing results...")

        per_profile   = self.recorder.get_per_profile_summary()
        all_runs      = self.recorder.get_all_run_results()
        findings      = self.analyzer.analyze(per_profile, all_runs, config)
        real_elapsed  = time.time() - real_start

        # Write CSV timeline
        csv_path = self.recorder.write_timeline_csv()
        logger.info(f"Timeline → {csv_path}")

        # Write JSON + Markdown reports
        paths = self.reporter.generate(
            batch_config        = config,
            per_profile_summary = per_profile,
            findings            = findings,
            all_runs            = all_runs,
            real_elapsed        = real_elapsed,
        )
        logger.info(f"Report   → {paths['markdown']}")
        logger.info(f"JSON     → {paths['json']}")

        paths["csv"] = csv_path
        return paths

    def _execute_single_run(
        self,
        profile_name: str,
        agent,
        seed:         int,
        class_type:   str,
        duration_sec: float,
        run_idx:      int,
        mode:         str,
    ) -> Dict[str, Any]:
        """Execute one complete simulation run. Returns final metrics dict."""

        adapter = get_adapter(mode)
        clock   = SimulationClock(duration_seconds=duration_sec)

        # Initialize
        state = adapter.reset(seed=seed, class_type=class_type)
        clock.start()

        while not clock.is_finished():
            # Advance time by one tick
            dt      = clock.tick()
            events  = adapter.advance_time(int(dt))

            # Forward key events to agent
            for event in events:
                if event["event"] == "player_died":
                    agent.on_death(event["data"].get("cause", "unknown"), state)

            # Agent decision
            available = adapter.get_available_actions()
            if available:
                action = agent.choose_action(state, available)
                result = adapter.apply_action(action)

                # Handle level-up event
                if result.get("event") == "level_up":
                    agent.on_level_up(result["data"].get("level", 0), state)

            # Record snapshot at each sim-hour boundary
            if clock.should_snapshot():
                self.recorder.record_snapshot(state, profile_name, run_idx)

            # Progress log
            if self.verbose and clock.tick_count % 1000 == 0:
                pct = clock.progress_pct()
                logger.info(
                    f"    {profile_name} run {run_idx}: "
                    f"{pct:.0f}% — "
                    f"deaths={state.deaths} "
                    f"sanity={state.sanity:.0f} "
                    f"obs={state.observation:.1f}"
                )

        clock.stop()

        # Collect final metrics
        final = adapter.end_run()
        final["real_run_elapsed"] = round(clock.real_elapsed(), 2)
        final["sim_hours"] = round(clock.sim_hours, 2)

        return final

    def _print_run_summary(self, metrics: Dict, profile: str):
        logger.info(
            f"    ✓ {profile} | "
            f"deaths={metrics.get('deaths',0)} | "
            f"level={metrics.get('level',1)} | "
            f"rarity={metrics.get('highest_rarity_found','Worn')} | "
            f"rituals={metrics.get('rituals_used_count',0)} | "
            f"signals={metrics.get('signals_found_count',0)}"
        )


def _fmt_duration(seconds: float) -> str:
    if seconds < 3600:
        return f"{seconds/60:.0f}m"
    if seconds < 86400:
        return f"{seconds/3600:.1f}h"
    return f"{seconds/86400:.0f}d"
