# 19 — Technical Architecture

## Main Technical Goal

Build the game as a physical-world ARPG from the start, with idle systems layered on top.

Do not architect the game as a static idle battler if direct movement is required.

## Recommended State Domains

- profile state
- player/Marked state
- world/zone state
- movement/collision state
- combat state
- inventory/gear state
- sanity state
- observation state
- ritual state
- signal state
- corpse state
- meta progression state
- settings/accessibility

## Movement Systems

The engine should support:

- position
- velocity
- facing
- collision bounds
- interact bounds
- enemy aggro radius
- pickup radius
- zone transitions
- depth sorting if 2.5D/isometric

## Observation Tracking

Observation should be event-driven where possible.

Track events such as:

- enemy killed
- skill used
- gear equipped
- ritual performed
- signal decoded
- corpse action taken
- sanity threshold crossed
- death occurred
- region entered/exited
- long survival milestone reached

## Save System

The save system must support persistent profiles.

Recommended top-level structure:

```ts
type SaveData = {
  version: number;
  activeProfileId: string | null;
  profiles: Profile[];
  global: GlobalSaveData;
};
```

## Art Pipeline Requirement

Asset metadata should describe:

- animation name
- frame count
- frame size
- pivot/anchor point
- collision bounds
- attack hitbox timing
- facing/mirroring rules
- scale
- depth-sort offset

This is important if assets are AI-generated and may vary.
