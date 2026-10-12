"""The Marked, human proportions: a 7-head adult in true side profile (facing right), as rig-ready
vector parts. Units = the 256 px game cell, sole at y=222 (the engine's feet anchor is 232 incl. shadow).

Proportion canon (head unit U = 25, skull top y=47, 7 heads to the sole):
  skull top 47 | eye 59 | chin 72 | shoulder joint 87 | nipple 97 | elbow/waist 122 | hip joint 132
  crotch 138 | wrist 148 | knee 178 | ankle 214 | sole 222
Segments: thigh 46, shin 36, foot 8 high / 31 long; upper arm 38, forearm 27, hand 19; sword 74.
Light: key cool from upper-left-behind (rim on the back edges), warm fill from the front-right.

usage: human.py OUT.svg [--grid]
"""
import math
import os
import random
import sys

rand = random.Random(3)
INK = "#070607"
HALO = 3.2
IW = 1.15

C = dict(
    deep="#15161a", cloak_dk="#1d1e21", cloak="#31373f", cloak_md="#48505c", cloak_lt="#697482", cloak_rim="#a1aab1",
    lea_dk="#2a221c", lea="#574a3d", lea_lt="#8f6c50", brass="#b08a52", brass_lt="#e0c58a",
    bone_dk="#756e61", bone="#a29882", bone_lt="#d5ceb9", white="#f8f9f6",
    red="#cf4841", red_dk="#8a2a28", steel_dk="#48505c", steel="#697482", steel_lt="#a1aab1",
    cloth="#2c2a2b", cloth_dk="#161415", cloth_lt="#4a4442",
)

defs = []
_n = [0]
halos = {}
parts = {}


def f(v):
    return f"{v:.1f}"


def uid(p):
    _n[0] += 1
    return f"{p}{_n[0]}"


def smooth(ps, closed=True):
    n = len(ps)
    d = f"M{f(ps[0][0])},{f(ps[0][1])}"
    for i in (range(n) if closed else range(n - 1)):
        p0 = ps[(i - 1) % n] if (closed or i > 0) else ps[i]
        p1, p2 = ps[i], ps[(i + 1) % n]
        p3 = ps[(i + 2) % n] if (closed or i + 2 < n) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{f(c1[0])},{f(c1[1])} {f(c2[0])},{f(c2[1])} {f(p2[0])},{f(p2[1])}"
    return d + (" Z" if closed else "")


def poly(ps, close=True):
    return "M" + " L".join(f"{f(x)},{f(y)}" for x, y in ps) + (" Z" if close else "")


def clip(d):
    c = uid("c")
    defs.append(f'<clipPath id="{c}"><path d="{d}"/></clipPath>')
    return c


def grad(c0, c1, p0, p1, mid=None):
    g = uid("g")
    st = f'<stop offset="0" stop-color="{c0}"/>' + (f'<stop offset="0.5" stop-color="{mid}"/>' if mid else "") + f'<stop offset="1" stop-color="{c1}"/>'
    defs.append(f'<linearGradient id="{g}" gradientUnits="userSpaceOnUse" x1="{f(p0[0])}" y1="{f(p0[1])}" x2="{f(p1[0])}" y2="{f(p1[1])}">{st}</linearGradient>')
    return f"url(#{g})"


def P(d, fill="none", w=IW, stroke=INK, op=None, extra=""):
    o = f' opacity="{op}"' if op is not None else ""
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{w}" stroke-linejoin="round" stroke-linecap="round"{o} {extra}/>'


def F(d, fill, op=None):
    o = f' opacity="{op}"' if op is not None else ""
    return f'<path d="{d}" fill="{fill}"{o}/>'


def L(ps, w=IW, stroke=INK, op=None):
    return P(poly(ps, False), "none", w, stroke, op)


def taper(a, b, w0, w1, bend=0.0):
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    nx, ny = -math.sin(ang), math.cos(ang)
    mx, my = (a[0] + b[0]) / 2 + nx * bend, (a[1] + b[1]) / 2 + ny * bend
    pa1, pa2 = (a[0] + nx * w0 / 2, a[1] + ny * w0 / 2), (a[0] - nx * w0 / 2, a[1] - ny * w0 / 2)
    pm1, pm2 = (mx + nx * (w0 + w1) / 4, my + ny * (w0 + w1) / 4), (mx - nx * (w0 + w1) / 4, my - ny * (w0 + w1) / 4)
    pb1, pb2 = (b[0] + nx * w1 / 2, b[1] + ny * w1 / 2), (b[0] - nx * w1 / 2, b[1] - ny * w1 / 2)
    return f"M{f(pa1[0])},{f(pa1[1])} Q{f(pm1[0])},{f(pm1[1])} {f(pb1[0])},{f(pb1[1])} L{f(pb2[0])},{f(pb2[1])} Q{f(pm2[0])},{f(pm2[1])} {f(pa2[0])},{f(pa2[1])} Z"


def ragged(a, b, depth, step, side=1):
    Ln = math.hypot(b[0] - a[0], b[1] - a[1])
    ux, uy = (b[0] - a[0]) / Ln, (b[1] - a[1]) / Ln
    nx, ny = -uy * side, ux * side
    out, t = [a], 0.0
    while True:
        w = rand.uniform(step * 0.6, step * 1.6)
        if t + w >= Ln - 1.0:
            break
        r = rand.random()
        dd = rand.uniform(depth, depth * 1.8) if r < 0.2 else rand.uniform(depth * 0.25, depth) if r < 0.75 else rand.uniform(0, depth * 0.3)
        mid = t + w * rand.uniform(0.35, 0.65)
        out.append((a[0] + ux * (t + w * 0.1), a[1] + uy * (t + w * 0.1)))
        out.append((a[0] + ux * mid + nx * dd, a[1] + uy * mid + ny * dd))
        t += w
        out.append((a[0] + ux * t, a[1] + uy * t))
    out.append(b)
    return out


