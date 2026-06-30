// Horror RPG Systems: Tarot, Reality Traits, Sanity, and Observation Diagnostics

export const TAROT_DECK = {
    "The Tower": {
        name: "The Tower",
        desc: "Bosses deal 30% more damage. Relic and Abyssal gear drop rate is doubled.",
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
        desc: "Enemies copy the player's elemental resistances. Gold drop yields are increased by 20%.",
        effectColor: "rgba(140, 60, 180, 0.06)"
    }
};

const WATCHER_QUOTES = [
    "Subject remains mobile. Velocity profile updated.",
    "A strange preference for blade strikes. Recorded.",
    "Bargains accepted. They exchange flesh for fleeting authority.",
    "Evidence was destroyed. The records remain incomplete.",
    "Sanity levels collapsing. The Subject's vision fractures.",
    "They returned to the same room. A predictable search vector.",
    "Observation threshold surpassed. Preparing the mirror Shape."
];

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

export function updateObservation(profile, engine) {
    // Increment base observation based on survival time and upgrades (obfuscation slows it down)
    const baseGain = 0.005; // per frame/update tick roughly
    const obfLevel = profile.upgrades.obfuscation || 0;
    const modifier = 1.0 - (obfLevel * 0.15); // 15% reduction per level
    const tarotMod = profile.activeTarot === "Judgement" ? 1.5 : 1.0;

    let totalGain = baseGain * modifier * tarotMod;
    
    // Additional gain based on player action counts
    if (engine.player.vx !== 0 || engine.player.vy !== 0) totalGain += 0.002 * modifier;
    if (engine.player.attackCooldown === engine.player.attackDelay) totalGain += 0.01 * modifier;

    profile.observation = Math.min(100, profile.observation + totalGain);

    // Diagnostics calculation
    const attacks = profile.stats.attacks || 0;
    const moves = profile.stats.movements || 0;
    const sanityLost = profile.stats.sanityLost || 0;

    let style = "Aggressive";
    if (moves > attacks * 15) style = "Evasive";
    else if (sanityLost > attacks * 2) style = "Neglectful";

    let systemsReliance = "Gear-dependent";
    const corpseActs = profile.corpses.length;
    if (corpseActs > 3) systemsReliance = "Corpse-preserving";
    else if (profile.upgrades.ritual > 2) systemsReliance = "Ritual-dependent";

    profile.activeDiagnosis = `Diagnosis: ${style} / ${systemsReliance}`;

    // Threshold Event check (Watcher signals)
    const prevObs = profile.observation - totalGain;
    
    if (prevObs < 25 && profile.observation >= 25) {
        profile.signals.unshift("Watcher Signal: Observation grid stable. Target is NOTICED. Keep recording.");
        triggerWatcherWhisper(profile);
    }
    if (prevObs < 50 && profile.observation >= 50) {
        profile.signals.unshift("Watcher Signal: Observation 50%. The Monolith actively counters your build.");
        triggerWatcherWhisper(profile);
    }
    if (prevObs < 100 && profile.observation >= 100) {
        profile.signals.unshift("Watcher Signal: Observation 100%. Maximum surveillance achieved.");
        triggerWatcherWhisper(profile);
    }
    if (prevObs < 50 && profile.observation >= 50) {
        profile.signals.unshift("Watcher Signal: Target is STUDIED. Environmental Reality Traits now active.");
    }
    if (prevObs < 75 && profile.observation >= 75) {
        profile.signals.unshift("Watcher Signal: Target is MODELED. Behavior archives syncing to entities.");
    }
    if (prevObs < 100 && profile.observation >= 100) {
        profile.signals.unshift("Watcher Signal: Shape replication COMPLETE. The Shape has been introduced to Keeping House.");
    }
}

export function triggerWatcherWhisper(profile) {
    const rIdx = Math.floor(Math.random() * WATCHER_QUOTES.length);
    const whisper = `Watcher Whisper: "${WATCHER_QUOTES[rIdx]}"`;
    
    // Add to signals
    profile.signals.unshift(whisper);
    if (profile.signals.length > 50) {
        profile.signals.pop();
    }
}

export function handleSanityDecay(profile, engine) {
    // Decay sanity slowly over time
    const baseDecay = 0.0084; // per tick
    
    // Reduced by mind upgrades and equipment sanity resistance
    const mindUp = profile.upgrades.mind || 0;
    const mindMod = 1.0 - (mindUp * 0.12); // 12% decay reduction per level
    
    const eqStats = engine.player.stats;
    const equipMod = 1.0 - (equipModCalc(eqStats.sanityResist));

    // Fast decay in dark areas (far from candles or player lantern)
    let nearLight = false;
    // Check player distance to candles
    for (const c of engine.canvasRenderer.candles) {
        let dist = engine.distance(engine.player.x, engine.player.y, c.x, c.y);
        if (dist < 90 * c.intensity) {
            nearLight = true;
            break;
        }
    }

    let lightFactor = nearLight ? 0.3 : 1.3;
    let realityMod = profile.activeRealityTrait === "Static Sky" ? 2.0 : 1.0;
    let tarotMod = profile.activeTarot === "The Devil" ? 1.5 : 1.0;

    let finalDecay = baseDecay * mindMod * equipMod * lightFactor * realityMod * tarotMod;
    
    engine.player.sanity = Math.max(0, engine.player.sanity - finalDecay);
    profile.sanity = Math.round(engine.player.sanity);
}

function equipModCalc(resist) {
    if (resist === undefined) return 0;
    if (resist > 0.8) return 0.8; // Cap equip resistance at 80%
    return resist;
}
