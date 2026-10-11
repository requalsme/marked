"""Textured-mesh skinning for The Marked.

Each skinned object (legs, arms, cloak, tunic panels) is ONE rest-pose texture. Per frame every output pixel is
traced back to the rest pose through a smooth angle-blended bend about the joints (the knee crease pinches inside
and rounds outside, the cloak curves along its length). Rigid objects (torso, head, hands, sword) use a single
bone matrix. Everything is rendered at 4x and downsampled to the 256 cell.

usage: skin.py CLIP.json TEXDIR OUTDIR [--rest]
"""
import json
import math
import os
import sys

import cv2
import numpy as np

SC = 4
W = 256 * SC
SKIN_OBJECTS = {"leg-l", "leg-r", "arm-l", "arm-r", "cloak", "tunic-back", "tunic-front"}
ORDER = ["cloak", "arm-l", "hand-l", "leg-l", "tunic-back", "leg-r", "tunic-front", "torso", "mantle", "head", "arm-r", "sword"]


def mat(tx=0.0, ty=0.0, deg=0.0):
    t = math.radians(deg)
    c, s = math.cos(t), math.sin(t)
    return np.array([[c, -s, tx], [s, c, ty], [0, 0, 1.0]])


def about(pivot, deg, tx=0.0, ty=0.0):
    return mat(pivot[0] + tx, pivot[1] + ty) @ mat(0, 0, deg) @ mat(-pivot[0], -pivot[1])


def rot_about(px, py, pivot, deg):
    t = np.radians(deg)
    c, s = np.cos(t), np.sin(t)
    dx, dy = px - pivot[0], py - pivot[1]
    return pivot[0] + dx * c - dy * s, pivot[1] + dx * s + dy * c


def smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3 - 2 * x)


class Rig:
    def __init__(self, rig_path, clip):
        self.bones = {b["id"]: b for b in json.load(open(rig_path))["bones"]}
        self.clip = clip
        self.N = clip["frames"]

    def chan(self, bone, kind, i):
        ch = self.clip["channels"].get(bone, {}).get(kind)
        if not ch:
            return None
        return ch["keys"][i % self.N][1]

    def world(self, i):
        out = {}

        def walk(bid):
            if bid in out:
                return out[bid]
            b = self.bones[bid]
            par = walk(b["parent"]) if b.get("parent") else np.eye(3)
            tr = self.chan(bid, "translate", i) or [0.0, 0.0]
            th = self.chan(bid, "rotate", i) or 0.0
            out[bid] = par @ about(b["pivot"], th, tr[0], tr[1])
            return out[bid]
        for bid in self.bones:
            walk(bid)
        return out

    def rot(self, bone, i):
        return self.chan(bone, "rotate", i) or 0.0


def load_tex(path):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im is None:
        raise FileNotFoundError(path)
    im = im.astype(np.float32) / 255.0
    rgb, a = im[..., :3], im[..., 3:4]
    return np.concatenate([rgb[..., ::-1] * a, a], axis=2)          # premultiplied RGBA (RGB order)


# ── deformation definitions (forward and inverse), in 256-unit space ──────────────────────────────────
class Deform:
    """F maps rest -> posed. inverse() traces posed pixels back to rest by fixed-point iteration."""

    def __init__(self, kind, M0, joints, ang, zones, axes=None):
        self.kind, self.M0, self.joints, self.ang, self.zones, self.axes = kind, M0, joints, ang, zones, axes
        self.M0inv = np.linalg.inv(M0)

    def weights(self, px, py):
        w = []
        for j, z, ax in zip(self.joints, self.zones, self.axes):
            if self.kind == "ramp":
                w.append(smoothstep((py - z[0]) / (z[1] - z[0])))
            elif ax is None:
                yc, hz = z
                w.append(smoothstep((py - (yc - hz)) / (2 * hz)))
            else:
                d = (px - j[0]) * ax[0] + (py - j[1]) * ax[1]
                w.append(smoothstep((d + z) / (2 * z)))
        return w

    def forward(self, px, py):
        w = self.weights(px, py)
        x, y = px, py
        for j, a, s in reversed(list(zip(self.joints, self.ang, w))):     # innermost (last joint) rotation first
            x, y = rot_about(x, y, j, a * s)
        M = self.M0
        return M[0, 0] * x + M[0, 1] * y + M[0, 2], M[1, 0] * x + M[1, 1] * y + M[1, 2]

    def inverse(self, qx, qy, iters=7):
        M = self.M0inv
        x0 = M[0, 0] * qx + M[0, 1] * qy + M[0, 2]
        y0 = M[1, 0] * qx + M[1, 1] * qy + M[1, 2]
        px, py = x0, y0
        for _ in range(iters):
            w = self.weights(px, py)
            x, y = x0, y0
            for j, a, s in zip(self.joints, self.ang, w):                  # undo the first joint's bend, then the next
                x, y = rot_about(x, y, j, -a * s)
            px, py = x, y
        return px, py


