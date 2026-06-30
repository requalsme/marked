// UI Orchestrator, DOM Manager, and Tooltips

import { getEquipmentStats, CLASSES } from "./state.js";
import { corruptText, TAROT_DECK, REALITY_TRAITS } from "./systems.js";
import { audioManager } from "./audio.js";

export class GameUI {
    constructor(orchestrator) {
        this.orch = orchestrator;
        this.activeTab = "inventory";
        this.tooltip = document.createElement("div");
        this.tooltip.className = "game-tooltip";
        document.body.appendChild(this.tooltip);

        this.tutorialOverlay = document.getElementById("tutorial-overlay");
        this.tutorialText = document.getElementById("tutorial-text");
        this.tutorialSkipBtn = document.getElementById("tutorial-skip-btn");

        if (this.tutorialSkipBtn) {
            this.tutorialSkipBtn.addEventListener("click", () => {
                if (this.orch.profile) {
                    this.orch.profile.tutorialStep = 4;
                    this.orch.saveActiveProfile();
                    this.renderTutorial(this.orch.profile);
                    this.renderActiveTab();
                }
            });
        }

        this.bindEvents();
    }

    bindEvents() {
        document.body.addEventListener("click", (e) => {
            if (e.target.closest(".game-btn") || e.target.closest(".tab-btn") || e.target.closest(".inventory-slot") || e.target.closest(".equip-slot")) {
                audioManager.playClick();
            }
        });

        // Tab switching
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                if (btn.classList.contains("tab-locked")) {
                    return; // Prevent switching to locked tabs
                }
                const tab = e.target.getAttribute("data-tab");
                this.switchTab(tab);
                
                // Tutorial Step 2 -> 3 (Open Inventory)
                if (tab === "inventory" && this.orch.profile && this.orch.profile.tutorialStep === 2) {
                    this.orch.profile.tutorialStep = 3;
                    this.orch.saveActiveProfile();
                    this.renderTutorial(this.orch.profile);
                }
            });
        });

        // Toggle Auto-Attack
        const autoToggle = document.getElementById("auto-attack-btn");
        if (autoToggle) {
            autoToggle.addEventListener("click", () => {
                if (this.orch.engine) {
                    this.orch.engine.autoAttack = !this.orch.engine.autoAttack;
                    autoToggle.textContent = this.orch.engine.autoAttack ? "Auto-Combat: ON" : "Auto-Combat: OFF";
                    autoToggle.classList.toggle("btn-active", this.orch.engine.autoAttack);
                }
            });
        }
    }

    switchTab(tabId) {
        this.activeTab = tabId;
        document.querySelectorAll(".tab-content").forEach(el => {
            el.classList.remove("active-panel");
        });
        document.querySelectorAll(".tab-btn").forEach(btn => {
            btn.classList.remove("tab-btn-active");
        });

        const panel = document.getElementById(`panel-${tabId}`);
        const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (panel) panel.classList.add("active-panel");
        if (btn) btn.classList.add("tab-btn-active");

        this.renderActiveTab();
    }

    renderTutorial(profile) {
        if (!this.tutorialOverlay) return;
        
        // If profile doesn't have tutorialStep, assume 4 (done) for backward compatibility
        if (typeof profile.tutorialStep === "undefined") {
            profile.tutorialStep = 4;
        }

        const step = profile.tutorialStep;
        
        // Manage tab locks
        const tabs = document.querySelectorAll(".tab-btn");
        tabs.forEach(tab => {
            const tabName = tab.getAttribute("data-tab");
            tab.classList.remove("tab-locked");
            
            if (step < 2 && tabName !== "monolith") {
                tab.classList.add("tab-locked");
            } else if (step < 3 && (tabName === "rituals" || tabName === "signals")) {
                tab.classList.add("tab-locked");
            }
        });

        // Hide overlay if done
        if (step >= 4) {
            this.tutorialOverlay.classList.add("hidden");
            document.querySelectorAll(".tutorial-highlight").forEach(el => el.classList.remove("tutorial-highlight"));
            return;
        }

        this.tutorialOverlay.classList.remove("hidden");

        if (step === 0) {
            this.tutorialText.innerHTML = "Welcome.<br><br>Move with <b>[WASD]</b>. Attack by <b>[Clicking]</b> or <b>[Space]</b>.<br><br><b>Goal:</b> Kill enemies and collect 100 DG (Gold).";
        } else if (step === 1) {
            this.tutorialText.innerHTML = "You have enough DG.<br><br>Open the <b>Monolith</b> tab and purchase your first <b>Body Upgrade</b>.";
            
            // Switch to monolith if not there, or at least highlight it
            if (this.activeTab !== "monolith") {
                const monolithTab = document.querySelector('.tab-btn[data-tab="monolith"]');
                if (monolithTab) monolithTab.classList.add("tutorial-highlight");
            } else {
                document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove("tutorial-highlight"));
            }
        } else if (step === 2) {
            this.tutorialText.innerHTML = "Excellent.<br><br>Enemies occasionally drop loot. Click the <b>Inventory</b> tab to inspect your gear.";
            const invTab = document.querySelector('.tab-btn[data-tab="inventory"]');
            if (invTab) invTab.classList.add("tutorial-highlight");
        } else if (step === 3) {
            this.tutorialText.innerHTML = "The deeper you go, the more you are <b>Observed</b>.<br><br><b>Rituals</b> unlock power at the cost of your <b>Flesh</b>.<br><br>Watch your <b>Sanity</b>.";
            document.querySelectorAll(".tutorial-highlight").forEach(el => el.classList.remove("tutorial-highlight"));
        }
    }

    updateHUD(profile, engine) {
        if (!profile || !engine.player) return;

        const san = profile.sanity;
        const body = document.body;

        // Reset sanity classes
        body.classList.remove("sanity-strained", "sanity-fractured", "sanity-broken");
        if (san < 15) {
            body.classList.add("sanity-broken");
        } else if (san < 40) {
            body.classList.add("sanity-fractured");
        } else if (san < 70) {
            body.classList.add("sanity-strained");
        }

        // Apply health bar width
        const hpBar = document.getElementById("hud-hp-bar");
        const hpText = document.getElementById("hud-hp-text");
        if (hpBar) {
            const pct = Math.max(0, engine.player.health / engine.player.maxHealth) * 100;
            hpBar.style.width = `${pct}%`;
        }
        if (hpText) {
            hpText.textContent = corruptText(`${engine.player.health} / ${engine.player.maxHealth}`, san);
        }

        // Apply sanity bar width
        const sanBar = document.getElementById("hud-sanity-bar");
        const sanText = document.getElementById("hud-sanity-text");
        if (sanBar) {
            sanBar.style.width = `${san}%`;
        }
        if (sanText) {
            sanText.textContent = corruptText(`${san}% Sanity`, san);
        }

        // Apply observation bar width
        const obsBar = document.getElementById("hud-obs-bar");
        const obsText = document.getElementById("hud-obs-text");
        const obsDiag = document.getElementById("hud-obs-diag");
        if (obsBar) {
            obsBar.style.width = `${profile.observation}%`;
        }
        if (obsText) {
            obsText.textContent = corruptText(`Observation: ${profile.observation.toFixed(1)}%`, san);
        }
        if (obsDiag) {
            obsDiag.textContent = corruptText(profile.activeDiagnosis, san);
        }

        // Update Level, Gold, Currencies
        document.getElementById("hud-level").textContent = corruptText(`Level ${profile.level}`, san);
        document.getElementById("hud-gold").textContent = corruptText(profile.gold.toString(), san);
        document.getElementById("hud-parchment").textContent = corruptText(profile.parchment.toString(), san);
        document.getElementById("hud-ink").textContent = corruptText(profile.ink.toString(), san);
        document.getElementById("hud-seal").textContent = corruptText(profile.waxSeals.toString(), san);

        // Update Tarot Card visual
        const tarotCard = document.getElementById("tarot-box");
        if (tarotCard && profile.activeTarot) {
            const card = TAROT_DECK[profile.activeTarot];
            const tarotSlug = profile.activeTarot.toLowerCase().replace(/^the\s+/, "").replace(/\s+/g, "_");
            const codeName = `tarot_${tarotSlug}`;
            const iconPath = `assets/ui/tarot/${codeName}/${codeName}_base.png`;
            tarotCard.style.borderColor = card.color;
            tarotCard.innerHTML = `
                <div class="tarot-card-inner">
                    <img src="${iconPath}" class="tarot-card-img" alt="">
                    <div class="tarot-card-text">
                        <div class="tarot-title" style="color: ${card.color};">${corruptText(card.name, san)}</div>
                        <div class="tarot-desc">${corruptText(card.desc, san)}</div>
                    </div>
                </div>
            `;
        }

        // Update Reality Trait visual
        const traitBox = document.getElementById("trait-box");
        if (traitBox) {
            if (profile.observation >= 50 && profile.activeRealityTrait) {
                const trait = REALITY_TRAITS[profile.activeRealityTrait];
                traitBox.innerHTML = `
                    <div class="trait-title">${corruptText(trait.name, san)}</div>
                    <div class="trait-desc">${corruptText(trait.desc, san)}</div>
                `;
                traitBox.style.display = "block";
            } else {
                traitBox.style.display = "none";
            }
        }
    }

    renderActiveTab() {
        const profile = this.orch.activeProfile;
        if (!profile) return;

        if (this.activeTab === "inventory") {
            this.renderInventory(profile);
        } else if (this.activeTab === "rituals") {
            this.renderRituals(profile);
        } else if (this.activeTab === "signals") {
            this.renderSignals(profile);
        } else if (this.activeTab === "corpses") {
            this.renderCorpses(profile);
        } else if (this.activeTab === "monolith") {
            this.renderMonolithUpgrades(profile);
        }
    }

    renderInventory(profile) {
        const san = profile.sanity;
        
        // Render stats summary
        const equipStats = getEquipmentStats(profile);
        const baseClass = CLASSES[profile.classType];
        
        const dmgTotal = baseClass.baseDamage + equipStats.damage;
        const hpTotal = baseClass.baseHealth + equipStats.health;
        const critPct = Math.round((baseClass.baseCrit + equipStats.crit) * 100);

        document.getElementById("stats-summary").innerHTML = `
            <div>Base Class: <strong>${corruptText(profile.classType, san)}</strong></div>
            <div>Attack Power: <strong>${corruptText(dmgTotal.toString(), san)}</strong></div>
            <div>Max Health: <strong>${corruptText(hpTotal.toString(), san)}</strong></div>
            <div>Critical Chance: <strong>${corruptText(critPct + "%", san)}</strong></div>
            <div>Sanity Resist: <strong>${corruptText(Math.round(equipStats.sanityResist * 100) + "%", san)}</strong></div>
            <div>Signal Clarity: <strong>${corruptText(Math.round(equipStats.signalClarity * 100) + "%", san)}</strong></div>
            <div>Obfuscation Mask: <strong>${corruptText(Math.round(equipStats.obfuscation * 100) + "%", san)}</strong></div>
        `;

        // Render Equipment Slots
        this.renderEquipSlot("equip-weapon", profile.gear.weapon, "weapon");
        this.renderEquipSlot("equip-armor", profile.gear.armor, "armor");
        this.renderEquipSlot("equip-amulet", profile.gear.amulet, "amulet");

        // Render Inventory Grid
        const grid = document.getElementById("inventory-grid");
        grid.innerHTML = "";
        
        for (let i = 0; i < 15; i++) {
            const slot = document.createElement("div");
            slot.className = "inventory-slot";
            const item = profile.inventory[i];

            if (item) {
                slot.style.borderColor = item.color;
                if (item.icon) {
                    slot.innerHTML = `<img src="${item.icon}" class="slot-icon-img" style="width: 100%; height: 100%; object-fit: contain; padding: 2px;">`;
                } else {
                    slot.innerHTML = `<span class="item-initial" style="color: ${item.color}">${item.name[0]}</span>`;
                }
                slot.addEventListener("mouseenter", (e) => this.showTooltip(e, item));
                slot.addEventListener("mouseleave", () => this.hideTooltip());
                slot.addEventListener("click", () => this.equipItem(i));
            } else {
                slot.classList.add("slot-empty");
            }
            grid.appendChild(slot);
        }
    }

    renderEquipSlot(elementId, item, slotType) {
        const el = document.getElementById(elementId);
        el.innerHTML = "";
        el.className = "equip-slot";

        if (item) {
            el.style.borderColor = item.color;
            if (item.icon) {
                el.innerHTML = `
                    <div class="equip-label">${slotType.toUpperCase()}</div>
                    <img src="${item.icon}" class="slot-icon-img" style="width: 32px; height: 32px; object-fit: contain; margin-top: 1px;">
                `;
            } else {
                el.innerHTML = `<div class="equip-label">${slotType.toUpperCase()}</div><span style="color: ${item.color}">${item.name}</span>`;
            }
            el.addEventListener("mouseenter", (e) => this.showTooltip(e, item));
            el.addEventListener("mouseleave", () => this.hideTooltip());
            el.addEventListener("click", () => this.unequipItem(slotType));
        } else {
            el.classList.add("slot-empty");
            el.innerHTML = `<div class="equip-label">${slotType.toUpperCase()}</div><span>Empty</span>`;
            el.removeAttribute("style");
            // Clear listener clone hack
            const newEl = el.cloneNode(true);
            el.parentNode.replaceChild(newEl, el);
        }
    }

    showTooltip(e, item) {
        this.tooltip.style.display = "block";
        this.tooltip.style.left = `${e.pageX + 15}px`;
        this.tooltip.style.top = `${e.pageY + 15}px`;

        let statDesc = "";
        if (item.damage) statDesc += `<div>Damage: +${item.damage}</div>`;
        if (item.health) statDesc += `<div>Max Health: +${item.health}</div>`;
        if (item.armor) statDesc += `<div>Armor Protection: +${item.armor}</div>`;
        if (item.sanityResist) statDesc += `<div>Sanity Resist: +${Math.round(item.sanityResist * 100)}%</div>`;
        if (item.signalClarity) statDesc += `<div>Signal Clarity: +${Math.round(item.signalClarity * 100)}%</div>`;
        if (item.crit) statDesc += `<div>Critical Rate: +${Math.round(item.crit * 100)}%</div>`;
        if (item.baseDamage) statDesc += `<div>Base Damage: +${item.baseDamage}</div>`;

        if (item.affix) {
            statDesc += `<div style="color: #16d8a4; margin-top: 5px;">${item.affix.label}</div>`;
        }

        this.tooltip.innerHTML = `
            <div class="tooltip-title" style="color: ${item.color}">${item.name}</div>
            <div class="tooltip-rarity" style="color: ${item.color}">${item.rarity.toUpperCase()} <span style="font-size:10px; color:#aaa;">[Click to Equip]</span></div>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 6px 0;">
            <div class="tooltip-stats">${statDesc}</div>
            <div class="tooltip-desc">"${item.desc}"</div>
        `;
    }

    hideTooltip() {
        this.tooltip.style.display = "none";
    }

    equipItem(invIndex) {
        const p = this.orch.activeProfile;
        const item = p.inventory[invIndex];
        if (!item) return;

        const slot = item.type;
        const oldEquipped = p.gear[slot];

        p.gear[slot] = item;
        if (oldEquipped) {
            p.inventory[invIndex] = oldEquipped;
        } else {
            p.inventory.splice(invIndex, 1);
        }

        this.hideTooltip();
        this.orch.recalculateStats();
        this.renderActiveTab();
    }

    unequipItem(slotType) {
        const p = this.orch.activeProfile;
        const item = p.gear[slotType];
        if (!item) return;

        if (p.inventory.length < 15) {
            p.inventory.push(item);
            p.gear[slotType] = null;
            this.hideTooltip();
            this.orch.recalculateStats();
            this.renderActiveTab();
        } else {
            p.signals.unshift("Inventory FULL. Cannot unequip gear.");
            this.renderActiveTab();
        }
    }

    renderRituals(profile) {
        const panel = document.getElementById("panel-rituals");
        panel.innerHTML = `<h3>Rituals & Blood Bargains</h3>
            <p class="tab-desc">Step close to the Altar in the Keeping House to sign dark ledgers. Bargains grant supreme power with steep costs.</p>
            <div class="ritual-list">
                <div class="ritual-card">
                    <div class="ritual-name">Blood Tithe</div>
                    <div class="ritual-deal">Permanently lose 25 Max Health. Gain +8 Base Attack Damage.</div>
                    <button class="game-btn ritual-exec-btn" data-ritual="blood_tithe">Sign Contract</button>
                </div>
                <div class="ritual-card">
                    <div class="ritual-name">Static Communion</div>
                    <div class="ritual-deal">Spend 10 Sanity. Immediately intercept and decode a hidden Warning Signal.</div>
                    <button class="game-btn ritual-exec-btn" data-ritual="static_comm">Consume Sanity</button>
                </div>
                <div class="ritual-card">
                    <div class="ritual-name">Name Erasure</div>
                    <div class="ritual-deal">Sacrifice 1 Character Level and 80 Debt Gold. Mask your steps, reducing Observation by 25%.</div>
                    <button class="game-btn ritual-exec-btn" data-ritual="name_erase">Erase Registry</button>
                </div>
            </div>`;

        // Check distance to altar
        let nearAltar = false;
        if (this.orch.engine) {
            const altar = this.orch.engine.interactables.find(i => i.type === "blood_ritual_altar");
            if (altar) {
                const dist = this.orch.engine.distance(this.orch.engine.player.x, this.orch.engine.player.y, altar.x, altar.y);
                if (dist < altar.radius + this.orch.engine.player.radius + 15) {
                    nearAltar = true;
                }
            }
        }

        panel.querySelectorAll(".ritual-exec-btn").forEach(btn => {
            if (!nearAltar) {
                btn.disabled = true;
                btn.title = "You must be standing next to the Altar in the Keeping House room to sign rituals.";
            }
            btn.addEventListener("click", (e) => {
                const rit = e.target.getAttribute("data-ritual");
                this.executeRitual(profile, rit);
            });
        });
    }

    executeRitual(profile, type) {
        const now = Date.now();
        if (profile.lastRitualTime && now - profile.lastRitualTime < 120000) {
            profile.signals.unshift("Altar rejects you. The blood needs time to dry. Wait 120 seconds.");
            this.renderActiveTab();
            return;
        }

        let ritualSuccess = false;

        if (type === "blood_tithe") {
            const baseClass = CLASSES[profile.classType];
            const minimumHealth = 30;
            if (profile.maxHealth > minimumHealth) {
                profile.maxHealth -= 25;
                if (this.orch.engine.player.health > profile.maxHealth) {
                    this.orch.engine.player.health = profile.maxHealth;
                }
                this.orch.engine.player.damage += 8;
                profile.signals.unshift("Blood Tithe Contract Signed. Max HP decreased, Attack Power amplified.");
                this.orch.engine.createParticleExplosion(this.orch.engine.player.x, this.orch.engine.player.y, "#9a1616", 20);
                this.orch.engine.player.sanity = Math.max(0, this.orch.engine.player.sanity - 10);
                ritualSuccess = true;
            } else {
                profile.signals.unshift("The Altar rejects your tithe. Your vital blood is too thin.");
            }
        } else if (type === "static_comm") {
            if (this.orch.engine.player.sanity >= 10) {
                this.orch.engine.player.sanity -= 10;
                // Add a warning signal
                const warnings = [
                    "Memory Signal: The Keeping House was once a cathedral. We filed names under index tags.",
                    "Warning Signal: Seal Mother senses weapon configurations. Equip armor to absorb her heavy slams.",
                    "Memory Signal: The Monolith does not construct. It mirrors what survives."
                ];
                const msg = warnings[Math.floor(Math.random() * warnings.length)];
                profile.signals.unshift(`[Decoded Comm] ${msg}`);
                this.orch.engine.createParticleExplosion(this.orch.engine.player.x, this.orch.engine.player.y, "#3075c7", 20);
                ritualSuccess = true;
            } else {
                profile.signals.unshift("Comm fails. Your mind is too fractured to tune the static.");
            }
        } else if (type === "name_erase") {
            if (profile.level > 1 && profile.gold >= 80) {
                profile.level -= 1;
                profile.gold -= 80;
                profile.observation = Math.max(0, profile.observation - 25);
                profile.signals.unshift("Registry erased. Your presence slips into shadow. Observation reduced.");
                this.orch.engine.createParticleExplosion(this.orch.engine.player.x, this.orch.engine.player.y, "#545454", 20);
                ritualSuccess = true;
            } else {
                profile.signals.unshift("Registry rejects erasure. Insufficient level or gold collateral.");
            }
        }

        if (ritualSuccess) {
            profile.lastRitualTime = now;
        }

        this.orch.saveActiveProfile();
        this.renderActiveTab();
    }

    renderSignals(profile) {
        const panel = document.getElementById("panel-signals");
        panel.innerHTML = `<h3>Signals Feed & Transmissions</h3>
            <p class="tab-desc">Static radio logs intercepted by your lantern receiver. Text clarity deteriorates as sanity drops.</p>
            <div class="signal-list" id="signals-log-container"></div>`;

        const container = document.getElementById("signals-log-container");
        for (const sig of profile.signals) {
            const row = document.createElement("div");
            row.className = "signal-row";
            row.textContent = corruptText(sig, profile.sanity);
            container.appendChild(row);
        }
    }

    renderCorpses(profile) {
        const panel = document.getElementById("panel-corpses");
        panel.innerHTML = `<h3>World Corpse Registry</h3>
            <p class="tab-desc">Remnants of your previous collapses. Locate your corpse symbol ☠ in the room and stand close to interact.</p>
            <div class="corpse-list" id="corpse-list-container"></div>`;

        const container = document.getElementById("corpse-list-container");

        if (profile.corpses.length === 0) {
            container.innerHTML = `<div class="empty-msg">No corpses currently filed in the archive registry.</div>`;
            return;
        }

        // Check if player is near a corpse in engine
        let nearCorpseIdx = -1;
        if (this.orch.engine) {
            const corpseIntr = this.orch.engine.interactables.find(i => 
                i.type === "fresh_marked_corpse" || 
                i.type === "burned_corpse_remains" || 
                i.type === "broadcast_corpse"
            );
            if (corpseIntr) {
                const dist = this.orch.engine.distance(this.orch.engine.player.x, this.orch.engine.player.y, corpseIntr.x, corpseIntr.y);
                if (dist < corpseIntr.radius + this.orch.engine.player.radius + 15) {
                    nearCorpseIdx = profile.corpses.length - 1;
                }
            }
        }

        profile.corpses.forEach((corp, idx) => {
            const isBurned = corp.state === "burned";
            const isBroadcasted = corp.state === "broadcasted";

            const card = document.createElement("div");
            card.className = "corpse-card";
            card.innerHTML = `
                <div>Location: <strong>${corp.zone} [x:${Math.round(corp.x)}, y:${Math.round(corp.y)}]</strong></div>
                <div>Status: <strong style="color: ${isBurned ? '#d4a343' : isBroadcasted ? '#3b82f6' : '#b01212'}">${isBurned ? 'BURNED' : isBroadcasted ? 'BROADCASTED' : 'FRESH'}</strong></div>
                <div>Death Cause: <span style="color:#b51919">${corp.cause || "Sanity collapse"}</span></div>
                <div class="corpse-actions" style="margin-top: 10px;">
                    <button class="game-btn corpse-btn" data-action="recover" data-idx="${idx}" ${isBurned || isBroadcasted ? 'disabled' : ''}>Recover (Fight Echo)</button>
                    <button class="game-btn corpse-btn" data-action="burn" data-idx="${idx}" ${isBurned || isBroadcasted ? 'disabled' : ''}>Burn (Sanity)</button>
                    <button class="game-btn corpse-btn" data-action="broadcast" data-idx="${idx}" ${isBurned || isBroadcasted ? 'disabled' : ''}>Broadcast (Clarity)</button>
                    <button class="game-btn corpse-btn" data-action="devour" data-idx="${idx}" ${isBurned || isBroadcasted ? 'disabled' : ''}>Devour (Damage)</button>
                </div>
            `;

            card.querySelectorAll(".corpse-btn").forEach(btn => {
                if (nearCorpseIdx !== idx) {
                    btn.disabled = true;
                    btn.title = "You must find this corpse in the canvas world and stand close to manage it.";
                }
                btn.addEventListener("click", (e) => {
                    const act = e.target.getAttribute("data-action");
                    this.executeCorpseAction(profile, idx, act);
                });
            });

            container.appendChild(card);
        });
    }

    executeCorpseAction(profile, idx, action) {
        const corp = profile.corpses[idx];
        if (!corp) return;

        let removeCorpse = false;

        if (action === "recover") {
            profile.signals.unshift(`Corpse Recovered: A hostile memory echo manifests!`);
            if (this.orch.engine) {
                this.orch.engine.spawnCorpseEcho(corp);
            }
            removeCorpse = true;
        } else if (action === "burn") {
            this.orch.engine.player.sanity = Math.min(100, this.orch.engine.player.sanity + 30);
            profile.observation = Math.max(0, profile.observation - 15);
            profile.signals.unshift("Corpse Burned: evidence destroyed. Sanity restored, Observation reduced.");
            corp.state = "burned";
            
            // Mutate in-world model
            if (this.orch.engine) {
                const intr = this.orch.engine.interactables.find(i => i.type === "fresh_marked_corpse");
                if (intr) intr.type = "burned_corpse_remains";
            }
        } else if (action === "broadcast") {
            profile.waxSeals += 2;
            profile.signals.unshift("Corpse Broadcasted: transmitted telemetry details. Earned +2 Wax Seals.");
            corp.state = "broadcasted";

            // Mutate in-world model
            if (this.orch.engine) {
                const intr = this.orch.engine.interactables.find(i => i.type === "fresh_marked_corpse");
                if (intr) intr.type = "broadcast_corpse";
            }
        } else if (action === "devour") {
            this.orch.engine.player.damage = Math.round(this.orch.engine.player.damage * 1.15);
            profile.observation = Math.min(100, profile.observation + 10);
            profile.signals.unshift("Corpse Devoured: fed on tissue snapshots. Attuned +15% damage, but Monolith observed closely.");
            removeCorpse = true;
        }

        if (removeCorpse) {
            profile.corpses.splice(idx, 1);
            if (this.orch.engine) {
                this.orch.engine.interactables = this.orch.engine.interactables.filter(i => 
                    i.type !== "fresh_marked_corpse" && 
                    i.type !== "burned_corpse_remains" && 
                    i.type !== "broadcast_corpse"
                );
            }
        }

        this.orch.saveActiveProfile();
        this.renderActiveTab();
    }

    renderMonolithUpgrades(profile) {
        const panel = document.getElementById("panel-monolith");
        panel.innerHTML = `<h3>Monolith Upgrades</h3>
            <p class="tab-desc">Expend index cards and seals collected in the archives to build permanent body obfuscations.</p>
            <div class="upgrade-list">
                <div class="upgrade-row">
                    <div>
                        <div class="up-title">Strengthen Body [Level ${profile.upgrades.body}]</div>
                        <div class="up-desc">Permanent +20 Max Health bonus.</div>
                    </div>
                    <button class="game-btn up-buy-btn" data-up="body">Cost: 3 Parchment</button>
                </div>
                <div class="upgrade-row">
                    <div>
                        <div class="up-title">Reinforce Mind [Level ${profile.upgrades.mind}]</div>
                        <div class="up-desc">Slows sanity decay rate by 12%.</div>
                    </div>
                    <button class="game-btn up-buy-btn" data-up="mind">Cost: 3 Ink</button>
                </div>
                <div class="upgrade-row">
                    <div>
                        <div class="up-title">Structure Obfuscation [Level ${profile.upgrades.obfuscation}]</div>
                        <div class="up-desc">Reduces Observation accumulation rate by 15%.</div>
                    </div>
                    <button class="game-btn up-buy-btn" data-up="obfuscation">Cost: 2 Wax Seals</button>
                </div>
            </div>`;

        panel.querySelectorAll(".up-buy-btn").forEach(btn => {
            const up = btn.getAttribute("data-up");
            let costText = "";
            let canAfford = false;

            let isMaxed = false;

            if (up === "body") {
                isMaxed = profile.upgrades.body >= 10;
                const nextCost = 3 + profile.upgrades.body;
                costText = isMaxed ? "MAX LEVEL" : `Cost: ${nextCost} Parchment`;
                canAfford = profile.parchment >= nextCost && !isMaxed;
                btn.title = "Increases Max Health permanently.";
            } else if (up === "mind") {
                isMaxed = profile.upgrades.mind >= 10;
                const nextCost = 3 + profile.upgrades.mind;
                costText = isMaxed ? "MAX LEVEL" : `Cost: ${nextCost} Ink`;
                canAfford = profile.ink >= nextCost && !isMaxed;
                btn.title = "Reduces passive sanity decay.";
            } else if (up === "obfuscation") {
                isMaxed = profile.upgrades.obfuscation >= 10;
                const nextCost = 2 + profile.upgrades.obfuscation;
                costText = isMaxed ? "MAX LEVEL" : `Cost: ${nextCost} Seals`;
                canAfford = profile.waxSeals >= nextCost && !isMaxed;
                btn.title = "Slows down the Monolith's observation rate.";
            }

            btn.textContent = costText;
            btn.disabled = !canAfford || isMaxed;
            if (isMaxed) {
                btn.style.color = "#c79a42";
                btn.style.borderColor = "#c79a42";
            }

            btn.addEventListener("click", () => this.buyUpgrade(profile, up));
        });
    }

    buyUpgrade(profile, up) {
        if (up === "body") {
            const cost = 3 + profile.upgrades.body;
            profile.parchment -= cost;
            profile.upgrades.body++;
            profile.maxHealth += 20;
            if (this.orch.engine.player) {
                this.orch.engine.player.maxHealth += 20;
                this.orch.engine.player.health += 20;
            }
        } else if (up === "mind") {
            const cost = 3 + profile.upgrades.mind;
            profile.ink -= cost;
            profile.upgrades.mind++;
        } else if (up === "obfuscation") {
            const cost = 2 + profile.upgrades.obfuscation;
            profile.waxSeals -= cost;
            profile.upgrades.obfuscation++;
        }

        profile.signals.unshift(`Monolith Upgrade Purchased: Strengthened ${up.toUpperCase()} node.`);
        
        // Tutorial Step 1 -> 2
        if (profile.tutorialStep === 1) {
            profile.tutorialStep = 2;
            this.renderTutorial(profile);
        }

        this.orch.saveActiveProfile();
        this.renderActiveTab();
    }
}
