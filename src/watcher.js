// The Watcher: the voice of the Monolith's ledger (GDD 13).
//
// It speaks rarely, and only when it has something specific to say about the player. Lines are chosen from the
// dossier (what the Monolith has actually learned) and from events as they happen (a corpse burned, a bargain
// signed). What it says also depends on the mind it is speaking to: a Stable player hears accurate remarks,
// a Fractured one is lied to, a Broken one is spoken to by name.
//
// Pure logic: the orchestrator owns display, audio and the signal log.

import { habits, favoriteZone, formatClock, ensureDossier, perMinute } from "./dossier.js";

// Seconds of life between whispers, by Observation tier (0 Unseen, 1 Noticed, 2 Studied, 3 Modeled, 4 Known).
// Tier 0 only ever speaks of what the Monolith already remembers from earlier lives.
export const TIER_GAPS = [120, 110, 85, 65, 50];
export const EVENT_GRACE = 6;          // no two whispers closer than this, even for events
export const EVENT_PATIENCE = 40;      // a queued event that has waited this long is no longer worth saying
export const CONTINUITY_FROM = 18;     // seconds into a life before the Watcher mentions the last one

export function tierOf(observation) {
    return observation >= 100 ? 4 : observation >= 75 ? 3 : observation >= 50 ? 2 : observation >= 25 ? 1 : 0;
}

export function watcherState(profile) {
    if (!profile.watcher) profile.watcher = { said: {}, lifeSaid: {}, lastAt: -999, lastCombat: null, corrections: 0 };
    return profile.watcher;
}

const say = (line, c, n) => (typeof line === "function" ? line(c, n) : line);

// ─── What it says about habits ───────────────────────────────────────────────

const habitLines = (id, min, lines, extra = {}) => ({
    id: `habit_${id}`, tier: 1, max: 2, weight: 1.4, when: c => c.strength(id) >= min, text: (c, n) => say(lines[n % lines.length], c, n), ...extra
});

