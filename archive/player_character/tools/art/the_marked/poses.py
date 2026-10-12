"""Pose-keyed clips for The Marked's skinned rig (everything that is not a locomotion cycle).

A clip is a list of keyed poses; poses are interpolated per frame, legs are solved with IK (planted feet) or FK
with ground contact, and cloak, tunic and sword hand follow as damped springs driven by the body's accelerations.
Angles are degrees; "world" arm angles are measured from hanging straight down, forward positive. The sword is keyed by
`blade`, the world angle the point should take (clockwise from +x, so 0 is level forward, -90 straight up, +90 straight down);
the wrist then bends as far as a wrist can to get there (see gait.wrist_series), so the sword always sits in the hand the way
a held sword does and lags the forearm like a weight. `slack` (0..1) widens the wrist's range as the grip lets go (the fall); `limp` blends toward a fixed wrist angle wr_n.

usage: poses.py OUT_DIR [clip ...]
"""
import json
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gait import HX, HY0, GROUND, L1, L2, HEEL, TOE, BALL, R, fk, foot_ankle, ik, spring_follow, wrist_series  # noqa: E402
from geometry import BLADE_REST  # noqa: E402

REST = dict(dx=0.0, drop=0.0, lean=3.0, head=2.0, rot=0.0, rx=0.0, ry=0.0,
            arm_n=-2.0, el_n=26.0, blade=30.0, limp=0.0, slack=0.0, wr_n=20.0, arm_f=3.0, el_f=14.0, wr_f=0.0,
            cs=4.0,                                    # cloak static back-angle (tier a); b and c scale from it
            legs="fk", hip_r=3.0, knee_r=8.0, ank_r=0.0, hip_l=-3.0, knee_l=6.0, ank_l=0.0,
            px_r=None, pp_r=0.0, px_l=None, pp_l=0.0, air=0.0)


def ease(kind, u):
    if kind == "in":
        return u * u
    if kind == "out":
        return 1 - (1 - u) ** 2
    if kind == "lin":
        return u
    if kind == "hold":
        return 0.0 if u < 1.0 else 1.0
    return u * u * (3 - 2 * u)


def resolve(keys, N, loop=False):
    """keys: [(frame, {param: value}, ease_into_next)]; missing params keep the previous key's value."""
    ks = []
    cur = dict(REST)
    for k in keys:
        t, p = k[0], k[1]
        cur = dict(cur)
        cur.update(p)
        ks.append((t, cur, k[2] if len(k) > 2 else "inout"))
    if loop:                                                           # close the loop back to the first pose
        ks.append((ks[0][0] + N, dict(ks[0][1]), "inout"))
    out = []
    for f in range(N):
        t = f
        for (t0, p0, e0), (t1, p1, _) in zip(ks, ks[1:]):
            if t0 <= t <= t1:
                u = 0.0 if t1 == t0 else ease(e0, (t - t0) / (t1 - t0))
                pose = {}
                for name in p0:
                    a, b = p0[name], p1[name]
                    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
                        pose[name] = a + (b - a) * u
                    else:
                        pose[name] = a if u < 0.5 else b
                out.append(pose)
                break
        else:
            out.append(dict(ks[-1][1]))
    return out


