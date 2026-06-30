"""
The Marked — VFXChecklistReviewer
Reviews the VFX (particle effects, screen shake, hit feedback, visual
impact) by static analysis of canvas.js and engine.js.

Checks:
  - Combat hit VFX
  - Enemy attack effects
  - Death effects
  - Loot pickup effects
  - Ritual effects
  - Sanity/observation effects
  - Boss effects
  - Environmental effects
  - Projectile VFX
  - Screen shake usage
  - VFX that are too weak, too loud, or missing
"""

import os
import re
import sys
from typing import List, Dict, Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SEVERITY = {"critical": 4, "high": 3, "medium": 2, "low": 1}


# ─── Expected VFX Events ──────────────────────────────────────────────────────

EXPECTED_VFX = [
    {"event": "player_hit_react",    "category": "combat",      "severity": "critical",
     "description": "Player taking a hit — invuln flash, shake, particle spray",
     "expected_signals": ["invulnTimer", "triggerShake", "particles"]},
    {"event": "enemy_hit_flash",     "category": "combat",      "severity": "high",
     "description": "Enemy flashes/reacts when struck",
     "expected_signals": ["hitFlash", "hurtTimer", "color", "alpha"]},
    {"event": "enemy_death_burst",   "category": "combat",      "severity": "high",
     "description": "Particles/dissolve when enemy dies",
     "expected_signals": ["createParticleExplosion", "death", "particles"]},
    {"event": "player_attack_vfx",   "category": "combat",      "severity": "high",
     "description": "Visual for player attack (projectile or swing)",
     "expected_signals": ["blood_cleave", "projectiles", "ink_slash"]},
    {"event": "crit_hit_vfx",        "category": "combat",      "severity": "medium",
     "description": "Distinct VFX for critical hits",
     "expected_signals": ["crit", "burst", "gold", "sparkle"]},
    {"event": "player_death_vfx",    "category": "combat",      "severity": "critical",
     "description": "Player collapse animation and death particles",
     "expected_signals": ["death_collapse", "deathTimer", "createParticleExplosion"]},
    {"event": "screen_shake_hit",    "category": "combat",      "severity": "high",
     "description": "Screen shakes on player taking damage",
     "expected_signals": ["triggerShake", "screenShake"]},
    {"event": "projectile_impact",   "category": "combat",      "severity": "medium",
     "description": "Projectile impact spark/splat on walls or player",
     "expected_signals": ["ink_blot", "static_spark", "particles"]},

    {"event": "loot_pickup_vfx",     "category": "loot",        "severity": "high",
     "description": "Visual feedback when collecting loot",
     "expected_signals": ["loot", "pickup", "particles", "float"]},
    {"event": "item_hover_float",    "category": "loot",        "severity": "medium",
     "description": "Loot items float/bob to indicate interactability",
     "expected_signals": ["hoverY", "sin", "loot.x"]},
    {"event": "rare_item_glow",      "category": "loot",        "severity": "medium",
     "description": "Higher rarity items have distinctive glow/pulse",
     "expected_signals": ["rarity", "glow", "Relic", "Abyssal"]},

    {"event": "ritual_execute_vfx",  "category": "rituals",     "severity": "high",
     "description": "Visual effect when a ritual is executed",
     "expected_signals": ["createParticleExplosion", "ritual", "#9a1616", "#3075c7"]},
    {"event": "ritual_altar_glow",   "category": "rituals",     "severity": "medium",
     "description": "Altar glows/pulses when player is nearby",
     "expected_signals": ["blood_ritual_altar", "glow", "pulse"]},
    {"event": "corpse_burn_vfx",     "category": "rituals",     "severity": "medium",
     "description": "Particles when a corpse is burned",
     "expected_signals": ["burn", "fire", "particles", "corpse"]},

    {"event": "sanity_break_vfx",    "category": "sanity",      "severity": "critical",
     "description": "Visual distortion when sanity enters Broken state",
     "expected_signals": ["sanity-broken", "broken", "vignette", "distort"]},
    {"event": "sanity_drain_pulse",  "category": "sanity",      "severity": "medium",
     "description": "Ongoing visual tick showing sanity draining",
     "expected_signals": ["sanityDecay", "pulse", "flicker", "drain"]},
    {"event": "observation_rune_glow","category": "sanity",     "severity": "high",
     "description": "Monolith rune intensifies as observation grows",
     "expected_signals": ["observation", "strokeStyle", "shadowBlur", "obsPct"]},
    {"event": "observation_brand_glow","category": "sanity",    "severity": "medium",
     "description": "Red brand glow around player increases with observation",
     "expected_signals": ["brandGrad", "obsMult", "observation"]},

    {"event": "boss_spawn_vfx",      "category": "boss",        "severity": "high",
     "description": "Dramatic VFX when Seal Mother appears",
     "expected_signals": ["seal_mother", "spawn", "shake", "particles"]},
    {"event": "boss_attack_vfx",     "category": "boss",        "severity": "high",
     "description": "Seal Mother attack visual (slam, wax spread)",
     "expected_signals": ["seal_mother.summon", "wax_trap", "summon"]},
    {"event": "boss_death_vfx",      "category": "boss",        "severity": "high",
     "description": "Seal Mother defeat VFX",
     "expected_signals": ["seal_mother", "death", "explosion", "final"]},

    {"event": "candle_flicker_vfx",  "category": "environment", "severity": "medium",
     "description": "Candles flicker dynamically",
     "expected_signals": ["candles", "Math.random()", "flicker"]},
    {"event": "room_dust_particles", "category": "environment", "severity": "low",
     "description": "Ambient floating particles in the room",
     "expected_signals": ["dust", "grain", "ambient", "float"]},
    {"event": "grain_noise",         "category": "environment", "severity": "low",
     "description": "Film grain or noise overlay",
     "expected_signals": ["grain", "noise", "alpha", "fillRect"]},
    {"event": "monolith_pulse",      "category": "environment", "severity": "medium",
     "description": "Monolith pulses/breathes in sync with observation",
     "expected_signals": ["flicker", "Math.sin", "obsPct", "monolith"]},

    {"event": "interactable_pulse",  "category": "ui_vfx",      "severity": "medium",
     "description": "Interactables glow/pulse to indicate interaction",
     "expected_signals": ["pulse", "Math.sin", "glow", "interactable"]},
    {"event": "idle_return_flash",   "category": "ui_vfx",      "severity": "low",
     "description": "VFX or visual cue when returning from idle/offline",
     "expected_signals": ["offline", "flash", "return", "particles"]},
    {"event": "portal_vfx",         "category": "environment",  "severity": "medium",
     "description": "Sealed zone door open portal effect",
     "expected_signals": ["portal", "createRadialGradient", "sealed_zone_door"]},
]


