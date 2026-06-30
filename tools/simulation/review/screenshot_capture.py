"""
The Marked — ScreenshotCapture
Handles browser screenshot capture during visual review runs.

This module has two operational modes:
  1. LIVE MODE (Playwright) — actually opens the game in a headless browser
     and captures screenshots at key moments. Requires:
       pip install playwright
       playwright install chromium

  2. STUB MODE (fallback) — when Playwright is unavailable or the game
     server isn't running. Creates placeholder screenshot records with
     TODO instructions so the review report still shows the structure
     and which screenshots need to be captured manually.

Key gameplay moments captured (in order):
  MOMENT_KEYS = [
      "game_start", "first_combat", "first_loot_drop", "first_death",
      "first_ritual", "sanity_strain", "sanity_fractured", "sanity_broken",
      "observation_25pct", "observation_75pct", "inventory_open",
      "upgrade_screen", "boss_encounter", "boss_defeated",
      "idle_reward_claim", "run_end", "signals_panel", "corpse_panel",
      "death_screen", "low_health_state"
  ]

Connection protocol:
  - Game server: http://localhost:8080 (npm run dev)
  - Screenshot is taken after a short stabilization delay
  - Canvas element + DOM overlay are both captured as a composite
"""

import os
import sys
import time
import json
import shutil
from typing import List, Dict, Any, Optional
from datetime import datetime

# ─── Moment Definitions ───────────────────────────────────────────────────────

