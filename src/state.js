// State Management and Persistence

export const CLASSES = {
    "Blood Marked": {
        name: "Blood Marked",
        desc: "Aggressive melee fighter. High risk, high damage, relies on blood-letting.",
        baseHealth: 150,
        baseDamage: 25,
        baseCrit: 0.15,
        baseSpeed: 3.5,
        initialGear: {
            weapon: { name: "Rusted Cleaver", type: "weapon", rarity: "Worn", damage: 10, crit: 0.05, icon: "assets/gear/blood_axe/blood_axe_base.png", desc: "A heavy, notch-marked blade, smelling faintly of old iron." },
            armor: { name: "Tattered Bloodband", type: "armor", rarity: "Worn", health: 20, armor: 2, icon: "assets/gear/blood_talisman/blood_talisman_base.png", desc: "Cloth stiffened with dried, ancient fluids." },
            amulet: { name: "Coiled Suture", type: "amulet", rarity: "Worn", sanityResist: 0.05, icon: "assets/gear/abyssal_charm/abyssal_charm_base.png", desc: "A red thread charm tied in a binding knot." }
        }
    },
    "Signal Marked": {
        name: "Signal Marked",
        desc: "Occult reader. Manipulates static warnings and reality perception.",
        baseHealth: 100,
        baseDamage: 18,
        baseCrit: 0.10,
        baseSpeed: 3.8,
        initialGear: {
            weapon: { name: "Static Rod", type: "weapon", rarity: "Worn", damage: 8, crit: 0.05, signalClarity: 0.20, icon: "assets/gear/signal_staff/signal_staff_base.png", desc: "A metal antenna that hums when close to the Monolith." },
            armor: { name: "Redacted Cloak", type: "armor", rarity: "Worn", health: 15, armor: 1, sanityResist: 0.10, icon: "assets/gear/obfuscation_cloak/obfuscation_cloak_base.png", desc: "Faded fabric with lines of text ink-brushed out." },
            amulet: { name: "Cracked Glass Eye", type: "amulet", rarity: "Worn", sanityResist: 0.15, icon: "assets/gear/watcher_ring/watcher_ring_base.png", desc: "Stares back into the dark; helps decode warning signals." }
        }
    },
    "Bone Marked": {
        name: "Bone Marked",
        desc: "Defensive survivor. Uses corpse armor and attrition combat to stay alive.",
        baseHealth: 180,
        baseDamage: 15,
        baseCrit: 0.05,
        baseSpeed: 3.0,
        initialGear: {
            weapon: { name: "Splintered Rib", type: "weapon", rarity: "Worn", damage: 6, healthRegen: 1, icon: "assets/gear/bone_mask/bone_mask_base.png", desc: "A heavy bone sharpened to a crude point." },
            armor: { name: "Cage Mail", type: "armor", rarity: "Worn", health: 40, armor: 6, icon: "assets/gear/bone_plate_armor/bone_plate_armor_base.png", desc: "Iron rings bound together with animal sinew." },
            amulet: { name: "Finger Bone Rosary", type: "amulet", rarity: "Worn", health: 15, icon: "assets/gear/corpse_jaw_amulet/corpse_jaw_amulet_base.png", desc: "A string of hollow joints that rattle in the wind." }
        }
    },
    "Static Marked": {
        name: "Static Marked",
        desc: "Fast attacker. Relies on crit, evasion, and unstable reality distortions.",
        baseHealth: 110,
        baseDamage: 20,
        baseCrit: 0.25,
        baseSpeed: 4.5,
        initialGear: {
            weapon: { name: "Flickering Stiletto", type: "weapon", rarity: "Worn", damage: 12, crit: 0.10, icon: "assets/gear/static_dagger/static_dagger_base.png", desc: "A slender spike that seems to vibrate between dimensions." },
            armor: { name: "Scraped Shroud", type: "armor", rarity: "Worn", health: 15, armor: 2, speed: 0.5, icon: "assets/gear/hollow_gravity_boots/hollow_gravity_boots_base.png", desc: "Lightweight leather wraps allowing silent step." },
            amulet: { name: "Unstable Seal", type: "amulet", rarity: "Worn", crit: 0.05, icon: "assets/gear/cracked_mirror_shield/cracked_mirror_shield_base.png", desc: "A wax seal that crumbles and reforms constantly." }
        }
    },
    "Ritual Marked": {
        name: "Ritual Marked",
        desc: "Bargain maker. Summons hexes and channels power at a heavy cost.",
        baseHealth: 120,
        baseDamage: 22,
        baseCrit: 0.08,
        baseSpeed: 3.4,
        initialGear: {
            weapon: { name: "Hanging Ledger", type: "weapon", rarity: "Worn", damage: 14, ritualSuccess: 0.15, icon: "assets/gear/red_ledger_offhand/red_ledger_offhand_base.png", desc: "A heavy, metal-bound book detailing debt structures." },
            armor: { name: "Wax-Sealed Vest", type: "armor", rarity: "Worn", health: 25, armor: 3, icon: "assets/gear/black_offering_bowl/black_offering_bowl_base.png", desc: "Lined with holy symbols melted in red wax." },
            amulet: { name: "Devil's Hand", type: "amulet", rarity: "Worn", baseDamage: 5, sanityResist: -0.05, icon: "assets/gear/ritual_chain/ritual_chain_base.png", desc: "A dried hand claw. Increases damage but drains sanity resistance." }
        }
    }
};

