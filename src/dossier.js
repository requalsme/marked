// The Monolith's dossier on the player (GDD 07 / non-negotiable 5).
//
// Observation is not only a bar. While the player lives, the Monolith keeps a behavioral
// record: how they fight, where they linger, what they do with the dead. Habits are read
// out of that record, shown to the player as a diagnosis, spoken back by the Watcher
// (watcher.js) and, once the Monolith has Studied them, used against them (adapt.js).
//
// The record survives death: each finished life is folded into `memory` with decay, so a
// veteran's reputation precedes them while a changed player can outgrow it.

import { ROOM } from "./world.js";

export const MEMORY_DECAY = 0.6;      // share of older lives that survives into the next
export const MEMORY_WEIGHT = 0.5;     // how loudly remembered lives count against the current one
export const HABIT_THRESHOLD = 0.35;  // below this a habit is noise, not a pattern
export const DEATH_HISTORY_LIMIT = 12;

// Distance bands (px) between the player and the nearest living enemy
export const MELEE_RANGE = 70;
export const MID_RANGE = 170;
const NEAR_ENEMY_FOR_RETREAT = 160;
export const MOVE_TOWARD = 1.5;     // px/tick of the player's own motion toward or away from the nearest enemy
export const ENGAGE_RANGE = 260;   // an enemy farther than this is not part of the fight
const ZONE_RADIUS = 230;

const SCALARS = [
    "secs", "engaged", "melee", "mid", "far", "retreat", "approach", "lit", "dark", "lowSanity",
    "dashes", "attacks", "hits", "crits", "rituals", "signalsRead",
    "recover", "burn", "broadcast", "devour", "damageTaken"
];
const MAPS = ["zone", "kills", "hurtBy"];

function blank() {
    const d = {};
    for (const k of SCALARS) d[k] = 0;
    for (const k of MAPS) d[k] = {};
    return d;
}

// Places the player can be said to be "at"
const LANDMARKS = [
    ...ROOM.interactables.map(i => ({ ...i, id: i.type })),
    { type: "monolith", id: "monolith", x: ROOM.obstacles[0].x, y: ROOM.obstacles[0].y }
];
const ZONE_LABELS = {
    blood_ritual_altar: "the altar",
    static_signal_pylon: "the pylon",
    corpse_lantern_shrine: "the lantern shrine",
    wax_record_chest: "the wax chest",
    sealed_zone_door: "the sealed door",
    monolith: "the Monolith"
};

export function zoneAt(x, y) {
    let best = null, bd = ZONE_RADIUS;
    for (const l of LANDMARKS) {
        const d = Math.hypot(x - l.x, y - l.y);
        if (d < bd) { bd = d; best = l.id; }
    }
    return best || "open_floor";
}

export function zoneLabel(id) {
    return ZONE_LABELS[id] || "the open floor";
}

export function ensureDossier(profile) {
    if (!profile.dossier) profile.dossier = { life: blank(), memory: blank(), lives: 0 };
    // records written before a counter existed gain it at zero
    for (const rec of [profile.dossier.life, profile.dossier.memory]) {
        for (const k of SCALARS) if (typeof rec[k] !== "number") rec[k] = 0;
        for (const k of MAPS) if (!rec[k]) rec[k] = {};
    }
    if (!profile.deathHistory) profile.deathHistory = [];
    return profile.dossier;
}

// Transient per-profile sampling state (never saved)
const transient = new WeakMap();

// ─── Recording ───────────────────────────────────────────────────────────────

// Called every simulation step with the dt in seconds
export function sampleDossier(profile, engine, dt) {
    const d = ensureDossier(profile).life;
    const p = engine.player;
    if (!p || p.health <= 0) return;
    d.secs += dt;
    if (p.sanity < 40) d.lowSanity += dt;

    // Light: the same test the sanity system uses
    let lit = false;
    for (const c of engine.canvasRenderer ? engine.canvasRenderer.candles : []) {
        if (c.snuffed) continue;
        if (Math.hypot(p.x - c.x, p.y - c.y) < 90 * c.intensity) { lit = true; break; }
    }
    if (lit) d.lit += dt; else d.dark += dt;

    const z = zoneAt(p.x, p.y);
    d.zone[z] = (d.zone[z] || 0) + dt;

    // Engagement: where the player stands relative to the nearest living enemy
    let nearest = Infinity, target = null;
    for (const e of engine.enemies) {
        if (e.health <= 0) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearest) { nearest = d; target = e; }
    }
    const t = transient.get(profile) || {};   // (kept for future per-profile sampling state)
    if (nearest < ENGAGE_RANGE) {
        d.engaged += dt;
        if (nearest < MELEE_RANGE) d.melee += dt;
        else if (nearest < MID_RANGE) d.mid += dt;
        else d.far += dt;
        // Choosing to close in or to back away is the habit; where the enemies happen to hover (or walk) is not.
        // So read the player's own velocity along the line to the nearest enemy.
        const toward = ((p.vx * (target.x - p.x)) + (p.vy * (target.y - p.y))) / Math.max(1, nearest);
        if (toward > MOVE_TOWARD && nearest > MELEE_RANGE * 0.6) d.approach += dt;
        else if (toward < -MOVE_TOWARD && nearest < NEAR_ENEMY_FOR_RETREAT) d.retreat += dt;
    }
    t.nearest = nearest < ENGAGE_RANGE ? nearest : undefined;
    transient.set(profile, t);
}

