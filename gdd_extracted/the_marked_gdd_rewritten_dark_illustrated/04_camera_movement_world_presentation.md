# 04 — Camera, Movement, and World Presentation

## Core Rule

The Marked is directly controllable in a physical world.

The game may use a stylized 2D, 2.5D, or isometric presentation depending on the final asset pipeline, but it must always support real movement, collision, interactables, enemies, loot, rituals, signals, corpses, and zone transitions.

## Preferred Presentation

The preferred direction is a **2D illustrated ARPG space** with one of these accepted camera models:

### Option A — Stylized Isometric ARPG

Use if the asset pipeline supports angled environments and directional sprites.

- diagonal room layouts
- depth sorting
- isometric floors/walls
- physical loot drops
- enemies path through space
- direct player movement

### Option B — 2.5D Side-Angled ARPG

Use if assets are mostly side-facing or left/right oriented.

- walkable floor plane
- left/right sprite flipping
- up/down movement as depth across the floor
- room-based dungeons and hubs
- physical combat and interactables

## Not Allowed

Do not design the game as:

- pure menu combat
- fake auto-walking
- only node-based navigation
- static idle battle screen
- portrait-only mobile battle UI

## Movement Requirements

The Marked must support:

- walk movement
- facing direction
- collision
- interaction radius
- combat range
- pickup radius
- zone transition triggers
- enemy aggro triggers
- path-blocking objects

## Combat Positioning

Combat occurs in the world.

The player should care about:

- distance
- enemy approach angles
- area attacks
- hazards
- corpse locations
- ritual objects
- line-of-sight or range where useful

Idle assistance may automate attacks, but it must not erase positioning.
