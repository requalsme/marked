"""
The Marked — RitualAddictAgent
Profile 3: Uses risky mechanics often for short-term power, accepts
dangerous bargains, and runs low sanity frequently.

Behavioral signature:
- Uses rituals every chance it gets, even costly ones
- Accepts Blood Tithe (lose max HP) and False Ascension (spike observation)
- Devours corpses for power, rarely burns them
- Stays in Fractured sanity range on purpose (higher damage affixes)
- Treats death as acceptable if a ritual powered the run
- Does not worry about observation growth

Design problems this reveals:
- Ritual power ceiling — are they overpowered or useless?
- Sanity Broken state — does it actually punish or reward?
- Observation spike from False Ascension — does it feel scary?
- Whether ritual-only builds can sustain progression without gear
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import List, Dict, Any
from agents.player_agent import PlayerAgent
from game_state import GameState


class RitualAddictAgent(PlayerAgent):
    PROFILE_NAME = "ritual_addict"
    PROFILE_DESCRIPTION = (
        "Accepts every dangerous bargain. Uses rituals constantly, "
        "runs at low sanity on purpose, and devours corpses for power. "
        "Treats death as acceptable collateral damage."
    )
    PREFERRED_CLASSES = ["Ritual Marked", "Blood Marked"]

    # Ritual priority order (most addictive first)
    RITUAL_PRIORITY = [
        "ritual_false_ascension",
        "ritual_blood_tithe",
        "ritual_corpse_lantern",
        "ritual_static_communion",
        "ritual_black_offering",
        "ritual_name_removal",
    ]

    def choose_action(
        self,
        state: GameState,
        available_actions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        self._action_count += 1

        # Priority 1: Perform a ritual (any ritual, prioritize high-power ones)
        for ritual_id in self.RITUAL_PRIORITY:
            r = self._find_action(available_actions, ritual_id)
            if r:
                # Only hard limit: don't die from the ritual itself
                if state.health > 15 or "blood" not in ritual_id:
                    return r

        # Priority 2: Corpse action — devour is preferred (power), then leave
        corpse = self._find_action(available_actions, "corpse_action")
        if corpse:
            preferred = dict(corpse)
            preferred["data"] = {"preferred_actions": ["devour", "leave", "broadcast"]}
            return preferred

        # Priority 3: Attack enemies (need combat to generate corpse opportunities)
        attack = self._find_action(available_actions, "attack_enemy")
        if attack:
            return attack

        # Priority 4: Upgrade ritual tree first, then mind (sanity survival)
        for tree in ["ritual", "mind", "body"]:
            upg = self._find_action(available_actions, f"upgrade_{tree}")
            if upg and state.gold >= upg["cost"].get("gold", 0):
                return upg

        # Priority 5: Decode signals (looking for ritual hints)
        signal = self._find_action(available_actions, "decode_signal")
        if signal and state.parchment > 0:
            return signal

        # Priority 6: Collect loot (for more gold to fund rituals)
        loot = self._find_action(available_actions, "collect_loot")
        if loot:
            return loot

        return self._fallback(available_actions)
