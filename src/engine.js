// Physics, Collision, and Entity Management
import { audioManager } from "./audio.js";
import { WORLD_WIDTH, WORLD_HEIGHT, ROOM, walkableX } from "./world.js";
import { PROP_COLLIDERS } from "./props.js";
import { FIXTURE_COLLIDERS } from "./fixtures.js";
import { traitActive, tarotActive, TUNING } from "./systems.js";
import { recordEvent } from "./dossier.js";

// ─── Tuning constants ────────────────────────────────────────────────────────
export const PLAYER_BASE_SPEED = 4.5;        // px/frame; Static Marked gets +1
export const PLAYER_DASH_MULT = 2.5;
export const DEATH_ANIMATION_FRAMES = 75;    // collapse + slow fade before game over
export const PLAYER_KNOCKBACK = 5;           // initial px/frame push when the player is hit
export const ENEMY_KNOCKBACK = 6;            // initial px/frame push when an enemy is hit
export const KNOCKBACK_DAMPING = 0.78;       // velocity multiplier per frame (vx *= ...)
export const BASE_MAX_ENEMIES = 4;           // grows with Observation, see maxEnemies()
export const BOSS_OBSERVATION_THRESHOLD = 75;
export const CONFRONTATION_INTERVAL = 600;   // seconds of survival between Watcher Confrontations
export const CONFRONTATION_OBSERVATION = 10; // Observation added per confrontation
export const ENEMY_SCALING_PER_LEVEL = 0.12;  // +12% enemy health/damage per player level above 1
export const BLOOD_VIAL_CHANCE = 0.15;        // share of drops that are healing vials
export const BLOOD_VIAL_HEAL_PCT = 0.20;      // of max health
export const CORPSE_RISE_CHANCE = 0.25;       // an unrecovered corpse stirs as the player nears it

// The Monolith counters what survives: enemies grow with the player's level
export function enemyScale(level) {
    return 1 + ENEMY_SCALING_PER_LEVEL * Math.max(0, (level || 1) - 1);
}

export function basePlayerSpeed(classType) {
    return PLAYER_BASE_SPEED + (classType === "Static Marked" ? 1 : 0);
}

export function basePlayerDamage(classType) {
    return classType === "Blood Marked" ? 25 : 18;
}

// Total attack damage: class base + gear + permanent ritual/corpse bonuses
export function playerDamage(profile, gearDamage = 0) {
    const flat = basePlayerDamage(profile.classType) + gearDamage + (profile.ritualDamage || 0);
    return Math.round(flat * (profile.devourMult || 1));
}

export function basePlayerCrit(classType) {
    return classType === "Static Marked" ? 0.25 : 0.10;
}

// Who fights how (counters key off this)
const MELEE_ENEMIES = new Set(["Cabinet Indexer", "Witness Chair", "Corpse Echo", "The Shape"]);

// What an enemy that shoots, shoots
const ENEMY_SHOTS = {
    "Ink Redactor": { type: "ink_blot", sanityDamage: 12, speed: 5.5, color: "#000000", radius: 8, life: 80 },
    "Paper Wraith": { type: "shadow_wave", sanityDamage: 7, speed: 6, color: "#f1e2b7", radius: 13, life: 38 }
};

// The Shape fights with the player's own class: same attack, same reach, in the Monolith's colours
const SHAPE_ATTACKS = {
    "Signal Marked": { type: "static_spark", speed: 9, life: 45, radius: 8, color: "#7a5fd0", range: 330, cooldown: 56 },
    "Static Marked": { type: "blade_dash", speed: 4, life: 15, radius: 15, color: "#3d1052", range: 64, cooldown: 40 },
    "Blood Marked": { type: "blood_cleave", speed: 6, life: 20, radius: 20, color: "#6a0d2a", range: 118, cooldown: 60 },
    "default": { type: "sword_slash", speed: 5, life: 20, radius: 14, color: "#3d1052", range: 100, cooldown: 54 }
};

// Particle colours that are liquids: they fly as drops and stain the floor
const LIQUIDS = {
    "#9a1616": "blood", "#3a0808": "blood", "#7a0c0c": "blood", "#b01212": "blood", "#000000": "ink"
};

export class GameEngine {
    constructor() {
        this.width = WORLD_WIDTH;
        this.height = WORLD_HEIGHT;
        
        // Walkable boundaries (Keeping House floor plane)
        this.bounds = { ...ROOM.bounds };

        this.reset();
    }

    reset() {
        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.decals = [];     // stains waiting for the renderer to press into the floor
        this.decalEpoch = (this.decalEpoch || 0) + 1; // a new run starts on a clean floor
        this.floatingTexts = [];
        this.deathFx = [];   // enemy death animations playing out
        this.loot = [];
        this.interactables = []; // Altars, Corpses
        
        this.keys = {};
        this.mouse = { x: 0, y: 0, click: false, clickX: 0, clickY: 0 };
        this.autoAttack = true; // Idle assistance by default
        
        this.enemySpawnTimer = 0;
        this.spawnDelay = 4000; // spawn every 4s
        this.bossSpawned = false;
        
        this.tick = 0;        // frames of play, for timers that outlive an entity
        this.counters = {};   // habit -> power: what the Monolith is currently using against the player
        this.altarTimer = 0;
        for (const c of ROOM.candles) { c.snuffed = false; c.relightAt = 0; }
        this.hitStop = 0; // Frames to freeze the engine
        this.bossDefeated = false;
        this.bossAnnounced = false;
        
        // Static Obstacles in Keeping House. These are collision shapes for sprite props.
        this.obstacles = ROOM.obstacles.map(o => ({ ...o })).concat([...PROP_COLLIDERS, ...FIXTURE_COLLIDERS].map(c => ({ ...c })));
    }

    setPlayer(profile, extraStats) {
        this.player = {
            profile: profile,
            stats: extraStats,
            x: ROOM.playerStart.x,
            y: ROOM.playerStart.y,
            vx: 0,
            vy: 0,
            kbVx: 0,
            kbVy: 0,
            radius: 16,
            health: profile.health,
            maxHealth: profile.maxHealth + extraStats.health,
            speed: basePlayerSpeed(profile.classType) + (extraStats.speed || 0),
            damage: playerDamage(profile, extraStats.damage || 0),
            crit: basePlayerCrit(profile.classType) + (extraStats.crit || 0),
            sanity: profile.sanity,
            attackCooldown: 0,
            attackDelay: 45, // frames between attacks
            invulnTimer: 0,
            facing: "right",
            state: "idle", // idle, moving, attacking, dead
            deathTimer: 0,
            dashTimer: 0,
            dashCooldown: 0,
            dashDx: 0,
            dashDy: 0,
            currentLifeDuration: profile.currentLifeDuration || 0,
            confrontationWave: Math.floor((profile.currentLifeDuration || 0) / CONFRONTATION_INTERVAL)
        };
    }

    addInteractable(type, x, y, data) {
        this.interactables.push({
            type: type, // "altar" | "corpse"
            x: x,
            y: y,
            radius: 25,
            data: data
        });
    }

