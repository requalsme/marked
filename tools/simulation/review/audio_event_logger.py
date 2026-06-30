"""
The Marked — AudioEventLogger
Reviews the audio system by static source inspection.

Since The Marked is a browser game (HTML/JS), this reviewer:
  1. Scans all source files for any audio system implementation
  2. Identifies every action/event that SHOULD have audio
  3. Cross-references against what audio code actually exists
  4. Generates findings for every missing audio moment

Expected audio events for a horror ARPG (based on genre standards):
  COMBAT:   hit_player, hit_enemy, enemy_death, player_death,
            crit_hit, attack_swing, projectile_fire
  UI:       button_click, tab_switch, tooltip_open, equip_item,
            unequip_item, upgrade_purchase, error_sound
  SYSTEMS:  sanity_drain, sanity_broken, sanity_recover,
            observation_increase, observation_threshold,
            ritual_perform, ritual_fail, signal_decode,
            corpse_interact, loot_pickup
  AMBIENT:  room_ambience, candle_flicker, monolith_hum
  MUSIC:    title_music, gameplay_tension, combat_music,
            boss_encounter, death_sting, idle_return
  BOSS:     seal_mother_spawn, seal_mother_attack, wax_trap_trigger
"""

import os
import re
import sys
from typing import List, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


SEVERITY = {"critical": 4, "high": 3, "medium": 2, "low": 1}

# ─── Expected Audio Events ───────────────────────────────────────────────────

