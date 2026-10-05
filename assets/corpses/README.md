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

> cartoon, chibi, toy, stylized, low poly, clean, bright colors, standing, T-pose, medieval, fantasy armour, cloak, sword, base, pedestal, floor, ground plane, text

The game is set in the present day (2026). Every prompt describes ordinary modern people, not fantasy characters.

**fresh_marked_corpse**

> A dead young adult lying face down on a stone floor, present day. Dark charcoal hoodie with the hood pulled up over the head so the face is hidden, faded blue jeans, dirty white trainers, one leg bent at the knee. One arm stretched out ahead, pale hand open on the floor, a cracked smartphone lying just beyond the fingers. The other arm trapped under the body. A red work lanyard with a plastic ID card spilled out from the collar. Thin, lifeless, heavy. Realistic, contemporary clothing, muted colors: charcoal, washed denim, grey, dried-blood brown. Gritty, horror, forensic realism.

**burned_corpse_remains**

> Charred human remains lying on their back on a stone floor, present day, arms raised and curled as if shielding the face (pugilistic pose). Blackened, cracked bones with pale grey calcined patches. Melted scraps of synthetic jacket fused to the ribs, the rubber soles of trainers half-melted around the foot bones, a scorched smartphone fused to one hand. Skull turned toward the viewer, jaw slack. Ash clinging to everything. Realistic, horror, muted black, grey and bone colors.

**broadcast_corpse**

> A dead body lying on its side on a stone floor, present day, wrapped tightly in long strips of white printer paper and black electrical cable. Wears a grey hoodie and jeans, hood up. Wrists bound with cable. A handheld two-way radio with its aerial up stands on the floor beside the chest, its red LED on. Black ink soaked into the paper strips. Realistic, contemporary, horror, muted colors: grey, black, off-white paper.

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
