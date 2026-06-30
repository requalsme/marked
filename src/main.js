// Main Game Orchestrator, Inputs, Loop, and Screen Controllers

import { loadProfiles, saveProfiles, createProfile, getEquipmentStats, getArchiveStats } from "./state.js";
import { GameEngine } from "./engine.js";
import { CanvasRenderer } from "./canvas.js";
import { GameUI } from "./ui.js";
import { calculateOfflineProgress } from "./idle.js";
import { updateObservation, handleSanityDecay, corruptText, TAROT_DECK, REALITY_TRAITS } from "./systems.js";
import { assetLoader } from "./assets.js";
import { audioManager } from "./audio.js";

class GameOrchestrator {
    constructor() {
        this.saveData = loadProfiles();
        this.activeProfile = null;
        
        this.engine = new GameEngine();
        this.canvas = document.getElementById("game-canvas");
        this.canvasRenderer = new CanvasRenderer(this.canvas);
        this.engine.canvasRenderer = this.canvasRenderer; // cross ref
        
        this.ui = new GameUI(this);

        this.gameState = "title"; // title, offline_report, active, game_over
        this.waxTraps = []; // active boss traps

        this.init();
    }

    init() {
        this.bindInputEvents();
        this.initArchiveUI();
        
        // Show loading progress on Title container
        const container = document.getElementById("profile-list-container");
        if (container) {
            container.innerHTML = `<div class="empty-msg" style="color: #d4a343; font-family: 'Courier New';">Syncing behavior archives (0%)...</div>`;
        }

        assetLoader.loadManifestAndAssets(
            (progress) => {
                if (container) {
                    container.innerHTML = `<div class="empty-msg" style="color: #d4a343; font-family: 'Courier New';">Syncing behavior archives (${Math.round(progress * 100)}%)...</div>`;
                }
            }
        ).then((success) => {
            this.renderTitleScreen();
        });

        // Start Loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    bindInputEvents() {
        // Keyboard inputs
        window.addEventListener("keydown", (e) => {
            if (this.gameState !== "active") return;
            const key = e.key.toLowerCase();
            this.engine.keys[key] = true;

            // Trigger interact key E
            if (key === "e") {
                this.checkInteract();
            }
        });

        window.addEventListener("keyup", (e) => {
            const key = e.key.toLowerCase();
            this.engine.keys[key] = false;
        });

        // Mouse inputs
        this.canvas.addEventListener("mousemove", (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.engine.mouse.x = e.clientX - rect.left;
            this.engine.mouse.y = e.clientY - rect.top;
        });

        this.canvas.addEventListener("mousedown", (e) => {
            if (this.gameState !== "active") return;
            const rect = this.canvas.getBoundingClientRect();
            this.engine.mouse.click = true;
            this.engine.mouse.clickX = e.clientX - rect.left;
            this.engine.mouse.clickY = e.clientY - rect.top;
        });
    }

    checkInteract() {
        // Find if close to any interactable
        const p = this.engine.player;
        for (let i = 0; i < this.engine.interactables.length; i++) {
            const intr = this.engine.interactables[i];
            const dist = this.engine.distance(p.x, p.y, intr.x, intr.y);
            if (dist < intr.radius + p.radius + 15) {
                // Interact!
                if (intr.type === "blood_ritual_altar") {
                    this.ui.switchTab("rituals");
                } else if (intr.type === "static_signal_pylon") {
                    this.ui.switchTab("signals");
                } else if (intr.type === "corpse_lantern_shrine") {
                    this.ui.switchTab("corpses");
                } else if (intr.type === "fresh_marked_corpse" || intr.type === "burned_corpse_remains" || intr.type === "broadcast_corpse") {
                    this.ui.switchTab("corpses");
                } else if (intr.type === "wax_record_chest") {
                    if (intr.data.state === "closed") {
                        intr.data.state = "opening";
                        intr.data.timer = 45; // opening animation duration
                        this.activeProfile.signals.unshift("Opening Wax Record Chest...");
                    }
                } else if (intr.type === "sealed_zone_door") {
                    if (intr.data.state === "open") {
                        this.triggerVictory();
                    } else {
                        this.activeProfile.signals.unshift("The door is sealed. Defeat the Seal Mother to release the wax seal.");
                    }
                }
                break;
            }
        }
    }

