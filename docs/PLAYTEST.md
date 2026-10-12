# Playtesting with bots

`tools/playtest/run.js` plays the **real** engine, observation, sanity, dossier, Watcher, counters and Ledger code headlessly
for simulated hours (about 1 s of wall time per game hour), with bots that mirror the orchestrator's per-tick loop. It is how the
numbers below were chosen, and how to check a balance change before it ships.

```bash
npm run playtest -- --minutes 120 --seeds 3 --skill 1                 # all five bots
npm run playtest -- --policy brawler --stay                           # greedy: keep farming after the boss, to meet Known
npm run playtest -- --policy dasher --boss 80,0.045,0.045            # sweep the Seal Mother's scaling
```

Bots: `brawler` (walks into the nearest witness), `kiter` (ranged class, keeps its distance), `dasher` (closes in, dashes whenever
pressed), `varied` (switches style every 30 s), `lightbound` (fights from the nearest candle). They never read the Watcher or the
Dossier, equip better gear and spend currencies as a sensible player would, and always take the open door unless `--stay`.

**Always compare `--skill 1` (sidesteps incoming shots) with `--skill 0` (never dodges).** A bot that cannot dodge is a worst case, not
a typical player; tuning to it makes the game soft for everyone who can.

## What it found, and what was done

| Finding | Evidence | Decision |
| --- | --- | --- |
| Sanity looked broken | A non-dodging melee bot is Broken in under a minute (shots cost 12 and 7, shards drop later). | **Left alone.** With reflexes the same values keep a brawler Stable for ~10 minutes and Fractured late, in about half of descents. The attackers are sanity-pressure enemies on purpose. Cutting the values to fit the worst-case bot would have made sanity irrelevant for everyone else. The values are now named in `SANITY_HIT`. |
| The Seal Mother was a five-second formality | Median fight 5 s, 4% of the player's flesh, beaten in 27 of 28 lives. Gear damage scales far faster than a fixed boss. | Her flesh is now `80 ×` the player's damage and each strike and seal is `4.5%` of the player's flesh (never below the old numbers). Median fight 41-65 s, the player takes about half their flesh, 10-25% of bot attempts fail. All three phases now matter. |
| The brawler habit never read | 1 of 28 lives. Half the roster hovers at range, so "share of time at arm's length" measured enemy AI, not the player. | Approach and retreat are read from the **player's own velocity** along the line to the nearest enemy, not from distances that enemies change themselves. Every bot is now countered by its own style (brawler -> slams, kiter -> led shots, dasher -> baited dashes, light-hugger -> snuffed flames). |
| The Watcher was chatty | 0.8-1.1 whispers a minute, mostly events. | Ambient gaps lengthened (150/135/105/80/60 s). Event lines (tier crossings, the boss) are kept: they are rare by nature. |
| Known (100%) was never reached | Bots always left after the boss. | `--stay` shows Known in 53-73% of greedy lives; The Shape becomes the largest damage source, as intended. All 13 Ledger pages are collectable in a handful of lives. |

## Not measured

Real players, rituals (the bots never sign them), the altar's page decoding (bots only get pages from Static Sky), and feel.