export const ITEMS_POOL = [
    // Weapons
    { name: "Iron Quill", type: "weapon", rarities: ["Worn", "Unsettling", "Cursed"], stat: "damage", min: 8, max: 28, icon: "assets/gear/ritual_blade/ritual_blade_base.png", desc: "Sharp enough to write in flesh." },
    { name: "Page-Cutter", type: "weapon", rarities: ["Unsettling", "Cursed", "Relic"], stat: "damage", min: 14, max: 40, icon: "assets/gear/static_dagger/static_dagger_base.png", desc: "Guillotine blade scaled down for personal use." },
    { name: "Whispering Rapier", type: "weapon", rarities: ["Cursed", "Relic", "Abyssal"], stat: "damage", min: 20, max: 65, crit: 0.12, icon: "assets/gear/knife_that_remembers/knife_that_remembers_base.png", desc: "It directs your arm toward the softest pulse." },
    { name: "Epitaph Blade", type: "weapon", rarities: ["Relic", "Abyssal", "Impossible"], stat: "damage", min: 35, max: 110, crit: 0.20, icon: "assets/gear/memory_blade/memory_blade_base.png", desc: "Carved with the names of those who failed to hold it." },
    
    // Armors
    { name: "Parchment Vestment", type: "armor", rarities: ["Worn", "Unsettling", "Cursed"], stat: "health", min: 20, max: 80, armor: 2, icon: "assets/gear/obfuscation_cloak/obfuscation_cloak_base.png", desc: "Wrapped layers of archive records. Desaturated and brittle." },
    { name: "Indexer's Apron", type: "armor", rarities: ["Unsettling", "Cursed", "Relic"], stat: "health", min: 45, max: 140, armor: 5, icon: "assets/gear/bone_plate_armor/bone_plate_armor_base.png", desc: "Heavy leather stained with dark black ink and old grease." },
    { name: "Redacted Mail", type: "armor", rarities: ["Cursed", "Relic", "Abyssal"], stat: "health", min: 80, max: 240, armor: 10, sanityResist: 0.15, icon: "assets/gear/redacted_mail/redacted_mail_base.png", desc: "Reduces incoming damage and shields the wearer's details from study." },
    { name: "Shroud of the Seal Mother", type: "armor", rarities: ["Relic", "Abyssal", "Impossible"], stat: "health", min: 150, max: 450, armor: 18, sanityResist: 0.25, icon: "assets/gear/static_robe/static_robe_base.png", desc: "A heavy, wax-stiffened drape that smells of candle smoke." },

    // Amulets
    { name: "Wax Seal Pendant", type: "amulet", rarities: ["Worn", "Unsettling", "Cursed"], stat: "sanityResist", min: 0.05, max: 0.20, icon: "assets/gear/blood_talisman/blood_talisman_base.png", desc: "A stamped symbol of authority from the Keeping House." },
    { name: "Cabinet Key", type: "amulet", rarities: ["Unsettling", "Cursed", "Relic"], stat: "signalClarity", min: 0.10, max: 0.35, icon: "assets/gear/impossible_key/impossible_key_base.png", desc: "Unlocks forgotten drawers. Clarifies incoming signals." },
    { name: "Lantern of Wrong Signals", type: "amulet", rarities: ["Cursed", "Relic", "Abyssal"], stat: "crit", min: 0.08, max: 0.22, sanityResist: -0.10, icon: "assets/gear/lantern_of_wrong_signals/lantern_of_wrong_signals_base.png", desc: "More signals appear, but some are false whispers." },
    { name: "Eye of the Monolith", type: "amulet", rarities: ["Relic", "Abyssal", "Impossible"], stat: "baseDamage", min: 15, max: 50, crit: 0.15, icon: "assets/gear/watcher_ring/watcher_ring_base.png", desc: "Stares back into your soul. Grants incredible power at the cost of being observed." }
];