    initArchiveUI() {
        document.getElementById("open-archive-btn").onclick = () => {
            document.getElementById("title-screen").style.display = "none";
            document.getElementById("archive-modal").style.display = "flex";
            this.updateArchiveUI();
        };

        document.getElementById("close-archive-btn").onclick = () => {
            document.getElementById("archive-modal").style.display = "none";
            document.getElementById("title-screen").style.display = "flex";
        };

        const attemptUpgrade = (key) => {
            const currentLvl = this.saveData.archive.upgrades[key] || 0;
            const cost = (currentLvl + 1) * 5;
            if (this.saveData.archive.memoryFragments >= cost) {
                this.saveData.archive.memoryFragments -= cost;
                this.saveData.archive.upgrades[key] = currentLvl + 1;
                saveProfiles(this.saveData);
                this.updateArchiveUI();
            }
        };

        document.getElementById("upgrade-health-btn").onclick = () => attemptUpgrade("baseHealth");
        document.getElementById("upgrade-damage-btn").onclick = () => attemptUpgrade("baseDamage");
        document.getElementById("upgrade-gold-btn").onclick = () => attemptUpgrade("startingGold");
    }

    updateArchiveUI() {
        const arch = this.saveData.archive;
        document.getElementById("archive-fragments-count").textContent = arch.memoryFragments;

        const updateBtn = (btnId, lvlId, key) => {
            const currentLvl = arch.upgrades[key] || 0;
            const cost = (currentLvl + 1) * 5;
            document.getElementById(lvlId).textContent = `Lv. ${currentLvl}`;
            const btn = document.getElementById(btnId);
            btn.textContent = `Cost: ${cost}`;
            btn.disabled = arch.memoryFragments < cost;
            btn.style.opacity = arch.memoryFragments < cost ? "0.5" : "1";
        };

        updateBtn("upgrade-health-btn", "archive-health-level", "baseHealth");
        updateBtn("upgrade-damage-btn", "archive-damage-level", "baseDamage");
        updateBtn("upgrade-gold-btn", "archive-gold-level", "startingGold");
    }

    renderTitleScreen() {
        this.gameState = "title";
        document.getElementById("title-screen").style.display = "flex";
        document.getElementById("game-layout").style.display = "none";
        document.getElementById("offline-modal").style.display = "none";
        document.getElementById("archive-modal").style.display = "none";
        document.getElementById("game-over-screen").style.display = "none";

        const container = document.getElementById("profile-list-container");
        container.innerHTML = "";

        if (this.saveData.profiles.length === 0) {
            container.innerHTML = `<div class="empty-msg">No wanderers registered. Form a new shape to begin.</div>`;
        } else {
            this.saveData.profiles.forEach(prof => {
                const card = document.createElement("div");
                card.className = "profile-card";
                card.innerHTML = `
                    <div style="flex:1;">
                        <div class="profile-name">${prof.name}</div>
                        <div class="profile-meta">Level ${prof.level} ${prof.classType} | Monolith Lv: ${prof.monolithLevel}</div>
                    </div>
                    <div>
                        <button class="game-btn load-profile-btn" data-id="${prof.id}">Descent</button>
                        <button class="game-btn delete-profile-btn btn-danger" data-id="${prof.id}" style="margin-left:5px;">Erase</button>
                    </div>
                `;

                card.querySelector(".load-profile-btn").addEventListener("click", () => this.selectProfile(prof.id));
                card.querySelector(".delete-profile-btn").addEventListener("click", () => this.deleteProfile(prof.id));

                container.appendChild(card);
            });
        }

        // Setup character creation listeners
        const form = document.getElementById("char-creation-form");
        form.onsubmit = (e) => {
            e.preventDefault();
            const name = document.getElementById("char-name-input").value.trim();
            const classType = document.getElementById("char-class-select").value;
            if (name) {
                const newP = createProfile(name, classType);
                const archiveStats = getArchiveStats(this.saveData.archive);
                newP.gold += archiveStats.gold;
                newP.memoryFragments = 0; // Initialize memory fragments
                
                this.saveData.profiles.push(newP);
                this.saveData.global.totalProfilesCreated++;
                saveProfiles(this.saveData);
                this.selectProfile(newP.id);
            }
        };
    }

    selectProfile(id) {
        this.saveData.activeProfileId = id;
        this.activeProfile = this.saveData.profiles.find(p => p.id === id);
        
        // Save timestamp update
        saveProfiles(this.saveData);

        // Check Offline Progression first
        const report = calculateOfflineProgress(this.activeProfile);
        if (report) {
            this.showOfflineReport(report);
        } else {
            this.startGame();
        }
    }

