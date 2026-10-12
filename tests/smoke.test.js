import test from "node:test";
import assert from "node:assert/strict";
import { makeWorld, tick, seedRandom } from "./helpers.js";

test("headless engine runs and a spawned enemy chases and hurts the player", () => {
    const restore = seedRandom(7);
    const w = makeWorld();
    w.engine.autoAttack = false;
    w.engine.spawnEnemy("Cabinet Indexer", w.engine.player.x + 60, w.engine.player.y);
    const hp0 = w.engine.player.health;
    tick(w, 240);
    restore();
    assert.ok(w.engine.player.health < hp0, "indexer should have landed a hit");
    assert.equal(w.engine.lastDamageSource, "Cabinet Indexer");
});
