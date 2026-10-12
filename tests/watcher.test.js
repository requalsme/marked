import test from "node:test";
import assert from "node:assert/strict";
import { makeWorld, seedRandom } from "./helpers.js";
import { Watcher, tierOf, watcherState, TIER_GAPS, EVENT_GRACE, EVENT_PATIENCE } from "../src/watcher.js";
import { recordEvent, sampleDossier, recordDeath } from "../src/dossier.js";

const ctx = (over = {}) => ({ life: 100, observation: 30, sanity: 100, mask: 0, gapMult: 1, nearCorpse: false, ...over });

// Give the dossier enough of a dash habit to be read
function dasher(w) {
    for (let i = 0; i < 90 * 60; i++) sampleDossier(w.profile, w.engine, 1 / 60);
    for (let i = 0; i < 6; i++) recordEvent(w.profile, "dash");
}

test("tiers follow the Observation thresholds", () => {
    assert.deepEqual([0, 24.9, 25, 50, 75, 100].map(tierOf), [0, 0, 1, 2, 3, 4]);
});

test("an Unseen player hears nothing ordinary, however long they live", () => {
    const w = makeWorld(); const wt = new Watcher();
    dasher(w);
    assert.equal(wt.update(w.profile, ctx({ life: 500, observation: 10 })), null);
});

test("a noticed dasher is told so, then left alone until the tier's gap has passed", () => {
    const restore = seedRandom(5);
    const w = makeWorld(); const wt = new Watcher();
    dasher(w);
    const first = wt.update(w.profile, ctx({ life: 200, observation: 30 }));
    assert.ok(first && /dash|Evasion|half-second/i.test(first.text), first && first.text);
    assert.equal(wt.update(w.profile, ctx({ life: 200 + TIER_GAPS[1] - 1, observation: 30 })), null, "too soon");
    restore();
});

test("the same remark is not repeated beyond its allowance in one life", () => {
    const restore = seedRandom(9);
    const w = makeWorld(); const wt = new Watcher();
    dasher(w);
    const said = [];
    for (let t = 200; t < 200 + 12 * TIER_GAPS[1]; t += 5) {
        const r = wt.update(w.profile, ctx({ life: t, observation: 30 }));
        if (r) said.push(r.id);
    }
    restore();
    assert.ok(said.length >= 1);
    for (const id of new Set(said)) assert.ok(said.filter(x => x === id).length <= 2, `${id} repeated`);
});

test("events are spoken at once (after the grace), in priority order, and expire if ignored", () => {
    const w = makeWorld(); const wt = new Watcher();
    wt.notify("burn"); wt.notify("tier2");
    const r = wt.update(w.profile, ctx({ life: 60, observation: 55 }));
    assert.equal(r.id, "event_tier2", "a tier crossing outranks a corpse event");
    assert.equal(wt.update(w.profile, ctx({ life: 60 + EVENT_GRACE - 1, observation: 55 })), null, "grace between whispers");
    const burn = wt.update(w.profile, ctx({ life: 60 + EVENT_GRACE, observation: 55 }));
    assert.match(burn.text, /evidence|Ash/);
});

test("an event that cannot be spoken in time is dropped rather than said late", () => {
    const w = makeWorld(); const wt = new Watcher();
    wt.notify("tier1");
    assert.ok(wt.update(w.profile, ctx({ life: 60, observation: 30 })));          // speaks, starting the grace
    wt.notify("ritual");
    assert.equal(wt.update(w.profile, ctx({ life: 61, observation: 30 })), null);  // inside the grace: stays queued, stamped at 61
    assert.equal(wt.update(w.profile, ctx({ life: 61 + EVENT_PATIENCE + 1, observation: 30 })), null, "too late to be worth saying");
    assert.equal(wt.queue.length, 0);
});

test("a fresh life remembers the last death, and a repeat killer is called out", () => {
    const restore = seedRandom(2);
    const w = makeWorld(); const wt = new Watcher();
    recordDeath(w.profile, { cause: "Felled by Paper Wraith", killer: "Paper Wraith", seconds: 312, observation: 40, level: 3 });
    wt.resetLife(w.profile);
    const r = wt.update(w.profile, ctx({ life: 20, observation: 0 }));
    assert.match(r.text, /Last time: felled by paper wraith, at 5:12/i);
    recordDeath(w.profile, { cause: "Felled by Paper Wraith", killer: "Paper Wraith", seconds: 100, observation: 20, level: 3 });
    wt.resetLife(w.profile);
    const seen = new Set();
    for (let t = 41; t < 600; t += 20) { const q = wt.update(w.profile, ctx({ life: t, observation: 0 })); if (q) seen.add(q.id); }
    restore();
    assert.ok(seen.has("same_killer"));
});

test("a Fractured player is lied to; a Broken one is spoken to by name", () => {
    const restore = seedRandom(4);
    const w = makeWorld(); const wt = new Watcher();
    const fractured = wt.update(w.profile, ctx({ life: 200, observation: 5, sanity: 30 }));
    assert.equal(fractured.kind, "false");
    const w2 = makeWorld(); const wt2 = new Watcher();
    w2.profile.name = "Maren";
    const broken = wt2.update(w2.profile, ctx({ life: 200, observation: 5, sanity: 10 }));
    restore();
    assert.equal(broken.kind, "watcher");
    assert.match(broken.text, /Maren|paperwork/);
});

test("changing how you fight draws a correction, once per change", () => {
    const restore = seedRandom(6);
    const w = makeWorld(); const wt = new Watcher();
    watcherState(w.profile).lastCombat = "brawler";        // what the Monolith believed
    dasher(w);                                             // what the player now does
    const r = wt.update(w.profile, ctx({ life: 300, observation: 30 }));
    restore();
    assert.equal(r.id, "correction");
    assert.match(r.text, /Correction noted/);
    assert.equal(watcherState(w.profile).lastCombat, "dasher");
    assert.notEqual((wt.update(w.profile, ctx({ life: 300 + EVENT_GRACE, observation: 30 })) || {}).id, "correction", "the new model is now the belief");
});

test("Moon and Static Sky quicken the schedule (gapMult)", () => {
    const restore = seedRandom(8);
    const w = makeWorld(); const wt = new Watcher();
    dasher(w);
    wt.update(w.profile, ctx({ life: 200, observation: 30 }));           // speaks, resets the clock
    const soon = 200 + TIER_GAPS[1] * 0.6;
    assert.equal(wt.update(w.profile, ctx({ life: soon, observation: 30, gapMult: 1 })), null);
    const quick = wt.update(w.profile, ctx({ life: soon, observation: 30, gapMult: 0.5 }));
    restore();
    assert.ok(quick, "with half the gap it should speak by now");
});