export const RARITY_MULTIPLIERS = {
    "Worn": { mult: 1.0, color: "#888888" },
    "Unsettling": { mult: 1.5, color: "#4a7ebb" },
    "Cursed": { mult: 2.2, color: "#9a4ab8" },
    "Relic": { mult: 3.2, color: "#d48122" },
    "Abyssal": { mult: 4.5, color: "#c82727" },
    "Impossible": { mult: 6.5, color: "#16d8a4" }
};

export function generateLootItem(rarityLimit = "Cursed") {
    // Pick an item archetype
    const archetype = ITEMS_POOL[Math.floor(Math.random() * ITEMS_POOL.length)];
    
    // Choose rarity
    const availableRarities = archetype.rarities.filter(r => {
        // Simple rarity tier filtering
        const keys = Object.keys(RARITY_MULTIPLIERS);
        return keys.indexOf(r) <= keys.indexOf(rarityLimit);
    });
    const rarity = availableRarities.length > 0 
        ? availableRarities[Math.floor(Math.random() * availableRarities.length)]
        : archetype.rarities[0];

    const rData = RARITY_MULTIPLIERS[rarity];
    const range = archetype.max - archetype.min;
    const baseVal = Math.round(archetype.min + Math.random() * range);
    const value = Math.round(baseVal * rData.mult);

    const item = {
        name: archetype.name,
        type: archetype.type,
        rarity: rarity,
        color: rData.color,
        icon: archetype.icon,
        desc: archetype.desc
    };

    if (archetype.stat === "damage") {
        item.damage = value;
    } else if (archetype.stat === "health") {
        item.health = value;
        item.armor = Math.round((archetype.armor || 2) * rData.mult);
    } else if (archetype.stat === "sanityResist") {
        item.sanityResist = Number((value / 100).toFixed(2));
    } else if (archetype.stat === "signalClarity") {
        item.signalClarity = Number((value / 100).toFixed(2));
    } else if (archetype.stat === "crit") {
        item.crit = Number((value / 100).toFixed(2));
    } else if (archetype.stat === "baseDamage") {
        item.baseDamage = value;
    }

    // Add random sub-affix if higher rarity
    if (rarity === "Cursed" || rarity === "Relic" || rarity === "Abyssal" || rarity === "Impossible") {
        const affixes = [
            { key: "crit", val: 0.05, label: "+5% Critical Hit Chance" },
            { key: "speed", val: 0.3, label: "+0.3 Movement Speed" },
            { key: "sanityResist", val: 0.08, label: "+8% Sanity Resistance" },
            { key: "goldFind", val: 0.15, label: "+15% Extra Gold Found" },
            { key: "obfuscation", val: 0.10, label: "+10% Observation Masking" }
        ];
        const chosen = affixes[Math.floor(Math.random() * affixes.length)];
        item.affix = chosen;
    }

    return item;
}

