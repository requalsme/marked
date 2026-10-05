# Corpse art (optional)

Drop rendered PNGs here and the game uses them instead of its painted bodies.
The blood pool, ground glow and embers are still drawn by the game.

| File | Shown for |
|---|---|
| `fresh_marked_corpse.png` | a Marked who just died (searchable) |
| `burned_corpse_remains.png` | a corpse you burned |
| `broadcast_corpse.png` | a corpse you broadcast |

Reload the page after adding a file. Nothing else needs changing.

## Making them in Meshy

### 1. Generate the model (Text to 3D)

Use **Text to 3D** with the art style set to **Realistic**. Paste one prompt per corpse.

Add this **negative prompt** to all three:

> cartoon, chibi, toy, stylized, low poly, clean, bright colors, standing, T-pose, base, pedestal, floor, ground plane, text

**fresh_marked_corpse**

> A dead medieval wanderer lying face down on the ground. Long ragged black hooded cloak, torn and wet at the hem. One arm stretched out ahead, the pale bony hand open on the floor. The other arm folded under the body, legs slightly bent, scuffed leather boots. Hood fallen over the head so the face is hidden. A strip of cloth wrapped around one forearm marked with a dark red sigil. Gaunt, emaciated proportions. Dark fantasy, gothic horror, grim and muted colors: charcoal, ash grey, dried-blood brown. Realistic cloth folds, lifeless weight sinking into the floor.

**burned_corpse_remains**

> Charred human skeletal remains lying on their back, arms raised and curled as if shielding the face (pugilistic pose). Blackened, cracked bones with pale grey calcined patches. Scraps of burnt cloth fused to the ribs. Skull turned toward the viewer, jaw slack. Ash and cinders clinging to the bones. Dark fantasy horror, realistic, muted black, grey and bone colors.

**broadcast_corpse**

> A dead body lying on its side, wrapped tightly in long strips of old paper ticker tape and loops of copper wire. A thin antique radio aerial with three crossbars pushed into its back. A small brass horn speaker tangled in the wire near the head. The hooded cloak is stained with black ink. Pale bony hands bound at the wrists with wire. Dark fantasy, gothic horror, realistic, muted colors: black, parchment cream, tarnished copper.

### 2. Polish in Meshy

- **Refine** the preview, so you get full texture detail.
- **Texture:** rough, weathered, desaturated. Re-texture with "grimy, damp, dried blood stains" if it comes out too clean.
- If it generated the body standing or sitting, try again with "lying flat on the ground" at the start of the prompt.

### 3. Render it from the game's camera

The game camera looks down at the floor at about **30°**. This step is what makes a render look like it belongs in the room. Use Meshy's viewer screenshot, or better, export a GLB and render it in Blender.

| Setting | Value |
|---|---|
| Camera | Orthographic, pitched **30° down** from horizontal, looking straight at the body |
| Pose | Body lying **left to right**, head on the **left**, feet on the right |
| Light | Single key light from the **upper left**, warm candle colour (about 2700 K), weak cool fill from the right, no strong rim |
| Background | **Transparent** (Blender: Render Properties → Film → Transparent) |
| Shadow | None baked in (the game draws the shadow and blood pool) |
| Crop | Tight around the body, no empty margins |
| Size | About **600 px wide** (it's drawn about 92 units long, so more just gets scaled down) |

### 4. Match the game's look (optional)

The room is ink-drawn, so in Photoshop or Photopea:
- Drop the saturation slightly.
- Add a thin dark outline (Stroke, 1–2 px, near-black, about 70%).
- Add a little grain.

Then save it as PNG with transparency into this folder, under the file name from the table.

## If you'd rather not use 3D

Any transparent PNG works, including a paint-over or AI image. It should be a body lying left to right, seen from slightly above, head on the left, cropped tight.
