"""
The Marked — GameFeelReviewer
Reviews game feel: input responsiveness, combat impact, movement,
attack timing, reward feedback, pacing, and overall loop quality.

This reviewer combines:
  1. Static analysis of engine.js and main.js for timing values
  2. Knowledge from the balance simulation results (if available)
  3. Genre standards for horror ARPGs
"""

import os
import re
import sys
from typing import List, Dict, Any, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SEVERITY = {"critical": 4, "high": 3, "medium": 2, "low": 1}


# ─── Genre Standards for Horror ARPG ─────────────────────────────────────────

STANDARDS = {
    "attack_delay_frames":    {"ideal": (15, 30), "name": "Attack cooldown",
                               "note": "< 15 = too spammy, > 50 = too slow"},
    "player_speed":           {"ideal": (2.5, 5.0), "name": "Player movement speed",
                               "note": "< 2.5 = sluggish, > 6 = floaty"},
    "invuln_frames":          {"ideal": (20, 40), "name": "Invulnerability frames after hit",
                               "note": "< 15 = too punishing, > 60 = too safe"},
    "enemy_aggro_radius":     {"ideal": (150, 300), "name": "Enemy aggro radius (px)",
                               "note": "< 100 = enemies feel blind, > 400 = no safe zone"},
    "projectile_speed":       {"ideal": (4, 9), "name": "Projectile speed",
                               "note": "< 3 = too easy to dodge, > 12 = unavoidable"},
    "max_enemies_on_screen":  {"ideal": (3, 8), "name": "Max simultaneous enemies",
                               "note": "< 2 = too sparse, > 12 = chaotic without visual clarity"},
    "death_animation_frames": {"ideal": (30, 80), "name": "Death animation duration (frames)",
                               "note": "< 20 = abrupt, > 100 = too slow before restart"},
    "boss_hp_multiplier":     {"ideal": (8, 20), "name": "Boss HP vs normal enemy",
                               "note": "< 5 = boss dies too fast, > 30 = drags on"},
}


