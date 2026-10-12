// How the Monolith uses what it has learned (GDD 07 thresholds, GDD 09 "personalised pressure").
//
// From Studied (50%) the strongest habits that have a counter are turned against the player; Modeled (75%) widens that
// to two at full strength and Known (100%) to three. Each counter is something the player can see happen, has a
// telegraph, and can be avoided, and Obfuscation or simply playing differently weakens it. The engine owns what a counter
// does (engine.counters); this module only decides which are live and how hard.

import { habits } from "./dossier.js";
import { tierOf } from "./watcher.js";

export const COUNTER_INFO = {
    dasher: { name: "Baited dashes", blurb: "Witnesses wind up as you dash, then lunge to where you land." },
    kiter: { name: "Led shots", blurb: "Witnesses aim where you are going and close distance faster." },
    brawler: { name: "Slams", blurb: "Standing at arm's length draws a telegraphed slam." },
    critReliant: { name: "Burst armour", blurb: "No single blow can take more than a share of a witness's flesh." },
    ritualist: { name: "Bargain traps", blurb: "Lingering at the altar draws wax traps beneath your feet." },
    lightBound: { name: "Snuffed flames", blurb: "The candles near you are put out for a time." }
};

// How many counters are live, and how much of the habit's strength they carry, by Observation tier
export const COUNTER_TIERS = { 2: { count: 1, scale: 0.6 }, 3: { count: 2, scale: 1.0 }, 4: { count: 3, scale: 1.15 } };
export const MAX_POWER = 1.2;

// -> { habitId: power } with power in (0, MAX_POWER]
export function activeCounters(profile, observation, mask = 0) {
    const t = COUNTER_TIERS[tierOf(observation)];
    if (!t) return {};
    const out = {};
    for (const h of habits(profile, mask).filter(h => COUNTER_INFO[h.id]).slice(0, t.count)) {
        out[h.id] = Math.min(MAX_POWER, h.strength * t.scale);
    }
    return out;
}
