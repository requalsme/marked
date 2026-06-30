"""
The Marked — GameAdapter Base Class
Defines the interface that all adapters (mock, live) must implement.
The SimulationRunner uses ONLY this interface — never calls the adapter's internals.

To connect a new build target (Unity, Godot, browser):
1. Create a new adapter in adapters/
2. Subclass GameAdapter
3. Implement all 7 interface methods
4. Pass it to SimulationRunner via --adapter flag or in code
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from game_state import GameState


class GameAdapter(ABC):
    """
    Abstract base class defining the simulation adapter interface.
    
    The adapter is the ONLY point of contact between the simulator and
    any game build. Keep all platform-specific code inside the adapter.
    """

    @abstractmethod
    def reset(self, seed: int, class_type: str = "Blood Marked") -> GameState:
        """
        Initialize a fresh game run with the given seed and class.
        Returns the initial GameState.
        
        Args:
            seed: RNG seed for deterministic replay
            class_type: One of the 5 class strings from state.js
        """
        ...

    @abstractmethod
    def get_state(self) -> GameState:
        """Return the current GameState (read-only reference)."""
        ...

    @abstractmethod
    def get_available_actions(self) -> List[Dict[str, Any]]:
        """
        Return a list of actions the player can currently take.
        Each action is a dict: {"id": str, "category": str, "cost": dict, "data": dict}
        
        Categories: "combat", "move", "ritual", "loot", "corpse", "signal", "idle", "upgrade"
        """
        ...

    @abstractmethod
    def apply_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute an action. Returns an event dict describing what happened:
        {"event": str, "success": bool, "data": dict}
        
        Possible events: "enemy_killed", "player_damaged", "player_died",
        "loot_collected", "ritual_performed", "signal_decoded", "corpse_action",
        "boss_attempted", "boss_defeated", "region_entered", "level_up", 
        "idle_session_complete", "upgrade_purchased", "nothing"
        """
        ...

    @abstractmethod
    def advance_time(self, ticks: int) -> List[Dict[str, Any]]:
        """
        Advance the simulation by N ticks (each tick = 1 simulated second).
        Returns a list of passive events that occurred (sanity drain, observation gain,
        idle gains, enemy spawns, etc.)
        
        Args:
            ticks: Number of 1-second ticks to simulate
        """
        ...

    @abstractmethod
    def get_metrics(self) -> Dict[str, Any]:
        """
        Return the current run's metrics dict.
        Used by MetricsRecorder to sample the run state at intervals.
        """
        ...

    @abstractmethod
    def end_run(self) -> Dict[str, Any]:
        """
        Finalize the run. Return the complete final metrics dict.
        Called by SimulationRunner when duration expires or player has died enough times.
        """
        ...

    # ─── Optional hooks ───────────────────────────────────────────────────────

    def on_death(self, cause: str, state: GameState):
        """Optional hook called when the player dies. Override to add logic."""
        pass

    def on_level_up(self, new_level: int, state: GameState):
        """Optional hook called on level-up events."""
        pass

    def on_observation_threshold(self, tier: str, state: GameState):
        """Optional hook called at 25/50/75/100% observation."""
        pass

    def describe(self) -> str:
        """Return a human-readable adapter name for report headers."""
        return self.__class__.__name__
