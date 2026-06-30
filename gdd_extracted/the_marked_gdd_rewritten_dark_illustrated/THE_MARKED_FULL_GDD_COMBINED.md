# The Marked — Full Rewritten GDD


---

# 01 — Vision

## Working Title

**The Marked**

## High Concept

**The Marked** is a cross-platform 2D horror idle ARPG where the player directly controls a cursed wanderer in a physical world that watches, studies, and adapts to their living behavior.

The player is not a chosen hero. They are **The Marked**: a survivor whose existence has been noticed by the Monolith. The Monolith observes how long they stay alive, how they move, how they fight, what gear they favor, what rituals they accept, what corpses they abandon, what signals they decode, and what finally kills them.

The longer The Marked survives, the more accurately the world understands them.

## Core Pitch

> **Survive too long, and the world learns what you are.**

## Game Identity

The game combines:

- **Idle RPG progression:** offline rewards, constant growth, long-term systems, gear accumulation.
- **Direct ARPG control:** the player moves through rooms, dungeons, hubs, and regions from the start.
- **Dark fantasy loot chasing:** rarity, affixes, cursed items, build identity, boss farming.
- **Observation horror:** the world tracks player habits and mutates around them.
- **Grim illustrated art:** no chibi, no cute mascot styling, no bubbly mobile fantasy look.

## Core Emotional Loop

The player should feel:

1. **Power** — gear, levels, rituals, upgrades, and survival gains.
2. **Exposure** — every success teaches the world more about them.
3. **Dread** — the Monolith is learning how to challenge, copy, or replace them.
4. **Curiosity** — signals, whispers, corpses, and reality traits reveal what the world knows.

## Design Statement

This is not a menu-only idle game. It is not strictly a mobile game. It is not a chibi auto-battler.

It is a **grim 2D horror idle ARPG** with direct movement, dark illustrated characters, physical spaces, and long-term progression.

---

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

---

# 03 — Art Direction: Grim Illustrated Horror

## Target Direction

The game should use a **grim, illustrated dark fantasy style** with heavy ink, dramatic shadows, severe silhouettes, and oppressive atmosphere.

The visual direction should feel closer to:

- gothic ink illustration
- painterly dark fantasy
- harsh comic-book shadowing
- worn parchment and candlelit horror
- theatrical contrast
- decayed religious/occult imagery

It should not feel like a cute mobile idle RPG.

## Explicit Avoid List

Avoid:

- chibi proportions
- oversized cute heads
- toy-like bodies
- bubbly idle-game silhouettes
- glossy cheerful fantasy UI
- overly saturated candy colors
- soft mascot expressions
- bouncy comedic animation
- clean bright mobile storefront energy

## Character Proportion Rules

Humanoid characters should feel stylized but grounded.

Target:

- roughly 5.5–7 heads tall for adult humanoids
- elongated or weathered silhouettes
- visible posture and weight
- masks, hoods, cloaks, straps, charms, scars, and ritual marks
- expressive shape language without becoming cute

The Marked should look like a haunted wanderer, not a mascot avatar.

## Rendering Rules

Use:

- heavy shadow blocks
- inked outlines
- rough brush texture
- distressed edges
- limited color palette
- desaturated materials
- deliberate blood-red or wax-red accents
- pale masks and candlelit highlights
- strong silhouettes readable at small size

## Animation Rules

Animation should be weighty and intentional.

The Marked should:

- stalk
- brace
- lunge
- recoil
- collapse
- channel rituals with tension

Enemies should:

- drag
- twitch
- unfold
- jerk
- press inward
- rupture

Avoid overly springy, cute, or comedic motion.

## Environmental Mood

The world should feel:

- decayed
- oppressive
- observed
- ritualized
- archival
- hostile
- old beyond human scale

Recurring materials:

- parchment
- bone
- black ink
- wax seals
- iron
- old wood
- blood-red thread
- candlelight
- cracked stone
- rotted cloth
- glass eyes
- etched symbols

---

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

---

# 05 — Player Identity: The Marked

## Name

The player character is called **The Marked**.

This replaces earlier terms that felt too scientific or generic. The name fits the game because it implies the world has noticed the player and tagged them for study.

## Fantasy

The Marked is a haunted wanderer who has survived exposure to the Monolith.

