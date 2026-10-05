# The Marked: Asset Prompt Pack

Prompts for an image model (ChatGPT image generation or similar) to produce
higher-quality art for The Marked that drops straight into the game. Every
prompt pairs **art direction** (from GDD `03_art_direction_dark_illustrated.md`
and `17_ui_ux_crossplatform.md`) with the **technical spec** the engine needs.

Reference images to attach live in `docs/art/reference/`.

---

## 0. Workflow

1. **Lock the style first (section 1).** Generate the style plates, pick the ones you
   love, and attach them to *every* later prompt as the style reference. This is
   what keeps 60+ assets looking like one game.
2. **Make the mocks (section 2).** Full-screen mocks of gameplay, HUD and menus give
   us a shared target. Send them to Claude; the UI and lighting get tuned toward them.
3. **Repaint the room (section 3).** One image. It drops in as the room backdrop
   with no code changes.
4. **Key art per asset (sections 4–8).** One hero frame per character or prop.
   Iterate until it's right before animating.
5. **Animation frames.** Image models drift when asked for a whole strip at
   once, so generate **one frame per request**, attaching the approved key art
   plus `frame_template_single.png`, and describe that frame's pose (pose lists
   below). If that's too slow, deliver key art only and Claude can build the
   animation as a cut-out rig from it.
6. **Hand off.** Put files in `assets/incoming/<asset_id>/`, named
   `<asset_id>_<animation>_<NN>.png` (for example `the_marked_walk_03.png`), or as a
   finished strip `<asset_id>_<animation>_sheet.png`. Claude will remove
   backgrounds, align feet to the anchor, assemble sheets, update the manifests
   and tune in-game scale.

### Reference images to attach

| File | Use it for |
| --- | --- |
| `reference/room_shell_paintover_base.png` | The room repaint (section 3): keep this exact composition |
| `reference/room_overview_current.png` | Camera angle, lighting mood and scale of everything |
| `reference/gameplay_camera_current.png` | How big sprites read in play |
| `reference/frame_template_single.png` | Every sprite frame: canvas, safe area, foot anchor |
| `reference/frame_template_strip_6/8/10.png` | If you try whole strips |
| `reference/current_characters.png` | Character identities to preserve |
| `reference/current_props.png` | Prop identities to preserve |

---

## 1. Global blocks (paste these into every prompt)

### 1a. STYLE block

```
STYLE: grim illustrated dark fantasy horror for a 2D ARPG. Gothic ink illustration
meets painterly dark fantasy: heavy black ink outlines of varying weight, rough
brush texture, cross-hatched shadows, dramatic chiaroscuro, distressed edges.
Limited desaturated palette — cold slate and bone greys, soot black, aged
parchment, old iron, dark walnut — with deliberate wax-red and blood-red accents
and pale candlelit highlights. Mood: decayed, oppressive, archival, ritualistic,
watched. Recurring materials: parchment, bone, black ink, red wax seals, iron,
old wood, red thread, candle tallow, cracked stone, rotted cloth, glass eyes,
etched symbols.
AVOID: chibi or super-deformed proportions, big cute heads, toy-like or rounded
mobile-game shapes, glossy or plastic rendering, saturated candy colours, soft
mascot faces, bubbly UI, lens flares, text, letters, watermarks, signatures.
```

### 1b. SPRITE SPEC block (every character, prop and pickup)

```
SPRITE SPEC: single game sprite on a fully TRANSPARENT background (PNG with
alpha), no floor, no scenery, no drop shadow, no cast shadow, no glow halo.
Canvas 256x256 px. The subject stands with its feet/base centred at x=128,
y=232 and stays inside the safe area (x 24–232, y 24–242) — see the attached
frame template. Camera: 3/4 view from about 30° above, the same angle as the
attached room reference, subject facing RIGHT (the game mirrors it for left).
Lighting: soft key light from the upper left, neutral colour; no coloured rim
lights (the game adds its own lighting). Crisp silhouette that still reads when
shown about 80 px tall; strong value contrast between major shapes.
```

### 1c. ANIMATION FRAME block (when making frames)

