// Canvas Graphics Renderer with sprite-led room dressing, VFX, lighting, and HUD prompts.
import { assetLoader } from "./assets.js";
import { DEATH_ANIMATION_FRAMES } from "./engine.js";
import { ROOM, WORLD_WIDTH, WORLD_HEIGHT, buildRoomTexture } from "./world.js";
import { RARITY_MULTIPLIERS } from "./state.js";

// Pickup glow colours and labels; gear uses its rarity colour
const LOOT_STYLE = {
    loot_satchel: { color: "#ffcf4a", label: (l) => `+${l.gold} DG` },
    sanity_shard: { color: "#5fe3ff", label: () => "Sanity Shard" },
    blood_vial: { color: "#ff3b3b", label: () => "Blood Vial", tint: "rgba(200, 20, 20, 0.55)" },
    signal_fragment: { color: "#f4e8c8", label: () => "Signal Fragment" },
    cursed_gear_drop: { color: "#9a4ab8", label: (l) => l.item ? l.item.name : "Gear", beam: true },
    memory_fragment: { color: "#b77cff", label: () => "Memory Fragment", beam: true }
};

const NEW_PICKUP_SPRITES = {
    loot_satchel: "debt_coin.idle",
    sanity_shard: "sanity_shard.idle",
    blood_vial: "black_ink_vial.idle",
    signal_fragment: "folded_witness_note.idle",
    cursed_gear_drop: "sealed_name_tag.idle",
    memory_fragment: "impossible_key.idle"
};

const INTERACTABLE_SPRITES = {
    blood_ritual_altar: { anim: "receipt_spike_altar.idle", scale: 0.43, glow: "rgba(176, 25, 25, 0.44)", label: "SIGN" },
    static_signal_pylon: { anim: "many_handed_clock.idle", scale: 0.42, glow: "rgba(88, 151, 112, 0.36)", label: "TUNE" },
    corpse_lantern_shrine: { anim: "paper_root_growth.idle", scale: 0.46, glow: "rgba(207, 184, 101, 0.34)", label: "FILE" },
    wax_record_chest: { anim: "tiny_chained_book.idle", scale: 0.44, glow: "rgba(184, 31, 31, 0.28)", label: "OPEN" },
    sealed_zone_door: { anim: "wax_sealed_door.idle", scale: 0.58, glow: "rgba(189, 41, 34, 0.32)", label: "EXIT" },
    fresh_marked_corpse: { label: "SEARCH" },
    burned_corpse_remains: { label: "REMAINS" },
    broadcast_corpse: { label: "REMAINS" }
};

