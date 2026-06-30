"""
The Marked — adapters/__init__.py
Factory for loading adapters by name.
"""

from adapters.game_adapter import GameAdapter


def get_adapter(mode: str = "mock_mode", adapter_name: str = "auto") -> GameAdapter:
    """
    Factory: return the correct adapter for the given mode.
    
    Args:
        mode:         "mock_mode" or "live_mode"
        adapter_name: "mock", "live", "cdp", "playwright", "auto"
    """
    if mode == "mock_mode" or adapter_name == "mock":
        from adapters.mock_adapter import MockGameAdapter
        return MockGameAdapter()

    if mode == "live_mode":
        if adapter_name == "cdp":
            from adapters.live_adapter import CDPGameAdapter
            adapter = CDPGameAdapter()
            adapter.connect()
            return adapter
        else:
            from adapters.live_adapter import LiveGameAdapter
            adapter = LiveGameAdapter()
            adapter.connect()
            return adapter

    # Fallback: mock
    from adapters.mock_adapter import MockGameAdapter
    return MockGameAdapter()