export function recordEvent(profile, kind, data = {}) {
    const d = ensureDossier(profile).life;
    switch (kind) {
        case "dash": d.dashes++; break;
        case "attack": d.attacks++; break;
        case "hit": d.hits++; if (data.crit) d.crits++; break;
        case "kill": d.kills[data.type] = (d.kills[data.type] || 0) + 1; break;
        case "hurt":
            d.damageTaken += data.amount || 0;
            if (data.source) d.hurtBy[data.source] = (d.hurtBy[data.source] || 0) + (data.amount || 0);
            break;
        case "ritual": d.rituals++; break;
        case "signal": d.signalsRead++; break;
        case "corpse": if (d[data.action] !== undefined) d[data.action]++; break;
        default: break;
    }
}

// ─── Reading ─────────────────────────────────────────────────────────────────

// The life so far plus a fading echo of earlier ones
function tally(profile) {
    const { life, memory } = ensureDossier(profile);
    const t = blank();
    for (const k of SCALARS) t[k] = life[k] + memory[k] * MEMORY_WEIGHT;
    for (const k of MAPS) {
        for (const src of [[life, 1], [memory, MEMORY_WEIGHT]]) {
            for (const [id, v] of Object.entries(src[0][k])) t[k][id] = (t[k][id] || 0) + v * src[1];
        }
    }
    return t;
}

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const ramp = (v, from, to) => clamp((v - from) / (to - from));

// A rate over the life so far plus the fading echo of earlier ones (e.g. dashes a minute)
export function perMinute(profile, key) {
    const t = tally(profile);
    return t.secs > 0 ? t[key] / (t.secs / 60) : 0;
}

export function favoriteZone(profile) {
    const t = tally(profile);
    let total = 0, best = null, bv = 0;
    for (const [id, v] of Object.entries(t.zone)) {
        total += v;
        if (id !== "open_floor" && v > bv) { bv = v; best = id; }
    }
    return { id: best, label: zoneLabel(best), share: total > 0 ? bv / total : 0, seconds: total };
}

export const HABITS = {
    dasher:      { group: "combat", label: "Dash-reliant",       blurb: "Leans on the dash to escape trouble." },
    brawler:     { group: "combat", label: "Aggressive",         blurb: "Fights at arm's length." },
    kiter:       { group: "combat", label: "Evasive",            blurb: "Keeps backing away from the nearest witness." },
    critReliant: { group: "combat", label: "Burst-reliant",      blurb: "Wins by landing a few decisive strikes." },
    lightBound:  { group: "body",   label: "Light-bound",        blurb: "Rarely leaves the candlelight." },
    sanityLoose: { group: "body",   label: "Sanity-neglectful",  blurb: "Spends long stretches with a fractured mind." },
    routeBound:  { group: "body",   label: "Route-bound",        blurb: "Keeps returning to the same place." },
    ritualist:   { group: "system", label: "Ritual-dependent",   blurb: "Signs bargains readily." },
    signalReader:{ group: "system", label: "Signal-reliant",     blurb: "Reads every transmission." },
    preserver:   { group: "system", label: "Corpse-preserving",  blurb: "Recovers its dead." },
    burner:      { group: "system", label: "Evidence-burning",   blurb: "Burns its dead." },
    devourer:    { group: "system", label: "Self-devouring",     blurb: "Feeds on its own corpses." },
    broadcaster: { group: "system", label: "Broadcast-prone",    blurb: "Transmits its deaths." }
};