class VFXChecklistReviewer:
    """
    Reviews VFX implementation by static analysis of canvas.js and engine.js.
    """

    def __init__(self, project_root: str):
        self.root = project_root
        self.findings: List[Dict[str, Any]] = []
        self._canvas_src = ""
        self._engine_src = ""

    def run(self) -> List[Dict[str, Any]]:
        self.findings = []
        self._canvas_src = self._read("src/canvas.js")
        self._engine_src = self._read("src/engine.js")
        combined = self._canvas_src + self._engine_src

        self._check_particle_system()
        self._check_screen_shake()
        self._check_each_vfx(combined)
        self._check_vfx_quality()
        self._check_vfx_density()

        return sorted(self.findings, key=lambda x: -SEVERITY.get(x["severity"], 0))

    # ─── Checks ───────────────────────────────────────────────────────────────

    def _check_particle_system(self):
        """Check the particle system implementation."""
        has_particles = "particles" in self._engine_src and "createParticleExplosion" in self._engine_src
        has_draw = "drawParticles" in self._canvas_src

        if not has_particles:
            self._add("critical", "vfx", "no_particle_system",
                "No particle system found in engine.js. All particle-based VFX are missing.",
                "Implement a particle pool in engine.js with emitter, lifetime, velocity, alpha decay.")
            return

        if not has_draw:
            self._add("critical", "vfx", "particles_not_drawn",
                "Particle system exists but drawParticles() not called in canvas.js.",
                "Call drawParticles() in the main CanvasRenderer.draw() loop.")

        # Check particle count
        max_particles = re.search(r"(\d+)\s*particles|particles.*?(\d+)\s*max", self._engine_src)
        if max_particles:
            count = int(max_particles.group(1) or max_particles.group(2))
            if count < 20:
                self._add("medium", "vfx", "particle_count_too_low",
                    f"Particle system limited to ~{count} particles. Effects may look sparse.",
                    "Increase particle pool to at least 100–150 simultaneous particles for dense combat effects.")

    def _check_screen_shake(self):
        """Check screen shake implementation and coverage."""
        has_shake = "triggerShake" in self._canvas_src or "screenShake" in self._canvas_src
        shake_in_engine = "triggerShake" in self._engine_src

        if not has_shake:
            self._add("high", "vfx", "no_screen_shake",
                "Screen shake not implemented. Combat hits have no physical impact feedback.",
                "Implement screen shake: on player hit (intensity 6), on boss attack (intensity 10), on player death (intensity 15).")
            return

        if not shake_in_engine:
            self._add("medium", "vfx", "screen_shake_not_triggered",
                "Screen shake system exists in canvas.js but triggerShake() not called from engine.js on hits.",
                "Call this.canvasRenderer.triggerShake(N) from the engine when the player takes damage.")

        # Check shake decay
        if "screenShake *= 0.9" in self._canvas_src or "screenShake * 0.9" in self._canvas_src:
            pass  # good — smooth decay exists
        else:
            self._add("low", "vfx", "screen_shake_no_decay",
                "Screen shake may not decay smoothly (no 0.9 multiplier decay found).",
                "Add exponential decay to screen shake for smooth, natural feel: screenShake *= 0.88 each frame.")

    def _check_each_vfx(self, combined: str):
        """Check each expected VFX event against the source code."""
        for vfx in EXPECTED_VFX:
            signals = vfx["expected_signals"]
            found = sum(1 for sig in signals if sig in combined)
            coverage = found / max(1, len(signals))

            if coverage < 0.3:
                # Less than 30% signal match — likely missing
                self._add(vfx["severity"], "vfx", f"vfx_missing_{vfx['event']}",
                    f"[{vfx['category'].upper()}] VFX '{vfx['event']}' appears to be missing or incomplete: {vfx['description']}",
                    vfx["description"] + " — " + "Add this VFX by implementing the expected signals: " + ", ".join(signals))
            elif coverage < 0.6:
                self._add("low", "vfx", f"vfx_weak_{vfx['event']}",
                    f"[{vfx['category'].upper()}] VFX '{vfx['event']}' only partially implemented ({int(coverage*100)}% signal match).",
                    f"Review and strengthen: {vfx['description']}")

    def _check_vfx_quality(self):
        """Check for common VFX quality issues."""
        combined = self._canvas_src + self._engine_src

        # Check if player invuln flash is different from death
        if "invulnTimer" in combined and "deathTimer" in combined:
            pass  # good — separate states

        # Check if particle colors are varied (not just one color)
        particle_colors = re.findall(r'"#[0-9a-fA-F]{6}"', combined)
        unique_colors = set(particle_colors)
        if len(unique_colors) < 4:
            self._add("medium", "vfx", "low_particle_color_variety",
                f"Only {len(unique_colors)} unique particle colors detected. VFX may feel visually repetitive.",
                "Use distinct colors per system: combat=dark red (#8b0000), ritual=crimson (#9a1616), "
                "signal=teal (#1a7a6e), observation=amber (#c87020), sanity=violet (#4a0a6e).")

        # Check if particles have varying sizes
        particle_sizes = re.findall(r"size\s*[:=]\s*(\d+\.?\d*)", combined)
        if particle_sizes and len(set(particle_sizes)) < 3:
            self._add("low", "vfx", "particle_size_not_varied",
                "Particle sizes appear uniform. VFX may look flat and repetitive.",
                "Vary particle sizes: smaller (1–2px) for ambient dust, medium (3–5px) for hits, large (6–10px) for explosions.")

        # Check if lighting pass exists and is sanity-reactive
        if "sanityFactor" in combined and "darkness" in combined:
            pass  # good — lighting is reactive
        else:
            self._add("high", "vfx", "lighting_not_sanity_reactive",
                "Lighting pass may not react to sanity changes. Key horror VFX missing.",
                "Make the lighting darkness and lantern radius depend on sanity: "
                "at full sanity, bright room; at zero sanity, near-total darkness with only a tiny lantern.")

        # Check if grain/film noise exists
        if "grain" in combined.lower() or ("0.07" in combined and "fillRect" in combined and "1, 1" in combined):
            pass  # good — grain exists
        else:
            self._add("low", "vfx", "no_grain_overlay",
                "No film grain/noise overlay detected. Missed opportunity for horror atmosphere.",
                "Add a subtle grain pass: draw tiny 1x1 pixels at low alpha (0.04–0.08) at random positions each frame.")

    def _check_vfx_density(self):
        """Check if VFX coverage is adequate."""
        combined = self._canvas_src + self._engine_src
        vfx_calls = len(re.findall(r"createParticleExplosion|drawParticles|triggerShake|particles.push", combined))

        if vfx_calls < 5:
            self._add("high", "vfx", "low_vfx_density",
                f"Only {vfx_calls} VFX emission points found. Game likely feels visually empty during action.",
                "Add VFX to: every player hit, every enemy death, every ritual, every loot pickup, "
                "observation threshold crossings, and the boss encounter.")
        elif vfx_calls < 15:
            self._add("low", "vfx", "moderate_vfx_density",
                f"{vfx_calls} VFX emission points found. Coverage is moderate — review for missing moments.",
                "Ensure all combat events, ritual uses, and system transitions have VFX feedback.")

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