    deleteProfile(id) {
        if (confirm("Are you sure you want to permanently erase this profile from the registry?")) {
            this.saveData.profiles = this.saveData.profiles.filter(p => p.id !== id);
            if (this.saveData.activeProfileId === id) this.saveData.activeProfileId = null;
            saveProfiles(this.saveData);
            this.renderTitleScreen();
        }
    }

    showOfflineReport(report) {
        this.gameState = "offline_report";
        document.getElementById("title-screen").style.display = "none";
        document.getElementById("archive-modal").style.display = "none";
        document.getElementById("offline-modal").style.display = "flex";

        document.getElementById("offline-hours").textContent = report.absenceHours;
        document.getElementById("offline-survival").textContent = report.survivedHours;
        document.getElementById("offline-rewards-detail").innerHTML = `
            <div>Debt Gold Extracted: <span style="color:#d4af37">+${report.gold}</span></div>
            <div>Knowledge Gained: <span style="color:#a4b5d6">+${report.exp} EXP</span></div>
            <div>Parchments Filed: <strong>+${report.parchment}</strong></div>
            <div>Inks Blotted: <strong>+${report.ink}</strong></div>
            <div>Wax Seals Cast: <strong style="color:#a31c1c">+${report.waxSeals}</strong></div>
            <div>Sanity Strained: <span style="color:#b51919">-${report.sanityLost}%</span></div>
            <div>Monolith Observation: <span style="color:#cc1a1a">+${report.observationIncrease}%</span></div>
        `;
        document.getElementById("offline-watcher-note").textContent = `Watcher Diagnostic: "${report.conclusion}"`;

        document.getElementById("proceed-offline-btn").onclick = () => {
            this.startGame();
        };
    }

    startGame() {
        audioManager.init();
        this.gameState = "active";
        document.getElementById("title-screen").style.display = "none";
        document.getElementById("archive-modal").style.display = "none";
        document.getElementById("offline-modal").style.display = "none";
        document.getElementById("game-layout").style.display = "flex";
        
        // Load engine and reset
        this.engine.reset();
        
        // Tarot Deck Draw
        const keys = Object.keys(TAROT_DECK);
        this.activeProfile.activeTarot = keys[Math.floor(Math.random() * keys.length)];

        // Reality Trait Roll
        const traitKeys = Object.keys(REALITY_TRAITS);
        this.activeProfile.activeRealityTrait = traitKeys[Math.floor(Math.random() * traitKeys.length)];

        // Calculate equipment stats and combine with archive stats
        const eqStats = getEquipmentStats(this.activeProfile);
        const archStats = getArchiveStats(this.saveData.archive);
        
        // Merge stats manually for engine
        const combinedStats = {
            damage: eqStats.damage + archStats.damage,
            health: eqStats.health + archStats.health,
            armor: eqStats.armor,
            sanityResist: eqStats.sanityResist,
            signalClarity: eqStats.signalClarity,
            crit: eqStats.crit,
            speed: eqStats.speed
        };
        
        this.engine.setPlayer(this.activeProfile, combinedStats);

        // Spawn permanent interactables in Keeping House
        this.engine.addInteractable("blood_ritual_altar", 205, 362, { radius: 28 });
        this.engine.addInteractable("static_signal_pylon", 96, 314, { radius: 24 });
        this.engine.addInteractable("corpse_lantern_shrine", 646, 356, { radius: 25 });
        this.engine.addInteractable("wax_record_chest", 520, 382, { radius: 22, state: "closed" });
        this.engine.addInteractable("sealed_zone_door", 375, 176, { radius: 34, state: "closed" });
        
        // Spawn previous corpse if exists
        this.activeProfile.corpses.forEach(corp => {
            if (corp.active) {
                this.engine.addInteractable("decaying_corpse", corp.x, corp.y, { radius: 18, data: corp });
            }
        });

        this.lastTime = performance.now();
        
        // Show tutorial if active
        this.ui.renderTutorial(this.activeProfile);
        
        this.ui.updateHUD(this.activeProfile, this.engine);
        this.ui.renderActiveTab();
    }

    recalculateStats() {
        if (!this.engine.player) return;
        const eqStats = getEquipmentStats(this.activeProfile);
        this.engine.player.stats = eqStats;
        this.engine.player.maxHealth = this.activeProfile.maxHealth + eqStats.health;
        this.engine.player.damage = (this.activeProfile.classType === "Blood Marked" ? 25 : 18) + eqStats.damage;
        this.engine.player.crit = (this.activeProfile.classType === "Static Marked" ? 0.25 : 0.10) + eqStats.crit;
        this.engine.player.speed = (this.activeProfile.classType === "Static Marked" ? 4.5 : 3.5) + eqStats.speed;
    }

