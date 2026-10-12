// Headless harness: the real GameEngine and systems, driven without a browser or canvas.
import { GameEngine } from "../src/engine.js";
import { createProfile, getEquipmentStats } from "../src/state.js";

// Deterministic Math.random for scenarios that need repeatable rolls
export function seedRandom(seed = 1) {
    let s = seed >>> 0;
    const real = Math.random;
    Math.random = () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return () => { Math.random = real; };
}

export function makeWorld({ classType = "Blood Marked", observation = 0, tarot = null, trait = null, level = 1, sanity = 100 } = {}) {
    const profile = createProfile("Tester", classType);
    profile.level = level;
    profile.observation = observation;
    profile.sanity = sanity;
    profile.activeTarot = tarot;
    profile.activeRealityTrait = trait;

    const engine = new GameEngine();
    engine.reset();
    const stats = getEquipmentStats(profile);
    engine.setPlayer(profile, stats);
    engine.player.sanity = sanity;
    // Just enough renderer for the engine's optional effects and the sanity-decay light check
    engine.canvasRenderer = { candles: [], triggerShake() {}, triggerDamageFlash() {} };
    return { engine, profile, events: [] };
}

// Advance the engine n ticks, collecting emitted events
export function tick(world, n = 1) {
    for (let i = 0; i < n; i++) world.engine.update((event, data) => world.events.push({ event, data }));
}