```
This is frame {N} of {TOTAL} of the "{ANIMATION}" animation for the attached
character. Keep the character IDENTICAL to the attached key art: same
proportions, costume, colours, line weight, lighting and size on the canvas.
Feet stay planted on the anchor (128, 232) unless the pose leaves the ground.
Pose for this frame: {POSE}.
```

---

## 2. Mocks (targets for the whole look)

### 2a. Gameplay screen mock
Attach `room_overview_current.png` and `gameplay_camera_current.png`.
```
[STYLE block]
Create a 1920x1080 in-game screenshot mock of "The Marked", a 2D dark-fantasy
horror ARPG. Keep the attached screenshots' camera angle and room layout: a
vaulted archive hall seen from above and in front, back wall of gothic
bookshelf bays between stone pillars, a sealed gothic door at the top centre
with an oxblood runner leading down to a black obelisk (the Monolith) carved
with glowing red glyphs and a single red eye. The player, a hooded wanderer
with a pale mask and a short blade, fights two paper-and-ink horrors in a pool
of lantern light; candelabra and iron sconces cast warm pools, cold moonlight
falls in shafts from the darkness above, fog hugs the floor. HUD: top-left an
iron nameplate with portrait; top-centre an illustrated eye that opens as
Observation rises above a red-thread gauge; top-right pinned parchment tags for
currencies; bottom-left an engraved iron plaque with the level in Roman
numerals beside ink-stroke Flesh and Sanity bars; bottom-centre a carved wood
action rail of iron sockets with bone key tabs. Painterly, high detail,
cinematic lighting, readable gameplay.
```

### 2b. HUD close-up sheet
```
[STYLE block]
A UI kit sheet on a dark background for a grim illustrated horror ARPG,
crafted from iron, parchment, black ink, red wax and bone: (1) an iron
nameplate with a portrait frame, (2) an engraved iron level plaque with Roman
numerals, (3) health and sanity bars drawn as ink strokes inside iron channels,
(4) an illustrated watching eye in three states (closed, half open, wide open),
(5) square iron item sockets, empty and filled, (6) bone key tabs with letters
I R J C U T, (7) pinned parchment currency tags, (8) a parchment ledger panel
with an iron spine and a red-thread bookmark, (9) a wax-red pressed button.
Orthographic, evenly lit, each element separated with space around it.
```

### 2c. Title and lineage-select mock
```
[STYLE block]
1920x1080 title screen for "The Marked": a vast gothic archive cathedral in
darkness and red candlelight. Left: the title in a weathered old-print
serif, a tagline in italic, and a vertical menu (Continue, New Shape, The
Archive). Right: five lineage cards (Blood, Signal, Bone, Static, Ritual)
showing the hooded wanderer in each lineage's accent colour, and a parchment
card with the chosen lineage's description and stat tallies.
```

---

## 3. Room repaint (biggest visual win, one image)

Attach `reference/room_shell_paintover_base.png` (1600x1000).
```
[STYLE block]
Repaint the attached image as a finished, highly detailed painted game
background at exactly 1600x1000 px. KEEP THE COMPOSITION EXACTLY: every
pillar, shelf bay, arch, banner, the door recess, the steps, the red runner,
the ritual circle and the floor/wall edges must stay in the same position
and the same perspective (it is a game level; characters walk on that
floor). Improve material quality and detail: carved weathered stone pillars,
bookshelves dense with leather tomes, scrolls, skulls and candle stubs, aged
parchment notes on red thread, a worn embroidered runner, cracked and damp
flagstones with dust, wax drips, old blood and loose pages. Render it
UNLIT and evenly exposed (flat, mid-grey ambient, no strong shadows or light
pools, no fog). The game applies its own candle and moonlight lighting, so
baked lighting would double up. No characters, no furniture standing on the
floor, no text.
```
Save the result as `assets/room/room_painted.png`. The game uses it
automatically in place of the procedural room.

---

## 4. The player: The Marked

**Identity (keep):** hooded wanderer, pale porcelain mask with a red mark under
one eye, layered dark cloak, leather straps and charms, short sword. A faint
shadow figure (their "Shape") stands just behind them.