SCREENSHOT_MOMENTS = [
    {
        "key":         "game_start",
        "label":       "Game Start / Title Screen",
        "description": "The first thing the player sees. Check title readability, visual tone, and navigation clarity.",
        "timing_hint": "Capture immediately on page load before any interaction.",
        "url_state":   "title",
        "inspect_for": [
            "Is the title clearly legible?",
            "Is the horror tone established immediately?",
            "Can the player tell what to click to start?",
            "Are profile options visible and readable?",
            "Is font size appropriate?",
        ],
    },
    {
        "key":         "first_combat",
        "label":       "First Combat Encounter",
        "description": "The first time enemies appear. Check enemy visibility, player readability, and UI clarity.",
        "timing_hint": "Capture ~10 seconds after game start when first enemy appears.",
        "url_state":   "active",
        "inspect_for": [
            "Can you clearly see the player character?",
            "Can you clearly see the enemy?",
            "Is the health bar visible and readable?",
            "Is there hit feedback (screen shake, particle)?",
            "Is the combat area readable in the dark lighting?",
            "Are enemy types visually distinguishable?",
        ],
    },
    {
        "key":         "first_loot_drop",
        "label":       "First Loot Drop",
        "description": "A loot item on the ground. Check pickup visibility and feedback clarity.",
        "timing_hint": "Capture when a loot pickup appears on the floor.",
        "url_state":   "active",
        "inspect_for": [
            "Is the loot item visible on the dark floor?",
            "Is there a hover/glow effect indicating interactability?",
            "Is there a sound effect on pickup?",
            "Is the reward shown clearly after collection?",
            "Is the item name/rarity immediately communicated?",
        ],
    },
    {
        "key":         "first_death",
        "label":       "First Player Death",
        "description": "The death screen or death state. Check death feedback clarity and readability of cause.",
        "timing_hint": "Capture at the moment of player death or on the death screen.",
        "url_state":   "game_over",
        "inspect_for": [
            "Is it clear the player has died?",
            "Is the death cause clearly displayed?",
            "Is the death visual impactful enough to register?",
            "Are the options (restart, return to title) clearly presented?",
            "Is there a death sound/music sting?",
        ],
    },
    {
        "key":         "first_ritual",
        "label":       "First Ritual / Blood Bargain",
        "description": "The ritual panel open or ritual being executed. Check cost clarity and danger communication.",
        "timing_hint": "Capture when the ritual panel is open or during ritual execution.",
        "url_state":   "active",
        "inspect_for": [
            "Is the ritual cost clearly stated?",
            "Is the danger of the ritual communicated (red, warning language)?",
            "Is the ritual effect particle visible and thematic?",
            "Is the altar proximity requirement clearly explained?",
            "Does the UI communicate which rituals are available vs unavailable?",
        ],
    },
    {
        "key":         "sanity_strain",
        "label":       "Sanity Strained State (< 70 sanity)",
        "description": "The UI when sanity is between 40–70. Check if sanity pressure is visually communicated.",
        "timing_hint": "Capture when sanity drops below 70.",
        "url_state":   "active",
        "inspect_for": [
            "Is there a visible UI change indicating sanity strain?",
            "Is text corruption visible and legible enough to read?",
            "Is the sanity bar clearly showing a degraded state?",
            "Does the screen atmosphere shift (vignette, color shift)?",
            "Is this change alarming enough to prompt player action?",
        ],
    },
    {
        "key":         "sanity_broken",
        "label":       "Sanity Broken State (< 15 sanity)",
        "description": "The most extreme sanity state. Check if the UI is still functional under heavy corruption.",
        "timing_hint": "Capture when sanity drops below 15.",
        "url_state":   "active",
        "inspect_for": [
            "Is the UI still readable in broken state (key info visible)?",
            "Is the corruption effect impactful and fitting the horror tone?",
            "Can the player still read health bar and observation bar?",
            "Is there an audio change at broken sanity?",
            "Does the game still feel controllable or is it disorienting?",
        ],
    },
    {
        "key":         "observation_25pct",
        "label":       "Observation at 25% (Noticed Threshold)",
        "description": "The Monolith threshold moment. Check if crossing this threshold is communicated.",
        "timing_hint": "Capture when observation first crosses 25%.",
        "url_state":   "active",
        "inspect_for": [
            "Does anything change visually when observation crosses 25%?",
            "Is there a UI notification or in-world visual cue?",
            "Does the Monolith change appearance?",
            "Does the threat of The Monolith feel real or abstract?",
        ],
    },
    {
        "key":         "observation_75pct",
        "label":       "Observation at 75% (Modeled Threshold — High Danger)",
        "description": "Near-maximum observation. The Monolith should be visually menacing at this point.",
        "timing_hint": "Capture when observation crosses 75%.",
        "url_state":   "active",
        "inspect_for": [
            "Is the Monolith visually more prominent/intense at 75%?",
            "Is there a UI warning that danger is critical?",
            "Does the red observation bar stand out urgently?",
            "Is The Shape enemy visible or spawning?",
            "Does the game feel appropriately tense?",
        ],
    },
    {
        "key":         "inventory_open",
        "label":       "Inventory / Gear Panel Open",
        "description": "The inventory and equipment panel. Check gear comparison, slot readability, and usability.",
        "timing_hint": "Capture with the Inventory tab open and at least one item equipped.",
        "url_state":   "active",
        "inspect_for": [
            "Are equipped items clearly distinguishable from inventory items?",
            "Is the gear comparison tooltip readable?",
            "Is rarity color coding obvious at a glance?",
            "Is the 15-slot inventory grid scannable quickly?",
            "Is it obvious which slot items go in (weapon/armor/amulet)?",
            "Are stat labels clear (what is 'Obfuscation Mask' to a new player)?",
        ],
    },
    {
        "key":         "upgrade_screen",
        "label":       "Monolith Upgrade Screen",
        "description": "The upgrade panel. Check cost clarity, effect description, and progression readability.",
        "timing_hint": "Capture with the Monolith tab open.",
        "url_state":   "active",
        "inspect_for": [
            "Is the upgrade cost clearly stated (parchment, ink, wax)?",
            "Is the upgrade effect description understandable?",
            "Is it clear which currencies you need (tooltips on icons)?",
            "Is the current upgrade level displayed?",
            "Are disabled upgrades clearly greyed out with explanation?",
        ],
    },
    {
        "key":         "boss_encounter",
        "label":       "Boss Encounter — Seal Mother",
        "description": "The Seal Mother boss appearing. Check boss visibility, health bar, and danger communication.",
        "timing_hint": "Capture at the moment the Seal Mother appears.",
        "url_state":   "active",
        "inspect_for": [
            "Is the boss health bar visible at the top of the screen?",
            "Is the boss name 'SEAL MOTHER - ARCHIVE CORE CURSE' readable?",
            "Is the Seal Mother visually distinguished from normal enemies?",
            "Are boss attack patterns visible and readable?",
            "Is the wax trap AOE (if any) clearly indicated?",
            "Does the boss encounter feel like a dramatic event?",
        ],
    },
    {
        "key":         "idle_reward",
        "label":       "Idle / Offline Reward Screen",
        "description": "The offline progress report shown on return. Check reward clarity and communication.",
        "timing_hint": "Capture the offline reward popup/panel on game load.",
        "url_state":   "offline_report",
        "inspect_for": [
            "Is the time-away duration clearly shown?",
            "Are all rewards itemized (gold, parchment, exp)?",
            "Is the observation gain during offline communicated?",
            "Is the sanity drain during offline shown clearly?",
            "Is there a dismiss button that's clearly visible?",
        ],
    },
    {
        "key":         "signals_panel",
        "label":       "Signals Feed Panel",
        "description": "The signals/transmissions tab. Check log readability and visual quality of signal entries.",
        "timing_hint": "Capture with Signals tab open and at least 5 signals logged.",
        "url_state":   "active",
        "inspect_for": [
            "Is the signal feed scannable (good line spacing, contrast)?",
            "Is text corruption on signal text legible or unreadable?",
            "Are signal types (Warning, Memory, False) visually distinguished?",
            "Is there a clear empty state when no signals exist?",
            "Does the panel communicate that signal quality depends on sanity?",
        ],
    },
    {
        "key":         "corpse_panel",
        "label":       "Corpse Registry Panel",
        "description": "The corpse management tab. Check proximity requirement UX and action button clarity.",
        "timing_hint": "Capture with Corpse tab open and at least one corpse listed.",
        "url_state":   "active",
        "inspect_for": [
            "Is it clear that you need to physically stand near a corpse?",
            "Are the corpse action buttons (Recover, Burn, Broadcast, Devour) obvious?",
            "Is each action's reward/cost immediately understandable?",
            "Is the corpse location data useful for navigation?",
            "Is the FRESH / BURNED / BROADCASTED status clear?",
        ],
    },
    {
        "key":         "low_health_state",
        "label":       "Critical Health State (< 20% HP)",
        "description": "The game state when health is critically low. Check danger communication.",
        "timing_hint": "Capture when player HP drops below 20%.",
        "url_state":   "active",
        "inspect_for": [
            "Is the health bar clearly in a danger color (red)?",
            "Is there a flicker or pulse effect on the health bar at low HP?",
            "Is there a sound warning for critical health?",
            "Is the visual state alarming enough to prompt immediate action?",
        ],
    },
    {
        "key":         "run_end",
        "label":       "End of Run / Session Summary",
        "description": "The state at the end of a gameplay session. Check reward summary clarity.",
        "timing_hint": "Capture the death screen or session summary screen.",
        "url_state":   "game_over",
        "inspect_for": [
            "Is the session summary clearly laid out?",
            "Are gold, exp, and item gains clearly itemized?",
            "Is the 'return to title' or 'continue' path obvious?",
            "Does the end-of-run feel satisfying or abrupt?",
        ],
    },
]

