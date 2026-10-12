"""Install the skinned-rig frames into the game's asset tree.

For every animation: per-frame PNGs, a horizontal sheet, a preview GIF, the .animation.json, and the entry in
assets/pack_manifest.json. Adds the_marked.run. usage: export_marked.py ANIM_DIR REPO_ROOT
"""
import copy
import glob
import json
import os
import shutil
import sys

from PIL import Image

anim_dir, repo = sys.argv[1], sys.argv[2]
OUT = os.path.join(repo, "assets/characters/player/the_marked")
REL = "characters/player/the_marked"

# game animation -> (clip folder, fps override or None)
MAP = {
    "idle": ("idle", None), "walk": ("walk", None), "run": ("run", None), "basic_attack": ("basic_attack", 30),
    "hit_react": ("hit_react", None), "death_collapse": ("death_collapse", None), "dodge_step": ("dodge_step", 30),
    "interact_pickup": ("interact_pickup", None), "ritual_channel": ("ritual_channel", None),
    "low_sanity": ("low_sanity", None), "signal_decode": ("signal_decode", None),
}
FPS = {"idle": 9, "walk": 12, "run": 17, "basic_attack": 30, "hit_react": 14, "death_collapse": 9, "dodge_step": 30,
       "interact_pickup": 11, "ritual_channel": 10, "low_sanity": 13, "signal_decode": 10}
LOOP = {"idle": True, "walk": True, "run": True, "low_sanity": True, "ritual_channel": True, "signal_decode": True}
USAGE_RUN = "Fast floor-plane movement (the engine's 4.5 px/frame is a sprint) with left/right sprite flipping."

manifest_path = os.path.join(repo, "assets/pack_manifest.json")
manifest = json.load(open(manifest_path))
entries = {a["id"]: a for a in manifest["content"]["animations"]}

for anim, (clip, _) in MAP.items():
    frames = sorted(glob.glob(os.path.join(anim_dir, clip, f"marked_{clip}_*.png")))
    n = len(frames)
    folder = os.path.join(OUT, anim)
    if os.path.isdir(folder):
        shutil.rmtree(folder)
    os.makedirs(folder)
    imgs = []
    rels = []
    for i, f in enumerate(frames):
        im = Image.open(f).convert("RGBA")
        assert im.size == (256, 256), (f, im.size)
        name = f"the_marked_{anim}_{i:02d}.png"
        im.save(os.path.join(folder, name), optimize=True)
        imgs.append(im)
        rels.append(f"{REL}/{anim}/{name}")
    sheet = Image.new("RGBA", (256 * n, 256), (0, 0, 0, 0))
    for i, im in enumerate(imgs):
        sheet.paste(im, (256 * i, 0))
    sheet.save(os.path.join(OUT, f"the_marked_{anim}_sheet.png"), optimize=True)
    # preview GIF on a dark floor
    fr = []
    for im in imgs:
        bg = Image.new("RGBA", (256, 256), (36, 32, 30, 255))
        bg.alpha_composite(im)
        fr.append(bg.convert("P", palette=Image.ADAPTIVE))
    fps = FPS[anim]
    fr[0].save(os.path.join(OUT, f"the_marked_{anim}.gif"), save_all=True, append_images=fr[1:], duration=int(1000 / min(fps, 25)), loop=0, disposal=2)

    jpath = os.path.join(OUT, f"the_marked_{anim}.animation.json")
    if os.path.exists(jpath):
        data = json.load(open(jpath))
    else:                                                       # the new run animation starts from the walk entry
        data = copy.deepcopy(json.load(open(os.path.join(OUT, "the_marked_walk.animation.json"))))
        data["id"], data["animation"], data["usage"] = f"the_marked.{anim}", anim, USAGE_RUN
    data["frame_count"], data["fps"], data["loop"] = n, fps, LOOP.get(anim, False)
    data["frames"] = rels
    data["sheet"] = f"{REL}/the_marked_{anim}_sheet.png"
    data["gif"] = f"{REL}/the_marked_{anim}.gif"
    json.dump(data, open(jpath, "w"), indent=2)
    entries[data["id"]] = data
    print(f"{anim:16s} {n:2d} frames @ {fps} fps  loop={data['loop']}")

# manifest: replace/append the animation entries, register the run animation on the asset
anims = [a for a in manifest["content"]["animations"] if a["id"] not in entries or not a["id"].startswith("the_marked.")]
seen = {a["id"] for a in anims}
order = [a["id"] for a in manifest["content"]["animations"] if a["id"].startswith("the_marked.")]
if "the_marked.run" not in order:
    order.insert(order.index("the_marked.walk") + 1, "the_marked.run")
first = next(i for i, a in enumerate(manifest["content"]["animations"]) if a["id"].startswith("the_marked."))
new = [entries[i] for i in order]
manifest["content"]["animations"] = anims[:first] + new + anims[first:]
for asset in manifest["content"]["assets"]:
    if asset["id"] == "the_marked" and "the_marked.run" not in asset["animations"]:
        asset["animations"].insert(asset["animations"].index("the_marked.walk") + 1, "the_marked.run")
json.dump(manifest, open(manifest_path, "w"), indent=2)
apath = os.path.join(OUT, "the_marked.asset.json")
a = json.load(open(apath))
if "the_marked.run" not in a["animations"]:
    a["animations"].insert(a["animations"].index("the_marked.walk") + 1, "the_marked.run")
    json.dump(a, open(apath, "w"), indent=2)
# the key art follows the idle pose
Image.open(os.path.join(anim_dir, "idle", "marked_idle_00.png")).convert("RGBA").save(os.path.join(OUT, "the_marked_base.png"), optimize=True)
print("manifest + assets updated")