    saveActiveProfile() {
        if (!this.activeProfile) return;
        this.activeProfile.lastTimestamp = Date.now();
        
        // Exp / Level up logic
        const expNeeded = this.activeProfile.level * 100;
        if (this.activeProfile.exp >= expNeeded) {
            this.activeProfile.exp -= expNeeded;
            this.activeProfile.level += 1;
            this.activeProfile.maxHealth += 10;
            this.activeProfile.health = this.activeProfile.maxHealth;
            this.activeProfile.signals.unshift(`DIAGNOSTIC: Form stabilized. Level ${this.activeProfile.level} reached.`);
            
            // Audio and Visual Feedback
            audioManager.playLevelUp();
            this.ui.orch.engine.createParticleExplosion(this.ui.orch.engine.player.x, this.ui.orch.engine.player.y, "#d4af37", 40);
            this.canvasRenderer.showLevelUpBanner(this.activeProfile.level);
        }
        
        // Tutorial Step 0 -> 1
        if (this.activeProfile.tutorialStep === 0 && this.activeProfile.gold >= 100) {
            this.activeProfile.tutorialStep = 1;
            this.saveActiveProfile();
            this.ui.renderTutorial(this.activeProfile);
        }

        this.ui.updateHUD(this.activeProfile, this.engine);

        // Monolith scale difficulty based on Observation thresholds
        if (this.activeProfile.observation >= 100 && this.activeProfile.monolithLevel === 1) {
            this.activeProfile.monolithLevel = 2;
            this.activeProfile.signals.unshift("Observation 100% threshold crossed. Monolith Level increased to 2.");
        }

        saveProfiles(this.saveData);
    }

    triggerGameOver(cause = "Combat defeat") {
        this.gameState = "game_over";
        document.getElementById("game-layout").style.display = "none";
        document.getElementById("game-over-screen").style.display = "flex";

        const deathTitle = document.getElementById("death-title");
        deathTitle.textContent = "SIGIL COLLAPSED";
        deathTitle.style.color = "";
        document.getElementById("death-char-name").textContent = this.activeProfile.name;
        document.getElementById("death-cause-text").textContent = `Consequence: ${cause}`;
        
        // Save Corpse
        const corpseData = {
            x: this.engine.player.x,
            y: this.engine.player.y,
            cause: cause,
            gear: JSON.parse(JSON.stringify(this.activeProfile.gear)),
            zone: "The Keeping House",
            level: this.activeProfile.level,
            state: "fresh"
        };

        this.activeProfile.corpses.push(corpseData);
        this.activeProfile.stats.deaths++;

        // Reset stats for next descent
        this.activeProfile.health = this.activeProfile.maxHealth;
        this.activeProfile.sanity = 100;
        this.activeProfile.observation = 0; // resets observation on death to start fresh slice

        // Transfer memory fragments to global archive
        if (this.activeProfile.memoryFragments > 0) {
            this.saveData.archive.memoryFragments += this.activeProfile.memoryFragments;
            this.activeProfile.memoryFragments = 0;
        }

        this.saveActiveProfile();

        const respawnBtn = document.getElementById("respawn-btn");
        respawnBtn.textContent = "Return to Hub";
        respawnBtn.onclick = () => {
            this.renderTitleScreen();
        };
    }

    triggerVictory() {
        this.gameState = "game_over";
        document.getElementById("game-layout").style.display = "none";
        const overlay = document.getElementById("game-over-screen");
        overlay.style.display = "flex";
        
        document.getElementById("death-title").textContent = "RECORD SECURED";
        document.getElementById("death-title").style.color = "#d4a343";
        document.getElementById("death-char-name").textContent = this.activeProfile.name;
        document.getElementById("death-cause-text").textContent = "Success: Descent completed, observation records synced with Monolith.";
        
        // Reset descent stats, preserving gold and inventory items
        this.activeProfile.sanity = 100;
        this.activeProfile.observation = 0;
        if (!this.activeProfile.stats.escapes) this.activeProfile.stats.escapes = 0;
        this.activeProfile.stats.escapes++;

        // Transfer memory fragments to global archive
        if (this.activeProfile.memoryFragments > 0) {
            this.saveData.archive.memoryFragments += this.activeProfile.memoryFragments;
            this.activeProfile.memoryFragments = 0;
        }

        this.saveActiveProfile();

        const btn = document.getElementById("respawn-btn");
        btn.textContent = "Return to Monolith";
        btn.onclick = () => {
            document.getElementById("death-title").textContent = "SIGIL COLLAPSED";
            document.getElementById("death-title").style.color = "";
            btn.textContent = "Return to Hub";
            this.renderTitleScreen();
        };
    }

