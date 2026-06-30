"""
The Marked — IdleGrinderAgent
Profile 5: Relies heavily on idle/offline progress.
Only checks in occasionally and does the minimum to reset offline timers.

Behavioral signature:
- Goes idle as often as possible (simulates a player who checks in once a day)
- When active, does the fastest thing to get back to idle:
  collect loot, buy one upgrade, then leave
- Upgrades Hermit-friendly: body and mind (offline survival)
- Avoids combat unless forced (doesn't want to die and miss offline)
- Decodes signals passively when parchment stacks up
- No rituals (too risky, don't want to lose offline gains to a death)

Design problems this reveals:
- Are offline rewards well-balanced? Can this player keep up?
- Is idle-only progression interesting or does it trivialize early content?
- Are sanity penalties on return meaningful?
- Does observation grow during idle — and does that feel scary?
- Is there content that only active play can reach, creating FOMO?
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from typing import List, Dict, Any
from agents.player_agent import PlayerAgent
from game_state import GameState


class IdleGrinderAgent(PlayerAgent):
    PROFILE_NAME = "idle_grinder"
    PROFILE_DESCRIPTION = (
        "Checks in rarely and relies on offline progress for most gains. "
        "When active, does the minimum (collect, upgrade, leave). "
        "Simulates a player who plays for 5 minutes per day."
    )
    PREFERRED_CLASSES = ["Bone Marked", "Ritual Marked"]

    # How often this agent goes active (in simulated seconds)
    CHECK_IN_INTERVAL = 3600 * 8  # every 8 sim-hours they 'return'
    ACTIVE_BUDGET     = 300       # spends ~300 sim-seconds active per visit

    def __init__(self):
        super().__init__()
        self._last_checkin_time = 0.0
        self._active_timer = 0

    def choose_action(
        self,
        state: GameState,
        available_actions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        self._action_count += 1

        time_since_checkin = state.simulated_time - self._last_checkin_time
        hp_pct = state.health / max(1, state.max_health)

        # If within their active window, do the efficient stuff
        if time_since_checkin < self.ACTIVE_BUDGET:
            return self._active_session(state, available_actions, hp_pct)

        # Otherwise: go idle (the core loop)
        idle = self._find_action(available_actions, "go_idle")
        if idle:
            self._last_checkin_time = state.simulated_time
            return idle

        # If idle isn't available, just patrol
        return self._fallback(available_actions)

    def _active_session(
        self,
        state: GameState,
        available_actions: List[Dict[str, Any]],
        hp_pct: float
    ) -> Dict[str, Any]:
        """Efficient check-in behavior: collect → upgrade → decode → idle."""
        self._active_timer += 1

        # Step 1: Collect any nearby loot quickly
        loot = self._find_action(available_actions, "collect_loot")
        if loot and self._active_timer % 5 == 0:
            return loot

        # Step 2: Buy one upgrade (most cost-effective: body or mind)
        for tree in ["body", "mind"]:
            upg = self._find_action(available_actions, f"upgrade_{tree}")
            if upg and state.gold >= upg["cost"].get("gold", 0) * 1.5:
                return upg

        # Step 3: Decode a signal (passive, quick)
        signal = self._find_action(available_actions, "decode_signal")
        if signal and state.parchment >= 3:
            return signal

        # Step 4: Corpse recovery (if applicable — get the gold, don't linger)
        corpse = self._find_action(available_actions, "corpse_action")
        if corpse:
            act = dict(corpse)
            act["data"] = {"preferred_actions": ["recover", "leave"]}
            return act

        # Step 5: Light attack if something is right in front of them
        attack = self._find_action(available_actions, "attack_enemy")
        if attack and hp_pct > 0.75:
            return attack

        # End of active session: go idle again
        idle = self._find_action(available_actions, "go_idle")
        if idle:
            self._last_checkin_time = state.simulated_time
            return idle

        return self._fallback(available_actions)