**Fix (per GDD 03):** grounded proportions, 6–7 heads tall, lean and weathered;
not chibi.

**Key art prompt**
```
[STYLE block]
[SPRITE SPEC block]
Key art of "The Marked", a haunted wanderer: lean, 6.5 heads tall, a deep
hood over a pale cracked porcelain mask with a single red brand under the
left eye, a layered ragged cloak in charcoal and faded indigo, leather
straps, wax-sealed charms and a coil of red thread at the belt, wrapped
forearms, worn boots, a short notched blade held low in the right hand. A
faint translucent shadow-double of the figure stands half a step behind.
Neutral standing pose, weight on the back foot, facing right.
```

**Animations** (frames; loop or once; pose list)
| Animation | Frames | Poses |
| --- | --- | --- |
| idle | 8, loop | Slow breath; cloak hem sways; blade lowered; head tilts slightly on frames 4–6 |
| walk | 8, loop | Stalking walk: contact, down, passing, up × 2; cloak trails; shoulders hunched |
| basic_attack | 10 | 1–3 wind-up (blade drawn back, body coiled); 4–6 lunge slash, blade arc forward; 7–8 follow-through; 9–10 recover |
| hit_react | 6 | Recoil backward, head snaps, mask cracks a little, stagger, recover |
| death_collapse | 10 | Knees buckle, blade drops, fall to the side, cloak settles, lying still (stays inside the safe area) |
| dodge_step | 6 | Crouch, low sideways dash with cloak streaming, land |
| low_sanity | 8, loop | Hunched, hand clutching the mask, twitching, shadow-double out of sync |
| ritual_channel | 10 | Kneel, raise both hands, blood sigil forms between palms, hold |
| interact_pickup | 8 | Crouch, reach down, grasp, rise |
| signal_decode | 8 | Hold a small antenna lantern up, head tilted listening, static crackle |

---

## 5. Enemies (archive horrors)

Motion per GDD 03: they **drag, twitch, unfold, jerk, press inward, rupture**,
never bouncy. Each needs `combat_idle` (8, loop), `move` (8, loop),
`attack` (8), `hit_react` (6) and `death` (10).

**Ink Redactor**
```
[STYLE block] [SPRITE SPEC block]
"Ink Redactor": a tall faceless robed apparition of blue-black ink, its hood
a void, its robes made of pages crossed out with heavy black redaction bars,
ink dripping from its sleeves and hem, one long arm ending in a quill-like
talon. Floats slightly; hunched, menacing. Facing right.
```
attack: rears back, then flicks an arc of ink forward. death: dissolves into a puddle of ink and loose pages.

**Cabinet Indexer**
```
[STYLE block] [SPRITE SPEC block]
"Cabinet Indexer": a hunched archivist-thing built from stacked ledgers, card
catalogue drawers and twine, a drawer for a mouth, one very long arm of
index cards ending in a clasp, a red wax seal pressed into its chest where a
heart would be. Drags itself forward. Facing right.
```
attack: the long arm unfolds and slams down. death: collapses into a heap of drawers and cards.

**Paper Wraith**
```
[STYLE block] [SPRITE SPEC block]
"Paper Wraith": a gaunt skeletal wraith of torn yellowed parchment with a
bare skull face, ribbons of shredded paper trailing behind it, carrying a
great crescent blade made of layered paper scraps. Drifts, never touching
the ground. Facing right.
```
attack: wide crescent swing that sheds scraps. death: shreds apart into a whirl of paper.

**Witness Chair**
```
[STYLE block] [SPRITE SPEC block]
"Witness Chair": a high-backed tribunal chair come alive: blackened carved
wood, torn oxblood velvet, red wax seals, legs elongated into jointed
spider-like limbs of wood and bone, a judge's ledger chained to its arm, an
eye peering from the velvet backrest. Facing right.
```
attack: rears up on its hind legs and stamps down. death: legs splay and it falls apart into broken wood.

---

## 6. Boss: the Seal Mother

