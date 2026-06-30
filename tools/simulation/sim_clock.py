"""
The Marked — SimulationClock
Manages simulated game time, tick-rate compression, and timeline recording.
Time in the simulator is wall-clock seconds scaled up to represent simulated hours/days.
"""

import time
from typing import List, Tuple


class SimulationClock:
    """
    Controls simulated time progression.
    One tick = one simulated second by default (can be scaled).
    
    The real game runs at ~60 fps. We compress: each tick here
    represents TICK_SECONDS of simulated game time.
    """

    TICK_SECONDS = 60  # Each sim step = 60 simulated seconds (1 real second ≈ 1 sim minute)

    def __init__(self, duration_seconds: float):
        self.total_duration = duration_seconds      # How much sim-time to run
        self.elapsed_sim_time = 0.0                 # Simulated seconds elapsed
        self.tick_count = 0
        self.real_start_time = None
        self.real_end_time = None

        # Timeline sampling: record snapshots every N sim-seconds
        self.snapshot_interval = 3600               # Every simulated hour
        self.next_snapshot_at = self.snapshot_interval
        self._pending_snapshot = False

    def start(self):
        self.real_start_time = time.time()
        self.elapsed_sim_time = 0.0
        self.tick_count = 0
        self.next_snapshot_at = self.snapshot_interval

    def tick(self) -> float:
        """Advance one tick. Returns dt (simulated seconds this tick)."""
        dt = self.TICK_SECONDS
        self.elapsed_sim_time += dt
        self.tick_count += 1

        if self.elapsed_sim_time >= self.next_snapshot_at:
            self._pending_snapshot = True
            self.next_snapshot_at += self.snapshot_interval

        return dt

    def should_snapshot(self) -> bool:
        if self._pending_snapshot:
            self._pending_snapshot = False
            return True
        return False

    def is_finished(self) -> bool:
        return self.elapsed_sim_time >= self.total_duration

    def stop(self):
        self.real_end_time = time.time()

    def real_elapsed(self) -> float:
        if self.real_start_time is None:
            return 0.0
        end = self.real_end_time or time.time()
        return end - self.real_start_time

    def format_sim_time(self, seconds: float = None) -> str:
        s = seconds if seconds is not None else self.elapsed_sim_time
        if s < 3600:
            return f"{s/60:.1f}m"
        if s < 86400:
            return f"{s/3600:.1f}h"
        return f"{s/86400:.1f}d"

    def progress_pct(self) -> float:
        if self.total_duration <= 0:
            return 100.0
        return min(100.0, self.elapsed_sim_time / self.total_duration * 100)

    @property
    def sim_hours(self) -> float:
        return self.elapsed_sim_time / 3600

    @property
    def sim_days(self) -> float:
        return self.elapsed_sim_time / 86400


def parse_duration(duration_str: str) -> int:
    """Parse a duration string like '30d', '8h', '1w', '90m' into seconds."""
    s = duration_str.strip().lower()
    multipliers = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}
    for suffix, mult in multipliers.items():
        if s.endswith(suffix):
            try:
                value = float(s[:-1])
                return int(value * mult)
            except ValueError:
                break
    # Try bare integer (assume seconds)
    try:
        return int(s)
    except ValueError:
        raise ValueError(f"Cannot parse duration: '{duration_str}'. Use format: 30d, 8h, 1w, 90m, 3600s")
