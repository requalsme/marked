"""
The Marked — ExplorerLoreAgent
Profile 4: Prioritizes exploration, secrets, signals, lore,
corpse interactions, and unusual actions.

Behavioral signature:
- Always decodes signals (even false ones — that's the point)
- Interacts with every corpse (tries all 5 options over time)
- Broadcasts corpses for lore fragments
- Reads every Watcher Whisper as intentional content
- Explores every region before advancing
- Avoids pure combat farming (finds it boring)
- Upgrades archive and obfuscation trees (records + hiding)
- Goes idle to observe what the world does without them

Design problems this reveals:
- Signal system — do signals actually communicate useful information?
- Corpse broadcast — is it rewarding or a dead end?
- Are secrets, hidden signals, and lore fragments actually reachable?
- Does the Watcher whisper system say anything coherent?
- Are unused systems visible enough for a curious player to find them?
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import List, Dict, Any
from agents.player_agent import PlayerAgent
from game_state import GameState

CORPSE_ROTATION = ["recover", "burn", "devour", "broadcast", "leave"]


class ExplorerLoreAgent(PlayerAgent):
    PROFILE_NAME = "explorer_lore"
    PROFILE_DESCRIPTION = (
        "Reads every signal, interacts with every corpse, and explores all regions. "
        "Optimizes for lore coverage, not damage. Curiosity-driven."
    )
    PREFERRED_CLASSES = ["Signal Marked", "Bone Marked"]

    def __init__(self):
        super().__init__()
        self._corpse_rotation_index = 0
        self._signals_decoded_this_run = 0

    def choose_action(
        self,
        state: GameState,
        available_actions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        self._action_count += 1

        # Priority 1: ALWAYS decode signals (even bad ones are data)
        signal = self._find_action(available_actions, "decode_signal")
        if signal and state.parchment > 0:
            self._signals_decoded_this_run += 1
            return signal

        # Priority 2: Cycle through corpse actions systematically
        corpse = self._find_action(available_actions, "corpse_action")
        if corpse and state.simulated_time % 300 < 30:  # every 5 sim-minutes
            preferred_action = CORPSE_ROTATION[self._corpse_rotation_index % len(CORPSE_ROTATION)]
            self._corpse_rotation_index += 1
            act = dict(corpse)
            act["data"] = {"preferred_actions": [preferred_action, "broadcast"]}
            return act

        # Priority 3: Upgrade archive and obfuscation (the lore trees)
        for tree in ["archive", "obfuscation", "mind"]:
            upg = self._find_action(available_actions, f"upgrade_{tree}")
            if upg and state.gold >= upg["cost"].get("gold", 0) * 1.1:
                return upg

        # Priority 4: Collect loot (parchment is the explorer's fuel)
        loot = self._find_action(available_actions, "collect_loot")
        if loot:
            return loot

        # Priority 5: Name Removal ritual (the anti-observation ritual — very on-brand)
        r = self._find_action(available_actions, "ritual_name_removal")
        if r and state.observation > 40:
            return r

        # Priority 6: Static Communion (spend sanity to decode a hidden signal)
        r2 = self._find_action(available_actions, "ritual_static_communion")
        if r2 and state.sanity > 40:
            return r2

        # Priority 7: Go idle occasionally to see what offline produces
        idle = self._find_action(available_actions, "go_idle")
        if idle and state.simulated_time % 7200 < 120:  # every 2 sim-hours
            return idle

        # Priority 8: Light patrol (not combat-focused but needs to move)
        patrol = self._find_action(available_actions, "patrol_room")
        if patrol:
            return patrol

        # Priority 9: Attack if unavoidable
        attack = self._find_action(available_actions, "attack_enemy")
        if attack and state.health > state.max_health * 0.45:
            return attack

        return self._fallback(available_actions)

    def on_death(self, cause: str, state: GameState):
        # Explorer resets their corpse rotation each life
        self._corpse_rotation_index = 0