```
[STYLE block] [SPRITE SPEC block — but the subject may fill up to y=20]
"The Seal Mother": an enormous enthroned matron of wax and parchment, robed
in layered documents stamped with red wax seals, a tall crown made of
seals and candle stubs, a pale serene mask with no eyes and many thin hands
holding seal stamps. Melted wax pools at her base. Imposing, regal, horrifying.
Facing right.
```
| Animation | Frames | Poses |
| --- | --- | --- |
| combat_idle | 8, loop | Breathing; wax drips; hands shift |
| seal_slam | 10 | Raises a giant seal stamp, slams it down |
| summon_seals | 10 | Arms spread, wax seals peel off her robes and orbit her |
| phase_shift | 8 | Mask cracks open, wax surges |
| hit_react | 6 | Recoils, wax splashes |
| death_unravel | 12 | Documents peel away and burn, wax collapses |

---

## 7. Interactables and props

Same SPRITE SPEC (base centred on the anchor). Each needs `idle` (6, loop:
flicker or sway) and, where marked, `activate` (8).

| Asset id | Prompt core |
| --- | --- |
| blood_ritual_altar (+activate) | A stone altar draped in blood-soaked cloth, black candles, pinned parchment contracts, a ring of iron spikes; activate: the blood seeps and glows faintly |
| static_signal_pylon (+activate) | A gothic iron antenna-lantern on a tripod with crackling static between its prongs; activate: the lantern flares |
| corpse_lantern_shrine (+activate) | A tall iron cage-lantern hung with name tags and bones; activate: the flame inside turns pale |
| wax_record_chest (+activate) | An iron-banded chest wrapped in chains and sealed with red wax; activate: the seal cracks, the lid lifts |
| sealed_zone_door (+activate) | A gothic stone door frame with a black iron door bearing a wax seal sigil; activate: the seal splits, the door swings open onto red light |
| red_string_evidence_board | A freestanding board of pinned notes and portraits linked with red thread |
| chained_ledger_altar | A heavy lectern holding a huge chained ledger, candles and wax |
| fresh_marked_corpse / burned_corpse_remains / broadcast_corpse | The Marked lying dead (fresh), as charred remains, and with an antenna rising from the chest |

---

## 8. Pickups and UI art

**Pickups** are drawn at about 40 px in game, so silhouette is everything.
Same SPRITE SPEC, but the object is centred and fills about 60% of the canvas.

| Asset id | Prompt core |
| --- | --- |
| debt_coin | A heavy tarnished coin stamped with a skull and a wax seal |
| sanity_shard | A shard of pale glass with an eye inside it |
| black_ink_vial | A small corked vial (the game tints it red for blood vials) |
| folded_witness_note | A folded parchment note sealed with red wax |
| cursed_gear_drop | A small bundle of wrapped gear with a glint of metal |
| brass_archive_key | An ornate brass key with a paper tag |

**System icons** (`ritual_bargain`, `signal_broadcast`, `corpse_record`,
`monolith_depth`, `witnessing_eye`, `sanity_cracked_mask`): 256x256 square,
the motif drawn large and centred, ink-and-iron framing, transparent
corners.

**Gear icons** (30 items; ids in `assets/gear/`): 256x256 transparent, the
item drawn large at a slight angle like an inventory illustration.

**Tarot cards** (Tower, Moon, Devil, Death, Judgement, Hermit): 512x768
portrait cards, aged parchment with an ink-illustrated scene and an iron
border, no text.

**Portrait** (`assets/avatar.png`): 512x512 head-and-shoulders of The Marked
for the HUD nameplate.

---

## 9. Delivery checklist

- [ ] Transparent PNG, no baked floor or shadow
- [ ] 256x256 per frame; feet/base on (128, 232); inside the safe area
- [ ] Facing right; same camera angle as the room reference
- [ ] Frame counts match the tables (the engine plays them at the listed lengths)
- [ ] Files in `assets/incoming/<asset_id>/`, named `<asset_id>_<animation>_<NN>.png`
- [ ] Room repaint at `assets/room/room_painted.png` (1600x1000, unlit)