    spawnLoot(x, y, rarityLimit = "Cursed") {
        import("./state.js").then(stateMod => {
            // The Tower: gear reaches one rarity higher, and Relic or better turns up twice as often
            const tower = tarotActive(this.player.profile, "The Tower");
            if (tower) rarityLimit = stateMod.nextRarity(rarityLimit);
            const rand = Math.random();
            let lootType = "loot_satchel";
            let item = null;
            let gold = 0;
            let parchment = 0;
            let ink = 0;
            let sanityRestore = 0;
            let healPct = 0;

            if (rand < BLOOD_VIAL_CHANCE) {
                lootType = "blood_vial";
                healPct = BLOOD_VIAL_HEAL_PCT;
            } else if (rand < BLOOD_VIAL_CHANCE + 0.20) {
                lootType = "cursed_gear_drop";
                item = stateMod.generateLootItem(rarityLimit, tower ? 2 : 1);
            } else if (rand < BLOOD_VIAL_CHANCE + 0.40) {
                lootType = "sanity_shard";
                sanityRestore = 15;
            } else if (rand < BLOOD_VIAL_CHANCE + 0.60) {
                lootType = "signal_fragment";
                parchment = 1;
                ink = Math.random() < 0.5 ? 1 : 0;
            } else {
                lootType = "loot_satchel";
                gold = Math.round(15 + Math.random() * 25);
            }

            this.loot.push({
                id: lootType,
                x: x,
                y: y,
                item: item,
                gold: gold,
                parchment: parchment,
                ink: ink,
                sanityRestore: sanityRestore,
                healPct: healPct,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4 - 3,
                groundY: y + 8 + Math.random() * 14,
                bounce: 0,
                grav: 0.25,
                age: 0
            });
        });
    }

    spawnEnemy(type, x, y) {
        let e = {
            type: type,
            x: x,
            y: y,
            vx: 0,
            vy: 0,
            radius: 18,
            health: 45,
            maxHealth: 45,
            damage: 8,
            speed: 1.5,
            state: "walk",
            attackCooldown: 0,
            behaviorTimer: 0,
            kbVx: 0,
            kbVy: 0,
            hitFlash: 0,
            lootRarity: "Worn"
        };

        if (type === "Cabinet Indexer") {
            e.health = e.maxHealth = 40;
            e.speed = 1.2;
            e.damage = 10;
        } else if (type === "Ink Redactor") {
            e.health = e.maxHealth = 30;
            e.speed = 1.6;
            e.damage = 6;
            e.shootCooldown = 60;
        } else if (type === "Paper Wraith") {
            e.health = e.maxHealth = 55;
            e.radius = 19;
            e.speed = 1.75;
            e.damage = 9;
            e.lootRarity = "Unsettling";
        } else if (type === "Witness Chair") {
            e.health = e.maxHealth = 100;
            e.radius = 24;
            e.speed = 2.0;
            e.damage = 15;
            e.lootRarity = "Unsettling";
        } else if (type === "Seal Mother") {
            e.health = e.maxHealth = 600;
            e.radius = 28;
            e.speed = 1.35;
            e.damage = 18;
            e.lootRarity = "Cursed";
            this.bossSpawned = true;
        }

        if (type === "The Shape") {
            // Player clone
            e.health = e.maxHealth = this.player.maxHealth * 0.8;
            e.radius = 16;
            e.speed = this.player.speed * 0.75;
            e.damage = this.player.damage * 0.6;
            e.lootRarity = "Relic";
        } else {
            // The Shape already mirrors the player's stats; everything else scales with level
            const scale = enemyScale(this.player.profile.level);
            e.health = e.maxHealth = Math.round(e.health * scale);
            e.damage = Math.round(e.damage * scale);
            if (type === "Seal Mother" && tarotActive(this.player.profile, "The Tower")) {
                e.damage = Math.round(e.damage * TUNING.towerBossDamage);
            }
        }

        this.enemies.push(e);
        this.createParticleExplosion(x, y, "#000000", 15);
    }

    spawnCorpseEcho(corp) {
        let e = {
            type: "Corpse Echo",
            x: corp.x,
            y: corp.y,
            vx: 0,
            vy: 0,
            radius: 18,
            health: 80 + (corp.level * 15),
            maxHealth: 80 + (corp.level * 15),
            damage: 15 + (corp.level * 2),
            speed: 2.2,
            state: "walk",
            attackCooldown: 0,
            behaviorTimer: 0,
            lootRarity: "Cursed",
            kbVx: 0,
            kbVy: 0,
            hitFlash: 0,
            classType: corp.classType // "Blood Marked" etc
        };
        this.enemies.push(e);
        this.createParticleExplosion(e.x, e.y, "#9a1616", 15);
    }