They are not chosen. They are not blessed. They are **recorded**.

## Visual Identity

The Marked should be:

- hooded or partially obscured
- masked or skull-faced
- wrapped in cloth, belts, charms, and ritual objects
- armed with a blade or build-specific weapon
- marked by a visible sigil, brand, thread, seal, or shadow
- grim and grounded, not cute
- readable at gameplay scale

## Progression States

The Marked may visually evolve as observation increases.

### Unread

A wanderer barely noticed by the Monolith.

### Marked

A visible sign appears: seal, brand, thread, scar, mask crack, or sigil.

### Witnessed

The Watcher comments more accurately. The body shows signs of being studied.

### Mirrored

The Monolith has enough data to begin creating imperfect copies.

### Known

The player is deeply understood. The world has learned their shape.

## Naming System

- **The Marked** — player identity
- **The Watcher** — observing voice/presence
- **The Monolith** — central world force
- **The Witnessed** — observation status
- **The Mirrored** — copied enemies or rival forms
- **The Shape** — the Monolith’s constructed model of the player

---

# 06 — Core Gameplay Loop

## Primary Loop

1. Move through a physical area.
2. Fight enemies directly or with idle-assist combat.
3. Collect loot and resources from the world.
4. Manage sanity, gear, and survival risk.
5. Decode signals and respond to Watcher information.
6. Perform rituals for power at a cost.
7. Push deeper into the Monolith or surrounding regions.
8. Survive long enough to gain rewards, but expose behavior to observation.

## Idle Loop

When offline or inactive, the game calculates:

- survival time
- resource gain
- background combat results
- sanity pressure
- possible signal discoveries
- observation growth
- rare corpse creation if collapse occurs

Idle rewards should feel like the world continued studying The Marked.

Example return summary:

```text
Absence recorded: 06:42:19
The Marked remained alive for 04:10:33
Gear recovered: 12
Signals intercepted: 2
Sanity lost: 18
Observation increased: 4%
Conclusion: Subject favors sustained blade combat.
```

## Active Loop

When playing directly, the player should make meaningful choices:

- where to move
- which enemies to engage
- whether to retreat
- what loot to risk collecting
- when to use rituals
- whether to decode or ignore signals
- what to do with corpses
- how much sanity risk to accept

## Core Tension

The player wants to live longer because survival improves rewards.

But living longer gives the Monolith more evidence.

That is the central tension:

> **Survival is progress. Survival is exposure.**

---

# 07 — Observation System

## Purpose

Observation is the unique identity of the game.

The Monolith does not only remember failed runs. It studies everything The Marked does while alive.

## What the Monolith Tracks

### Survival

- current life duration
- longest life
- total alive time
- time spent at low sanity
- time spent in each region
- offline survival time

### Movement

- aggressive engagement
- avoidance patterns
- retreat frequency
- repeated farming routes
- regions avoided
- corpse return behavior

### Combat

- weapon type usage
- skill usage
- damage style
- crit reliance
- defensive reliance
- melee/ranged preference
- enemies farmed
- boss death causes

### Systems

- ritual reliance
- sanity risk behavior
- gear rarity preference
- signal reading/ignoring
- corpse recovery/burning/devouring/leaving
- tarot preference
- meta upgrade path

## Observation Outputs

Observation should produce readable diagnoses.

Examples:

```text
Diagnosis: Aggressive / Ritual-dependent
Diagnosis: Defensive / Corpse-preserving
Diagnosis: Signal-reliant / Sanity-neglectful
Diagnosis: Idle-heavy / Gear-dependent
Diagnosis: Evasive / Boss-avoidant
```

## Observation Thresholds

### 25% — Noticed

The Watcher begins making accurate comments.

### 50% — Studied

Reality Traits begin reacting to player behavior.

### 75% — Modeled

Enemies begin copying specific habits.

### 100% — Known

The Monolith can create a major imitation: **The Shape**.

## Player Counterplay

The player must be able to resist observation.

Counter-systems:

- Obfuscation meta upgrades
- corpse burning
- false behavior rituals
- signal masking
- gear that hides combat style
- rituals that erase parts of the record

Observation should create pressure, not unavoidable punishment.

---

# 08 — Sanity, Tarot, and Reality Traits

