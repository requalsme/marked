"""
The Marked — ReviewReportGenerator
Generates the visual/QOL/audio/game-feel review reports:
  - latest_visual_review.md   (human + AI readable)
  - latest_visual_review.json (structured, AI-friendly)
"""

import os
import json
import time
from datetime import datetime
from typing import Dict, Any, List


SEVERITY_ICON = {
    "critical": "🔴",
    "high":     "🟠",
    "medium":   "🟡",
    "low":      "⚪",
}

CATEGORY_LABELS = {
    "UX":          "UI / UX / Quality of Life",
    "audio":       "Audio / Sound / Music",
    "vfx":         "VFX / Visual Effects",
    "feel":        "Game Feel",
    "visual":      "Visuals / Graphics",
}


class ReviewReportGenerator:
    """Generates MD + JSON visual/QOL review reports."""

    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate(
        self,
        evidence,      # EvidencePackage
        real_elapsed: float,
    ) -> Dict[str, str]:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        json_report = self._build_json(evidence, ts, real_elapsed)
        json_path   = self._write_json(json_report)
        md_path     = self._write_markdown(json_report)
        return {"json": json_path, "markdown": md_path}

    # ─── JSON Report ──────────────────────────────────────────────────────────

    def _build_json(self, evidence, ts: str, real_elapsed: float) -> Dict[str, Any]:
        all_f = evidence.all_findings()
        by_sev = {s: [f for f in all_f if f.get("severity") == s]
                  for s in ("critical", "high", "medium", "low")}

        return {
            "meta": {
                "game":              "The Marked",
                "generated_at":      ts,
                "real_elapsed_sec":  round(real_elapsed, 1),
                "review_type":       "visual_qol_audio_gamefeel",
                "screenshot_mode":   evidence.screenshot_summary.get("live_mode", False),
            },
            "overall_summary": {
                "total_findings":      len(all_f),
                "critical":            len(by_sev["critical"]),
                "high":                len(by_sev["high"]),
                "medium":              len(by_sev["medium"]),
                "low":                 len(by_sev["low"]),
                "ux_findings":         len(evidence.ux_findings),
                "audio_findings":      len(evidence.audio_findings),
                "vfx_findings":        len(evidence.vfx_findings),
                "feel_findings":       len(evidence.feel_findings),
                "screenshots_total":   evidence.screenshot_summary.get("total", 0),
                "screenshots_live":    evidence.screenshot_summary.get("captured", 0),
                "screenshots_stub":    evidence.screenshot_summary.get("stubs", 0),
                "biggest_issues":      self._top_issues(by_sev),
                "screenshot_setup_errors": evidence.screenshot_summary.get("setup_errors", []),
            },
            "priority_fix_list": {
                "critical": [self._fmt_finding(f) for f in by_sev["critical"]],
                "high":     [self._fmt_finding(f) for f in by_sev["high"]],
                "medium":   [self._fmt_finding(f) for f in by_sev["medium"]],
                "low":      [self._fmt_finding(f) for f in by_sev["low"]],
            },
            "ux_findings":     evidence.ux_findings,
            "audio_findings":  evidence.audio_findings,
            "vfx_findings":    evidence.vfx_findings,
            "feel_findings":   evidence.feel_findings,
            "screenshots":     evidence.screenshots,
            "sim_summary":     evidence.sim_summary,
        }

    def _fmt_finding(self, f: Dict) -> Dict:
        return {
            "key":      f.get("key", ""),
            "category": f.get("category", ""),
            "issue":    f.get("issue", ""),
            "fix":      f.get("fix", ""),
        }

    def _top_issues(self, by_sev: Dict) -> List[str]:
        top = []
        for sev in ("critical", "high"):
            for f in by_sev[sev][:5]:
                top.append(f"[{sev.upper()}] [{f.get('category','').upper()}] {f.get('issue','')[:120]}")
        return top

    # ─── Markdown Report ──────────────────────────────────────────────────────

    def _write_markdown(self, r: Dict) -> str:
        path = os.path.join(self.output_dir, "latest_visual_review.md")
        md = self._render_markdown(r)
        with open(path, "w", encoding="utf-8") as f:
            f.write(md)
        return path

    def _write_json(self, r: Dict) -> str:
        path = os.path.join(self.output_dir, "latest_visual_review.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(r, f, indent=2, default=str)
        return path

    def _render_markdown(self, r: Dict) -> str:
        meta    = r["meta"]
        overall = r["overall_summary"]
        lines   = []

        def h(n, t):   lines.append(f"{'#'*n} {t}\n")
        def p(t):      lines.append(f"{t}\n")
        def sep():     lines.append("---\n")
        def bold(k,v): lines.append(f"**{k}:** {v}  ")
        def b(t):      lines.append(f"- {t}")
        def issue(f):
            icon = SEVERITY_ICON.get(f.get("severity","low"), "⚪")
            lines.append(f"> {icon} **[{f.get('severity','').upper()}]** [{f.get('category','').upper()}] {f.get('issue','')}")
            lines.append(f"> 💡 *Fix: {f.get('fix','')}*")
            lines.append("")

        h(1, "🩸 The Marked — Visual / QOL / Audio / Game Feel Review")
        p(f"*Generated: {meta['generated_at']} | Review Type: `{meta['review_type']}`*")
        sep()

        # Overview
        h(2, "📋 Review Summary")
        bold("Total Findings",  str(overall["total_findings"]))
        bold("🔴 Critical",     str(overall["critical"]))
        bold("🟠 High",         str(overall["high"]))
        bold("🟡 Medium",       str(overall["medium"]))
        bold("⚪ Low",          str(overall["low"]))
        bold("UX Issues",       str(overall["ux_findings"]))
        bold("Audio Issues",    str(overall["audio_findings"]))
        bold("VFX Issues",      str(overall["vfx_findings"]))
        bold("Game Feel",       str(overall["feel_findings"]))
        bold("Screenshots",     f"{overall['screenshots_live']} live / {overall['screenshots_stub']} stubs")
        p("")

        # Screenshot setup status
        ss_errors = overall.get("screenshot_setup_errors", [])
        if ss_errors:
            h(2, "📷 Screenshot Setup")
            for err in ss_errors:
                p(f"> ⚠️ {err}")
            p("")
            p("**To enable live screenshots:**")
            p("```bash")
            p("pip install playwright")
            p("playwright install chromium")
            p("npm run dev   # start the game server")
            p("python tools/simulation/run_sim.py --preset visual_qol_review")
            p("```")
            sep()

        # Critical issues
        if overall["critical"] > 0:
            h(2, "🔴 Critical Issues — Fix These First")
            for f in r["priority_fix_list"]["critical"]:
                issue(f)
            sep()

        # High priority
        if overall["high"] > 0:
            h(2, "🟠 High Priority Issues")
            for f in r["priority_fix_list"]["high"]:
                issue(f)
            sep()

        # Per-category sections
        self._render_category_section(lines, "UI / UX / Quality of Life", "UX",
                                      r["ux_findings"], h, issue, sep)
        self._render_category_section(lines, "Audio / Sound / Music", "AUDIO",
                                      r["audio_findings"], h, issue, sep)
        self._render_category_section(lines, "VFX / Visual Effects", "VFX",
                                      r["vfx_findings"], h, issue, sep)
        self._render_category_section(lines, "Game Feel", "FEEL",
                                      r["feel_findings"], h, issue, sep)

        # Screenshot manifest
        h(2, "📷 Screenshot Manifest")
        shots = r.get("screenshots", [])
        if shots:
            for shot in shots:
                sev_label = "✅ Captured" if shot["status"] == "captured" else "📋 Stub (manual capture needed)"
                h(3, f"{shot['label']} — `{shot['key']}`")
                p(f"**Status:** {sev_label}  ")
                p(f"**File:** `{shot['filename']}`  ")
                p(f"**Description:** {shot['description']}")
                if shot.get("inspect_for"):
                    p("**Inspect for:**")
                    for item in shot["inspect_for"]:
                        b(item)
                p("")
        sep()

        # Medium and low
        h(2, "🟡 Medium Priority Issues")
        med = r["priority_fix_list"]["medium"]
        if med:
            for f in med:
                issue(f)
        else:
            p("> ✅ No medium-priority issues.")
        sep()

        h(2, "⚪ Low Priority / Nice to Have")
        low = r["priority_fix_list"]["low"]
        if low:
            for f in low[:10]:  # cap at 10 to keep report readable
                issue(f)
            if len(low) > 10:
                p(f"*...and {len(low)-10} more low-priority items in the JSON report.*")
        else:
            p("> ✅ No low-priority issues.")
        sep()

        # Balance sim data
        sim = r.get("sim_summary", {})
        per_profile = sim.get("per_profile_results", {})
        if per_profile:
            h(2, "⚖️ Balance Simulation Summary (Quick Pass)")
            for profile, stats in per_profile.items():
                p(f"**{profile}:** deaths={stats.get('avg_deaths',0):.1f}, "
                  f"life={stats.get('avg_average_life_hours',0):.2f}h, "
                  f"rarity={stats.get('best_rarity_seen','?')}, "
                  f"rituals={stats.get('avg_rituals_used',0):.0f}")
            sep()

        # Footer
        p("*Report generated by The Marked Visual/QOL Review Harness.*")
        p("*Do not modify game assets, audio, UI, or VFX without explicit developer approval.*")

        return "\n".join(lines)

    def _render_category_section(self, lines, title, tag, findings, h, issue, sep):
        sev_order = ["critical", "high", "medium", "low"]
        sorted_findings = sorted(findings,
                                 key=lambda f: -{"critical":4,"high":3,"medium":2,"low":1}
                                 .get(f.get("severity","low"), 0))

        emoji = {"UX":"🖥️","AUDIO":"🔊","VFX":"✨","FEEL":"🎮"}.get(tag, "📌")
        h(2, f"{emoji} {title}")

        if not sorted_findings:
            lines.append("> ✅ No issues found in this category.\n")
        else:
            for f in sorted_findings:
                issue(f)
        sep()