EXPECTED_AUDIO = [
    # Combat
    {"event": "hit_player",          "category": "combat",  "severity": "high",
     "description": "Player takes damage hit",
     "fix": "Play a grunt/impact sound when player is hit. Essential for game feel."},
    {"event": "hit_enemy",           "category": "combat",  "severity": "high",
     "description": "Player attacks and hits enemy",
     "fix": "Play a thud/slash/impact sound on each successful hit. Should vary by weapon type."},
    {"event": "enemy_death",         "category": "combat",  "severity": "high",
     "description": "Enemy defeated",
     "fix": "Each enemy type should have a unique death sound (indexer crumple, wraith dissipate, redactor static burst)."},
    {"event": "player_death",        "category": "combat",  "severity": "critical",
     "description": "Player dies",
     "fix": "A dramatic death sting. The most important sound in the game — players remember it every run."},
    {"event": "crit_hit",            "category": "combat",  "severity": "medium",
     "description": "Critical strike lands",
     "fix": "A distinct heavier/more resonant impact for critical hits."},
    {"event": "attack_swing",        "category": "combat",  "severity": "medium",
     "description": "Player swing/attack sound",
     "fix": "A soft whoosh or weapon-specific sound on each attack attempt (hit or miss)."},
    {"event": "projectile_fire",     "category": "combat",  "severity": "medium",
     "description": "Ranged projectile fired",
     "fix": "Static spark or ink-blot launch sound for Ink Redactor projectiles."},

    # UI
    {"event": "button_click",        "category": "ui",      "severity": "high",
     "description": "Any button clicked in UI",
     "fix": "A subtle, thematic click (paper rustle, wax stamp) on all game-btn elements."},
    {"event": "tab_switch",          "category": "ui",      "severity": "medium",
     "description": "Panel tab switched",
     "fix": "A soft page-turn sound when switching between inventory, rituals, signals, corpses."},
    {"event": "equip_item",          "category": "ui",      "severity": "medium",
     "description": "Item equipped from inventory",
     "fix": "A satisfying equip sound (metal click, cloth rustle). Very important for loot feedback."},
    {"event": "upgrade_purchase",    "category": "ui",      "severity": "high",
     "description": "Monolith upgrade purchased",
     "fix": "A powerful resonant tone on upgrade — this is a major progression moment."},
    {"event": "error_sound",         "category": "ui",      "severity": "low",
     "description": "Action failed (can't afford, too close to death, etc.)",
     "fix": "A subtle negative tone (low buzz, denial click) for failed actions."},
    {"event": "interact_prompt",     "category": "ui",      "severity": "low",
     "description": "Approaching an interactable (E prompt appears)",
     "fix": "A very subtle audio cue (ambient hum increase) when entering interaction range."},

    # Systems
    {"event": "sanity_drain",        "category": "systems", "severity": "critical",
     "description": "Ongoing sanity drain tick",
     "fix": "A subtle heartbeat or dissonance that intensifies as sanity drops. Core horror mechanic."},
    {"event": "sanity_broken",       "category": "systems", "severity": "critical",
     "description": "Sanity drops below 15 (Broken state)",
     "fix": "A dramatic audio event: screech, static burst, or ambient horror sting. The most alarming moment."},
    {"event": "sanity_recover",      "category": "systems", "severity": "medium",
     "description": "Sanity restored (corpse burn, etc.)",
     "fix": "A brief, calming audio sting — relief that contrasts the horror ambience."},
    {"event": "observation_increase","category": "systems", "severity": "medium",
     "description": "Observation grows (Monolith watching)",
     "fix": "A subtle, slow-building tone. Players should unconsciously feel the Monolith's attention."},
    {"event": "observation_threshold","category":"systems", "severity": "high",
     "description": "Observation crosses 25/50/75/100% threshold",
     "fix": "A dramatic audio sting per threshold: 'NOTICED' = soft rumble, 'KNOWN' = deep dread tone."},
    {"event": "ritual_perform",      "category": "systems", "severity": "high",
     "description": "Ritual executed at the altar",
     "fix": "Each ritual should have a distinct audio signature: Blood Tithe = wet tear, Static Communion = radio burst."},
    {"event": "ritual_fail",         "category": "systems", "severity": "medium",
     "description": "Ritual attempt fails (not near altar, can't afford)",
     "fix": "A harsh rejection sound — the altar refusing the bargain."},
    {"event": "signal_decode",       "category": "systems", "severity": "high",
     "description": "Signal decoded from parchment",
     "fix": "A radio static-to-clear decode sound. Thematic and satisfying."},
    {"event": "corpse_interact",     "category": "systems", "severity": "medium",
     "description": "Any corpse action performed",
     "fix": "Each corpse action has a distinct sound: recover = coin drop, burn = fire crackle, devour = wet bite."},
    {"event": "loot_pickup",         "category": "systems", "severity": "high",
     "description": "Loot item collected from the floor",
     "fix": "A satisfying paper/metal pickup sound. Without this, loot feels invisible."},
    {"event": "corpse_spawn",        "category": "systems", "severity": "medium",
     "description": "New corpse placed in world on player death",
     "fix": "A heavy thud or ambient sound when the corpse materializes in the world."},

    # Ambient
    {"event": "room_ambience",       "category": "ambient", "severity": "high",
     "description": "Background room atmosphere audio",
     "fix": "Looping ambient: distant file cabinet drawers, paper settling, low electrical hum. Critical for horror tone."},
    {"event": "candle_flicker",      "category": "ambient", "severity": "medium",
     "description": "Candles flickering in the room",
     "fix": "Subtle audio tied to the canvas candle flicker animation — a soft flicker sound."},
    {"event": "monolith_hum",        "category": "ambient", "severity": "high",
     "description": "The Monolith's presence as an ambient sound",
     "fix": "A low, growing sub-bass hum that intensifies with observation. The Monolith should be heard, not just seen."},

    # Music
    {"event": "title_music",         "category": "music",   "severity": "high",
     "description": "Title screen background music",
     "fix": "Eerie ambient music on the title screen — first impression of the game's audio identity."},
    {"event": "gameplay_tension",    "category": "music",   "severity": "high",
     "description": "Background music during active gameplay",
     "fix": "Layered tension music that builds dynamically with combat proximity and observation level."},
    {"event": "combat_music",        "category": "music",   "severity": "medium",
     "description": "Music shift when enemies are nearby/attacking",
     "fix": "A percussion or rhythm layer that kicks in during active combat."},
    {"event": "boss_encounter",      "category": "music",   "severity": "critical",
     "description": "Seal Mother boss music",
     "fix": "A dedicated boss theme. This is the most memorable moment — silence is a massive missed opportunity."},
    {"event": "death_sting",         "category": "music",   "severity": "critical",
     "description": "Music/sound on player death",
     "fix": "A brief, impactful music sting on death before silence. Sets tone for the run summary."},
    {"event": "idle_return_music",   "category": "music",   "severity": "low",
     "description": "Audio feedback when returning from idle/offline",
     "fix": "A brief wake-up tone when the game loads and shows the offline report."},

    # Boss
    {"event": "boss_spawn",          "category": "boss",    "severity": "high",
     "description": "Seal Mother appears in the room",
     "fix": "A loud, dramatic spawn sound — the boss entrance should be unmistakable."},
    {"event": "boss_attack",         "category": "boss",    "severity": "high",
     "description": "Seal Mother attacks",
     "fix": "Heavy attack sounds for each Seal Mother attack type."},
    {"event": "wax_trap",            "category": "boss",    "severity": "medium",
     "description": "Wax trap placed on the ground",
     "fix": "A distinctive pour/splash sound when a wax trap appears, alerting players before it damages them."},
    {"event": "boss_defeated",       "category": "boss",    "severity": "high",
     "description": "Seal Mother defeated",
     "fix": "A dramatic victory sound or crescendo — this is a major milestone moment."},
]