const READERS = {
    dasher: t => t.secs >= 45 ? ramp(t.dashes / (t.secs / 60), 0.5, 3.5) : 0,
    // Fights up close, or keeps walking in to do it
    brawler: t => t.engaged >= 25 ? Math.max(ramp(t.melee / t.engaged, 0.25, 0.65), ramp(t.approach / t.engaged, 0.30, 0.60)) : 0,
    kiter: t => t.engaged >= 25 ? ramp(t.retreat / t.engaged, 0.05, 0.25) : 0,
    critReliant: t => t.hits >= 25 ? ramp(t.crits / t.hits, 0.12, 0.42) : 0,
    lightBound: t => t.lit + t.dark >= 40 ? ramp(t.lit / (t.lit + t.dark), 0.5, 0.9) : 0,
    sanityLoose: t => t.secs >= 60 ? ramp(t.lowSanity / t.secs, 0.2, 0.6) : 0,
    // Only named places count: standing about on the open floor is not a route
    routeBound: t => {
        const total = Object.values(t.zone).reduce((a, b) => a + b, 0);
        const top = Math.max(0, ...Object.entries(t.zone).filter(([id]) => id !== "open_floor").map(([, v]) => v));
        return total >= 60 ? ramp(top / total, 0.35, 0.7) : 0;
    },
    ritualist: t => ramp(t.rituals, 0.5, 3),
    signalReader: t => ramp(t.signalsRead, 0.5, 4),
    preserver: t => corpseShare(t, "recover"),
    burner: t => corpseShare(t, "burn"),
    devourer: t => corpseShare(t, "devour"),
    broadcaster: t => corpseShare(t, "broadcast")
};

// A corpse habit needs both volume (a few acts) and a clear preference (most of them)
function corpseShare(t, kind) {
    const total = t.recover + t.burn + t.broadcast + t.devour;
    if (total < 1) return 0;
    return ramp(total, 0.5, 3) * ramp(t[kind] / total, 0.4, 0.8);
}

// Every habit above the noise floor, strongest first. `mask` (0..1) is how well the player
// hides themselves (Obfuscation): it shrinks every reading, so a masked player reads as vague.
export function habits(profile, mask = 0) {
    const t = tally(profile);
    const out = [];
    for (const [id, read] of Object.entries(READERS)) {
        const strength = read(t) * (1 - clamp(mask, 0, 0.85));
        if (strength >= HABIT_THRESHOLD) out.push({ id, strength, ...HABITS[id] });
    }
    return out.sort((a, b) => b.strength - a.strength);
}

export function topHabit(profile, group, mask = 0) {
    return habits(profile, mask).find(h => !group || h.group === group) || null;
}

// How well the player's gear and upgrades hide them (0 = fully legible)
export function obfuscationMask(profile, stats = {}) {
    const upgrades = (profile.upgrades && profile.upgrades.obfuscation) || 0;
    return clamp(upgrades * 0.06 + (stats.obfuscation || 0), 0, 0.85);
}

// "Diagnosis: Aggressive / Ritual-dependent" (GDD 07). Varied play reads as Inconclusive.
export function diagnose(profile, mask = 0) {
    const t = tally(profile);
    if (t.secs < 60) return "Diagnosis: Unread / Fresh";
    const hs = habits(profile, mask);
    const a = hs.find(h => h.group === "combat");
    const b = hs.find(h => h.group !== "combat");
    if (!a && !b) return "Diagnosis: Inconclusive / Adapting";
    return `Diagnosis: ${a ? a.label : "Unpatterned"} / ${b ? b.label : "Gear-dependent"}`;
}

// ─── Lives ───────────────────────────────────────────────────────────────────

// Fold the finished life into memory (with decay) and start a clean one. Returns the life.
export function closeLife(profile) {
    const dos = ensureDossier(profile);
    const finished = dos.life;
    for (const k of SCALARS) dos.memory[k] = dos.memory[k] * MEMORY_DECAY + finished[k];
    for (const k of MAPS) {
        const next = {};
        for (const [id, v] of Object.entries(dos.memory[k])) next[id] = v * MEMORY_DECAY;
        for (const [id, v] of Object.entries(finished[k])) next[id] = (next[id] || 0) + v;
        dos.memory[k] = next;
    }
    dos.life = blank();
    dos.lives++;
    return finished;
}

// A finished life becomes evidence the Watcher can quote next time
export function recordDeath(profile, { cause, killer, seconds, observation, level }) {
    ensureDossier(profile);
    profile.deathHistory.unshift({ cause, killer: killer || null, seconds: Math.round(seconds), observation: Math.round(observation), level, at: Date.now() });
    if (profile.deathHistory.length > DEATH_HISTORY_LIMIT) profile.deathHistory.length = DEATH_HISTORY_LIMIT;
}

export function formatClock(seconds) {
    const s = Math.max(0, Math.round(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