export function getEquipmentStats(profile) {
    const stats = {
        damage: 0,
        health: 0,
        armor: 0,
        sanityResist: 0,
        signalClarity: 0,
        crit: 0,
        speed: 0,
        obfuscation: 0,
        goldFind: 0
    };

    if (!profile || !profile.gear) return stats;

    for (const slot of ["weapon", "armor", "amulet"]) {
        const item = profile.gear[slot];
        if (!item) continue;

        if (item.damage) stats.damage += item.damage;
        if (item.health) stats.health += item.health;
        if (item.armor) stats.armor += item.armor;
        if (item.sanityResist) stats.sanityResist += item.sanityResist;
        if (item.signalClarity) stats.signalClarity += item.signalClarity;
        if (item.crit) stats.crit += item.crit;
        if (item.baseDamage) stats.damage += item.baseDamage;
        if (item.speed) stats.speed += item.speed;

        // Check sub-affix
        if (item.affix) {
            stats[item.affix.key] = (stats[item.affix.key] || 0) + item.affix.val;
        }
    }

    return stats;
}

export function createProfile(name, classType) {
    const classData = CLASSES[classType] || CLASSES["Blood Marked"];
    const id = "profile_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    
    return {
        id: id,
        name: name,
        classType: classType,
        level: 1,
        exp: 0,
        monolithLevel: 1,
        gold: 0,
        parchment: 3,
        ink: 0,
        waxSeals: 0,
        health: classData.baseHealth,
        maxHealth: classData.baseHealth,
        sanity: 100,
        gear: JSON.parse(JSON.stringify(classData.initialGear)),
        inventory: [],
        observation: 0,
        activeDiagnosis: "Unread / Fresh",
        signals: [
            "Intercepted Broadcast: Target 'The Marked' designated. Monolith observation grid online.",
            "Watcher Whisper: A new shape is introduced to the ledger. Let us record how long they stand."
        ],
        corpses: [],
        upgrades: { body: 0, mind: 0, ritual: 0, obfuscation: 0 },
        longestLife: 0,
        currentLifeDuration: 0,
        stats: { attacks: 0, movements: 0, sanityLost: 0, deaths: 0 },
        lastTimestamp: Date.now(),
        tutorialStep: 0
    };
}

export function loadProfiles() {
    let returnData = {
        version: 1,
        activeProfileId: null,
        profiles: [],
        global: { totalProfilesCreated: 0, achievements: [] },
        archive: {
            memoryFragments: 0,
            upgrades: {
                baseHealth: 0,
                baseDamage: 0,
                startingGold: 0
            }
        }
    };

    try {
        const data = localStorage.getItem("the_marked_save_data");
        if (data) {
            const parsed = JSON.parse(data);
            if (parsed && parsed.profiles) {
                returnData = parsed;
                // Ensure archive exists in older saves
                if (!returnData.archive) {
                    returnData.archive = {
                        memoryFragments: 0,
                        upgrades: {
                            baseHealth: 0,
                            baseDamage: 0,
                            startingGold: 0
                        }
                    };
                }
            }
        }
    } catch (e) {
        console.error("Failed to parse save data:", e);
    }
    
    return returnData;
}

export function getArchiveStats(archive) {
    if (!archive || !archive.upgrades) return { health: 0, damage: 0, gold: 0 };
    return {
        health: archive.upgrades.baseHealth * 25,
        damage: archive.upgrades.baseDamage * 5,
        gold: archive.upgrades.startingGold * 50
    };
}

export function saveProfiles(profilesData) {
    localStorage.setItem("the_marked_save_data", JSON.stringify(profilesData));
}
