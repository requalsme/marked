"""
The Marked — VisualReviewRunner
Orchestrates the complete visual/QOL/audio/game-feel review.

This runner:
  1. Runs the balance simulation (quick preset) to gather gameplay data
  2. Runs the static source analysis (UX, VFX, Audio, GameFeel reviewers)
  3. Captures screenshots (live if Playwright available, stub otherwise)
  4. Collects all findings into an EvidencePackage
  5. Generates the visual_qol report (MD + JSON + timeline CSV)

Triggered by:
  python tools/simulation/run_sim.py --preset visual_qol_review
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import time
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from review.screenshot_capture import ScreenshotCapture, SCREENSHOT_MOMENTS
from review.ux_checklist_reviewer import UXChecklistReviewer
from review.audio_event_logger import AudioEventLogger
from review.vfx_checklist_reviewer import VFXChecklistReviewer
from review.game_feel_reviewer import GameFeelReviewer
from review.review_report_generator import ReviewReportGenerator

logger = logging.getLogger("VisualReviewRunner")


class EvidencePackage:
    """Holds all collected review evidence for one review run."""

    def __init__(self, output_dir: str):
        self.output_dir    = output_dir
        self.timestamp     = datetime.now().isoformat()
        self.screenshots   = []       # list of screenshot records
        self.ux_findings   = []       # list of UX finding dicts
        self.audio_findings= []       # list of audio finding dicts
        self.vfx_findings  = []       # list of VFX finding dicts
        self.feel_findings = []       # list of game feel finding dicts
        self.sim_summary   = {}       # optional balance sim summary
        self.timeline_events = []     # events during the review session
        self.screenshot_summary = {}

    def all_findings(self) -> List[Dict[str, Any]]:
        """Return every finding across all categories, sorted by severity."""
        sev_map = {"critical": 4, "high": 3, "medium": 2, "low": 1}
        all_f = (self.ux_findings + self.audio_findings +
                 self.vfx_findings + self.feel_findings)
        return sorted(all_f, key=lambda x: -sev_map.get(x.get("severity", "low"), 0))

    def critical_count(self) -> int:
        return sum(1 for f in self.all_findings() if f.get("severity") == "critical")

    def high_count(self) -> int:
        return sum(1 for f in self.all_findings() if f.get("severity") == "high")

    def to_json_dict(self) -> Dict[str, Any]:
        return {
            "timestamp":          self.timestamp,
            "screenshot_summary": self.screenshot_summary,
            "ux_findings":        self.ux_findings,
            "audio_findings":     self.audio_findings,
            "vfx_findings":       self.vfx_findings,
            "feel_findings":      self.feel_findings,
            "sim_summary":        self.sim_summary,
            "screenshots":        [
                {k: v for k, v in s.items() if k != "filepath"}
                for s in self.screenshots
            ],
        }


class VisualReviewRunner:
    """
    Orchestrates the full visual/QOL/audio/game-feel review.
    """

    def __init__(
        self,
        project_root: str,
        output_dir: str,
        run_sim_first: bool = True,
        screenshot_mode: str = "auto",  # "auto" | "live" | "stub"
        verbose: bool = False,
    ):
        self.root            = project_root
        self.output_dir      = output_dir
        self.run_sim_first   = run_sim_first
        self.screenshot_mode = screenshot_mode
        self.verbose         = verbose

        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(os.path.join(output_dir, "screenshots"), exist_ok=True)

    def run(self) -> Dict[str, str]:
        """
        Execute the complete review. Returns dict of report file paths.
        """
        real_start = time.time()
        evidence = EvidencePackage(output_dir=self.output_dir)

        # Step 1: Run a quick balance simulation (optional)
        if self.run_sim_first:
            logger.info("Step 1/5: Running quick balance simulation...")
            sim_summary = self._run_quick_sim()
            evidence.sim_summary = sim_summary
            evidence.timeline_events.append({
                "event": "sim_complete",
                "time":  datetime.now().isoformat(),
                "data":  {"profiles": list(sim_summary.get("per_profile_results", {}).keys())},
            })
        else:
            logger.info("Step 1/5: Skipping balance simulation (run_sim_first=False)")

        # Step 2: Screenshot capture
        logger.info("Step 2/5: Screenshot capture...")
        screenshot_dir = os.path.join(self.output_dir, "screenshots")
        cap = ScreenshotCapture(
            output_dir=screenshot_dir,
            mode=self.screenshot_mode,
        )
        is_live = cap.start()
        if is_live:
            logger.info("  Live Playwright mode active — capturing real screenshots")
            for moment in SCREENSHOT_MOMENTS:
                cap.navigate_to_state(moment.get("url_state", "active"))
                cap.capture(moment["key"])
        else:
            logger.info("  Stub mode — creating placeholder screenshot records")
            cap.capture_all_stubs()

        cap.stop()
        evidence.screenshots       = cap.get_captured()
        evidence.screenshot_summary = cap.get_summary()

        for err in cap.get_errors():
            logger.warning(f"  Screenshot: {err}")

        # Step 3: Static analysis reviewers
        logger.info("Step 3/5: Running UX checklist analysis...")
        ux = UXChecklistReviewer(self.root)
        evidence.ux_findings = ux.run()
        logger.info(f"  {len(evidence.ux_findings)} UX findings")

        logger.info("Step 3/5: Running Audio analysis...")
        audio = AudioEventLogger(self.root)
        evidence.audio_findings = audio.run()
        logger.info(f"  {len(evidence.audio_findings)} audio findings")

        logger.info("Step 3/5: Running VFX analysis...")
        vfx = VFXChecklistReviewer(self.root)
        evidence.vfx_findings = vfx.run()
        logger.info(f"  {len(evidence.vfx_findings)} VFX findings")

        logger.info("Step 3/5: Running Game Feel analysis...")
        feel = GameFeelReviewer(
            self.root,
            simulation_results=evidence.sim_summary,
        )
        evidence.feel_findings = feel.run()
        logger.info(f"  {len(evidence.feel_findings)} game feel findings")

        # Step 4: Write timeline CSV
        logger.info("Step 4/5: Writing timeline events CSV...")
        csv_path = self._write_timeline_csv(evidence)

        # Step 5: Generate reports
        logger.info("Step 5/5: Generating reports...")
        reporter = ReviewReportGenerator(self.output_dir)
        paths = reporter.generate(
            evidence=evidence,
            real_elapsed=time.time() - real_start,
        )
        paths["csv"] = csv_path

        total = evidence.critical_count() + evidence.high_count()
        logger.info(f"\n✓ Review complete: {evidence.critical_count()} critical, "
                    f"{evidence.high_count()} high, {total} total priority issues")

        return paths

    # ─── Internal ─────────────────────────────────────────────────────────────

    def _run_quick_sim(self) -> Dict[str, Any]:
        """Run a minimal balance simulation and return the per-profile summary."""
        try:
            import random
            from simulation_runner import SimulationRunner

            config = {
                "preset":           "visual_qol_quick_sim",
                "mode":             "mock_mode",
                "profiles":         ["minmaxer", "cautious_survivor", "ritual_addict"],
                "runs_per_profile": 2,
                "duration_seconds": 1800,  # 30 simulated minutes — enough for signal
                "seeds":            [1001, 2002],
                "output_dir":       self.output_dir,
                "report_tags":      ["visual_qol_review", "embedded_sim"],
            }

            runner = SimulationRunner(config=config, verbose=self.verbose)
            # Run without full report — just get summary data
            from metrics_recorder import MetricsRecorder
            from balance_analyzer import BalanceAnalyzer
            from agents import get_agent
            from adapters import get_adapter
            from sim_clock import SimulationClock
            import time as _time

            recorder = MetricsRecorder(output_dir=self.output_dir)
            analyzer = BalanceAnalyzer()

            for profile_name in config["profiles"]:
                agent = get_agent(profile_name)
                class_type = agent.get_preferred_class()
                for run_idx, seed in enumerate(config["seeds"]):
                    adapter = get_adapter("mock_mode")
                    clock = SimulationClock(duration_seconds=config["duration_seconds"])
                    state = adapter.reset(seed=seed, class_type=class_type)
                    clock.start()
                    while not clock.is_finished():
                        dt = clock.tick()
                        events = adapter.advance_time(int(dt))
                        available = adapter.get_available_actions()
                        if available:
                            action = agent.choose_action(state, available)
                            adapter.apply_action(action)
                        if clock.should_snapshot():
                            recorder.record_snapshot(state, profile_name, run_idx)
                    clock.stop()
                    metrics = adapter.end_run()
                    recorder.record_run_end(metrics, profile_name, run_idx, config["duration_seconds"])

            per_profile = recorder.get_per_profile_summary()
            all_runs = recorder.get_all_run_results()
            findings = analyzer.analyze(per_profile, all_runs, config)

            return {
                "per_profile_results": per_profile,
                "balance_findings":    findings,
                "all_runs":            all_runs,
            }

        except Exception as e:
            logger.warning(f"Quick sim failed: {e}. Continuing without sim data.")
            return {}

    def _write_timeline_csv(self, evidence: EvidencePackage) -> str:
        """Write the timeline_events.csv file."""
        import csv
        path = os.path.join(self.output_dir, "timeline_events.csv")

        rows = []

        # Screenshots as timeline events
        for s in evidence.screenshots:
            rows.append({
                "time":     s.get("captured_at", ""),
                "type":     "screenshot",
                "key":      s.get("key", ""),
                "label":    s.get("label", ""),
                "status":   s.get("status", ""),
                "notes":    "; ".join(s.get("notes", [])),
            })

        # Any other timeline events
        for evt in evidence.timeline_events:
            rows.append({
                "time":  evt.get("time", ""),
                "type":  evt.get("event", ""),
                "key":   "",
                "label": str(evt.get("data", {})),
                "status": "ok",
                "notes": "",
            })

        if rows:
            with open(path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=["time", "type", "key", "label", "status", "notes"])
                writer.writeheader()
                writer.writerows(rows)

        return path