def hatch(cid, box, gap=3.0, angle=0.9, op=0.5, w=0.7, shadow=None):
    x0, y0, x1, y1 = box
    inner = close = ""
    if shadow:
        sc = clip(poly(shadow))
        inner, close = f'<g clip-path="url(#{sc})">', "</g>"
    s_ = [f'<g clip-path="url(#{cid})">{inner}<g stroke="{INK}" stroke-opacity="{op}" stroke-width="{w}" stroke-linecap="round">']
    dx, dy = math.cos(angle), math.sin(angle)
    span = (x1 - x0) + (y1 - y0)
    k = -span
    while k < span:
        j = rand.uniform(-0.5, 0.5)
        ln = rand.uniform(0.55, 1.0) * span
        s_.append(f'<line x1="{f(x0 + k + j)}" y1="{f(y0)}" x2="{f(x0 + k + j + dx * ln)}" y2="{f(y0 + dy * ln)}"/>')
        k += gap + rand.uniform(-0.4, 0.4)
    return "".join(s_) + "</g>" + close + "</g>"


def part(pid, d_base, fill, clipped="", extras="", outline=IW, halo=True, halo_w=None):
    c = clip(d_base)
    s = [f'<g id="{pid}">', F(d_base, fill)]
    if clipped:
        s.append(f'<g clip-path="url(#{c})">{clipped}</g>')
    s.append(extras)
    # weighted line: thicker on the lower-front (shadow side), thin on the lit back edge
    s.append(f'<g clip-path="url(#{c})">{P(d_base, "none", outline + 0.8, INK, 0.85, extra="transform=" + chr(34) + "translate(-0.7 -0.9)" + chr(34))}</g>')
    s.append(P(d_base, "none", outline))
    s.append("</g>")
    parts[pid] = "".join(s)
    if halo:
        halos[pid] = f'<g id="halo-{pid}"><path d="{d_base}" fill="{INK}" stroke="{INK}" stroke-width="{2 * (halo_w or HALO)}" stroke-linejoin="round"/></g>'


def limb_d(a, b, stations, cap=True):
    """Anatomical limb outline from joint a to joint b. stations: (t, front_w, back_w); front = image-right
    for a limb hanging down (facing right). Round caps cover the joints when the limb bends."""
    Ln = math.hypot(b[0] - a[0], b[1] - a[1])
    ux, uy = (b[0] - a[0]) / Ln, (b[1] - a[1]) / Ln
    nx, ny = -uy, ux                       # +n = back (image-left for a downward limb)
    at = lambda t, s_: (a[0] + ux * t * Ln + nx * s_, a[1] + uy * t * Ln + ny * s_)
    front = [at(t, -wf) for t, wf, wb in stations]
    back = [at(t, wb) for t, wf, wb in reversed(stations)]
    cap_b, cap_a = [], []
    if cap:
        fb, bb = front[-1], back[0]
        cb = ((fb[0] + bb[0]) / 2, (fb[1] + bb[1]) / 2)
        rb = math.hypot(fb[0] - bb[0], fb[1] - bb[1]) / 2
        for k in range(1, 6):
            ph = math.pi * k / 6
            cap_b.append((cb[0] + (fb[0] - cb[0]) * math.cos(ph) + ux * rb * math.sin(ph), cb[1] + (fb[1] - cb[1]) * math.cos(ph) + uy * rb * math.sin(ph)))
        fa, ba = front[0], back[-1]
        ca = ((fa[0] + ba[0]) / 2, (fa[1] + ba[1]) / 2)
        ra = math.hypot(fa[0] - ba[0], fa[1] - ba[1]) / 2
        for k in range(1, 6):
            ph = math.pi * k / 6
            cap_a.append((ca[0] + (ba[0] - ca[0]) * math.cos(ph) - ux * ra * math.sin(ph), ca[1] + (ba[1] - ca[1]) * math.cos(ph) - uy * ra * math.sin(ph)))
    return smooth(front + cap_b + back + cap_a), at, (ux, uy, nx, ny, Ln)


# ═══ landmarks ═══════════════════════════════════════════════════════════════
H_ = (127.0, 132.0)       # hip joint
K_ = (127.0, 178.0)       # knee
A_ = (127.0, 214.0)       # ankle
SH = (133.0, 88.0)        # shoulder joint
NECK = (134.0, 80.0)
HEAD = (136.0, 72.0)      # atlas / head pivot
from geometry import EL_N, WR_N, GRIP_REL, FIST_DROP  # noqa: E402  (the near arm and the grip, shared with the pose code)
EL_F, WR_F = (128.0, 124.0), (124.0, 149.0)

THIGH = [(0, 11.5, 10.5), (0.28, 13.5, 12.5), (0.62, 11, 9.5), (1, 8.4, 8.0)]
SHIN = [(0, 8.2, 8.0), (0.2, 7.6, 10.6), (0.4, 7.0, 10.0), (0.7, 6.0, 7.2), (1, 5.4, 5.4)]
UARM = [(0, 6.6, 6.6), (0.3, 7.6, 7.2), (0.7, 6.0, 6.0), (1, 5.2, 5.2)]
FARM = [(0, 5.4, 5.4), (0.25, 6.4, 6.0), (0.7, 4.8, 4.8), (1, 4.0, 4.0)]


def tone_limb(base, shade, lit, fold=True):
    return base, shade, lit


def wraps(a, b, t0, t1, width, seed, colors):
    """Slanted wrap bands along a limb between parameters t0 and t1 (wide enough to cover the limb)."""
    r_ = random.Random(seed)
    Ln = math.hypot(b[0] - a[0], b[1] - a[1])
    ux, uy = (b[0] - a[0]) / Ln, (b[1] - a[1]) / Ln
    nx, ny = -uy, ux
    out = []
    t = t0 * Ln
    k = 0
    while t < t1 * Ln:
        h = r_.uniform(3.4, 5.6)
        sl = r_.uniform(1.6, 3.4)
        col = colors[k % len(colors)]
        p0 = (a[0] + ux * t + nx * width, a[1] + uy * t + ny * width)
        p1 = (a[0] + ux * (t + sl) - nx * width, a[1] + uy * (t + sl) - ny * width)
        p2 = (p1[0] + ux * h, p1[1] + uy * h)
        p3 = (p0[0] + ux * h, p0[1] + uy * h)
        out.append(F(poly([p0, p1, p2, p3]), col))
        out.append(F(poly([p0, p1, (p1[0] + ux * 1.1, p1[1] + uy * 1.1), (p0[0] + ux * 1.1, p0[1] + uy * 1.1)]), C["bone_lt"], 0.85))
        out.append(P(poly([p3, p2], False), "none", 0.95 + r_.uniform(0, 0.4), INK, 0.95))
        t += h + r_.uniform(0.2, 0.9)
        k += 1
    return "".join(out)