const AMBIENT = [
    habitLines("dasher", 0.5, [
        "Again, the dash. Always at the first sign of weight.",
        c => `Evasion logged: ${Math.round(c.dpm)} a minute. The witnesses are learning your rhythm.`,
        "You step clear half a second early. That half-second is ours now."
    ]),
    habitLines("brawler", 0.5, [
        "Close. You always come in close.",
        "Within arm's reach of every witness. We have measured the arm.",
        "A preference for the short distance. Noted, and filed."
    ]),
    habitLines("kiter", 0.5, [
        "Distance kept. We are counting the steps back.",
        "You do not let them near. They are learning to wait for you.",
        "Retreat is a habit too. The most legible one."
    ]),
    habitLines("critReliant", 0.5, [
        "A fondness for the single decisive strike.",
        "You wait for the clean cut. So do they."
    ]),
    habitLines("lightBound", 0.5, [
        "You keep to the candles. So do we.",
        "Wax and flame: your whole life, drawn inside a radius of ninety paces."
    ]),
    habitLines("sanityLoose", 0.5, [
        "You do not tend your mind. We have noticed.",
        "Hours in the dim. The model of you grows suggestible."
    ]),
    habitLines("routeBound", 0.5, [
        c => `You return to ${c.fav.label}. Always ${c.fav.label}.`,
        c => `The same stones again. A fourth circuit past ${c.fav.label}.`,
        c => c.fav.id === "sealed_zone_door" ? "You returned by the same door." : `Of all this room, you love ${c.fav.label}. We will remember that.`
    ]),
    habitLines("ritualist", 0.5, [
        "You pay in flesh so readily. A debtor's reflex.",
        "Another signature, and the ink still wet on the last."
    ]),
    habitLines("signalReader", 0.5, [
        "You read everything we send. How trusting."
    ]),
    habitLines("preserver", 0.6, [
        "The corpse was not forgotten. Neither were you."
    ]),
    habitLines("burner", 0.6, [
        "You destroyed evidence. Not all of it.",
        "Ash is also a record."
    ]),
    habitLines("devourer", 0.6, [
        "You feed on yourself. A closed circuit, and a very legible one."
    ]),
    habitLines("broadcaster", 0.6, [
        "Your deaths, transmitted. We are grateful for the contribution."
    ]),

    // It cannot read a player who keeps changing
    { id: "unreadable", tier: 2, max: 1, weight: 1.2, when: c => c.hs.length === 0 && c.life > 150,
      text: () => "We cannot read you. This is new. We are interested." },

    // The dead are remembered
    { id: "corpse_near", tier: 1, max: 1, weight: 1.6, when: c => c.nearCorpse, text: () => "The corpse was not forgotten." },
    { id: "last_death", tier: 0, max: 1, weight: 3, when: c => c.last && c.life > CONTINUITY_FROM && c.life < 150,
      text: c => `Last time: ${c.last.cause.charAt(0).toLowerCase() + c.last.cause.slice(1)}, at ${formatClock(c.last.seconds)}. We kept the body.` },
    { id: "same_killer", tier: 0, max: 1, weight: 3.4,
      when: c => c.history.length >= 2 && c.history[0].killer && c.history[0].killer === c.history[1].killer && c.life > 40 && c.life < 240,
      text: c => `${c.history[0].killer}. Again. It is in your model now.` },
    { id: "outlived", tier: 0, max: 1, weight: 2, when: c => c.last && c.life > c.last.seconds + 15 && c.life < c.last.seconds + 240,
      text: () => "Longer than last time. A subject is worth more read slowly." },

    // A mind losing its footing: lied to, then spoken to by name
    { id: "false_door", kind: "false", tier: 0, max: 1, weight: 3, when: c => c.sanity < 40 && c.sanity >= 15, text: () => "The door is open. Go on." },
    { id: "false_behind", kind: "false", tier: 0, max: 1, weight: 3, when: c => c.sanity < 40 && c.sanity >= 15, text: () => "Someone is standing behind you. Do not turn." },
    { id: "false_wound", kind: "false", tier: 0, max: 1, weight: 2, when: c => c.sanity < 40 && c.sanity >= 15, text: () => "Your wound has closed. Look again." },
    { id: "broken_name", kind: "watcher", tier: 0, max: 2, weight: 5, when: c => c.sanity < 15, text: (c, n) => n === 0 ? `${c.name}. Look at me, ${c.name}.` : `We have your name, ${c.name}. We have kept it warm.` },
    { id: "broken_paper", kind: "watcher", tier: 0, max: 1, weight: 4, when: c => c.sanity < 15, text: () => "You were dead some time ago. We are only waiting for the paperwork." },

    // Filler, kept rare and only once the Monolith is paying attention
    { id: "filler_a", tier: 2, max: 1, weight: 0.5, when: () => true, text: () => "Subject remains mobile. Velocity profile updated." },
    { id: "filler_b", tier: 2, max: 1, weight: 0.5, when: () => true, text: () => "The record grows. It is a good record." }
];

// ─── What it says the moment something happens ──────────────────────────────

const EVENTS = {
    burn: ["You destroyed evidence. Not all of it.", "Ash is also a record."],
    recover: ["The corpse was not forgotten.", "You come back for what you left. How sentimental. How predictable."],
    broadcast: ["Transmitted. Your death is public record now."],
    devour: ["You fed on yourself. We kept the receipt."],
    ritual: ["Bargains accepted. They exchange flesh for fleeting authority.", "Signed. The ink does not dry. It waits."],
    low_health: ["Flesh at a quarter. We record this with interest."],
    boss_wake: ["She filed you first, long before the lantern was lit."],
    boss_down: ["The seal is broken. The record is not."],
    confrontation: [c => `Ten minutes alive. That is long enough to be read. Witnesses are sent.`],
    sanity_fractured: ["Your hands are not steady."],
    adapt: ["What you do most, we have taught the room to expect.", "Your habits have been put to work."],
    corpse_rose: ["Your body stands. We did not make it stand; we only declined to stop it."],
    tier1: ["There. The outline of you. I see you now."],
    tier2: ["Your habits have begun to rhyme. The room has noticed."],
    tier3: ["A working model. Imperfect, but it walks."],
    tier4: ["Complete. Stand still a moment, so the copy can be taken."]
};
const EVENT_PRIORITY = { tier1: 3, tier2: 3, tier3: 3, tier4: 3, boss_wake: 2, boss_down: 2 };

