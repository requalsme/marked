import test from "node:test";
import assert from "node:assert/strict";
import { makeWorld, tick, seedRandom } from "./helpers.js";
import { activeCounters, COUNTER_INFO } from "../src/adapt.js";
import { sampleDossier, recordEvent } from "../src/dossier.js";
import { ROOM } from "../src/world.js";

const DT = 1 / 60;

function readableDasher(w) {
    w.engine.canvasRenderer.candles = [{ x: w.engine.player.x, y: w.engine.player.y, intensity: 1 }];   // also a light-hugger
    for (let i = 0; i < 90 * 60; i++) sampleDossier(w.profile, w.engine, DT);
    for (let i = 0; i < 6; i++) recordEvent(w.profile, "dash");
}
function readableLightBound(w) {
    w.engine.canvasRenderer.candles = [{ x: w.engine.player.x, y: w.engine.player.y, intensity: 1 }];
    for (let i = 0; i < 90 * 60; i++) sampleDossier(w.profile, w.engine, DT);
}
const quiet = (w) => { w.engine.autoAttack = false; w.engine.spawnDelay = 1e12; w.engine.player.invulnTimer = 1e9; };

// ─── which counters are live ────────────────────────────────────────────────

test("counters switch on at Studied and widen with the tier", () => {
    const w = makeWorld();
    readableDasher(w);
    assert.deepEqual(activeCounters(w.profile, 40), {}, "nothing below 50%");
    const studied = activeCounters(w.profile, 55);
    const modeled = activeCounters(w.profile, 80);
    const known = activeCounters(w.profile, 100);
    assert.equal(Object.keys(studied).length, 1);
    assert.equal(Object.keys(modeled).length, 2);
    assert.ok(Object.keys(known).length >= 2);
    const id = Object.keys(studied)[0];
    assert.ok(modeled[id] > studied[id], "the same habit hits harder once Modeled");
    for (const k of Object.keys(known)) assert.ok(COUNTER_INFO[k], `${k} has a counter`);
});

test("Obfuscation (and varied play) shrink or remove the counters", () => {
    const w = makeWorld();
    readableDasher(w);
    const open = activeCounters(w.profile, 80, 0);
    const masked = activeCounters(w.profile, 80, 0.5);
    assert.ok(open.dasher > 0);
    assert.ok(!masked.dasher || masked.dasher < open.dasher * 0.6);
    assert.deepEqual(activeCounters(w.profile, 80, 0.85), {});
});

// ─── baited dashes ──────────────────────────────────────────────────────────

function dashAt(w, dir = "d") {
    w.engine.keys[dir] = true; w.engine.keys["shift"] = true;
    tick(w, 1);
    w.engine.keys[dir] = false; w.engine.keys["shift"] = false;
}

test("Baited dashes: witnesses freeze and flash during the dash, then lunge where the player lands", () => {
    const w = makeWorld(); quiet(w);
    w.engine.counters = { dasher: 1 };
    const e = w.engine; e.spawnEnemy("Cabinet Indexer", e.player.x - 150, e.player.y);
    const wit = e.enemies[0];
    dashAt(w);
    assert.ok(wit.bait, "the witness has been baited");
    const x0 = wit.x;
    tick(w, 8);
    assert.ok(Math.abs(wit.x - x0) < 1.5, "frozen mid-wind-up");
    assert.ok(wit.hitFlash > 0, "and telegraphing it");
    // after the wind-up it covers ground faster than it ever walks
    tick(w, 6);
    const x1 = wit.x; tick(w, 4);
    assert.ok(Math.abs(wit.x - x1) / 4 > wit.speed * 1.8, `lunge speed ${(Math.abs(wit.x - x1) / 4).toFixed(2)} vs walk ${wit.speed}`);
});

test("Baited dashes: shooters loose a shot at the landing point instead", () => {
    const w = makeWorld(); quiet(w);
    w.engine.counters = { dasher: 1 };
    const e = w.engine; e.spawnEnemy("Ink Redactor", e.player.x - 100, e.player.y);
    e.enemies[0].attackCooldown = 0;
    const before = e.projectiles.length;
    dashAt(w);
    tick(w, 13);
    assert.ok(e.projectiles.filter(p => p.owner === "enemy").length > before || e.player.health < e.player.maxHealth || e.projectiles.length > before, "a shot was fired");
});

