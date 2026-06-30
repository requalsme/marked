"""
The Marked — PlayerAgent Base Class
All simulated player profiles inherit from this.

Each agent receives the current GameState and available actions,
then returns one action to apply. This drives the simulation forward.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from game_state import GameState


class PlayerAgent(ABC):
    """
    Base class for all simulated player profiles.
    
    Each tick the SimulationRunner calls choose_action(), which returns
    one action dict from the available actions list. The runner then
    calls adapter.apply_action() with that choice.
    
    Agents should have consistent, recognizable behavioral patterns —
    not random — so the simulator can detect per-profile system problems.
    """

    PROFILE_NAME: str = "base"
    PROFILE_DESCRIPTION: str = "Abstract base player"
    PREFERRED_CLASSES: List[str] = ["Blood Marked"]  # In order of preference

    def __init__(self):
        self._action_count = 0
        self._last_action: Optional[str] = None
        self._decision_log: List[str] = []

    @abstractmethod
    def choose_action(
        self,
        state: GameState,
        available_actions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Choose the next action.
        
        Args:
            state:             Current GameState (read-only)
            available_actions: List of action dicts from adapter.get_available_actions()
            
        Returns:
            One action dict from available_actions, or a fallback action.
        """
        ...

    def get_preferred_class(self) -> str:
        """Return this agent's preferred class type."""
        return self.PREFERRED_CLASSES[0]

    def _filter_actions(
        self,
        available: List[Dict[str, Any]],
        category: str
    ) -> List[Dict[str, Any]]:
        """Helper: return only actions of a given category."""
        return [a for a in available if a.get("category") == category]

    def _find_action(
        self,
        available: List[Dict[str, Any]],
        action_id: str
    ) -> Optional[Dict[str, Any]]:
        """Helper: find a specific action by ID."""
        for a in available:
            if a.get("id") == action_id:
                return a
        return None

    def _fallback(self, available: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Return the safest fallback if no preferred action exists."""
        patrol = self._find_action(available, "patrol_room")
        if patrol:
            return patrol
        if available:
            return available[0]
        # Absolute fallback
        return {"id": "patrol_room", "category": "move", "cost": {}, "data": {}}

    def on_death(self, cause: str, state: GameState):
        """Called when this agent's character dies. Override for custom behavior."""
        pass

    def on_level_up(self, new_level: int, state: GameState):
        """Called on level-up."""
        pass

    def describe(self) -> str:
        return f"{self.PROFILE_NAME}: {self.PROFILE_DESCRIPTION}"
