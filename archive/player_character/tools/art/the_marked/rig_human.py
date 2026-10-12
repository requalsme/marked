import json, sys
B = lambda i, par, pv, pp=(): dict(id=i, parent=par, pivot=list(pv), parts=[q for p in pp for q in (p, "halo-" + p)] )
bones = [
 {"id": "root", "pivot": [127, 222], "parts": []},
 B("pelvis", "root", (127, 132)),
 B("torso", "pelvis", (126, 126), ["torso", "mantle"]),
 B("head", "torso", (136, 74), ["head"]),
 B("cloak-a", "torso", (126, 86), ["cloak-a"]), B("cloak-b", "cloak-a", (123, 122), ["cloak-b"]), B("cloak-c", "cloak-b", (122, 156), ["cloak-c"]),
 B("tunic-back", "pelvis", (121, 121), ["tunic-back"]), B("tunic-front", "pelvis", (137, 122), ["tunic-front"]),
 B("upperarm-l", "torso", (133, 88), ["upperarm-l"]), B("forearm-l", "upperarm-l", (128, 124), ["forearm-l"]), B("hand-l", "forearm-l", (124, 149), ["hand-l"]),
 B("upperarm-r", "torso", (133, 88), ["upperarm-r"]), B("forearm-r", "upperarm-r", (134, 125), ["forearm-r"]),
 B("hand-r", "forearm-r", (143, 150), ["hand-r", "pommel", "grip", "blade", "guard"]),
 B("thigh-l", "pelvis", (127, 132), ["thigh-l"]), B("shin-l", "thigh-l", (127, 178), ["shin-l"]), B("foot-l", "shin-l", (127, 214), ["foot-l"]),
 B("thigh-r", "pelvis", (127, 132), ["thigh-r"]), B("shin-r", "thigh-r", (127, 178), ["shin-r"]), B("foot-r", "shin-r", (127, 214), ["foot-r"]),
]
json.dump({"character": "marked", "direction": "E", "source": "human.svg", "view_units": [256, 256], "template_scale": 1.0, "bones": bones}, open(sys.argv[1], "w"), indent=1)
