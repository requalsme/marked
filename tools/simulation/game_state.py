"""
The Marked — Simulation GameState
Holds the simulated state of one run: player stats, inventory, systems, and tracked events.
This is the data object passed through the adapter interface.
"""

import random
import copy

CLASSES = {
    "Blood Marked":   {"baseHealth": 150, "baseDamage": 25, "baseCrit": 0.15, "baseSpeed": 3.5},
    "Signal Marked":  {"baseHealth": 100, "baseDamage": 18, "baseCrit": 0.10, "baseSpeed": 3.8},
    "Bone Marked":    {"baseHealth": 180, "baseDamage": 15, "baseCrit": 0.05, "baseSpeed": 3.0},
    "Static Marked":  {"baseHealth": 110, "baseDamage": 20, "baseCrit": 0.25, "baseSpeed": 4.5},
    "Ritual Marked":  {"baseHealth": 120, "baseDamage": 22, "baseCrit": 0.08, "baseSpeed": 3.4},
}

RARITY_ORDER = ["Worn", "Unsettling", "Cursed", "Relic", "Abyssal", "Impossible"]

TAROT_DECK = [
    "The Tower", "The Moon", "The Devil", "Death", "Judgement", "The Hermit"
]

REALITY_TRAITS = [
    "Static Sky", "Blood Rain", "Bone Bloom", "Mirror Rot", "Hollow Gravity"
]

ENEMIES = [
    {"name": "Cabinet Indexer",  "health": 40,  "damage": 10, "speed": 1.2, "loot_rarity": "Worn"},
    {"name": "Ink Redactor",     "health": 30,  "damage": 6,  "speed": 1.6, "loot_rarity": "Worn"},
    {"name": "Paper Wraith",     "health": 55,  "damage": 9,  "speed": 1.75,"loot_rarity": "Unsettling"},
    {"name": "Witness Chair",    "health": 100, "damage": 15, "speed": 2.0, "loot_rarity": "Unsettling"},
]

BOSS = {"name": "Seal Mother", "health": 250, "damage": 15, "speed": 0.8, "loot_rarity": "Cursed"}

REGIONS = ["The Keeping House", "Ash Fields", "Static Forest", "Drowned Cathedral", "Outer Monolith Ruins"]

RITUAL_NAMES = [
    "Blood Tithe", "Static Communion", "Corpse Lantern", "Black Offering",
    "False Ascension", "Name Removal"
]

CORPSE_ACTIONS = ["recover", "burn", "devour", "broadcast", "leave"]

SIGNAL_TYPES = [
    "Warning Signal", "Memory Signal", "False Signal",
    "Corpse Signal", "Watcher Signal", "Ritual Signal"
]


