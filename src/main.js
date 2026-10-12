// Main Game Orchestrator, Inputs, Loop, and Screen Controllers

import { loadProfiles, saveProfiles, createProfile, getEquipmentStats, getArchiveStats, CLASSES } from "./state.js";
import { GameEngine, basePlayerSpeed, playerDamage, basePlayerCrit, SANITY_HIT } from "./engine.js";
import { CanvasRenderer } from "./canvas.js";
import { GameUI } from "./ui.js";
import { calculateOfflineProgress } from "./idle.js";
import { updateObservation, handleSanityDecay, corruptText, TAROT_DECK, REALITY_TRAITS, traitActive } from "./systems.js";
import { Watcher } from "./watcher.js";
import { activeCounters, COUNTER_INFO } from "./adapt.js";
import { ensureDossier, sampleDossier, diagnose, closeLife, recordDeath, obfuscationMask, recordEvent } from "./dossier.js";
import { addSignal, SIGNAL_LOG_LIMIT } from "./signals.js";
import { unlockFor, ensureLedger, MATRON_LINES, LAST_ENTRY, chooseWarning } from "./lore.js";
import { assetLoader } from "./assets.js";
import { audioManager } from "./audio.js";
import { ROOM } from "./world.js";
import { installUiTextures } from "./uitextures.js";

const STEP_MS = 1000 / 60; // fixed simulation step
const PYLON_COOLDOWN = 45; // seconds of life between intercepts at the signal pylon (halved under The Moon)
const STATIC_SKY_DECODE = 120; // seconds of life between free decodes under Static Sky

const CLASS_COLORS = {
    "Blood Marked": "#c4231b",
    "Signal Marked": "#4a8ed6",
    "Bone Marked": "#d8ccb0",
    "Static Marked": "#16d8a4",
    "Ritual Marked": "#a45ad0"
};

class GameOrchestrator {
    constructor() {
        this.saveData = loadProfiles();
        this.activeProfile = null;
        
        this.engine = new GameEngine();
        this.canvas = document.getElementById("game-canvas");
        this.canvasRenderer = new CanvasRenderer(this.canvas);
        this.engine.canvasRenderer = this.canvasRenderer; // cross ref
        this.canvasRenderer.onDrawWorld = (ctx) => this.drawWaxTraps(ctx);
        
        this.ui = new GameUI(this);

        this.gameState = "title"; // title, offline_report, active, game_over
        this.waxTraps = []; // active boss traps
        this.watcher = new Watcher();
        this.lifeFlags = {}; // one-shot remarks armed for this descent (sanity, low health)
        this.knownCounters = new Set(); // counters already announced this life

        this.init();
    }