# ═══ cloak: three chained strips hanging from the shoulders ══════════════════
CLOAK_BACK = [(121, 84), (116, 100), (112, 122), (109, 148), (106, 172), (103, 196)]
CLOAK_FRONT = [(132, 84), (128, 104), (125, 124), (123, 150), (121, 174), (120, 198)]


def lerp_edge(edge, y):
    for (x0, y0), (x1, y1) in zip(edge, edge[1:]):
        if y0 <= y <= y1:
            return x0 + (x1 - x0) * (y - y0) / (y1 - y0)
    return edge[-1][0]


def cloak_strip(pid, y0, y1, depth, step):
    ys = [y0] + [y for y in range(int(y0) + 8, int(y1) - 3, 8)] + [y1]
    back = [(lerp_edge(CLOAK_BACK, y), y) for y in ys]
    front = [(lerp_edge(CLOAK_FRONT, y), y) for y in ys]
    hem = ragged(back[-1], front[-1], depth, step, side=1)          # torn lower edge, tongues hanging down
    pts = back + hem[1:-1] + [front[-1]] + list(reversed(front[:-1]))
    d = "M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts) + " Z"
    t = [F(poly([(95, y0 - 2), (140, y0 - 2), (140, y1 + 12), (95, y1 + 12)]), grad(C["cloak_md"], C["cloak_dk"], (104, y0), (128, y1 + 6), mid=C["cloak"]))]
    t.append(F(taper((lerp_edge(CLOAK_BACK, y0 + 2) + 2, y0 + 2), (lerp_edge(CLOAK_BACK, y1) + 2, y1), 4.0, 1.4, 0.4), C["cloak_lt"], 0.9))
    t.append(F(taper((lerp_edge(CLOAK_BACK, y0 + 2) + 0.4, y0 + 2), (lerp_edge(CLOAK_BACK, y1) + 0.4, y1), 1.4, 0.6, 0.2), C["cloak_rim"], 0.9))
    t.append(F(poly([(lerp_edge(CLOAK_FRONT, y0) - 7, y0), (lerp_edge(CLOAK_FRONT, y0) + 2, y0), (lerp_edge(CLOAK_FRONT, y1) + 2, y1 + 8), (lerp_edge(CLOAK_FRONT, y1) - 7, y1 + 8)]), C["deep"], 0.6))
    for dx in (5, 10, 15):
        t.append(L([(lerp_edge(CLOAK_BACK, y0) + dx, y0), (lerp_edge(CLOAK_BACK, y1) + dx + 1.5, y1 + 4)], 0.9, INK, 0.8))
    part(pid, d, C["cloak"], clipped="".join(t), outline=0.95)
    cc = clip(d)
    parts[pid] = parts[pid][:-4] + hatch(cc, (95, y0, 140, y1 + 10), gap=3.4, angle=1.35, op=0.45, w=0.7,
                                         shadow=[(lerp_edge(CLOAK_FRONT, y0) - 9, y0), (140, y0), (140, y1 + 10), (lerp_edge(CLOAK_FRONT, y1) - 9, y1 + 10)]) + "</g>"


cloak_strip("cloak-a", 84, 126, 3.0, 4.6)
cloak_strip("cloak-b", 120, 160, 3.6, 4.8)
cloak_strip("cloak-c", 154, 196, 6.5, 4.6)

# ═══ far arm (character's left): sleeve, wrapped forearm, relaxed hand ═══════
dua, at_, _ = limb_d(SH, EL_F, UARM)
t = [F("M90,70 H150 V140 H90 Z", grad(C["cloak_md"], C["cloak_dk"], (126, 90), (134, 124), mid=C["cloak_dk"])),
     F(taper((130, 92), (127, 120), 3, 1, 0.3), C["cloak_lt"], 0.7)]
part("upperarm-l", dua, C["cloak_dk"], clipped="".join(t), outline=1.0)
dfa, _, _ = limb_d(EL_F, WR_F, FARM)
t = [F("M90,100 H150 V170 H90 Z", C["bone_dk"]), wraps(EL_F, WR_F, 0.0, 0.95, 8, 4, [C["bone_dk"], C["bone"], C["bone_dk"]]),
     F("M118,110 H140 V170 H118 Z", C["deep"], 0.35)]
part("forearm-l", dfa, C["bone_dk"], clipped="".join(t), outline=1.0)
hand_l = smooth([(120.6, 146), (127.4, 146), (129.4, 152.5), (128.2, 159.4), (122.6, 161), (119.6, 154)])
hl = [F(poly([(118, 144), (131, 144), (131, 163), (118, 163)]), grad(C["lea"], C["lea_dk"], (129, 148), (120, 160))),
      F(smooth([(119, 147), (123, 146), (122.4, 156), (119.4, 158)]), C["deep"], 0.4)]
for fx_ in (122.4, 124.9, 127.2):                                   # curled fingers
    hl.append(L([(fx_, 154.2), (fx_ - 0.2, 160.6)], 0.8, INK, 0.9))
hl.append(F(smooth([(127.6, 148), (131.2, 150), (130.6, 154.4), (127.8, 153)]), C["lea"]))   # the thumb
hl.append(P("M121,153.6 Q125,155.4 129,153.6", "none", 0.8, INK, 0.7))
part("hand-l", hand_l, C["lea_dk"], clipped="".join(hl), outline=1.0)

