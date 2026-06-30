// Physics, Collision, and Entity Management
import { audioManager } from "./audio.js";

export class GameEngine {
    constructor() {
        this.width = 750;
        this.height = 450;
        
        // Define Walkable boundaries (Keeping House floor plane)
        this.bounds = {
            minX: 40,
            maxX: 710,
            minY: 100,
            maxY: 420
        };

        this.reset();
    }

    reset() {
        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.particles = [];
        this.floatingTexts = [];
        this.loot = [];
        this.interactables = []; // Altars, Corpses
        
        this.keys = {};
        this.mouse = { x: 0, y: 0, click: false, clickX: 0, clickY: 0 };
        this.autoAttack = true; // Idle assistance by default
        
        this.enemySpawnTimer = 0;
        this.spawnDelay = 4000; // spawn every 4s
        this.bossSpawned = false;
        
        this.hitStop = 0; // Frames to freeze the engine
        
        // Static Obstacles in Keeping House. These are collision shapes for sprite props.
        this.obstacles = [
            { x: 118, y: 202, w: 86, h: 42, label: "Evidence Board" },
            { x: 522, y: 204, w: 90, h: 46, label: "Nameplate Heap" },
            { x: 375, y: 258, r: 38, label: "The Monolith" }
        ];
    }

    setPlayer(profile, extraStats) {
        this.player = {
            profile: profile,
            stats: extraStats,
            x: 100,
            y: 300,
            vx: 0,
            vy: 0,
            radius: 16,
            health: profile.health,
            maxHealth: profile.maxHealth + extraStats.health,
            speed: (profile.classType === "Static Marked" ? 5.5 : 4.5) + (extraStats.speed || 0),
            damage: (profile.classType === "Blood Marked" ? 25 : 18) + (extraStats.damage || 0),
            crit: (profile.classType === "Static Marked" ? 0.25 : 0.10) + (extraStats.crit || 0),
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
            currentLifeDuration: profile.currentLifeDuration || 0
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
            const rand = Math.random();
            let lootType = "loot_satchel";
            let item = null;
            let gold = 0;
            let parchment = 0;
            let ink = 0;
            let sanityRestore = 0;

            if (rand < 0.20) {
                lootType = "cursed_gear_drop";
                item = stateMod.generateLootItem(rarityLimit);
            } else if (rand < 0.45) {
                lootType = "sanity_shard";
                sanityRestore = 15;
            } else if (rand < 0.70) {
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
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4 - 3,
                bounce: 0,
                grav: 0.25
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
            e.health = e.maxHealth = 250;
            e.radius = 28;
            e.speed = 1.35;
            e.damage = 18;
            e.lootRarity = "Cursed";
            this.bossSpawned = true;
        } else if (type === "The Shape") {
            // Player clone
            e.health = e.maxHealth = this.player.maxHealth * 0.8;
            e.radius = 16;
            e.speed = this.player.speed * 0.75;
            e.damage = this.player.damage * 0.6;
            e.lootRarity = "Relic";
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
            classType: corp.classType // "Blood Marked" etc
        };
        this.enemies.push(e);
        this.createParticleExplosion(e.x, e.y, "#9a1616", 15);
    }

    createParticleExplosion(x, y, color, count) {
        for (let i = 0; i < count; i++) {
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
            if (this.player.deathTimer === 60) {
                // Inform orchestrator that player collapsed
                onEvent("player_died", { x: this.player.x, y: this.player.y });
            }
            this.updateParticles();
            return;
        }

        this.player.currentLifeDuration += 1 / 60;

        // 3-hour pressure event (10800 seconds)
        if (this.player.currentLifeDuration >= 10800 && !this.player.profile.pressureEventTriggered) {
            this.player.profile.pressureEventTriggered = true;
            this.player.profile.observation = Math.min(100, this.player.profile.observation + 25);
            this.spawnEnemy("The Shape", this.player.x + 100, this.player.y);
            this.player.profile.signals.unshift("Watcher Warning: 3 hours survived. The Shape descends.");
        }

        if (this.player.invulnTimer > 0) this.player.invulnTimer--;
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
        this.updateFloatingTexts();
        this.updateLoot();
        this.updateInteractables();

        // Spawn timer
        if (!this.bossSpawned) {
            this.enemySpawnTimer += 16.67;
            if (this.enemySpawnTimer >= this.spawnDelay) {
                this.enemySpawnTimer = 0;
                this.spawnRandomEnemy();
            }
        }
    }

    spawnRandomEnemy() {
        // Spawn along margins
        const side = Math.floor(Math.random() * 4);
        let x = 100, y = 100;
        if (side === 0) { x = this.bounds.minX + 10; y = this.bounds.minY + Math.random() * (this.bounds.maxY - this.bounds.minY); }
        else if (side === 1) { x = this.bounds.maxX - 10; y = this.bounds.minY + Math.random() * (this.bounds.maxY - this.bounds.minY); }
        else if (side === 2) { x = this.bounds.minX + Math.random() * (this.bounds.maxX - this.bounds.minX); y = this.bounds.minY + 10; }
        else { x = this.bounds.minX + Math.random() * (this.bounds.maxX - this.bounds.minX); y = this.bounds.maxY - 10; }

        // Choose enemy type based on observation and probability
        const roll = Math.random();
        const obs = this.player.profile.observation;

        let type = "Cabinet Indexer";
        if (obs > 70 && roll < 0.16) {
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
            this.player.vx = this.player.dashDx * (this.player.speed * 2.5);
            this.player.vy = this.player.dashDy * (this.player.speed * 2.5);
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
                    audioManager.playHit(); // simple sound for now
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

        // Apply velocities
        this.player.x += this.player.vx;
        this.player.y += this.player.vy;

        // Wall collisions
        if (this.player.x - this.player.radius < this.bounds.minX) this.player.x = this.bounds.minX + this.player.radius;
        if (this.player.x + this.player.radius > this.bounds.maxX) this.player.x = this.bounds.maxX - this.player.radius;
        if (this.player.y - this.player.radius < this.bounds.minY) this.player.y = this.bounds.minY + this.player.radius;
        if (this.player.y + this.player.radius > this.bounds.maxY) this.player.y = this.bounds.maxY - this.player.radius;

        // Obstacle collisions
        for (const obs of this.obstacles) {
            if (obs.r) {
                // Circle Monolith
                let distVecX = this.player.x - obs.x;
                let distVecY = this.player.y - obs.y;
                let dist = Math.sqrt(distVecX * distVecX + distVecY * distVecY);
                let minDist = obs.r + this.player.radius;
                if (dist < minDist) {
                    let angle = Math.atan2(distVecY, distVecX);
                    this.player.x = obs.x + Math.cos(angle) * minDist;
                    this.player.y = obs.y + Math.sin(angle) * minDist;
                }
            } else {
                // Rectangle box
                let closestX = Math.max(obs.x, Math.min(this.player.x, obs.x + obs.w));
                let closestY = Math.max(obs.y, Math.min(this.player.y, obs.y + obs.h));
                let dx = this.player.x - closestX;
                let dy = this.player.y - closestY;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.player.radius) {
                    let angle = Math.atan2(dy, dx);
                    let push = this.player.radius - dist;
                    this.player.x += Math.cos(angle) * push;
                    this.player.y += Math.sin(angle) * push;
                }
            }
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
            this.player.state = "attacking";

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
                this.player.profile.gold += e.lootRarity === "Worn" ? 12 : e.lootRarity === "Unsettling" ? 25 : 60;
                
                // Roll loot
                this.spawnLoot(e.x, e.y, e.lootRarity);
                
                // Explode particles
                this.createParticleExplosion(e.x, e.y, "#721010", 20);
                
                if (e.type === "Seal Mother") {
                    this.bossSpawned = false;
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
                        bounce: 0,
                        grav: 0.25
                    });
                } else if (e.type === "Corpse Echo") {
                    this.loot.push({
                        id: "memory_fragment",
                        x: e.x,
                        y: e.y,
                        vx: (Math.random() - 0.5) * 4,
                        vy: -4,
                        bounce: 0,
                        grav: 0.25
                    });
                }
                
                this.enemies.splice(i, 1);
                continue;
            }

