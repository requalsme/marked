"""
The Marked — agents/__init__.py
Registry and factory for all player agents.
"""

from agents.player_agent import PlayerAgent
from agents.minmaxer_agent import MinMaxerAgent
from agents.cautious_survivor_agent import CautiousSurvivorAgent
from agents.ritual_addict_agent import RitualAddictAgent
from agents.explorer_lore_agent import ExplorerLoreAgent
from agents.idle_grinder_agent import IdleGrinderAgent

AGENT_REGISTRY = {
    "minmaxer":          MinMaxerAgent,
    "cautious_survivor": CautiousSurvivorAgent,
    "ritual_addict":     RitualAddictAgent,
    "explorer_lore":     ExplorerLoreAgent,
    "idle_grinder":      IdleGrinderAgent,
}

ALL_PROFILES = list(AGENT_REGISTRY.keys())


def get_agent(profile_name: str) -> PlayerAgent:
    """
    Factory: return an instantiated agent for the given profile name.
    Raises ValueError if unknown profile.
    """
    cls = AGENT_REGISTRY.get(profile_name)
    if cls is None:
        raise ValueError(
            f"Unknown profile: '{profile_name}'. "
            f"Available: {', '.join(ALL_PROFILES)}"
        )
    return cls()