# ═══ legs ════════════════════════════════════════════════════════════════════
def leg(sfx, far):
    k = 0.72 if far else 1.0

    def dim(col):
        if not far:
            return col
        return "#%02x%02x%02x" % tuple(int(int(col[i:i + 2], 16) * k) for i in (1, 3, 5))
    d_t, at_t, g_t = limb_d(H_, K_, THIGH)
    t = [F("M95,120 H160 V190 H95 Z", grad(dim(C["cloth_lt"]), dim(C["cloth_dk"]), (140, 140), (116, 170), mid=dim(C["cloth"])))]
    t.append(F(taper((120, 134), (121, 176), 5, 2, 0.5), dim(C["cloth_lt"]), 0.6))                              # hamstring/glute lit edge (back-left key)
    t.append(F(poly([(133, 134), (143, 134), (140, 178), (131, 178)]), dim(C["deep"]), 0.45))                    # quad's shadow side
    t.append(L([(126, 150), (127, 176)], 0.8, INK, 0.5))
    # leg wraps tied over the lower thigh
    t.append(wraps(H_, K_, 0.62, 0.98, 16, 11 + (5 if far else 0), [dim(C["bone"]), dim(C["bone_lt"]), dim(C["bone"]), dim(C["bone_dk"])]))
    part("thigh-" + sfx, d_t, dim(C["cloth"]), clipped="".join(t), outline=1.0)
    d_s, at_s, g_s = limb_d(K_, A_, SHIN)
    t = [F("M95,170 H160 V222 H95 Z", dim(C["bone"]))]
    t.append(wraps(K_, A_, 0.0, 0.8, 16, 23 + (5 if far else 0), [dim(C["bone"]), dim(C["bone_lt"]), dim(C["bone"]), dim(C["white"]) if not far else dim(C["bone_lt"]), dim(C["bone_dk"])]))
    t.append(F(taper((120.5, 182), (121.5, 208), 4.5, 1.5, 0.3), dim(C["bone_lt"]), 0.6))
    t.append(F(poly([(131, 178), (140, 178), (138, 214), (130, 214)]), dim(C["deep"]), 0.4))                      # front of the shin turns from the key
    part("shin-" + sfx, d_s, dim(C["bone"]), clipped="".join(t), outline=1.0)
    # the boot: tall leather boot, folded cuff, a lit toe cap, thick sole, heel block
    ax, ay = A_
    bt = smooth([(ax - 7, 203), (ax + 7, 203), (ax + 8, 209), (ax + 13, 213), (ax + 21, 215), (ax + 24.5, 218.5), (ax + 23.5, 221.8), (ax - 9, 221.8), (ax - 9.5, 214), (ax - 8, 208)])
    b = [F(f"M{ax - 14},{200} H{ax + 30} V224 H{ax - 14} Z", dim(C["deep"])),
         F(smooth([(ax - 6, 204.5), (ax + 6.5, 204.5), (ax + 8, 209.5), (ax + 14, 213.5), (ax + 21, 215.4), (ax + 5, 215.4), (ax - 6, 213)]), dim(C["cloak_md"]), 0.9),
         F(smooth([(ax + 8, 210.5), (ax + 15, 213), (ax + 23, 215.3), (ax + 13, 214.7)]), dim(C["cloak_lt"]), 0.95),
         F(f"M{ax - 14},{218.2} H{ax + 30} V224 H{ax - 14} Z", INK),
         F(poly([(ax - 9.5, 214), (ax - 3, 214), (ax - 3, 218.4), (ax - 9.5, 218.4)]), dim(C["lea_dk"])),
         L([(ax - 7, 205.2), (ax + 7, 205.2)], 1.0, INK, 0.95),
         L([(ax - 7, 208.6), (ax + 8, 209.4)], 1.9, dim(C["lea"]), 0.95)]
    b.append(f'<rect x="{f(ax + 1)}" y="{f(207.4)}" width="3.2" height="3.2" fill="none" stroke="{dim(C["brass"])}" stroke-width="0.9"/>')
    part("foot-" + sfx, bt, dim(C["deep"]), clipped="".join(b), outline=1.0)


leg("l", True)

# ═══ tunic back panel + torso + tunic front panel ════════════════════════════
def panel(pid, x0, x1, y0, y1, depth, col_lit, flip=False, torn=True):
    pts_top = [(x0, y0), (x1, y0)]
    hem = ragged((x1, y1), (x0, y1), depth, 4.0, side=-1)
    d = "M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts_top + hem) + " Z"
    t = [F(poly([(x0 - 3, y0 - 2), (x1 + 3, y0 - 2), (x1 + 3, y1 + 12), (x0 - 3, y1 + 12)]), grad(C["cloak_md"], C["cloak_dk"], (x0, y0), (x1, y1), mid=C["cloak"])),
         F(taper((x0 + 2, y0 + 1), (x0 + 3, y1), 3.4, 0.8, 0.3), C["cloak_lt"], 0.85),
         F(poly([(x1 - 5, y0), (x1 + 2, y0), (x1 + 2, y1 + 10), (x1 - 5, y1 + 10)]), C["deep"], 0.5),
         L([((x0 + x1) / 2, y0 + 2), ((x0 + x1) / 2 + 1, y1 - 2)], 0.9, INK, 0.75)]
    part(pid, d, C["cloak"], clipped="".join(t), outline=0.95)


panel("tunic-back", 114, 128, 120, 166, 5.0, C["cloak_lt"])

TOR = [(124, 82), (136, 80), (141, 84), (144, 96), (143, 110), (141, 122), (141, 134), (132, 139), (122, 138), (120, 128), (119, 112), (120, 98)]
tor_d = smooth(TOR)
t = [F("M96,70 H160 V150 H96 Z", C["cloak_dk"])]
# quilted gambeson showing at the back and flank
for y in range(92, 122, 6):
    t.append(P(f"M118,{y} Q128,{y + 2.5} 142,{y}", "none", 0.7, INK, 0.4))
# leather cuirass over the chest, with a high collar
cuir = smooth([(126, 85), (138, 84), (144, 94), (144, 108), (141, 121), (128, 121), (125, 104)])
t.append(F(cuir, grad(C["lea_lt"], C["lea_dk"], (126, 90), (143, 118), mid=C["lea"])))
t.append(F(smooth([(126, 86), (130, 85), (129, 118), (126, 105)]), C["lea_lt"], 0.7))
t.append(P(cuir, "none", 1.0))
for (x_, y_) in ((131, 92), (140, 98), (131, 112), (139, 114)):
    t.append(f'<circle cx="{x_}" cy="{y_}" r="0.9" fill="{C["brass_lt"]}" stroke="{INK}" stroke-width="0.4"/>')
# bandolier from the near shoulder across to the far hip, with vials
band = [(129, 85), (134, 85), (145, 118), (140, 119)]
t.append(F(poly(band), C["lea"]))
t.append(F(poly([(129, 85), (131.4, 85), (142.2, 118.4), (140, 119)]), C["lea_lt"], 0.9))
t.append(P(poly(band), "none", 0.95))
for (x_, y_) in ((133.6, 96), (137.2, 105)):
    t.append(f'<rect x="{x_ - 1.8}" y="{y_ - 4}" width="3.6" height="7.4" rx="1.4" fill="#5a7a6a" stroke="{INK}" stroke-width="0.7"/>')
    t.append(f'<rect x="{x_ - 1.4}" y="{y_ - 5.4}" width="2.8" height="2" fill="{C["lea_dk"]}"/>')
