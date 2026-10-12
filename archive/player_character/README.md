# Archive: the player character

Everything that drew or presented **The Marked** (the player) was moved here. The game currently has **no character art**: the
player, The Shape and Corpse Echoes are drawn as a plain stand-in marker, and the HUD and lineage cards show a CSS sigil in the
class's colour. Nothing here is loaded by the game.

## What is in this folder

| Archived path | Was at | What it is |
| --- | --- | --- |
| `assets/characters/player/the_marked/` | same path under the repo root | The 11 animations (idle, walk, run, basic_attack, hit_react, death_collapse, dodge_step, interact_pickup, ritual_channel, low_sanity, signal_decode): frames, sheets, GIFs, `*.animation.json`, `the_marked.asset.json`, `the_marked_base.png`. |
| `assets/avatar.png` | `assets/avatar.png` | The HUD portrait (skull-masked head and shoulders). |
| `assets_extracted/.../characters/player/` | same path | The original pack's version of the player sprites (before the rebuild). |
| `tools/art/the_marked/` | `tools/art/the_marked/` | The art pipeline: vector character, skinned-mesh rig, IK gait engine, pose clips, exporter and `build.sh`. See its own `README.md`. |
| `manifest_entries.json` | `assets/pack_manifest.json` | The `the_marked` asset and its 11 `the_marked.*` animation entries, removed from the manifest. |
| `removed_code.patch` | `src/canvas.js`, `src/main.js`, `style.css`, `index.html`, the manifest, the review harness | The code change that removed the character from the game (`git apply -R` undoes it). |

## What replaced it

* `src/canvas.js`: `drawMarker()` draws a lozenge with a bar for the direction it faces. It keeps every state readable: lunge (attack),
  flash (hit), trail (dash), sink (death), jitter (low sanity). `drawPlayer()` uses it for the player; the `marker` specs in `ENEMY_ART`
  use it for The Shape (violet) and Corpse Echo (red). The Shape's dark double behind the player is gone.
* `style.css` / `index.html` / `src/main.js`: `.sigil-glyph`, a lozenge in the class colour, on the HUD plate, the profile cards and the
  lineage cards.

## Putting a character back

**All of it, exactly as it was:** `git revert` the commit that created this folder.

**Just new art:** add the sprites, register their animations in `assets/pack_manifest.json`, then replace `drawPlayer()` and the
`marker` specs in `src/canvas.js` with sprite drawing (`assetLoader.drawFrame`, as the enemies do), and swap `.sigil-glyph` for an image in
`index.html` and `src/main.js`.

**The old pipeline:** move `tools/art/the_marked/` back to `tools/art/the_marked/` (or run it from here: `build.sh` finds the repo root
with git) and see its README. It installs frames into `assets/characters/player/the_marked/` and edits `assets/pack_manifest.json`.

## Left where it was (not the character's art)

* `docs/art/ASSET_PROMPT_PACK.md` (the player spec, section 4, and the portrait spec) and
  `docs/art/reference/current_characters.png` (a reference sheet of the whole cast, the old player included): shared references.
* `gdd_extracted/.../05_player_identity_the_marked.md`: design, not art.
* Gear icons (including `marked_hood`) and the corpse props (`fresh_marked_corpse`): the pack classes them as items and in-world objects.
* The class names, and everything about how The Marked plays.