def build(name, N, fps, poses, loop, cloak_gain=1.0, wind=0.0, locks=None, fx=None, extra=None):
    """Turn per-frame poses into rig channels."""
    th = {"r": [], "l": []}
    kn = {"r": [], "l": []}
    ft = {"r": [], "l": []}
    drops = []
    errs = 0.0
    for p in poses:
        hx = HX + p["dx"]
        legs = {}
        # FK legs (hip/knee/ankle angles) -> the pelvis drop that puts the lower foot on the ground
        if p["legs"] == "fk":
            low = -1e9
            for s in ("r", "l"):
                _, _, pts = fk(np.array([hx, HY0]), p["hip_" + s], p["knee_" + s], p["ank_" + s])
                low = max(low, max(q[1] for q in pts.values()))
            drop = GROUND - low - p["air"]
        else:
            drop = p["drop"]
        hip = np.array([hx, HY0 + drop])
        for s in ("r", "l"):
            if p["legs"] == "fk" or p["px_" + s] is None:
                t1, k, d = -p["hip_" + s], p["knee_" + s], p["ank_" + s]
                legs[s] = (t1, k, -d)
            else:
                psi = p["pp_" + s]
                ank, _ = foot_ankle(p["px_" + s], psi)
                t1, k, err = ik(hip, ank)
                errs = max(errs, err)
                legs[s] = (t1, k, psi - (t1 + k))
        for s in ("r", "l"):
            th[s].append(legs[s][0]); kn[s].append(legs[s][1]); ft[s].append(legs[s][2])
        drops.append(drop)
    n = N
    P = lambda key: np.array([p[key] for p in poses], float)
    lean, dx, head = P("lean"), P("dx"), P("head")
    arm_n, el_n, arm_f, el_f = P("arm_n"), P("el_n"), P("arm_f"), P("el_f")
    rootrot, rx, ry = P("rot"), P("rx"), P("ry")
    drops = np.array(drops)

    def per(x, pad=1):
        return np.roll(x, -1) - 2 * x + np.roll(x, 1) if loop else np.concatenate([[0], x[2:] - 2 * x[1:-1] + x[:-2], [0]])
    drive = -0.35 * per(drops) - 0.5 * per(lean) + 0.45 * per(dx) + 0.2 * per(rootrot)
    cs = P("cs")
    L_ = 6 if loop else 1
    comp = 0.78 * lean                                                   # the cloak hangs under gravity, it does not lean with the torso
    ca = spring_follow(list(cs + 1.4 * cloak_gain * drive - comp), fps, 2.2, 0.35, loops=L_)
    cb = spring_follow(list(cs * 1.5 + 1.8 * cloak_gain * drive - comp), fps, 1.7, 0.3, loops=L_)
    cc = spring_follow(list(cs * 2.1 + 2.4 * cloak_gain * drive - comp), fps, 1.4, 0.28, loops=L_)
    hn = np.array([-t for t in th["r"]]); hf = np.array([-t for t in th["l"]])
    tun_f = spring_follow([-0.5 * hn[i] + wind * 10.0 + cs[i] for i in range(n)], fps, 2.4, 0.4, loops=L_)
    tun_b = spring_follow([-0.17 * (hn[i] + hf[i]) + wind * 14.0 + 3 + cs[i] for i in range(n)], fps, 2.0, 0.4, loops=L_)
    # the sword hand: the forearm turns by -(arm + elbow flexion) with the body; the wrist makes up the rest
    fore = -(arm_n + el_n) + rootrot
    blade, limp, wr_n = P("blade"), P("limp"), P("wr_n")
    wr_target = (1 - limp) * (blade - (BLADE_REST + fore)) + limp * wr_n
    wrist, wrist_clipped = wrist_series(fore, wr_target, fps, loop, slack=P("slack"))

    def keys(vals):
        vv = [float(x) for x in vals]
        return [[i, vv[i]] for i in range(n)] + [[n, vv[0]]]

    ch = {"root": {"rotate": {"keys": keys(rootrot), "ease": "linear"},
                   "translate": {"keys": [[i, [float(rx[i]), float(ry[i])]] for i in range(n)] + [[n, [float(rx[0]), float(ry[0])]]], "ease": "linear"}},
          "pelvis": {"translate": {"keys": [[i, [float(dx[i]), float(drops[i])]] for i in range(n)] + [[n, [float(dx[0]), float(drops[0])]]], "ease": "linear"}},
          "torso": {"rotate": {"keys": keys(lean), "ease": "linear"}},
          "head": {"rotate": {"keys": keys(head - 0.75 * lean), "ease": "linear"}}}
    for s in ("r", "l"):
        ch["thigh-" + s] = {"rotate": {"keys": keys(th[s]), "ease": "linear"}}
        ch["shin-" + s] = {"rotate": {"keys": keys(kn[s]), "ease": "linear"}}
        ch["foot-" + s] = {"rotate": {"keys": keys(ft[s]), "ease": "linear"}}
    ch["upperarm-l"] = {"rotate": {"keys": keys(-arm_f - lean), "ease": "linear"}}
    ch["forearm-l"] = {"rotate": {"keys": keys(-el_f), "ease": "linear"}}
    ch["hand-l"] = {"rotate": {"keys": keys(P("wr_f")), "ease": "linear"}}
    ch["upperarm-r"] = {"rotate": {"keys": keys(-arm_n - lean), "ease": "linear"}}
    ch["forearm-r"] = {"rotate": {"keys": keys(-el_n), "ease": "linear"}}
    ch["hand-r"] = {"rotate": {"keys": keys(wrist), "ease": "linear"}}
    ch["cloak-a"] = {"rotate": {"keys": keys(ca), "ease": "linear"}}
    ch["cloak-b"] = {"rotate": {"keys": keys([cb[i] - ca[i] for i in range(n)]), "ease": "linear"}}
    ch["cloak-c"] = {"rotate": {"keys": keys([cc[i] - cb[i] for i in range(n)]), "ease": "linear"}}
    ch["tunic-front"] = {"rotate": {"keys": keys(tun_f), "ease": "linear"}}
    ch["tunic-back"] = {"rotate": {"keys": keys(tun_b), "ease": "linear"}}
    clip = {"clip": name, "fps": fps, "frames": n, "loop": loop, "channels": ch,
            "debug": {"blade_world": [round(float(v), 1) for v in BLADE_REST + fore + wrist], "wrist": [round(float(v), 1) for v in wrist], "wrist_clipped": wrist_clipped}}
    if locks is not None:
        clip["ground_lock"] = locks
    if fx:
        clip["fx"] = fx
    if extra:
        clip.update(extra)
    return clip, errs