# brass medallion on the chest front
t.append(f'<circle cx="141.6" cy="101" r="3.6" fill="{C["brass"]}" stroke="{INK}" stroke-width="0.9"/><circle cx="141.6" cy="101" r="1.9" fill="none" stroke="{INK}" stroke-width="0.7"/>')
# belt, bone buckle, near-hip pouch, charm and a coil of red thread
t.append(F("M118,119 L143,119 L143,126 L118,126 Z", C["lea_dk"]))
t.append(F("M118,119 L143,119 L143,121.4 L118,121.4 Z", C["lea"]))
t.append(P("M118,119 H143 M118,126 H143", "none", 0.95))
t.append(F("M137,118.4 H143.6 V126.6 H137 Z", C["bone_lt"]))
t.append(F("M139,120.6 H142 V124.6 H139 Z", C["lea_dk"]))
t.append(P("M137,118.4 H143.6 V126.6 H137 Z", "none", 0.95))
pouch = smooth([(127, 126), (137, 126), (138.5, 136), (133, 140), (127, 137)])
t.append(F(pouch, grad(C["lea_lt"], C["lea_dk"], (136, 126), (128, 139), mid=C["lea"])))
t.append(F(smooth([(127, 126), (137, 126), (137.6, 130), (127, 131)]), C["lea_lt"], 0.85))
t.append(P(pouch, "none", 0.95))
t.append(f'<circle cx="132.4" cy="131.4" r="1.0" fill="{C["brass"]}"/>')
for r_, o_ in ((4.2, 1), (3.0, 0.9)):
    t.append(f'<ellipse cx="121.6" cy="130" rx="{r_}" ry="{r_ * 0.9}" fill="none" stroke="{C["red"]}" stroke-width="1.2" opacity="{o_}"/>')
t.append(L([(138, 126.6), (137.6, 130)], 0.7, C["bone_dk"]))
t.append(F(poly([(135.8, 130), (139.4, 130), (138.8, 135), (137.6, 140), (136.6, 135)]), C["bone_lt"]))
t.append(f'<circle cx="137.6" cy="131.6" r="1.2" fill="{C["red"]}" stroke="{INK}" stroke-width="0.5"/>')
tc = clip(tor_d)
part("torso", tor_d, C["cloak_dk"], clipped="".join(t), outline=1.0)
parts["torso"] = parts["torso"].replace("</g>", hatch(tc, (116, 80, 146, 140), gap=3.0, angle=1.0, op=0.45, w=0.7, shadow=[(136, 80), (150, 80), (150, 140), (130, 140)]) + "</g>", 1)

panel("tunic-front", 129, 145, 122, 170, 5.5, C["cloak_lt"])

# ═══ near leg ════════════════════════════════════════════════════════════════
leg("r", False)

# ═══ mantle (shoulder cape) ═════════════════════════════════════════════════
mh = ragged((147, 98), (116, 100), 4.4, 4.6, side=1)
man_d = smooth([(116, 88), (124, 80), (136, 79), (144, 84), (148, 92), (147, 98)], closed=False) + " " + " ".join(f"L{f(x)},{f(y)}" for x, y in mh) + " " + smooth([(116, 100), (114, 94), (116, 88)], closed=False).replace("M", "L", 1) + " Z"
m = [F("M110,76 H152 V108 H110 Z", grad(C["cloak_md"], C["cloak_dk"], (116, 82), (146, 100), mid=C["cloak"])),
     F(taper((118, 86), (136, 96), 7, 1.5, 1), C["cloak_lt"], 0.9), F(taper((119, 84), (130, 92), 2.2, 0.6, 0.4), C["cloak_rim"], 0.85),
     F(poly([(138, 82), (152, 82), (152, 108), (138, 108)]), C["deep"], 0.55)]
for x0, x1 in [(124, 122), (132, 131), (140, 141)]:
    m.append(L([(x0, 84), (x1, 98)], 0.9, INK, 0.8))
part("mantle", man_d, C["cloak"], clipped="".join(m), outline=1.0)

# ═══ head: a peaked, torn hood around a 3/4 skull mask (as in the sprite and the portrait) ═════
def hood_edge(pts, depth, step, side):
    out = []
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        out += ragged((x0, y0), (x1, y1), depth, step, side)[:-1]
    out.append(pts[-1])
    return out


# outer silhouette: crown, a pointed peak that droops backward, torn back and lower edges
hood_d = ("M156.5,60 C157.6,49.5 150.4,41 140.4,38.2 C131.6,36 122.6,37.6 116.4,43.4 L105.4,48.8 "
          "C109.6,49.6 113.4,52.4 114.8,56.6 C111.6,64 111,73 114.2,79.6 "
          + " ".join(f"L{f(x)},{f(y)}" for x, y in hood_edge([(114.2, 79.6), (118, 85.6), (126, 89.4), (134, 90)], 2.6, 3.8, -1)[1:])
          + " L141.6,88 C148,86.6 153.6,81 156.2,73.6 C158,68.4 157.6,64 156.5,60 Z")
void_d = ("M131.4,59.4 C133.4,52.4 142,49 149.6,51.8 C155.6,55.2 157,63 155.8,70.6 C154.6,77.6 149.6,82 143,82.4 "
          "C136.4,82 131,76.6 130.8,69.4 C130.6,65 130.8,62 131.4,59.4 Z")
h = [F("M96,30 H166 V96 H96 Z", grad(C["cloak_md"], C["cloak_dk"], (116, 44), (150, 80), mid=C["cloak"]))]
# lit crown and peak (key from upper-left-behind), deep shadow where the hood folds into the opening
h.append(F("M112,50 C116,42 126,38.6 138,39.4 C144,40 148,43 150,47 C142,43.6 128,44 118,52 Z", C["cloak_lt"], 0.95))
h.append(F(taper((118, 44), (140, 39.4), 3.2, 0.6, -0.4), C["cloak_rim"], 0.85))
h.append(F(taper((106, 49), (120, 43), 3.6, 0.8, -0.3), C["cloak_lt"], 0.9))
h.append(F(smooth([(114, 58), (121, 54), (128, 62), (127, 78), (120, 86), (115, 80)]), C["cloak_dk"], 0.9))       # the shadowed back of the cowl
h.append(F(poly([(124, 50), (136, 42), (150, 50), (158, 70), (158, 96), (120, 96)]), C["deep"], 0.35))
# long cloth folds running from the crown toward the nape, and fold lines fanning from the peak
for a_, b_, bend in [((118, 48), (116, 80), -3), ((124, 44), (123, 70), -2), ((131, 41), (129, 58), -1.4), ((109, 50), (113, 62), 1)]:
    h.append(P(f"M{a_[0]},{a_[1]} Q{(a_[0] + b_[0]) / 2 + bend},{(a_[1] + b_[1]) / 2} {b_[0]},{b_[1]}", "none", 0.95, INK, 0.8))