class AudioEventLogger:
    """
    Inspects the game's source code for audio system implementation.
    Cross-references against the expected audio event list.
    """

    def __init__(self, project_root: str):
        self.root = project_root
        self.findings: List[Dict[str, Any]] = []
        self._audio_evidence: Dict[str, Any] = {}

    def run(self) -> List[Dict[str, Any]]:
        """Run audio analysis. Returns list of findings."""
        self.findings = []
        self._audio_evidence = self._scan_for_audio_code()
        self._check_audio_system_exists()
        self._check_each_expected_event()
        self._check_volume_balance()
        self._check_music_transitions()

        return sorted(self.findings, key=lambda x: -SEVERITY.get(x["severity"], 0))

    def get_audio_system_summary(self) -> Dict[str, Any]:
        return {
            "has_audio_system":    self._audio_evidence.get("has_system", False),
            "audio_files_found":   self._audio_evidence.get("audio_files", []),
            "audio_api_found":     self._audio_evidence.get("api_calls", []),
            "implementation_pct":  self._audio_evidence.get("implementation_pct", 0),
        }

    # ─── Analysis ─────────────────────────────────────────────────────────────

    def _scan_for_audio_code(self) -> Dict[str, Any]:
        """Scan all source files for any audio-related code."""
        evidence = {
            "has_system": False,
            "audio_files": [],
            "api_calls": [],
            "implementation_pct": 0,
        }

        audio_patterns = [
            r"AudioContext", r"new Audio\(", r"\.play\(\)", r"\.pause\(\)",
            r"WebAudioAPI", r"createOscillator", r"createGain", r"Howler",
            r"soundManager", r"audioManager", r"playSound", r"stopSound",
            r"\.src\s*=\s*['\"].*\.(mp3|ogg|wav|webm)",
        ]

        all_src = ""
        for dirpath, _, files in os.walk(self.root):
            if any(skip in dirpath for skip in [".git", "node_modules", "simulation"]):
                continue
            for fn in files:
                if fn.endswith((".js", ".ts", ".html")):
                    fpath = os.path.join(dirpath, fn)
                    try:
                        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                            src = f.read()
                        all_src += src
                        for pat in audio_patterns:
                            matches = re.findall(pat, src)
                            if matches:
                                evidence["api_calls"].extend(matches)
                    except Exception:
                        pass

                if fn.endswith((".mp3", ".ogg", ".wav", ".webm", ".flac")):
                    evidence["audio_files"].append(os.path.join(dirpath, fn))

        evidence["api_calls"] = list(set(evidence["api_calls"]))
        evidence["has_system"] = len(evidence["api_calls"]) > 0 or len(evidence["audio_files"]) > 0
        evidence["implementation_pct"] = min(100, len(evidence["api_calls"]) * 5 + len(evidence["audio_files"]) * 10)

        return evidence

    def _check_audio_system_exists(self):
        """Top-level check: does any audio system exist at all?"""
        if not self._audio_evidence["has_system"]:
            self.findings.append({
                "severity": "critical",
                "category": "audio",
                "key":      "no_audio_system",
                "issue":    "No audio system found in the game codebase. "
                            f"No AudioContext, Audio API calls, or audio files ({', '.join(['.mp3', '.ogg', '.wav'])}) detected.",
                "fix":      "Implement a minimal AudioManager in src/audio.js. "
                            "At minimum: ambient horror loop, hit sounds, death sting, and UI clicks. "
                            "Without audio, the horror atmosphere is critically undermined. "
                            "A WebAudio API-based manager is recommended for dynamic audio layering.",
                "impact":   "All audio events are currently missing. "
                            "This is the highest-priority presentation issue in The Marked.",
            })
        else:
            audio_files = self._audio_evidence["audio_files"]
            api_calls = self._audio_evidence["api_calls"]
            self.findings.append({
                "severity": "low",
                "category": "audio",
                "key":      "audio_system_exists",
                "issue":    f"Audio system found: {len(api_calls)} API call patterns, {len(audio_files)} audio files.",
                "fix":      "Review coverage below for missing events.",
                "impact":   "Partial audio implementation detected.",
            })

    def _check_each_expected_event(self):
        """Check each expected audio event against the scanned source."""
        if not self._audio_evidence["has_system"]:
            # All events are missing — don't flood the report
            self.findings.append({
                "severity": "critical",
                "category": "audio",
                "key":      "all_audio_events_missing",
                "issue":    f"All {len(EXPECTED_AUDIO)} expected audio events are missing (no audio system).",
                "fix":      "After implementing AudioManager, add these events in priority order: "
                            "player_death > boss_encounter > sanity_broken > hit sounds > room_ambience > music.",
                "events":   [e["event"] for e in EXPECTED_AUDIO],
            })
            return

        # If partial audio, check each event
        api_calls_str = " ".join(self._audio_evidence["api_calls"])
        audio_files_str = " ".join(self._audio_evidence["audio_files"])
        combined = api_calls_str + " " + audio_files_str

        for event in EXPECTED_AUDIO:
            event_name = event["event"]
            # Simple heuristic: check if the event name appears in any audio context
            if event_name not in combined and event_name.replace("_", "") not in combined:
                self.findings.append({
                    "severity": event["severity"],
                    "category": "audio",
                    "key":      f"audio_missing_{event_name}",
                    "issue":    f"[{event['category'].upper()}] Audio event '{event_name}' not found: {event['description']}",
                    "fix":      event["fix"],
                })

    def _check_volume_balance(self):
        """Check for volume balance controls."""
        if not self._audio_evidence["has_system"]:
            return

        all_src = self._read_all_js()
        if "volume" not in all_src.lower() and "gain" not in all_src.lower():
            self.findings.append({
                "severity": "medium",
                "category": "audio",
                "key":      "no_volume_control",
                "issue":    "No volume control or gain node found. Cannot adjust audio levels per channel.",
                "fix":      "Add a gain node per audio channel (master, sfx, music, ambient) "
                            "for independent volume control and dynamic mixing.",
            })

    def _check_music_transitions(self):
        """Check for music transition logic."""
        if not self._audio_evidence["has_system"]:
            return

        all_src = self._read_all_js()
        has_transitions = "crossfade" in all_src.lower() or "fade" in all_src.lower()
        if not has_transitions:
            self.findings.append({
                "severity": "medium",
                "category": "audio",
                "key":      "no_music_transitions",
                "issue":    "No music transition/crossfade logic found. Music changes will be abrupt cuts.",
                "fix":      "Implement crossfade (2–4 second fade) between music states: "
                            "title → gameplay → combat → boss → death. "
                            "Abrupt music changes break immersion significantly.",
            })

    def _read_all_js(self) -> str:
        result = ""
        for dirpath, _, files in os.walk(self.root):
            if any(skip in dirpath for skip in [".git", "node_modules", "simulation"]):
                continue
            for fn in files:
                if fn.endswith(".js"):
                    try:
                        with open(os.path.join(dirpath, fn), "r", encoding="utf-8", errors="replace") as f:
                            result += f.read()
                    except Exception:
                        pass
        return result