def sine(N, amp, phase=0.0, cycles=1):
    return [amp * math.sin(2 * math.pi * (i / N * cycles) + phase) for i in range(N)]


CLIPS = {}


def clip(name):
    def deco(fn):
        CLIPS[name] = fn
        return fn
    return deco


# ═══ idle: slow breathing, a weight shift, the cloak and tunic settling ═══════════════════════════════
@clip("idle")
def idle():
    N, fps = 8, 9
    keys = []
    for i in range(N):
        b = math.sin(2 * math.pi * i / N)               # breath
        w = math.sin(2 * math.pi * i / N + 1.0)         # weight shift
        keys.append((i, dict(lean=3.0 + 0.9 * b, head=2.0 - 1.2 * b + 0.8 * w, arm_n=-2 + 1.2 * w, el_n=17 + 2.5 * b, blade=30.0 + 1.6 * w,
                             arm_f=3 - 1.4 * b, el_f=14 + 2 * b, dx=0.6 * w, cs=4.0,
                             hip_r=3 + 1.5 * w, knee_r=8 + 1.5 * b, hip_l=-3 - 1.5 * w, knee_l=6 + 1.2 * b,
                             legs="fk")))
    poses = resolve(keys, N, loop=True)
    return build("idle", N, fps, poses, True)


# ═══ basic attack: 10 frames over 20 ticks; the blade is live on frames 3-7 ════════════════════════
@clip("basic_attack")
def basic_attack():
    N, fps = 10, 30
    LEAD, REAR = 156.0, 100.0
    k = [
        # guard
        (0, dict(legs="ik", drop=7, px_r=LEAD, pp_r=0, px_l=REAR, pp_l=8, lean=6, head=3, dx=0, arm_n=14, el_n=34, blade=-25, arm_f=-10, el_f=40, cs=5)),
        # wind-up: weight to the back foot, blade drawn up and behind
        (1, dict(rx=-4, drop=12, dx=-6, lean=-4, head=-2, arm_n=95, el_n=60, blade=-110, arm_f=-24, el_f=50, px_l=REAR - 2, pp_l=6, cs=8), "out"),
        (2, dict(rx=-8, drop=15, dx=-10, lean=-9, head=-4, arm_n=128, el_n=66, blade=-150, arm_f=-34, el_f=58, px_l=REAR - 4, pp_l=4, cs=11), "hold"),
        # strike: step and lunge, the arm whips down through horizontal
        (3, dict(rx=-24, drop=18, dx=12, lean=12, head=6, arm_n=104, el_n=48, blade=-115, arm_f=-8, el_f=30, px_r=LEAD + 20, pp_r=0, px_l=REAR, pp_l=30, cs=16), "in"),
        (4, dict(rx=-44, drop=22, dx=22, lean=18, head=8, arm_n=84, el_n=26, blade=-70, arm_f=4, el_f=24, px_r=LEAD + 22, pp_l=40, cs=22)),
        (5, dict(rx=-46, drop=22, dx=26, lean=22, head=9, arm_n=70, el_n=18, blade=-30, arm_f=10, el_f=22, px_r=LEAD + 22, cs=24)),
        (6, dict(rx=-44, drop=20, dx=28, lean=22, head=9, arm_n=40, el_n=10, blade=10, arm_f=16, el_f=24, cs=22), "out"),
        (7, dict(rx=-38, drop=19, dx=27, lean=20, head=8, arm_n=28, el_n=12, blade=20, arm_f=14, el_f=30, cs=18)),
        # recover
        (8, dict(rx=-18, drop=13, dx=14, lean=12, head=5, arm_n=22, el_n=28, blade=5, arm_f=-4, el_f=34, px_r=LEAD + 10, px_l=REAR + 6, pp_l=18, cs=10)),
        (9, dict(rx=-6, drop=8, dx=3, lean=7, head=3, arm_n=12, el_n=32, blade=-15, arm_f=-8, el_f=38, px_r=LEAD + 2, px_l=REAR + 2, pp_l=8, cs=6)),
    ]
    poses = resolve(k, N)
    return build("basic_attack", N, fps, poses, False)