# the opening: a dark void, with a torn lit rim along the brim
h.append(F(void_d, INK))
rim = hood_edge([(131, 59.4), (134, 53.2), (142, 49.6), (150, 51.6), (155.4, 56.4)], 0.9, 4.2, 1)
h.append(F("M" + " L".join(f"{f(x)},{f(y)}" for x, y in rim) + f" L155.4,52.6 L150,47.6 L142,46 L134,49.6 L131,55 Z", C["cloak_md"], 0.95))
h.append(P(smooth([(131, 58.4), (134, 52.4), (142, 48.8), (150, 50.8)], closed=False), "none", 0.9, C["cloak_lt"], 0.8))
hc = clip(hood_d)
h.append(hatch(hc, (100, 36, 160, 92), gap=2.8, angle=1.05, op=0.5, w=0.7, shadow=[(104, 70), (130, 56), (136, 96), (104, 96)]))
part("head", hood_d, C["cloak"], clipped="".join(h), outline=1.0)

# the mask: a skull in 3/4, bone-white, with a heavy brow, deep sockets, a nasal cavity, cheekbones and teeth
mask_d = ("M135.4,56.6 C140,52.8 147.6,53 151.6,57.6 C154.4,62.4 153.8,68 151.8,72 C150,75.4 146.8,77.8 143.2,78 "
          "C139.6,77.4 136.8,74.6 135.6,70.4 C134.6,66.4 134.4,60.6 135.4,56.6 Z")
mc = clip(mask_d)
ms = [F("M126,48 H160 V84 H126 Z", grad("#fbfbf6", C["bone_dk"], (153, 62), (135, 74), mid=C["bone_lt"])),
      F("M146,50 H160 V84 H146 Z", "#e8c88e", 0.16),                                                              # warm candle fill on the near cheek
      F(smooth([(133, 56), (139.4, 55.4), (140.6, 70), (138.4, 79), (132, 79)]), C["bone"], 0.9),               # the far side turns away from the key
      F(smooth([(132, 54), (140, 55.6), (148, 55.2), (156, 52), (156, 48), (131, 48)]), "#1c1a19", 0.6),         # the hood's cast shadow on the top of the forehead
      F(poly([(134.4, 61.2), (142, 59.6), (153, 60.8), (153, 62.4), (142, 61.2), (134.4, 63.6)]), C["bone_dk"], 0.55),   # brow ridge
      ]
ms.append(P("M135,62.8 Q143,59.8 153.2,62", "none", 1.0, INK, 0.85))
# sockets in perspective: the near one wide, the far one narrow and tucked toward the edge of the face
ms.append(f'<ellipse cx="149.6" cy="64.2" rx="3.7" ry="3.4" transform="rotate(-12 149.6 64.2)" fill="{INK}"/>')
ms.append(f'<ellipse cx="140.6" cy="64.6" rx="2.3" ry="3.0" transform="rotate(8 140.6 64.6)" fill="{INK}"/>')
ms.append(P("M146.4,66.6 Q149,68 152,66.2", "none", 0.7, C["bone_lt"], 0.7))
# nasal cavity, shifted toward the near cheek
ms.append(F("M145.8,67.6 C147.2,67.6 148.2,70.2 148.4,71.4 L143,71.4 C143.2,69.8 144.2,67.8 145.8,67.6 Z", INK))
ms.append(F(smooth([(149.6, 68), (152.4, 66.4), (153, 70.6), (150, 72.4)]), C["bone_dk"], 0.5))
ms.append(P("M150.2,67.2 Q152,68.8 151.4,72", "none", 0.8, INK, 0.45))
# teeth: five, compressed on the far side, with dark gaps
xs = [137.6, 140.0, 142.8, 145.8, 149.0, 152.0]
for i in range(5):
    x0, x1 = xs[i], xs[i + 1] - 0.5
    ms.append(F(f"M{f(x0)},72.4 H{f(x1)} V75.2 H{f(x0)} Z", C["bone_lt"] if i % 2 else C["white"]))
ms.append(L([(136.6, 72.2), (152, 72.2)], 0.8, INK, 0.9))
ms.append(L([(137, 75.4), (151.6, 75.4)], 0.9, INK, 0.95))
for x_ in xs[1:5]:
    ms.append(L([(x_ - 0.25, 72.3), (x_ - 0.25, 75.4)], 0.55, INK, 0.95))
ms.append(F(poly([(137.2, 75.8), (151.2, 75.8), (147.4, 79), (141.6, 79)]), C["bone_dk"], 0.6))
# cracks, a split lip on the far side
ms.append(L([(136.6, 57.6), (137.8, 61), (137, 64.6), (138.2, 68)], 0.7, INK, 0.7))
ms.append(L([(152, 68.4), (149.8, 71.4), (150.6, 74)], 0.6, INK, 0.6))
ms.append(F(poly([(135.6, 71.6), (137.4, 71.2), (137.6, 74.8), (136, 75.2)]), C["red"], 0.95))
# the brand, a cross burned into the forehead above the near eye, bleeding down the temple
ms.append(F(poly([(146.6, 54.6), (148.4, 54.6), (148.4, 56.4), (150.6, 56.4), (150.6, 58.0), (148.4, 58.0), (148.4, 60.0), (146.6, 60.0), (146.6, 58.0), (144.6, 58.0), (144.6, 56.4), (146.6, 56.4)]), C["red"]))
ms.append(F(poly([(146.6, 56.4), (148.4, 56.4), (148.4, 58.0), (146.6, 58.0)]), C["red_dk"], 0.9))
ms.append(F(poly([(150.4, 58.0), (151.5, 58.0), (151.3, 61.2), (150.6, 61.2)]), C["red"], 0.85))
parts["head"] = parts["head"][:-4] + f'<g id="head-mask"><g clip-path="url(#{mc})">{"".join(ms)}</g>{P(mask_d, "none", 1.1)}</g></g>'