def make_deform(name, R, i, world):
    r = R.rot
    if name in ("leg-l", "leg-r"):
        s = name[-1]
        return Deform("axis", world["thigh-" + s], [(127.0, 178.0), (127.0, 214.0)], [r("shin-" + s, i), r("foot-" + s, i)],
                      [(178.0, 11.0), (210.0, 5.0)], axes=[None, None])
    if name in ("arm-l", "arm-r"):
        s = name[-1]
        sh, el, wr = (133.0, 88.0), ((134.0, 125.0) if s == "r" else (128.0, 124.0)), ((143.0, 150.0) if s == "r" else (124.0, 149.0))
        u1 = np.array([el[0] - sh[0], el[1] - sh[1]]); u1 /= np.linalg.norm(u1)
        u2 = np.array([wr[0] - el[0], wr[1] - el[1]]); u2 /= np.linalg.norm(u2)
        ax = u1 + u2; ax /= np.linalg.norm(ax)
        return Deform("axis", world["upperarm-" + s], [el], [r("forearm-" + s, i)], [8.0], axes=[tuple(ax)])
    if name == "cloak":
        return Deform("axis", world["cloak-a"], [(123.0, 122.0), (122.0, 156.0)], [r("cloak-b", i), r("cloak-c", i)],
                      [(122.0, 12.0), (156.0, 12.0)], axes=[None, None])
    if name == "tunic-back":
        return Deform("ramp", world["pelvis"], [(121.0, 121.0)], [r("tunic-back", i)], [(121.0, 170.0)], axes=[None])
    if name == "tunic-front":
        return Deform("ramp", world["pelvis"], [(137.0, 122.0)], [r("tunic-front", i)], [(122.0, 172.0)], axes=[None])
    raise KeyError(name)


def rigid_matrix(name, world):
    return world[{"torso": "torso", "mantle": "torso", "head": "head", "hand-l": "hand-l", "sword": "hand-r"}[name]]


def build_map(deform, alpha):
    """Forward-scatter every rest pixel to its posed position (2x subsampled), fill the gaps, return the
    remap arrays (posed pixel -> rest texture pixel) over the posed bounding box."""
    ys, xs = np.where(alpha > 0.01)
    if len(xs) == 0:
        return None
    rx0, rx1, ry0, ry1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    gx, gy = np.meshgrid(np.arange(rx0, rx1, 0.5), np.arange(ry0, ry1, 0.5))
    ix, iy = np.clip(gx.astype(np.int32), 0, W - 1), np.clip(gy.astype(np.int32), 0, W - 1)
    keep = alpha[iy, ix] > 0.01
    sx, sy = gx[keep], gy[keep]
    qx, qy = deform.forward(sx / SC, sy / SC)
    qx, qy = qx * SC, qy * SC
    x0, y0 = int(np.floor(qx.min())) - 6, int(np.floor(qy.min())) - 6
    x1, y1 = int(np.ceil(qx.max())) + 7, int(np.ceil(qy.max())) + 7
    x0c, y0c, x1c, y1c = max(0, x0), max(0, y0), min(W, x1), min(W, y1)
    if x1c <= x0c or y1c <= y0c:
        return None
    hh, ww = y1c - y0c, x1c - x0c
    mapx = np.zeros((hh, ww), np.float32)
    mapy = np.zeros((hh, ww), np.float32)
    valid = np.zeros((hh, ww), np.float32)
    order = np.argsort(sy, kind="stable")                            # lower rest rows are written last (shin over thigh)
    cx = np.round(qx[order]).astype(np.int32) - x0c
    cy = np.round(qy[order]).astype(np.int32) - y0c
    ok = (cx >= 0) & (cx < ww) & (cy >= 0) & (cy < hh)
    cx, cy = cx[ok], cy[ok]
    mapx[cy, cx] = sx[order][ok]
    mapy[cy, cx] = sy[order][ok]
    valid[cy, cx] = 1.0
    # fill holes and grow the valid area so the texture's own antialiased edge decides the silhouette
    for it in range(5):
        k = (3, 3) if it < 3 else (5, 5)
        vb = cv2.blur(valid, k)
        mx = cv2.blur(mapx * valid, k)
        my = cv2.blur(mapy * valid, k)
        fill = (valid < 0.5) & (vb > 0.05)
        mapx[fill] = (mx / np.maximum(vb, 1e-6))[fill]
        mapy[fill] = (my / np.maximum(vb, 1e-6))[fill]
        valid[fill] = 1.0
    # Newton refinement on the exact forward function: extrapolates the border correctly and removes rounding noise
    qxu = (np.arange(x0c, x1c)[None, :] + 0.5) / SC + np.zeros((hh, 1))
    qyu = (np.arange(y0c, y1c)[:, None] + 0.5) / SC + np.zeros((1, ww))
    px, py = (mapx + 0.5) / SC, (mapy + 0.5) / SC
    px, py = px.astype(np.float64), py.astype(np.float64)
    e = 0.05
    for _ in range(4):
        fx0, fy0 = deform.forward(px, py)
        fxa, fya = deform.forward(px + e, py)
        fxb, fyb = deform.forward(px, py + e)
        j00, j10 = (fxa - fx0) / e, (fya - fy0) / e
        j01, j11 = (fxb - fx0) / e, (fyb - fy0) / e
        rx, ry = qxu - fx0, qyu - fy0
        det = j00 * j11 - j01 * j10
        det = np.where(np.abs(det) < 1e-3, 1e-3, det)
        dx = (j11 * rx - j01 * ry) / det
        dy = (-j10 * rx + j00 * ry) / det
        step = np.hypot(dx, dy)
        sc_ = np.where(step > 2.5, 2.5 / np.maximum(step, 1e-9), 1.0)
        px, py = px + dx * sc_, py + dy * sc_
    mapx = (px * SC - 0.5).astype(np.float32)
    mapy = (py * SC - 0.5).astype(np.float32)
    mapx[valid < 0.5] = -1000.0
    mapy[valid < 0.5] = -1000.0
    return (x0c, y0c, x1c, y1c), mapx, mapy


