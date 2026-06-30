#!/usr/bin/env python3
"""
The Marked — Simulation Harness Entry Point
============================================

One-command playtest simulation for The Marked.
Runs AI-controlled player profiles through the game systems and
generates balance/design reports without requiring the browser build.

Usage:
------
    python tools/simulation/run_sim.py --preset quick
    python tools/simulation/run_sim.py --preset full_pass
    python tools/simulation/run_sim.py --preset long_all
    python tools/simulation/run_sim.py --duration 8h --profiles all
    python tools/simulation/run_sim.py --duration 30d --profiles minmaxer,ritual_addict --runs 20
    python tools/simulation/run_sim.py --duration 1h --seeds 1234,5678 --profiles cautious_survivor

Presets (from config/simulation_presets.json):
    quick           1h, 3 profiles, 3 seeds
    full_pass       8h, all 5 profiles, 5 seeds
    long_all        30d, all 5 profiles, 10 seeds
    minmaxer_deep   90d, minmaxer only, 20 runs
    idle_focus      30d, idle_grinder only
    sanity_stress   7d, ritual_addict + cautious_survivor
    lore_coverage   14d, explorer_lore only

Duration formats: 30s, 5m, 8h, 30d, 2w

Profiles: minmaxer, cautious_survivor, ritual_addict, explorer_lore, idle_grinder, all

Mode: --mode mock_mode (default) | --mode live_mode
"""

import argparse
import json
import logging
import os
import sys

# Ensure this script can find its sibling modules regardless of cwd
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from sim_clock import parse_duration
from simulation_runner import SimulationRunner
from agents import ALL_PROFILES


# ─── Logging Setup ────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("run_sim")


# ─── Config Loading ───────────────────────────────────────────────────────────

PRESETS_FILE = os.path.join(SCRIPT_DIR, "config", "simulation_presets.json")