class GameFeelReviewer:
    """
    Analyzes game feel from source timing values and design patterns.
    """

    def __init__(self, project_root: str, simulation_results: Optional[Dict] = None):
        self.root = project_root
        self.sim_results = simulation_results  # optional: from balance simulation
        self.findings: List[Dict[str, Any]] = []
        self._engine_src = ""
        self._main_src = ""
        self._canvas_src = ""

    def run(self) -> List[Dict[str, Any]]:
        self.findings = []
        self._engine_src = self._read("src/engine.js")
        self._main_src   = self._read("src/main.js")
        self._canvas_src = self._read("src/canvas.js")

        self._check_input_responsiveness()
        self._check_combat_timing()
        self._check_movement_feel()
        self._check_attack_feel()
        self._check_death_feel()
        self._check_reward_feedback()
        self._check_pacing()
        self._check_enemy_readability()
        self._check_combat_density()
        self._check_repetitiveness()

        if self.sim_results:
            self._check_sim_derived_feel()

        return sorted(self.findings, key=lambda x: -SEVERITY.get(x["severity"], 0))

    # ─── Checks ───────────────────────────────────────────────────────────────

    def _check_input_responsiveness(self):
        """Check input handling for responsiveness."""
        main_src = self._main_src

        # Check if input is handled in requestAnimationFrame loop or separately
        if "requestAnimationFrame" in main_src:
            pass  # good — runs at native refresh rate

        # Check for key debounce / input lag
        if "keydown" in main_src and "keys[" in (self._engine_src or ""):
            pass  # good — key state tracked per frame

        # Check if mouse click has immediate response
        if "mousedown" in main_src:
            if "gameState !== \"active\"" in main_src:
                pass  # correct guard
        else:
            self._add("high", "feel", "no_mouse_input",
                "No mouse click input detected. Player may only control via keyboard.",
                "Ensure mouse click triggers the player attack immediately — click-to-attack is expected in ARPG.")

        # Check game loop timing (requestAnimationFrame vs setInterval)
        if "requestAnimationFrame" not in main_src and "setInterval" in main_src:
            self._add("medium", "feel", "suboptimal_game_loop",
                "Game loop uses setInterval instead of requestAnimationFrame. "
                "This causes input lag and inconsistent frame timing.",
                "Switch to requestAnimationFrame for the main game loop — it syncs with the display refresh rate.")

    def _check_combat_timing(self):
        """Check combat timing values against genre standards."""
        engine = self._engine_src

        # Attack delay
        attack_delay = self._extract_numeric(engine, r"attackDelay\s*=\s*(\d+)")
        if attack_delay is not None:
            std = STANDARDS["attack_delay_frames"]
            if attack_delay < std["ideal"][0]:
                self._add("medium", "feel", "attack_too_fast",
                    f"Player attackDelay={attack_delay} frames — attack fires very rapidly. "
                    f"Combat may feel spammy and lose weight.",
                    "Increase attackDelay to 20–30 frames. Each attack should feel deliberate.")
            elif attack_delay > std["ideal"][1]:
                self._add("medium", "feel", "attack_too_slow",
                    f"Player attackDelay={attack_delay} frames — attack rate is slow. "
                    "Combat may feel unresponsive.",
                    "Reduce attackDelay to 20–30 frames for a satisfying attack rhythm.")

        # Invulnerability frames
        invuln = self._extract_numeric(engine, r"invulnTimer\s*=\s*(\d+)")
        if invuln is not None:
            std = STANDARDS["invuln_frames"]
            if invuln < std["ideal"][0]:
                self._add("high", "feel", "iframes_too_short",
                    f"invulnTimer={invuln} frames after being hit — very short invulnerability. "
                    "Rapid consecutive hits may stack and insta-kill players.",
                    "Increase invuln frames to 25–40. Short iframes make the game feel unfairly punishing.")
            elif invuln > std["ideal"][1]:
                self._add("low", "feel", "iframes_too_long",
                    f"invulnTimer={invuln} frames — long invulnerability after hit. "
                    "May make combat feel too safe.",
                    "Consider reducing to 25–35 frames for a balanced risk/reward feel.")

        # Auto-attack behavior
        if "autoAttack" in engine:
            if "attackCooldown" in engine and "attackDelay" in engine:
                pass  # auto-attack is paced by cooldown — good
        else:
            self._add("medium", "feel", "no_auto_attack_option",
                "No auto-attack system detected. Players may need to click rapidly for sustained combat.",
                "Add an auto-attack toggle (already exists in UI) tied to cooldown. Holding click should attack.")

    def _check_movement_feel(self):
        """Check player movement speed and smoothness."""
        engine = self._engine_src

        speed = self._extract_numeric(engine, r"speed\s*[=:]\s*(\d+\.?\d*)")
        if speed is not None:
            std = STANDARDS["player_speed"]
            if speed < std["ideal"][0]:
                self._add("medium", "feel", "movement_too_slow",
                    f"Player speed={speed} — movement feels sluggish. "
                    "Slow movement makes dodging enemies frustrating.",
                    "Increase base player speed to 3.0–4.0. Ensure upgrades can push it to 4.5–5.5.")
            elif speed > std["ideal"][1]:
                self._add("low", "feel", "movement_too_fast",
                    f"Player speed={speed} — may feel floaty or difficult to control.",
                    "Consider whether this speed matches the horror tone (methodical vs frantic).")

        # Check for movement inertia / smoothing
        if "vx" in engine and "vy" in engine:
            # Check if velocity is direct set or accumulated
            has_inertia = "vx +=" in engine or "vx *=" in engine
            if not has_inertia:
                self._add("low", "feel", "no_movement_inertia",
                    "Player movement may have no inertia/smoothing (position set directly).",
                    "Add slight velocity damping (vx *= 0.82 per frame) for a more organic movement feel.")

        # Check if diagonal movement is normalized
        if "normalize" in engine.lower() or "Math.sqrt" in engine:
            pass  # good — diagonal likely normalized
        else:
            self._add("medium", "feel", "diagonal_speed_not_normalized",
                "Diagonal movement speed may not be normalized (diagonal = 1.41× faster than cardinal).",
                "Normalize diagonal velocity: length = Math.sqrt(vx*vx + vy*vy); vx /= length; vy /= length.")

    def _check_attack_feel(self):
        """Check attack animation and impact feel."""
        canvas = self._canvas_src
        engine = self._engine_src

        # Check if attack animation exists for player
        if "the_marked.basic_attack" in canvas or "basic_attack" in canvas:
            pass  # good — attack animation exists
        else:
            self._add("high", "feel", "no_player_attack_animation",
                "Player attack animation not detected. Attacks may feel invisible.",
                "Implement a distinct attack animation frame (existing: the_marked.basic_attack) "
                "and ensure it's triggered on every attack.")

        # Check hit react animation for player
        if "the_marked.hit_react" in canvas:
            pass  # good
        else:
            self._add("high", "feel", "no_player_hit_react_animation",
                "Player hit-reaction animation missing. Being hit has no visual feedback.",
                "Add a distinct player hurt animation (flicker, red flash, or dedicated hit_react animation).")

        # Check if enemies have attack animations
        if "cabinet_indexer.attack" in canvas and "ink_redactor.attack" in canvas:
            pass  # good — enemies have distinct attack anims
        else:
            missing = [e for e in ["cabinet_indexer.attack", "ink_redactor.attack", "paper_wraith.attack", "witness_chair.attack"]
                       if e not in canvas]
            if missing:
                self._add("medium", "feel", "enemy_attack_animations_missing",
                    f"Enemy attack animations missing: {missing}",
                    "Each enemy type needs a distinct attack animation to telegraph their strike.")

        # Check for knockback
        if "knockback" in engine.lower() or "vx +=" in engine:
            pass  # good
        else:
            self._add("medium", "feel", "no_knockback",
                "No knockback detected on hits. Damage events have no physical push feedback.",
                "Add knockback: push player back 2–4px on hit. Adds physical weight to combat.")

    def _check_death_feel(self):
        """Check death feedback and transition."""
        canvas = self._canvas_src
        engine = self._engine_src
        main = self._main_src

        # Check death animation
        if "death_collapse" in canvas:
            pass  # good

        # Check death timer duration
        death_timer = self._extract_numeric(engine, r"deathTimer\s*[=:]\s*(\d+)")
        if death_timer is not None:
            std = STANDARDS["death_animation_frames"]
            if death_timer < std["ideal"][0]:
                self._add("medium", "feel", "death_too_fast",
                    f"deathTimer={death_timer} frames — death animation is very short. "
                    "Death feels like an instant, undramatic cut.",
                    "Increase death animation duration to 45–75 frames. "
                    "Death should feel heavy and significant, not instant.")
            elif death_timer > std["ideal"][1]:
                self._add("low", "feel", "death_too_long",
                    f"deathTimer={death_timer} frames — death animation may be long enough to feel padded.",
                    "Consider if the post-death wait is appropriate for the pacing.")

        # Check if game-over transition is clear
        if "game_over" in main.lower() or "gameOver" in main.lower():
            pass
        else:
            self._add("high", "feel", "unclear_game_over_transition",
                "Game over state transition not clearly visible in main.js.",
                "Add a clear game-over screen state with stats summary, death cause, and restart options.")

    def _check_reward_feedback(self):
        """Check if rewards are communicated satisfyingly."""
        engine = self._engine_src
        ui = self._read("src/ui.js")
        main = self._main_src

        # Gold drop feedback
        has_gold_visual = "gold" in engine.lower() and "loot" in engine.lower()
        if not has_gold_visual:
            self._add("medium", "feel", "gold_drop_no_visual",
                "Gold drop from enemies may have no visual feedback (floating number, particle).",
                "Add a floating '+N gold' text popup above enemies on death. "
                "This is one of the most important reward-feel moments in any ARPG.")

        # Exp / level-up feedback
        has_levelup_feedback = "level" in engine.lower() and ("level" in (ui or "").lower())
        if "levelUp" not in engine and "level_up" not in engine.lower() and "level +=" not in engine:
            self._add("high", "feel", "no_levelup_feedback",
                "Level-up event may have no visual or audio celebration.",
                "Add a 'LEVEL UP' banner or canvas overlay on level-up, with a satisfying sound. "
                "Level-up is the core progression dopamine loop.")

        # Loot rarity feeling
        if "Relic" in engine or "Abyssal" in engine:
            self._add("low", "feel", "rarity_feedback_review",
                "Higher rarity items exist. Review: does finding a Relic/Abyssal feel significantly more exciting than Worn?",
                "Add distinct VFX, sound, and UI flash for Relic+ items. "
                "Rare drops should feel like events, not routine pickups.")

    def _check_pacing(self):
        """Check pacing between action and calm."""
        engine = self._engine_src

        # Enemy spawn rate
        spawn_timer = self._extract_numeric(engine, r"spawnTimer\s*[><=]+\s*(\d+)")
        if spawn_timer is not None:
            if spawn_timer < 60:
                self._add("medium", "feel", "enemy_spawn_too_fast",
                    f"Enemy spawn timer={spawn_timer} — enemies spawn very frequently. "
                    "May feel relentless with no breathing room.",
                    "Increase spawn cooldown and add dynamic scaling: "
                    "fewer enemies early (tension building), more enemies at high observation.")
            elif spawn_timer > 400:
                self._add("medium", "feel", "enemy_spawn_too_slow",
                    f"Enemy spawn timer={spawn_timer} — enemies appear infrequently. "
                    "Game may feel empty between encounters.",
                    "Add environmental cues (sounds, Monolith glow) during enemy-free periods to maintain tension.")

        # Check if there are quiet phases between combat
        if "idle" in engine.lower() or "patrol" in engine.lower():
            pass  # enemies have idle state
        else:
            self._add("low", "feel", "no_enemy_idle_state",
                "Enemies may not have an idle/patrol state — they may always be aggressive.",
                "Add idle patrol behavior to give the player breathing room to explore and heal.")

    def _check_enemy_readability(self):
        """Check if enemy types are visually and behaviorally distinct."""
        canvas = self._canvas_src

        enemy_types = {
            "Cabinet Indexer":  "cabinet_indexer" in canvas,
            "Ink Redactor":     "ink_redactor" in canvas,
            "Paper Wraith":     "paper_wraith" in canvas,
            "Witness Chair":    "witness_chair" in canvas,
            "Seal Mother":      "seal_mother" in canvas,
            "The Shape":        "the_marked.idle" in canvas,  # clone uses player sprite
        }

        missing_visuals = [k for k, v in enemy_types.items() if not v]
        if missing_visuals:
            self._add("high", "feel", "enemy_visuals_missing",
                f"Enemy types with no distinct visual found in canvas.js: {missing_visuals}",
                "Each enemy type must have a unique sprite to be distinguishable. "
                "Players need to instantly identify what they're fighting to respond appropriately.")

        # The Shape uses the player's sprite — this is intentional but needs a distinction
        if "the_marked.idle" in canvas and "The Shape" in canvas:
            if "0.55" in canvas:  # alpha reduction for The Shape
                pass  # has a distinction
            else:
                self._add("medium", "feel", "the_shape_indistinguishable",
                    "The Shape clone uses the player sprite with no visual distinction. "
                    "Players may not realize The Shape is an enemy.",
                    "Add a clear visual distinction for The Shape: red outline, dark tint, or distortion effect.")

    def _check_combat_density(self):
        """Check max enemies and combat density."""
        engine = self._engine_src

        max_enemies = self._extract_numeric(engine, r"enemies\.length\s*[<>=]+\s*(\d+)|maxEnemies\s*[=:]\s*(\d+)")
        if max_enemies is not None:
            std = STANDARDS["max_enemies_on_screen"]
            if max_enemies < std["ideal"][0]:
                self._add("medium", "feel", "too_few_enemies",
                    f"Max enemies on screen may be capped at {max_enemies}. "
                    "Combat may feel sparse and low-stakes.",
                    "Allow 4–8 enemies simultaneously. Use enemy variety (melee + ranged) for tactical depth.")
            elif max_enemies > std["ideal"][1]:
                self._add("medium", "feel", "too_many_enemies",
                    f"Max enemies {max_enemies} may be too many for clear visual readability.",
                    "Limit to 6–8 enemies max and ensure they're visually distinct from background art.")

    def _check_repetitiveness(self):
        """Check for repetitive loop design."""
        engine = self._engine_src

        # Check if there is only one room/area
        regions = re.findall(r'"(zone|region|area|room)[^"]*"', engine, re.IGNORECASE)
        unique_regions = set(regions)
        if len(unique_regions) < 2:
            self._add("medium", "feel", "single_region",
                "Only one room/area appears to exist. Extended play sessions may feel repetitive.",
                "Add at least 2–3 distinct room layouts or regions with different environmental density, "
                "enemy types, and interactable placement.")

        # Check for variety in enemy behavior
        behavior_states = re.findall(r'"(idle|chase|attack|flee|patrol|wander|summon)"', engine)
        unique_behaviors = set(behavior_states)
        if len(unique_behaviors) < 3:
            self._add("medium", "feel", "low_enemy_behavior_variety",
                f"Enemy behaviors: {unique_behaviors}. May feel repetitive over long sessions.",
                "Add at least: idle patrol, approach/chase, attack telegraph, and retreat behaviors. "
                "Variety in enemy behavior is critical for extended play sessions.")

    def _check_sim_derived_feel(self):
        """Use balance simulation data to assess game feel."""
        if not self.sim_results:
            return

        per_profile = self.sim_results.get("per_profile_results", {})

        for profile, stats in per_profile.items():
            avg_deaths = stats.get("avg_deaths", 0)
            avg_life_h = stats.get("avg_average_life_hours", 0)

            if avg_life_h < 0.1 and avg_deaths > 5:
                self._add("high", "feel", f"sim_dies_too_fast_{profile}",
                    f"[Sim] {profile} averages {avg_life_h:.2f}h per life ({avg_deaths:.1f} deaths). "
                    "Game may feel punishingly fast-paced with no time to learn.",
                    "Review early game enemy damage — new players need at least 3–5 minutes per life to understand the systems.")

            if avg_life_h > 2.0 and avg_deaths < 0.5:
                self._add("medium", "feel", f"sim_never_dies_{profile}",
                    f"[Sim] {profile} rarely dies ({avg_deaths:.2f} deaths avg). "
                    "Game may feel tension-free for some play styles.",
                    "Add escalating pressure mechanics (observation-driven enemy spawns, periodic sanity events) "
                    "to maintain tension even for defensive players.")

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _add(self, severity, category, key, issue, fix):
        self.findings.append({
            "severity": severity, "category": category,
            "key": key, "issue": issue, "fix": fix,
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

    def _extract_numeric(self, src: str, pattern: str) -> Optional[float]:
        """Extract the first numeric value matching a pattern."""
        match = re.search(pattern, src)
        if match:
            for g in match.groups():
                if g is not None:
                    try:
                        return float(g)
                    except ValueError:
                        continue
        return None