MOMENT_KEYS = [m["key"] for m in SCREENSHOT_MOMENTS]


# ─── ScreenshotCapture Class ──────────────────────────────────────────────────

class ScreenshotCapture:
    """
    Captures screenshots from the game at key gameplay moments.
    
    In LIVE mode: controls a headless Chromium browser via Playwright.
    In STUB mode: creates placeholder records so the report still works.
    
    To enable LIVE mode:
      pip install playwright
      playwright install chromium
      npm run dev   (in a separate terminal, to start the game server)
    """

    GAME_URL         = "http://localhost:8080"
    STABILIZE_DELAY  = 1.5   # seconds to wait after navigation for rendering
    SCREENSHOT_DELAY = 0.5   # seconds between screenshots

    def __init__(
        self,
        output_dir: str,
        game_url:   str = None,
        mode:       str = "auto",  # "auto" | "live" | "stub"
    ):
        self.output_dir = output_dir
        self.game_url   = game_url or self.GAME_URL
        self.mode       = mode

        self._playwright     = None
        self._browser        = None
        self._page           = None
        self._is_live        = False
        self._captured:      List[Dict[str, Any]] = []
        self._errors:        List[str] = []

        os.makedirs(self.output_dir, exist_ok=True)
        os.makedirs(os.path.join(self.output_dir, "screenshots"), exist_ok=True)

    def start(self) -> bool:
        """
        Initialize the screenshot system.
        Returns True if live mode is active, False if stub mode.
        """
        if self.mode == "stub":
            self._is_live = False
            return False

        # Try Playwright
        try:
            from playwright.sync_api import sync_playwright
            self._pw_ctx = sync_playwright()
            self._playwright = self._pw_ctx.__enter__()
            self._browser = self._playwright.chromium.launch(headless=True)
            self._page = self._browser.new_page(
                viewport={"width": 1280, "height": 800}
            )
            # Try to reach the game server
            try:
                self._page.goto(self.game_url, timeout=5000)
                time.sleep(self.STABILIZE_DELAY)
                self._is_live = True
                return True
            except Exception as e:
                self._errors.append(
                    f"Game server not reachable at {self.game_url}: {e}. "
                    f"Run 'npm run dev' first to enable live screenshots."
                )
                self._browser.close()
                self._playwright = None
                self._is_live = False
                return False
        except ImportError:
            self._errors.append(
                "Playwright not installed. Run: pip install playwright && playwright install chromium. "
                "Screenshots will be stubs until then."
            )
            self._is_live = False
            return False
        except Exception as e:
            self._errors.append(f"Playwright launch failed: {e}")
            self._is_live = False
            return False

    def capture(self, moment_key: str, extra_context: Dict = None) -> Dict[str, Any]:
        """
        Capture a screenshot for the given moment key.
        Returns a record dict describing the capture result.
        """
        moment = next((m for m in SCREENSHOT_MOMENTS if m["key"] == moment_key), None)
        if moment is None:
            moment = {
                "key":         moment_key,
                "label":       moment_key.replace("_", " ").title(),
                "description": f"Auto-captured: {moment_key}",
                "inspect_for": [],
            }

        ts = datetime.now().strftime("%H%M%S")
        filename = f"{moment_key}_{ts}.png"
        filepath = os.path.join(self.output_dir, "screenshots", filename)

        record = {
            "key":           moment_key,
            "label":         moment["label"],
            "description":   moment["description"],
            "inspect_for":   moment["inspect_for"],
            "filename":      filename,
            "filepath":      filepath,
            "captured_at":   datetime.now().isoformat(),
            "is_live":       self._is_live,
            "context":       extra_context or {},
            "status":        "pending",
            "notes":         [],
        }

        if self._is_live and self._page:
            try:
                time.sleep(self.SCREENSHOT_DELAY)
                self._page.screenshot(path=filepath, full_page=False)
                record["status"] = "captured"
            except Exception as e:
                record["status"] = "failed"
                record["notes"].append(f"Screenshot failed: {e}")
                self._create_stub_png(filepath, moment["label"])
        else:
            # Stub: create placeholder
            record["status"] = "stub"
            record["notes"].append(
                "TODO: Enable live screenshots by running 'npm run dev' "
                "and installing Playwright (pip install playwright && playwright install chromium)."
            )
            self._create_stub_png(filepath, moment["label"])

        self._captured.append(record)
        return record

    def capture_all_stubs(self) -> List[Dict[str, Any]]:
        """Capture stub records for all defined moment keys."""
        results = []
        for moment in SCREENSHOT_MOMENTS:
            record = self.capture(moment["key"])
            results.append(record)
        return results

    def navigate_to_state(self, url_state: str) -> bool:
        """
        Navigate the game to a specific state.
        Returns True if successful.
        
        TODO: Implement state-specific navigation for live mode.
        For live mode, inject JS to trigger game state transitions:
          self._page.evaluate("window.gameOrchestrator?.gameState = 'active'")
        """
        if not self._is_live or not self._page:
            return False
        # TODO: Add state-specific page.evaluate() calls
        return True

    def stop(self):
        """Clean up browser resources."""
        try:
            if self._browser:
                self._browser.close()
            if hasattr(self, "_pw_ctx") and self._pw_ctx:
                self._pw_ctx.__exit__(None, None, None)
        except Exception:
            pass

    def get_captured(self) -> List[Dict[str, Any]]:
        return self._captured

    def get_errors(self) -> List[str]:
        return self._errors

    def get_summary(self) -> Dict[str, Any]:
        captured = [c for c in self._captured if c["status"] == "captured"]
        stubs    = [c for c in self._captured if c["status"] == "stub"]
        failed   = [c for c in self._captured if c["status"] == "failed"]
        return {
            "live_mode":       self._is_live,
            "total":           len(self._captured),
            "captured":        len(captured),
            "stubs":           len(stubs),
            "failed":          len(failed),
            "setup_errors":    self._errors,
        }

    def _create_stub_png(self, filepath: str, label: str):
        """
        Create a tiny placeholder PNG (1x1 transparent).
        In a real live session, this is replaced by the actual screenshot.
        """
        try:
            # Write a minimal valid 1x1 PNG (hardcoded bytes)
            PNG_1X1 = bytes([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
                0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  # IDAT chunk
                0x54, 0x78, 0x9C, 0x62, 0x00, 0x01, 0x00, 0x00,
                0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
                0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,  # IEND chunk
                0x42, 0x60, 0x82
            ])
            with open(filepath, "wb") as f:
                f.write(PNG_1X1)
        except Exception:
            # Write an empty file as absolute fallback
            open(filepath, "wb").close()
