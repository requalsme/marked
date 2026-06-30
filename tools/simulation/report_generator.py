"""
The Marked — ReportGenerator
Converts raw simulation results + analysis findings into:
  - latest_report.md  (human-readable)
  - latest_report.json (AI-agent-readable)
  - latest_timeline.csv (time-series data)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import time
from datetime import datetime
from typing import Dict, Any, List


class ReportGenerator:
    """Generates Markdown and JSON reports from simulation results."""

    def __init__(self, output_dir: str = "tools/simulation/reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate(
        self,
        batch_config:       Dict[str, Any],
        per_profile_summary: Dict[str, Dict[str, Any]],
        findings:           Dict[str, Any],
        all_runs:           List[Dict[str, Any]],
        real_elapsed:       float,
    ) -> Dict[str, str]:
        """
        Generate all report files. Returns dict of file paths.
        """
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        full_report = self._build_json_report(
            batch_config, per_profile_summary, findings, all_runs, ts, real_elapsed
        )

        json_path = self._write_json(full_report)
        md_path   = self._write_markdown(full_report)

        return {
            "json":     json_path,
            "markdown": md_path,
        }

    def _build_json_report(
        self,
        batch_config:        Dict[str, Any],
        per_profile_summary: Dict[str, Dict[str, Any]],
        findings:            Dict[str, Any],
        all_runs:            List[Dict[str, Any]],
        timestamp:           str,
        real_elapsed:        float,
    ) -> Dict[str, Any]:
        duration_h = batch_config.get("duration_seconds", 3600) / 3600
        n_runs     = len(all_runs)
        profiles   = batch_config.get("profiles", [])
        seeds      = batch_config.get("seeds", [])

        return {
            "meta": {
                "game":              "The Marked",
                "generated_at":      timestamp,
                "real_elapsed_sec":  round(real_elapsed, 1),
                "mode":              batch_config.get("mode", "mock_mode"),
                "preset":            batch_config.get("preset", "custom"),
                "sim_duration_hours": round(duration_h, 2),
                "total_runs":        n_runs,
                "profiles_tested":   profiles,
                "seeds_used":        seeds,
                "report_tags":       batch_config.get("report_tags", []),
            },
            "overall_summary": self._build_overall_summary(per_profile_summary, findings),
            "per_profile_results": per_profile_summary,
            "balance_warnings":    findings.get("balance_warnings", []),
            "exploit_findings":    findings.get("exploit_findings", []),
            "unused_systems":      findings.get("unused_systems", []),
            "overused_systems":    findings.get("overused_systems", []),
            "pacing_problems":     findings.get("pacing_problems", []),
            "strongest_strategies": findings.get("strongest_strategies", []),
            "weakest_systems":     findings.get("weakest_systems", []),
            "suggested_fixes":     findings.get("suggested_fixes", []),
            "raw_runs":            all_runs,
        }

    def _build_overall_summary(
        self,
        summary: Dict[str, Dict],
        findings: Dict[str, Any],
    ) -> Dict[str, Any]:
        total_deaths   = sum(s.get("avg_deaths", 0) for s in summary.values())
        total_exploits = sum(len(s.get("exploit_flags", [])) for s in summary.values())
        total_warnings = len(findings.get("balance_warnings", []))
        total_unused   = len(findings.get("unused_systems", []))

        most_dangerous = max(summary.items(), key=lambda x: x[1].get("avg_deaths", 0),
                             default=("none", {}))[0]
        safest         = min(summary.items(), key=lambda x: x[1].get("avg_deaths", 0),
                             default=("none", {}))[0]

        return {
            "total_balance_warnings":   total_warnings,
            "total_exploit_flags":      total_exploits,
            "total_unused_systems":     total_unused,
            "most_dangerous_profile":   most_dangerous,
            "safest_profile":           safest,
            "critical_issues":          self._critical_issues(findings),
        }

    def _critical_issues(self, findings: Dict) -> List[str]:
        """Highlight the most important issues for AI scanning."""
        issues = []
        for w in findings.get("balance_warnings", []):
            if w["type"] in ("death_rate_too_high", "observation_maxed_too_fast",
                             "idle_dominates_active", "sanity_critically_high_drain"):
                issues.append(f"[CRITICAL] {w['message']}")
        for e in findings.get("exploit_findings", []):
            issues.append(f"[EXPLOIT] {e['message']}")
        for p in findings.get("pacing_problems", []):
            issues.append(f"[PACING] {p['message']}")
        return issues

    # ─── Writers ──────────────────────────────────────────────────────────────

    def _write_json(self, report: Dict) -> str:
        path = os.path.join(self.output_dir, "latest_report.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, default=str)
        return path

    def _write_markdown(self, report: Dict) -> str:
        path = os.path.join(self.output_dir, "latest_report.md")
        md   = self._render_markdown(report)
        with open(path, "w", encoding="utf-8") as f:
            f.write(md)
        return path

    def _render_markdown(self, r: Dict) -> str:
        meta    = r["meta"]
        overall = r["overall_summary"]
        lines   = []

        def h(level, text):     lines.append(f"{'#' * level} {text}\n")
        def p(text):            lines.append(f"{text}\n")
        def sep():              lines.append("---\n")
        def bold(k, v):         lines.append(f"**{k}:** {v}  ")
        def bullet(text):       lines.append(f"- {text}")
        def warn(text):         lines.append(f"> ⚠️  {text}")
        def exploit(text):      lines.append(f"> 🔴 {text}")
        def fix(text):          lines.append(f"> 💡 {text}")
        def good(text):         lines.append(f"> ✅ {text}")

        h(1, "🩸 The Marked — Simulation Report")
        p(f"*Generated: {meta['generated_at']} | Mode: `{meta['mode']}` | Preset: `{meta['preset']}`*")
        sep()

        h(2, "📋 Run Summary")
        bold("Sim Duration",   f"{meta['sim_duration_hours']:.1f} simulated hours")
        bold("Real Runtime",   f"{meta['real_elapsed_sec']:.1f} seconds")
        bold("Total Runs",     str(meta['total_runs']))
        bold("Profiles Tested", ", ".join(meta['profiles_tested']))
        bold("Seeds Used",     str(meta['seeds_used']))
        bold("Tags",           ", ".join(meta['report_tags']) or "none")
        p("")

        # Critical issues at the top
        critical = overall.get("critical_issues", [])
        if critical:
            h(2, "🔴 Critical Issues (Read First)")
            for issue in critical:
                p(f"```\n{issue}\n```")
            sep()

        h(2, "📊 Overall Findings")
        bold("Balance Warnings",   str(overall['total_balance_warnings']))
        bold("Exploit Flags",      str(overall['total_exploit_flags']))
        bold("Unused Systems",     str(overall['total_unused_systems']))
        bold("Most Dangerous Profile", overall['most_dangerous_profile'])
        bold("Safest Profile",     overall['safest_profile'])
        p("")
        sep()

        h(2, "🧑‍💻 Per-Profile Results")
        for profile, stats in r["per_profile_results"].items():
            h(3, f"Profile: `{profile}`")
            bold("Avg Deaths",          stats.get("avg_deaths", 0))
            bold("Avg Level",           stats.get("avg_level", 0))
            bold("Avg Longest Life",    f"{stats.get('avg_longest_life_hours', 0):.2f}h")
            bold("Avg Avg Life",        f"{stats.get('avg_average_life_hours', 0):.2f}h")
            bold("Enemies Defeated",    stats.get("avg_enemies_defeated", 0))
            bold("Bosses Attempted",    stats.get("avg_bosses_attempted", 0))
            bold("Rituals Used",        stats.get("avg_rituals_used", 0))
            bold("Signals Found",       stats.get("avg_signals_found", 0))
            bold("Idle Sessions",       stats.get("avg_idle_sessions", 0))
            bold("Gold Idle/Active Ratio", stats.get("gold_idle_vs_active_ratio", "?"))
            bold("Best Rarity Seen",    stats.get("best_rarity_seen", "?"))
            bold("Diagnosis Mode",      ", ".join(stats.get("diagnosis_modes", [])[:2]))
            p("")

            top_deaths = stats.get("top_death_causes", [])
            if top_deaths:
                p("**Top Death Causes:**")
                for dc in top_deaths:
                    bullet(dc)
                p("")

            if stats.get("exploit_flags"):
                for ef in stats["exploit_flags"]:
                    exploit(f"Exploit detected: {ef}")
            p("")

        sep()
        h(2, "⚠️ Balance Warnings")
        warnings = r.get("balance_warnings", [])
        if warnings:
            for w in warnings:
                warn(f"[{w['profile']}] **{w['type']}** — {w['message']}")
                p("")
        else:
            good("No balance warnings flagged.")
        p("")

        sep()
        h(2, "🔴 Exploit Findings")
        exploits = r.get("exploit_findings", [])
        if exploits:
            for e in exploits:
                exploit(f"[{e['profile']}] {e['flag']}: {e['message']}")
                p("")
        else:
            good("No exploit patterns detected.")
        p("")

        sep()
        h(2, "🏆 Strongest Strategies Found")
        strategies = r.get("strongest_strategies", [])
        if strategies:
            for s in strategies:
                bullet(f"**{s['profile']}** — {s['strategy']}: {s['message']}")
        else:
            p("*No dominant strategies identified in this run.*")
        p("")

        sep()
        h(2, "📭 Systems Ignored / Underused")
        unused = r.get("unused_systems", [])
        if unused:
            for u in unused:
                warn(f"[{u['profile']}] `{u['system']}` — {u['message']}")
                p("")
        else:
            good("All major systems received meaningful interaction.")
        p("")

        sep()
        h(2, "⏱ Pacing Problems")
        pacing = r.get("pacing_problems", [])
        if pacing:
            for pp in pacing:
                warn(f"**{pp['type']}** — {pp['message']}")
                p("")
        else:
            good("No pacing problems detected at this run length.")
        p("")

        sep()
        h(2, "💡 Suggested Design Fixes")
        fixes = r.get("suggested_fixes", [])
        if fixes:
            seen = set()
            for f in fixes:
                if f not in seen:
                    fix(f)
                    p("")
                    seen.add(f)
        else:
            good("No fixes suggested.")
        p("")

        sep()
        h(2, "🔁 Reproducible Seeds")
        seeds = meta.get("seeds_used", [])
        if seeds:
            p("Use these seeds to reproduce any specific run for debugging:")
            for seed in seeds:
                p(f"```\npython tools/simulation/run_sim.py --seeds {seed} --profiles all\n```")
        p("")

        sep()
        p("*Report generated by The Marked Simulation Harness. "
          "Do not edit game balance values without explicit approval.*")

        return "\n".join(lines)