    createParticleExplosion(x, y, color, count) {
        const liquid = LIQUIDS[color];
        for (let i = 0; i < count; i++) {
            if (liquid) {
                // Drops thrown up from the wound, arcing down to stain the floor
                const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 2.6;
                this.particles.push({
                    x, y, z: 16 + Math.random() * 22,
                    vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, vz: 1 + Math.random() * 2.8,
                    color, liquid, alpha: 1, decay: 0, size: 1.2 + Math.random() * 2.2
                });
                continue;
            }
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: (Math.random() - 0.5) * 6,
                color: color,
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.03,
                size: 2 + Math.random() * 3
            });
        }
    }

    spawnProjectiles(owner, x, y, tx, ty, type = "sword_slash", properties = {}) {
        let angle = Math.atan2(ty - y, tx - x);
        let p = {
            owner: owner, // "player" | "enemy"
            source: owner === "enemy" ? (properties.source || this.currentActor || null) : null,
            type: type,
            x: x,
            y: y,
            vx: Math.cos(angle) * (properties.speed || 8),
            vy: Math.sin(angle) * (properties.speed || 8),
            damage: properties.damage || 10,
            crit: properties.crit || 0,
            sanityDamage: properties.sanityDamage || 0,
            radius: properties.radius || 10,
            life: properties.life || 30, // frames to live
            color: properties.color || "#cccccc",
            angle: angle
        };
        this.projectiles.push(p);
        if (owner === "enemy") audioManager.play("projectile_fire", { pan: this.panFor(x) });
    }

    update(onEvent) {
        if (!this.player) return;

        if (this.hitStop > 0) {
            this.hitStop--;
            // Still update particles and floating texts so they animate during hit-stop!
            this.updateParticles();
            this.updateFloatingTexts();
            return;
        }

        // Player updates
        if (this.player.health <= 0) {
            this.player.state = "dead";
            this.player.deathTimer++;
            // World keeps drifting in slow motion while the body collapses
            if (this.player.deathTimer % 3 === 0) {
                this.updateEnemies(() => {});
                this.updateProjectiles(() => {});
            }
            this.updateFloatingTexts();
            if (this.player.deathTimer === DEATH_ANIMATION_FRAMES) {
                // Inform orchestrator that player collapsed
                onEvent("player_died", { x: this.player.x, y: this.player.y });
            }
            this.updateParticles();
            return;
        }

        this.tick++;
        this.player.currentLifeDuration += 1 / 60;
        this.player.profile.currentLifeDuration = this.player.currentLifeDuration;
        this.player.profile.stats.activeSeconds = (this.player.profile.stats.activeSeconds || 0) + 1 / 60;

        // Recurring pressure: every CONFRONTATION_INTERVAL seconds alive, the Watcher
        // confronts the player with an escalating wave. Surviving longer gets harder.
        const wave = Math.floor(this.player.currentLifeDuration / CONFRONTATION_INTERVAL);
        if (wave > (this.player.confrontationWave || 0)) {
            this.player.confrontationWave = wave;
            this.triggerConfrontation(wave, onEvent);
        }

        if (this.player.invulnTimer > 0) this.player.invulnTimer--;

        // Gear regeneration (healthRegen = HP per second)
        if (this.player.stats.healthRegen > 0 && this.player.health < this.player.maxHealth) {
            this.player.health = Math.min(this.player.maxHealth, this.player.health + this.healingMult() * this.player.stats.healthRegen / 60);
        }
        if (this.player.attackCooldown > 0) this.player.attackCooldown--;
        if (this.player.dashCooldown > 0) this.player.dashCooldown--;

        this.handlePlayerMovement();
        
        // No attacking while dashing
        if (this.player.dashTimer <= 0) {
            this.handlePlayerActions();
        }

        // Environment updates
        this.updateEnemies(onEvent);
        this.updateProjectiles(onEvent);
        this.updateParticles();
        this.updateDeathFx();
        this.updateFloatingTexts();
        this.updateLoot();
        this.updateInteractables();
        this.updateBargainTraps(onEvent);
        this.updateCandles(onEvent);
        this.updateCorpses(onEvent);

        // Boss: the Seal Mother manifests once the Monolith has modeled the player
        if (!this.bossSpawned && !this.bossDefeated && this.player.profile.observation >= BOSS_OBSERVATION_THRESHOLD) {
            this.spawnEnemy("Seal Mother", ROOM.bossSpawn.x, ROOM.bossSpawn.y);
            audioManager.play("boss_spawn");
            onEvent("boss_spawned", {});
        }

        // Spawn timer
        if (!this.bossSpawned) {
            this.enemySpawnTimer += 16.67;
            if (this.enemySpawnTimer >= this.spawnDelay) {
                this.enemySpawnTimer = 0;
                if (this.enemies.length < this.maxEnemies()) {
                    this.spawnRandomEnemy();
                }
            }
        }
    }

    triggerConfrontation(wave, onEvent) {
        const profile = this.player.profile;
        profile.observation = Math.min(100, profile.observation + CONFRONTATION_OBSERVATION);
        // Wave 1: one Shape. Every two waves adds a Witness Chair escort.
        const shapes = 1 + Math.floor(wave / 3);
        const chairs = Math.floor(wave / 2);
        for (let i = 0; i < shapes; i++) {
            const a = (i / shapes) * Math.PI * 2;
            const sy = this.clampY(this.player.y + Math.sin(a) * 90);
            this.spawnEnemy("The Shape", this.clampX(this.player.x + Math.cos(a) * 140, sy), sy);
        }
        for (let i = 0; i < chairs; i++) {
            const cy = this.bounds.minY + 40 + i * 60;
            const span = walkableX(cy);
            this.spawnEnemy("Witness Chair", i % 2 ? span.min + 20 : span.max - 20, cy);
        }
        profile.signals.unshift(`Watcher Confrontation ${wave}: ${Math.round(this.player.currentLifeDuration / 60)} minutes survived. The Monolith sends ${shapes + chairs} witness${shapes + chairs === 1 ? "" : "es"}.`);
        onEvent("watcher_confrontation", { wave, count: shapes + chairs });
    }

    // The floor narrows toward the back wall (perspective), so x limits depend on y
    clampX(x, y = this.bounds.maxY) {
        const span = walkableX(y);
        return Math.max(span.min + 20, Math.min(span.max - 20, x));
    }
    clampY(y) { return Math.max(this.bounds.minY + 20, Math.min(this.bounds.maxY - 20, y)); }

    maxEnemies() {
        // 4 at low Observation, up to 8 when fully Known
        return BASE_MAX_ENEMIES + Math.floor((this.player.profile.observation || 0) / 25);
    }

    panFor(x) {
        return ((x - this.width / 2) / (this.width / 2)) * 0.6;
    }

    spawnRandomEnemy() {
        // Spawn along margins
        const side = Math.floor(Math.random() * 4);
        let x = 100, y = 100;
        if (side === 0 || side === 1) y = this.bounds.minY + Math.random() * (this.bounds.maxY - this.bounds.minY);
        else y = side === 2 ? this.bounds.minY + 10 : this.bounds.maxY - 10;
        const span = walkableX(y);
        if (side === 0) x = span.min + 10;
        else if (side === 1) x = span.max - 10;
        else x = span.min + Math.random() * (span.max - span.min);

        // Choose enemy type based on observation and probability
        const roll = Math.random();
        const obs = this.player.profile.observation;

        let type = "Cabinet Indexer";
        const judgement = tarotActive(this.player.profile, "Judgement");
        if (obs > (judgement ? TUNING.judgementShapeObs : 70) && roll < (judgement ? 0.24 : 0.16)) {
            type = "The Shape";
        } else if (obs > 50 && roll < 0.32) {
            type = "Witness Chair";
        } else if (roll < 0.54) {
            type = "Paper Wraith";
        } else if (roll < 0.78) {
            type = "Ink Redactor";
        }

        this.spawnEnemy(type, x, y);
    }

    handlePlayerMovement() {
        let dx = 0;
        let dy = 0;

        if (this.keys["w"] || this.keys["arrowup"]) dy = -1;
        if (this.keys["s"] || this.keys["arrowdown"]) dy = 1;
        if (this.keys["a"] || this.keys["arrowleft"]) dx = -1;
        if (this.keys["d"] || this.keys["arrowright"]) dx = 1;

        if (this.player.dashTimer > 0) {
            // Currently dashing
            this.player.dashTimer--;
            this.player.vx = this.player.dashDx * (this.player.speed * PLAYER_DASH_MULT);
            this.player.vy = this.player.dashDy * (this.player.speed * PLAYER_DASH_MULT);
            this.player.state = "dashing";
            this.player.invulnTimer = Math.max(this.player.invulnTimer, 5); // i-frames
            
            // Visual feedback: emit small particles during dash
            if (this.player.dashTimer % 3 === 0) {
                this.createParticleExplosion(this.player.x, this.player.y, "#ffffff", 1);
            }
        } else {
            // Normal movement
            if (dx !== 0 || dy !== 0) {
                // Normalize
                let len = Math.sqrt(dx * dx + dy * dy);
                dx /= len;
                dy /= len;

                // Dash initiation
                if (this.keys["shift"] && this.player.dashCooldown <= 0) {
                    this.player.dashTimer = 12; // dash duration frames
                    this.player.dashCooldown = 60; // 1s cooldown
                    this.player.dashDx = dx;
                    this.player.dashDy = dy;
                    this.player.state = "dashing";
                    audioManager.play("dash");
                    this.note("dash");
                    this.baitDash();
                } else {
                    this.player.vx = dx * this.player.speed;
                    this.player.vy = dy * this.player.speed;
                    this.player.state = "moving";
                    this.player.profile.stats.movements++;

                    if (dx < 0) this.player.facing = "left";
                    if (dx > 0) this.player.facing = "right";
                }
            } else {
                this.player.vx = 0;
                this.player.vy = 0;
                this.player.state = "idle";
            }
        }

        // Apply velocities (input + decaying knockback)
        this.player.x += this.player.vx + this.player.kbVx;
        this.player.y += this.player.vy + this.player.kbVy;
        this.player.kbVx *= KNOCKBACK_DAMPING;
        this.player.kbVy *= KNOCKBACK_DAMPING;
        if (Math.abs(this.player.kbVx) < 0.05) this.player.kbVx = 0;
        if (Math.abs(this.player.kbVy) < 0.05) this.player.kbVy = 0;

        // Wall collisions
        if (this.player.y - this.player.radius < this.bounds.minY) this.player.y = this.bounds.minY + this.player.radius;
        if (this.player.y + this.player.radius > this.bounds.maxY) this.player.y = this.bounds.maxY - this.player.radius;
        const span = walkableX(this.player.y);
        if (this.player.x - this.player.radius < span.min) this.player.x = span.min + this.player.radius;
        if (this.player.x + this.player.radius > span.max) this.player.x = span.max - this.player.radius;

        // Obstacle collisions
        this.pushOutOfObstacles(this.player, this.player.radius);
    }

    // Push a circle (entity centre + radius) out of the Monolith and furniture.
    // Returns the last rectangle hit and the push normal, so walkers can slide around it.
    pushOutOfObstacles(ent, radius) {
        let hit = null;
        for (const obs of this.obstacles) {
            if (obs.r) {
                const dx = ent.x - obs.x, dy = ent.y - obs.y;
                const dist = Math.hypot(dx, dy);
                const minDist = obs.r + radius;
                if (dist < minDist) {
                    const angle = dist > 0.001 ? Math.atan2(dy, dx) : Math.PI / 2;
                    ent.x = obs.x + Math.cos(angle) * minDist;
                    ent.y = obs.y + Math.sin(angle) * minDist;
                }
                continue;
            }
            const cx = Math.max(obs.x, Math.min(ent.x, obs.x + obs.w));
            const cy = Math.max(obs.y, Math.min(ent.y, obs.y + obs.h));
            const dx = ent.x - cx, dy = ent.y - cy;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.001) {
                if (dist < radius) {
                    ent.x += (dx / dist) * (radius - dist);
                    ent.y += (dy / dist) * (radius - dist);
                    hit = { obs, nx: dx / dist, ny: dy / dist };
                }
                continue;
            }
            // Centre is inside the rectangle: leave by the nearest side
            const exits = [
                [ent.x - obs.x, -1, 0], [obs.x + obs.w - ent.x, 1, 0],
                [ent.y - obs.y, 0, -1], [obs.y + obs.h - ent.y, 0, 1]
            ].sort((a, b) => a[0] - b[0]);
            const [d, ex, ey] = exits[0];
            ent.x += ex * (d + radius);
            ent.y += ey * (d + radius);
            hit = { obs, nx: ex, ny: ey };
        }
        return hit;
    }

    // An enemy blocked head-on by furniture commits to walking along it to
    // whichever clear end is the shorter way round, then resumes the chase
    startDetour(e, hit) {
        const { obs, nx, ny } = hit;
        const r = Math.min(e.radius || 16, 22) + 6;
        const sp = Math.max(0.5, e.speed || 1.5);
        if (Math.abs(ny) > Math.abs(nx)) {
            const span = walkableX(e.y, 30);
            const ends = [
                { dir: -1, x: obs.x - r, cost: Math.abs(e.x - obs.x) + Math.abs(this.player.x - obs.x) },
                { dir: 1, x: obs.x + obs.w + r, cost: Math.abs(obs.x + obs.w - e.x) + Math.abs(obs.x + obs.w - this.player.x) }
            ].filter(end => end.x > span.min && end.x < span.max).sort((a, b) => a.cost - b.cost);
            if (!ends.length) return;
            // Went round this way recently and are back against it: try the other end
            const last = e.lastDetour;
            const pick = last && last.obs === obs && e.behaviorTimer - last.at < 240 && ends.length > 1 && ends[0].dir === last.dir ? ends[1] : ends[0];
            e.detour = { axis: "x", dir: pick.dir, t: Math.ceil(Math.abs(pick.x - e.x) / sp) + 4 };
            e.lastDetour = { obs, dir: pick.dir, at: e.behaviorTimer };
        } else {
            const dir = this.player.y > obs.y + obs.h / 2 ? 1 : -1;
            const ty = dir > 0 ? obs.y + obs.h + r : obs.y - r;
            e.detour = { axis: "y", dir, t: Math.ceil(Math.abs(ty - e.y) / sp) + 4 };
        }
    }

    handlePlayerActions() {
        // Direct Action: Attack towards mouse click, space, or auto-combat
        let shouldAttack = false;
        let tx = this.player.x + (this.player.facing === "right" ? 100 : -100);
        let ty = this.player.y;

        if (this.mouse.click) {
            shouldAttack = true;
            tx = this.mouse.x;
            ty = this.mouse.y;
            this.mouse.click = false; // consume
        } else if (this.keys[" "] || this.keys["e"]) {
            shouldAttack = true;
            // Attack in facing direction
        } else if (this.autoAttack && this.enemies.length > 0) {
            // Find closest enemy in range
            let closest = this.getClosestEnemy(180);
            if (closest) {
                shouldAttack = true;
                tx = closest.x;
                ty = closest.y;
            }
        }

        if (shouldAttack && this.player.attackCooldown === 0) {
            this.player.attackCooldown = this.player.attackDelay;
            this.player.profile.stats.attacks++;
            this.note("attack");
            this.player.state = "attacking";
            audioManager.play("attack_swing");

            // Class-specific attacks
            const type = this.player.profile.classType;
            if (type === "Signal Marked") {
                // Cast static sparks (projectiles)
                this.spawnProjectiles("player", this.player.x, this.player.y, tx, ty, "static_spark", {
                    damage: Math.round(this.player.damage * 0.9),
                    crit: this.player.crit,
                    life: 45,
                    speed: 9,
                    color: "#a4b5d6",
                    radius: 8
                });
            } else if (type === "Static Marked") {
                // Blink slightly forward and swift stab slash
                let angle = Math.atan2(ty - this.player.y, tx - this.player.x);
                this.player.x += Math.cos(angle) * 20;
                this.player.y += Math.sin(angle) * 20;

                this.spawnProjectiles("player", this.player.x, this.player.y, tx, ty, "blade_dash", {
                    damage: Math.round(this.player.damage * 0.85),
                    crit: this.player.crit + 0.15,
                    life: 15,
                    speed: 4,
                    color: "#16d8a4",
                    radius: 15
                });
            } else if (type === "Blood Marked") {
                // Large blood cleave, cost 2 HP, high damage
                this.player.health = Math.max(1, this.player.health - 2);
                this.spawnProjectiles("player", this.player.x, this.player.y, tx, ty, "blood_cleave", {
                    damage: Math.round(this.player.damage * 1.4),
                    crit: this.player.crit,
                    life: 20,
                    speed: 6,
                    color: "#9a1616",
                    radius: 20
                });
                this.createParticleExplosion(this.player.x, this.player.y, "#9a1616", 6);
            } else {
                // Default blade slash (Bone Marked, Ritual Marked)
                this.spawnProjectiles("player", this.player.x, this.player.y, tx, ty, "sword_slash", {
                    damage: this.player.damage,
                    crit: this.player.crit,
                    life: 20,
                    speed: 5,
                    color: "#dddddd",
                    radius: 14
                });
            }
        }
    }

    getClosestEnemy(maxRange = 9999) {
        let closest = null;
        let minDist = maxRange;
        for (const e of this.enemies) {
            if (e.health <= 0) continue;
            let dist = this.distance(this.player.x, this.player.y, e.x, e.y);
            if (dist < minDist) {
                minDist = dist;
                closest = e;
            }
        }
        return closest;
    }

    updateEnemies(onEvent) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.health <= 0) {
                // Reward and remove
                this.player.profile.exp += 15;
                this.note("kill", { type: e.type });
                
                // Roll loot
                this.spawnLoot(e.x, e.y, e.lootRarity);
                
                // Death animation + particles
                this.deathFx.push({ type: e.type, x: e.x, y: e.y, t: 0, facing: this.player.x < e.x ? "left" : "right" });
                // What each thing leaves behind on the stone
                const remains = e.type === "Ink Redactor" ? "ink" : e.type === "Paper Wraith" ? "paper" : e.type === "Witness Chair" ? "splinters" : "blood";
                this.decals.push({ kind: "pool", x: e.x, y: e.y + 4, r: 16 + (e.radius || 18) * 0.6, liquid: remains });
                this.createParticleExplosion(e.x, e.y, remains === "ink" ? "#000000" : "#3a0808", 14);
                audioManager.play("enemy_death", { pan: this.panFor(e.x) });
                const goldDrop = Math.round((e.lootRarity === "Worn" ? 12 : e.lootRarity === "Unsettling" ? 25 : 60) * this.goldMult());
                this.player.profile.gold += goldDrop;
                this.trackActiveGain(goldDrop, 15);
                this.spawnFloatingText(`+${goldDrop} DG`, e.x, e.y - 34, "#d4af37", false);
                
                if (e.type === "Seal Mother") {
                    this.bossSpawned = false;
                    this.bossDefeated = true;
                    audioManager.play("boss_defeated");
                    onEvent("boss_defeated", e);
                    const door = this.interactables.find(intr => intr.type === "sealed_zone_door");
                    if (door) {
                        door.data.state = "opening";
                        door.data.timer = 60;
                    }
                    this.loot.push({
                        id: "memory_fragment",
                        x: e.x,
                        y: e.y,
                        vx: (Math.random() - 0.5) * 4,
                        vy: -4,
                        groundY: e.y + 12,
                        bounce: 0,
                        grav: 0.25
                    });
                } else if (e.type === "Corpse Echo") {
                    onEvent("echo_down", e);
                    this.loot.push({
                        id: "memory_fragment",
                        x: e.x,
                        y: e.y,
                        vx: (Math.random() - 0.5) * 4,
                        vy: -4,
                        groundY: e.y + 12,
                        bounce: 0,
                        grav: 0.25
                    });
                }
                
                this.enemies.splice(i, 1);
                continue;
            }

            e.attackCooldown = Math.max(0, e.attackCooldown - 1);
            e.behaviorTimer++;
            if (e.hitFlash > 0) e.hitFlash--;
            this.currentActor = e.type;

            // Enemy AI movement and actions
            let dx = this.player.x - e.x;
            let dy = this.player.y - e.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 1) dist = 1;

            // Trigger aggro radius (always aware of player in the Keeping House)
            if (e.type === "Cabinet Indexer" || e.type === "Witness Chair") {
                // Melee chasers
                if (dist > 10) {
                    e.vx = (dx / dist) * e.speed;
                    e.vy = (dy / dist) * e.speed;
                } else {
                    e.vx = 0;
                    e.vy = 0;
                }

                // Attack check
                if (dist < e.radius + this.player.radius + 5 && e.attackCooldown === 0) {
                    e.attackCooldown = 70;
                    this.damagePlayer(e.damage, 0, e.x, e.y);
                }
            } else if (e.type === "Ink Redactor") {
                // Ranged shooter. Tries to maintain 150px distance
                e.shootCooldown = Math.max(0, e.shootCooldown - 1);
                if (dist < 130) {
                    // Back away
                    e.vx = -(dx / dist) * e.speed;
                    e.vy = -(dy / dist) * e.speed;
                } else if (dist > 180) {
                    // Walk closer
                    e.vx = (dx / dist) * e.speed;
                    e.vy = (dy / dist) * e.speed;
                } else {
                    e.vx = 0;
                    e.vy = 0;
                }

                if (dist < 220 && e.shootCooldown === 0) {
                    e.shootCooldown = 90;
                    const aim = this.aimAt(e, ENEMY_SHOTS["Ink Redactor"].speed);
                    this.fireShot(e, aim.x, aim.y);
                }
            } else if (e.type === "Paper Wraith") {
                // Mid-range paper spirit. Drifts in, then throws a crescent of scraps.
                if (dist < 95) {
                    e.vx = -(dx / dist) * e.speed * 0.8;
                    e.vy = -(dy / dist) * e.speed * 0.8;
                } else if (dist > 150) {
                    e.vx = (dx / dist) * e.speed;
                    e.vy = (dy / dist) * e.speed;
                } else {
                    e.vx = Math.sin(e.behaviorTimer * 0.05) * 0.7;
                    e.vy = Math.cos(e.behaviorTimer * 0.04) * 0.45;
                }

                if (dist < 175 && e.attackCooldown === 0) {
                    e.attackCooldown = 62;
                    const aim = this.aimAt(e, ENEMY_SHOTS["Paper Wraith"].speed);
                    this.fireShot(e, aim.x, aim.y);
                }
            } else if (e.type === "Seal Mother") {
                const phase = this.sealMotherPhase(e);
                if (phase > (e.phase || 1)) {
                    e.phase = phase;
                    onEvent("boss_phase", { phase });
                    // Loose pages answer her at the last: the Register's own paper, fighting for her
                    if (phase === 3) {
                        for (const side of [-1, 1]) this.spawnEnemy("Paper Wraith", this.clampX(e.x + side * 90, e.y), this.clampY(e.y + 30));
                    }
                }
                e.phase = e.phase || 1;
                // Boss movement: she tires of waiting as the fight goes on
                const pace = [1, 1, 1.15, 1.25][e.phase];
                if (dist > 30) {
                    e.vx = (dx / dist) * e.speed * pace;
                    e.vy = (dy / dist) * e.speed * pace;
                } else {
                    e.vx = 0;
                    e.vy = 0;
                }

                // Wax seals: one at the player's feet; a fan of three in the second phase;
                // in the third they also fall where the player is *going*
                const every = [0, 180, 150, 130][e.phase];
                if (e.behaviorTimer % every === 0) {
                    this.createParticleExplosion(e.x, e.y, "#9a1616", 10);
                    const px = this.player.x, py = this.player.y;
                    onEvent("boss_wax_trap", { x: px, y: py });
                    if (e.phase >= 2) {
                        const ang = Math.atan2(py - e.y, px - e.x) + Math.PI / 2;
                        for (const off of [-72, 72]) {
                            const ty = this.clampY(py + Math.sin(ang) * off);
                            onEvent("boss_wax_trap", { x: this.clampX(px + Math.cos(ang) * off, ty), y: ty });
                        }
                    }
                    if (e.phase === 3) {
                        const ahead = this.aimAtFrames(45);
                        onEvent("boss_wax_trap", { x: ahead.x, y: ahead.y });
                    }
                }

                // Melee strike
                if (dist < e.radius + this.player.radius + 10 && e.attackCooldown === 0) {
                    e.attackCooldown = 80;
                    audioManager.play("boss_attack");
                    this.damagePlayer(e.damage, 0, e.x, e.y);
                    if (this.canvasRenderer) this.canvasRenderer.triggerShake(12);
                    this.createParticleExplosion(this.player.x, this.player.y, "#ffcc00", 15);
                }
            } else if (e.type === "The Shape") {
                this.updateShape(e, dx, dy, dist);
            } else if (e.type === "Corpse Echo") {
                // Highly aggressive, uses past stats
                if (dist > 20) {
                    e.vx = (dx / dist) * e.speed;
                    e.vy = (dy / dist) * e.speed;
                } else {
                    e.vx = 0;
                    e.vy = 0;
                }

                if (dist < 120 && e.attackCooldown === 0) {
                    e.attackCooldown = 45;
                    const aim = this.aimAt(e, 5.5);
                    this.spawnProjectiles("enemy", e.x, e.y, aim.x, aim.y,
                        e.classType === "Blood Marked" ? "blood_cleave" : "sword_slash", {
                        damage: e.damage,
                        sanityDamage: 8,
                        speed: 5.5,
                        color: e.classType === "Blood Marked" ? "#9a1616" : "#3d1052",
                        radius: 14,
                        life: 35
                    });
                }
            }

            // What the Monolith has learned of the player, turned on them
            if (this.counters.kiter && dist > 140 && MELEE_ENEMIES.has(e.type) && !e.bait) {
                const k = 1 + 0.3 * this.counters.kiter;     // a retreating player is run down
                e.vx *= k; e.vy *= k;
            }
            if (this.counters.brawler && MELEE_ENEMIES.has(e.type)) this.trackClinch(e, dist, onEvent);
            if (e.bait) this.applyBait(e, dx, dy, dist);

            if (e.detour) {
                if (--e.detour.t <= 0) e.detour = null;
                else if (e.detour.axis === "x") { e.vx = e.detour.dir * e.speed; e.vy = 0; }
                else { e.vy = e.detour.dir * e.speed; e.vx = 0; }
            }

            e.x += e.vx + e.kbVx;
            e.y += e.vy + e.kbVy;
            e.kbVx *= KNOCKBACK_DAMPING;
            e.kbVy *= KNOCKBACK_DAMPING;

            // Simple wall boundaries for enemies
            if (e.y < this.bounds.minY) e.y = this.bounds.minY;
            if (e.y > this.bounds.maxY) e.y = this.bounds.maxY;
            const espan = walkableX(e.y, 30);
            if (e.x < espan.min) e.x = espan.min;
            if (e.x > espan.max) e.x = espan.max;
            const hit = this.pushOutOfObstacles(e, Math.min(e.radius || 16, 22));
            // Steer round only when pressing into the furniture, not when brushing past it
            if (hit && !e.detour && e.vx * hit.nx + e.vy * hit.ny < 0 && Math.abs(e.vx * hit.ny - e.vy * hit.nx) < (e.speed || 1.5) * 0.7) this.startDetour(e, hit);
        }
        this.currentActor = null;
    }

    damagePlayer(amount, sanityAmount = 0, sourceX = null, sourceY = null, source = this.currentActor) {
        if (this.player.health <= 0 || this.player.invulnTimer > 0) return;
        this.lastDamageSource = source || "the dark";

        // Apply armor formula
        const arm = this.player.stats.armor || 0;
        const reduced = Math.max(1, Math.round(amount * (20 / (20 + arm))));
        
        this.player.health -= reduced;
        this.note("hurt", { amount: reduced, source: this.lastDamageSource });
        this.player.invulnTimer = 25; // frames of safety
        
        this.spawnFloatingText(reduced, this.player.x, this.player.y - 20, "#b01212", false);
        this.hitStop = 2; // mini freeze on getting hit
        
        // Knockback away from the source of the hit
        if (sourceX !== null && sourceY !== null) {
            const angle = Math.atan2(this.player.y - sourceY, this.player.x - sourceX);
            this.player.kbVx += Math.cos(angle) * PLAYER_KNOCKBACK;
            this.player.kbVy += Math.sin(angle) * PLAYER_KNOCKBACK;
        }

        audioManager.play("hit_player");
        if (this.canvasRenderer) {
            this.canvasRenderer.triggerShake(5);
            this.canvasRenderer.triggerDamageFlash(0.35);
        }
        
        if (this.player.health <= 0) {
            this.player.health = 0;
            audioManager.play("player_death");
            this.hitStop = 10;
            if (this.canvasRenderer) {
                this.canvasRenderer.triggerShake(18);
                this.canvasRenderer.triggerDamageFlash(0.8);
            }
            this.createParticleExplosion(this.player.x, this.player.y, "#7a0c0c", 40);
        }

        if (sanityAmount > 0) {
            const sanRes = this.player.stats.sanityResist || 0;
            const finalSanDmg = Math.round(sanityAmount * (1 - sanRes));
            this.player.sanity = Math.max(0, this.player.sanity - finalSanDmg);
            this.player.profile.stats.sanityLost += finalSanDmg;
        }

        this.createParticleExplosion(this.player.x, this.player.y, "#b01212", 8);
    }

    updateProjectiles(onEvent) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life--;

            if (p.life <= 0) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Hit collision
            if (p.owner === "player") {
                // Check enemies
                for (const e of this.enemies) {
                    if (e.health > 0 && this.distance(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
                        // Is crit?
                        let isCrit = Math.random() < p.crit;
                        let finalDmg = this.modifyPlayerHit(isCrit ? Math.round(p.damage * 1.7) : p.damage, e);
                        
                        e.health -= finalDmg;
                        this.note("hit", { crit: isCrit });
                        this.createParticleExplosion(e.x, e.y, isCrit ? "#ffdd00" : "#aaaaaa", 6);
                        this.spawnFloatingText(finalDmg, e.x, e.y - 20, isCrit ? "#ffdd00" : "#ffffff", isCrit);
                        
                        e.hitFlash = 6;
                        const pan = this.panFor(e.x);
                        if (isCrit) {
                            this.hitStop = 4; // satisfying hit-stop on crits
                            audioManager.play("crit_hit", { pan });
                            if (this.canvasRenderer) this.canvasRenderer.triggerShake(4);
                        } else {
                            audioManager.play("hit_enemy", { pan });
                        }
                        
                        // Knockback (bosses are too heavy to shove far)
                        const angle = Math.atan2(e.y - p.y, e.x - p.x);
                        const kb = e.type === "Seal Mother" ? ENEMY_KNOCKBACK * 0.2 : ENEMY_KNOCKBACK;
                        e.kbVx += Math.cos(angle) * kb;
                        e.kbVy += Math.sin(angle) * kb;
                        
                        // Destroy projectile if single-hit
                        p.life = 0;
                        break;
                    }
                }
            } else {
                // Check player
                if (this.player.health > 0 && this.distance(p.x, p.y, this.player.x, this.player.y) < p.radius + this.player.radius) {
                    this.damagePlayer(p.damage, p.sanityDamage, p.x - p.vx * 3, p.y - p.vy * 3, p.source);
                    p.life = 0;
                }
            }
        }
    }

    updateDeathFx() {
        for (const fx of this.deathFx) fx.t++;
        // Death animations are at most ~1.4s plus a fade
        this.deathFx = this.deathFx.filter(fx => fx.t < 140);
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            if (p.liquid) {
                p.z += p.vz;
                p.vz -= 0.3;
                if (p.z <= 0) {
                    this.decals.push({ kind: "drop", x: p.x, y: p.y, r: p.size * (1 + Math.random()), liquid: p.liquid, vx: p.vx, vy: p.vy });
                    this.particles.splice(i, 1);
                }
                continue;
            }
            p.alpha -= p.decay;
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    updateLoot() {
        for (const l of this.loot) {
            l.age = (l.age || 0) + 1;
            if (l.bounce < 1) {
                // Fall physics
                l.vy += l.grav;
                l.x += l.vx;
                l.y += l.vy;
                
                // Friction
                l.vx *= 0.95;
                const ground = l.groundY ?? l.y;
                if (l.vy > 0 && l.y >= ground) {
                    l.y = ground;
                    l.vy = -l.vy * 0.4;
                    l.vx *= 0.5;
                    l.bounce++;
                }
            }

            // Magnetic attraction to player
            let dist = this.distance(this.player.x, this.player.y, l.x, l.y);
            // Let drops land and be seen before they're pulled in
            const landed = l.bounce >= 1 || l.age > 45;
            let magnetRange = 90;
            if (landed && dist < magnetRange && this.player.health > 0) {
                let dx = this.player.x - l.x;
                let dy = this.player.y - l.y;
                l.x += (dx / dist) * 6;
                l.y += (dy / dist) * 6;

                // Pick up threshold
                if (dist < this.player.radius + 10) {
                    this.collectLoot(l);
                    l.collected = true;
                }
            }
        }

        // Filter out collected
        this.loot = this.loot.filter(l => !l.collected);
    }

    collectLoot(lootData) {
        let p = this.player.profile;
        let color = "#d4af37";

        if (lootData.id === "loot_satchel") {
            const gold = Math.round(lootData.gold * this.goldMult());
            p.gold += gold;
            this.trackActiveGain(gold, 0);
            color = "#ffd700";
            p.signals.unshift(`Collected Satchel: Debt Gold reduced by ${gold}.`);
        } else if (lootData.id === "blood_vial") {
            const heal = Math.round(this.player.maxHealth * lootData.healPct * this.healingMult());
            this.player.health = Math.min(this.player.maxHealth, this.player.health + heal);
            color = "#d12a2a";
            this.spawnFloatingText(`+${heal}`, this.player.x, this.player.y - 30, "#ff5a5a", false);
            p.signals.unshift(`Drank a Blood Vial: Restored ${heal} Flesh.`);
        } else if (lootData.id === "sanity_shard") {
            this.player.sanity = Math.min(100, this.player.sanity + lootData.sanityRestore);
            color = "#00ffff";
            p.signals.unshift(`Absorbed Sanity Shard: Restored ${lootData.sanityRestore}% Sanity.`);
        } else if (lootData.id === "signal_fragment") {
            p.parchment += lootData.parchment;
            p.ink += lootData.ink;
            color = "#ffffff";
            p.signals.unshift(`Acquired Signal Fragment: Parchment +${lootData.parchment}, Ink +${lootData.ink}.`);
        } else if (lootData.id === "cursed_gear_drop" && lootData.item) {
            color = lootData.item.color;
            if (p.inventory.length < 15) {
                p.inventory.push(lootData.item);
                p.signals.unshift(`Recovered Gear: [${lootData.item.rarity}] ${lootData.item.name}.`);
            } else {
                p.signals.unshift("Inventory full! Lost cursed gear drop.");
            }
        } else if (lootData.id === "memory_fragment") {
            p.memoryFragments = (p.memoryFragments || 0) + 1;
            color = "#a366ff";
            p.signals.unshift("Recovered a Memory Fragment. It pulses with past knowledge.");
        }

        const rare = lootData.id === "memory_fragment" ||
            (lootData.item && ["Relic", "Abyssal", "Impossible"].includes(lootData.item.rarity));
        audioManager.play("loot_pickup", { rare });
        if (rare) {
            this.spawnFloatingText(lootData.item ? lootData.item.rarity.toUpperCase() + "!" : "MEMORY", lootData.x, lootData.y - 24, color, true);
            if (this.canvasRenderer) this.canvasRenderer.triggerShake(3);
        }

        // Small particle splash
        this.createParticleExplosion(lootData.x, lootData.y, color, rare ? 18 : 5);
    }

    updateInteractables() {
        for (const intr of this.interactables) {
            if (intr.type === "wax_record_chest") {
                if (intr.data.state === "opening") {
                    intr.data.timer--;
                    if (intr.data.timer <= 0) {
                        intr.data.state = "open";
                        this.spawnLoot(intr.x - 25, intr.y + 15, "Unsettling");
                        this.spawnLoot(intr.x + 25, intr.y + 15, "Unsettling");
                        if (Math.random() < 0.4) {
                            this.spawnLoot(intr.x, intr.y + 25, "Cursed");
                        }
                        this.player.profile.signals.unshift("Wax Record Chest cracked open! Loot drop retrieved.");
                    }
                }
            } else if (intr.type === "sealed_zone_door") {
                if (intr.data.state === "opening") {
                    intr.data.timer--;
                    if (intr.data.timer <= 0) {
                        intr.data.state = "open";
                    }
                }
            }
        }
    }

    // The Monolith takes notes: everything the player does is recorded in their dossier
    note(kind, data) {
        if (this.player) recordEvent(this.player.profile, kind, data);
    }

    // ─── What the Monolith does with what it has learned ────────────────────────────

    // Where the player will be in `frames` if they keep going (the boss's third-phase seals)
    aimAtFrames(frames) {
        const p = this.player;
        const y = this.clampY(p.y + p.vy * frames);
        return { x: this.clampX(p.x + p.vx * frames, y), y };
    }

    // 1 above two thirds of her flesh, 2 above one third, 3 below
    sealMotherPhase(e) {
        const f = e.health / e.maxHealth;
        return f > 2 / 3 ? 1 : f > 1 / 3 ? 2 : 3;
    }

    // Enemies that shoot lead a retreating player (Led shots)
    aimAt(e, projSpeed) {
        const p = this.player, power = this.counters.kiter || 0;
        if (!power) return { x: p.x, y: p.y };
        const t = Math.min(40, Math.hypot(p.x - e.x, p.y - e.y) / projSpeed) * Math.min(1, power);
        return { x: p.x + p.vx * t, y: p.y + p.vy * t };
    }

    fireShot(e, tx, ty) {
        const shot = ENEMY_SHOTS[e.type];
        if (!shot) return;
        this.spawnProjectiles("enemy", e.x, e.y, tx, ty, shot.type, { damage: e.damage, sanityDamage: shot.sanityDamage, speed: shot.speed, color: shot.color, radius: shot.radius, life: shot.life });
    }

    // Baited dashes: the witnesses see the dash coming. Melee enemies freeze and flash while the player is in the air,
    // then lunge at where they land; shooters loose a shot at the landing point.
    baitDash() {
        const power = this.counters.dasher || 0;
        if (!power) return;
        const p = this.player, reach = p.speed * PLAYER_DASH_MULT * 12;
        const ty = this.clampY(p.y + p.dashDy * reach), tx = this.clampX(p.x + p.dashDx * reach, ty);
        let any = false;
        for (const e of this.enemies) {
            if (e.health <= 0 || e.type === "Seal Mother" || this.distance(p.x, p.y, e.x, e.y) > 340) continue;
            e.bait = { wind: 12, lunge: 14 + Math.round(8 * Math.min(1, power)), power: Math.min(1, power), tx, ty, melee: MELEE_ENEMIES.has(e.type) };
            any = true;
        }
        if (any) this.spawnFloatingText("!", p.x, p.y - 44, "#9a4ab8", true);
    }

    applyBait(e, dx, dy, dist) {
        const b = e.bait;
        if (b.wind > 0) {
            b.wind--;
            e.vx = 0; e.vy = 0;
            e.hitFlash = Math.max(e.hitFlash, 2);
            if (b.wind === 0 && !b.melee && e.attackCooldown <= 0) { this.currentActor = e.type; this.fireShot(e, b.tx, b.ty); e.attackCooldown = 30; }
            return;
        }
        if (b.melee && b.lunge > 0) {
            b.lunge--;
            const sp = e.speed * (2 + 1.2 * b.power);
            e.vx = (dx / dist) * sp; e.vy = (dy / dist) * sp;
            if (b.lunge === 0) e.attackCooldown = 0;
            return;
        }
        e.bait = null;
    }

    // Slams: a melee enemy the player keeps standing next to winds up a telegraphed ring and brings it down
    trackClinch(e, dist, onEvent) {
        const power = Math.min(1, this.counters.brawler);
        if (e.slamCool > 0) e.slamCool--;
        e.clinch = dist < 80 ? (e.clinch || 0) + 1 : Math.max(0, (e.clinch || 0) - 2);
        if (e.clinch >= 70 - 30 * power && !e.slamCool) {
            e.clinch = 0;
            e.slamCool = 150;
            onEvent("mark", { kind: "slam", x: e.x, y: e.y, radius: 88, frames: 32, damage: Math.round(e.damage * (1.2 + 0.6 * power)), sanity: 0, source: `${e.type}'s slam` });
        }
    }

    // Bargain traps: whoever lingers at the altar after signing is collected from
    updateBargainTraps(onEvent) {
        const power = this.counters.ritualist || 0;
        const altar = this.interactables.find(i => i.type === "blood_ritual_altar");
        if (!power || !altar) { this.altarTimer = 0; return; }
        const p = this.player;
        this.altarTimer = this.distance(p.x, p.y, altar.x, altar.y) < 95 ? this.altarTimer + 1 : Math.max(0, this.altarTimer - 2);
        if (this.altarTimer >= 360 - 150 * Math.min(1, power)) {
            this.altarTimer = 0;
            onEvent("mark", { kind: "bargain", x: p.x, y: p.y, radius: 42, frames: 60, damage: Math.round(10 + 14 * Math.min(1, power)), sanity: 8, source: "the ledger's collection" });
        }
    }

    // Snuffed flames: the candles nearest a player who clings to the light go out for a while
    updateCandles(onEvent) {
        for (const c of ROOM.candles) {
            if (c.snuffed && this.tick >= c.relightAt) c.snuffed = false;
        }
        const power = this.counters.lightBound || 0;
        if (!power || this.tick % Math.round(900 - 300 * Math.min(1, power)) !== 0) return;
        const p = this.player;
        let best = null, bd = 260;
        for (const c of ROOM.candles) {
            const d = this.distance(p.x, p.y, c.x, c.y);
            if (!c.snuffed && d < bd) { bd = d; best = c; }
        }
        if (best) {
            best.snuffed = true;
            best.relightAt = this.tick + Math.round(1200 + 600 * Math.min(1, power));
            onEvent("candle_snuffed", { x: best.x, y: best.y });
        }
    }

    // A corpse left where it fell may not stay down. The Death card makes it certain.
    updateCorpses(onEvent) {
        if (this.tick % 20 !== 0) return;
        const prof = this.player.profile;
        for (const intr of this.interactables) {
            if (intr.type !== "fresh_marked_corpse" || !intr.data.corpse || intr.data.rolled) continue;
            if (this.distance(this.player.x, this.player.y, intr.x, intr.y) > 260) continue;
            intr.data.rolled = true;
            if (tarotActive(prof, "Death") || Math.random() < CORPSE_RISE_CHANCE) this.raiseCorpse(intr, onEvent);
        }
    }

    raiseCorpse(intr, onEvent) {
        const corp = intr.data.corpse;
        corp.state = "risen";
        this.spawnCorpseEcho(corp);
        this.interactables = this.interactables.filter(i => i !== intr);
        onEvent("corpse_rose", { corpse: corp });
    }

    // The Shape: the Monolith's model of the player. It fights with the player's class, keeps the distance the player
    // keeps, and dashes if the player does.
    updateShape(e, dx, dy, dist) {
        const atk = SHAPE_ATTACKS[this.player.profile.classType] || SHAPE_ATTACKS.default;
        const kiter = this.counters.kiter || 0;
        const want = kiter > 0.3 ? atk.range * 0.85 : Math.min(60, atk.range * 0.6);
        if (e.shapeDash > 0) {
            e.shapeDash--;
            e.vx = (dx / dist) * e.speed * PLAYER_DASH_MULT; e.vy = (dy / dist) * e.speed * PLAYER_DASH_MULT;
        } else {
            if (dist > want + 15) { e.vx = (dx / dist) * e.speed; e.vy = (dy / dist) * e.speed; }
            else if (dist < want - 25) { e.vx = -(dx / dist) * e.speed * 0.8; e.vy = -(dy / dist) * e.speed * 0.8; }
            else { e.vx = 0; e.vy = 0; }
            if (this.counters.dasher && e.behaviorTimer % 180 === 0 && dist > 120) e.shapeDash = 12;
        }
        if (dist < atk.range && e.attackCooldown === 0) {
            e.attackCooldown = atk.cooldown;
            const aim = this.aimAt(e, atk.speed);
            this.spawnProjectiles("enemy", e.x, e.y, aim.x, aim.y, atk.type, { damage: e.damage, sanityDamage: 5, speed: atk.speed, color: atk.color, radius: atk.radius, life: atk.life });
        }
    }

    // What the Monolith will write on the corpse
    deathCause() {
        const src = this.lastDamageSource;
        return src ? `Felled by ${src}` : "Collapsed in the Keeping House";
    }

    // Gold find from gear, plus Mirror Rot's bounty once the room is being studied
    goldMult() {
        const prof = this.player.profile;
        return (1 + (this.player.stats.goldFind || 0)) * (traitActive(prof, "Mirror Rot") ? TUNING.mirrorRotGold : 1);
    }

    // Blood Rain thins every kind of healing
    healingMult() {
        return traitActive(this.player.profile, "Blood Rain") ? TUNING.bloodRainHealing : 1;
    }

    // Reality Traits reshape what a landed hit is worth
    modifyPlayerHit(dmg, enemy = null) {
        const prof = this.player.profile;
        // Burst armour: a player who lives on a few decisive crits finds no single blow can take more than a share
        const power = this.counters.critReliant || 0;
        if (power && enemy) {
            const cap = Math.max(1, Math.round(enemy.maxHealth * (0.5 - 0.25 * Math.min(1, power))));
            if (dmg > cap) {
                dmg = cap;
                this.spawnFloatingText("ABSORBED", enemy.x, enemy.y - 34, "#9a4ab8", false);
            }
        }
        if (traitActive(prof, "Blood Rain")) dmg *= TUNING.bloodRainDamage;
        if (traitActive(prof, "Mirror Rot")) {
            const arm = this.player.stats.armor || 0;
            dmg *= 1 - TUNING.mirrorRotArmorShare * (arm / (arm + 20));
        }
        return Math.max(1, Math.round(dmg));
    }

    // Lifetime active-play earnings, used to cap offline gains (see idle.js)
    trackActiveGain(gold, exp) {
        const st = this.player.profile.stats;
        st.activeGold = (st.activeGold || 0) + gold;
        st.activeExp = (st.activeExp || 0) + exp;
    }

    distance(x1, y1, x2, y2) {
        let dx = x2 - x1;
        let dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    spawnFloatingText(text, x, y, color, isCrit) {
        for (let tries = 0; tries < 4; tries++) {
            const clash = this.floatingTexts.some(ft => ft.life > 25 && Math.abs(ft.x - x) < 46 && Math.abs(ft.y - y) < 18);
            if (!clash) break;
            y -= 20;
        }
        this.floatingTexts.push({
            text: text,
            x: x,
            y: y,
            color: color,
            isCrit: isCrit,
            life: 45, // frames
            maxLife: 45,
            vy: -1.5 - Math.random() * 0.5,
            vx: (Math.random() - 0.5) * 1
        });
    }

    updateFloatingTexts() {
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.x += ft.vx;
            ft.y += ft.vy;
            ft.life--;
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }
}
