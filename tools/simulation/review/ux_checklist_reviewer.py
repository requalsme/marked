"""
The Marked — UXChecklistReviewer
Analyzes UI/UX quality by static inspection of source files.

This reviewer reads the actual game source code to detect UX problems
WITHOUT needing to run the browser. It inspects:
  - index.html: DOM structure, IDs, font sizes, layout
  - src/ui.js:  Tooltip coverage, button states, feedback logic
  - src/canvas.js: In-world UI prompts, HUD completeness
  - src/main.js: Screen state transitions, feedback messages
  - src/state.js: Data that should be displayed vs what is displayed
  - CSS: Font sizes, contrast, readability

All findings are structured findings that feed into the final report.
"""

import os
import re
import sys
from typing import List, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


SEVERITY = {
    "critical": 4,
    "high":     3,
    "medium":   2,
    "low":      1,
}


class UXChecklistReviewer:
    """
    Static-analysis based UX reviewer.
    Reads source files to detect UX problems.
    """

    def __init__(self, project_root: str):
        self.root = project_root
        self.findings: List[Dict[str, Any]] = []

    def run(self) -> List[Dict[str, Any]]:
        """Run all UX checks. Returns list of findings."""
        self.findings = []

        self._check_tooltip_coverage()
        self._check_button_feedback()
        self._check_hud_completeness()
        self._check_death_communication()
        self._check_action_proximity_requirements()
        self._check_currency_legibility()
        self._check_sanity_visual_feedback()
        self._check_observation_feedback()
        self._check_upgrade_clarity()
        self._check_signal_panel_ux()
        self._check_corpse_panel_ux()
        self._check_idle_reward_communication()
        self._check_empty_states()
        self._check_interactable_prompts()
        self._check_boss_ui()
        self._check_font_sizes()
        self._check_click_to_equip_clarity()

        return sorted(self.findings, key=lambda x: -SEVERITY.get(x["severity"], 0))

    # ─── Checks ───────────────────────────────────────────────────────────────

    def _check_tooltip_coverage(self):
        """Check which interactive elements have tooltips."""
        ui_src = self._read("src/ui.js")
        if not ui_src:
            return

        # Inventory items have tooltips via mouseenter
        has_inv_tooltip = "showTooltip" in ui_src and "mouseenter" in ui_src
        # Check if upgrade buttons have tooltips
        upg_has_title = 'btn.title' in ui_src or 'btn.setAttribute("title"' in ui_src
        # Check ritual buttons
        ritual_has_title = 'btn.title = "You must be standing' in ui_src

        if not has_inv_tooltip:
            self._add("critical", "UX", "tooltip_missing_inventory",
                "Inventory items have no tooltip on hover.",
                "Add mouseenter tooltips to all inventory slots showing item name, rarity, and stats comparison.")

        if not upg_has_title:
            self._add("medium", "UX", "tooltip_missing_upgrades",
                "Upgrade buttons have no tooltip explaining what the upgrade does.",
                "Add tooltip/title attributes to each upgrade button with effect description and current level.")

        # Check if 'affix' field is always shown in tooltip
        if "item.affix" in ui_src and "affix.label" in ui_src:
            # Good — affixes shown
            pass
        else:
            self._add("medium", "UX", "tooltip_affix_missing",
                "Item affixes (secondary stats) may not be shown in tooltip.",
                "Ensure item.affix.label is always displayed in the tooltip if present.")

        # Check if 'desc' field is in tooltip
        if "item.desc" not in ui_src:
            self._add("high", "UX", "tooltip_no_flavor_text",
                "Item flavor text (item.desc) is not shown in tooltips.",
                "Add item.desc as flavor text in the tooltip — this is critical for atmosphere and lore.")

    def _check_button_feedback(self):
        """Check if buttons give visual/audio feedback on click."""
        ui_src = self._read("src/ui.js")
        main_src = self._read("src/main.js")

        if not ui_src:
            return

        # Check for audio on button clicks
        has_audio_feedback = "AudioContext" in (main_src or "") or "playSound" in (main_src or "") or "audio" in (main_src or "").lower()
        if not has_audio_feedback:
            self._add("high", "UX", "no_button_audio_feedback",
                "Buttons produce no audio feedback on click. UI feels silent and unresponsive.",
                "Add a subtle click sound to all .game-btn elements via a shared audio manager.")

        # Check if disabled state is shown
        if "btn.disabled" in ui_src:
            pass  # good
        else:
            self._add("medium", "UX", "button_disabled_state_unclear",
                "Some buttons may not have a clear disabled visual state.",
                "Ensure disabled buttons are greyed out via CSS [disabled] selector with reduced opacity.")

        # Check error message pattern for actions that fail
        if "Inventory FULL" in ui_src or "signals.unshift" in ui_src:
            pass  # game shows text feedback
        else:
            self._add("medium", "UX", "no_error_feedback",
                "Failed actions (e.g., can't afford, inventory full) may have no visible feedback.",
                "Add a brief on-screen error toast or canvas HUD message for all failed action attempts.")

    def _check_hud_completeness(self):
        """Check the HUD covers all critical player information."""
        ui_src = self._read("src/ui.js")
        html_src = self._read("index.html")

        if not html_src:
            return

        required_ids = [
            ("hud-hp-bar",      "HP bar"),
            ("hud-sanity-bar",  "Sanity bar"),
            ("hud-obs-bar",     "Observation bar"),
            ("hud-level",       "Level display"),
            ("hud-gold",        "Gold display"),
            ("hud-parchment",   "Parchment display"),
            ("hud-ink",         "Ink display"),
            ("hud-seal",        "Wax Seals display"),
        ]

        for el_id, label in required_ids:
            if f'id="{el_id}"' not in html_src and f"id='{el_id}'" not in html_src:
                self._add("high", "UX", f"hud_missing_{el_id}",
                    f"HUD element '{label}' (#{el_id}) not found in index.html.",
                    f"Add a #{el_id} element to the HUD panel with appropriate label and styling.")

        # Check if observation diagnosis is shown
        if "hud-obs-diag" not in html_src:
            self._add("medium", "UX", "hud_missing_obs_diagnosis",
                "Observation diagnosis label (#hud-obs-diag) missing from HUD. Players can't see their behavioral diagnosis.",
                "Add the diagnosis text below the observation bar in the HUD.")

        # Tarot card displayed
        if "tarot-box" not in html_src:
            self._add("high", "UX", "hud_missing_tarot",
                "Tarot card box (#tarot-box) not in HUD. Active Tarot card is not visible to the player.",
                "Add the tarot card display widget to the HUD panel.")

    def _check_death_communication(self):
        """Check if death cause is communicated clearly."""
        ui_src = self._read("src/ui.js")
        main_src = self._read("src/main.js")
        combined = (ui_src or "") + (main_src or "")

        if "death" in combined.lower():
            # Check if cause of death is shown
            has_cause = "cause" in combined or "killed by" in combined.lower() or "death_cause" in combined.lower()
            if not has_cause:
                self._add("high", "UX", "death_cause_not_shown",
                    "Player death screen may not clearly display the cause of death.",
                    "Show a 'You were killed by [enemy/cause]' message on the death/game-over screen.")
        else:
            self._add("critical", "UX", "death_screen_unclear",
                "Death/game-over screen handling not clearly visible in source.",
                "Ensure a clear death screen exists with cause, stats summary, and restart/return options.")

        # Check for death screen button clarity
        if "game-over" in combined.lower() or "gameState" in combined:
            if "restart" not in combined.lower() and "play again" not in combined.lower() and "return" not in combined.lower():
                self._add("high", "UX", "death_screen_no_restart_cta",
                    "Death screen may not have a clearly labeled restart/return button.",
                    "Add prominent 'Play Again' and 'Return to Title' buttons on the death screen.")

    def _check_action_proximity_requirements(self):
        """Check if proximity requirements for rituals/corpses are clearly explained."""
        ui_src = self._read("src/ui.js")
        if not ui_src:
            return

        # Ritual altar proximity
        if "must be standing next to the Altar" in ui_src:
            pass  # good — tooltip exists
        else:
            self._add("high", "UX", "ritual_proximity_unclear",
                "Ritual altar proximity requirement may not be clearly communicated to the player.",
                "Add a visible 'Approach the altar in the room to unlock rituals' message in the rituals panel, not just a tooltip.")

        # Corpse proximity
        if "stand close to interact" in ui_src or "find this corpse" in ui_src:
            pass  # good
        else:
            self._add("medium", "UX", "corpse_proximity_unclear",
                "Corpse interaction proximity requirement may be unclear.",
                "Add a clear instruction in the corpse panel: 'Find the ☠ symbol in the room and walk close to it.'")

        # Check if proximity is communicated in-world (canvas prompt)
        canvas_src = self._read("src/canvas.js")
        if canvas_src and "[E]" in canvas_src:
            pass  # good — canvas shows [E] USE prompt
        else:
            self._add("critical", "UX", "no_world_interaction_prompt",
                "No in-world prompt visible when approaching interactables.",
                "Add a canvas-drawn '[E] USE' label above interactables when player is within range.")

    def _check_currency_legibility(self):
        """Check if all currencies have clear icons and labels."""
        html_src = self._read("index.html")
        if not html_src:
            return

        currencies = ["gold", "parchment", "ink", "seal"]
        labels_found = [c for c in currencies if c in html_src.lower()]

        if len(labels_found) < 4:
            missing = [c for c in currencies if c not in labels_found]
            self._add("medium", "UX", "currency_display_incomplete",
                f"Currency display missing: {missing}. Players may not see all resource counts.",
                "Ensure all 4 currencies (Gold, Parchment, Ink, Wax Seals) have labeled HUD elements with icon/sprite.")

        # Check if currencies have explanatory labels (not just numbers)
        if "parchment" in html_src.lower() and "ink" in html_src.lower():
            # Check for a label/icon next to the number
            if 'title="' not in html_src and 'aria-label' not in html_src:
                self._add("low", "UX", "currency_no_label_tooltip",
                    "Currency icons/numbers may lack tooltips explaining what they are (Parchment, Ink, Wax Seals).",
                    "Add title attributes or hover tooltips to currency displays: 'Parchment — used for Monolith Body upgrade'.")

    def _check_sanity_visual_feedback(self):
        """Check sanity visual feedback is multi-layered."""
        ui_src = self._read("src/ui.js")
        canvas_src = self._read("src/canvas.js")
        systems_src = self._read("src/systems.js")
        html_src = self._read("index.html")
        combined = (ui_src or "") + (canvas_src or "") + (systems_src or "")

        layers_found = []
        if "sanity-broken" in combined:  layers_found.append("CSS class on body")
        if "corruptText" in combined:    layers_found.append("text corruption")
        if "darkness" in combined:       layers_found.append("lighting darkens")
        if "lanternSize" in combined:    layers_found.append("lantern shrinks at low sanity")

        if len(layers_found) < 3:
            self._add("medium", "UX", "sanity_feedback_insufficient",
                f"Sanity feedback only has {len(layers_found)} visual layers: {layers_found}. "
                "Players may not feel the urgency of low sanity.",
                "Add at least: vignette intensifies, sound distortion begins, screen edges flicker at < 30 sanity.")
        else:
            self._add("low", "UX", "sanity_feedback_review",
                f"Sanity has {len(layers_found)} visual layers ({', '.join(layers_found)}). "
                "Review: are all layers readable at a glance without overwhelming the player?",
                "Ensure sanity-broken CSS state doesn't make the game unplayable (key UI still readable).")

        # Check if sanity impacts audio (expected finding: it doesn't)
        has_sanity_audio = "AudioContext" in combined or "sanityAudio" in combined
        if not has_sanity_audio:
            self._add("high", "UX", "sanity_no_audio_feedback",
                "Sanity degradation has no audio feedback. The horror atmosphere is significantly weakened.",
                "Add ambient horror audio that distorts/intensifies as sanity drops. "
                "Even a simple low-pass filter on background audio achieves this.")

    def _check_observation_feedback(self):
        """Check observation system is communicated to the player."""
        canvas_src = self._read("src/canvas.js")
        ui_src = self._read("src/ui.js")
        combined = (canvas_src or "") + (ui_src or "")

        # Monolith visual exists
        if "drawMonolithRunes" in combined:
            pass

        # Check if threshold events have UI pop-up
        systems_src = self._read("src/systems.js")
        if systems_src and "Noticed" in systems_src:
            # Threshold names exist — check if shown to player
            if "signals.unshift" in systems_src or "signal" in systems_src.lower():
                pass  # using signal feed as notification
            else:
                self._add("high", "UX", "observation_threshold_no_alert",
                    "Observation threshold events (Noticed/Studied/Modeled/Known) may not visually alert the player.",
                    "Add a canvas-overlay notification popup for each observation threshold: 'THE MONOLITH NOTICED YOU'.")
        else:
            self._add("high", "UX", "observation_thresholds_invisible",
                "Observation threshold transitions are not communicated to the player.",
                "Add dramatic visual alerts at 25%, 50%, 75%, 100% observation thresholds.")

    def _check_upgrade_clarity(self):
        """Check if upgrade costs and effects are clear."""
        ui_src = self._read("src/ui.js")
        if not ui_src:
            return

        # Upgrades are rendered in renderMonolithUpgrades
        if "renderMonolithUpgrades" in ui_src:
            # Check if max level is shown
            if "MAX" not in ui_src and "max_level" not in ui_src and "maxed" not in ui_src.lower():
                self._add("medium", "UX", "upgrade_no_max_level_indicator",
                    "Upgrade buttons don't clearly show when an upgrade is at maximum level.",
                    "Show 'MAXED' or change button to 'MAX LEVEL' state with distinct styling when upgrade cap is reached.")

            # Check if current progress is shown
            if "Level ${profile.upgrades." in ui_src:
                pass  # good — level shown in upgrade title

            # Check cost scaling is visible
            if "nextCost" in ui_src:
                pass  # good — cost scales
            else:
                self._add("medium", "UX", "upgrade_cost_not_scaling",
                    "Upgrade cost scaling may not be visible to the player.",
                    "Display both current cost and the next tier cost to help players plan ahead.")

    def _check_signal_panel_ux(self):
        """Check signal/transmission panel UX."""
        ui_src = self._read("src/ui.js")
        if not ui_src or "renderSignals" not in ui_src:
            self._add("critical", "UX", "signals_panel_missing",
                "Signal panel renderSignals() not found.",
                "Implement the signals panel to display intercepted transmissions.")
            return

        # Check if signals are typed/categorized in the display
        if "Warning Signal" in ui_src or "Memory Signal" in ui_src:
            pass
        else:
            self._add("medium", "UX", "signal_types_not_distinguished",
                "Signal types (Warning, Memory, False, Watcher) may not be visually distinguished in the panel.",
                "Add color coding per signal type: Warning=orange, Memory=blue, False=grey, Watcher=red.")

        # Check scrolling
        if "overflow" in ui_src or "scroll" in ui_src.lower():
            pass
        else:
            self._add("low", "UX", "signal_panel_no_scroll_indicator",
                "Signal list may not indicate it's scrollable when many signals exist.",
                "Add a subtle 'scroll to see more' indicator when the list overflows.")

    def _check_corpse_panel_ux(self):
        """Check corpse panel UX."""
        ui_src = self._read("src/ui.js")
        if not ui_src or "renderCorpses" not in ui_src:
            self._add("critical", "UX", "corpse_panel_missing",
                "Corpse panel renderCorpses() not found.",
                "Implement the corpse registry panel.")
            return

        # Check empty state
        if "No corpses currently" in ui_src or "empty-msg" in ui_src:
            pass  # good
        else:
            self._add("low", "UX", "corpse_panel_no_empty_state",
                "Corpse panel has no empty state message when no corpses exist.",
                "Add an 'empty registry' message for new players who haven't died yet.")

        # Check if action rewards are in the button text
        if "Recover (Gold)" in ui_src and "Burn (Sanity)" in ui_src:
            pass  # good — rewards in button labels
        else:
            self._add("medium", "UX", "corpse_action_rewards_unclear",
                "Corpse action buttons don't show rewards inline (e.g., 'Recover (Gold)').",
                "Add parenthetical reward/cost to each corpse action button label.")

    def _check_idle_reward_communication(self):
        """Check if idle/offline rewards are clearly presented."""
        main_src = self._read("src/main.js")
        idle_src = self._read("src/idle.js")

        if not main_src:
            return

        # Check for offline report screen
        has_offline_screen = "offline_report" in main_src or "offlineReport" in main_src or "calculateOfflineProgress" in main_src
        if has_offline_screen:
            # Check if all gains are itemized
            if "gold" in main_src and "parchment" in main_src:
                pass
            else:
                self._add("medium", "UX", "idle_reward_not_itemized",
                    "Idle reward screen may not itemize all gains (gold, parchment, ink, wax).",
                    "Show a full breakdown: '2h 15m away: +450 gold, +3 parchment, +2 ink, -18 sanity, +3.2% observation'.")

            # Check if sanity drain during idle is shown
            if "sanity" not in (idle_src or "").lower():
                self._add("medium", "UX", "idle_sanity_drain_not_shown",
                    "Sanity drain during idle/offline may not be shown in the return summary.",
                    "Always show sanity delta (positive or negative) in the offline reward screen.")

            # Check if observation gain during idle is shown
            if "observation" not in (idle_src or "").lower():
                self._add("high", "UX", "idle_observation_gain_not_shown",
                    "Observation gain during idle may not be communicated. Players may be unaware the Monolith watches during offline.",
                    "Highlight observation change in idle report: 'The Monolith's eye shifted +2.4% while you were away.'")
        else:
            self._add("high", "UX", "no_idle_reward_screen",
                "No offline progress report screen found. Players have no feedback on idle gains.",
                "Add a post-idle popup showing all gains/losses since last session.")

    def _check_empty_states(self):
        """Check all panels have proper empty states."""
        ui_src = self._read("src/ui.js")
        if not ui_src:
            return

        panels = {
            "inventory": "slot-empty" in ui_src,
            "signals":   "No signals" in ui_src or "empty-msg" in ui_src,
            "corpses":   "No corpses" in ui_src or "empty-msg" in ui_src,
            "monolith":  True,  # always has content
        }

        for panel, has_empty in panels.items():
            if not has_empty:
                self._add("low", "UX", f"empty_state_missing_{panel}",
                    f"Panel '{panel}' may lack an empty state message for new players.",
                    f"Add a helpful empty state to the {panel} panel explaining how to get items there.")

    def _check_interactable_prompts(self):
        """Check in-world interaction prompts."""
        canvas_src = self._read("src/canvas.js")
        if not canvas_src:
            return

        # [E] USE label
        if "[E]" in canvas_src:
            pass  # good

        # Check label is small enough to read but big enough to see
        if '"10px' in canvas_src or '"10px Courier' in canvas_src:
            self._add("medium", "UX", "interaction_prompt_small_font",
                "In-world interaction prompt '[E] USE' is rendered at 10px — may be too small on high-res displays.",
                "Increase interaction prompt font to 11–12px and add a slight background fill for contrast.")

    def _check_boss_ui(self):
        """Check boss encounter HUD quality."""
        canvas_src = self._read("src/canvas.js")
        if not canvas_src:
            return

        if "SEAL MOTHER" in canvas_src:
            # Boss bar exists
            if "barW = 400" in canvas_src:
                # Check width is responsive
                pass

            # Check if boss name is distinguishable from other text
            if "Cinzel" in canvas_src or "boss" in canvas_src.lower():
                pass

            # Check if boss health percentage is shown (not just bar)
            if "pct" in canvas_src and "boss" in canvas_src.lower():
                # Bar exists but no percentage text
                if '"%"' not in canvas_src and "toFixed" not in canvas_src:
                    self._add("low", "UX", "boss_bar_no_pct_text",
                        "Boss health bar doesn't show a % text value, only the bar fill.",
                        "Add a health % text next to the boss health bar: 'SEAL MOTHER — 73%'.")

            # Check if boss encounter is announced
            if "boss_spawn" not in canvas_src.lower() and "SEAL MOTHER appears" not in canvas_src:
                self._add("medium", "UX", "boss_no_announcement",
                    "Seal Mother appears with no dramatic announcement. Boss encounter lacks impact.",
                    "Add a full-screen dramatic title card: 'SEAL MOTHER — ARCHIVE CORE CURSE' on spawn, similar to Souls games.")
        else:
            self._add("high", "UX", "boss_ui_missing",
                "Boss health bar not found in canvas renderer.",
                "Add a boss health bar to the canvas HUD for all elite/boss encounters.")

    def _check_font_sizes(self):
        """Check for font sizes that may be too small."""
        canvas_src = self._read("src/canvas.js")
        html_src = self._read("index.html")
        css_files = self._find_css_files()

        # Check canvas font sizes
        if canvas_src:
            small_fonts = re.findall(r'"(\d+)px', canvas_src)
            tiny = [int(s) for s in small_fonts if int(s) < 10]
            if tiny:
                self._add("high", "UX", "canvas_text_too_small",
                    f"Canvas text rendered at {tiny}px — illegible at standard display sizes.",
                    "Minimum canvas text size should be 11px. Monolith rune text 'EYE/SEAL/DEBT' at 9px needs to be 11px.")

        # Check CSS for small text
        for css_path in css_files:
            css_src = self._read_abs(css_path)
            if css_src:
                small = re.findall(r'font-size:\s*(\d+)px', css_src)
                tiny_css = [int(s) for s in small if int(s) < 11]
                if tiny_css:
                    self._add("medium", "UX", "css_text_small",
                        f"CSS contains font-size values of {tiny_css}px — potentially too small for readability.",
                        "Set minimum font size to 11px across all game UI elements. Exception: special decorative labels.")

    def _check_click_to_equip_clarity(self):
        """Check if click-to-equip mechanic is communicated."""
        ui_src = self._read("src/ui.js")
        if not ui_src:
            return

        has_click_equip = "click" in ui_src and "equipItem" in ui_src
        has_equip_label = "click to equip" in ui_src.lower() or "equip" in ui_src.lower()

        if has_click_equip and not "Click" in ui_src:
            self._add("medium", "UX", "equip_click_not_communicated",
                "Inventory items are click-to-equip but the interface doesn't clearly communicate this.",
                "Add a '[Click to Equip]' label to inventory item tooltips, or add a one-time tutorial prompt in the inventory panel.")

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _add(self, severity: str, category: str, key: str, issue: str, fix: str):
        self.findings.append({
            "severity": severity,
            "category": category,
            "key":      key,
            "issue":    issue,
            "fix":      fix,
        })

    def _read(self, rel_path: str) -> str:
        full = os.path.join(self.root, rel_path)
        if not os.path.exists(full):
            return ""
        try:
            with open(full, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except Exception:
            return ""

    def _read_abs(self, path: str) -> str:
        if not os.path.exists(path):
            return ""
        try:
            with open(path, "r", encoding="utf-8", errors="replace") as f:
                return f.read()
        except Exception:
            return ""

    def _find_css_files(self) -> List[str]:
        results = []
        for dirpath, _, files in os.walk(self.root):
            if ".git" in dirpath or "node_modules" in dirpath or "simulation" in dirpath:
                continue
            for fn in files:
                if fn.endswith(".css"):
                    results.append(os.path.join(dirpath, fn))
        return results
