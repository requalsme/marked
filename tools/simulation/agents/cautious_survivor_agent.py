"""
The Marked — CautiousSurvivorAgent
Profile 2: Avoids risk, retreats often, protects health and sanity,
and refuses dangerous bargains.

Behavioral signature:
- Retreats the moment health drops below 60%
- Never uses rituals that cost health or >10 sanity
- Prioritizes mind and body upgrades (survivability)
- Always recovers or burns corpses (never devours, never leaves)
- Decodes every signal to gather intel
- Goes idle only during "safe" periods (high health + sanity)
- Avoids The Shape and bosses until overleveled

Design problems this reveals:
- Overly safe play becomes boring and self-reinforcing
- Sanity pressure not meaningful enough for cautious players
- Retreating makes content too avoidable
- Idle rewards may trivialize the need to engage
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import List, Dict, Any
from agents.player_agent import PlayerAgent
from game_state import GameState


class CautiousSurvivorAgent(PlayerAgent):
    PROFILE_NAME = "cautious_survivor"
    PROFILE_DESCRIPTION = (
        "Avoids all unnecessary risk. Retreats when hurt, ignores bosses, "
        "maintains sanity above 60 at all times. Prioritizes survivability."
    )
    PREFERRED_CLASSES = ["Bone Marked", "Signal Marked"]

    RETREAT_THRESHOLD_HP  = 0.60   # retreat below 60% HP
    RETREAT_THRESHOLD_SAN = 55.0   # retreat if sanity below this
    IDLE_HP_MIN           = 0.85   # only go idle if HP > 85%
    IDLE_SAN_MIN          = 70.0   # only go idle if sanity > 70

    def choose_action(
        self,
        state: GameState,
        available_actions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        self._action_count += 1
        hp_pct = state.health / max(1, state.max_health)

        # Priority 1: Retreat if health or sanity is low
        if hp_pct < self.RETREAT_THRESHOLD_HP or state.sanity < self.RETREAT_THRESHOLD_SAN:
            retreat = self._find_action(available_actions, "retreat")
            if retreat:
                return retreat

        # Priority 2: Upgrade survivability (mind > body > archive)
        for tree in ["mind", "body", "archive"]:
            upg = self._find_action(available_actions, f"upgrade_{tree}")
            if upg and state.gold >= upg["cost"].get("gold", 0) * 1.2:
                return upg

        # Priority 3: Decode signals (cautious players love intel)
        signal = self._find_action(available_actions, "decode_signal")
        if signal and state.parchment > 0 and state.sanity > 50:
            return signal

        # Priority 4: Corpse action — only recover or burn (safe options)
        corpse = self._find_action(available_actions, "corpse_action")
        if corpse:
            # Override action data to only choose safe corpse interactions
            safe_corpse = dict(corpse)
            safe_corpse["data"] = {"preferred_actions": ["recover", "burn"]}
            return safe_corpse

        # Priority 5: Attack only if health is acceptable and no retreat needed
        attack = self._find_action(available_actions, "attack_enemy")
        if attack and hp_pct > self.RETREAT_THRESHOLD_HP and state.sanity > 40:
            return attack

        # Priority 6: Safe rituals (Name Removal to reduce observation, Static Communion)
        for ritual_id in ["ritual_name_removal", "ritual_static_communion"]:
            r = self._find_action(available_actions, ritual_id)
            if r and state.sanity > 60 and state.health > state.max_health * 0.80:
                return r

        # Priority 7: Collect loot if safe
        loot = self._find_action(available_actions, "collect_loot")
        if loot and hp_pct > 0.70:
            return loot

        # Priority 8: Go idle if conditions are good (safe recovery)
        idle = self._find_action(available_actions, "go_idle")
        if (idle
                and hp_pct > self.IDLE_HP_MIN
                and state.sanity > self.IDLE_SAN_MIN
                and state.simulated_time % 3600 < 60):  # roughly once per sim-hour
            return idle

        return self._fallback(available_actions)