export class Watcher {
    constructor() {
        this.queue = [];
    }

    // An event worth remarking on. `data.at` is life seconds (filled in by update if missing).
    notify(kind, data = {}) {
        if (EVENTS[kind]) this.queue.push({ kind, data, at: null });
    }

    resetLife(profile) {
        const st = watcherState(profile);
        st.lifeSaid = {};
        st.lastAt = -999;
        st.corrections = 0;
        this.queue.length = 0;
    }

    // ctx: { life (s), observation, sanity, mask (0..1), gapMult, nearCorpse }
    // Returns { id, text, kind } or null. Call about twice a second.
    update(profile, ctx) {
        const st = watcherState(profile);
        ensureDossier(profile);
        const c = this.context(profile, ctx);
        const since = c.life - st.lastAt;

        // 1. Things that just happened. A tier crossing outranks everything but the minimum grace.
        for (const ev of this.queue) if (ev.at === null) ev.at = c.life;
        this.queue = this.queue.filter(ev => c.life - ev.at <= EVENT_PATIENCE);
        if (this.queue.length && since >= EVENT_GRACE) {
            this.queue.sort((a, b) => (EVENT_PRIORITY[b.kind] || 0) - (EVENT_PRIORITY[a.kind] || 0));
            const ev = this.queue.shift();
            const id = `event_${ev.kind}`;
            const lines = EVENTS[ev.kind];
            const n = st.said[id] || 0;
            return this.commit(st, c, { id, kind: "watcher", text: say(lines[n % lines.length], c, n) });
        }

        // 2. The model was wrong: the player changed how they fight
        const top = habits(profile, c.mask).find(h => h.group === "combat");
        if (top && top.strength >= 0.55) {
            if (st.lastCombat && st.lastCombat !== top.id && st.corrections < 2 && since >= EVENT_GRACE) {
                st.lastCombat = top.id;
                st.corrections++;
                return this.commit(st, c, { id: "correction", kind: "watcher", text: st.corrections === 1 ? "Correction noted. Previous model incomplete." : "That was not in the file. Revising." });
            }
            if (!st.lastCombat) st.lastCombat = top.id;
        }

        // 3. Ambient remarks, on the tier's schedule
        const gap = TIER_GAPS[c.tier] * (ctx.gapMult || 1);
        if (since < gap) return null;
        const pool = AMBIENT.filter(a => a.tier <= c.tier && (st.lifeSaid[a.id] || 0) < (a.max || 1) && a.when(c));
        // A Broken mind is spoken to personally and a Fractured one is lied to; both crowd out the ordinary remarks
        const tell = pool.some(a => a.kind === "false" || a.id.startsWith("broken")) ? pool.filter(a => a.kind === "false" || a.id.startsWith("broken")) : pool;
        if (!tell.length) return null;
        const weight = a => (a.weight || 1) / (1 + (st.said[a.id] || 0) * 0.6);
        let roll = Math.random() * tell.reduce((s, a) => s + weight(a), 0);
        const chosen = tell.find(a => (roll -= weight(a)) < 0) || tell[tell.length - 1];
        return this.commit(st, c, { id: chosen.id, kind: chosen.kind || "watcher", text: chosen.text(c, st.lifeSaid[chosen.id] || 0) });
    }

    commit(st, c, w) {
        st.lastAt = c.life;
        st.said[w.id] = (st.said[w.id] || 0) + 1;
        st.lifeSaid[w.id] = (st.lifeSaid[w.id] || 0) + 1;
        return w;
    }

    context(profile, ctx) {
        const hs = habits(profile, ctx.mask || 0);
        const history = profile.deathHistory || [];
        return {
            life: ctx.life, sanity: ctx.sanity, mask: ctx.mask || 0, nearCorpse: !!ctx.nearCorpse,
            tier: tierOf(ctx.observation), name: profile.name, hs,
            strength: id => (hs.find(h => h.id === id) || { strength: 0 }).strength,
            fav: favoriteZone(profile), dpm: perMinute(profile, "dashes"),
            history, last: history[0] || null
        };
    }
}