class GameState:
    """Complete simulated state for one run of The Marked."""

    def __init__(self, seed: int, class_type: str = "Blood Marked"):
        self.seed = seed
        self.rng = random.Random(seed)
        self.class_type = class_type
        cls = CLASSES.get(class_type, CLASSES["Blood Marked"])

        # Core character stats
        self.health = cls["baseHealth"]
        self.max_health = cls["baseHealth"]
        self.damage = cls["baseDamage"]
        self.crit = cls["baseCrit"]
        self.speed = cls["baseSpeed"]
        self.sanity = 100.0
        self.observation = 0.0
        self.level = 1
        self.exp = 0
        self.monolith_level = 1

        # Resources
        self.gold = 150
        self.parchment = 0
        self.ink = 0
        self.wax_seals = 0

        # Gear
        self.gear_slots = {"weapon": None, "armor": None, "amulet": None}
        self.inventory = []  # list of item dicts
        self.highest_rarity_found = "Worn"
        self.pending_loot = 0

        # Meta upgrades
        self.upgrades = {"body": 0, "mind": 0, "ritual": 0, "archive": 0, "obfuscation": 0}

        # World state
        self.current_region = "The Keeping House"
        self.regions_reached = set(["The Keeping House"])
        self.active_tarot = self.rng.choice(TAROT_DECK)
        self.active_reality_trait = self.rng.choice(REALITY_TRAITS)

        # Run tracking
        self.simulated_time = 0.0      # seconds of game-time elapsed
        self.deaths = 0
        self.death_causes = []
        self.current_life_seconds = 0.0
        self.longest_life_seconds = 0.0
        self.survival_times = []

        # Combat tracking
        self.enemies_defeated = 0
        self.bosses_attempted = 0
        self.bosses_defeated = 0
        self.total_damage_dealt = 0
        self.total_damage_taken = 0

        # System interaction tracking
        self.rituals_used = []          # list of {"name": ..., "cost": ..., "time": ...}
        self.corpse_actions_taken = []  # list of {"action": ..., "time": ...}
        self.signals_found = []         # list of {"type": ..., "time": ...}
        self.idle_sessions = []         # list of {"duration": ..., "gold_gained": ..., "obs_gained": ...}
        self.watcher_whispers = 0

        # Behavior tracking (for diagnosis)
        self.move_count = 0
        self.attack_count = 0
        self.retreat_count = 0
        self.sanity_lost_total = 0
        self.loot_collected = 0
        self.gear_equipped_count = 0

        # Pattern detection
        self.action_history = []        # last N actions (for exploit/loop detection)
        self.farming_route_repeats = 0
        self.exploit_flags = []

        # Sanity timeline
        self.sanity_timeline = []       # [(time, sanity), ...]
        self.observation_timeline = []  # [(time, observation), ...]

        # Economy
        self.total_gold_gained = 0
        self.total_gold_spent = 0
        self.gold_gained_idle = 0
        self.gold_gained_active = 0

        # Active diagnosis
        self.active_diagnosis = "Unread / Fresh"

        # Alive flag
        self.alive = True

    def get_sanity_tier(self):
        if self.sanity >= 70:   return "Stable"
        if self.sanity >= 40:   return "Strained"
        if self.sanity >= 15:   return "Fractured"
        return "Broken"

    def get_observation_tier(self):
        if self.observation >= 100: return "Known"
        if self.observation >= 75:  return "Modeled"
        if self.observation >= 50:  return "Studied"
        if self.observation >= 25:  return "Noticed"
        return "Unread"

    def get_rarity_index(self, rarity: str) -> int:
        try:
            return RARITY_ORDER.index(rarity)
        except ValueError:
            return 0

    def update_highest_rarity(self, rarity: str):
        if self.get_rarity_index(rarity) > self.get_rarity_index(self.highest_rarity_found):
            self.highest_rarity_found = rarity

    def record_death(self, cause: str):
        self.deaths += 1
        self.death_causes.append(cause)
        self.survival_times.append(self.current_life_seconds)
        if self.current_life_seconds > self.longest_life_seconds:
            self.longest_life_seconds = self.current_life_seconds

        # On death: reset per-life stats like the real game
        self.current_life_seconds = 0.0
        self.health = self.max_health
        self.sanity = 100.0
        self.observation = 0.0
        self.alive = True

    def to_snapshot(self) -> dict:
        """Return a serializable snapshot of the current state."""
        return {
            "seed": self.seed,
            "class_type": self.class_type,
            "simulated_time": round(self.simulated_time, 1),
            "level": self.level,
            "monolith_level": self.monolith_level,
            "deaths": self.deaths,
            "longest_life_seconds": round(self.longest_life_seconds, 1),
            "average_life_seconds": round(
                sum(self.survival_times) / len(self.survival_times), 1
            ) if self.survival_times else 0,
            "regions_reached": list(self.regions_reached),
            "current_region": self.current_region,
            "enemies_defeated": self.enemies_defeated,
            "bosses_attempted": self.bosses_attempted,
            "bosses_defeated": self.bosses_defeated,
            "highest_rarity_found": self.highest_rarity_found,
            "gold": self.gold,
            "gear_equipped_count": self.gear_equipped_count,
            "rituals_used_count": len(self.rituals_used),
            "rituals_used_names": list({r["name"] for r in self.rituals_used}),
            "corpse_actions": {a: sum(1 for c in self.corpse_actions_taken if c["action"] == a)
                               for a in CORPSE_ACTIONS},
            "signals_found_count": len(self.signals_found),
            "signals_by_type": {t: sum(1 for s in self.signals_found if s["type"] == t)
                                for t in SIGNAL_TYPES},
            "idle_sessions_count": len(self.idle_sessions),
            "gold_gained_idle": self.gold_gained_idle,
            "gold_gained_active": self.gold_gained_active,
            "sanity_lost_total": round(self.sanity_lost_total, 1),
            "final_sanity": round(self.sanity, 1),
            "final_observation": round(self.observation, 1),
            "active_tarot": self.active_tarot,
            "active_reality_trait": self.active_reality_trait,
            "active_diagnosis": self.active_diagnosis,
            "upgrades": self.upgrades.copy(),
            "exploit_flags": self.exploit_flags.copy(),
            "watcher_whispers_triggered": self.watcher_whispers,
        }
