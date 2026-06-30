"""
The Marked — MinMaxerAgent
Profile 1: Optimizes for the strongest build, fastest progression,
best loot, and most efficient farming.

Behavioral signature:
- Always attacks enemies; never retreats unless near death
- Prioritizes gear upgrades and meta tree investments
- Farms bosses aggressively
- Avoids rituals with high observation cost unless power gain is extreme
- Decodes signals only when parchment is plentiful
- Never goes idle (always active)
- Quickly identifies and exploits dominant damage loops

Design problems this reveals:
- Damage/gear ceiling too low or too high
- Boss farming too easy/rewarding
- Any dominant upgrade path that trivializes content
- Gear rarity inflation
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import List, Dict, Any
from agents.player_agent import PlayerAgent
from game_state import GameState


class MinMaxerAgent(PlayerAgent):
    PROFILE_NAME = "minmaxer"
    PROFILE_DESCRIPTION = (
        "Optimizes relentlessly. Prioritizes damage upgrades, boss farming, "
        "and the most efficient gold-to-power conversion. Never retreats."
    )
    PREFERRED_CLASSES = ["Static Marked", "Blood Marked"]

    def choose_action(
        self,
        state: GameState,
        available_actions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        self._action_count += 1

        # Priority 1: Attack if enemies present (never retreat)
        attack = self._find_action(available_actions, "attack_enemy")
        if attack:
            return attack

        # Priority 2: Buy the body/damage upgrade if affordable
        # MinMaxer prefers body > ritual > mind in that order
        for tree in ["body", "ritual", "obfuscation"]:
            upg = self._find_action(available_actions, f"upgrade_{tree}")
            if upg and state.gold >= upg["cost"].get("gold", 9999):
                # Only upgrade if at high gold to avoid starving
                if state.gold >= upg["cost"].get("gold", 0) * 1.5:
                    return upg

        # Priority 3: Ritual for power if it's worth the cost
        # MinMaxer uses False Ascension and Blood Tithe for maximum gain
        for ritual_id in ["ritual_false_ascension", "ritual_blood_tithe"]:
            r = self._find_action(available_actions, ritual_id)
            if r and state.sanity > 50 and state.health > state.max_health * 0.5:
                return r

        # Priority 4: Collect loot aggressively
        loot = self._find_action(available_actions, "collect_loot")
        if loot and state.simulated_time % 30 < 15:  # keep collecting
            return loot

        # Priority 5: Decode signals if parchment surplus
        signal = self._find_action(available_actions, "decode_signal")
        if signal and state.parchment >= 5:
            return signal

        # Priority 6: Upgrade remaining trees
        for tree in ["archive", "mind"]:
            upg = self._find_action(available_actions, f"upgrade_{tree}")
            if upg and state.gold >= upg["cost"].get("gold", 0) * 2:
                return upg

        # Priority 7: Patrol aggressively to find enemies
        return self._fallback(available_actions)
