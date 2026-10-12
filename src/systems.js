// Horror RPG Systems: Tarot, Reality Traits, Sanity, and Observation Diagnostics

export const TAROT_DECK = {
    "The Tower": {
        name: "The Tower",
        desc: "Bosses deal 30% more damage. Gear drops reach one rarity higher, and Relic or better turns up twice as often.",
        color: "#c27329"
    },
    "The Moon": {
        name: "The Moon",
        desc: "Signals intercept twice as fast, but 40% are false or corrupted.",
        color: "#3075c7"
    },
    "The Devil": {
        name: "The Devil",
        desc: "Ritual benefits are boosted by 50%, but their Sanity costs are doubled.",
        color: "#a61515"
    },
    "Death": {
        name: "Death",
        desc: "Recovering corpses yields double gold, but unrecovered corpses spawn hostile Specters.",
        color: "#545454"
    },
    "Judgement": {
        name: "Judgement",
        desc: "Observation increases 50% faster. Enemy clones spawn more frequently.",
        color: "#dfcc10"
    },
    "The Hermit": {
        name: "The Hermit",
        desc: "Offline resource gains are increased by 40%, but sanity is strained upon return.",
        color: "#83a62d"
    }
};

export const REALITY_TRAITS = {
    "Static Sky": {
        name: "Static Sky",
        desc: "The heavens buzz. Intercepted signals auto-decode, but sanity decay rate is doubled.",
        effectColor: "rgba(100, 140, 200, 0.08)"
    },
    "Blood Rain": {
        name: "Blood Rain",
        desc: "A red drizzle washes the halls. Health healing is halved, but all physical damage is increased by 25%.",
        effectColor: "rgba(180, 20, 20, 0.07)"
    },
    "Bone Bloom": {
        name: "Bone Bloom",
        desc: "Fleshy bone flowers grow on bookshelves. Corpse actions grant 30% extra resources.",
        effectColor: "rgba(220, 210, 190, 0.05)"
    },
    "Mirror Rot": {
        name: "Mirror Rot",
        desc: "Enemies copy a share of your armor and take less from every blow. Gold drops are increased by 20%.",
        effectColor: "rgba(140, 60, 180, 0.06)"
    }
};

// A Reality Trait only bites once the Monolith has Studied you (GDD 07/08); a Tarot card is live all descent.
export const TRAIT_MIN_OBSERVATION = 50;

export function traitActive(profile, name) {
    return !!profile && profile.activeRealityTrait === name && (profile.observation || 0) >= TRAIT_MIN_OBSERVATION;
}

export function tarotActive(profile, name) {
    return !!profile && profile.activeTarot === name;
}

// Tuning for the cards and traits above, named so the engine and UI read the same numbers
export const TUNING = {
    towerBossDamage: 1.3,          // The Tower: bosses hit harder, drops reach one rarity tier higher
    devilRitualBoon: 1.5,          // The Devil: ritual rewards ×1.5 ...
    devilSanityCost: 2,            // ... and their sanity costs ×2
    bloodRainDamage: 1.25,         // Blood Rain: your physical damage up, all healing halved
    bloodRainHealing: 0.5,
    boneBloomCorpse: 1.3,          // Bone Bloom: corpse actions pay 30% more
    mirrorRotArmorShare: 0.5,      // Mirror Rot: enemies mirror half your armor rating as damage reduction
    mirrorRotGold: 1.2,
    judgementShapeObs: 50,         // Judgement: The Shape starts appearing from 50% instead of 70%
    // Floors for the percentage upgrades: even a maxed tree must never push a rate to zero or below
    minObservationRate: 0.2,
    minSanityDecayRate: 0.15
};

export function corruptText(text, sanity) {
    if (sanity >= 70) return text;
    
    // Strained (40-69): swap some letters occasionally
    // Fractured (15-39): replace whole words with redacting blocks
    // Broken (0-14): heavily garbled text
    let arr = text.split("");
    let severity = 1.0 - (sanity / 100); // 0.3 to 1.0

    for (let i = 0; i < arr.length; i++) {
        if (Math.random() < severity * 0.08) {
            if (sanity < 15) {
                // Broken: glitched glyphs
                const glyphs = ["₪", "☠", "👁", "⚖", "⎎", "█", "█", "█"];
                arr[i] = glyphs[Math.floor(Math.random() * glyphs.length)];
            } else if (sanity < 40) {
                // Fractured: redaction blocks
                if (arr[i] !== " " && i % 8 === 0) {
                    arr[i] = "█";
                }
            } else {
                // Strained: letter swap
                if (i < arr.length - 1 && arr[i] !== " " && arr[i+1] !== " ") {
                    let tmp = arr[i];
                    arr[i] = arr[i+1];
                    arr[i+1] = tmp;
                    i++;
                }
            }
        }
    }
    return arr.join("");
}

