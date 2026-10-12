# The Marked: art pipeline

The player's frames are generated, not hand-painted per frame. One vector character, rigged as a skinned mesh,
is posed by a biomechanical gait engine and keyed poses.

| File | Role |
| --- | --- |
| `geometry.py` | The near arm's landmarks and the sword grip (shared by the art, the gait engine and the pose clips). |
| `human.py` | The rest-pose vector art: a 7-head adult in side profile (head unit 25, sole at y=222, 256 cell). |
| `skinparts.py` | Regroups it into skinned objects (one continuous drawing per limb, cloak sheet, tunic panels) and rigid objects. |
| `rig_human.json` | Bone hierarchy and pivots (hip, knee, ankle, shoulder, elbow, cloak tiers). |
| `gait.py` | Walk and run: IK legs with heel-to-toe rolling at constant ground speed, ballistic flight, arms, cloth springs. |
| `poses.py` | Idle, attack, hit, death, dodge, pickup, ritual, low sanity, signal decode, as keyed poses. |
| `skin.py` | Per-frame skinning: angle-blended bends about knee, ankle, elbow, cloak; composites at 4x, downsamples to 256. |
| `export_marked.py` | Writes frames, sheets, GIFs, `*.animation.json` and the manifest entries. |

`build.sh` runs everything. Notes worth keeping:

* **The sword hand is articulated.** The grip lies diagonally across the palm (`GRIP_REL` = 55 degrees from the forearm, the
  way a sword is held; a hammer grip would be about 80), the fist wraps it (four fingers, thumb, glove cuff) and only the
  pommel and guard show. The hand turns at the wrist relative to the forearm, so the blade always sits in the hand the way a held
  sword does. Clips key `blade`, the world angle the point should take (clockwise from +x, 0 is level forward, -90 straight up),
  and `gait.wrist_series` bends the wrist as far as a wrist can to get there (cocked up -40, flexed down +50 degrees), with
  the blade lagging the forearm's angular acceleration like a weight. `slack` widens the range as the grip lets go (the fall).
  Each clip prints the resulting world blade angle and wrist angle; `clipped` counts the frames that hit a limit, which
  means the arm needs re-posing rather than the wrist needing more range.

* The engine moves the player at 4.5 px/frame, about four body-heights a second. That is a sprint, so `run` is what
  plays while moving; `walk` is the slow stalking cycle for future use. The run clip is 8 frames at 17 fps.
* `basic_attack` plays over 20 ticks, so it is 10 frames at 30 fps; the blade is live on frames 3-7 (see its
  `attack_hitboxes`). `dodge_step` plays over the 12-tick dash, so 6 frames at 30 fps.
* The Shape (the player's dark double) is no longer baked into the frames. `CanvasRenderer.drawShapeEcho` draws it at
  runtime, a few frames behind and further out of phase at low sanity. The Shape and Corpse Echo enemies reuse
  these frames.