## Sanity

Sanity is the main horror pressure system.

It should affect perception, signals, rituals, enemy behavior, and observation accuracy.

### Stable: 70–100

- normal signal clarity
- low ritual risk
- minor whispers

### Strained: 40–69

- some signal corruption
- mild Watcher interference
- slight reality instability

### Fractured: 15–39

- false signals become possible
- rituals become more dangerous
- enemies may gain horror traits
- observation becomes more invasive

### Broken: 0–14

- the Monolith may obscure information
- Watcher whispers become personal
- gear descriptions may become unreliable
- corpse risk increases
- high-risk events can trigger

Sanity should be scary because it changes decisions, not because it makes the interface unreadable.

## Tarot

Tarot defines the current curse, diagnosis, or run/world modifier.

Examples:

### The Tower

Bosses are more dangerous. Relic drops improve.

### The Moon

Signals are more frequent, but less reliable.

### The Devil

Rituals are stronger, but costs become harsher.

### Death

Corpse rewards improve. Corpses may rise.

### Judgement

Observation increases faster. Imitation enemies are more likely.

### The Hermit

Offline rewards improve. Offline sanity pressure increases.

## Reality Traits

Reality Traits are world mutations. They should feel like experiments performed by the Monolith.

Examples:

### Static Sky

Signals intensify. Watcher comments become more frequent.

### Blood Rain

Healing weakens. Blood-themed gear and rituals strengthen.

### Bone Bloom

Corpse events become more common.

### Mirror Rot

Enemies copy parts of the player’s build.

### Hollow Gravity

Idle rewards increase, but survival becomes less stable.

## Rule

Early areas should use one active Reality Trait at a time. Later regions may stack traits, but never so many that the player cannot understand cause and effect.

---

# 09 — Combat and Classes

## Combat Feel

Combat should be a direct-control ARPG system with idle-assist elements.

The player moves The Marked through spaces, engages enemies, uses attacks/skills, picks up loot, avoids hazards, and interacts with objects.

Idle assistance may include:

- auto-attack when enemies are in range
- optional skill automation later
- offline combat calculation
- background farming systems

But combat should still care about positioning.

## Base Combat Requirements

- movement speed
- attack range
- enemy aggro
- hit reactions
- skill cooldowns
- loot drops
- hazards
- death/collapse state
- corpse creation rules

## Class Direction

Classes are expressions of The Marked, not separate cute heroes.

### Blood Marked

Aggressive melee, self-damage, high risk.

### Signal Marked

Caster/occult reader, signal manipulation, perception mechanics.

### Bone Marked

Defensive survivor, corpse armor, attrition combat.

### Static Marked

Fast attacker, crit/evasion, unstable reality effects.

### Ritual Marked

Bargain-based build, summons/hexes, power at a cost.

## Build Identity

The Monolith should learn from the class/build.

Examples:

- heavy crit use may produce anti-burst enemies
- heavy ritual use may produce bargain traps
- defensive play may produce time-pressure encounters
- signal reliance may produce redacted or false signals

The goal is not to hard-counter the player unfairly. The goal is personalized pressure.

---

# 10 — Gear, Rarity, and Builds

## Gear Philosophy

Gear should be exciting like an ARPG, but cursed like horror.

It should not be only percentage math.

Good gear changes:

- combat style
- sanity behavior
- ritual risk
- observation gain
- corpse outcomes
- signal clarity
- reality instability

## Rarity Names

Recommended rarity ladder:

1. Worn
2. Unsettling
3. Cursed
4. Relic
5. Abyssal
6. Impossible

## Gear Layers

### Base Stats

- damage
- armor
- health
- sanity resistance
- crit
- attack speed
- cooldown reduction

### Affixes

Examples:

- +damage while sanity is below 40%
- +signal clarity
- +ritual success chance
- +corpse recovery value
- +damage against observed enemies

### Horror Effects

Examples:

#### Knife That Remembers

High crit chance. Critical hits slightly increase Observation.

#### Lantern of Wrong Signals

More Signals appear. Some are false.

#### Corpse Crown

More damage per stored corpse. Death creates more dangerous corpse events.

#### Redacted Mail

Reduces incoming damage. Hides some enemy information.

## Gear Visuals

