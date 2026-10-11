"""Biomechanical gait for The Marked's side-view rig (IK-driven, treadmill frame).

* Stance: the foot rolls heel -> flat -> toe on a ground point that moves backward at one constant
  speed (no sliding). Its ankle position comes from the foot's world angle and the sole geometry.
* Swing: a Hermite path from toe-off to the next heel strike (velocities match the ground speed) with a
  clearance arc. Foot world angle comes from published ankle/foot kinematics.
* Two-bone IK on the real segment lengths (thigh 46, shin 36) gives hip and knee. The pelvis height is
  the lowest height that lets every stance leg keep its table knee flexion; in the run's flight phase the
  pelvis follows a ballistic arc.
* Torso lean, head stabilisation, contralateral arm swing, elbow flexion; cloak tiers, tunic panels and
  the sword hand are damped springs driven by the body's accelerations.

usage: gait.py walk|run OUT_DIR
"""
import json
import math
import os
import sys

import numpy as np

L1, L2 = 46.0, 36.0
HX, HY0 = 127.0, 132.0
GROUND = 222.0
HEEL, TOE, BALL = np.array([-9.0, 7.8]), np.array([24.5, 7.8]), np.array([15.0, 7.8])

GAITS = {
    "walk": dict(
        N=12, fps=12, duty=0.62, stride=100.0, fwd=0.5, lean=4.0, apex=0.0, clear=9.0,
        psi=[(0, -18), (6, -4), (12, 0), (30, 0), (40, 6), (50, 22), (58, 42), (62, 50), (68, 38), (75, 18), (85, -4), (95, -16), (100, -18)],
        kst=[(0, 5), (0.13, 17), (0.25, 19), (0.4, 10), (0.57, 6), (0.73, 14), (0.9, 26), (1.0, 32)],
        arm_f=22.0, elb_f=(18.0, 38.0), arm_n=7.0, elb_n=(26.0, 34.0),
        cloak=(4.0, 6.0, 8.0), tun=(0.5, 0.35), wind=0.0),
    "run": dict(
        N=8, fps=17, duty=0.26, stride=310.0, fwd=0.42, lean=11.0, apex=6.0, clear=29.0,
        psi=[(0, -12), (5, -2), (12, 4), (18, 16), (25, 40), (30, 56), (38, 52), (50, 30), (65, 6), (80, -8), (92, -12), (100, -12)],
        kst=[(0, 18), (0.3, 38), (0.5, 44), (0.75, 32), (1.0, 20)],
        arm_f=40.0, elb_f=(78.0, 100.0), arm_n=15.0, elb_n=(52.0, 70.0),
        cloak=(14.0, 22.0, 30.0), tun=(0.45, 0.3), wind=1.0),
}


def curve(keys, period=None):
    xs = np.array([k[0] for k in keys], float)
    ys = np.array([k[1] for k in keys], float)
    if period:
        xs, ys = xs / period, ys

    def f(x):
        if period:
            x = (x / period) % 1.0 if False else (x % 1.0)
            xx = np.concatenate([xs - 1.0, xs, xs + 1.0])
            yy = np.concatenate([ys, ys, ys])
            return float(np.interp(x, xx, yy))
        return float(np.interp(x, xs, ys))
    return f


def smooth_periodic(keys):
    """Periodic cubic Hermite (Catmull-Rom tangents) through (pct, value) keys."""
    xs = np.array([k[0] for k in keys], float) / 100.0
    ys = np.array([k[1] for k in keys], float)
    if abs(xs[-1] - 1.0) < 1e-9:
        xs, ys = xs[:-1], ys[:-1]
    n = len(xs)

    def f(ph):
        ph = ph % 1.0
        i = int(np.searchsorted(xs, ph, side="right") - 1) % n
        j = (i + 1) % n
        x0, x1 = xs[i], xs[j] + (1.0 if j == 0 else 0.0)
        xm, xp = xs[(i - 1) % n] - (1.0 if i == 0 else 0.0), xs[(j + 1) % n] + (1.0 if j + 1 >= n else 0.0) + (1.0 if j == 0 else 0.0)
        m0 = (ys[j] - ys[(i - 1) % n]) / (x1 - xm)
        m1 = (ys[(j + 1) % n] - ys[i]) / (xp - x0)
        p = ph if ph >= x0 else ph + 1.0
        t = (p - x0) / (x1 - x0)
        h = x1 - x0
        return (2 * t**3 - 3 * t**2 + 1) * ys[i] + (t**3 - 2 * t**2 + t) * h * m0 + (-2 * t**3 + 3 * t**2) * ys[j] + (t**3 - t**2) * h * m1
    return f


