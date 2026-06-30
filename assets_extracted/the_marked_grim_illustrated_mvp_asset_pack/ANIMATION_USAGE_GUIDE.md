# Animation Usage Guide

All character, enemy, boss, prop, tarot, gear, UI, and VFX animations include:
- fixed 256x256 frames
- bottom-center or center origin
- individual PNG frames
- horizontal sprite sheet
- GIF preview
- animation JSON
- collision bounds
- mirror rules
- depth-sort offset
- attack hitbox timing where relevant

Use `mirror_x: true` for player/enemy/boss left-right facing. Environment, UI, gear, tarot, and props should not be mirrored unless a future runtime explicitly needs it.