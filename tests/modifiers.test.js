import test from "node:test";
import assert from "node:assert/strict";
import { makeWorld, tick, seedRandom } from "./helpers.js";
import { traitActive, updateObservation, handleSanityDecay, TUNING, OBSERVATION_PER_SEC } from "../src/systems.js";
import { generateLootItem, nextRarity, RARITY_MULTIPLIERS } from "../src/state.js";
import { ritualTerms } from "../src/ui.js";

test("Reality Traits stay dormant until the Monolith has Studied the player (50%)", () => {
    const w = makeWorld({ trait: "Static Sky", observation: 49 });
    assert.equal(traitActive(w.profile, "Static Sky"), false);
    w.profile.observation = 50;
    assert.equal(traitActive(w.profile, "Static Sky"), true);
    assert.equal(traitActive(w.profile, "Blood Rain"), false);
});

test("Static Sky doubles sanity decay only once active", () => {
    const decay = (obs) => {
        const w = makeWorld({ trait: "Static Sky", observation: obs });
        const before = w.engine.player.sanity;
        handleSanityDecay(w.profile, w.engine, 1);
        return before - w.engine.player.sanity;
    };
    assert.ok(Math.abs(decay(60) / decay(10) - 2) < 1e-6);
});

test("maxed Obfuscation and Mind upgrades never drive the rates to zero or below", () => {
    const w = makeWorld({ observation: 10 });
    w.profile.upgrades.obfuscation = 10;
    w.profile.upgrades.mind = 10;
    const o0 = w.profile.observation;
    updateObservation(w.profile, w.engine, 1);
    assert.ok(w.profile.observation > o0, "observation must still rise");
    const s0 = w.engine.player.sanity;
    handleSanityDecay(w.profile, w.engine, 1);
    assert.ok(w.engine.player.sanity < s0, "sanity must still drain");
});

test("Observation Masking on gear slows observation", () => {
    const gain = (mask) => {
        const w = makeWorld({ observation: 10 });
        w.engine.player.stats.obfuscation = mask;
        updateObservation(w.profile, w.engine, 1);
        return w.profile.observation - 10;
    };
    assert.ok(Math.abs(gain(0) - OBSERVATION_PER_SEC) < 1e-9);
    assert.ok(Math.abs(gain(0.3) / gain(0) - 0.7) < 1e-9);
    assert.ok(gain(5) >= gain(0) * 0.5 - 1e-9, "masking is capped at 50%");
});

test("The Devil sharpens both edges of every bargain", () => {
    const plain = ritualTerms(0, { activeTarot: "Death" });
    const devil = ritualTerms(0, { activeTarot: "The Devil" });
    assert.equal(devil.titheDamage, Math.round(plain.titheDamage * TUNING.devilRitualBoon));
    assert.equal(devil.commSanity, plain.commSanity * TUNING.devilSanityCost);
    assert.equal(devil.titheSanity, plain.titheSanity * TUNING.devilSanityCost);
    assert.ok(devil.eraseObservation > plain.eraseObservation);
});

test("Blood Rain: hits land harder, healing is halved", () => {
    const calm = makeWorld({ trait: "Blood Rain", observation: 10 });
    const rain = makeWorld({ trait: "Blood Rain", observation: 60 });
    assert.equal(calm.engine.modifyPlayerHit(100), 100);
    assert.equal(rain.engine.modifyPlayerHit(100), Math.round(100 * TUNING.bloodRainDamage));
    assert.equal(calm.engine.healingMult(), 1);
    assert.equal(rain.engine.healingMult(), TUNING.bloodRainHealing);
});

test("Mirror Rot: enemies mirror a share of armor; gold rises 20%", () => {
    const w = makeWorld({ trait: "Mirror Rot", observation: 60 });
    w.engine.player.stats.armor = 20;
    assert.equal(w.engine.modifyPlayerHit(100), Math.round(100 * (1 - TUNING.mirrorRotArmorShare * 0.5)));
    assert.ok(Math.abs(w.engine.goldMult() - TUNING.mirrorRotGold) < 1e-9);
    w.engine.player.stats.goldFind = 0.15;
    assert.ok(Math.abs(w.engine.goldMult() - 1.15 * TUNING.mirrorRotGold) < 1e-9);
});

test("The Tower: Seal Mother hits 30% harder", () => {
    const base = makeWorld();
    const tower = makeWorld({ tarot: "The Tower" });
    base.engine.spawnEnemy("Seal Mother", 800, 500);
    tower.engine.spawnEnemy("Seal Mother", 800, 500);
    const a = base.engine.enemies[0].damage, b = tower.engine.enemies[0].damage;
    assert.equal(b, Math.round(a * TUNING.towerBossDamage));
});

test("loot: rarity caps hold, and a boost makes the top tiers more common", () => {
    const restore = seedRandom(11);
    const keys = Object.keys(RARITY_MULTIPLIERS);
    const share = (boost) => {
        let high = 0;
        for (let i = 0; i < 4000; i++) {
            const it = generateLootItem("Abyssal", boost);
            assert.ok(keys.indexOf(it.rarity) <= keys.indexOf("Abyssal"));
            if (keys.indexOf(it.rarity) >= keys.indexOf("Relic")) high++;
        }
        return high / 4000;
    };
    const plain = share(1), boosted = share(2);
    restore();
    assert.ok(boosted > plain + 0.05, `boost should raise Relic+ share (${plain.toFixed(3)} → ${boosted.toFixed(3)})`);
    assert.equal(nextRarity("Cursed"), "Relic");
    assert.equal(nextRarity("Impossible"), "Impossible");
});

test("Judgement summons The Shape from 50% Observation", () => {
    const restore = seedRandom(3);
    const count = (tarot) => {
        const w = makeWorld({ observation: 60, tarot });
        let shapes = 0;
        for (let i = 0; i < 400; i++) { w.engine.enemies = []; w.engine.spawnRandomEnemy(); if (w.engine.enemies[0].type === "The Shape") shapes++; }
        return shapes;
    };
    const none = count(null), judged = count("Judgement");
    restore();
    assert.equal(none, 0, "no Shapes below 70% without Judgement");
    assert.ok(judged > 40, `Judgement should produce Shapes at 60% (${judged})`);
});

test("killing blows are attributed to whatever dealt them", () => {
    const w = makeWorld();
    w.engine.autoAttack = false;
    w.engine.spawnEnemy("Ink Redactor", w.engine.player.x + 150, w.engine.player.y);
    w.engine.player.health = 1;
    tick(w, 600);
    assert.equal(w.engine.lastDamageSource, "Ink Redactor");
});
