# The Marked: art pipeline

The player's frames are generated, not hand-painted per frame. One vector character, rigged as a skinned mesh,
is posed by a biomechanical gait engine and keyed poses.

| File | Role |
| --- | --- |
| `human.py` | The rest-pose vector art: a 7-head adult in side profile (head unit 25, sole at y=222, 256 cell). |
| `skinparts.py` | Regroups it into skinned objects (one continuous drawing per limb, cloak sheet, tunic panels) and rigid objects. |
| `rig_human.json` | Bone hierarchy and pivots (hip, knee, ankle, shoulder, elbow, cloak tiers). |
| `gait.py` | Walk and run: IK legs with heel-to-toe rolling at constant ground speed, ballistic flight, arms, cloth springs. |
| `poses.py` | Idle, attack, hit, death, dodge, pickup, ritual, low sanity, signal decode, as keyed poses. |
| `skin.py` | Per-frame skinning: angle-blended bends about knee, ankle, elbow, cloak; composites at 4x, downsamples to 256. |
| `export_marked.py` | Writes frames, sheets, GIFs, `*.animation.json` and the manifest entries. |

`build.sh` runs everything. Notes worth keeping:

* The engine moves the player at 4.5 px/frame, about four body-heights a second. That is a sprint, so `run` is what
  plays while moving; `walk` is the slow stalking cycle for future use. The run clip is 8 frames at 17 fps.
* `basic_attack` plays over 20 ticks, so it is 10 frames at 30 fps; the blade is live on frames 3-7 (see its
  `attack_hitboxes`). `dodge_step` plays over the 12-tick dash, so 6 frames at 30 fps.
* The Shape (the player's dark double) is no longer baked into the frames. `CanvasRenderer.drawShapeEcho` draws it at
  runtime, a few frames behind and further out of phase at low sanity. The Shape and Corpse Echo enemies reuse
  these frames.
