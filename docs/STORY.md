# The Marked: story bible

The story is not told to the player; it is **found**, a page at a time, by playing the systems the game is about. Each Ledger
page unlocks from something the player did, so what you have read says what you have done. The text lives in
`src/lore.js`; the rules that unlock it are in `unlockFor`.

## The arc, in one breath

The Keeping House was a **cathedral** that turned confession into **debt**. Its clerks (the Keepers) wrote down every sin, and a sin
entered became a debt that could be collected; by the third generation everyone in the parish owed. When the sum exceeded the
living, the **Monolith** rose in the nave. It does not construct. It **answers ledgers**: where a name is written in the margin it
writes the rest of that person beneath it, always correctly and never finished. What it produces from a subject who endures is a
**Witness**, a record that has begun to move. Witnesses pay what the originals could not, so the Keepers stopped asking where they
came from.

The **Registrar-Matron** (the **Seal Mother**) alone understood: a name written often enough becomes a person made of paper, and a person
made of paper has no reason to stay. She sealed every door and then sealed herself into the lock. **The seal is a closed hand, not
a raised one.** She is not guarding the House from the world; she is guarding the world from the Register. She wakes at 75%
Observation because you are about to be *finished*, and she fights to keep you unwritten.

The **Watcher** is the first subject the Monolith ever completed: a voice with no mouth, narrating the others. It is not the enemy; it is
*further along*. **The Shape** is the Monolith's attempt to complete *you*. The **Marked** who died before are the margins now;
when one rises it is not hunting you, it is completing itself, and you are the nearest page.

An unfinished thing can be written *out*. Not killed: removed. What a hand has written, a hand may strike. The strike is made at
the altar, by the one who is written, and it costs everything the ledger holds of them.

## What the story is for

| Mechanic | Story reason |
| --- | --- |
| Observation / being Known | The Monolith is completing a record of you. Known means finished, and a finished record has no use for its original. |
| Observation 75% wakes the Seal Mother | She wakes to stop you being finished. |
| Habits learned and used against you | A Witness is a record that has begun to move; it is consistent, which is worse than cruel. |
| Obfuscation | You are not hidden, only less legible: a record with no pattern cannot be finished. |
| Your corpses | Earlier drafts of you. They are filed; sometimes they stand. |
| Debt Gold | What is left of a person after the House has taken its share. |
| The Watcher lies to a Fractured mind | Reception fails; the Monolith fills the gap with plausible lies. |

## The Ledger (13 pages and a last entry)

| # | Page | Earned by |
| --- | --- | --- |
| I-IV | The Nave, The Absolution Register, What Was Owed, The Keepers | Static Communion at the altar, in order. Once all four are read, it offers warnings instead. Under Static Sky one decodes itself every two minutes. |
| V | The Stone Answers | Being **Noticed** (25%) |
| VI | It Mirrors | Being **Studied** (50%) |
| VII | Witnesses | Being **Modeled** (75%) |
| VIII | The Matron | The Seal Mother waking |
| IX | Wax | Defeating the Seal Mother |
| X | The First Marked | Putting down a risen corpse |
| XI | The Reader | Being **Known** (100%) |
| XII | The Door | Escaping once |
| XIII | Unfinished | Escaping a second time |
| XIV | The Name | The **last entry**: offered at the altar once every page is held. Striking your name closes the record and retires the profile. |

## Voices

* **The Watcher** (`src/watcher.js`): clinical, courteous, specific. Speaks rarely, only about what it has seen. Accurate to a Stable mind,
  lies to a Fractured one, uses your name when you are Broken.
* **The Seal Mother** (`MATRON_LINES`): plain and tired, at the turns of her fight. *"Not yet. You are not finished. Let me keep you."*
  *"Stay unwritten. Please."* *"Then be read. See what it does to you."* *"The door is open. Go, before it finishes you."*
* **Warnings** (`WARNINGS` / `FALSE_WARNINGS`): the pylon's free hints are true when your mind is clear and plausibly false when it is not;
  high Signal Clarity lets you tell which. Warnings are weighted toward whatever the Monolith is currently using against you.
* **Corpse signals**: a broadcast corpse speaks in the voice of what killed it.

## Ending

> The stroke lands. The ink does not run: it lifts, as if relieved. For the first time the House is silent. You are not read.
> You are not written. You are only here. The Monolith waits to be answered, and finds no one to mirror. In the margins a voice
> that never had a mouth says: *thank you.* And then, because it has never said anything else without being asked: *what was my name?*

## Not yet written

The next regions (Ash Fields, Static Forest, Drowned Cathedral...) should answer what lies beyond the door the Matron opens. The
natural thread: the Register did not stop at the House. Where did the Keepers' Witnesses go?
