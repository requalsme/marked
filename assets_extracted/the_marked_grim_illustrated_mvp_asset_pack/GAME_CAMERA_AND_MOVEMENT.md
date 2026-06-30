# Camera And Movement Lock

Selected camera: 2.5D side-angled ARPG.

Reason: the rebuilt assets are side-facing and designed for left/right sprite flipping with up/down movement as depth across a walkable floor plane.

Required runtime behavior:
- direct player control from the start
- physical rooms and hubs
- collision bounds
- interaction radius
- enemy aggro radius
- pickup radius
- zone transition triggers
- depth sorting by Y position plus each asset depth_sort_offset
- idle assistance may automate attacks, but combat still occurs in-world