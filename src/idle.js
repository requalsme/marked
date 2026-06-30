// Offline Progress Simulation Engine

export function calculateOfflineProgress(profile) {
    const now = Date.now();
    const lastTime = profile.lastTimestamp || now;
    const diffMs = now - lastTime;
    const diffSec = Math.floor(diffMs / 1000);

    // Only reward if absent for more than 2 minutes (120 seconds)
    if (diffSec < 120) {
        profile.lastTimestamp = now;
        return null;
    }

    // Cap offline progress at 12 hours to prevent infinite free scaling
    const maxOffline = 12 * 60 * 60; // 43200 seconds
    const actualOffline = Math.min(diffSec, maxOffline);

    // Calculate survival chances (based on Class and Upgrades)
    // Upgrades body level increases survival percentage
    const bodyUp = profile.upgrades.body || 0;
    const mindUp = profile.upgrades.mind || 0;
    const obfUp = profile.upgrades.obfuscation || 0;

    let baseSurvivalChance = 0.65 + (bodyUp * 0.05); // up to 90%
    if (baseSurvivalChance > 0.95) baseSurvivalChance = 0.95;

    // Actual survived time offline
    const survivedSec = Math.floor(actualOffline * baseSurvivalChance);
    const survivedMin = survivedSec / 60;

    // Math accruals
    const expGained = Math.round(survivedMin * 8);
    const goldGained = Math.min(Math.round(survivedMin * 0.1), 150);
    
    // Rare materials
    let parchmentGained = 0;
    let inkGained = 0;
    let waxSealsGained = 0;

    for (let m = 0; m < survivedMin; m++) {
        if (Math.random() < 0.15) parchmentGained++;
        if (Math.random() < 0.08) inkGained++;
        if (Math.random() < 0.04) waxSealsGained++;
    }

    // Sanity pressure offline
    let sanityDrained = Math.round(survivedMin * 0.35 * (1.0 - mindUp * 0.10));
    if (profile.activeTarot === "The Hermit") {
        sanityDrained = Math.round(sanityDrained * 1.5);
    }
    const finalSanity = Math.max(0, profile.sanity - sanityDrained);
    const actualSanityLost = profile.sanity - finalSanity;
    profile.sanity = finalSanity;

    // Observation increase offline
    let obsGained = survivedMin * 0.08 * (1.0 - obfUp * 0.12);
    if (profile.activeTarot === "Judgement") obsGained *= 1.5;
    profile.observation = Math.min(100, profile.observation + obsGained);

    // Loot drops rolling
    const gearRecovered = [];
    let lootRolls = Math.floor(survivedMin / 15); // one item check per 15 minutes survived
    if (lootRolls > 0) {
        import("./state.js").then(stateMod => {
            for (let r = 0; r < lootRolls; r++) {
                if (Math.random() < 0.30 && profile.inventory.length < 15) {
                    const item = stateMod.generateLootItem("Cursed");
                    profile.inventory.push(item);
                    gearRecovered.push(item);
                }
            }
        });
    }

    // Apply gains
    profile.exp += expGained;
    profile.gold += goldGained;
    profile.parchment += parchmentGained;
    profile.ink += inkGained;
    profile.waxSeals += waxSealsGained;
    profile.lastTimestamp = now;

    // Watcher offline evaluation
    let offlineConclusion = "Subject shows static patterns.";
    if (goldGained > 100) offlineConclusion = "High resource extraction detected. Re-evaluating threat.";
    if (actualSanityLost > 40) offlineConclusion = "Mind fracturing under absence pressure. Model fragile.";
    if (survivedMin > 200) offlineConclusion = "Prolonged survival event observed. Shape replication accelerated.";

    // Hours display formatting
    const totalHrs = (diffSec / 3600).toFixed(2);
    const survivedHrs = (survivedSec / 3600).toFixed(2);

    return {
        absenceHours: totalHrs,
        survivedHours: survivedHrs,
        exp: expGained,
        gold: goldGained,
        parchment: parchmentGained,
        ink: inkGained,
        waxSeals: waxSealsGained,
        sanityLost: actualSanityLost,
        observationIncrease: obsGained.toFixed(1),
        gearCount: gearRecovered.length,
        conclusion: offlineConclusion
    };
}
