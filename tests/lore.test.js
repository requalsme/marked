import test from "node:test";
import assert from "node:assert/strict";
import { makeWorld } from "./helpers.js";
import {
    LEDGER, COMMUNION_PAGES, ensureLedger, unlockFor, unlockPage, ledgerComplete, ledgerCount, markRead, falseChance,
    chooseWarning, corpseTransmission, WARNINGS, FALSE_WARNINGS, LAST_ENTRY, MATRON_LINES, pageById
} from "../src/lore.js";

const seeded = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test("every page has what the reader needs, and ids and numerals are unique", () => {
    assert.equal(new Set(LEDGER.map(p => p.id)).size, LEDGER.length);
    assert.equal(new Set(LEDGER.map(p => p.num)).size, LEDGER.length);
    for (const p of LEDGER) {
        assert.ok(p.title && p.text.length > 120 && p.byline && p.hint, p.id);
        assert.ok(p.text.length < 520, `${p.id} stays short enough to read mid-descent`);
    }
    assert.equal(LEDGER.length, 13);
    assert.ok(COMMUNION_PAGES.every(id => pageById(id)));
});

test("Static Communion decodes the opening pages in order, then runs dry", () => {
    const w = makeWorld();
    const got = [];
    for (let i = 0; i < 6; i++) { const p = unlockFor(w.profile, "communion"); if (p) got.push(p.id); }
    assert.deepEqual(got, COMMUNION_PAGES);
    assert.equal(unlockFor(w.profile, "communion"), null, "nothing left to decode");
});

test("pages are earned by what the player does, once each", () => {
    const w = makeWorld();
    const triggers = ["tier1", "tier2", "tier3", "boss_wake", "boss_down", "echo_down", "tier4"];
    const ids = triggers.map(t => unlockFor(w.profile, t).id);
    assert.deepEqual(ids, ["stone", "mirror", "witnesses", "matron", "wax", "first", "reader"]);
    for (const t of triggers) assert.equal(unlockFor(w.profile, t), null, `${t} only teaches once`);
});

test("leaving teaches the Door, and leaving again teaches what comes after", () => {
    const w = makeWorld();
    w.profile.stats.escapes = 1;
    assert.equal(unlockFor(w.profile, "escape").id, "door");
    assert.equal(unlockFor(w.profile, "escape"), null, "one escape, one page");
    w.profile.stats.escapes = 2;
    assert.equal(unlockFor(w.profile, "escape").id, "unfinished");
});

test("unread pages are tracked until the Ledger is opened", () => {
    const w = makeWorld();
    unlockFor(w.profile, "communion"); unlockFor(w.profile, "tier1");
    assert.equal(ensureLedger(w.profile).unread.length, 2);
    markRead(w.profile);
    assert.equal(ensureLedger(w.profile).unread.length, 0);
    assert.equal(ledgerCount(w.profile), 2);
});

test("the last entry is offered only when every page is held", () => {
    const w = makeWorld();
    assert.equal(ledgerComplete(w.profile), false);
    for (const p of LEDGER.slice(0, -1)) unlockPage(w.profile, p.id);
    assert.equal(ledgerComplete(w.profile), false);
    unlockPage(w.profile, LEDGER[LEDGER.length - 1].id);
    assert.equal(ledgerComplete(w.profile), true);
    assert.ok(LAST_ENTRY.epilogue.length >= 3 && LAST_ENTRY.prompt.includes("struck out"));
    assert.ok(Object.keys(MATRON_LINES).sort().join() === "down,phase2,phase3,wake");
});

test("old saves without a ledger are upgraded in place", () => {
    const w = makeWorld();
    delete w.profile.ledger;
    assert.deepEqual(ensureLedger(w.profile).pages, []);
});

test("reception worsens with sanity, the Moon makes it worse, clarity pushes back", () => {
    const c = (s, o) => falseChance(s, o);
    assert.ok(c(90) < c(60) && c(60) < c(30) && c(30) < c(10));
    assert.ok(c(60, { moon: true }) > c(60) + 0.3);
    assert.ok(c(30, { clarity: 0.35 }) < c(30) * 0.7);
    assert.ok(c(5, { moon: true }) <= 0.85, "never certain");
    assert.ok(c(100, { clarity: 1 }) < 0.02);
});

test("warnings: sane receivers hear the truth, and relevant hints are favoured", () => {
    const truths = new Set(WARNINGS.map(w => w.text));
    // rng: first draw decides lie vs truth, second picks within the pool
    const w1 = chooseWarning({ sanity: 100, topics: [], boss: false }, seeded([0.9, 0.5]));
    assert.equal(w1.falseSignal, false);
    assert.ok(truths.has(w1.text));
    let boss = 0, plain = 0;
    for (let i = 0; i < 400; i++) {
        const a = chooseWarning({ sanity: 100, topics: ["dasher"], boss: false }, seeded([0.9, (i + 0.5) / 400]));
        if (a.topic === "dasher") boss++;
        const b = chooseWarning({ sanity: 100, topics: [], boss: false }, seeded([0.9, (i + 0.5) / 400]));
        if (b.topic === "dasher") plain++;
    }
    assert.ok(boss > plain * 2, `a live dash counter makes dash warnings likelier (${plain} → ${boss})`);
});

test("warnings: a Broken receiver is usually lied to, and the lie is marked", () => {
    const lies = new Set(FALSE_WARNINGS.map(w => w.text));
    const w = chooseWarning({ sanity: 5, topics: [], boss: false }, seeded([0.1, 0.3]));
    assert.equal(w.falseSignal, true);
    assert.ok(lies.has(w.text));
});

test("a broadcast corpse speaks in the voice of what killed it", () => {
    const text = corpseTransmission({ level: 4, killer: "Witness Chair", seconds: 187, zone: "The Keeping House" }, seeded([0]));
    assert.match(text, /^Marked, level 4\. Felled by Witness Chair after 3:07, in the Keeping House\. "It remembered my weight\."/);
    assert.match(corpseTransmission({ level: 1 }, seeded([0])), /Felled by the dark/);
});