# ═══ near arm: quilted sleeve + leather pauldron, wrapped forearm with bracer, sword ═══
pauld = (P(smooth([(129, 83), (138, 83.6), (140.6, 90), (137, 96), (130.6, 94.6), (128, 89)]), grad(C["lea_lt"], C["lea_dk"], (130, 83), (140, 98), mid=C["lea"]), 1.0)
         + P("M131,89 Q134.6,91.4 139,90.4", "none", 0.8, INK, 0.7) + f'<circle cx="136.4" cy="86.8" r="1.0" fill="{C["brass"]}"/>')
dun, at_u, _ = limb_d(SH, EL_N, UARM)
t = [F("M100,70 H160 V140 H100 Z", grad(C["cloak_md"], C["cloak_dk"], (130, 90), (140, 124), mid=C["cloth"])),
     F(taper((130.4, 94), (131.4, 120), 3.4, 1, 0.3), C["cloak_lt"], 0.9)]
for y in range(98, 122, 6):
    t.append(P(f"M126,{y} Q134,{y + 2} 142,{y}", "none", 0.7, INK, 0.35))
part("upperarm-r", dun, C["cloak"], clipped="".join(t), outline=1.0, extras=pauld)
dfn, at_f, _ = limb_d(EL_N, WR_N, FARM)
t = [F("M100,110 H170 V170 H100 Z", C["bone"]), wraps(EL_N, WR_N, 0.0, 0.55, 8, 6, [C["bone"], C["bone_lt"], C["bone"], C["bone_dk"]])]
Lf = math.hypot(WR_N[0] - EL_N[0], WR_N[1] - EL_N[1])
uxf, uyf = (WR_N[0] - EL_N[0]) / Lf, (WR_N[1] - EL_N[1]) / Lf
nxf, nyf = -uyf, uxf
brc = [(EL_N[0] + uxf * 0.5 * Lf + nxf * 9, EL_N[1] + uyf * 0.5 * Lf + nyf * 9), (EL_N[0] + uxf * 0.5 * Lf - nxf * 9, EL_N[1] + uyf * 0.5 * Lf - nyf * 9),
       (WR_N[0] - nxf * 9, WR_N[1] - nyf * 9), (WR_N[0] + nxf * 9, WR_N[1] + nyf * 9)]
t.append(F(poly(brc), grad(C["lea_lt"], C["lea_dk"], (EL_N[0] + nxf * 6, EL_N[1]), (EL_N[0] - nxf * 6, EL_N[1]), mid=C["lea"])))
t.append(P(poly(brc), "none", 0.9))
t.append(L([(brc[0][0] + uxf * 4, brc[0][1] + uyf * 4), (brc[1][0] + uxf * 4, brc[1][1] + uyf * 4)], 0.9, INK, 0.9))
t.append(F("M100,110 H170 V170 H100 Z", C["deep"], 0.12))
part("forearm-r", dfn, C["bone"], clipped="".join(t), outline=1.0)

# ═══ sword and fist ═══════════════════════════════════════════════════════════════════════════════
# A hammer grip: the grip crosses the palm about 80 degrees from the forearm, so on a forearm running down-forward the
# blade points forward and a little up (the wrist, not the arm, decides where the point goes). The fist wraps the grip:
# only the pommel and the guard show either side of it. Local frame (t, s): t along the blade, s toward the fingers.
FA = math.atan2(WR_N[1] - EL_N[1], WR_N[0] - EL_N[0])
ang = FA - math.radians(GRIP_REL)
ux, uy = math.cos(ang), math.sin(ang)
px_, py_ = -uy, ux
fdx, fdy = math.cos(FA), math.sin(FA)                 # forearm direction (elbow to wrist)
nfx, nfy = -fdy, fdx
G = (WR_N[0] + fdx * FIST_DROP, WR_N[1] + fdy * FIST_DROP)       # centre of the fist, on the grip's axis


def sat(t_, s_):
    return (G[0] + ux * t_ + px_ * s_, G[1] + uy * t_ + py_ * s_)


B0, Lb = 4.8, 54.0                                    # blade starts under the guard; ~50 cm of steel at 0.92 cm per unit
blade = [sat(B0, -3.3), sat(B0 + Lb * 0.66, -2.9), sat(B0 + Lb * 0.92, -1.8), sat(B0 + Lb, 0), sat(B0 + Lb * 0.92, 1.8), sat(B0 + Lb * 0.66, 3.0), sat(B0, 3.4)]
blade_d = poly(blade)
b = [F("M100,120 H230 V230 H100 Z", C["steel"]),
     F(poly([sat(B0 - 2, -5), sat(B0 + Lb + 4, -5), sat(B0 + Lb + 4, -0.3), sat(B0 - 2, -0.3)]), C["steel_lt"]),
     F(poly([sat(B0 - 2, -0.3), sat(B0 + Lb + 4, -0.3), sat(B0 + Lb + 4, 5), sat(B0 - 2, 5)]), C["steel_dk"]),
     L([sat(B0 + 2, -0.2), sat(B0 + Lb * 0.88, -0.1)], 0.9, INK, 0.75), L([sat(B0 + 2, -2.5), sat(B0 + Lb * 0.8, -2.1)], 0.8, C["white"], 0.95)]
for tt in (B0 + 18, B0 + 29, B0 + 38):
    b.append(F(poly([sat(tt - 1.3, 3.7), sat(tt, 2.3), sat(tt + 1.3, 3.7)]), INK))
part("blade", blade_d, C["steel"], clipped="".join(b), outline=1.0, halo_w=3.4)
guard = poly([sat(3.4, -7.6), sat(5.6, -7.9), sat(6.1, -3.6), sat(6.1, 3.6), sat(5.6, 7.9), sat(3.4, 7.6), sat(3.0, 3.0), sat(3.0, -3.0)])
parts["guard"] = (f'<g id="guard">{F(guard, C["bone"])}{F(poly([sat(3.4, -7.6), sat(5.6, -7.9), sat(6.1, -3.6), sat(6.1, -0.2), sat(3.0, -0.2), sat(3.0, -3.0)]), C["bone_lt"])}'
                  f'{P(guard, "none", 1.0)}{L([sat(4.8, -6.4), sat(4.9, -3.8)], 0.7, C["white"], 0.8)}</g>')
