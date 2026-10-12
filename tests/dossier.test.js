import test from "node:test";
import assert from "node:assert/strict";
import { makeWorld } from "./helpers.js";
import {
    sampleDossier, recordEvent, habits, topHabit, diagnose, closeLife, recordDeath, ensureDossier,
    favoriteZone, zoneAt, obfuscationMask, formatClock, MEMORY_DECAY
} from "../src/dossier.js";

const DT = 1 / 60;

// Run `seconds` of play. `step(i, w)` positions the player/enemies for each tick.
function play(w, seconds, step) {
    const n = Math.round(seconds / DT);
    for (let i = 0; i < n; i++) { step(i, w); sampleDossier(w.profile, w.engine, DT); }
}
const witness = (x, y) => ({ x, y, health: 10, radius: 18, type: "Cabinet Indexer" });

test("a fresh profile reads as Unread", () => {
    const w = makeWorld();
    assert.equal(diagnose(w.profile), "Diagnosis: Unread / Fresh");
    assert.deepEqual(habits(w.profile), []);
});

test("standing at arm's length reads as Aggressive", () => {
    const w = makeWorld();
    w.engine.enemies = [witness(600, 520)];
    play(w, 65, () => { w.engine.player.x = 560; w.engine.player.y = 520; w.engine.player.vx = w.engine.player.vy = 0; });
    assert.equal(topHabit(w.profile, "combat").id, "brawler");
    assert.match(diagnose(w.profile), /Aggressive/);
});

test("backing away from a close enemy reads as Evasive, not Aggressive", () => {
    const w = makeWorld();
    const e = witness(560, 520);
    w.engine.enemies = [e];
    // the enemy keeps closing; the player keeps stepping back, staying inside 160px
    play(w, 40, (i) => {
        w.engine.player.x = 560 + (i % 60) * 1.2; w.engine.player.y = 520;
        w.engine.player.vx = 4.5; w.engine.player.vy = 0;
        e.x = w.engine.player.x - 100 - (i % 60) * 0.4; // gap widens each tick as the player moves
        if (i % 60 === 59) { w.engine.player.x = 560; e.x = 460; }
    });
    const kiter = habits(w.profile).find(h => h.id === "kiter");
    assert.ok(kiter && kiter.strength > 0.5, "kiting should register");
});

test("dash frequency reads as Dash-reliant only with enough time observed", () => {
    const w = makeWorld();
    for (let i = 0; i < 4; i++) recordEvent(w.profile, "dash");
    assert.equal(habits(w.profile).find(h => h.id === "dasher"), undefined, "no reading before 45s");
    play(w, 60, () => {});
    for (let i = 0; i < 4; i++) recordEvent(w.profile, "dash");
    const dasher = habits(w.profile).find(h => h.id === "dasher");
    assert.ok(dasher && dasher.strength > 0.9);
});

test("candlelight hugging and dark wandering are told apart", () => {
    const w = makeWorld();
    w.engine.canvasRenderer.candles = [{ x: 560, y: 520, intensity: 1 }];
    play(w, 50, () => { w.engine.player.x = 560; w.engine.player.y = 520; });
    assert.equal(topHabit(w.profile, "body").id, "lightBound");
    const dark = makeWorld();
    dark.engine.canvasRenderer.candles = [{ x: 1400, y: 900, intensity: 1 }];
    play(dark, 50, () => {});
    assert.equal(habits(dark.profile).find(h => h.id === "lightBound"), undefined);
});

test("lingering in one place reads as Route-bound and names the place", () => {
    const w = makeWorld();
    const altar = zoneAt(430, 800);
    assert.equal(altar, "blood_ritual_altar");
    play(w, 70, () => { w.engine.player.x = 430; w.engine.player.y = 790; });
    assert.equal(topHabit(w.profile, "body").id, "routeBound");
    const fav = favoriteZone(w.profile);
    assert.equal(fav.label, "the altar");
    assert.ok(fav.share > 0.9);
});

test("corpse habits need volume and a clear preference", () => {
    const w = makeWorld();
    recordEvent(w.profile, "corpse", { action: "burn" });
    assert.equal(habits(w.profile).find(h => h.id === "burner"), undefined, "one act is not a habit");
    for (let i = 0; i < 3; i++) recordEvent(w.profile, "corpse", { action: "burn" });
    assert.equal(topHabit(w.profile, "system").id, "burner");
    for (let i = 0; i < 4; i++) recordEvent(w.profile, "corpse", { action: "devour" });
    assert.equal(habits(w.profile).find(h => h.id === "burner"), undefined, "an even split has no preference");
});

