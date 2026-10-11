"""Rest-pose artwork for the skinned rig: every limb is ONE continuous drawing (no joint seams); the cloak and
tunic panels are single sheets. Each object has a halo (ink silhouette) layer and a colour layer so the halos
can all sit beneath the figure. Run: skinparts.py OUTDIR  -> writes <name>.svg (colour) and <name>.halo.svg."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import human as H  # noqa: E402  (builds the rest-pose art as a side effect)
from human import (C, F, L, P, INK, clip, f, grad, hatch, parts, halos, part, poly, smooth, taper, wraps, ragged,
                   H_, K_, A_, SH, EL_N, WR_N, EL_F, WR_F)  # noqa: E402


def tube(spine, stations, caps=True):
    """Outline of a limb around a polyline spine. stations: (t, front_w, back_w) with t = arclength fraction.
    +n side is 'back' (image-left for a downward limb); front is image-right. Miter normals at the joints."""
    seg = [math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(spine, spine[1:])]
    total = sum(seg)
    cum = [0.0]
    for s_ in seg:
        cum.append(cum[-1] + s_)

    def at_len(d):
        for i in range(len(seg)):
            if d <= cum[i + 1] + 1e-9:
                u = (d - cum[i]) / seg[i]
                a, b = spine[i], spine[i + 1]
                return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u), i
        return spine[-1], len(seg) - 1

    def normal_at(d):
        pt, i = at_len(d)
        dirs = []
        for j in (i - 1, i, i + 1):
            if 0 <= j < len(seg):
                dirs.append(((spine[j + 1][0] - spine[j][0]) / seg[j], (spine[j + 1][1] - spine[j][1]) / seg[j], j))
        # blend toward the neighbour segment near a joint so the outline turns smoothly
        ux, uy, _ = next(d_ for d_ in dirs if d_[2] == i)
        for d_ in dirs:
            if d_[2] != i:
                jd = cum[max(i, d_[2])]
                w = max(0.0, 1.0 - abs(d - jd) / 7.0) * 0.5
                ux, uy = ux * (1 - w) + d_[0] * w, uy * (1 - w) + d_[1] * w
        m = math.hypot(ux, uy)
        return pt, (ux / m, uy / m)

    front, back = [], []
    for t, wf, wb in stations:
        pt, (ux, uy) = normal_at(t * total)
        nx, ny = -uy, ux
        front.append((pt[0] - nx * wf, pt[1] - ny * wf))
        back.append((pt[0] + nx * wb, pt[1] + ny * wb))
    cap_b, cap_a = [], []
    if caps:
        (fb, bb) = front[-1], back[-1]
        _, (ux, uy) = normal_at(total)
        cb = ((fb[0] + bb[0]) / 2, (fb[1] + bb[1]) / 2)
        rb = math.hypot(fb[0] - bb[0], fb[1] - bb[1]) / 2
        for k in range(1, 6):
            ph = math.pi * k / 6
            cap_b.append((cb[0] + (fb[0] - cb[0]) * math.cos(ph) + ux * rb * math.sin(ph), cb[1] + (fb[1] - cb[1]) * math.cos(ph) + uy * rb * math.sin(ph)))
        (fa, ba) = front[0], back[0]
        _, (ux, uy) = normal_at(0.0)
        ca = ((fa[0] + ba[0]) / 2, (fa[1] + ba[1]) / 2)
        ra = math.hypot(fa[0] - ba[0], fa[1] - ba[1]) / 2
        for k in range(1, 6):
            ph = math.pi * k / 6
            cap_a.append((ca[0] + (ba[0] - ca[0]) * math.cos(ph) - ux * ra * math.sin(ph), ca[1] + (ba[1] - ca[1]) * math.cos(ph) - uy * ra * math.sin(ph)))
    return smooth(front + cap_b + list(reversed(back)) + cap_a)


objects = {}   # name -> (halo_svg, colour_svg)


def register(name, ids):
    objects[name] = ("".join(halos[i] for i in ids if i in halos), "".join(parts[i] for i in ids))


def dim(col, k=0.72):
    return "#%02x%02x%02x" % tuple(int(int(col[i:i + 2], 16) * k) for i in (1, 3, 5))


# ═══ legs: one continuous drawing from hip to boot ═══════════════════════════════════════════════════
LEG_ST = [(0, 11.5, 10.5), (0.157, 13.5, 12.5), (0.348, 11.0, 9.5), (0.561, 8.3, 8.0), (0.649, 7.6, 10.6), (0.737, 7.0, 10.0), (0.868, 6.0, 7.2), (1.0, 5.4, 5.4)]


def build_leg(sfx, far):
    d = (lambda c: dim(c)) if far else (lambda c: c)
    leg_d = tube([H_, A_], LEG_ST)
    t = [F("M95,120 H160 V232 H95 Z", grad(d(C["cloth_lt"]), d(C["cloth_dk"]), (140, 140), (116, 176), mid=d(C["cloth"])))]
    t.append(F(taper((120, 134), (121, 176), 5, 2, 0.5), d(C["cloth_lt"]), 0.6))                       # hamstring/glute, lit from the back-left
    t.append(F(poly([(133, 134), (143, 134), (140, 178), (131, 178)]), d(C["deep"]), 0.45))             # the quad's shadow side
    t.append(F("M95,178 H160 V232 H95 Z", d(C["bone"])))                                                  # the shin is wrapped in bone-coloured linen
    t.append(wraps(H_, A_, 0.31, 0.89, 16, 11 + (5 if far else 0),
                   [d(C["bone"]), d(C["bone_lt"]), d(C["bone"]), d(C["white"]) if not far else d(C["bone_lt"]), d(C["bone_dk"])]))
    t.append(F(taper((120.5, 184), (121.5, 208), 4.5, 1.5, 0.3), d(C["bone_lt"]), 0.55))                # calf highlight
    t.append(F(poly([(131, 180), (140, 180), (138, 214), (130, 214)]), d(C["deep"]), 0.4))               # front of the shin turns from the key
    t.append(f'<path d="M{f(116)},{f(178.4)} Q{f(127)},{f(180.4)} {f(138)},{f(177.6)}" fill="none" stroke="{d(C["lea_dk"])}" stroke-width="1.8" stroke-linecap="round"/>')  # knee strap
    part("leg-" + sfx, leg_d, d(C["cloth"]), clipped="".join(t), outline=1.0)
    # the boot: shaft + foot, in the same drawing; the ankle blend zone lets it flex
    ax, ay = A_
    bt = smooth([(ax - 7, 203), (ax + 7, 203), (ax + 8, 209), (ax + 13, 213), (ax + 21, 215), (ax + 24.5, 218.5), (ax + 23.5, 221.8), (ax - 9, 221.8), (ax - 9.5, 214), (ax - 8, 208)])
    b = [F(f"M{ax - 14},{200} H{ax + 30} V224 H{ax - 14} Z", d(C["deep"])),
         F(smooth([(ax - 6, 204.5), (ax + 6.5, 204.5), (ax + 8, 209.5), (ax + 14, 213.5), (ax + 21, 215.4), (ax + 5, 215.4), (ax - 6, 213)]), d(C["cloak_md"]), 0.9),
         F(smooth([(ax + 8, 210.5), (ax + 15, 213), (ax + 23, 215.3), (ax + 13, 214.7)]), d(C["cloak_lt"]), 0.95),
         F(f"M{ax - 14},{218.2} H{ax + 30} V224 H{ax - 14} Z", INK),
         F(poly([(ax - 9.5, 214), (ax - 3, 214), (ax - 3, 218.4), (ax - 9.5, 218.4)]), d(C["lea_dk"])),
         L([(ax - 7, 205.2), (ax + 7, 205.2)], 1.0, INK, 0.95),
         L([(ax - 7, 208.6), (ax + 8, 209.4)], 1.9, d(C["lea"]), 0.95)]
    b.append(f'<rect x="{f(ax + 1)}" y="{f(207.4)}" width="3.2" height="3.2" fill="none" stroke="{d(C["brass"])}" stroke-width="0.9"/>')
    part("boot-" + sfx, bt, d(C["deep"]), clipped="".join(b), outline=1.0)
    register("leg-" + sfx, ["leg-" + sfx, "boot-" + sfx])


build_leg("l", True)
build_leg("r", False)

# ═══ arms: sleeve, elbow cuff and wrapped forearm in one drawing ════════════════════════════════
def build_arm(sfx, el, wr, far):
    d = (lambda c: dim(c)) if far else (lambda c: c)
    lu = math.hypot(el[0] - SH[0], el[1] - SH[1])
    lf = math.hypot(wr[0] - el[0], wr[1] - el[1])
    tot = lu + lf
    k = lu / tot
    st = [(0, 6.6, 6.6), (0.3 * k, 7.6, 7.2), (0.7 * k, 6.0, 6.0), (k, 5.4, 5.4), (k + 0.25 * (1 - k), 6.4, 6.0), (k + 0.7 * (1 - k), 4.8, 4.8), (1.0, 4.0, 4.0)]
    arm_d = tube([SH, el, wr], st)
    ux, uy = (el[0] - SH[0]) / lu, (el[1] - SH[1]) / lu
    t = [F("M90,70 H170 V170 H90 Z", grad(d(C["cloak_md"]), d(C["cloak_dk"]), (130, 90), (140, 124), mid=d(C["cloak_dk"] if far else C["cloth"])))]
    t.append(F(taper((SH[0] - 3, SH[1] + 5), (el[0] - 3, el[1] - 4), 3.4, 1, 0.3), d(C["cloak_lt"]), 0.85))
    if not far:
        for y in range(98, 122, 6):
            t.append(P(f"M126,{y} Q134,{y + 2} 142,{y}", "none", 0.7, INK, 0.35))
    # forearm: bone wraps below the elbow (and a leather bracer on the near arm)
    cut = [(el[0] - 20, el[1] - 1.5), (el[0] + 20, el[1] - 1.5), (wr[0] + 24, wr[1] + 8), (wr[0] - 24, wr[1] + 8)]
    t.append(F(poly(cut), d(C["bone"] if not far else C["bone_dk"])))
    t.append(wraps(el, wr, 0.0, 0.62 if not far else 0.95, 8, 6 if not far else 4, [d(C["bone"]), d(C["bone_lt"]), d(C["bone"]), d(C["bone_dk"])]))
    t.append(L([(el[0] - 8, el[1] - 1.2), (el[0] + 8, el[1] - 1.2)], 1.6, d(C["lea_dk"]), 0.95))              # the elbow cuff
    if not far:
        fx, fy = (wr[0] - el[0]) / lf, (wr[1] - el[1]) / lf
        nx, ny = -fy, fx
        m = (el[0] + fx * 0.55 * lf, el[1] + fy * 0.55 * lf)
        brc = [(m[0] + nx * 9, m[1] + ny * 9), (m[0] - nx * 9, m[1] - ny * 9), (wr[0] - nx * 9, wr[1] - ny * 9), (wr[0] + nx * 9, wr[1] + ny * 9)]
        t.append(F(poly(brc), grad(C["lea_lt"], C["lea_dk"], (el[0] + nx * 6, el[1]), (el[0] - nx * 6, el[1]), mid=C["lea"])))
        t.append(P(poly(brc), "none", 0.9))
        t.append(L([(m[0] + nx * 9 + fx * 4, m[1] + ny * 9 + fy * 4), (m[0] - nx * 9 + fx * 4, m[1] - ny * 9 + fy * 4)], 0.9, INK, 0.9))
    extras = ""
    if not far:
        extras = (P(smooth([(129, 83), (138, 83.6), (140.6, 90), (137, 96), (130.6, 94.6), (128, 89)]), grad(C["lea_lt"], C["lea_dk"], (130, 83), (140, 98), mid=C["lea"]), 1.0)
                  + P("M131,89 Q134.6,91.4 139,90.4", "none", 0.8, INK, 0.7) + f'<circle cx="136.4" cy="86.8" r="1.0" fill="{C["brass"]}"/>')
    part("arm-" + sfx, arm_d, d(C["cloak"]), clipped="".join(t), outline=1.0, extras=extras)
    register("arm-" + sfx, ["arm-" + sfx])


build_arm("l", EL_F, WR_F, True)
build_arm("r", EL_N, WR_N, False)

# ═══ the cloak: the three tiers are one sheet; the tunic panels are their own sheets ══════════════
register("cloak", ["cloak-c", "cloak-b", "cloak-a"])
register("tunic-back", ["tunic-back"])
register("tunic-front", ["tunic-front"])
# rigid objects
register("torso", ["torso"])
register("mantle", ["mantle"])
register("head", ["head"])
register("hand-l", ["hand-l"])
register("sword", ["pommel", "grip", "blade", "guard", "hand-r"])

ORDER = ["cloak", "arm-l", "hand-l", "leg-l", "tunic-back", "leg-r", "tunic-front", "torso", "mantle", "head", "arm-r", "sword"]


def write_all(outdir):
    os.makedirs(outdir, exist_ok=True)
    head = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="1024" height="1024"><defs>' + "".join(H.defs) + "</defs>"
    for name, (halo_svg, col_svg) in objects.items():
        open(os.path.join(outdir, f"{name}.svg"), "w").write(head + col_svg + "</svg>")
        open(os.path.join(outdir, f"{name}.halo.svg"), "w").write(head + halo_svg + "</svg>")
    return list(objects)


if __name__ == "__main__":
    names = write_all(sys.argv[1])
    print("objects:", names)