def R(theta_deg, v):
    t = math.radians(theta_deg)
    c, s = math.cos(t), math.sin(t)
    return np.array([v[0] * c - v[1] * s, v[0] * s + v[1] * c])


def fk(hip_pos, h, k, d):
    """Forward kinematics: hip flexion h (forward +), knee flexion k, ankle dorsiflexion d (degrees)."""
    th1 = -h
    knee = np.asarray(hip_pos, float) + R(th1, (0, L1))
    th2 = th1 + k
    ank = knee + R(th2, (0, L2))
    th3 = th2 - d
    pts = {n: ank + R(th3, p) for n, p in (("heel", HEEL), ("toe", TOE), ("ball", BALL))}
    return knee, ank, pts


def foot_ankle(contact_x, psi):
    """Ankle position for a foot at world angle psi, resting on the ground at contact_x (its lowest sole point)."""
    pts = {n: R(psi, p) for n, p in (("heel", HEEL), ("ball", BALL), ("toe", TOE))}
    low = max(pts, key=lambda n: pts[n][1])
    # weight the contact smoothly from heel to toe so the ankle path has no kink when the lowest point switches
    return np.array([contact_x - pts[low][0], GROUND - pts[low][1]]), low


def ik(hip, target):
    """Two-bone IK, knee forward. Returns (thigh_rot, knee_flex, reach_error) in degrees, rig sign convention."""
    d = target - hip
    dist = float(np.hypot(*d))
    dmax = L1 + L2 - 1e-3
    err = max(0.0, dist - dmax)
    dist_c = min(max(dist, abs(L1 - L2) + 1e-3), dmax)
    cosk = (dist_c**2 - L1**2 - L2**2) / (2 * L1 * L2)
    k = math.degrees(math.acos(max(-1.0, min(1.0, cosk))))
    th_ht = math.degrees(math.atan2(-d[0], d[1]))
    cosb = (L1**2 + dist_c**2 - L2**2) / (2 * L1 * dist_c)
    beta = math.degrees(math.acos(max(-1.0, min(1.0, cosb))))
    th1 = th_ht - beta
    return th1, k, err


def spring_follow(target, fps, hz, zeta, loops=6):
    n = len(target)
    w = 2 * math.pi * hz
    sub = 16
    dt = 1.0 / (fps * sub)
    x, v = target[0], 0.0
    out = None
    for _ in range(loops):
        out = []
        for i in range(n):
            out.append(x)
            for s_ in range(sub):
                u = (i + s_ / sub) % n
                a, b = int(u) % n, (int(u) + 1) % n
                tg = target[a] + (target[b] - target[a]) * (u - int(u))
                acc = -w * w * (x - tg) - 2 * zeta * w * v
                v += acc * dt
                x += v * dt
    return out


def hermite(p0, p1, m0, m1, u):
    return (2 * u**3 - 3 * u**2 + 1) * p0 + (u**3 - 2 * u**2 + u) * m0 + (-2 * u**3 + 3 * u**2) * p1 + (u**3 - u**2) * m1