test("variety reads as Inconclusive, and Obfuscation makes the player vague", () => {
    const w = makeWorld();
    play(w, 70, () => {});          // standing about on the open floor is not a pattern
    assert.equal(diagnose(w.profile), "Diagnosis: Inconclusive / Adapting");

    const c = makeWorld();
    c.engine.canvasRenderer.candles = [{ x: 560, y: 520, intensity: 1 }];
    play(c, 60, () => { c.engine.player.x = 560; c.engine.player.y = 520; });
    assert.ok(habits(c.profile).length > 0);
    const mask = obfuscationMask({ upgrades: { obfuscation: 10 } }, { obfuscation: 0.3 });
    assert.ok(mask > 0.7 && mask <= 0.85);
    assert.equal(habits(c.profile, mask).length, 0, "a well-masked player is unreadable");
});

test("habits persist across death with decay, and a changed player outgrows them", () => {
    const w = makeWorld();
    w.engine.canvasRenderer.candles = [{ x: 560, y: 520, intensity: 1 }];
    play(w, 120, () => { w.engine.player.x = 560; w.engine.player.y = 520; });
    const before = habits(w.profile).find(h => h.id === "lightBound").strength;
    closeLife(w.profile);
    const dos = ensureDossier(w.profile);
    assert.equal(dos.lives, 1);
    assert.equal(dos.life.secs, 0, "the new life starts clean");
    assert.ok(dos.memory.lit > 0);
    const after = habits(w.profile).find(h => h.id === "lightBound");
    assert.ok(after && after.strength > 0, "the Monolith remembers");
    // a long dark life dilutes the old reputation
    w.engine.canvasRenderer.candles = [];
    play(w, 400, () => {});
    assert.equal(habits(w.profile).find(h => h.id === "lightBound"), undefined);
    assert.ok(MEMORY_DECAY < 1 && before > 0);
});

test("death history keeps the newest first and caps its length", () => {
    const w = makeWorld();
    for (let i = 0; i < 15; i++) recordDeath(w.profile, { cause: `c${i}`, killer: "Paper Wraith", seconds: 61.4, observation: 33.3, level: 2 });
    assert.equal(w.profile.deathHistory.length, 12);
    assert.equal(w.profile.deathHistory[0].cause, "c14");
    assert.equal(w.profile.deathHistory[0].seconds, 61);
    assert.equal(formatClock(61), "1:01");
});

test("old saves without a dossier are upgraded in place", () => {
    const w = makeWorld();
    delete w.profile.dossier; delete w.profile.deathHistory;
    ensureDossier(w.profile);
    assert.ok(w.profile.dossier.life && w.profile.deathHistory);
});

test("walking in at the enemy reads as Aggressive; being walked at does not", () => {
    // the player keeps walking toward a witness 200px away
    const w = makeWorld();
    const e = witness(760, 520);
    w.engine.enemies = [e];
    play(w, 40, () => { w.engine.player.x = 560; w.engine.player.y = 520; w.engine.player.vx = 4.5; w.engine.player.vy = 0; });
    const brawler = habits(w.profile).find(h => h.id === "brawler");
    assert.ok(brawler && brawler.strength > 0.8, "closing in is a choice the Monolith can read");

    // ...but a witness that walks up to a player who is standing still tells it nothing
    const still = makeWorld();
    const walker = witness(780, 520);
    still.engine.enemies = [walker];
    play(still, 40, (i) => { still.engine.player.x = 560; still.engine.player.y = 520; still.engine.player.vx = 0; still.engine.player.vy = 0; walker.x = Math.max(670, 780 - i * 0.6); });
    assert.equal(habits(still.profile).find(h => h.id === "brawler"), undefined);
});

test("records from before a counter existed are filled in rather than poisoned", () => {
    const w = makeWorld();
    ensureDossier(w.profile);
    delete w.profile.dossier.life.approach; delete w.profile.dossier.memory.approach;
    ensureDossier(w.profile);
    assert.equal(w.profile.dossier.life.approach, 0);
    play(w, 5, () => {});
    assert.ok(Number.isFinite(w.profile.dossier.life.approach));
});

test("the offline report is concluded from what the Monolith knows of the player", async () => {
    const { calculateOfflineProgress } = await import("../src/idle.js");
    const w = makeWorld();
    w.profile.lastTimestamp = Date.now() - 15 * 60 * 1000;
    assert.equal(calculateOfflineProgress(w.profile).conclusion, "Subject shows static patterns.", "a stranger reads as a stranger");

    const d = makeWorld();
    d.profile.lastTimestamp = Date.now() - 15 * 60 * 1000;
    for (let i = 0; i < 90 * 60; i++) sampleDossier(d.profile, d.engine, DT);
    for (let i = 0; i < 6; i++) recordEvent(d.profile, "dash");
    assert.match(calculateOfflineProgress(d.profile).conclusion, /^Subject remains dash-reliant\./);
});
