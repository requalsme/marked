"""
The Marked — LiveGameAdapter (Placeholder)
Bridges the simulation to the actual running game build.

STATUS: Not yet connected. Extend this when ready.

Connection targets:
  - Browser build via WebSocket / Chrome DevTools Protocol
  - Unity via named pipe or HTTP local server
  - Godot via GDScript socket bridge
  - Custom executable via stdin/stdout protocol

To implement:
1. Start the game build in headless or debug mode
2. Connect this adapter to the game's exposed API/socket
3. Implement the 7 interface methods by translating
   commands to the game's native protocol

The SimulationRunner will automatically use this adapter if
--adapter live is passed on the command line.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import json
import logging
from typing import List, Dict, Any, Optional

from adapters.game_adapter import GameAdapter
from game_state import GameState


logger = logging.getLogger("LiveGameAdapter")


class LiveGameAdapter(GameAdapter):
    """
    Placeholder for connecting to the real running game build.
    
    All methods raise NotImplementedError until the live bridge is built.
    The SimulationRunner handles this gracefully and falls back to mock_mode
    if live_mode is unavailable.
    
    Implementation Guide (browser/JS build):
    ─────────────────────────────────────────
    
    Option A: WebSocket Bridge
      1. Inject a WebSocket server into the game's JS (index.html or main.js)
      2. Expose a simple JSON command API:
           { "cmd": "get_state" }           → returns current GameState JSON
           { "cmd": "apply_action", ... }   → executes action, returns event
           { "cmd": "advance_time", "ticks": N } → advances N ticks
      3. Connect here via websockets library
      
    Option B: Chrome DevTools Protocol (CDP)
      1. Launch Chrome/Chromium with --remote-debugging-port=9222
      2. Use pycdp or selenium to inject JS into the page
      3. Call window.gameOrchestrator methods directly
      
    Option C: Puppeteer-style headless
      1. Use playwright-python to control a headless browser
      2. Navigate to http://localhost:8080 (npm run dev)
      3. Access window.gameOrchestrator via page.evaluate()
    """

    ADAPTER_PROTOCOL = "websocket"  # "websocket" | "cdp" | "playwright" | "pipe"

    def __init__(self, host: str = "localhost", port: int = 9229, timeout: float = 5.0):
        self.host = host
        self.port = port
        self.timeout = timeout
        self._connection = None
        self._state: Optional[GameState] = None
        self._connected = False

    def connect(self):
        """
        Establish connection to the running game build.
        Override with actual connection logic.
        """
        logger.warning(
            "LiveGameAdapter: Connection not yet implemented. "
            "See adapters/live_adapter.py for instructions."
        )
        # Example WebSocket skeleton:
        # import websockets
        # import asyncio
        # self._connection = asyncio.run(websockets.connect(f"ws://{self.host}:{self.port}"))
        self._connected = False

    def _send_command(self, cmd: dict) -> dict:
        """Send a command to the game and return the response."""
        if not self._connected:
            raise ConnectionError(
                "LiveGameAdapter: Not connected to game build. "
                "Run 'npm run dev' first, then ensure the bridge is active."
            )
        # Placeholder:
        raise NotImplementedError("Implement _send_command for your target platform.")

    # ─── Interface Methods ────────────────────────────────────────────────────

    def reset(self, seed: int, class_type: str = "Blood Marked") -> GameState:
        raise NotImplementedError(
            "LiveGameAdapter.reset() not yet implemented. "
            "Use --mode mock_mode or implement the live bridge."
        )

    def get_state(self) -> GameState:
        raise NotImplementedError("LiveGameAdapter.get_state() not yet implemented.")

    def get_available_actions(self) -> List[Dict[str, Any]]:
        raise NotImplementedError("LiveGameAdapter.get_available_actions() not yet implemented.")

    def apply_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        raise NotImplementedError("LiveGameAdapter.apply_action() not yet implemented.")

    def advance_time(self, ticks: int) -> List[Dict[str, Any]]:
        raise NotImplementedError("LiveGameAdapter.advance_time() not yet implemented.")

    def get_metrics(self) -> Dict[str, Any]:
        raise NotImplementedError("LiveGameAdapter.get_metrics() not yet implemented.")

    def end_run(self) -> Dict[str, Any]:
        raise NotImplementedError("LiveGameAdapter.end_run() not yet implemented.")

    def describe(self) -> str:
        status = "connected" if self._connected else "NOT CONNECTED"
        return f"LiveGameAdapter ({self.ADAPTER_PROTOCOL}, {self.host}:{self.port}, {status})"


class CDPGameAdapter(LiveGameAdapter):
    """
    Chrome DevTools Protocol adapter.
    For use when the game runs in a Chrome/Chromium window.
    
    Requires: pip install pychrome
    Usage:    python tools/simulation/run_sim.py --mode live_mode --adapter cdp
    """

    def __init__(self, url: str = "http://localhost:9222"):
        super().__init__()
        self.cdp_url = url
        self.ADAPTER_PROTOCOL = "cdp"

    def connect(self):
        try:
            import pychrome
            browser = pychrome.Browser(url=self.cdp_url)
            tabs = browser.list_tab()
            if not tabs:
                raise ConnectionError("No Chrome tabs found. Open the game in Chrome first.")
            self._tab = tabs[0]
            self._tab.start()
            self._connected = True
            logger.info(f"CDPGameAdapter: Connected to tab '{self._tab.title}'")
        except ImportError:
            logger.error("pychrome not installed. Run: pip install pychrome")
        except Exception as e:
            logger.error(f"CDPGameAdapter.connect() failed: {e}")
            self._connected = False

    def _eval_js(self, js_expr: str):
        """Evaluate JS in the connected Chrome tab and return the result."""
        if not self._connected:
            raise ConnectionError("CDPGameAdapter not connected.")
        result = self._tab.Runtime.evaluate(expression=js_expr)
        return result.get("result", {}).get("value")

    def _send_command(self, cmd: dict) -> dict:
        js = f"JSON.stringify(window.gameOrchestrator?.simBridge?.({json.dumps(cmd)}) ?? null)"
        raw = self._eval_js(js)
        if raw:
            return json.loads(raw)
        return {"error": "No response from game"}

    def describe(self) -> str:
        return f"CDPGameAdapter (chrome, {self.cdp_url})"