// Rates are per second of active play (frame-rate independent). Mirrored in
// tools/simulation/adapters/mock_adapter.py.
export const OBSERVATION_PER_SEC = 0.06;         // passive: ~3.6% per minute
export const OBSERVATION_MOVING_PER_SEC = 0.024; // extra while moving
export const OBSERVATION_PER_ATTACK = 0.03;      // each attack is recorded
export const SANITY_DECAY_PER_SEC = 0.12;        // before light / gear / upgrade modifiers

export function updateObservation(profile, engine, dt = 1 / 60) {
    // Increment base observation based on survival time and upgrades (obfuscation slows it down)
    const obfLevel = profile.upgrades.obfuscation || 0;
    // 15% reduction per upgrade level, then any Observation Masking worn on the body
    const gearMask = Math.min(0.5, (engine.player.stats && engine.player.stats.obfuscation) || 0);
    const modifier = Math.max(TUNING.minObservationRate, 1.0 - (obfLevel * 0.15)) * (1 - gearMask);
    const tarotMod = profile.activeTarot === "Judgement" ? 1.5 : 1.0;

    let totalGain = OBSERVATION_PER_SEC * dt * modifier * tarotMod;
    
    // Additional gain based on player actions
    if (engine.player.vx !== 0 || engine.player.vy !== 0) totalGain += OBSERVATION_MOVING_PER_SEC * dt * modifier;
    if (engine.player.attackCooldown === engine.player.attackDelay) totalGain += OBSERVATION_PER_ATTACK * modifier * tarotMod;

    profile.observation = Math.min(100, profile.observation + totalGain);

    // Threshold Event check (Watcher signals). Returns the tier crossed this tick, if any,
    // so the orchestrator can show an alert.
    const prevObs = profile.observation - totalGain;
    for (const t of OBSERVATION_TIERS) {
        if (prevObs < t.at && profile.observation >= t.at) {
            profile.signals.unshift(`Watcher Signal: Observation ${t.at}%. Target is ${t.name.toUpperCase()}. ${t.detail}`);
            return t;
        }
    }
    return null;
}

// Observation tiers: Noticed → Studied → Modeled → Known
export const OBSERVATION_TIERS = [
    { at: 25, tier: 1, name: "Noticed", detail: "The grid has your outline. Keep recording." },
    { at: 50, tier: 2, name: "Studied", detail: "Environmental Reality Traits are now active." },
    { at: 75, tier: 3, name: "Modeled", detail: "Behavior archives sync to entities. The Seal Mother stirs." },
    { at: 100, tier: 4, name: "Known", detail: "Shape replication complete. Maximum surveillance." }
];

export function handleSanityDecay(profile, engine, dt = 1 / 60) {
    // Decay sanity slowly over time
    const baseDecay = SANITY_DECAY_PER_SEC * dt;
    
    // Reduced by mind upgrades and equipment sanity resistance
    const mindUp = profile.upgrades.mind || 0;
    const mindMod = Math.max(TUNING.minSanityDecayRate, 1.0 - (mindUp * 0.12)); // 12% decay reduction per level
    
    const eqStats = engine.player.stats;
    const equipMod = 1.0 - (equipModCalc(eqStats.sanityResist));

    // Fast decay in dark areas (far from candles or player lantern)
    let nearLight = false;
    // Check player distance to candles
    for (const c of engine.canvasRenderer.candles) {
        if (c.snuffed) continue;     // a flame the Monolith has put out gives no comfort
        let dist = engine.distance(engine.player.x, engine.player.y, c.x, c.y);
        if (dist < 90 * c.intensity) {
            nearLight = true;
            break;
        }
    }

    let lightFactor = nearLight ? 0.3 : 1.3;
    // Static Sky doubles decay, but only once the Monolith has Studied the player
    let realityMod = traitActive(profile, "Static Sky") ? 2.0 : 1.0;

    let finalDecay = baseDecay * mindMod * equipMod * lightFactor * realityMod;
    
    engine.player.sanity = Math.max(0, engine.player.sanity - finalDecay);
    profile.sanity = Math.round(engine.player.sanity);
}

function equipModCalc(resist) {
    if (resist === undefined) return 0;
    if (resist > 0.8) return 0.8; // Cap equip resistance at 80%
    return resist;
}