export class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.screenShake = 0;
        this.damageFlash = 0;
        this.sanityBreakFlash = 0;
        this.wasSanityBroken = false;
        this.frame = 0;
        this.candles = ROOM.candles;

        // Camera: world units → CSS pixels via zoom, CSS → device pixels via dpr
        this.camera = { x: 0, y: 0 };
        this.zoom = 1;
        this.dpr = 1;
        this.cssW = 0;
        this.cssH = 0;
        this.roomTexture = null;
        this.roomTextureScale = 0;
        this.onDrawWorld = null; // hook for world-space overlays (wax traps)
        this.resize();
        window.addEventListener("resize", () => this.resize());
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const cssW = Math.max(320, Math.round(rect.width || window.innerWidth));
        const cssH = Math.max(240, Math.round(rect.height || window.innerHeight));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (cssW === this.cssW && cssH === this.cssH && dpr === this.dpr) return;
        this.cssW = cssW;
        this.cssH = cssH;
        this.dpr = dpr;
        this.canvas.width = Math.round(cssW * dpr);
        this.canvas.height = Math.round(cssH * dpr);
        // Show roughly 640 world units vertically; never zoom out past the room
        this.zoom = Math.max(cssW / WORLD_WIDTH, cssH / WORLD_HEIGHT, Math.min(2.4, cssH / 640));
        const wanted = Math.min(2, Math.max(1, this.zoom * dpr));
        if (!this.roomTexture || wanted > this.roomTextureScale + 0.25) {
            this.roomTextureScale = wanted;
            this.roomTexture = buildRoomTexture(wanted);
        }
    }

    get viewW() { return this.cssW / this.zoom; }
    get viewH() { return this.cssH / this.zoom; }

    updateCamera(engine) {
        const p = engine.player;
        if (!p) return;
        const tx = p.x - this.viewW / 2;
        const ty = p.y - this.viewH / 2;
        // Smooth follow
        this.camera.x += (tx - this.camera.x) * 0.14;
        this.camera.y += (ty - this.camera.y) * 0.14;
        this.camera.x = Math.max(0, Math.min(WORLD_WIDTH - this.viewW, this.camera.x));
        this.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - this.viewH, this.camera.y));
    }

    snapCamera(engine) {
        this.camera.x = engine.player.x - this.viewW / 2;
        this.camera.y = engine.player.y - this.viewH / 2;
        this.updateCamera(engine);
    }

    screenToWorld(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) / this.zoom + this.camera.x,
            y: (clientY - rect.top) / this.zoom + this.camera.y
        };
    }

    triggerShake(amount) {
        if (this.reduceMotion) amount *= 0.3;
        this.screenShake = Math.max(this.screenShake, amount);
    }

    triggerDamageFlash(strength) {
        this.damageFlash = Math.max(this.damageFlash, strength);
    }

    frameFor(animId, frameOffset = 0) {
        const config = assetLoader.animationsMap[animId];
        if (!config) return 0;
        return Math.floor((this.frame + frameOffset) * (config.fps / 60)) % config.frames;
    }

    drawSprite(ctx, animId, x, y, scale = 0.35, alpha = 1, facing = "right", frameOffset = 0) {
        assetLoader.drawFrame(ctx, animId, this.frameFor(animId, frameOffset), x, y, facing, scale, alpha);
    }

    showLevelUpBanner(level) {
        this.showBanner("LEVEL UP", `Form stabilized — Level ${level} reached. +10 Max Health.`, "#d4af37", 180);
    }

    // Queue a large centered announcement. Banners play one after another.
    showBanner(title, subtitle = "", color = "#d4af37", duration = 180) {
        if (!this.bannerQueue) this.bannerQueue = [];
        this.bannerQueue.push({ title, subtitle, color, duration, timer: duration });
    }

    drawBanner(ctx, w) {
        if (!this.bannerQueue || this.bannerQueue.length === 0) return;
        const b = this.bannerQueue[0];
        b.timer--;
        if (b.timer <= 0) {
            this.bannerQueue.shift();
            return;
        }
        const elapsed = b.duration - b.timer;
        const fadeIn = Math.min(1, elapsed / 12);
        const fadeOut = Math.min(1, b.timer / 30);
        const alpha = Math.min(fadeIn, fadeOut);
        const scale = 1 + Math.max(0, 1 - elapsed / 10) * 0.35; // punch-in

        ctx.save();
        ctx.globalAlpha = alpha;
        const y = Math.round(this.cssH * 0.24);
        const band = ctx.createLinearGradient(0, 0, w, 0);
        band.addColorStop(0, "rgba(5,4,4,0)");
        band.addColorStop(0.2, "rgba(5,4,4,0.82)");
        band.addColorStop(0.8, "rgba(5,4,4,0.82)");
        band.addColorStop(1, "rgba(5,4,4,0)");
        ctx.fillStyle = band;
        ctx.fillRect(0, y - 40, w, b.subtitle ? 74 : 56);

        ctx.translate(w / 2, y);
        ctx.scale(scale, scale);
        ctx.textAlign = "center";
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = b.color;
        ctx.font = "800 30px Cinzel, Courier New";
        ctx.fillText(b.title, 0, 0);
        ctx.shadowBlur = 0;
        if (b.subtitle) {
            ctx.fillStyle = "#eadfbd";
            ctx.font = "14px Outfit, Courier New";
            ctx.fillText(b.subtitle, 0, 24);
        }
        ctx.restore();
    }

    drawRotatedSprite(ctx, animId, x, y, scale, alpha, rotation, frameOffset = 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        assetLoader.drawFrame(ctx, animId, this.frameFor(animId, frameOffset), 0, 0, "right", scale, alpha);
        ctx.restore();
    }

    draw(engine) {
        this.frame++;
        this.resize();
        this.updateCamera(engine);
        const ctx = this.ctx;
        const w = this.cssW;
        const h = this.cssH;

        let sx = 0, sy = 0;
        if (this.screenShake > 0) {
            sx = (Math.random() - 0.5) * this.screenShake;
            sy = (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.9;
            if (this.screenShake < 0.2) this.screenShake = 0;
        }

        // ── World pass (world units) ──
        const k = this.dpr * this.zoom;
        ctx.setTransform(k, 0, 0, k, (-this.camera.x * this.zoom + sx) * this.dpr, (-this.camera.y * this.zoom + sy) * this.dpr);
        ctx.imageSmoothingEnabled = true;

        this.drawRoomBackdrop(ctx);
        this.drawObstacles(ctx, engine);
        this.drawInteractables(ctx, engine);
        this.drawLoot(ctx, engine);

        const entities = [];
        if (engine.player) {
            entities.push({ type: "player", y: engine.player.y, ref: engine.player });
        }
        for (const e of engine.enemies) {
            entities.push({ type: "enemy", y: e.y, ref: e });
        }

        entities.sort((a, b) => a.y - b.y);
        for (const ent of entities) {
            if (ent.type === "player") this.drawPlayer(ctx, ent.ref);
            else this.drawEnemy(ctx, ent.ref);
        }

        this.drawProjectiles(ctx, engine);
        this.drawParticles(ctx, engine);
        this.drawMonolithRunes(ctx, engine);
        if (this.onDrawWorld) this.onDrawWorld(ctx);
        this.drawLightingPass(ctx, engine);
        // Drawn after lighting so they read clearly in the dark
        this.drawLootHighlights(ctx, engine);
        this.drawFloatingTexts(ctx, engine);
        this.drawInteractPrompts(ctx, engine);
        this.drawEnemyHealthBars(ctx, engine);

        // ── Screen pass (CSS pixels) ──
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.drawScreenVignette(ctx, w, h);
        this.drawSanityEffects(ctx, w, h, engine);
        this.drawCanvasUI(ctx, w, h, engine);
        this.applyGlitchShader(ctx, w, h, engine);
        this.drawDeathOverlay(ctx, w, h, engine);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    drawRoomBackdrop(ctx) {
        if (this.roomTexture) {
            ctx.drawImage(this.roomTexture, 0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        } else {
            ctx.fillStyle = "#0d0b09";
            ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        }
        // Living details on top of the static room
        this.drawSprite(ctx, "red_string_evidence_board.idle", 560, 214, 0.42, 0.9);
        this.drawSprite(ctx, "ink_wall_stain.idle", 1040, 190, 0.4, 0.55);
        this.drawSprite(ctx, "paper_root_growth.idle", 110, 960, 0.42, 0.55, "right", 9);
        this.drawSprite(ctx, "wax_seal_growth.idle", 1500, 950, 0.38, 0.55, "right", 31);
        this.drawSprite(ctx, "wax_seal_growth.idle", 1000, 980, 0.3, 0.4, "right", 12);
        for (const c of this.candles) this.drawCandle(ctx, c);
    }

    drawCandle(ctx, c) {
        // Small candle cluster with an animated flame
        const flick = Math.sin(this.frame * 0.3 + c.x) * 0.6 + (Math.random() - 0.5) * 0.6;
        ctx.save();
        ctx.fillStyle = "#d9c9a0";
        ctx.fillRect(c.x - 4, c.y - 12, 5, 12);
        ctx.fillRect(c.x + 3, c.y - 8, 4, 8);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(c.x - 6, c.y, 15, 3);
        ctx.fillStyle = "#ffcf73";
        ctx.beginPath();
        ctx.ellipse(c.x - 1.5, c.y - 15 + flick * 0.3, 2.2, 4 + flick * 0.5, 0, 0, Math.PI * 2);
        ctx.ellipse(c.x + 5, c.y - 11 + flick * 0.3, 1.8, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawGroundShadow(ctx, x, y, rx, ry, alpha = 0.45) {
        const shadow = ctx.createRadialGradient(x, y, 1, x, y, rx);
        shadow.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
        shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawObstacles(ctx, engine) {
        for (const obs of engine.obstacles) {
            if (obs.label === "The Monolith") continue;

            const cx = obs.x + (obs.w || 0) / 2;
            const cy = obs.y + (obs.h || 0);
            this.drawGroundShadow(ctx, cx, cy + 8, 50, 14, 0.34);

            if (obs.label === "Evidence Board") {
                this.drawSprite(ctx, "red_string_evidence_board.idle", cx, cy + 18, 0.43, 1);
            } else if (obs.label === "Witness Chair Prop") {
                this.drawSprite(ctx, "witness_chair_prop.idle", cx, cy + 24, 0.44, 0.96);
            } else if (obs.label === "Nameplate Heap") {
                this.drawSprite(ctx, "brass_nameplate_cluster.idle", cx, cy + 24, 0.42, 0.98);
            }
        }
    }

    drawInteractables(ctx, engine) {
        for (const intr of engine.interactables) {
            ctx.save();
            const visual = INTERACTABLE_SPRITES[intr.type];
            if (visual) {
                const pulse = 0.86 + Math.sin(this.frame * 0.06 + intr.x) * 0.14;
                const glow = ctx.createRadialGradient(intr.x, intr.y + 5, 2, intr.x, intr.y + 5, 42);
                glow.addColorStop(0, visual.glow);
                glow.addColorStop(1, "rgba(0,0,0,0)");
                ctx.globalAlpha = pulse;
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.ellipse(intr.x, intr.y + 5, 46, 18, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            if (intr.type === "wax_record_chest") {
                this.drawGroundShadow(ctx, intr.x, intr.y + 8, 26, 10, 0.36);
                this.drawSprite(ctx, "tiny_chained_book.idle", intr.x, intr.y, 0.43, intr.data.state === "open" ? 0.62 : 1);
                if (intr.data.state !== "closed") {
                    this.drawSprite(ctx, "paper_burst.play", intr.x, intr.y - 18, 0.34, intr.data.state === "open" ? 0.32 : 0.78);
                }
            } else if (intr.type === "sealed_zone_door") {
                this.drawGroundShadow(ctx, intr.x, intr.y + 10, 52, 14, 0.42);
                this.drawSprite(ctx, "wax_sealed_door.idle", intr.x, intr.y, 0.58, intr.data.state === "open" ? 0.62 : 1);
                if (intr.data.state === "open") {
                    const portal = ctx.createRadialGradient(intr.x, intr.y - 74, 6, intr.x, intr.y - 74, 58);
                    portal.addColorStop(0, "rgba(20, 126, 77, 0.34)");
                    portal.addColorStop(1, "rgba(0,0,0,0)");
                    ctx.fillStyle = portal;
                    ctx.beginPath();
                    ctx.ellipse(intr.x, intr.y - 74, 42, 58, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            } else if (visual) {
                this.drawGroundShadow(ctx, intr.x, intr.y + 10, 34, 12, 0.34);
                this.drawSprite(ctx, visual.anim, intr.x, intr.y, visual.scale, 1);
            } else if (intr.type === "fresh_marked_corpse") {
                this.drawSprite(ctx, "fresh_marked_corpse.idle", intr.x, intr.y, 0.35, 1);
            } else if (intr.type === "burned_corpse_remains") {
                this.drawSprite(ctx, "burned_corpse_remains.idle", intr.x, intr.y, 0.35, 1);
            } else if (intr.type === "broadcast_corpse") {
                this.drawSprite(ctx, "broadcast_corpse.idle", intr.x, intr.y, 0.35, 1);
            }
            ctx.restore();
        }
    }

    lootStyle(l) {
        const style = LOOT_STYLE[l.id] || { color: "#eadfbd", label: () => "" };
        let color = style.color;
        if (l.id === "cursed_gear_drop" && l.item) {
            color = (RARITY_MULTIPLIERS[l.item.rarity] || {}).color || l.item.color || color;
            if (color === "#888888") color = "#c9c2b0"; // Worn grey is too dim to read
        }
        return { ...style, color };
    }

    drawLoot(ctx, engine) {
        for (const l of engine.loot) {
            const style = this.lootStyle(l);
            const pulse = 0.75 + Math.sin(this.frame * 0.12 + l.x) * 0.25;
            const hoverY = Math.sin(this.frame * 0.08 + l.x) * 3 - 6;
            const anim = NEW_PICKUP_SPRITES[l.id] || `${l.id}.idle`;
            ctx.save();

            // Ground ring in the pickup's colour
            ctx.globalAlpha = 0.55 * pulse;
            ctx.strokeStyle = style.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(l.x, l.y + 9, 15 + pulse * 3, 6 + pulse, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;

            this.drawGroundShadow(ctx, l.x, l.y + 9, 12, 5, 0.4);

            // Dark outline + colour rim so the sprite separates from the floor
            ctx.shadowColor = style.color;
            ctx.shadowBlur = 10 * pulse;
            if (style.tint) ctx.filter = "sepia(1) saturate(6) hue-rotate(-50deg) brightness(0.9)";
            this.drawSprite(ctx, anim, l.x, l.y + hoverY, 0.3, 1, "right", l.x);
            ctx.filter = "none";
            ctx.restore();
        }
    }

    // Light beams, glows and name labels, drawn above the darkness
    drawLootHighlights(ctx, engine) {
        ctx.save();
        ctx.textAlign = "center";
        for (const l of engine.loot) {
            const style = this.lootStyle(l);
            const pulse = 0.75 + Math.sin(this.frame * 0.12 + l.x) * 0.25;

            ctx.globalCompositeOperation = "lighter";
            const glow = ctx.createRadialGradient(l.x, l.y, 1, l.x, l.y, 30);
            glow.addColorStop(0, hexA(style.color, 0.35 * pulse));
            glow.addColorStop(1, hexA(style.color, 0));
            ctx.fillStyle = glow;
            ctx.fillRect(l.x - 30, l.y - 30, 60, 60);

            const rare = style.beam || (l.item && ["Relic", "Abyssal", "Impossible"].includes(l.item.rarity));
            if (rare) {
                const beam = ctx.createLinearGradient(0, l.y - 140, 0, l.y + 6);
                beam.addColorStop(0, hexA(style.color, 0));
                beam.addColorStop(1, hexA(style.color, 0.38 * pulse));
                ctx.fillStyle = beam;
                ctx.fillRect(l.x - 7, l.y - 140, 14, 146);
            }

            // Label
            ctx.globalCompositeOperation = "source-over";
            const text = style.label(l);
            if (text) {
                ctx.font = "600 11px Outfit, Courier New";
                const tw = ctx.measureText(text).width + 10;
                const ly = l.y - 34;
                ctx.fillStyle = "rgba(6, 5, 4, 0.78)";
                ctx.fillRect(l.x - tw / 2, ly - 10, tw, 14);
                ctx.strokeStyle = hexA(style.color, 0.6);
                ctx.lineWidth = 1;
                ctx.strokeRect(l.x - tw / 2 + 0.5, ly - 9.5, tw - 1, 13);
                ctx.fillStyle = style.color;
                ctx.fillText(text, l.x, ly + 1);
            }
        }
        ctx.restore();
    }

    drawEnemyHealthBars(ctx, engine) {
        ctx.save();
        for (const e of engine.enemies) {
            if (e.type === "Seal Mother" || e.health >= e.maxHealth || e.health <= 0) continue;
            const w = 34, y = e.y - e.radius - 46;
            ctx.fillStyle = "rgba(0,0,0,0.75)";
            ctx.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 5);
            ctx.fillStyle = e.type === "The Shape" ? "#9a4ab8" : "#b51f1c";
            ctx.fillRect(e.x - w / 2, y, w * Math.max(0, e.health / e.maxHealth), 3);
        }
        ctx.restore();
    }

    drawPlayer(ctx, p) {
        ctx.save();
        this.drawGroundShadow(ctx, p.x, p.y + 14, 22, 8, 0.5);

        const obsMult = p.profile.observation / 100;
        const brandGrad = ctx.createRadialGradient(p.x, p.y - 10, 2, p.x, p.y - 10, 30);
        brandGrad.addColorStop(0, `rgba(180, 20, 20, ${0.16 + obsMult * 0.3})`);
        brandGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = brandGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 10, 30, 0, Math.PI * 2);
        ctx.fill();

        let key = "the_marked.idle";
        let elapsed = this.frame;
        if (p.health <= 0) {
            key = "the_marked.death_collapse";
            elapsed = p.deathTimer;
        } else if (p.invulnTimer > 0) {
            key = "the_marked.hit_react";
            elapsed = 25 - p.invulnTimer;
        } else if (p.attackCooldown > p.attackDelay - 20) {
            key = "the_marked.basic_attack";
            elapsed = p.attackDelay - p.attackCooldown;
        } else if (p.sanity < 40) {
            key = "the_marked.low_sanity";
        } else if (p.state === "moving") {
            key = "the_marked.walk";
        }

        const config = assetLoader.animationsMap[key];
        let idx = 0;
        if (config) {
            const loop = key !== "the_marked.death_collapse" && key !== "the_marked.hit_react" && key !== "the_marked.basic_attack";
            idx = loop ? Math.floor(this.frame * (config.fps / 60)) % config.frames : Math.max(0, Math.min(config.frames - 1, Math.floor(elapsed * (config.fps / 60))));
        }

        const alpha = p.invulnTimer > 0 && Math.floor(this.frame / 4) % 2 === 0 ? 0.48 : 1;
        assetLoader.drawFrame(ctx, key, idx, p.x, p.y, p.facing, 0.36, alpha);
        ctx.restore();
    }

    drawEnemy(ctx, e) {
        ctx.save();
        this.drawGroundShadow(ctx, e.x, e.y + e.radius - 4, e.radius * 1.28, Math.max(7, e.radius * 0.34), 0.45);

        let key = "";
        let elapsed = e.behaviorTimer;
        const facing = e.vx < 0 ? "left" : "right";

        if (e.type === "Cabinet Indexer") {
            key = e.vx === 0 && e.vy === 0 ? "cabinet_indexer.idle" : "cabinet_indexer.walk";
            if (e.attackCooldown > 40) {
                key = "cabinet_indexer.attack";
                elapsed = 70 - e.attackCooldown;
            }
        } else if (e.type === "Ink Redactor") {
            key = e.vx === 0 && e.vy === 0 ? "ink_redactor.idle" : "ink_redactor.walk";
            if (e.shootCooldown > 60) {
                key = "ink_redactor.attack";
                elapsed = 90 - e.shootCooldown;
            }
        } else if (e.type === "Paper Wraith") {
            key = e.vx === 0 && e.vy === 0 ? "paper_wraith.idle" : "paper_wraith.walk";
            if (e.attackCooldown > 34) {
                key = "paper_wraith.attack";
                elapsed = 62 - e.attackCooldown;
            }
        } else if (e.type === "Witness Chair") {
            key = e.vx === 0 && e.vy === 0 ? "witness_chair.idle" : "witness_chair.walk";
            if (e.attackCooldown > 40) {
                key = "witness_chair.attack";
                elapsed = 70 - e.attackCooldown;
            }
        } else if (e.type === "Seal Mother") {
            key = "seal_mother.idle";
            if (e.behaviorTimer % 180 < 45 || e.attackCooldown > 50) {
                key = "seal_mother.summon";
                elapsed = e.behaviorTimer % 180;
            }
        } else if (e.type === "The Shape") {
            key = e.vx === 0 && e.vy === 0 ? "the_marked.idle" : "the_marked.walk";
            if (e.attackCooldown > 30) {
                key = "the_marked.basic_attack";
                elapsed = 50 - e.attackCooldown;
            }
        } else if (e.type === "Corpse Echo") {
            key = e.vx === 0 && e.vy === 0 ? "the_marked.idle" : "the_marked.walk";
            if (e.attackCooldown > 30) {
                key = "the_marked.basic_attack";
                elapsed = 45 - e.attackCooldown;
            }
        }

        const config = assetLoader.animationsMap[key];
        let idx = 0;
        if (config) {
            const oneShot = key.endsWith(".attack") || key === "seal_mother.summon" || key === "the_marked.basic_attack";
            idx = oneShot ? Math.max(0, Math.min(config.frames - 1, Math.floor(elapsed * (config.fps / 60)))) : Math.floor(this.frame * (config.fps / 60)) % config.frames;
        }

        const scale = e.type === "Seal Mother" ? 0.7 : e.type === "Witness Chair" ? 0.45 : e.type === "Paper Wraith" ? 0.43 : 0.4;
        const alpha = e.type === "The Shape" ? 0.55 : e.type === "Paper Wraith" ? 0.94 : 1;

        if (e.type === "The Shape" || e.type === "Paper Wraith") {
            ctx.shadowColor = e.type === "The Shape" ? "#7b438f" : "#162015";
            ctx.shadowBlur = 12;
        }

        if (e.hitFlash > 0) {
            ctx.filter = "brightness(2.6) saturate(0.2)";
        }
        assetLoader.drawFrame(ctx, key, idx, e.x, e.y, facing, scale, alpha);
        ctx.filter = "none";
        ctx.restore();
    }

    drawProjectiles(ctx, engine) {
        for (const p of engine.projectiles) {
            ctx.save();
            const angle = p.angle ?? Math.atan2(p.vy, p.vx);
            if (p.type === "blood_cleave") {
                this.drawRotatedSprite(ctx, "wax_stamp_impact.play", p.x, p.y, 0.22, 0.9, angle, p.life);
            } else if (p.type === "static_spark") {
                this.drawRotatedSprite(ctx, "archive_curse_sigil.play", p.x, p.y, 0.16, 0.92, angle, p.life);
            } else if (p.type === "ink_blot") {
                this.drawRotatedSprite(ctx, "ink_slash.play", p.x, p.y, 0.18, 0.9, angle, p.life);
            } else if (p.type === "blade_dash" || p.type === "shadow_wave" || p.type === "sword_slash") {
                this.drawRotatedSprite(ctx, "ink_slash.play", p.x, p.y, 0.25, 0.86, angle, p.life);
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    drawParticles(ctx, engine) {
        for (const p of engine.particles) {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            if (p.color === "#f1e2b7" || p.color === "#aaaaaa" || p.color === "#ffffff") {
                ctx.translate(p.x, p.y);
                ctx.rotate(p.vx + p.vy);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size, -p.size * 0.6, p.size * 2.1, p.size * 1.2);
            } else {
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    drawFloatingTexts(ctx, engine) {
        if (!engine.floatingTexts) return;
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const ft of engine.floatingTexts) {
            const alpha = Math.min(1, ft.life / 15); // fade out at the end
            ctx.globalAlpha = alpha;
            ctx.fillStyle = ft.color;
            ctx.font = ft.isCrit ? "bold 18px 'Courier New'" : "bold 14px 'Courier New'";
            
            // outline
            ctx.strokeStyle = "rgba(0,0,0,0.8)";
            ctx.lineWidth = 3;
            ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.restore();
    }


    drawMonolithRunes(ctx, engine) {
        const obs = engine.obstacles.find(o => o.label === "The Monolith");
        if (!obs) return;

        ctx.save();
        this.drawGroundShadow(ctx, obs.x, obs.y + 12, 48, 16, 0.48);
        this.drawSprite(ctx, "wax_seal_growth.idle", obs.x, obs.y + 16, 0.52, 0.98);
        this.drawSprite(ctx, "archive_curse_sigil.play", obs.x, obs.y - 52, 0.34, 0.45);

        const obsPct = engine.player.profile.observation;
        const flicker = Math.sin(this.frame * 0.1) * 0.18 + 0.82;
        ctx.strokeStyle = `rgba(183, 31, 31, ${0.22 + (obsPct / 100) * 0.42})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = "#b71f1f";
        ctx.shadowBlur = 10 * flicker;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y - 54, 24 + obsPct * 0.08, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = `rgba(235, 225, 213, ${0.55 + (obsPct / 100) * 0.35})`;
        ctx.font = "11px Courier New";
        ctx.textAlign = "center";
        ctx.fillText("EYE", obs.x, obs.y - 70);
        ctx.fillText("SEAL", obs.x, obs.y - 46);
        ctx.fillText("DEBT", obs.x, obs.y - 22);
        ctx.restore();
    }

    drawLightingPass(ctx, engine) {
        ctx.save();
        const vx = this.camera.x - 40, vy = this.camera.y - 40, vw = this.viewW + 80, vh = this.viewH + 80;
        const sanityFactor = engine.player.sanity / 100;
        const darkness = 0.62 - sanityFactor * 0.18;

        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = `rgba(13, 10, 10, ${darkness})`;
        ctx.fillRect(vx, vy, vw, vh);

        ctx.globalCompositeOperation = "screen";
        const lanternSize = 118 + sanityFactor * 72;
        const pGrad = ctx.createRadialGradient(engine.player.x, engine.player.y, 4, engine.player.x, engine.player.y, lanternSize);
        pGrad.addColorStop(0, "rgba(236, 208, 154, 0.62)");
        pGrad.addColorStop(0.32, "rgba(188, 126, 65, 0.28)");
        pGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(engine.player.x, engine.player.y, lanternSize, 0, Math.PI * 2);
        ctx.fill();

        for (const c of this.candles) {
            const flicker = 1 + (Math.random() - 0.5) * 0.08;
            const cSize = 64 * c.intensity * flicker;
            const cGrad = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, cSize);
            cGrad.addColorStop(0, "rgba(255, 180, 80, 0.46)");
            cGrad.addColorStop(0.42, "rgba(230, 140, 50, 0.2)");
            cGrad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = cGrad;
            ctx.beginPath();
            ctx.arc(c.x, c.y, cSize, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalCompositeOperation = "source-over";

        // Dust motes drifting through the lamplight
        ctx.globalAlpha = 0.09;
        ctx.fillStyle = "#f1e2b7";
        for (let i = 0; i < 90; i++) {
            const x = (i * 197 + this.frame * 0.4) % WORLD_WIDTH;
            const y = (i * 113 + this.frame * 0.13) % WORLD_HEIGHT;
            ctx.fillRect(x, y, 1.4, 1.4);
        }

        ctx.restore();
    }

    drawScreenVignette(ctx, w, h) {
        const vignette = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, "rgba(0,0,0,0.55)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);
    }

    // Graduated sanity VFX: Strained (<70) faint red edges, Fractured (<40) pulsing
    // heartbeat vignette, Broken (<15) heavy vignette, chromatic ghosting and a
    // one-off flash when the break happens.
    drawSanityEffects(ctx, w, h, engine) {
        const sanity = engine.player.sanity;

        const broken = sanity < 15;
        if (broken && !this.wasSanityBroken) {
            this.sanityBreakFlash = 1;
            this.triggerShake(14);
        }
        this.wasSanityBroken = broken ? true : sanity > 25 ? false : this.wasSanityBroken;

        if (sanity < 70) {
            const strain = (70 - sanity) / 70; // 0 → 1
            const beatRate = 0.05 + strain * 0.12;
            const beat = Math.pow(Math.max(0, Math.sin(this.frame * beatRate)), 8);
            const edge = 0.18 + strain * 0.55 + beat * strain * 0.25;

            ctx.save();
            const vignette = ctx.createRadialGradient(w / 2, h / 2, h * (0.55 - strain * 0.3), w / 2, h / 2, h * 0.95);
            vignette.addColorStop(0, "rgba(0,0,0,0)");
            vignette.addColorStop(1, `rgba(${Math.round(40 + strain * 60)}, 0, 6, ${Math.min(0.95, edge)})`);
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        if (broken) {
            // Ghost image: offset copy of the frame, like a double vision smear
            const sway = Math.sin(this.frame * 0.07) * 6;
            ctx.save();
            ctx.globalAlpha = 0.16;
            ctx.globalCompositeOperation = "lighter";
            ctx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, sway, 0, w, h);
            ctx.drawImage(this.canvas, 0, 0, this.canvas.width, this.canvas.height, -sway, 2, w, h);
            ctx.restore();
        }

        if (this.sanityBreakFlash > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(60, 0, 8, ${this.sanityBreakFlash * 0.5})`;
            ctx.fillRect(0, 0, w, h);
            if (this.sanityBreakFlash > 0.4) {
                ctx.shadowColor = "#000";
                ctx.shadowBlur = 10;
                ctx.fillStyle = `rgba(214, 40, 40, ${this.sanityBreakFlash})`;
                ctx.font = "bold 30px Cinzel, Courier New";
                ctx.textAlign = "center";
                ctx.fillText("YOUR MIND BREAKS", w / 2 + (Math.random() - 0.5) * 6, h / 2);
            }
            ctx.restore();
            this.sanityBreakFlash = Math.max(0, this.sanityBreakFlash - 0.012);
        }

        if (this.damageFlash > 0) {
            ctx.save();
            const flash = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.9);
            flash.addColorStop(0, "rgba(160, 0, 0, 0)");
            flash.addColorStop(1, `rgba(160, 0, 0, ${this.damageFlash})`);
            ctx.fillStyle = flash;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
            this.damageFlash = Math.max(0, this.damageFlash - 0.04);
        }
    }

    drawDeathOverlay(ctx, w, h, engine) {
        const p = engine.player;
        if (!p || p.health > 0) return;
        const t = Math.min(1, p.deathTimer / DEATH_ANIMATION_FRAMES);
        ctx.save();
        ctx.fillStyle = `rgba(8, 0, 0, ${t * 0.85})`;
        ctx.fillRect(0, 0, w, h);
        if (t > 0.35) {
            ctx.globalAlpha = Math.min(1, (t - 0.35) / 0.4);
            ctx.fillStyle = "#a31c1c";
            ctx.font = "bold 34px Cinzel, Courier New";
            ctx.textAlign = "center";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 12;
            ctx.fillText("SIGIL COLLAPSED", w / 2, h / 2);
        }
        ctx.restore();
    }

    drawInteractPrompts(ctx, engine) {
        ctx.save();
        for (const intr of engine.interactables) {
            const dist = engine.distance(engine.player.x, engine.player.y, intr.x, intr.y);
            if (dist < intr.radius + engine.player.radius + 15) {
                const visual = INTERACTABLE_SPRITES[intr.type];
                const label = visual?.label || "USE";
                ctx.fillStyle = "rgba(7, 6, 5, 0.86)";
                ctx.strokeStyle = "#9a2d21";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.roundRect(intr.x - 48, intr.y - 48, 96, 22, 4);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = "#f0e0b8";
                ctx.font = "12px Courier New";
                ctx.textAlign = "center";
                ctx.fillText(`[E] ${label}`, intr.x, intr.y - 33);
            }
        }
        ctx.restore();
    }

    drawCanvasUI(ctx, w, h, engine) {
        ctx.save();

        const boss = engine.enemies.find(e => e.type === "Seal Mother");
        if (boss) {
            const barW = Math.min(520, w - 80);
            const barH = 14;
            const bx = (w - barW) / 2;
            const by = 96;

            ctx.fillStyle = "rgba(7, 6, 5, 0.88)";
            ctx.fillRect(bx, by, barW, barH);
            ctx.strokeStyle = "#a6261e";
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, barW, barH);

            const pct = Math.max(0, boss.health / boss.maxHealth);
            const fill = ctx.createLinearGradient(bx, by, bx + barW, by);
            fill.addColorStop(0, "#5f0d0d");
            fill.addColorStop(0.65, "#b51f1c");
            fill.addColorStop(1, "#d49442");
            ctx.fillStyle = fill;
            ctx.fillRect(bx + 2, by + 2, (barW - 4) * pct, barH - 4);

            ctx.fillStyle = "#f2e5c4";
            ctx.font = "11px Cinzel, Courier New";
            ctx.textAlign = "center";
            ctx.fillText(`SEAL MOTHER - ARCHIVE CORE CURSE — ${(pct * 100).toFixed(1)}%`, w / 2, by - 7);
        }

        this.drawBanner(ctx, w);

        ctx.restore();
    }

    applyGlitchShader(ctx, w, h, engine) {
        if (!engine.player) return;
        const sanity = engine.player.sanity;
        if (sanity > 50) return; // Only glitch at low sanity

        // Intensity inversely proportional to sanity (max glitch at 0 sanity)
        const intensity = (50 - sanity) / 50; 
        
        // Only glitch on some frames to make it sporadic and jerky
        if (Math.random() > intensity * 0.4) return;

        // Take slices of the canvas and offset them horizontally
        const sliceHeight = Math.floor(10 + Math.random() * 40);
        const yOffset = Math.floor(Math.random() * (h - sliceHeight));
        const xOffset = (Math.random() - 0.5) * 30 * intensity;

        // RGB Split Simulation: We draw the same slice with a colored tint and global composite operation
        ctx.save();
        ctx.globalAlpha = 0.5 * intensity;
        
        // Red Shift
        ctx.globalCompositeOperation = "screen";
        ctx.fillStyle = "rgba(255, 0, 0, 0.08)";
        const d = this.dpr;
        ctx.drawImage(this.canvas, 0, yOffset * d, w * d, sliceHeight * d, xOffset + 5 * intensity, yOffset, w, sliceHeight);
        ctx.fillRect(xOffset + 5 * intensity, yOffset, w, sliceHeight);
        
        // Cyan Shift
        ctx.fillStyle = "rgba(0, 255, 255, 0.08)";
        ctx.drawImage(this.canvas, 0, yOffset * d, w * d, sliceHeight * d, xOffset - 5 * intensity, yOffset, w, sliceHeight);
        ctx.fillRect(xOffset - 5 * intensity, yOffset, w, sliceHeight);
        
        ctx.restore();
    }
}

function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