halos["guard"] = f'<g id="halo-guard"><path d="{guard}" fill="{INK}" stroke="{INK}" stroke-width="{2 * 3.2}" stroke-linejoin="round"/></g>'
grip = poly([sat(-9.6, -2.2), sat(3.4, -2.3), sat(3.4, 2.3), sat(-9.6, 2.2)])
g = [F("M120,120 H190 V190 H120 Z", C["lea_dk"])] + [L([sat(tt, -2.6), sat(tt - 1.8, 2.6)], 0.8, C["lea_lt"], 0.8) for tt in (-8, -5, -2, 1)]
part("grip", grip, C["lea_dk"], clipped="".join(g), outline=0.95, halo_w=3.0)
pm = sat(-11.0, 0)
parts["pommel"] = (f'<g id="pommel"><circle cx="{f(pm[0])}" cy="{f(pm[1])}" r="3.0" fill="{C["brass"]}" stroke="{INK}" stroke-width="1"/>'
                   f'<path d="M{f(pm[0] - 1.6)},{f(pm[1] - 0.8)} Q{f(pm[0])},{f(pm[1] - 2.2)} {f(pm[0] + 1.3)},{f(pm[1] - 1.2)}" fill="none" stroke="{C["brass_lt"]}" stroke-width="0.9" stroke-linecap="round"/></g>')
halos["pommel"] = f'<g id="halo-pommel"><circle cx="{f(pm[0])}" cy="{f(pm[1])}" r="{3.0 + 3.0}" fill="{INK}"/></g>'

# the fist: back of the hand, four fingers stacked along the grip (index nearest the guard), a thumb laid over the knuckles
hand = smooth([sat(-7.0, -3.6), sat(-8.4, -0.4), sat(-7.7, 3.4), sat(-5.8, 5.0), sat(-3.2, 5.7), sat(-0.5, 6.0), sat(1.9, 5.5), sat(3.4, 3.5), sat(3.6, 0.0),
               sat(3.3, -3.0), (WR_N[0] - nfx * 4.0 + fdx * 0.5, WR_N[1] - nfy * 4.0 + fdy * 0.5), (WR_N[0] + nfx * 4.0 + fdx * 0.5, WR_N[1] + nfy * 4.0 + fdy * 0.5)])
bounds = [2.7, 0.125, -2.45, -5.03, -7.6]
hd = [F("M100,100 H200 V200 H100 Z", grad(C["lea_lt"], C["lea_dk"], sat(0, -4), sat(0, 6.5), mid=C["lea"]))]
for i in range(4):
    a_, b_ = bounds[i + 1], bounds[i]
    hd.append(F(poly([sat(a_, 0.9), sat(b_, 0.9), sat(b_, 8), sat(a_, 8)]), C["lea_dk"] if i % 2 else C["lea"], 0.5))
    hd.append(L([sat(a_ - 0.3, -0.7), sat((a_ + b_) / 2, -1.2), sat(b_ + 0.3, -0.7)], 0.9, C["lea_lt"], 0.9))              # knuckle
    hd.append(L([sat(a_ + 0.5, 3.8), sat((a_ + b_) / 2, 4.3), sat(b_ - 0.5, 3.8)], 0.7, INK, 0.55))                         # the bend of the finger
for d_ in bounds[1:4]:
    hd.append(L([sat(d_, 0.5), sat(d_ - 0.25, 6.8)], 0.9, INK, 0.95))
hd.append(F("M100,100 H200 V200 H100 Z", C["deep"], 0.10))
thumb = smooth([sat(-3.9, -2.7), sat(-1.0, -3.5), sat(2.2, -2.6), sat(3.5, -1.2), sat(2.2, 0.1), sat(-1.0, -0.6), sat(-3.6, -0.7)])
hd.append(F(thumb, grad(C["lea_lt"], C["lea"], sat(0, -3.5), sat(0, 0)), 1.0))
hd.append(P(thumb, "none", 0.9))
hd.append(L([sat(2.3, -2.6), sat(2.9, -1.3)], 0.6, INK, 0.6))                                                          # the nail
cuff = poly([(WR_N[0] + nfx * 4.9 - fdx * 3.2, WR_N[1] + nfy * 4.9 - fdy * 3.2), (WR_N[0] - nfx * 4.9 - fdx * 3.2, WR_N[1] - nfy * 4.9 - fdy * 3.2),
             (WR_N[0] - nfx * 4.7 + fdx * 1.8, WR_N[1] - nfy * 4.7 + fdy * 1.8), (WR_N[0] + nfx * 4.7 + fdx * 1.8, WR_N[1] + nfy * 4.7 + fdy * 1.8)])
cuff_g = (F(cuff, grad(C["lea_lt"], C["lea_dk"], (WR_N[0] + nfx * 5, WR_N[1]), (WR_N[0] - nfx * 5, WR_N[1]), mid=C["lea"])) + P(cuff, "none", 0.9)
          + f'<circle cx="{f(WR_N[0] - fdx * 0.6)}" cy="{f(WR_N[1] - fdy * 0.6)}" r="0.9" fill="{C["brass"]}"/>')
part("hand-r", hand, C["lea_dk"], clipped="".join(hd), extras=cuff_g, outline=1.0, halo_w=3.4)

ORDER = ["cloak-c", "cloak-b", "cloak-a", "upperarm-l", "forearm-l", "hand-l", "thigh-l", "shin-l", "foot-l", "tunic-back",
         "thigh-r", "shin-r", "foot-r", "tunic-front", "torso", "mantle", "head", "upperarm-r", "forearm-r", "pommel", "grip", "blade", "guard", "hand-r"]
HALO_ORDER = [k for k in ORDER if k in halos]


def build(out, grid=False):
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="1024" height="1024">',
           "<title>The Marked - human proportions, side profile (E)</title>", "<defs>" + "".join(defs) + "</defs>", '<g id="marked">']
    svg += [halos[k] for k in HALO_ORDER] + [parts[k] for k in ORDER] + ["</g>"]
    if grid:
        U = 25.0
        for i in range(0, 8):
            y = 47 + i * U
            svg.append(f'<line x1="40" y1="{y}" x2="216" y2="{y}" stroke="#ff3366" stroke-width="0.4" opacity="0.8"/><text x="42" y="{y - 1}" font-size="5" fill="#ff3366">{i}</text>')
    svg.append("</svg>")
    open(out, "w").write("\n".join(svg))


if __name__ == "__main__":
    build(sys.argv[1], "--grid" in sys.argv)
    print("wrote", sys.argv[1], len(parts), "parts")