            e.attackCooldown = Math.max(0, e.attackCooldown - 1);
            e.behaviorTimer++;

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
                    this.damagePlayer(e.damage);
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
                    this.spawnProjectiles("enemy", e.x, e.y, this.player.x, this.player.y, "ink_blot", {
                        damage: e.damage,
                        sanityDamage: 12,
                        speed: 5.5,
                        color: "#000000",
                        radius: 8,
                        life: 80
                    });
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
                    this.spawnProjectiles("enemy", e.x, e.y, this.player.x, this.player.y, "shadow_wave", {
                        damage: e.damage,
                        sanityDamage: 7,
                        speed: 6,
                        color: "#f1e2b7",
                        radius: 13,
                        life: 38
                    });
                }
            } else if (e.type === "Seal Mother") {
                // Boss movement
                if (dist > 30) {
                    e.vx = (dx / dist) * e.speed;
                    e.vy = (dy / dist) * e.speed;
                } else {
                    e.vx = 0;
                    e.vy = 0;
                }

                // Cast traps every 3 seconds
                if (e.behaviorTimer % 180 === 0) {
                    this.createParticleExplosion(e.x, e.y, "#9a1616", 10);
                    // Spawn warning circle under player
                    onEvent("boss_wax_trap", { x: this.player.x, y: this.player.y });
                }

                // Melee strike
                if (dist < e.radius + this.player.radius + 10 && e.attackCooldown === 0) {
                    e.attackCooldown = 80;
                    this.damagePlayer(e.damage);
                    this.createParticleExplosion(this.player.x, this.player.y, "#ffcc00", 15);
                }
            } else if (e.type === "The Shape") {
                // Rival copy - mimics behavior!
                if (dist > 50) {
                    e.vx = (dx / dist) * e.speed;
                    e.vy = (dy / dist) * e.speed;
                } else {
                    e.vx = 0;
                    e.vy = 0;
                }

                if (dist < 100 && e.attackCooldown === 0) {
                    e.attackCooldown = 50;
                    // Fire a shadowy sword wave
                    this.spawnProjectiles("enemy", e.x, e.y, this.player.x, this.player.y, "shadow_wave", {
                        damage: e.damage,
                        sanityDamage: 5,
                        speed: 6.5,
                        color: "#3d1052",
                        radius: 12,
                        life: 40
                    });
                }
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
                    this.spawnProjectiles("enemy", e.x, e.y, this.player.x, this.player.y, 
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

            e.x += e.vx;
            e.y += e.vy;

            // Simple wall boundaries for enemies
            if (e.x < this.bounds.minX) e.x = this.bounds.minX;
            if (e.x > this.bounds.maxX) e.x = this.bounds.maxX;
            if (e.y < this.bounds.minY) e.y = this.bounds.minY;
            if (e.y > this.bounds.maxY) e.y = this.bounds.maxY;
        }
    }

    damagePlayer(amount, sanityAmount = 0) {
        if (this.player.health <= 0 || this.player.invulnTimer > 0) return;

        // Apply armor formula
        const arm = this.player.stats.armor || 0;
        const reduced = Math.max(1, Math.round(amount * (20 / (20 + arm))));
        
        this.player.health -= reduced;
        this.player.invulnTimer = 25; // frames of safety
        
        this.spawnFloatingText(reduced, this.player.x, this.player.y - 20, "#b01212", false);
        this.hitStop = 2; // mini freeze on getting hit
        
        audioManager.playHit();
        if (this.canvasRenderer) this.canvasRenderer.triggerShake(5);
        
        if (this.player.health <= 0) {
            audioManager.playDeath();
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
                        let finalDmg = isCrit ? Math.round(p.damage * 1.7) : p.damage;
                        
                        e.health -= finalDmg;
                        this.createParticleExplosion(e.x, e.y, isCrit ? "#ffdd00" : "#aaaaaa", 6);
                        this.spawnFloatingText(finalDmg, e.x, e.y - 20, isCrit ? "#ffdd00" : "#ffffff", isCrit);
                        
                        if (isCrit) this.hitStop = 4; // satisfying hit-stop on crits

                        audioManager.playHit();
                        
                        // Knockback
                        const angle = Math.atan2(e.y - p.y, e.x - p.x);
                        e.x += Math.cos(angle) * 10;
                        e.y += Math.sin(angle) * 10;
                        
                        // Destroy projectile if single-hit
                        p.life = 0;
                        break;
                    }
                }
            } else {
                // Check player
                if (this.player.health > 0 && this.distance(p.x, p.y, this.player.x, this.player.y) < p.radius + this.player.radius) {
                    this.damagePlayer(p.damage, p.sanityDamage);
                    p.life = 0;
                }
            }
        }
    }

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    updateLoot() {
        for (const l of this.loot) {
            if (l.bounce < 1) {
                // Fall physics
                l.vy += l.grav;
                l.x += l.vx;
                l.y += l.vy;
                
                // Friction
                l.vx *= 0.95;
                if (l.vy > 0 && l.y >= 350 + (l.x % 30)) { // rough floor bounds
                    l.y = 350 + (l.x % 30);
                    l.vy = -l.vy * 0.4;
                    l.vx *= 0.5;
                    l.bounce++;
                }
            }

            // Magnetic attraction to player
            let dist = this.distance(this.player.x, this.player.y, l.x, l.y);
            let magnetRange = 100;
            if (dist < magnetRange && this.player.health > 0) {
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
            p.gold += lootData.gold;
            color = "#ffd700";
            p.signals.unshift(`Collected Satchel: Debt Gold reduced by ${lootData.gold}.`);
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

        // Small particle splash
        this.createParticleExplosion(lootData.x, lootData.y, color, 5);
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

    distance(x1, y1, x2, y2) {
        let dx = x2 - x1;
        let dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    spawnFloatingText(text, x, y, color, isCrit) {
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