Gear visuals should support the dark illustrated art direction:

- worn metal
- cracked masks
- wax-sealed tags
- blackened blades
- ritual thread
- bone charms
- tattered cloth
- ink stains

Avoid cute oversized toy weapons or bright fantasy gear.

---

# 11 — Rituals and Bargains

## Ritual Philosophy

Rituals are not normal upgrades.

They are bargains.

A good ritual should offer power with a consequence.

## Ritual Costs

Possible costs:

- sanity
- health
- max health
- gear sacrifice
- corpse sacrifice
- increased Observation
- stronger Reality Traits
- false signal risk
- debt
- permanent scars

## Ritual Examples

### Blood Tithe

Lose max health. Gain permanent damage.

### Static Communion

Spend sanity to decode a hidden Signal.

### Corpse Lantern

Burn a corpse to reveal a boss weakness.

### Black Offering

Destroy rare gear to gain meta currency.

### False Ascension

Gain major power for one descent. Observation rises sharply.

### Name Removal

Reduce Observation. Lose access to part of profile history or Watcher logs.

## Ritual Presentation

Rituals should be physical interactables in the world:

- altars
- circles
- sealed doors
- hanging ledgers
- blood basins
- wax shrines
- signal pylons

They should not exist only as clean menu buttons.

Menus can summarize rituals, but the ritual should feel located in the world.

---

# 12 — Corpses and Death

## Death Philosophy

Death is not only failure. It is evidence.

When The Marked dies, the Monolith records how and why.

## Corpse Contents

A corpse may contain:

- gear state
- sanity state
- death cause
- survival duration
- ritual scars
- fighting style snapshot
- region location
- Observation data

## Corpse Options

### Recover

Retrieve resources and reduce some risk.

### Burn

Erase part of the evidence, restore sanity, or reduce Observation.

### Devour

Gain power from the previous body, but feed the Monolith useful data.

### Broadcast

Convert the corpse into a Signal or lore fragment.

### Leave

The corpse may return later as an enemy, omen, or world event.

## Corpse Tone

Corpses should feel grim and consequential, not like a cute collectible.

They are remnants of the player’s existence, not just another currency.

## Corpse Frequency

Corpses should be meaningful. Avoid making them so common that death becomes background noise.

---

# 13 — Signals, Broadcasts, and Watcher Whispers

## Signals

Signals are intercepted messages from the world, the Monolith, past subjects, corpses, or corrupted records.

They should provide:

- lore
- warnings
- boss hints
- ritual hints
- false information at low sanity
- observation reports
- region foreshadowing

## Signal Types

### Warning Signal

Hints at a boss, hazard, or Reality Trait.

### Memory Signal

Reveals story fragments.

### False Signal

Appears under low sanity or hostile influence.

### Corpse Signal

Generated from death or corpse choices.

### Watcher Signal

Direct comments from the observing presence.

### Ritual Signal

Hints at hidden ritual outcomes.

## Watcher Whispers

The Watcher should respond to actual player behavior.

Examples:

- “Again, the blade.”
- “You returned by the same door.”
- “The corpse was not forgotten.”
- “Correction noted. Previous model incomplete.”
- “You destroyed evidence. Not all of it.”

## Usage Rule

Watcher whispers should be rare enough to matter.

Do not spam spooky popups. Use them when the game has something specific to say about the player.

---

# 14 — Monolith Progression and Meta Upgrades

## Monolith Level

Monolith Level is the main long-term progression spine.

It determines:

- system unlocks
- enemy scaling
- region access
- gear rarity caps
- signal depth
- ritual complexity
- reality instability
- observation thresholds

## Meta Upgrade Trees

Recommended branches:

### Body

Health, damage, armor, movement resilience.

### Mind

Sanity resistance, false signal detection, Watcher resistance.

### Ritual

Safer rituals, better bargains, new ritual categories.

### Archive

Corpse management, death record manipulation, evidence control.

### Obfuscation

Slows or distorts the Monolith’s understanding of the player.

## Obfuscation Importance

Obfuscation is the player’s counter to being studied.

Examples:

- reduce Observation gain
- hide a gear behavior
- reduce imitation accuracy
- strengthen corpse burning
- mask ritual reliance
- make false Signals easier to detect

## Progression Rule