# ═══ hit reaction: recoil, stagger, recover (25 ticks) ═══════════════════════════════════════════
@clip("hit_react")
def hit_react():
    N, fps = 6, 14
    LEAD, REAR = 156.0, 100.0
    k = [
        (0, dict(legs="ik", drop=6, px_r=LEAD, px_l=REAR, pp_l=8, lean=6, head=3, arm_n=14, el_n=34, blade=-25, arm_f=-10, el_f=40, cs=5)),
        (1, dict(drop=9, dx=-10, lean=-14, head=-16, px_r=LEAD - 14, pp_r=-10, px_l=REAR - 10, pp_l=4, arm_n=60, el_n=40, blade=-60, arm_f=-40, el_f=30, cs=22), "out"),
        (2, dict(drop=12, dx=-14, lean=-9, head=-9, px_r=LEAD - 20, pp_r=0, px_l=REAR - 12, pp_l=0, arm_n=48, el_n=36, blade=-50, arm_f=-34, el_f=34, cs=16)),
        (3, dict(drop=11, dx=-9, lean=-2, head=-2, px_r=LEAD - 14, px_l=REAR - 8, arm_n=30, el_n=34, blade=-35, arm_f=-22, el_f=38, cs=10)),
        (4, dict(drop=9, dx=-4, lean=4, head=2, px_r=LEAD - 6, px_l=REAR - 3, arm_n=18, el_n=34, blade=-28, arm_f=-12, el_f=40, cs=7)),
        (5, dict(drop=7, dx=0, lean=6, head=3, px_r=LEAD, px_l=REAR, pp_l=8, arm_n=14, el_n=34, blade=-25, arm_f=-10, el_f=40, cs=5)),
    ]
    poses = resolve(k, N)
    return build("hit_react", N, fps, poses, False)


# ═══ death: stagger, knees buckle, the blade drops, fall onto the back, the cloak settles ═══════════
@clip("death_collapse")
def death_collapse():
    N, fps = 10, 9
    LEAD, REAR = 156.0, 100.0
    k = [
        (0, dict(legs="ik", drop=7, px_r=LEAD, px_l=REAR, pp_l=8, lean=6, head=3, arm_n=14, el_n=34, blade=-25, arm_f=-10, el_f=40, cs=5)),
        (1, dict(drop=10, dx=-8, lean=-12, head=-14, px_r=LEAD - 10, px_l=REAR - 8, arm_n=40, el_n=40, blade=-40, arm_f=-34, el_f=30, cs=16), "out"),
        (2, dict(drop=22, dx=-14, lean=-10, head=-18, px_r=LEAD - 18, pp_r=0, px_l=REAR - 12, pp_l=0, arm_n=30, el_n=20, blade=10, slack=0.2, arm_f=-40, el_f=24, cs=20)),
        (3, dict(drop=40, dx=-18, lean=-14, head=-22, px_r=LEAD - 26, px_l=REAR - 18, arm_n=14, el_n=10, blade=40, slack=0.5, arm_f=-52, el_f=18, cs=26)),
        # falling: the whole body pivots about the heels
        (4, dict(legs="ik", drop=44, dx=-24, lean=-22, head=-26, rot=-22, rx=14, px_r=LEAD - 30, px_l=REAR - 24, arm_n=-8, el_n=6, blade=40, slack=1.0, arm_f=-58, el_f=10, cs=30)),
        (5, dict(drop=50, dx=-24, lean=-24, head=-24, rot=-46, rx=40, arm_n=-26, el_n=4, blade=30, arm_f=-70, el_f=6, cs=32)),
        (6, dict(drop=52, dx=-24, lean=-18, head=-18, rot=-68, rx=66, arm_n=-34, el_n=4, blade=20, arm_f=-80, el_f=6, cs=26)),
        (7, dict(drop=52, dx=-24, lean=-10, head=-10, rot=-82, rx=84, arm_n=-24, el_n=8, blade=12, arm_f=-70, el_f=10, cs=14), "out"),
        (8, dict(drop=52, dx=-24, lean=-8, head=-6, rot=-85, rx=88, arm_n=-14, el_n=12, blade=8, arm_f=-60, el_f=16, cs=6)),
        (9, dict(drop=52, dx=-24, lean=-8, head=-6, rot=-86, rx=89, arm_n=-10, el_n=14, blade=8, arm_f=-56, el_f=18, cs=3)),
    ]
    poses = resolve(k, N)
    return build("death_collapse", N, fps, poses, False, locks=[False] * 3 + [True] * 7)