def load_presets() -> dict:
    with open(PRESETS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def build_config(args: argparse.Namespace) -> dict:
    """Build a config dict from CLI args, merging with preset if provided."""
    presets_data = load_presets()
    defaults     = presets_data.get("defaults", {})

    # Start with defaults
    config = dict(defaults)

    # Load preset if given
    if args.preset:
        preset_key = args.preset
        preset     = presets_data["presets"].get(preset_key)
        if preset is None:
            available = list(presets_data["presets"].keys())
            logger.error(f"Unknown preset '{preset_key}'. Available: {', '.join(available)}")
            sys.exit(1)
        config.update(preset)
        config["preset"] = preset_key
    else:
        config["preset"] = "custom"

    # CLI overrides
    if args.duration:
        config["duration_seconds"] = parse_duration(args.duration)

    if args.profiles:
        raw = args.profiles
        if raw == "all":
            config["profiles"] = ALL_PROFILES
        else:
            config["profiles"] = [p.strip() for p in raw.split(",")]

    if args.runs:
        config["runs_per_profile"] = args.runs

    if args.seeds:
        seed_list = [int(s.strip()) for s in args.seeds.split(",")]
        config["seeds"] = seed_list

    if args.mode:
        config["mode"] = args.mode

    if args.output:
        config["output_dir"] = args.output

    # Ensure required fields
    config.setdefault("duration_seconds",  3600)
    config.setdefault("profiles",          ["minmaxer"])
    config.setdefault("runs_per_profile",  3)
    config.setdefault("seeds",             "auto")
    config.setdefault("mode",              "mock_mode")
    config.setdefault("output_dir",        os.path.join(SCRIPT_DIR, "reports"))

    # Resolve relative output_dir against project root (parent of tools/)
    out = config["output_dir"]
    if not os.path.isabs(out):
        # If it starts with "tools/", resolve from project root
        project_root = os.path.dirname(os.path.dirname(SCRIPT_DIR))
        config["output_dir"] = os.path.join(project_root, out)

    # Validate profiles
    for p in config["profiles"]:
        if p not in ALL_PROFILES:
            logger.error(f"Unknown profile: '{p}'. Available: {', '.join(ALL_PROFILES)}")
            sys.exit(1)

    return config


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="The Marked — Playtest Simulation Harness",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument(
        "--preset", "-p",
        metavar="NAME",
        help="Preset name from config/simulation_presets.json (quick, full_pass, long_all, ...)",
    )
    parser.add_argument(
        "--duration", "-d",
        metavar="DURATION",
        help="Simulated duration per run. Examples: 1h, 8h, 30d, 2w",
    )
    parser.add_argument(
        "--profiles",
        metavar="PROFILE[,PROFILE...]",
        help=f"Comma-separated profile list, or 'all'. Options: {', '.join(ALL_PROFILES)}",
    )
    parser.add_argument(
        "--runs", "-r",
        type=int,
        metavar="N",
        help="Number of runs per profile",
    )
    parser.add_argument(
        "--seeds",
        metavar="SEED[,SEED...]",
        help="Comma-separated integer seeds for reproducibility",
    )
    parser.add_argument(
        "--mode", "-m",
        choices=["mock_mode", "live_mode"],
        help="Simulation mode (default: mock_mode)",
    )
    parser.add_argument(
        "--adapter",
        choices=["mock", "live", "cdp"],
        help="Adapter override (default: auto-selected by mode)",
    )
    parser.add_argument(
        "--output", "-o",
        metavar="DIR",
        help="Output directory for reports (default: tools/simulation/reports)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print per-run progress",
    )

    return parser.parse_args()


# ─── Entry Point ──────────────────────────────────────────────────────────────

def main():
    args   = parse_args()
    config = build_config(args)

    # Summary banner
    dur_h = config["duration_seconds"] / 3600
    logger.info("=" * 60)
    logger.info("  THE MARKED — PLAYTEST SIMULATION HARNESS")
    logger.info("=" * 60)
    logger.info(f"  Preset:   {config['preset']}")
    logger.info(f"  Duration: {_fmt_dur(config['duration_seconds'])} per run")
    logger.info(f"  Profiles: {', '.join(config['profiles'])}")
    logger.info(f"  Runs:     {config['runs_per_profile']} per profile")
    logger.info(f"  Mode:     {config['mode']}")
    logger.info(f"  Output:   {config['output_dir']}")
    logger.info("=" * 60)

    if config["preset"] == "visual_qol_review":
        from review.visual_review_runner import VisualReviewRunner
        rev_out = os.path.join(config["output_dir"], "visual_qol")
        runner = VisualReviewRunner(
            project_root=os.path.dirname(os.path.dirname(SCRIPT_DIR)),
            output_dir=rev_out,
            run_sim_first=True,
            screenshot_mode="auto",
            verbose=args.verbose,
        )
        paths = runner.run()
    else:
        runner = SimulationRunner(config=config, verbose=args.verbose)
        paths  = runner.run()

    logger.info("")
    logger.info("=" * 60)
    logger.info("  SIMULATION COMPLETE")
    logger.info("=" * 60)
    logger.info(f"  📄 Markdown:  {paths.get('markdown', '?')}")
    logger.info(f"  📊 JSON:      {paths.get('json', '?')}")
    logger.info(f"  📈 Timeline:  {paths.get('csv', '?')}")
    logger.info("")
    if config["preset"] == "visual_qol_review":
        logger.info("  To view: open tools/simulation/reports/visual_qol/latest_visual_review.md")
        logger.info("  For AI:  read latest_visual_review.json and summarize visual findings")
    else:
        logger.info("  To view: open tools/simulation/reports/latest_report.md")
        logger.info("  For AI:  read latest_report.json and summarize findings")
    logger.info("=" * 60)

    return 0


def _fmt_dur(seconds: float) -> str:
    if seconds < 3600:   return f"{seconds/60:.0f}m"
    if seconds < 86400:  return f"{seconds/3600:.1f}h"
    return f"{seconds/86400:.0f}d"


if __name__ == "__main__":
    sys.exit(main())