    loop() {
        if (this.gameState === "active" && this.engine.player) {
            // Engine update callback events
            this.engine.update((event, data) => {
                if (event === "player_died") {
                    this.canvasRenderer.triggerShake(30);
                    this.triggerGameOver("Collapsed in Keeping House battle.");
                } else if (event === "boss_wax_trap") {
                    // Spawn wax trap
                    this.waxTraps.push({
                        x: data.x,
                        y: data.y,
                        radius: 35,
                        timer: 60, // frames to trigger
                        active: true
                    });
                } else if (event === "boss_defeated") {
                    this.canvasRenderer.triggerShake(40);
                    this.activeProfile.signals.unshift("Warning Signal: Curse Seal Mother dissolved. High-tier artifact dropped.");
                    this.activeProfile.exp += 300;
                }
            });

            // Run systems update (Observation, Sanity decay)
            if (this.gameState === "active") {
                updateObservation(this.activeProfile, this.engine);
                handleSanityDecay(this.activeProfile, this.engine);
                audioManager.updateSanity(this.activeProfile.sanity);
                
                if (this.activeProfile.levelUpTimer > 0) {
                    this.activeProfile.levelUpTimer--;
                }

                // Update traps
                this.updateWaxTraps();

                // Save automatically every 3 seconds to keep offline dates accurate
                if (this.canvasRenderer.frame % 180 === 0) {
                    this.saveActiveProfile();
                }

                // Render active UI Tab updates
                if (this.canvasRenderer.frame % 10 === 0) {
                    this.ui.updateHUD(this.activeProfile, this.engine);
                }
            }

            // Draw game
            this.canvasRenderer.draw(this.engine);
            
            // Draw wax trap warnings on top
            this.drawWaxTraps();
        }

        requestAnimationFrame(this.loop);
    }

    updateWaxTraps() {
        const p = this.engine.player;
        for (let i = this.waxTraps.length - 1; i >= 0; i--) {
            const trap = this.waxTraps[i];
            trap.timer--;
            if (trap.timer <= 0) {
                // Trap triggers!
                if (trap.active) {
                    let dist = this.engine.distance(p.x, p.y, trap.x, trap.y);
                    if (dist < trap.radius + p.radius) {
                        this.engine.damagePlayer(25, 15);
                        this.canvasRenderer.triggerShake(15);
                        
                        // Stall player velocity/action (stun effect)
                        p.vx = 0;
                        p.vy = 0;
                        p.invulnTimer = 40;
                    }
                    this.engine.createParticleExplosion(trap.x, trap.y, "#ffcc00", 12);
                }
                this.waxTraps.splice(i, 1);
            }
        }
    }

    drawWaxTraps() {
        const ctx = this.canvasRenderer.ctx;
        ctx.save();
        for (const trap of this.waxTraps) {
            const pct = 1.0 - trap.timer / 60;
            const pulse = 0.35 + (Math.sin(trap.timer * 0.18) * 0.25 + 0.25);
            const frame = Math.floor(this.canvasRenderer.frame * 0.18) % 6;

            ctx.strokeStyle = `rgba(196, 35, 27, ${pulse})`;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(trap.x, trap.y, trap.radius, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = `rgba(164, 28, 22, ${0.16 * pct})`;
            ctx.beginPath();
            ctx.arc(trap.x, trap.y, trap.radius * pct, 0, Math.PI * 2);
            ctx.fill();

            assetLoader.drawFrame(ctx, "archive_curse_sigil.play", frame, trap.x, trap.y + 4, "right", 0.25 + pct * 0.12, 0.45 + pct * 0.45);
            if (trap.timer < 18) {
                assetLoader.drawFrame(ctx, "wax_stamp_impact.play", frame, trap.x, trap.y + 2, "right", 0.28, 0.75);
            }
        }
        ctx.restore();
    }
}

// Instantiate on window load
window.addEventListener("load", () => {
    window.gameOrchestrator = new GameOrchestrator();
});