# ═══ dodge step: crouch, low forward dash with the cloak streaming, land ═══════════════════════════
@clip("dodge_step")
def dodge_step():
    N, fps = 6, 16
    k = [
        (0, dict(legs="ik", drop=22, px_r=150, pp_r=0, px_l=104, pp_l=14, lean=22, head=8, arm_n=-10, el_n=60, blade=-20, arm_f=-6, el_f=64, cs=8)),
        (1, dict(legs="fk", dx=14, lean=38, head=14, hip_r=62, knee_r=70, ank_r=0, hip_l=-34, knee_l=24, ank_l=-26, air=8, arm_n=-26, el_n=50, blade=-10, arm_f=-52, el_f=26, cs=30), "out"),
        (2, dict(dx=22, lean=44, head=16, hip_r=44, knee_r=96, ank_r=-8, hip_l=-30, knee_l=14, ank_l=-24, air=14, arm_n=-34, el_n=44, blade=0, arm_f=-66, el_f=20, cs=42)),
        (3, dict(dx=24, lean=42, head=15, hip_r=50, knee_r=62, ank_r=0, hip_l=-24, knee_l=20, ank_l=-20, air=10, arm_n=-30, el_n=46, blade=0, arm_f=-60, el_f=24, cs=40)),
        (4, dict(legs="ik", drop=24, dx=14, px_r=164, pp_r=-6, px_l=112, pp_l=24, lean=26, head=9, arm_n=-24, el_n=44, blade=-5, arm_f=-24, el_f=44, cs=22), "out"),
        (5, dict(drop=10, dx=2, px_r=156, pp_r=0, px_l=102, pp_l=8, lean=8, head=3, arm_n=12, el_n=32, blade=-25, arm_f=-8, el_f=38, cs=8)),
    ]
    poses = resolve(k, N)
    return build("dodge_step", N, fps, poses, False)


# ═══ interact / pickup: crouch, reach down, grasp, rise ════════════════════════════════════════════
@clip("interact_pickup")
def interact_pickup():
    N, fps = 8, 11
    k = [
        (0, dict(legs="ik", drop=7, px_r=150, pp_r=0, px_l=104, pp_l=8, lean=6, head=3, arm_n=14, el_n=34, blade=-25, arm_f=-10, el_f=40)),
        (1, dict(drop=26, dx=-4, px_r=156, pp_r=0, px_l=100, pp_l=0, lean=18, head=14, arm_n=24, el_n=30, blade=-45, arm_f=24, el_f=34)),
        (2, dict(drop=42, dx=-6, lean=34, head=22, cs=16, arm_n=30, el_n=26, blade=-60, arm_f=62, el_f=18, px_r=158, px_l=98)),
        (3, dict(drop=48, dx=-6, lean=42, head=26, cs=20, arm_n=34, el_n=24, blade=-62, arm_f=78, el_f=12, px_r=160, px_l=98)),     # the grasp
        (4, dict(drop=48, dx=-6, lean=42, head=26, arm_f=78, el_f=14), "hold"),
        (5, dict(drop=30, dx=-3, lean=24, head=12, arm_n=26, el_n=30, blade=-40, arm_f=40, el_f=70, px_r=156, px_l=100)),
        (6, dict(drop=14, dx=0, lean=10, head=4, blade=-30, arm_f=10, el_f=60, px_r=152, px_l=102)),
        (7, dict(drop=7, dx=0, lean=6, head=3, arm_n=14, el_n=34, blade=-25, arm_f=-10, el_f=40, px_r=150, px_l=104, pp_l=8)),
    ]
    poses = resolve(k, N)
    return build("interact_pickup", N, fps, poses, False)