test("without the counter, a dash is just a dash", () => {
    const w = makeWorld(); quiet(w);
    const e = w.engine; e.spawnEnemy("Cabinet Indexer", e.player.x - 150, e.player.y);
    dashAt(w);
    assert.equal(e.enemies[0].bait, undefined);
});

// ─── led shots ──────────────────────────────────────────────────────────────

test("Led shots: shooters aim ahead of a moving player, scaled by power", () => {
    const w = makeWorld();
    const e = w.engine; const p = e.player;
    p.vx = 4.5; p.vy = 0;
    const shooter = { x: p.x + 200, y: p.y };
    assert.deepEqual(e.aimAt(shooter, 5.5), { x: p.x, y: p.y });
    e.counters = { kiter: 1 };
    const lead = e.aimAt(shooter, 5.5);
    assert.ok(lead.x > p.x + 30, `leads by ${(lead.x - p.x).toFixed(0)}px`);
    e.counters = { kiter: 0.5 };
    assert.ok(e.aimAt(shooter, 5.5).x - p.x < lead.x - p.x);
});

test("Led shots: melee witnesses run down a retreating player", () => {
    const run = (counters) => {
        const w = makeWorld(); quiet(w);
        w.engine.counters = counters;
        const e = w.engine; e.spawnEnemy("Cabinet Indexer", e.player.x - 300, e.player.y);
        const x0 = e.enemies[0].x; tick(w, 30);
        return e.enemies[0].x - x0;
    };
    assert.ok(run({ kiter: 1 }) > run({}) * 1.2);
});

// ─── slams ──────────────────────────────────────────────────────────────────

test("Slams: standing at arm's length draws one telegraphed slam, then a cooldown", () => {
    const w = makeWorld(); quiet(w);
    w.engine.counters = { brawler: 1 };
    const e = w.engine; e.spawnEnemy("Witness Chair", e.player.x + 40, e.player.y);
    tick(w, 30);
    const marks = () => w.events.filter(x => x.event === "mark" && x.data.kind === "slam");
    assert.equal(marks().length, 0, "not yet: the clinch must hold for ~40 frames at full power");
    tick(w, 25);
    assert.equal(marks().length, 1);
    assert.ok(marks()[0].data.frames >= 30 && marks()[0].data.damage > e.enemies[0].damage);
    tick(w, 100);
    assert.equal(marks().length, 1, "cooldown holds it off");
});

test("Slams: backing off resets the clinch", () => {
    const w = makeWorld(); quiet(w);
    w.engine.counters = { brawler: 1 };
    const e = w.engine; e.spawnEnemy("Witness Chair", e.player.x + 40, e.player.y);
    tick(w, 30);
    e.enemies[0].x = e.player.x + 400; e.enemies[0].speed = 0;
    tick(w, 120);
    assert.equal(w.events.filter(x => x.event === "mark").length, 0);
});

// ─── burst armour ───────────────────────────────────────────────────────────

test("Burst armour: no single blow takes more than a share of a witness's flesh", () => {
    const w = makeWorld();
    const e = w.engine;
    const dummy = { x: 100, y: 100, maxHealth: 100, health: 100 };
    assert.equal(e.modifyPlayerHit(500, dummy), 500);
    e.counters = { critReliant: 1 };
    assert.equal(e.modifyPlayerHit(500, dummy), 25);
    assert.equal(e.modifyPlayerHit(10, dummy), 10, "ordinary hits are untouched");
    e.counters = { critReliant: 0.4 };
    assert.ok(e.modifyPlayerHit(500, dummy) > 25);
    assert.ok(e.floatingTexts.some(t => t.text === "ABSORBED"));
});

// ─── bargain traps ──────────────────────────────────────────────────────────

test("Bargain traps: lingering at the altar draws a trap; walking away resets it", () => {
    const w = makeWorld(); quiet(w);
    const e = w.engine;
    e.addInteractable("blood_ritual_altar", 430, 800, {});
    e.counters = { ritualist: 1 };
    e.player.x = 430; e.player.y = 780;
    tick(w, 150);
    assert.equal(w.events.filter(x => x.event === "mark").length, 0);
    e.player.x = 900; e.player.y = 500; tick(w, 200);
    e.player.x = 430; e.player.y = 780;
    tick(w, 250);
    const marks = w.events.filter(x => x.event === "mark");
    assert.equal(marks.length, 1);
    assert.equal(marks[0].data.kind, "bargain");
    assert.ok(Math.hypot(marks[0].data.x - 430, marks[0].data.y - 780) < 30, "it lands under the player");
});

