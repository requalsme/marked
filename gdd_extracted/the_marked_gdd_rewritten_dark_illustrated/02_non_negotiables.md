# 02 — Non-Negotiables

These rules override older design assumptions.

## 1. The Player Moves From the Start

The Marked must physically exist in the world and be directly controllable from the beginning of development.

The game must not begin as:

- a menu-only idle battler
- a static auto-combat screen
- fake movement
- pure node navigation without a controllable character

Idle systems are allowed, but they support the RPG. They do not replace physical movement.

## 2. The Game Is Cross-Platform, Not Strictly Mobile

The game should be designed for desktop/web prototype first, with support for mobile later if desired.

Primary assumptions:

- keyboard and mouse support
- controller-friendly layout where possible
- scalable UI
- optional touch support later
- no portrait-only interface assumptions

## 3. The Art Direction Avoids Chibi

The game must not use cute super-deformed proportions, mascot-style characters, bubbly fantasy UI, or overly round mobile-idle silhouettes.

The target is a **grim illustrated dark fantasy** look closer in spirit to gothic inked RPG art than to cheerful idle RPG art.

## 4. The Existing Asset Pack Is a Content Reference, Not an Absolute Style Lock

If generated assets contain useful concepts, enemies, props, animations, or item ideas, preserve those ideas.

However, if any generated asset drifts into chibi, cute cartoon, toy-like, or overly mobile-casual styling, it should be revised toward the new dark illustrated art direction.

## 5. The World Observes the Player

Observation is the unique hook. The Monolith watches living behavior, not just deaths.

It tracks:

- movement habits
- survival time
- combat style
- gear preferences
- ritual usage
- sanity behavior
- signal behavior
- corpse choices
- death causes
- repeated patterns

The world should react to this information.

## 6. Systems Must Serve the Core Fantasy

Every major system should support at least one of these ideas:

- surviving longer
- being observed
- becoming powerful
- becoming known
- resisting being copied
- exploring a cursed world