# ═══ ritual channel: kneel, raise both hands, a sigil forms between them (looping hold) ════════════
@clip("ritual_channel")
def ritual_channel():
    N, fps = 10, 10
    k = []
    for i in range(N):
        b = math.sin(2 * math.pi * i / N)
        k.append((i, dict(legs="ik", drop=36 + 0.6 * b, dx=-2, px_r=160, pp_r=0, px_l=84, pp_l=85, lean=2 + 1.2 * b, head=-8 - 1.4 * b,
                          arm_n=148 + 3 * b, el_n=26 + 4 * b, blade=-125 + 3 * b, arm_f=140 - 3 * b, el_f=30 - 3 * b, wr_f=-10, cs=24)))
    poses = resolve(k, N, loop=True)
    fx = [{"sigil": 0.55 + 0.45 * (0.5 + 0.5 * math.sin(2 * math.pi * i / N)), "spin": i * 18.0} for i in range(N)]
    return build("ritual_channel", N, fps, poses, True, fx=fx, extra={"far_arm_front": True})


# ═══ low sanity: hunched, a hand clutching the mask, twitching ═══════════════════════════════════
@clip("low_sanity")
def low_sanity():
    N, fps = 8, 13
    r = np.random.RandomState(4)
    jit = lambda s: float(r.uniform(-s, s))
    k = []
    for i in range(N):
        b = math.sin(2 * math.pi * i / N)
        tw = 1.0 if i in (2, 5) else 0.0                                            # the twitches
        k.append((i, dict(legs="fk", lean=22 + 1.5 * b + 2 * tw, head=16 + 2 * b + jit(2.5) + 5 * tw, dx=jit(0.6) + 1.2 * tw,
                          hip_r=16 + 1.5 * b, knee_r=30 + 2 * b, ank_r=0, hip_l=-6, knee_l=22, ank_l=0,
                          arm_f=118 + 3 * b + 5 * tw, el_f=124 - 2 * b, wr_f=-22 + jit(4), arm_n=6 + 2 * b, el_n=40, blade=12 + 2 * b, cs=6)))
    poses = resolve(k, N, loop=True)
    return build("low_sanity", N, fps, poses, True, extra={"far_arm_front": True})


# ═══ signal decode: still and listening, a hand at the hood, small rhythmic nods ═══════════════════
@clip("signal_decode")
def signal_decode():
    N, fps = 8, 10
    k = []
    for i in range(N):
        b = math.sin(2 * math.pi * i / N)
        nod = math.sin(2 * math.pi * 2 * i / N)
        k.append((i, dict(legs="fk", lean=4 + 0.8 * b, head=-6 + 3.5 * nod, hip_r=4, knee_r=9, hip_l=-3, knee_l=7,
                          arm_f=108 + 2 * b, el_f=112 - 3 * nod, wr_f=-18 + 4 * nod, arm_n=-2, el_n=28, blade=8 + 1.0 * b, cs=4)))
    poses = resolve(k, N, loop=True)
    fx = [{"flicker": 0.5 + 0.5 * abs(math.sin(2 * math.pi * 2 * i / N))} for i in range(N)]
    return build("signal_decode", N, fps, poses, True, fx=fx, extra={"far_arm_front": True})


if __name__ == "__main__":
    outdir = sys.argv[1]
    os.makedirs(outdir, exist_ok=True)
    names = sys.argv[2:] or list(CLIPS)
    for n in names:
        c, errs = CLIPS[n]()
        json.dump(c, open(os.path.join(outdir, f"{n}.clip.json"), "w"), indent=1)
        d = c["debug"]
        print(f"{n}: {c['frames']} frames @ {c['fps']} fps, loop={c['loop']}, worst IK reach error {errs:.1f}")
        print("   blade world:", [int(round(v)) for v in d["blade_world"]], "wrist:", [int(round(v)) for v in d["wrist"]], "clipped:", d["wrist_clipped"])