def over(dst, src):
    return src + dst * (1.0 - src[..., 3:4])


def frame(R, i, textures, rest=False):
    world = R.world(i)
    order = list(ORDER)
    if R.clip.get("far_arm_front"):
        order = [n for n in order if n not in ("arm-l", "hand-l")]
        k = order.index("arm-r")
        order[k:k] = ["arm-l", "hand-l"]
    canvas = np.zeros((W, W, 4), np.float32)
    mapped = {}
    for name in order:
        halo, col = textures[name]
        if name in SKIN_OBJECTS:
            D = make_deform(name, R, i, world)
            bm = build_map(D, halo[..., 3])
            mapped[name] = ("skin", bm[0], bm[1], bm[2]) if bm else ("none",)
        else:
            M = rigid_matrix(name, world)
            S = np.diag([SC, SC, 1.0])
            mapped[name] = ("rigid", (S @ M @ np.linalg.inv(S))[:2])

    def render(name, tex):
        kind = mapped[name]
        if kind[0] == "none":
            return np.zeros((W, W, 4), np.float32)
        if kind[0] == "skin":
            _, (x0, y0, x1, y1), mx, my = kind
            out = np.zeros((W, W, 4), np.float32)
            out[y0:y1, x0:x1] = cv2.remap(tex, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
            return out
        return cv2.warpAffine(tex, kind[1], (W, W), flags=cv2.INTER_LINEAR | cv2.WARP_INVERSE_MAP * 0, borderMode=cv2.BORDER_CONSTANT)

    for name in order:
        canvas = over(canvas, render(name, textures[name][0]))
    for name in order:
        canvas = over(canvas, render(name, textures[name][1]))
    # --- effects drawn on the posed figure (screen-space, 4x) ---
    fxs = R.clip.get("fx")
    if fxs and fxs[i % len(fxs)].get("sigil"):
        fxd = fxs[i % len(fxs)]
        pr = world["hand-r"] @ np.array([148.0, 152.0, 1.0])
        pl = world["hand-l"] @ np.array([125.0, 152.0, 1.0])
        cx, cy = (pr[0] + pl[0]) / 2 + 2, (pr[1] + pl[1]) / 2 - 14
        canvas = draw_sigil(canvas, cx * SC, cy * SC, fxd["sigil"], fxd.get("spin", 0.0))
    # --- placement: the global foot anchor offset, and ground lock for falls ---
    GL = (225.5 + 4.0) * SC
    locks = R.clip.get("ground_lock")
    dyp = 4.0 * SC
    if locks and locks[i % len(locks)]:
        rows = np.where(canvas[..., 3].max(axis=1) > 0.5)[0]
        if len(rows):
            dyp = GL - (rows.max() + 1)
    canvas = cv2.warpAffine(canvas, np.float32([[1, 0, 0], [0, 1, dyp]]), (W, W), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    if os.environ.get("HIRES"):
        a_ = canvas[..., 3:4]
        hi = np.concatenate([np.where(a_ > 1e-4, canvas[..., :3] / np.maximum(a_, 1e-4), 0)[..., ::-1], a_], axis=2)
        cv2.imwrite(os.environ["HIRES"] + f"_{i:02d}.png", (np.clip(hi, 0, 1) * 255 + 0.5).astype(np.uint8))
    small = cv2.resize(canvas, (256, 256), interpolation=cv2.INTER_AREA)
    a = small[..., 3:4]
    rgb = np.where(a > 1e-4, small[..., :3] / np.maximum(a, 1e-4), 0)
    out = np.concatenate([rgb[..., ::-1], a], axis=2)                       # to BGRA for cv2.imwrite
    return (np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8)


def draw_sigil(canvas, cx, cy, strength, spin):
    """A blood sigil: two rings, six runes and a cross, with a soft red glow (additive)."""
    mask = np.zeros((W, W), np.float32)
    r = 15.0 * SC
    th = max(2, int(0.9 * SC))
    cv2.circle(mask, (int(cx), int(cy)), int(r), 1.0, th, cv2.LINE_AA)
    cv2.circle(mask, (int(cx), int(cy)), int(r * 0.62), 1.0, max(1, th - 1), cv2.LINE_AA)
    for k in range(6):
        a = math.radians(spin + 60 * k)
        p0 = (cx + math.cos(a) * r * 0.62, cy + math.sin(a) * r * 0.62)
        p1 = (cx + math.cos(a) * r * 1.0, cy + math.sin(a) * r * 1.0)
        cv2.line(mask, (int(p0[0]), int(p0[1])), (int(p1[0]), int(p1[1])), 1.0, max(1, th - 1), cv2.LINE_AA)
        q = (cx + math.cos(a + 0.5) * r * 1.22, cy + math.sin(a + 0.5) * r * 1.22)
        cv2.circle(mask, (int(q[0]), int(q[1])), max(1, int(0.9 * SC)), 1.0, -1, cv2.LINE_AA)
    cv2.line(mask, (int(cx - r * 0.3), int(cy)), (int(cx + r * 0.3), int(cy)), 1.0, th, cv2.LINE_AA)
    cv2.line(mask, (int(cx), int(cy - r * 0.3)), (int(cx), int(cy + r * 0.3)), 1.0, th, cv2.LINE_AA)
    glow = cv2.GaussianBlur(mask, (0, 0), 4.5 * SC / 2) * 1.6
    a_ = np.clip(mask + 0.7 * glow, 0, 1) * strength
    col = np.array([0.30, 0.28, 0.80], np.float32)               # BGR-ordered? canvas is premult RGB: set below
    rgb = np.stack([0.84 * a_, 0.26 * a_, 0.22 * a_], axis=2)
    core = np.stack([mask * 0.95 * strength] * 3, axis=2) * np.array([1.0, 0.7, 0.62], np.float32)
    out = canvas.copy()
    out[..., :3] = np.clip(out[..., :3] * (1 - a_[..., None] * 0.3) + rgb + core * 0.4, 0, 1)
    out[..., 3] = np.maximum(out[..., 3], np.clip(a_ * 1.3, 0, 1))
    return out


def render_textures(texdir):
    sys.path.insert(0, os.path.join(os.environ.get("VEKTRA", ""), "scripts"))
    from _cvlib import render_svg
    for fn in sorted(os.listdir(texdir)):
        if fn.endswith(".svg") and not os.path.exists(os.path.join(texdir, fn[:-4] + ".png")):
            render_svg(os.path.join(texdir, fn), os.path.join(texdir, fn[:-4] + ".png"), W, W)


if __name__ == "__main__":
    clip = json.load(open(sys.argv[1]))
    texdir, outdir = sys.argv[2], sys.argv[3]
    os.makedirs(outdir, exist_ok=True)
    render_textures(texdir)
    textures = {n: (load_tex(os.path.join(texdir, n + ".halo.png")), load_tex(os.path.join(texdir, n + ".png"))) for n in ORDER}
    R = Rig(os.path.join(os.path.dirname(os.path.abspath(__file__)), "rig_human.json"), clip)
    if "--rest" in sys.argv:
        clip = {"frames": 1, "channels": {}}
        R = Rig(os.path.join(os.path.dirname(os.path.abspath(__file__)), "rig_human.json"), clip)
    for i in range(R.N):
        img = frame(R, i, textures)
        cv2.imwrite(os.path.join(outdir, f"marked_{clip.get('clip', 'rest')}_{i:02d}.png"), img)
        print("frame", i, end=" ", flush=True)
    print()
