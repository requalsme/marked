"""Near-arm landmarks and the sword grip, shared by the art (human.py), the gait engine and the pose clips.

Angles are degrees measured clockwise from +x on the screen (y points down), so 90 is straight down and -90 straight up.
"""
import math

EL_N, WR_N = (134.0, 125.0), (143.0, 150.0)       # near elbow and wrist in the rest pose
GRIP_REL = 55.0                                    # a sword grip lies diagonally across the palm (a hammer grip would be ~80)
FIST_DROP = 6.0                                    # wrist to the centre of the fist, along the forearm

FOREARM_REST = math.degrees(math.atan2(WR_N[1] - EL_N[1], WR_N[0] - EL_N[0]))   # ~70: down and forward
BLADE_REST = FOREARM_REST - GRIP_REL                                             # ~-10: forward, a little up


def fist_centre():
    t = math.radians(FOREARM_REST)
    return (WR_N[0] + math.cos(t) * FIST_DROP, WR_N[1] + math.sin(t) * FIST_DROP)
