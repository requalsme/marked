"""
The Marked — MockGameAdapter
Implements the GameAdapter interface using an internal Python simulation
of The Marked's game systems. No browser or engine required.

Systems modeled (from src/):
  - state.js: classes, gear, rarity, loot generation
  - engine.js: combat, enemy spawning, observation, sanity
  - idle.js: offline progress calculation
  - systems.js: sanity decay, observation gain, tarot, reality traits

This is the PRIMARY adapter used during development.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import random
import math
from typing import List, Dict, Any, Optional

from adapters.game_adapter import GameAdapter
from game_state import (
    GameState, CLASSES, RARITY_ORDER, TAROT_DECK, REALITY_TRAITS,
    ENEMIES, BOSS, REGIONS, RITUAL_NAMES, CORPSE_ACTIONS, SIGNAL_TYPES
)


# ─── Loot Tables ──────────────────────────────────────────────────────────────

ITEMS_POOL = [
    {"name": "Iron Quill",             "type": "weapon", "rarities": ["Worn","Unsettling","Cursed"],          "stat": "damage",      "min": 8,    "max": 28},
    {"name": "Page-Cutter",            "type": "weapon", "rarities": ["Unsettling","Cursed","Relic"],         "stat": "damage",      "min": 14,   "max": 40},
    {"name": "Whispering Rapier",      "type": "weapon", "rarities": ["Cursed","Relic","Abyssal"],            "stat": "damage",      "min": 20,   "max": 65,  "crit": 0.12},
    {"name": "Epitaph Blade",          "type": "weapon", "rarities": ["Relic","Abyssal","Impossible"],        "stat": "damage",      "min": 35,   "max": 110, "crit": 0.20},
    {"name": "Parchment Vestment",     "type": "armor",  "rarities": ["Worn","Unsettling","Cursed"],          "stat": "health",      "min": 20,   "max": 80,  "armor": 2},
    {"name": "Indexer's Apron",        "type": "armor",  "rarities": ["Unsettling","Cursed","Relic"],         "stat": "health",      "min": 45,   "max": 140, "armor": 5},
    {"name": "Redacted Mail",          "type": "armor",  "rarities": ["Cursed","Relic","Abyssal"],            "stat": "health",      "min": 80,   "max": 240, "armor": 10, "sanityResist": 0.15},
    {"name": "Shroud of Seal Mother",  "type": "armor",  "rarities": ["Relic","Abyssal","Impossible"],        "stat": "health",      "min": 150,  "max": 450, "armor": 18, "sanityResist": 0.25},
    {"name": "Wax Seal Pendant",       "type": "amulet", "rarities": ["Worn","Unsettling","Cursed"],          "stat": "sanityResist","min": 5,    "max": 20},
    {"name": "Cabinet Key",            "type": "amulet", "rarities": ["Unsettling","Cursed","Relic"],         "stat": "signalClarity","min": 10,  "max": 35},
    {"name": "Lantern of Wrong Signals","type": "amulet","rarities": ["Cursed","Relic","Abyssal"],            "stat": "crit",        "min": 8,    "max": 22},
    {"name": "Eye of the Monolith",    "type": "amulet", "rarities": ["Relic","Abyssal","Impossible"],        "stat": "baseDamage",  "min": 15,   "max": 50,  "crit": 0.15},
]

RARITY_MULTIPLIERS = {
    "Worn": 1.0, "Unsettling": 1.5, "Cursed": 2.2,
    "Relic": 3.2, "Abyssal": 4.5, "Impossible": 6.5
}

AFFIXES = [
    {"key": "crit",        "val": 0.05},
    {"key": "speed",       "val": 0.3},
    {"key": "sanityResist","val": 0.08},
    {"key": "goldFind",    "val": 0.15},
    {"key": "obfuscation", "val": 0.10},
]

RITUAL_COSTS = {
    "Blood Tithe":       {"health": 10,  "sanity": 0,  "observation": 5},
    "Static Communion":  {"health": 0,   "sanity": 10, "observation": 3},
    "Corpse Lantern":    {"health": 0,   "sanity": 10, "observation": 0},
    "Black Offering":    {"health": 0,   "sanity": 0,  "observation": 8,  "gear_sacrifice": True},
    "False Ascension":   {"health": 0,   "sanity": 15, "observation": 25},
    "Name Removal":      {"health": 0,   "sanity": 5,  "observation": -20},
}

TAROT_EFFECTS = {
    "The Tower":   {"boss_damage_mult": 1.30, "relic_drop_mult": 2.0},
    "The Moon":    {"signal_rate_mult": 2.0,  "false_signal_chance": 0.40},
    "The Devil":   {"ritual_power_mult": 1.50,"ritual_sanity_cost_mult": 2.0},
    "Death":       {"corpse_gold_mult": 2.0,  "corpse_specters": True},
    "Judgement":   {"observation_mult": 1.50, "clone_spawn_mult": 2.0},
    "The Hermit":  {"idle_gain_mult": 1.40,   "idle_sanity_drain_mult": 1.5},
}

REALITY_EFFECTS = {
    "Static Sky":      {"sanity_decay_mult": 2.0, "signal_auto_decode": True},
    "Blood Rain":      {"healing_mult": 0.5,       "physical_damage_mult": 1.25},
    "Bone Bloom":      {"corpse_resource_mult": 1.30},
    "Mirror Rot":      {"gold_drop_mult": 1.20},
    "Hollow Gravity":  {"idle_gain_mult": 1.30, "survival_stability": -0.15},
}

# Mirrors src/engine.js / src/ui.js / src/idle.js tuning
OBSERVATION_PER_SEC = 0.06          # systems.js
OBSERVATION_MOVING_PER_SEC = 0.024
OBSERVATION_PER_ATTACK = 0.03
SANITY_DECAY_PER_SEC = 0.12
BOSS_OBSERVATION_THRESHOLD = 75
CONFRONTATION_INTERVAL = 600      # seconds alive between Watcher Confrontations
CONFRONTATION_OBSERVATION = 10
BASE_MAX_ENEMIES = 4
IDLE_TO_ACTIVE_MAX_RATIO = 0.5
# Enemies in engine.js chase and strike whether or not the player attacks. Each
# engaged enemy lands a hit with this chance per second (melee cooldown ~1.2s,
# discounted for approach time and misses); retreating halves it for a few seconds.
AMBIENT_HIT_CHANCE_PER_SEC = 0.09
MAX_ENGAGED_ENEMIES = 3
RETREAT_EVADE_SECONDS = 3
# Auto-combat: 60/45 swings per second, ~55% of swings connect while enemies close in
AUTO_COMBAT_HITS_PER_SEC = 0.6
BLOOD_VIAL_CHANCE = 0.15          # engine.js spawnLoot
ENEMY_SCALING_PER_LEVEL = 0.12    # engine.js enemyScale()
BLOOD_VIAL_HEAL_PCT = 0.20
RITUAL_SPAM_WINDOW = 600          # seconds
RITUAL_SPAM_COUNT = 6
DEFAULT_ACTIVE_GOLD_PER_SEC = 0.5
# Actions that are gated by cost, cooldown, enemy supply or wall-clock time and so
# cannot be looped for unbounded reward.
NATURALLY_GATED_ACTIONS = {"attack_enemy", "decode_signal", "go_idle"}


def ritual_cooldown(rituals_this_life: int) -> int:
    """Seconds; mirrors ritualTerms() in ui.js."""
    return round(120 * (1 + 0.5 * rituals_this_life))


DEATH_CAUSES = [
    "Overwhelmed by Cabinet Indexers",
    "Paper Wraith sanity drain — Broken state collapse",
    "Seal Mother wax trap — stood in AOE",
    "Ink Redactor barrage",
    "The Shape ambush — player copy",
    "Observation pressure collapse",
    "Sanity broken — reality fracture event",
    "Witness Chair melee — retreated too late",
    "Ritual cost exceeded available health",
]


class MockGameAdapter(GameAdapter):
    """
    Pure-Python simulation of The Marked's game systems.
    No browser, no engine. Deterministic with seeds.
    
    Update this as new systems are added to the real game.
    """

    def __init__(self):
        self._state: Optional[GameState] = None
        self._enemy_pool: List[Dict] = []
        self._boss_active = False
        self._boss_hp = 0
        self._boss_timer = 0
        self._tick_enemy_timer = 0
        self._tick_boss_timer = 0
        self._survival_seconds = 0.0  # seconds alive this life
        self._ritual_cooldown = 0
        self._rituals_this_life = 0
        self._confrontation_wave = 0
        self._offline_remaining = 0   # seconds the player is away (idle session in progress)
        self._evade_seconds = 0
        self._active_seconds = 0
        self._reward_history: List[bool] = []

    # ─── Interface Methods ────────────────────────────────────────────────────

    def reset(self, seed: int, class_type: str = "Blood Marked") -> GameState:
        self._state = GameState(seed=seed, class_type=class_type)
        self._enemy_pool = []
        self._boss_active = False
        self._boss_hp = 0
        self._tick_enemy_timer = 0
        self._tick_boss_timer = 0
        self._survival_seconds = 0.0
        self._ritual_cooldown = 0
        self._rituals_this_life = 0
        self._confrontation_wave = 0
        self._offline_remaining = 0
        self._evade_seconds = 0
        self._active_seconds = 0
        self._reward_history = []
        return self._state

    def get_state(self) -> GameState:
        return self._state

    def get_available_actions(self) -> List[Dict[str, Any]]:
        s = self._state
        actions = []

        # While offline, the player isn't at the keyboard: no decisions until they return
        if self._offline_remaining > 0:
            return actions

        # Combat actions — always available if alive
        if s.alive and len(self._enemy_pool) > 0:
            actions.append({"id": "attack_enemy", "category": "combat",
                            "cost": {}, "data": {"enemy_count": len(self._enemy_pool)}})
            actions.append({"id": "retreat",    "category": "move",
                            "cost": {}, "data": {}})

        # Move / explore actions
        actions.append({"id": "patrol_room",    "category": "move",   "cost": {}, "data": {}})
        if s.pending_loot > 0:
            actions.append({"id": "collect_loot",   "category": "loot",   "cost": {}, "data": {}})

        # Ritual actions (always present as interactables)
        if self._ritual_cooldown <= 0:
            for ritual in RITUAL_NAMES:
                cost = RITUAL_COSTS.get(ritual, {})
                if self._can_afford_ritual(cost):
                    actions.append({"id": f"ritual_{ritual.lower().replace(' ','_')}",
                                    "category": "ritual", "cost": cost,
                                    "data": {"name": ritual}})

        # Corpse actions
        for corpse in s.corpse_actions_taken[-3:]:  # interact with recent corpses
            actions.append({"id": "corpse_action", "category": "corpse",
                            "cost": {}, "data": {}})

        # Signal decode
        if s.parchment > 0:
            actions.append({"id": "decode_signal", "category": "signal",
                            "cost": {"parchment": 1}, "data": {}})

        # Upgrade (if enough gold)
        if s.gold >= 100:
            for tree in ["body", "mind", "ritual", "archive", "obfuscation"]:
                if s.upgrades[tree] < 5:
                    actions.append({"id": f"upgrade_{tree}", "category": "upgrade",
                                    "cost": {"gold": 100 * (s.upgrades[tree] + 1)},
                                    "data": {"tree": tree}})

        # Idle (available when player chooses to go offline)
        actions.append({"id": "go_idle", "category": "idle",
                        "cost": {}, "data": {}})

        return actions

    def apply_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        s = self._state
        rng = s.rng
        action_id = action.get("id", "")

        # Track action for exploit detection (checked once the outcome is known)
        s.action_history.append(action_id)
        if len(s.action_history) > 200:
            s.action_history.pop(0)
        result = self._apply_action(action_id, action)
        self._reward_history.append(bool(result.get("success")) and result.get("event") != "nothing")
        if len(self._reward_history) > 200:
            self._reward_history.pop(0)
        self._check_exploit_patterns(action_id)
        return result

    def _apply_action(self, action_id: str, action: Dict[str, Any]) -> Dict[str, Any]:
        s = self._state
        rng = s.rng

        # Diminishing returns on spam
        if action_id in ["patrol_room", "collect_loot", "retreat"]:
            streak = 0
            for hist_action in reversed(s.action_history):
                if hist_action == action_id:
                    streak += 1
                else:
                    break
            if streak > 10:
                return {"event": "nothing", "success": False, "data": {"reason": "diminishing_returns"}}

        # ── Combat ─────────────────────────────────────────────────────────────
        if action_id == "attack_enemy":
            return self._resolve_combat_tick()

        elif action_id == "retreat":
            s.retreat_count += 1
            self._evade_seconds = RETREAT_EVADE_SECONDS
            # Retreating takes a sanity hit if enemies are close
            if len(self._enemy_pool) > 2:
                s.sanity = max(0, s.sanity - 3)
                s.sanity_lost_total += 3
            return {"event": "retreat", "success": True, "data": {}}

        # ── Movement ───────────────────────────────────────────────────────────
        elif action_id == "patrol_room":
            s.move_count += 1
            # Small observation gain from movement
            s.observation = min(100, s.observation + rng.uniform(0.01, 0.05))
            # Rare loot find on floor
            if rng.random() < 0.04:
                item = self._generate_loot("Worn")
                if len(s.inventory) < 15:
                    s.inventory.append(item)
                    s.loot_collected += 1
                    return {"event": "loot_collected", "success": True,
                            "data": {"item": item["name"], "rarity": item["rarity"]}}
            return {"event": "nothing", "success": True, "data": {}}

        # ── Loot ───────────────────────────────────────────────────────────────
        elif action_id == "collect_loot":
            if s.pending_loot <= 0:
                return {"event": "nothing", "success": False, "data": {"reason": "no_loot"}}
            s.pending_loot -= 1
            s.loot_collected += 1
            gold = rng.randint(10, 35)
            s.gold += gold
            s.gold_gained_active += gold
            s.total_gold_gained += gold
            parchment = 1 if rng.random() < 0.25 else 0
            s.parchment += parchment
            return {"event": "loot_collected", "success": True,
                    "data": {"gold": gold, "parchment": parchment}}

        # ── Rituals ────────────────────────────────────────────────────────────
        elif action_id.startswith("ritual_"):
            ritual_name = action.get("data", {}).get("name", "")
            return self._perform_ritual(ritual_name)

        # ── Corpse ─────────────────────────────────────────────────────────────
        elif action_id == "corpse_action":
            return self._perform_corpse_action()

        # ── Signals ────────────────────────────────────────────────────────────
        elif action_id == "decode_signal":
            return self._decode_signal()

        # ── Upgrades ───────────────────────────────────────────────────────────
        elif action_id.startswith("upgrade_"):
            tree = action.get("data", {}).get("tree", "")
            return self._purchase_upgrade(tree)

        # ── Idle ───────────────────────────────────────────────────────────────
        elif action_id == "go_idle":
            return self._simulate_idle_session()

        return {"event": "nothing", "success": False, "data": {"reason": f"Unknown action: {action_id}"}}

    def advance_time(self, ticks: int) -> List[Dict[str, Any]]:
        """
        Advance by N ticks (each = 1 simulated second).
        Processes passive systems: sanity decay, observation gain, enemy spawning.
        """
        s = self._state
        events = []

        for _ in range(ticks):
            s.simulated_time += 1

            # Offline: gains were already granted by the idle report; the world is paused
            if self._offline_remaining > 0:
                self._offline_remaining -= 1
                continue

            self._active_seconds += 1
            self._survival_seconds += 1
            s.current_life_seconds += 1
            if self._ritual_cooldown > 0:
                self._ritual_cooldown -= 1
            # Combat regen is not modeled tick by tick; the real game has no passive regen

            # Sanity decay (from systems.js: ~0.015/tick base, reduced by gear)
            self._apply_sanity_decay()

            # Observation gain
            self._apply_observation_gain()

            # Enemy spawn timer (engine.js: every 4000ms = ~4 ticks, capped by Observation)
            self._tick_enemy_timer += 1
            if self._tick_enemy_timer >= 4:
                self._tick_enemy_timer = 0
                max_enemies = BASE_MAX_ENEMIES + int(s.observation // 25)
                if not self._boss_active and len(self._enemy_pool) < max_enemies and rng_chance(s.rng, 0.3):
                    self._spawn_enemy()

            self._auto_combat()
            self._apply_enemy_pressure()

            # Boss: the Seal Mother wakes once Observation reaches the threshold (engine.js)
            if not self._boss_active and s.observation >= BOSS_OBSERVATION_THRESHOLD:
                self._spawn_boss()
                events.append({"event": "boss_spawned", "data": {}})

            # Recurring pressure: Watcher Confrontation every CONFRONTATION_INTERVAL alive
            wave = int(self._survival_seconds // CONFRONTATION_INTERVAL)
            if wave > self._confrontation_wave:
                self._confrontation_wave = wave
                self._trigger_confrontation(wave)
                events.append({"event": "pressure_event", "data": {"wave": wave}})

            # Random signal intercept (background noise)
            if s.rng.random() < 0.0008:  # ~3 per hour
                sig = self._intercept_background_signal()
                events.append({"event": "signal_intercepted", "data": sig})

            # Death check: if health <= 0
            if s.health <= 0 and s.alive:
                cause = self._determine_death_cause()
                events.append({"event": "player_died", "data": {"cause": cause}})
                s.record_death(cause)
                self.on_death(cause, s)
                self._enemy_pool = []
                self._boss_active = False
                self._survival_seconds = 0.0
                self._confrontation_wave = 0
                self._rituals_this_life = 0
                self._ritual_cooldown = 0

            # Observation threshold events
            obs = s.observation
            for threshold, tier in [(25, "Noticed"), (50, "Studied"), (75, "Modeled"), (100, "Known")]:
                if obs - (0.005) < threshold <= obs:
                    events.append({"event": "observation_threshold", "data": {"tier": tier}})
                    self.on_observation_threshold(tier, s)
                    s.watcher_whispers += 1

        return events

    def get_metrics(self) -> Dict[str, Any]:
        s = self._state
        return {
            **s.to_snapshot(),
            "enemies_on_screen": len(self._enemy_pool),
            "boss_active": self._boss_active,
            "current_life_seconds": round(s.current_life_seconds, 1),
            "sanity_tier": s.get_sanity_tier(),
            "observation_tier": s.get_observation_tier(),
        }

    def end_run(self) -> Dict[str, Any]:
        s = self._state
        # Final life counts
        if s.current_life_seconds > 0:
            s.survival_times.append(s.current_life_seconds)
            if s.current_life_seconds > s.longest_life_seconds:
                s.longest_life_seconds = s.current_life_seconds
        return self.get_metrics()

    # ─── Internal Helpers ─────────────────────────────────────────────────────

    def _can_afford_ritual(self, cost: dict) -> bool:
        s = self._state
        if self._ritual_cooldown > 0:
            return False
        if cost.get("health", 0) > 0 and s.health <= cost["health"]:
            return False
        if cost.get("sanity", 0) > 0 and s.sanity < cost["sanity"]:
            return False
        return True

    def _resolve_combat_tick(self) -> Dict[str, Any]:
        s = self._state
        rng = s.rng

        if not self._enemy_pool:
            return {"event": "nothing", "success": False, "data": {"reason": "no_enemies"}}

        # Attack an enemy
        target = self._enemy_pool[0]
        s.attack_count += 1
        
        # Simulate time passing during combat to match real game attackDelay
        self.advance_time(1)
        if target not in self._enemy_pool:
            # The player died (pool cleared) or the target vanished during that second
            return {"event": "nothing", "success": False, "data": {"reason": "target_gone"}}

        dmg = self._player_hit(target)
        if target["hp"] <= 0:
            gold_gain = self._on_enemy_killed(target)
            return {"event": "enemy_killed", "success": True,
                    "data": {"enemy": target["name"], "gold": gold_gain}}

        return {"event": "combat_tick", "success": True,
                "data": {"damage_dealt": dmg, "damage_taken": 0}}

    def _player_hit(self, target: dict) -> int:
        s = self._state
        crit = s.rng.random() < s.crit
        # Blood Rain reality trait boosts physical damage
        dmg_mult = REALITY_EFFECTS.get(s.active_reality_trait, {}).get("physical_damage_mult", 1.0)
        dmg = round(s.damage * dmg_mult * (1.7 if crit else 1.0))
        target["hp"] -= dmg
        s.total_damage_dealt += dmg
        s.observation = min(100, s.observation + OBSERVATION_PER_ATTACK)
        return dmg

    def _auto_combat(self):
        """engine.js auto-combat (on by default): ~1.33 swings/s at the nearest enemy."""
        s = self._state
        if not self._enemy_pool or not s.alive:
            return
        if s.rng.random() < AUTO_COMBAT_HITS_PER_SEC:
            target = self._enemy_pool[0]
            self._player_hit(target)
            if target["hp"] <= 0:
                self._on_enemy_killed(target)

    def _on_enemy_killed(self, target: dict) -> int:
        s = self._state
        rng = s.rng
        self._enemy_pool.remove(target)
        s.enemies_defeated += 1
        if target.get("is_boss"):
            self._on_boss_defeated()
        gold_gain = {"Worn": 12, "Unsettling": 25, "Cursed": 60}.get(target.get("loot_rarity", "Worn"), 12)
        s.gold += gold_gain
        s.gold_gained_active += gold_gain
        s.total_gold_gained += gold_gain
        s.exp += 15
        s.exp_gained_active = getattr(s, "exp_gained_active", 0) + 15
        s.pending_loot += 1

        # Drop table (engine.js spawnLoot): blood vial, sanity shard, gear
        if rng.random() < BLOOD_VIAL_CHANCE:
            s.health = min(s.max_health, s.health + round(s.max_health * BLOOD_VIAL_HEAL_PCT))
        if rng.random() < 0.25:
            s.sanity = min(100, s.sanity + 15)
        if rng.random() < 0.20:
            item = self._generate_loot(target.get("loot_rarity", "Worn"))
            if len(s.inventory) < 15:
                s.inventory.append(item)
                s.loot_collected += 1
                # Auto-equip if better
                self._maybe_equip(item)

        # Level up check (main.js: level up heals to full)
        exp_needed = s.level * 100
        if s.exp >= exp_needed:
            s.exp -= exp_needed
            s.level += 1
            s.max_health += 10
            s.health = s.max_health
        return gold_gain

    def _perform_ritual(self, ritual_name: str) -> Dict[str, Any]:
        s = self._state
        rng = s.rng

        cost = RITUAL_COSTS.get(ritual_name, {})
        tarot_eff = TAROT_EFFECTS.get(s.active_tarot, {})

        # Apply costs
        health_cost = cost.get("health", 0)
        sanity_cost = cost.get("sanity", 0)
        if s.active_tarot == "The Devil":
            sanity_cost = round(sanity_cost * tarot_eff.get("ritual_sanity_cost_mult", 2.0))

        obs_cost = cost.get("observation", 0)

        if not self._can_afford_ritual(cost):
            return {"event": "nothing", "success": False, "data": {"reason": "cannot_afford"}}

        self._ritual_cooldown = ritual_cooldown(self._rituals_this_life)
        self._rituals_this_life += 1

        s.health = max(1, s.health - health_cost)
        s.sanity = max(0, s.sanity - sanity_cost)
        s.sanity_lost_total += sanity_cost
        s.observation = max(0, min(100, s.observation + obs_cost))

        # Power bonus
        power_mult = tarot_eff.get("ritual_power_mult", 1.0) if s.active_tarot == "The Devil" else 1.0
        # Rewards thin with each bargain this life (ritualTerms in ui.js)
        bonus_damage = round(rng.uniform(5, 20) * power_mult / (1 + 0.35 * (self._rituals_this_life - 1)))
        s.damage += round(bonus_damage * 0.1)  # small permanent buff

        s.rituals_used.append({
            "name": ritual_name,
            "cost": cost,
            "time": s.simulated_time
        })
        s.observation = min(100, s.observation + rng.uniform(0.5, 2.0))

        return {"event": "ritual_performed", "success": True,
                "data": {"ritual": ritual_name, "bonus": bonus_damage}}

    def _perform_corpse_action(self) -> Dict[str, Any]:
        s = self._state
        rng = s.rng

        action = rng.choice(CORPSE_ACTIONS)
        result = {"action": action, "time": s.simulated_time}
        s.corpse_actions_taken.append(result)

        bone_bloom = REALITY_EFFECTS.get(s.active_reality_trait, {}).get("corpse_resource_mult", 1.0)
        death_tarot = TAROT_EFFECTS.get(s.active_tarot, {}).get("corpse_gold_mult", 1.0)

        gold_reward = 0
        if action == "recover":
            gold_reward = round(rng.randint(20, 80) * bone_bloom * death_tarot)
            s.gold += gold_reward
            s.gold_gained_active += gold_reward
        elif action == "burn":
            s.sanity = min(100, s.sanity + 15)
            s.observation = max(0, s.observation - 5)
        elif action == "devour":
            s.health = min(s.max_health, s.health + 20)
            s.observation = min(100, s.observation + 8)
        elif action == "broadcast":
            s.parchment += 2
            sig_type = rng.choice(SIGNAL_TYPES)
            s.signals_found.append({"type": "Corpse Signal", "time": s.simulated_time})
        elif action == "leave":
            # May spawn a hostile specter later
            pass

        return {"event": "corpse_action", "success": True,
                "data": {"action": action, "gold": gold_reward}}

    def _decode_signal(self) -> Dict[str, Any]:
        s = self._state
        rng = s.rng

        if s.parchment <= 0:
            return {"event": "nothing", "success": False, "data": {"reason": "no_parchment"}}

        s.parchment -= 1
        moon_effects = TAROT_EFFECTS.get(s.active_tarot, {})
        false_chance = moon_effects.get("false_signal_chance", 0.10) if s.active_tarot == "The Moon" else 0.10

        # At low sanity, more false signals
        if s.sanity < 40:
            false_chance += 0.20

        sig_type = "False Signal" if rng.random() < false_chance else rng.choice(
            ["Warning Signal", "Memory Signal", "Watcher Signal", "Ritual Signal"]
        )
        s.signals_found.append({"type": sig_type, "time": s.simulated_time})
        s.watcher_whispers += 1 if sig_type == "Watcher Signal" else 0

        return {"event": "signal_decoded", "success": True, "data": {"type": sig_type}}

    def _purchase_upgrade(self, tree: str) -> Dict[str, Any]:
        s = self._state
        if tree not in s.upgrades:
            return {"event": "nothing", "success": False, "data": {"reason": "invalid_tree"}}

        cost = 100 * (s.upgrades[tree] + 1)
        if s.gold < cost:
            return {"event": "nothing", "success": False, "data": {"reason": "not_enough_gold"}}

        s.gold -= cost
        s.total_gold_spent += cost
        s.upgrades[tree] += 1

        # Apply upgrade effects
        if tree == "body":
            s.max_health += 10
            s.health = min(s.health + 10, s.max_health)
        elif tree == "mind":
            pass  # affects sanity decay rate (calculated at runtime)

        return {"event": "upgrade_purchased", "success": True,
                "data": {"tree": tree, "new_level": s.upgrades[tree]}}

    def _simulate_idle_session(self) -> Dict[str, Any]:
        """Simulate going offline — mirrors idle.js calculateOfflineProgress."""
        s = self._state
        rng = s.rng

        # Random offline duration: 30 min to 8 hours
        offline_sec = rng.randint(1800, 28800)
        offline_sec = min(offline_sec, 43200)  # cap 12h like real game

        body_up = s.upgrades["body"]
        mind_up = s.upgrades["mind"]
        obf_up  = s.upgrades["obfuscation"]

        survival_chance = min(0.95, 0.65 + body_up * 0.05)
        survived_sec = int(offline_sec * survival_chance)
        survived_min = survived_sec / 60

        # Gains (idle.js): base formula x Hermit bonus, capped at half the active rate
        idle_mult = TAROT_EFFECTS.get(s.active_tarot, {}).get("idle_gain_mult", 1.0)
        if self._active_seconds >= 300:
            active_gold_rate = s.gold_gained_active / self._active_seconds
            active_exp_rate = getattr(s, "exp_gained_active", 0) / self._active_seconds
        else:
            active_gold_rate, active_exp_rate = DEFAULT_ACTIVE_GOLD_PER_SEC, 0.6
        exp_gain   = round(min(survived_min * 8 * idle_mult, active_exp_rate * IDLE_TO_ACTIVE_MAX_RATIO * survived_sec))
        gold_gain  = round(min(survived_min * 0.1 * idle_mult, 150,
                               active_gold_rate * IDLE_TO_ACTIVE_MAX_RATIO * survived_sec))

        parchment_gain = sum(1 for _ in range(int(survived_min)) if rng.random() < 0.15 * idle_mult)
        ink_gain       = sum(1 for _ in range(int(survived_min)) if rng.random() < 0.08 * idle_mult)
        wax_gain       = sum(1 for _ in range(int(survived_min)) if rng.random() < 0.04 * idle_mult)

        # Sanity drain
        sanity_drain_mult = TAROT_EFFECTS.get(s.active_tarot, {}).get("idle_sanity_drain_mult", 1.0)
        sanity_drain = round(survived_min * 0.35 * (1 - mind_up * 0.10) * sanity_drain_mult)
        actual_sanity_lost = min(sanity_drain, s.sanity)
        s.sanity = max(0, s.sanity - sanity_drain)
        s.sanity_lost_total += actual_sanity_lost

        # Observation gain
        obs_gain = survived_min * 0.08 * (1 - obf_up * 0.12)
        if s.active_tarot == "Judgement":
            obs_gain *= 1.5
        s.observation = min(100, s.observation + obs_gain)

        # Apply gains
        s.gold += gold_gain
        s.gold_gained_idle += gold_gain
        s.total_gold_gained += gold_gain
        s.exp += exp_gain
        s.parchment += parchment_gain
        s.ink += ink_gain
        s.wax_seals += wax_gain
        # Offline time passes on the clock; advance_time() consumes it
        self._offline_remaining = offline_sec

        # Loot rolls during offline
        loot_rolls = int(survived_min / 15)
        items_found = []
        for _ in range(loot_rolls):
            if rng.random() < 0.30 and len(s.inventory) < 15:
                item = self._generate_loot("Cursed")
                s.inventory.append(item)
                self._maybe_equip(item)
                items_found.append(item["name"])

        s.idle_sessions.append({
            "duration_sec": offline_sec,
            "gold_gained":  gold_gain,
            "obs_gained":   round(obs_gain, 2),
            "sanity_lost":  actual_sanity_lost,
            "items_found":  items_found,
        })

        return {
            "event":      "idle_session_complete",
            "success":    True,
            "data": {
                "duration_sec":  offline_sec,
                "gold":          gold_gain,
                "parchment":     parchment_gain,
                "sanity_lost":   actual_sanity_lost,
                "obs_gained":    round(obs_gain, 2),
                "items_found":   items_found,
            }
        }

    def _apply_sanity_decay(self):
        """Mirror systems.js handleSanityDecay."""
        s = self._state
        base_decay = SANITY_DECAY_PER_SEC
        mind_up = s.upgrades["mind"]
        mind_mod = 1.0 - mind_up * 0.12

        sanity_resist = sum(g.get("sanityResist", 0) for g in s.gear_slots.values() if g)
        sanity_resist = min(0.8, sanity_resist)
        equip_mod = 1.0 - sanity_resist

        reality_mod = REALITY_EFFECTS.get(s.active_reality_trait, {}).get("sanity_decay_mult", 1.0)
        tarot_mod   = TAROT_EFFECTS.get(s.active_tarot, {}).get("ritual_sanity_cost_mult", 1.0) \
                      if s.active_tarot == "The Devil" else 1.0

        final_decay = base_decay * mind_mod * equip_mod * reality_mod
        s.sanity = max(0, s.sanity - final_decay)
        s.sanity_lost_total += final_decay

    def _apply_observation_gain(self):
        """Mirror systems.js updateObservation."""
        s = self._state
        base_gain = OBSERVATION_PER_SEC
        obf_mod   = 1.0 - s.upgrades["obfuscation"] * 0.15
        tarot_mod = TAROT_EFFECTS.get(s.active_tarot, {}).get("observation_mult", 1.0) \
                    if s.active_tarot == "Judgement" else 1.0

        total_gain = base_gain * obf_mod * tarot_mod
        if s.move_count > 0:
            total_gain += OBSERVATION_MOVING_PER_SEC * obf_mod

        s.observation = min(100, s.observation + total_gain)

        # Update diagnosis
        style = "Aggressive"
        if s.retreat_count > s.attack_count * 0.5:
            style = "Evasive"
        elif s.sanity_lost_total > s.attack_count * 2:
            style = "Neglectful"

        system_dep = "Gear-dependent"
        if len(s.corpse_actions_taken) > 3:
            system_dep = "Corpse-preserving"
        elif s.upgrades.get("ritual", 0) > 2:
            system_dep = "Ritual-dependent"
        elif len(s.idle_sessions) > len(s.rituals_used):
            system_dep = "Idle-heavy"

        s.active_diagnosis = f"{style} / {system_dep}"

    def _spawn_enemy(self):
        s = self._state
        rng = s.rng

        # Higher observation → harder enemies
        obs = s.observation
        roll = rng.random()
        if obs > 70 and roll < 0.10:
            # The Shape clone
            template = {"name": "The Shape", "hp": s.max_health * 0.8,
                        "damage": round(s.damage * 0.6), "sanity_damage": 5,
                        "loot_rarity": "Relic"}
        elif obs > 50 and roll < 0.25:
            template = dict(ENEMIES[3])  # Witness Chair
            template["hp"] = template["health"]
        elif roll < 0.50:
            template = dict(ENEMIES[2])  # Paper Wraith
            template["hp"] = template["health"]
        elif roll < 0.75:
            template = dict(ENEMIES[1])  # Ink Redactor
            template["hp"] = template["health"]
            template["sanity_damage"] = 12
        else:
            template = dict(ENEMIES[0])  # Cabinet Indexer
            template["hp"] = template["health"]

        self._enemy_pool.append(self._scaled(template))

    def _scaled(self, template: dict) -> dict:
        """engine.js enemyScale(): non-Shape enemies grow with player level."""
        if template.get("name") == "The Shape":
            return template
        scale = 1 + ENEMY_SCALING_PER_LEVEL * max(0, self._state.level - 1)
        template["hp"] = round(template["hp"] * scale)
        template["damage"] = round(template["damage"] * scale)
        return template

    def _spawn_boss(self):
        s = self._state
        self._boss_active = True
        self._boss_hp = BOSS["health"]
        self._tick_boss_timer = 0
        s.bosses_attempted += 1
        boss = {"name": BOSS["name"], "hp": BOSS["health"], "damage": 18,
                "loot_rarity": "Cursed", "is_boss": True}
        if s.active_tarot == "The Tower":
            boss["damage"] = round(boss["damage"] * TAROT_EFFECTS["The Tower"]["boss_damage_mult"])
        self._enemy_pool.insert(0, self._scaled(boss))

    def _on_boss_defeated(self):
        """Boss down → door opens → the player escapes (main.js triggerVictory)."""
        s = self._state
        self._boss_active = False
        s.bosses_defeated = getattr(s, "bosses_defeated", 0) + 1
        s.exp += 300
        s.observation = 0
        self._enemy_pool = []
        self._survival_seconds = 0.0
        self._confrontation_wave = 0
        self._rituals_this_life = 0
        s.sanity = 100

    def _apply_enemy_pressure(self):
        s = self._state
        if not self._enemy_pool or not s.alive:
            return
        if self._evade_seconds > 0:
            self._evade_seconds -= 1
        chance = AMBIENT_HIT_CHANCE_PER_SEC * (0.5 if self._evade_seconds > 0 else 1.0)
        armor = sum(g.get("armor", 0) for g in s.gear_slots.values() if g)
        resist = min(0.8, sum(g.get("sanityResist", 0) for g in s.gear_slots.values() if g))
        for enemy in self._enemy_pool[:MAX_ENGAGED_ENEMIES]:
            if s.rng.random() < chance:
                dmg = max(1, round(enemy["damage"] * (20 / (20 + armor))))
                s.health -= dmg
                s.total_damage_taken += dmg
                if enemy.get("sanity_damage", 0) > 0:
                    sd = round(enemy["sanity_damage"] * (1 - resist))
                    s.sanity = max(0, s.sanity - sd)
                    s.sanity_lost_total += sd

    def _trigger_confrontation(self, wave: int):
        """Mirror engine.js triggerConfrontation."""
        s = self._state
        s.observation = min(100, s.observation + CONFRONTATION_OBSERVATION)
        shapes = 1 + wave // 3
        chairs = wave // 2
        for _ in range(shapes):
            self._enemy_pool.append({"name": "The Shape", "hp": s.max_health * 0.8,
                                     "damage": round(s.damage * 0.6), "sanity_damage": 5,
                                     "loot_rarity": "Relic"})
        for _ in range(chairs):
            template = dict(ENEMIES[3])
            template["hp"] = template["health"]
            self._enemy_pool.append(self._scaled(template))

    def _determine_death_cause(self) -> str:
        s = self._state
        rng = s.rng
        # Weight causes by game state
        if s.sanity < 15:
            return "Sanity broken — reality fracture event"
        if self._boss_active:
            return "Seal Mother wax trap — stood in AOE"
        return rng.choice(DEATH_CAUSES)

    def _intercept_background_signal(self) -> dict:
        s = self._state
        rng = s.rng
        moon = TAROT_EFFECTS.get(s.active_tarot, {})
        false_chance = moon.get("false_signal_chance", 0.10) if s.active_tarot == "The Moon" else 0.05
        sig_type = "False Signal" if rng.random() < false_chance else rng.choice(SIGNAL_TYPES[:-1])
        record = {"type": sig_type, "time": s.simulated_time}
        s.signals_found.append(record)
        return record

    def _generate_loot(self, rarity_limit: str = "Cursed") -> dict:
        s = self._state
        rng = s.rng
        limit_idx = RARITY_ORDER.index(rarity_limit) if rarity_limit in RARITY_ORDER else 2

        archetype = rng.choice(ITEMS_POOL)
        available = [r for r in archetype["rarities"] if RARITY_ORDER.index(r) <= limit_idx]
        rarity = rng.choice(available) if available else archetype["rarities"][0]

        mult = RARITY_MULTIPLIERS[rarity]
        base_val = round(archetype["min"] + rng.random() * (archetype["max"] - archetype["min"]))
        value = round(base_val * mult)

        item = {
            "name":   archetype["name"],
            "type":   archetype["type"],
            "rarity": rarity,
        }
        stat = archetype["stat"]
        if stat == "damage":      item["damage"] = value
        elif stat == "health":
            item["health"] = value
            item["armor"]  = round((archetype.get("armor", 2)) * mult)
        elif stat == "sanityResist":  item["sanityResist"] = round(value / 100, 2)
        elif stat == "signalClarity": item["signalClarity"] = round(value / 100, 2)
        elif stat == "crit":          item["crit"] = round(value / 100, 2)
        elif stat == "baseDamage":    item["damage"] = value

        # Sub-affix on higher rarities
        if rarity in ("Cursed", "Relic", "Abyssal", "Impossible"):
            affix = rng.choice(AFFIXES)
            item["affix"] = affix

        s.update_highest_rarity(rarity)
        return item

    def _maybe_equip(self, item: dict):
        """Auto-equip if better than current slot item."""
        s = self._state
        slot = item["type"]  # weapon / armor / amulet
        current = s.gear_slots.get(slot)

        def item_score(i):
            if not i: return 0
            score = 0
            score += i.get("damage", 0) * 2
            score += i.get("health", 0)
            score += i.get("armor", 0) * 5
            score += i.get("crit", 0) * 100
            score += i.get("sanityResist", 0) * 80
            rarity_bonus = RARITY_ORDER.index(i.get("rarity","Worn")) * 10
            return score + rarity_bonus

        if item_score(item) > item_score(current):
            s.gear_slots[slot] = item
            s.gear_equipped_count += 1

    def _check_exploit_patterns(self, action_id: str):
        s = self._state
        # Same action repeated many times in a row
        # A loop is only an exploit if it keeps paying out: every one of the last N
        # identical actions must have produced a reward, and the action must not be
        # gated by cost, cooldown, enemy supply or wall-clock time.
        streak = SIMULATION_CONFIG.get("exploit_same_action_streak", 50)
        if len(s.action_history) >= streak and action_id not in NATURALLY_GATED_ACTIONS:
            recent = s.action_history[-streak:]
            if len(set(recent)) == 1 and all(self._reward_history[-streak:]):
                flag = f"exploit_loop:{action_id}:streak_{streak}"
                if flag not in s.exploit_flags:
                    s.exploit_flags.append(flag)

        # Rapid ritual spam
        # Ritual spam: too many successful rituals inside a sim-time window
        ritual_recent = [r for r in s.rituals_used if s.simulated_time - r["time"] <= RITUAL_SPAM_WINDOW]
        if len(ritual_recent) >= RITUAL_SPAM_COUNT:
            flag = "exploit_ritual_spam"
            if flag not in s.exploit_flags:
                s.exploit_flags.append(flag)

    def describe(self) -> str:
        return "MockGameAdapter (pure Python, no browser)"


# Inline access to thresholds
SIMULATION_CONFIG = {
    "exploit_same_action_streak": 50
}


def rng_chance(rng: random.Random, probability: float) -> bool:
    return rng.random() < probability