def generate(name):
    G = GAITS[name]
    N, fps, D, S, fwd = G["N"], G["fps"], G["duty"], G["stride"], G["fwd"]
    psi_f = smooth_periodic(G["psi"])
    kst = curve(G["kst"])

    def stance_rel_x(phi):                      # contact point relative to the hip, moving back at S per cycle
        return S * (D * fwd - phi)

    def contact_at(phi):
        return HX + stance_rel_x(phi)

    # ---- ankle targets per leg and frame ------------------------------------------------------------
    ank = {"r": [None] * N, "l": [None] * N}
    in_st = {"r": [False] * N, "l": [False] * N}
    psi = {"r": [0.0] * N, "l": [0.0] * N}
    for leg, off in (("r", 0.0), ("l", 0.5)):
        # swing endpoints
        a0, _ = foot_ankle(contact_at(D), psi_f(D))
        a3, _ = foot_ankle(contact_at(0.0), psi_f(0.0))
        for i in range(N):
            phi = (i / N + off) % 1.0
            psi[leg][i] = psi_f(phi)
            if phi < D - 1e-9 or abs(phi - D) < 1e-9 and False:
                a, _ = foot_ankle(contact_at(phi), psi[leg][i])
                ank[leg][i] = a
                in_st[leg][i] = True
            else:
                u = (phi - D) / (1.0 - D)
                m = -S * (1.0 - D)
                x = hermite(a0[0], a3[0], m, m, u)
                y = hermite(a0[1], a3[1], 0.0, 0.0, u) - G["clear"] * math.sin(math.pi * u) ** 1.3
                ank[leg][i] = np.array([x, y])
    # ---- pelvis height -------------------------------------------------------------------------------
    hy = [None] * N
    for i in range(N):
        implied = []
        for leg, off in (("r", 0.0), ("l", 0.5)):
            if in_st[leg][i]:
                phi = (i / N + off) % 1.0
                k = kst(phi / D)
                dd = math.sqrt(L1**2 + L2**2 + 2 * L1 * L2 * math.cos(math.radians(k)))
                dxh = ank[leg][i][0] - HX
                implied.append(ank[leg][i][1] - math.sqrt(max(dd**2 - dxh**2, 25.0)))
        if implied:
            hy[i] = max(implied)
    if any(v is None for v in hy):               # flight: ballistic arc between the stance frames around it
        for i in range(N):
            if hy[i] is None:
                a = max(j for j in range(i - N, i + 1) if hy[j % N] is not None)
                b = min(j for j in range(i, i + N + 1) if hy[j % N] is not None)
                u = (i - a) / (b - a)
                hy[i] = hy[a % N] * (1 - u) + hy[b % N] * u - G["apex"] * 4 * u * (1 - u)
    hy = np.array(hy, float)
    # ---- IK -----------------------------------------------------------------------------------------
    th, kn, ft = {}, {}, {}
    worst = 0.0
    for leg in ("r", "l"):
        th[leg], kn[leg], ft[leg] = [], [], []
        for i in range(N):
            t1, k, err = ik(np.array([HX, hy[i]]), ank[leg][i])
            worst = max(worst, err)
            th[leg].append(t1)
            kn[leg].append(k)
            ft[leg].append(psi[leg][i] - (t1 + k))      # foot rotation relative to the shin
    # ---- upper body ------------------------------------------------------------------------------------
    ph = np.arange(N) / N
    lean = G["lean"] + 1.2 * np.sin(2 * math.pi * 2 * ph + 0.6)
    arm_f = G["arm_f"] * np.cos(2 * math.pi * ph)
    arm_n = -G["arm_n"] * np.cos(2 * math.pi * ph)
    ef0, ef1 = G["elb_f"]
    en0, en1 = G["elb_n"]
    elb_f = ef0 + (ef1 - ef0) * (0.5 + 0.5 * np.cos(2 * math.pi * (ph - 0.07)))
    elb_n = en0 + (en1 - en0) * (0.5 + 0.5 * np.cos(2 * math.pi * (ph + 0.5 - 0.07)))
    head = -0.75 * lean + 0.8 * np.sin(2 * math.pi * 2 * (ph - 0.08))
    bob_acc = np.array([(hy[(i + 1) % N] - 2 * hy[i] + hy[(i - 1) % N]) for i in range(N)])
    drive = -0.35 * bob_acc - 0.5 * (np.roll(lean, -1) - 2 * lean + np.roll(lean, 1))
    c0, c1, c2 = G["cloak"]
    ca = spring_follow(list(c0 + 1.4 * drive), fps, 2.2, 0.35)
    cb = spring_follow(list(c1 + 1.8 * drive), fps, 1.7, 0.3)
    cc = spring_follow(list(c2 + 2.4 * drive), fps, 1.4, 0.28)
    # the thigh angle of each leg is -hip_flexion; positive rotate = backward
    hn = np.array([-t for t in th["r"]])
    hf = np.array([-t for t in th["l"]])
    tun_f = spring_follow([-G["tun"][0] * hn[i] + G["wind"] * 10.0 for i in range(N)], fps, 2.4, 0.4)
    tun_b = spring_follow([-G["tun"][1] * 0.5 * (hn[i] + hf[i]) + G["wind"] * 14.0 + 3 for i in range(N)], fps, 2.0, 0.4)
    sword = spring_follow([0.35 * (elb_n[i] - np.mean(elb_n)) for i in range(N)], fps, 2.6, 0.35)

    def keys(vals):
        vv = [float(x) for x in vals]
        return [[i, vv[i]] for i in range(N)] + [[N, vv[0]]]

    ch = {"pelvis": {"translate": {"keys": [[i, [0.0, float(hy[i] - HY0)]] for i in range(N)] + [[N, [0.0, float(hy[0] - HY0)]]], "ease": "linear"}},
          "torso": {"rotate": {"keys": keys(lean), "ease": "linear"}},
          "head": {"rotate": {"keys": keys(head), "ease": "linear"}}}
    for leg in ("r", "l"):
        ch["thigh-" + leg] = {"rotate": {"keys": keys(th[leg]), "ease": "linear"}}
        ch["shin-" + leg] = {"rotate": {"keys": keys(kn[leg]), "ease": "linear"}}
        ch["foot-" + leg] = {"rotate": {"keys": keys(ft[leg]), "ease": "linear"}}
    ch["upperarm-l"] = {"rotate": {"keys": keys(-arm_f - lean), "ease": "linear"}}
    ch["forearm-l"] = {"rotate": {"keys": keys(-elb_f), "ease": "linear"}}
    ch["upperarm-r"] = {"rotate": {"keys": keys(-arm_n - lean - 4), "ease": "linear"}}
    ch["forearm-r"] = {"rotate": {"keys": keys(-elb_n), "ease": "linear"}}
    ch["hand-r"] = {"rotate": {"keys": keys(sword), "ease": "linear"}}
    ch["cloak-a"] = {"rotate": {"keys": keys(ca), "ease": "linear"}}
    ch["cloak-b"] = {"rotate": {"keys": keys([cb[i] - ca[i] for i in range(N)]), "ease": "linear"}}
    ch["cloak-c"] = {"rotate": {"keys": keys([cc[i] - cb[i] for i in range(N)]), "ease": "linear"}}
    ch["tunic-front"] = {"rotate": {"keys": keys(tun_f), "ease": "linear"}}
    ch["tunic-back"] = {"rotate": {"keys": keys(tun_b), "ease": "linear"}}
    clip = {"clip": name, "fps": fps, "frames": N, "loop": True, "root_motion": False, "channels": ch}
    info = dict(S=S, D=D, hy=hy, ank=ank, in_st=in_st, th=th, kn=kn, ft=ft, psi=psi, worst=worst, speed=S * fps / N)
    return clip, info


if __name__ == "__main__":
    name, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    clip, info = generate(name)
    json.dump(clip, open(os.path.join(outdir, f"{name}.clip.json"), "w"), indent=1)
    N = clip["frames"]
    print(f"{name}: {N} frames @ {clip['fps']} fps | stride {info['S']:.0f} u/cycle | ground speed {info['speed']:.0f} u/s "
          f"= {info['speed'] * 0.36:.0f} px/s at game scale (engine: 270 px/s) | worst IK reach error {info['worst']:.2f} u")
    print("pelvis y :", [round(float(v), 1) for v in info["hy"]])
    for leg in ("r", "l"):
        print(f"leg {leg} stance:", [int(x) for x in info["in_st"][leg]])
        print(f"  hip flex :", [round(-t, 0) for t in info["th"][leg]])
        print(f"  knee flex:", [round(k, 0) for k in info["kn"][leg]])
        print(f"  ankle y  :", [round(float(a[1]), 1) for a in info["ank"][leg]])
