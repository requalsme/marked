import test from "node:test";
import assert from "node:assert/strict";
import { makeWorld, tick, seedRandom } from "./helpers.js";
import { PASSIVES, CLASSES, getEquipmentStats } from "../src/state.js";
import { ritualTerms } from "../src/ui.js";
import { falseChance } from "../src/lore.js";

const quiet = (w) => { w.engine.autoAttack = false; w.engine.spawnDelay = 1e12; };

test("every class has a named passive", () => {
    for (const c of Object.values(CLASSES)) assert.ok(c.passive && c.passive.name && c.passive.desc.length > 20, c.name);
});

test("Bone Marked: each body on record is armor, up to a cap, and a risen body is not", () => {
    const w = makeWorld({ classType: "Bone Marked" });
    const base = getEquipmentStats(w.profile).armor;
    const corpse = (state = "fresh") => ({ x: 1, y: 1, level: 1, state });
    w.profile.corpses = [corpse(), corpse("burned")];
    assert.equal(getEquipmentStats(w.profile).armor, base + 2 * PASSIVES.boneArmorPerCorpse);
    w.profile.corpses.push(corpse("risen"));
    assert.equal(getEquipmentStats(w.profile).armor, base + 2 * PASSIVES.boneArmorPerCorpse, "it walked away");
    w.profile.corpses = Array.from({ length: 5 }, () => corpse());
    assert.equal(getEquipmentStats(w.profile).armor, base + PASSIVES.boneArmorMax);
    const other = makeWorld({ classType: "Blood Marked" });
    other.profile.corpses = Array.from({ length: 5 }, () => corpse());
    assert.equal(getEquipmentStats(other.profile).armor, getEquipmentStats(makeWorld({ classType: "Blood Marked" }).profile).armor, "other classes are unmoved");
});

test("Signal Marked: clearer reception, a harder record to read, a quicker pylon", () => {
    const signal = makeWorld({ classType: "Signal Marked" }).profile;
    const gearOnly = { ...signal, classType: "Bone Marked" };               // same gear, no passive
    const a = getEquipmentStats(signal), b = getEquipmentStats(gearOnly);
    assert.ok(Math.abs(a.signalClarity - b.signalClarity - PASSIVES.signalClarity) < 1e-9);
    assert.ok(Math.abs(a.obfuscation - b.obfuscation - PASSIVES.signalMask) < 1e-9);
    assert.ok(falseChance(30, { clarity: a.signalClarity }) < falseChance(30, { clarity: b.signalClarity }));
    assert.equal(PASSIVES.signalPylonCooldown, 0.5);
});

test("Blood Marked: a kill restores flesh, scaled by healing (Blood Rain halves it)", () => {
    const heal = (observation, trait) => {
        const w = makeWorld({ classType: "Blood Marked", observation, trait }); quiet(w);
        w.engine.player.health = 60;
        w.engine.spawnEnemy("Cabinet Indexer", 900, 700);
        w.engine.enemies[0].health = 0;
        tick(w, 1);
        return w.engine.player.health - 60;
    };
    const full = heal(10, null);
    assert.ok(Math.abs(full - 150 * PASSIVES.bloodKillHeal) < 1.2, `kill healed ${full.toFixed(1)}`);
    assert.ok(heal(60, "Blood Rain") < full * 0.6, "Blood Rain thins it");
    const bone = makeWorld({ classType: "Bone Marked" }); quiet(bone);
    bone.engine.player.health = 60; bone.engine.spawnEnemy("Cabinet Indexer", 900, 700); bone.engine.enemies[0].health = 0;
    tick(bone, 1);
    assert.ok(bone.engine.player.health - 60 < 0.1, "only Blood Marked drinks (the rib's regeneration is a fraction of a point)");
});

test("Static Marked: dashes again sooner and stays untouchable longer", () => {
    const dash = (classType) => {
        const w = makeWorld({ classType }); quiet(w);
        w.engine.keys.d = true; w.engine.keys.shift = true;
        tick(w, 2);                                  // the dash begins on the first tick; its i-frames are applied on the second
        return { cooldown: w.engine.player.dashCooldown, inv: w.engine.player.invulnTimer };
    };
    const s = dash("Static Marked"), b = dash("Blood Marked");
    assert.equal(b.cooldown, 59); assert.equal(b.inv, 5);   // 60 and 5 for everyone else
    assert.equal(s.cooldown, PASSIVES.staticDashCooldown - 1);
    assert.equal(s.inv, PASSIVES.staticDashIframes);
    assert.ok(s.inv > b.inv);
});

test("Static Marked: about one blow in eight simply does not land", () => {
    const restore = seedRandom(77);
    const w = makeWorld({ classType: "Static Marked" }); quiet(w);
    let landed = 0, phased = 0;
    for (let i = 0; i < 2000; i++) {
        w.engine.player.invulnTimer = 0;
        w.engine.player.health = w.engine.player.maxHealth;
        w.engine.damagePlayer(10, 0, 0, 0, "test");
        if (w.engine.player.health < w.engine.player.maxHealth) landed++; else phased++;
    }
    restore();
    assert.ok(Math.abs(phased / 2000 - PASSIVES.staticPhase) < 0.03, `phased ${(phased / 20).toFixed(1)}%`);
    assert.ok(w.engine.floatingTexts.some(t => t.text === "PHASED"));
    // and nobody else does it
    const other = makeWorld({ classType: "Blood Marked" });
    for (let i = 0; i < 200; i++) { other.engine.player.invulnTimer = 0; const h = other.engine.player.health; other.engine.damagePlayer(5, 0, 0, 0, "t"); assert.ok(other.engine.player.health < h); other.engine.player.health = h; }
});

test("Ritual Marked: bargains pay more, cost less sanity, and recover sooner", () => {
    const maker = makeWorld({ classType: "Ritual Marked" }).profile, other = makeWorld({ classType: "Blood Marked" }).profile;
    const a = ritualTerms(1, maker), b = ritualTerms(1, other);
    assert.ok(a.titheDamage > b.titheDamage);
    assert.ok(a.commSanity < b.commSanity && a.titheSanity < b.titheSanity);
    assert.ok(a.cooldownMs < b.cooldownMs);
    assert.ok(a.eraseObservation > b.eraseObservation);
    // and it stacks with The Devil rather than replacing it
    maker.activeTarot = "The Devil";
    assert.ok(ritualTerms(1, maker).titheDamage > a.titheDamage);
});