    init() {
        installUiTextures();
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
        // Browsers only allow audio after a user gesture: start the title theme on first input
        const unlockAudio = () => {
            audioManager.init();
            if (this.gameState === "title") audioManager.play("title_music");
        };
        window.addEventListener("pointerdown", unlockAudio, { once: true });
        window.addEventListener("keydown", unlockAudio, { once: true });

        // Keyboard inputs
        window.addEventListener("keydown", (e) => {
            const key = e.key.toLowerCase();
            const typing = e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT");
            if (key === "m" && !typing) {
                const muted = audioManager.toggleMute();
                this.ui.showToast(muted ? "Audio muted [M]" : "Audio on [M]");
                return;
            }
            if (this.gameState !== "active") return;
            if (typing) return;

            // Panel hotkeys
            const panelKeys = { i: "inventory", r: "rituals", j: "signals", c: "corpses", u: "monolith" };
            if (panelKeys[key] && !e.repeat) {
                this.ui.toggleTab(panelKeys[key]);
                return;
            }
            if (key === "escape") {
                this.ui.closeDrawer();
                return;
            }
            if (key === "t" && !e.repeat) {
                this.ui.toggleAutoAttack();
                return;
            }
            // Keep Space/arrows from scrolling the page mid-fight
            if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) e.preventDefault();
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
        // Mouse positions are converted from screen space to world space (camera)
        this.canvas.addEventListener("mousemove", (e) => {
            const w = this.canvasRenderer.screenToWorld(e.clientX, e.clientY);
            this.engine.mouse.x = w.x;
            this.engine.mouse.y = w.y;
        });

        this.canvas.addEventListener("mousedown", (e) => {
            if (this.gameState !== "active" || e.button !== 0) return;
            const w = this.canvasRenderer.screenToWorld(e.clientX, e.clientY);
            this.engine.mouse.x = w.x;
            this.engine.mouse.y = w.y;
            this.engine.mouse.click = true;
            this.engine.mouse.clickX = w.x;
            this.engine.mouse.clickY = w.y;
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
                    this.useSignalPylon();
                } else if (intr.type === "corpse_lantern_shrine") {
                    this.ui.switchTab("corpses");
                } else if (intr.type === "fresh_marked_corpse" || intr.type === "burned_corpse_remains" || intr.type === "broadcast_corpse") {
                    this.ui.switchTab("corpses");
                } else if (intr.type === "wax_record_chest") {
                    if (intr.data.state === "closed") {
                        audioManager.play("corpse_interact");
                        intr.data.state = "opening";
                        intr.data.timer = 45; // opening animation duration
                        this.activeProfile.signals.unshift("Opening Wax Record Chest...");
                    }
                } else if (intr.type === "sealed_zone_door") {
                    if (intr.data.state === "open") {
                        this.triggerVictory();
                    } else {
                        audioManager.play("error_sound");
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
        audioManager.play("title_music");
        document.getElementById("title-screen").style.display = "flex";
        document.getElementById("game-layout").style.display = "none";
        document.getElementById("offline-modal").style.display = "none";
        document.getElementById("archive-modal").style.display = "none";
        document.getElementById("game-over-screen").style.display = "none";

        this.renderProfileList();
        this.renderClassPicker();

        // Menu: Continue / New Shape panes
        const hasProfiles = this.saveData.profiles.length > 0;
        document.getElementById("menu-continue-btn").style.display = hasProfiles ? "" : "none";
        document.querySelectorAll(".menu-item[data-pane]").forEach(btn => {
            btn.onclick = () => this.showTitlePane(btn.dataset.pane);
        });
        this.showTitlePane(hasProfiles ? "continue" : "new");

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

    showTitlePane(pane) {
        document.querySelectorAll(".menu-pane").forEach(el => el.classList.toggle("active", el.id === `pane-${pane}`));
        document.querySelectorAll(".menu-item[data-pane]").forEach(el => el.classList.toggle("selected", el.dataset.pane === pane));
        if (pane === "new") {
            const input = document.getElementById("char-name-input");
            if (input) setTimeout(() => input.focus(), 50);
        }
    }

    renderProfileList() {
        const container = document.getElementById("profile-list-container");
        container.innerHTML = "";
        if (this.saveData.profiles.length === 0) {
            container.innerHTML = `<div class="empty-msg">No wanderers registered. Form a new shape to begin.</div>`;
            return;
        }
        // Most recently played first
        const profiles = [...this.saveData.profiles].sort((a, b) => (b.lastTimestamp || 0) - (a.lastTimestamp || 0));
        for (const prof of profiles) {
            const card = document.createElement("div");
            card.className = "profile-card";
            card.style.setProperty("--sigil", CLASS_COLORS[prof.classType] || "#c79a42");
            card.innerHTML = `
                <div class="profile-sigil"><div class="sprite-idle"></div></div>
                <div class="profile-info">
                    <div class="profile-name"></div>
                    <div class="profile-meta"></div>
                </div>
                <div class="profile-actions">
                    <button class="game-btn btn-primary load-profile-btn">Descend</button>
                    <button class="game-btn delete-profile-btn btn-danger" title="Erase this record">✕</button>
                </div>
            `;
            // User-entered names go in via textContent, never as HTML
            card.querySelector(".profile-name").textContent = prof.name;
            const deaths = prof.stats && prof.stats.deaths ? ` · ${prof.stats.deaths} death${prof.stats.deaths === 1 ? "" : "s"}` : "";
            card.querySelector(".profile-meta").textContent = prof.absolved ? `Absolved · Level ${prof.level} ${prof.classType} · record closed` : `Level ${prof.level} ${prof.classType}${deaths}`;
            const descend = card.querySelector(".load-profile-btn");
            if (prof.absolved) { descend.disabled = true; descend.textContent = "Absolved"; card.classList.add("absolved"); }
            descend.addEventListener("click", () => this.selectProfile(prof.id));
            card.querySelector(".delete-profile-btn").addEventListener("click", () => this.deleteProfile(prof.id));
            container.appendChild(card);
        }
    }

    renderClassPicker() {
        const picker = document.getElementById("class-picker");
        const select = document.getElementById("char-class-select");
        const detail = document.getElementById("class-detail");
        if (!picker || picker.childElementCount > 0) return;

        // Stats as combat actually computes them (class base + starting gear)
        const sheets = Object.keys(CLASSES).map(name => {
            const prof = createProfile("preview", name);
            const eq = getEquipmentStats(prof);
            return {
                name,
                desc: CLASSES[name].desc,
                health: prof.maxHealth + eq.health,
                damage: playerDamage(prof, eq.damage),
                speed: basePlayerSpeed(name) + eq.speed,
                crit: basePlayerCrit(name) + eq.crit
            };
        });
        const max = {
            health: Math.max(...sheets.map(c => c.health)),
            damage: Math.max(...sheets.map(c => c.damage)),
            speed: Math.max(...sheets.map(c => c.speed)),
            crit: Math.max(...sheets.map(c => c.crit))
        };
        const pips = (v, m) => {
            const n = Math.max(1, Math.round((v / m) * 5));
            return Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("");
        };

        const choose = (sheet) => {
            select.value = sheet.name;
            picker.querySelectorAll(".class-card").forEach(c => c.classList.toggle("selected", c.dataset.cls === sheet.name));
            detail.style.setProperty("--sigil", CLASS_COLORS[sheet.name]);
            detail.innerHTML = `
                <div class="class-detail-name font-cinzel">${sheet.name}</div>
                <div class="class-detail-desc">${sheet.desc}</div>
                <div class="class-stats">
                    <span>Flesh</span><span class="pips">${pips(sheet.health, max.health)}</span><b>${sheet.health}</b>
                    <span>Damage</span><span class="pips">${pips(sheet.damage, max.damage)}</span><b>${sheet.damage}</b>
                    <span>Speed</span><span class="pips">${pips(sheet.speed, max.speed)}</span><b>${sheet.speed.toFixed(1)}</b>
                    <span>Critical</span><span class="pips">${pips(sheet.crit, max.crit)}</span><b>${Math.round(sheet.crit * 100)}%</b>
                </div>`;
            audioManager.play("button_click");
        };

        for (const sheet of sheets) {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "class-card";
            card.dataset.cls = sheet.name;
            card.setAttribute("role", "radio");
            card.style.setProperty("--sigil", CLASS_COLORS[sheet.name]);
            card.innerHTML = `<div class="sprite-idle"></div><div class="class-card-name font-cinzel">${sheet.name.replace(" Marked", "")}</div>`;
            card.addEventListener("click", () => choose(sheet));
            picker.appendChild(card);
        }
        choose(sheets.find(c => c.name === select.value) || sheets[0]);
    }

    selectProfile(id) {
        this.saveData.activeProfileId = id;
        this.activeProfile = this.saveData.profiles.find(p => p.id === id);
        if (this.activeProfile.absolved) return; // the record is closed
        ensureLedger(this.activeProfile);
        
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
        audioManager.init();
        audioManager.play("idle_return_music");
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
        this.waxTraps = [];
        
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
            speed: eqStats.speed,
            healthRegen: eqStats.healthRegen,
            obfuscation: eqStats.obfuscation,
            goldFind: eqStats.goldFind
        };
        
        this.engine.setPlayer(this.activeProfile, combinedStats);
        ensureDossier(this.activeProfile);
        this.lifeFlags = {};
        this.knownCounters = new Set();
        this.canvasRenderer.resize();
        this.canvasRenderer.snapCamera(this.engine);
        this.ui.closeDrawer();

        // Spawn permanent interactables in Keeping House
        for (const intr of ROOM.interactables) {
            this.engine.addInteractable(intr.type, intr.x, intr.y, { ...intr.data });
        }
        
        // Place previous corpses where they fell
        this.activeProfile.corpses.forEach(corp => {
            if (corp.state === "risen") return; // it walked away
            const type = corp.state === "burned" ? "burned_corpse_remains"
                : corp.state === "broadcasted" ? "broadcast_corpse" : "fresh_marked_corpse";
            const cy = this.engine.clampY(corp.y);
            this.engine.addInteractable(type, this.engine.clampX(corp.x, cy), cy, { radius: 18, corpse: corp });
        });

        this.stepAccumulator = 0;
        
        // Show tutorial if active
        this.ui.renderTutorial(this.activeProfile);
        
        this.ui.updateHUD(this.activeProfile, this.engine);
        this.ui.renderActiveTab();
    }

    recalculateStats() {
        if (!this.engine.player) return;
        const eqStats = getEquipmentStats(this.activeProfile);
        const archStats = getArchiveStats(this.saveData.archive);
        eqStats.damage += archStats.damage;
        eqStats.health += archStats.health;
        this.engine.player.stats = eqStats;
        this.engine.player.maxHealth = this.activeProfile.maxHealth + eqStats.health;
        this.engine.player.damage = playerDamage(this.activeProfile, eqStats.damage);
        this.engine.player.crit = basePlayerCrit(this.activeProfile.classType) + eqStats.crit;
        this.engine.player.speed = basePlayerSpeed(this.activeProfile.classType) + eqStats.speed;
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
            // Apply to the live body too: +10 max and a full heal
            if (this.engine.player) {
                this.engine.player.maxHealth += 10;
                this.engine.player.health = this.engine.player.maxHealth;
            }
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

        // The feed is a log, not an archive: keep the newest entries
        if (this.activeProfile.signals.length > SIGNAL_LOG_LIMIT) this.activeProfile.signals.length = SIGNAL_LOG_LIMIT;

        // Monolith scale difficulty based on Observation thresholds
        if (this.activeProfile.observation >= 100 && this.activeProfile.monolithLevel === 1) {
            this.activeProfile.monolithLevel = 2;
            this.activeProfile.signals.unshift("Observation 100% threshold crossed. Monolith Level increased to 2.");
        }

        saveProfiles(this.saveData);
    }

    // Close out the current life: record its length and reset per-descent counters
    endLife() {
        const p = this.activeProfile;
        const life = this.engine.player ? this.engine.player.currentLifeDuration : 0;
        p.longestLife = Math.max(p.longestLife || 0, life);
        closeLife(p);
        this.watcher.resetLife(p);
        p.currentLifeDuration = 0;
        p.ritualsThisDescent = 0;
        p.lastRitualTime = 0;
        p.lastPylonLife = -999;
        this.lifeFlags.autoDecode = 0;
    }

    // The end-of-descent card: death, escape and absolution each say something different
    setEndCopy({ intro, name, outro, corpseHint }) {
        const d = document.getElementById("death-desc");
        const strong = document.createElement("strong");
        strong.id = "death-char-name";
        strong.textContent = name;
        d.replaceChildren(intro, strong, outro);
        document.getElementById("death-corpse-hint").style.display = corpseHint ? "" : "none";
    }

    triggerGameOver(cause = "Combat defeat") {
        this.gameState = "game_over";
        document.getElementById("game-layout").style.display = "none";
        document.getElementById("game-over-screen").style.display = "flex";

        const deathTitle = document.getElementById("death-title");
        deathTitle.textContent = "SIGIL COLLAPSED";
        deathTitle.style.color = "";
        this.setEndCopy({ intro: "The wanderer shape ", name: this.activeProfile.name, outro: " was noticed and overwhelmed. The Monolith has cataloged their bones, adding to its behavior matrices.", corpseHint: true });
        document.getElementById("death-cause-text").textContent = `Consequence: ${cause}`;
        
        // Save Corpse
        const killer = this.engine.lastDamageSource || null;
        recordDeath(this.activeProfile, { cause, killer, seconds: this.engine.player.currentLifeDuration, observation: this.activeProfile.observation, level: this.activeProfile.level });
        const corpseData = {
            x: this.engine.player.x,
            y: this.engine.player.y,
            cause: cause,
            killer: killer,
            seconds: Math.round(this.engine.player.currentLifeDuration),
            gear: JSON.parse(JSON.stringify(this.activeProfile.gear)),
            zone: "The Keeping House",
            level: this.activeProfile.level,
            state: "fresh"
        };

        this.activeProfile.corpses.push(corpseData);
        // Keep the registry readable: only the five most recent remains persist
        if (this.activeProfile.corpses.length > 5) this.activeProfile.corpses.shift();
        audioManager.play("corpse_spawn");
        audioManager.setMusicState("silent");
        this.activeProfile.stats.deaths++;

        // Reset stats for next descent
        this.endLife();
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
        audioManager.setMusicState("silent");
        audioManager.play("victory");
        document.getElementById("game-layout").style.display = "none";
        const overlay = document.getElementById("game-over-screen");
        overlay.style.display = "flex";
        
        document.getElementById("death-title").textContent = "RECORD SECURED";
        document.getElementById("death-title").style.color = "#d4a343";
        this.setEndCopy({ intro: "The wanderer shape ", name: this.activeProfile.name, outro: " crossed the threshold. The Monolith has logged the way out, and learns a little from it.", corpseHint: false });
        document.getElementById("death-cause-text").textContent = "Success: Descent completed, observation records synced with Monolith.";
        
        // Reset descent stats, preserving gold and inventory items
        this.endLife();
        this.activeProfile.sanity = 100;
        this.activeProfile.observation = 0;
        if (!this.activeProfile.stats.escapes) this.activeProfile.stats.escapes = 0;
        this.activeProfile.stats.escapes++;
        const learned = this.unlockAndAnnounce("escape");
        if (learned) document.getElementById("death-cause-text").textContent += ` Ledger page ${learned.num}, "${learned.title}", recovered.`;

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

    loop(now) {
        // Fixed-timestep simulation: game logic always advances at 60 steps per
        // second regardless of the display's refresh rate; rendering happens once
        // per animation frame.
        if (this.lastTime === undefined) this.lastTime = now;
        const elapsed = Math.min(250, Math.max(0, now - this.lastTime));
        this.lastTime = now;

        if (this.gameState === "active" && this.engine.player) {
            this.stepAccumulator = (this.stepAccumulator || 0) + elapsed;
            let steps = 0;
            while (this.stepAccumulator >= STEP_MS && steps < 5 && this.gameState === "active") {
                this.update();
                this.stepAccumulator -= STEP_MS;
                steps++;
            }
            if (steps === 5) this.stepAccumulator = 0; // too far behind: drop the backlog

            // Render active UI updates
            if (this.gameState === "active" && this.canvasRenderer.frame % 10 === 0) {
                this.ui.updateHUD(this.activeProfile, this.engine);
            }

            // Draw game (wax traps are drawn through the renderer's world-space hook)
            this.canvasRenderer.draw(this.engine);
        }

        requestAnimationFrame(this.loop);
    }

    update() {
        this.simTick = (this.simTick || 0) + 1;

        // Engine update callback events
        this.engine.update((event, data) => {
            if (event === "player_died") {
                this.canvasRenderer.triggerShake(30);
                this.triggerGameOver(this.engine.deathCause());
            } else if (event === "boss_wax_trap") {
                // Spawn wax trap
                audioManager.play("wax_trap");
                this.waxTraps.push({
                    x: data.x,
                    y: data.y,
                    radius: 35,
                    timer: 60, // frames to trigger
                    life: 60,
                    kind: "wax",
                    damage: data.damage ?? 25,
                    sanity: SANITY_HIT.waxTrap,
                    source: "Seal Mother's wax trap",
                    active: true
                });
            } else if (event === "mark") {
                // Something the Monolith has learned to do to you: a telegraphed ring that resolves after `frames`
                audioManager.play("wax_trap");
                this.waxTraps.push({ x: data.x, y: data.y, radius: data.radius, timer: data.frames, life: data.frames, kind: data.kind, damage: data.damage, sanity: data.sanity || 0, source: data.source, active: true });
            } else if (event === "candle_snuffed") {
                this.engine.createParticleExplosion(data.x, data.y - 30, "#aaa8a4", 8);
                audioManager.play("candle_snuff");
            } else if (event === "corpse_rose") {
                this.canvasRenderer.triggerShake(10);
                this.canvasRenderer.showBanner("A BODY RISES", `${data.corpse.cause || "What you left behind"}. It remembers.`, "#6a6a6a", 200);
                addSignal(this.activeProfile, `The body you left stands again. ${data.corpse.cause ? data.corpse.cause + "." : ""} It carries what you carried.`, "corpse");
                this.watcher.notify("corpse_rose");
            } else if (event === "watcher_confrontation") {
                audioManager.play("observation_threshold", { tier: Math.min(4, data.wave) });
                this.canvasRenderer.triggerShake(16);
                this.watcher.notify("confrontation");
                this.canvasRenderer.showBanner(`WATCHER CONFRONTATION ${data.wave}`, `${data.count} witness${data.count === 1 ? "" : "es"} descend${data.count === 1 ? "s" : ""}. Survival is being studied.`, "#9a4ab8", 200);
            } else if (event === "boss_spawned") {
                this.canvasRenderer.triggerShake(25);
                this.canvasRenderer.showBanner("THE SEAL MOTHER WAKES", "Break her seal to open the door.", "#c4231b", 240);
                this.activeProfile.signals.unshift("Warning Signal: The Seal Mother has been unsealed. Defeat her to open the exit.");
                this.watcher.notify("boss_wake");
                this.unlockAndAnnounce("boss_wake");
                this.matronSpeaks(MATRON_LINES.wake);
            } else if (event === "boss_defeated") {
                this.canvasRenderer.triggerShake(40);
                this.activeProfile.signals.unshift("Warning Signal: Curse Seal Mother dissolved. High-tier artifact dropped.");
                this.activeProfile.exp += 300;
                this.watcher.notify("boss_down");
                this.unlockAndAnnounce("boss_down");
                this.matronSpeaks(MATRON_LINES.down);
            } else if (event === "boss_phase") {
                this.canvasRenderer.triggerShake(14);
                this.canvasRenderer.showBanner(data.phase === 2 ? "THE MATRON TIGHTENS HER GRIP" : "THE REGISTER ANSWERS HER",
                    data.phase === 2 ? "Her seals fall in threes." : "Loose pages rise, and her seals fall where you are going.", "#c4231b", 200);
                this.matronSpeaks(data.phase === 2 ? MATRON_LINES.phase2 : MATRON_LINES.phase3);
            } else if (event === "echo_down") {
                this.unlockAndAnnounce("echo_down");
            }
        });

        if (this.gameState !== "active") return;

        // Run systems update (Observation, Sanity decay)
        const dt = STEP_MS / 1000;
        const crossed = updateObservation(this.activeProfile, this.engine, dt);
        if (crossed) {
            audioManager.play("observation_threshold", { tier: crossed.tier });
            this.canvasRenderer.triggerShake(6 + crossed.tier * 3);
            this.watcher.notify("tier" + crossed.tier);
            this.unlockAndAnnounce("tier" + crossed.tier);
            this.canvasRenderer.showBanner(`YOU ARE ${crossed.name.toUpperCase()}`, `Observation ${crossed.at}% — ${crossed.detail}`, "#c4231b", 200);
            this.ui.flashObservation();
        }
        handleSanityDecay(this.activeProfile, this.engine, dt);
        const p = this.engine.player;
        this.studyPlayer(dt);
        audioManager.update({
            sanity: p.sanity,
            observation: this.activeProfile.observation,
            enemiesNear: this.engine.enemies.filter(e => this.engine.distance(p.x, p.y, e.x, e.y) < 260).length,
            bossActive: this.engine.bossSpawned
        });

        // Update traps
        this.updateWaxTraps();

        // Location-dependent panels refresh when the player walks in/out of range
        if (this.simTick % 15 === 0 && this.ui.isDrawerOpen() && (this.ui.activeTab === "rituals" || this.ui.activeTab === "corpses")) {
            const near = this.engine.interactables
                .filter(i => this.engine.distance(p.x, p.y, i.x, i.y) < i.radius + p.radius + 15)
                .map(i => i.type).join(",");
            if (near !== this.lastNearKey) {
                this.lastNearKey = near;
                this.ui.renderActiveTab();
            }
        }

        // Save automatically every 3 seconds to keep offline dates accurate
        if (this.simTick % 180 === 0) {
            this.saveActiveProfile();
        }
    }

    // The Monolith takes notes, and the Watcher decides whether any of it is worth saying
    studyPlayer(dt) {
        const prof = this.activeProfile, p = this.engine.player;
        sampleDossier(prof, this.engine, dt);
        const mask = obfuscationMask(prof, p.stats);
        if (this.simTick % 60 === 0) prof.activeDiagnosis = diagnose(prof, mask);

        // the Monolith decides what to use against you (every two seconds)
        if (this.simTick % 120 === 0) this.refreshCounters(prof, mask);

        // one-shot remarks about the body and mind
        if (p.sanity < 40 && !this.lifeFlags.fractured) { this.lifeFlags.fractured = true; this.watcher.notify("sanity_fractured"); }
        if (p.sanity >= 60) this.lifeFlags.fractured = false;
        if (p.health < p.maxHealth * 0.25 && !this.lifeFlags.lowHealth) { this.lifeFlags.lowHealth = true; this.watcher.notify("low_health"); }
        if (p.health > p.maxHealth * 0.5) this.lifeFlags.lowHealth = false;

        // Static Sky: intercepted signals decode themselves
        if (traitActive(prof, "Static Sky")) {
            const slot = Math.floor(p.currentLifeDuration / STATIC_SKY_DECODE);
            if (slot > (this.lifeFlags.autoDecode || 0)) {
                this.lifeFlags.autoDecode = slot;
                this.unlockAndAnnounce("communion");
            }
        }

        if (this.simTick % 30 !== 15) return;
        const nearCorpse = this.engine.interactables.some(i => i.type === "fresh_marked_corpse" && this.engine.distance(p.x, p.y, i.x, i.y) < 320);
        // The Moon makes signals come twice as fast; Static Sky makes the Watcher chatty
        const gapMult = (prof.activeTarot === "The Moon" ? 0.5 : 1) * (traitActive(prof, "Static Sky") ? 0.7 : 1);
        const w = this.watcher.update(prof, { life: p.currentLifeDuration, observation: prof.observation, sanity: p.sanity, mask, gapMult, nearCorpse });
        if (w) this.deliverWhisper(w);
    }

    refreshCounters(prof, mask) {
        const counters = activeCounters(prof, prof.observation, mask);
        this.engine.counters = counters;
        for (const id of Object.keys(counters)) {
            if (this.knownCounters.has(id)) continue;
            this.knownCounters.add(id);
            const info = COUNTER_INFO[id];
            this.canvasRenderer.showBanner("THE MONOLITH ADAPTS", `${info.name}: ${info.blurb}`, "#9a4ab8", 220);
            addSignal(prof, `Your habit has been put to work. ${info.name}: ${info.blurb}`, "warning");
            if (this.knownCounters.size === 1) this.watcher.notify("adapt");
        }
    }

    // A page of the Ledger, earned by something the player did
    unlockAndAnnounce(trigger) {
        const page = unlockFor(this.activeProfile, trigger);
        if (page) this.announcePage(page);
        return page;
    }

    announcePage(page) {
        const prof = this.activeProfile;
        addSignal(prof, `Memory Signal: Ledger page ${page.num}, "${page.title}", intercepted.`, "memory");
        this.canvasRenderer.showBanner(`LEDGER PAGE ${page.num}`, `${page.title}. Filed under Signals, Ledger.`, "#c2a35e", 220);
        audioManager.play("signal_decode");
        this.ui.updateLedgerBadge(prof);
    }

    // The signal pylon: a free intercept every so often. What it says depends on the state of your mind.
    useSignalPylon() {
        const prof = this.activeProfile, p = this.engine.player;
        const moon = prof.activeTarot === "The Moon";
        const cool = PYLON_COOLDOWN * (moon ? 0.5 : 1);
        const since = p.currentLifeDuration - (prof.lastPylonLife ?? -999);
        this.ui.signalFilter = "warning";
        this.ui.switchTab("signals");
        if (since < cool) {
            audioManager.play("error_sound");
            this.ui.showToast(`The pylon is still hissing. Ready in ${Math.ceil(cool - since)}s.`);
            return;
        }
        prof.lastPylonLife = p.currentLifeDuration;
        const w = chooseWarning({ sanity: p.sanity, moon, clarity: p.stats.signalClarity || 0, topics: Object.keys(this.engine.counters), boss: this.engine.bossSpawned });
        addSignal(prof, w.text, "warning", w.falseSignal ? { falseSignal: true } : {});
        recordEvent(prof, "signal");
        audioManager.play("signal_decode");
        this.ui.renderActiveTab();
    }

    // The Seal Mother's few words, in her own voice
    matronSpeaks(text) {
        this.ui.showWhisper(text, "matron");
        addSignal(this.activeProfile, `The Seal Mother: "${text}"`, "memory");
    }

    // The last entry: the player's own name, struck out. The record closes and the profile is retired.
    triggerAbsolution() {
        const p = this.activeProfile;
        p.absolved = true;
        p.stats.absolvedAt = Date.now();
        this.saveData.archive.memoryFragments += 20;
        this.gameState = "game_over";
        audioManager.setMusicState("silent");
        audioManager.play("victory");
        document.getElementById("game-layout").style.display = "none";
        document.getElementById("game-over-screen").style.display = "flex";
        const title = document.getElementById("death-title");
        title.textContent = LAST_ENTRY.title_card;
        title.style.color = "#c2a35e";
        this.setEndCopy({ intro: "", name: p.name, outro: ", absolved.", corpseHint: false });
        const cause = document.getElementById("death-cause-text");
        cause.textContent = "";
        for (const line of LAST_ENTRY.epilogue) {
            const row = document.createElement("div");
            row.textContent = line;
            row.style.margin = "0.6em 0";
            cause.appendChild(row);
        }
        this.endLife();
        this.saveActiveProfile();
        const btn = document.getElementById("respawn-btn");
        btn.textContent = "Return to the Ledger";
        btn.onclick = () => {
            title.textContent = "SIGIL COLLAPSED";
            title.style.color = "";
            btn.textContent = "Return to Hub";
            this.renderTitleScreen();
        };
    }

    deliverWhisper(w) {
        addSignal(this.activeProfile, w.text, "watcher", w.kind === "false" ? { falseSignal: true } : {});
        this.ui.showWhisper(w.text, w.kind);
        audioManager.play("watcher_whisper", { kind: w.kind });
    }

    updateWaxTraps() {
        const p = this.engine.player;
        for (let i = this.waxTraps.length - 1; i >= 0; i--) {
            const trap = this.waxTraps[i];
            trap.timer--;
            if (trap.timer <= 0) {
                // Trap triggers!
                if (trap.active) {
                    audioManager.play("wax_trap_trigger");
                    let dist = this.engine.distance(p.x, p.y, trap.x, trap.y);
                    if (dist < trap.radius + p.radius) {
                        this.engine.damagePlayer(trap.damage ?? 25, trap.sanity ?? 15, trap.x, trap.y, trap.source || "a wax trap");
                        this.canvasRenderer.triggerShake(trap.kind === "slam" ? 10 : 15);
                        
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

    drawWaxTraps(ctx) {
        ctx.save();
        for (const trap of this.waxTraps) {
            const pct = 1.0 - trap.timer / (trap.life || 60);
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

            // A slam is a plain red ring closing in; wax traps and bargains carry the seal art
            if (trap.kind === "slam") continue;
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