// ─── snuffed flames ─────────────────────────────────────────────────────────

test("Snuffed flames: the nearest candle goes out for a while, then relights", () => {
    const w = makeWorld(); quiet(w);
    const e = w.engine;
    e.counters = { lightBound: 1 };
    e.player.x = 335; e.player.y = 790;                          // beside the altar candles
    tick(w, 700);
    const out = ROOM.candles.filter(c => c.snuffed);
    assert.equal(out.length, 1);
    assert.equal(w.events.filter(x => x.event === "candle_snuffed").length, 1);
    // a snuffed candle gives no comfort to a failing mind
    e.counters = {};
    tick(w, 2000);
    assert.equal(ROOM.candles.filter(c => c.snuffed).length, 0, "relit");
});

test("a fresh engine relights every candle", () => {
    const w = makeWorld();
    ROOM.candles[0].snuffed = true;
    w.engine.reset();
    assert.ok(ROOM.candles.every(c => !c.snuffed));
});

// ─── corpses that rise ──────────────────────────────────────────────────────

function withCorpse(w, tarot) {
    w.profile.activeTarot = tarot;
    const corp = { x: w.engine.player.x + 100, y: w.engine.player.y, level: 2, classType: "Blood Marked", state: "fresh", cause: "Felled by Paper Wraith" };
    w.engine.addInteractable("fresh_marked_corpse", corp.x, corp.y, { radius: 18, corpse: corp });
    return corp;
}

test("The Death card: an unrecovered corpse always rises as the player nears it", () => {
    const w = makeWorld(); quiet(w);
    const corp = withCorpse(w, "Death");
    tick(w, 40);
    assert.equal(corp.state, "risen");
    assert.ok(w.engine.enemies.some(e => e.type === "Corpse Echo"));
    assert.ok(w.events.some(x => x.event === "corpse_rose"));
    assert.ok(!w.engine.interactables.some(i => i.type === "fresh_marked_corpse"));
});

test("Otherwise a corpse only sometimes rises, and is only judged once per descent", () => {
    const restore = seedRandom(21);
    let risen = 0;
    for (let i = 0; i < 80; i++) {
        const w = makeWorld(); quiet(w);
        const corp = withCorpse(w, "The Hermit");
        tick(w, 40);
        tick(w, 40);                 // standing there longer does not re-roll
        if (corp.state === "risen") risen++;
    }
    restore();
    assert.ok(risen > 8 && risen < 40, `about a quarter should rise (${risen}/80)`);
});

test("a corpse out of reach stays down", () => {
    const w = makeWorld(); quiet(w);
    const corp = withCorpse(w, "Death");
    w.engine.interactables[0].x = 1500; w.engine.interactables[0].y = 900;
    tick(w, 60);
    assert.equal(corp.state, "fresh");
});

// ─── the Shape ──────────────────────────────────────────────────────────────

test("The Shape fights with the player's own class", () => {
    const projType = (classType) => {
        const w = makeWorld({ classType }); quiet(w);
        const e = w.engine; e.spawnEnemy("The Shape", e.player.x + 55, e.player.y);
        for (let i = 0; i < 90; i++) {
            tick(w, 1);
            const shot = e.projectiles.find(p => p.owner === "enemy");
            if (shot) return shot.type;
        }
        return null;
    };
    assert.equal(projType("Blood Marked"), "blood_cleave");
    assert.equal(projType("Signal Marked"), "static_spark");
    assert.equal(projType("Bone Marked"), "sword_slash");
});

test("The Shape keeps the player's distance, and dashes if the player does", () => {
    const sep = (counters) => {
        const w = makeWorld({ classType: "Signal Marked" }); quiet(w);
        w.engine.counters = counters;
        const e = w.engine; e.spawnEnemy("The Shape", e.player.x + 40, e.player.y);
        tick(w, 120);
        return Math.hypot(e.enemies[0].x - e.player.x, e.enemies[0].y - e.player.y);
    };
    assert.ok(sep({ kiter: 1 }) > sep({}) + 80, "a kiter's Shape stands off");

    const w = makeWorld(); quiet(w);
    w.engine.counters = { dasher: 1 };
    const e = w.engine; e.spawnEnemy("The Shape", e.player.x + 400, e.player.y);
    const shape = e.enemies[0]; shape.behaviorTimer = 179;
    tick(w, 2);
    assert.ok(shape.shapeDash > 0, "it dashes at you");
});