Progression should create power and exposure together.

The player should often ask:

> “Do I want more strength, or do I want to be harder to understand?”

---

# 15 — Persistent Profiles

## Purpose

Profiles are persistent RPG characters, not just disposable save slots.

Each profile represents one Marked character living in the world.

## UI Terminology

Use:

- **Profile** in technical documentation
- **Character** for clear player-facing menus
- **The Marked** in lore/gameplay
- **Record** when the Monolith or Watcher references saved existence

## Profile Data

Each profile should store:

- character name
- level/progression
- current location
- Monolith level
- gear and inventory
- resources
- sanity state
- rituals performed
- scars and marks
- corpses
- signal discoveries
- death history
- Observation profile
- world state
- quest progress later

## Global Data

Global data may store:

- settings
- accessibility preferences
- total profiles created
- global lore unlocks if desired
- account-wide achievements

Avoid overusing global progression early. Since the game may become a wider RPG, different characters should be able to make different choices.

## Cross-Profile Horror

Optional later:

- old profiles appear as rumors
- abandoned characters become corpse echoes
- Watcher references archived characters
- signals mention prior characters

This should be flavor first, not forced punishment.

---

# 16 — World Regions and Expansion

## World Structure

The game should begin with a physical, walkable region and expand outward.

The world starts constrained but should be designed as a real RPG space from the beginning.

## First Major Region: The Keeping House

The Keeping House is an archive-like horror zone where the Monolith stores evidence of what The Marked does.

Themes:

- records
- debt
- paper
- ink
- wax seals
- witness statements
- erased names
- corrupted bureaucracy
- observation

Enemies may include:

- Cabinet Indexer
- Ink Redactor
- Paper Wraith
- Witness Chair
- Seal Mother

If existing generated assets include these concepts, they should be retained conceptually but redrawn/refined toward the grim illustrated art direction if necessary.

## Future Regions

Examples:

### Ash Fields

Open exterior zone with burned villages, wandering enemies, and ash storms.

### Static Forest

Signal-heavy zone where trees behave like antennas.

### Drowned Cathedral

Sanity and ritual-focused region with flooded halls and submerged bells.

### Bone Market

Merchant/faction hub built from remains, debts, and corpse contracts.

### Watcher’s Road

Long travel region where the Watcher becomes more direct.

### Outer Monolith Ruins

Late-game area where world and dungeon collapse into each other.

## World Expansion Rule

The idle systems should remain relevant as the world expands, but direct exploration should become increasingly important.

---

# 17 — UI / UX Direction

## Platform Assumption

The game is cross-platform, not strictly mobile.

Design for desktop/web first with scalable UI that can later adapt to controller or touch.

## Input Priority

Primary:

- keyboard movement
- mouse interaction
- mouse targeting or clicking

Secondary later:

- controller
- touch controls

## UI Tone

The UI should match the grim illustrated art direction.

Use motifs like:

- worn parchment
- iron frames
- black ink
- wax seals
- red thread
- bone tabs
- carved wood
- candlelit panels
- scratched ledger text

Avoid:

- glossy mobile buttons
- bright reward spam
- cute popups
- bubbly icons
- excessive notification clutter

## Required UI Areas

- character/profile screen
- inventory/gear
- sanity and observation display
- ritual interface
- signal/broadcast log
- corpse management
- Monolith/meta progression
- map/region screen
- settings/accessibility

## UX Rule

Horror flavor must not reduce clarity.

The player should always understand:

- current objective
- current danger
- why sanity changed
- why observation increased
- what a ritual costs
- what gear does
- where to go next

Glitch, distortion, and redaction should be used carefully.

---

# 18 — Asset Pack Rules

## Source of Truth

The generated asset pack may define useful content concepts, such as enemies, props, pickups, VFX, animations, and region themes.

However, the final visual style must follow the updated art direction.

## Content Preservation

Keep useful concepts from existing assets:

- The Marked identity
- archive enemies
- ink/paper/wax/debt motifs
- boss concepts
- pickups and ritual materials
- corpse/record/signal themes

## Style Correction

If an asset looks too chibi, cute, round, toy-like, or mobile-cartoon, revise it.

Revision should preserve:

- identity
- silhouette purpose
- animation role
- gameplay function

Revision should change:

- proportions
- rendering
- shadow depth
- facial tone
- texture
- mood
- color saturation

## Camera Decision

The final camera should be chosen from the full asset set and production pipeline.

Acceptable:

- stylized isometric ARPG
- 2.5D side-angled ARPG
- hybrid illustrated ARPG with depth sorting

Not acceptable:

- static menu-only combat
- chibi idle battler presentation
- fake movement

## Final Art Rule

The asset pack is a draft library. The dark illustrated direction is the art bible.

---

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

---

# 20 — MVP Scope

## MVP Goal

Build a playable vertical slice that proves:

- direct movement works
- combat works in physical spaces
- idle rewards exist
- observation reacts to behavior
- sanity matters
- loot/builds matter
- rituals create scary choices
- the art direction is grim, not chibi

## MVP Region

**The Keeping House**

A cursed archive where the Monolith stores evidence of the player’s behavior.

## MVP Features

### Required

- controllable Marked character
- one walkable zone or room chain
- enemy encounters
- basic combat
- loot drops
- inventory/equip system
- sanity meter
- observation meter
- at least one Signal interaction
- at least one Ritual interaction
- death/corpse creation
- persistent profile save/load
- grim illustrated UI pass

### MVP Enemies

- basic archive enemy
- sanity-pressure enemy
- signal-corruption enemy
- elite witness enemy
- one boss: Seal Mother or equivalent

### MVP Systems

- one Tarot modifier
- one Reality Trait
- three gear rarities minimum
- three rituals minimum
- three corpse actions minimum
- basic idle/offline reward calculation

## Do Not Include in MVP

- full open world
- multiplayer
- huge class roster
- excessive currencies
- 8-direction animation requirement unless assets are ready
- large faction systems
- complex crafting economy

## MVP Success Criteria

The player should understand:

> “I can move, fight, loot, survive, perform rituals, and the world is learning from what I do.”

---

# 21 — Content Roadmap

## Milestone 1 — Movement Vertical Slice

- direct movement
- collision
- interactables
- one room/zone
- player animation integration

## Milestone 2 — Combat Slice

- basic enemies
- attack system
- health/death
- loot drops
- hit reactions

## Milestone 3 — Horror Systems

- sanity
- observation tracking
- Watcher comments
- first Signals
- first Reality Trait

## Milestone 4 — Progression Slice

- gear rarity
- inventory
- meta upgrades
- rituals
- profile persistence

## Milestone 5 — Corpse and Death Slice

- death records
- corpse creation
- corpse recovery/burn/devour
- corpse-based Signals

## Milestone 6 — First Boss

- Seal Mother or equivalent
- boss mechanics tied to records, seals, and observation
- reward/unlock after boss defeat

## Milestone 7 — Art Direction Pass

- remove chibi/cute drift
- refine proportions
- add grim inked rendering
- update UI materials
- unify asset palette

## Milestone 8 — Region Expansion

- second region
- new Reality Traits
- stronger Signals
- advanced gear
- early class/build differentiation

## Long-Term

- larger world map
- open regions
- factions
- advanced bosses
- imitation enemies
- The Shape as major endgame threat
- endgame Veil tiers

---

# 22 — Glossary

## The Marked

The player character. A haunted survivor noticed by the Monolith.

## The Monolith

The central world force. It studies The Marked and mutates reality based on observation.

## The Watcher

The voice or presence that comments on what the Monolith has noticed.

## Observation

The system that tracks how the player lives, fights, moves, survives, dies, and repeats behavior.

## The Witnessed

A state where The Marked has become deeply observed.

## The Mirrored

Imitation enemies or copies made from the player’s behavior.

## The Shape

The Monolith’s complete model of the player.

## Sanity

The mental/perceptual pressure system that affects signals, rituals, reality, and information reliability.

## Tarot

A curse/modifier/diagnostic system that shapes a descent or region.

## Reality Trait

A mutation of the world caused by the Monolith’s experiments.

## Ritual

A physical bargain that grants power at a cost.

## Signal

A broadcast, warning, memory, lie, or field note intercepted from the world.

## Corpse

A data-rich remnant of The Marked after death or collapse.

## The Keeping House

The first major region concept: a cursed archive that stores evidence, debts, signals, names, and records.
