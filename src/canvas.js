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

// Pickups: grim illustrated loot plus the keeping-house pickup set
const NEW_PICKUP_SPRITES = {
    loot_satchel: "debt_coin.idle",
    sanity_shard: "sanity_shard.idle",
    blood_vial: "black_ink_vial.idle",
    signal_fragment: "folded_witness_note.idle",
    cursed_gear_drop: "cursed_gear_drop.idle",
    memory_fragment: "brass_archive_key.idle"
};
const PICKUP_SCALE = 0.17;   // ~a third of a character's height

// Interactables use the grim illustrated props
const INTERACTABLE_SPRITES = {
    blood_ritual_altar: { anim: "blood_ritual_altar.idle", scale: 0.5, glow: "rgba(176, 25, 25, 0.5)", label: "SIGN", light: "#ff5a32" },
    static_signal_pylon: { anim: "static_signal_pylon.idle", scale: 0.5, glow: "rgba(110, 160, 200, 0.35)", label: "TUNE", light: "#9fc6e8" },
    corpse_lantern_shrine: { anim: "corpse_lantern_shrine.idle", scale: 0.46, glow: "rgba(230, 180, 90, 0.45)", label: "FILE", light: "#ffb860" },
    wax_record_chest: { anim: "wax_record_chest.idle", open: "wax_record_chest.activate", scale: 0.36, glow: "rgba(184, 31, 31, 0.28)", label: "OPEN" },
    sealed_zone_door: { anim: "sealed_zone_door.idle", open: "sealed_zone_door.activate", scale: 0.7, glow: "rgba(189, 41, 34, 0.3)", label: "EXIT" },
    fresh_marked_corpse: { anim: "fresh_marked_corpse.idle", scale: 0.34, label: "SEARCH" },
    burned_corpse_remains: { anim: "burned_corpse_remains.idle", scale: 0.34, label: "REMAINS" },
    broadcast_corpse: { anim: "broadcast_corpse.idle", scale: 0.34, label: "REMAINS" }
};

// Enemy art comes from the grim illustrated pack (8-10 frame animations).
// pick() returns the animation key and, for one-shots, the elapsed frames.
const ENEMY_ART = {
    "Cabinet Indexer": {
        scale: 0.42, death: "cabinet_indexer.death",
        pick: (e) => e.hitFlash > 0 ? { key: "cabinet_indexer.hit_react", elapsed: 6 - e.hitFlash }
            : e.attackCooldown > 40 ? { key: "cabinet_indexer.attack", elapsed: 70 - e.attackCooldown }
            : { key: moving(e) ? "cabinet_indexer.move" : "cabinet_indexer.combat_idle" }
    },
    "Ink Redactor": {
        scale: 0.42, death: "ink_redactor.death",
        pick: (e) => e.hitFlash > 0 ? { key: "ink_redactor.hit_react", elapsed: 6 - e.hitFlash }
            : e.shootCooldown > 60 ? { key: "ink_redactor.attack", elapsed: 90 - e.shootCooldown }
            : { key: moving(e) ? "ink_redactor.move" : "ink_redactor.combat_idle" }
    },
    "Paper Wraith": {
        scale: 0.44, alpha: 0.95, glow: "rgba(20, 30, 20, 0.9)", death: "paper_wraith.death",
        pick: (e) => e.hitFlash > 0 ? { key: "paper_wraith.hit_react", elapsed: 6 - e.hitFlash }
            : e.attackCooldown > 34 ? { key: "paper_wraith.attack", elapsed: 62 - e.attackCooldown }
            : { key: moving(e) ? "paper_wraith.move" : "paper_wraith.combat_idle" }
    },
    "Witness Chair": {
        scale: 0.48, death: "witness_chair.death",
        pick: (e) => e.hitFlash > 0 ? { key: "witness_chair.hit_react", elapsed: 6 - e.hitFlash }
            : e.attackCooldown > 40 ? { key: "witness_chair.attack", elapsed: 70 - e.attackCooldown }
            : { key: moving(e) ? "witness_chair.move" : "witness_chair.combat_idle" }
    },
    "Seal Mother": {
        scale: 0.78, death: "seal_mother.death_unravel",
        pick: (e) => e.attackCooldown > 50 ? { key: "seal_mother.seal_slam", elapsed: 80 - e.attackCooldown }
            : e.behaviorTimer % 180 < 50 ? { key: "seal_mother.summon_seals", elapsed: e.behaviorTimer % 180 }
            : e.hitFlash > 0 ? { key: "seal_mother.hit_react", elapsed: 6 - e.hitFlash }
            : { key: "seal_mother.combat_idle" }
    },
    "The Shape": {
        scale: 0.36, alpha: 0.6, glow: "#5b2a70", death: "the_marked.death_collapse",
        pick: (e) => e.attackCooldown > 30 ? { key: "the_marked.basic_attack", elapsed: 50 - e.attackCooldown }
            : { key: moving(e) ? "the_marked.walk" : "the_marked.idle" }
    },
    "Corpse Echo": {
        scale: 0.36, alpha: 0.8, glow: "#7a1010", death: "the_marked.death_collapse",
        pick: (e) => e.attackCooldown > 30 ? { key: "the_marked.basic_attack", elapsed: 45 - e.attackCooldown }
            : { key: moving(e) ? "the_marked.walk" : "the_marked.idle" }
    }
};

function moving(e) {
    return Math.abs(e.vx) + Math.abs(e.vy) > 0.05;
}

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
        ctx.font = "36px 'IM Fell English SC', Georgia, serif";
        ctx.fillText(b.title, 0, 0);
        ctx.shadowBlur = 0;
        if (b.subtitle) {
            ctx.fillStyle = "#eadfbd";
            ctx.font = "italic 17px 'IM Fell English', Georgia, serif";
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
        this.drawLoot(ctx, engine);

        const entities = [];
        if (engine.player) {
            entities.push({ type: "player", y: engine.player.y, ref: engine.player });
        }
        for (const e of engine.enemies) {
            entities.push({ type: "enemy", y: e.y, ref: e });
        }

        this.playerX = engine.player ? engine.player.x : 0;
        for (const intr of engine.interactables) {
            entities.push({ type: "intr", y: intr.y, ref: intr });
        }
        for (const obs of engine.obstacles) {
            entities.push({ type: "obstacle", y: obs.r ? obs.y + 10 : obs.y + obs.h, ref: obs });
        }
        for (const fx of engine.deathFx || []) {
            entities.push({ type: "deathfx", y: fx.y - 1, ref: fx });
        }
        entities.sort((a, b) => a.y - b.y);
        for (const ent of entities) {
            if (ent.type === "player") this.drawPlayer(ctx, ent.ref);
            else if (ent.type === "deathfx") this.drawDeathFx(ctx, ent.ref);
            else if (ent.type === "intr") this.drawInteractable(ctx, ent.ref);
            else if (ent.type === "obstacle") this.drawObstacle(ctx, ent.ref, engine);
            else this.drawEnemy(ctx, ent.ref);
        }

        this.drawProjectiles(ctx, engine);
        this.drawParticles(ctx, engine);
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

    // Candle cluster on an iron stand: tallow, drips and a living flame
    drawCandle(ctx, c) {
        const t = this.frame;
        const seed = c.x * 0.37;
        ctx.save();
        // Iron dish and foot
        ctx.fillStyle = "#0c0a09";
        ctx.beginPath();
        ctx.ellipse(c.x, c.y + 1, 15, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#3a332c";
        ctx.lineWidth = 1;
        ctx.stroke();
        const sticks = [[-7, 20], [0, 30], [7, 15]];
        for (const [dx, hgt] of sticks) {
            const x = c.x + dx, top = c.y - hgt;
            const g = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
            g.addColorStop(0, "#6f6250");
            g.addColorStop(0.45, "#d6c9a8");
            g.addColorStop(1, "#5c5142");
            ctx.fillStyle = g;
            ctx.fillRect(x - 3, top, 6, hgt);
            // Drips
            ctx.fillStyle = "#cbbd9a";
            ctx.fillRect(x - 3, top, 1.6, 4 + (Math.sin(seed + dx) + 1) * 3);
            ctx.fillRect(x + 1.5, top, 1.4, 2 + (Math.cos(seed + dx) + 1) * 4);
            // Wick
            ctx.fillStyle = "#120a06";
            ctx.fillRect(x - 0.5, top - 3, 1, 3);
            // Flame
            const sway = Math.sin(t * 0.18 + seed + dx) * 1.2 + (Math.random() - 0.5) * 0.6;
            const fh = 7 + Math.sin(t * 0.27 + dx) * 1.2;
            ctx.fillStyle = "rgba(255, 150, 50, 0.85)";
            ctx.beginPath();
            ctx.moveTo(x - 2.4, top - 3);
            ctx.quadraticCurveTo(x - 2.6, top - fh * 0.6, x + sway, top - 3 - fh);
            ctx.quadraticCurveTo(x + 2.6, top - fh * 0.6, x + 2.4, top - 3);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = "rgba(255, 240, 200, 0.95)";
            ctx.beginPath();
            ctx.ellipse(x + sway * 0.3, top - 5, 1, 2.2, 0, 0, Math.PI * 2);
            ctx.fill();
        }
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

    drawObstacle(ctx, obs, engine) {
        if (obs.label === "The Monolith") {
            this.drawMonolith(ctx, obs, engine);
            return;
        }
        const cx = obs.x + (obs.w || 0) / 2;
        const cy = obs.y + (obs.h || 0);
        this.drawGroundShadow(ctx, cx, cy + 4, 56, 15, 0.55);
        if (obs.label === "Evidence Board") {
            this.drawSprite(ctx, "red_string_evidence_board.idle", cx, cy + 14, 0.46, 1);
        } else if (obs.label === "Ledger Altar") {
            this.drawSprite(ctx, "chained_ledger_altar.idle", cx, cy + 14, 0.46, 1);
        }
    }

    // The Monolith: a black obelisk whose carved glyphs burn and whose eye
    // opens as Observation rises.
    drawMonolith(ctx, obs, engine) {
        const o = Math.min(100, engine.player.profile.observation) / 100;
        const pl = engine.player;
        const behind = pl.y < obs.y + 10 && Math.abs(pl.x - obs.x) < 46 && pl.y > obs.y - 230;
        this.monolithAlpha = (this.monolithAlpha ?? 1) + ((behind ? 0.45 : 1) - (this.monolithAlpha ?? 1)) * 0.15;
        const x = obs.x, base = obs.y + 18;
        const h = 210, wb = 74, wt = 40;
        const t = this.frame;
        ctx.save();

        // Pool of red light and ground shadow
        const pool = ctx.createRadialGradient(x, base, 4, x, base, 120);
        pool.addColorStop(0, `rgba(150, 18, 12, ${0.18 + o * 0.35})`);
        pool.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.ellipse(x, base, 120, 40, 0, 0, Math.PI * 2);
        ctx.fill();
        this.drawGroundShadow(ctx, x, base, 64, 18, 0.8);

        // Wax and paper heaped at its foot
        this.drawSprite(ctx, "wax_seal_growth.idle", x - 46, base + 10, 0.34, 0.95, "right", 7);
        this.drawSprite(ctx, "paper_root_growth.idle", x + 44, base + 12, 0.3, 0.85, "left", 19);

        // Slab body (fades when the player walks behind it)
        ctx.globalAlpha = this.monolithAlpha;
        ctx.beginPath();
        ctx.moveTo(x - wb / 2, base);
        ctx.lineTo(x - wt / 2, base - h);
        ctx.lineTo(x, base - h - 26);
        ctx.lineTo(x + wt / 2, base - h);
        ctx.lineTo(x + wb / 2, base);
        ctx.closePath();
        const body = ctx.createLinearGradient(x - wb / 2, 0, x + wb / 2, 0);
        body.addColorStop(0, "#050404");
        body.addColorStop(0.35, "#1b1614");
        body.addColorStop(0.55, "#0d0a09");
        body.addColorStop(1, "#020202");
        ctx.fillStyle = body;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#000";
        ctx.stroke();

        // Facet highlight
        ctx.beginPath();
        ctx.moveTo(x - 6, base);
        ctx.lineTo(x - 3, base - h);
        ctx.lineTo(x, base - h - 26);
        ctx.strokeStyle = "rgba(200, 170, 140, 0.12)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Carved glyph column, glowing with Observation
        const flicker = 0.85 + Math.sin(t * 0.13) * 0.08 + Math.random() * 0.07;
        ctx.strokeStyle = `rgba(${200 + o * 55}, ${30 + o * 20}, 20, ${(0.25 + o * 0.7) * flicker})`;
        ctx.shadowColor = "#ff2a10";
        ctx.shadowBlur = 6 + o * 14;
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 7; i++) {
            const gy = base - 26 - i * 22;
            const gw = 10 - i * 0.6;
            ctx.beginPath();
            // Each glyph: a vertical stroke with crossbars that vary per row
            ctx.moveTo(x, gy);
            ctx.lineTo(x, gy - 12);
            if (i % 2 === 0) { ctx.moveTo(x - gw, gy - 4); ctx.lineTo(x + gw, gy - 8); }
            else { ctx.moveTo(x - gw, gy - 9); ctx.lineTo(x, gy - 4); ctx.lineTo(x + gw, gy - 9); }
            if (i % 3 === 0) { ctx.moveTo(x - gw * 0.6, gy); ctx.lineTo(x + gw * 0.6, gy); }
            ctx.stroke();
        }

        // The eye near the apex opens with Observation
        const ey = base - h + 18;
        const open = 1.5 + o * 9;
        ctx.shadowBlur = 10 + o * 20;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(x, ey, 14, open + 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, ${60 + o * 60}, 30, ${0.5 + o * 0.5})`;
        ctx.beginPath();
        ctx.ellipse(x, ey, 12, open, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pupil tracks the player
        const look = Math.max(-5, Math.min(5, (engine.player.x - x) / 60));
        ctx.fillStyle = "#050000";
        ctx.beginPath();
        ctx.ellipse(x + look, ey, 2.2, Math.max(1, open - 1), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawInteractable(ctx, intr) {
        const visual = INTERACTABLE_SPRITES[intr.type];
        if (!visual) return;
        ctx.save();
        if (visual.glow) {
            const pulse = 0.8 + Math.sin(this.frame * 0.05 + intr.x) * 0.2;
            const glow = ctx.createRadialGradient(intr.x, intr.y, 2, intr.x, intr.y, 54);
            glow.addColorStop(0, visual.glow);
            glow.addColorStop(1, "rgba(0,0,0,0)");
            ctx.globalAlpha = pulse;
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.ellipse(intr.x, intr.y, 58, 20, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        this.drawGroundShadow(ctx, intr.x, intr.y + 2, 40 * visual.scale / 0.5, 12, 0.6);

        const state = intr.data && intr.data.state;
        if (visual.open && (state === "opening" || state === "open")) {
            // Play the activate animation once, then hold its last frame
            const config = assetLoader.animationsMap[visual.open];
            intr.openT = (intr.openT || 0) + 1;
            const idx = config ? Math.min(config.frames - 1, Math.floor(intr.openT * (config.fps / 60))) : 0;
            assetLoader.drawFrame(ctx, visual.open, idx, intr.x, intr.y + 4, "right", visual.scale, 1);
        } else {
            this.drawSprite(ctx, visual.anim, intr.x, intr.y + 4, visual.scale, 1, "right", intr.x);
        }

        if (intr.type === "sealed_zone_door" && state === "open") {
            const portal = ctx.createRadialGradient(intr.x, intr.y - 80, 6, intr.x, intr.y - 80, 70);
            portal.addColorStop(0, `rgba(160, 30, 20, ${0.35 + Math.sin(this.frame * 0.08) * 0.1})`);
            portal.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = portal;
            ctx.beginPath();
            ctx.ellipse(intr.x, intr.y - 80, 50, 70, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
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
            const bob = Math.sin(this.frame * 0.06 + l.x) * 1.5;
            const anim = NEW_PICKUP_SPRITES[l.id] || `${l.id}.idle`;
            ctx.save();
            this.drawGroundShadow(ctx, l.x, l.y + 2, 9, 3.5, 0.6);
            if (style.tint) ctx.filter = "sepia(1) saturate(5) hue-rotate(-50deg) brightness(0.85)";
            this.drawSprite(ctx, anim, l.x, l.y + bob, PICKUP_SCALE, 1, "right", l.x);
            ctx.filter = "none";
            ctx.restore();
        }
    }

    // Glints and labels drawn above the darkness. Labels show for nearby drops
    // (and always for rare ones) so the floor isn't cluttered with text.
    drawLootHighlights(ctx, engine) {
        const p = engine.player;
        ctx.save();
        ctx.textAlign = "center";
        for (const l of engine.loot) {
            const style = this.lootStyle(l);
            const pulse = 0.7 + Math.sin(this.frame * 0.09 + l.x) * 0.3;
            const rare = style.beam || (l.item && ["Relic", "Abyssal", "Impossible"].includes(l.item.rarity));
            const near = Math.hypot(p.x - l.x, p.y - l.y) < 170;

            // A small glint so drops read against the floor
            ctx.globalCompositeOperation = "lighter";
            const glow = ctx.createRadialGradient(l.x, l.y - 4, 0, l.x, l.y - 4, 16);
            glow.addColorStop(0, hexA(style.color, 0.28 * pulse));
            glow.addColorStop(1, hexA(style.color, 0));
            ctx.fillStyle = glow;
            ctx.fillRect(l.x - 16, l.y - 20, 32, 32);
            if (Math.floor(this.frame / 7 + l.x) % 11 === 0) {
                ctx.fillStyle = hexA("#fff4dc", 0.8);
                ctx.fillRect(l.x - 5 + (l.x % 7), l.y - 12, 1.5, 1.5);
            }

            if (rare) {
                const beam = ctx.createLinearGradient(0, l.y - 90, 0, l.y);
                beam.addColorStop(0, hexA(style.color, 0));
                beam.addColorStop(1, hexA(style.color, 0.22 * pulse));
                ctx.fillStyle = beam;
                ctx.fillRect(l.x - 2.5, l.y - 90, 5, 90);
            }
            ctx.globalCompositeOperation = "source-over";

            const text = style.label(l);
            if (text && (near || rare)) {
                ctx.globalAlpha = near ? 1 : 0.75;
                ctx.font = "italic 11px 'IM Fell English', Georgia, serif";
                const ly = l.y - 18;
                ctx.lineWidth = 3;
                ctx.strokeStyle = "rgba(0,0,0,0.85)";
                ctx.strokeText(text, l.x, ly);
                ctx.fillStyle = style.color;
                ctx.fillText(text, l.x, ly);
                ctx.globalAlpha = 1;
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

    // Enemy death: play the art's death animation, then let the remains fade
    drawDeathFx(ctx, fx) {
        const spec = ENEMY_ART[fx.type] || ENEMY_ART["Cabinet Indexer"];
        const config = assetLoader.animationsMap[spec.death];
        if (!config) return;
        const playFrames = config.frames * (60 / config.fps);
        const idx = Math.min(config.frames - 1, Math.floor(fx.t * (config.fps / 60)));
        const fade = fx.t < playFrames ? 1 : Math.max(0, 1 - (fx.t - playFrames) / 50);
        ctx.save();
        this.drawGroundShadow(ctx, fx.x, fx.y + 2, 20, 7, 0.4 * fade);
        assetLoader.drawFrame(ctx, spec.death, idx, fx.x, fx.y + 6, fx.facing, spec.scale, (spec.alpha ?? 1) * fade);
        ctx.restore();
    }

    drawEnemy(ctx, e) {
        ctx.save();
        const spec = ENEMY_ART[e.type] || ENEMY_ART["Cabinet Indexer"];
        this.drawGroundShadow(ctx, e.x, e.y + 2, e.radius * 1.5, Math.max(7, e.radius * 0.4), 0.55);

        // Face the player rather than the velocity, so knockback doesn't flip the sprite
        const facing = this.playerX < e.x ? "left" : "right";
        const pick = spec.pick(e);
        const key = pick.key;
        const config = assetLoader.animationsMap[key];
        let idx = 0;
        if (config) {
            idx = pick.elapsed !== undefined
                ? Math.max(0, Math.min(config.frames - 1, Math.floor(pick.elapsed * (config.fps / 60))))
                : Math.floor((this.frame + e.x) * (config.fps / 60)) % config.frames;
        }

        const scale = spec.scale;
        const alpha = spec.alpha ?? 1;
        if (spec.glow) {
            ctx.shadowColor = spec.glow;
            ctx.shadowBlur = 14;
        }

        if (e.hitFlash > 0) {
            ctx.filter = "brightness(2.6) saturate(0.2)";
        }
        assetLoader.drawFrame(ctx, key, idx, e.x, e.y + 6, facing, scale, alpha);
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
            ctx.font = ft.isCrit ? "24px 'IM Fell English SC', Georgia, serif" : "18px 'IM Fell English', Georgia, serif";
            
            // outline
            ctx.strokeStyle = "rgba(0,0,0,0.8)";
            ctx.lineWidth = 3;
            ctx.strokeText(ft.text, ft.x, ft.y);
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.restore();
    }


    // ─── Lighting: a light map multiplied over the scene ───────────────────
    // Darkness everywhere except pools cast by the lantern, candles and the
    // room's occult fixtures; then a soft additive bloom and drifting fog.
    collectLights(engine) {
        const lights = [];
        const p = engine.player;
        const sanity = p.sanity / 100;
        const t = this.frame;
        lights.push({ x: p.x, y: p.y - 24, r: 210 + sanity * 90, color: [255, 228, 190], a: 1.1 });
        lights.push({ x: p.x, y: p.y - 24, r: 70, color: [255, 240, 215], a: 0.5 });
        for (const c of this.candles) {
            const f = 1 + Math.sin(t * 0.21 + c.x) * 0.05 + (Math.random() - 0.5) * 0.08;
            lights.push({ x: c.x, y: c.y - 10, r: 140 * c.intensity * f, color: [255, 170, 95], a: 0.75 * f });
        }
        for (const intr of engine.interactables) {
            const v = INTERACTABLE_SPRITES[intr.type];
            if (v && v.light) {
                const pulse = 0.85 + Math.sin(t * 0.05 + intr.x) * 0.15;
                lights.push({ x: intr.x, y: intr.y - 30, r: 130, color: hexRgb(v.light), a: 0.7 * pulse });
            }
            if (intr.type === "sealed_zone_door" && intr.data.state === "open") {
                lights.push({ x: intr.x, y: intr.y - 60, r: 220, color: [220, 40, 24], a: 0.9 });
            }
        }
        const mono = engine.obstacles.find(o => o.label === "The Monolith");
        if (mono) {
            const o = Math.min(100, p.profile.observation) / 100;
            lights.push({ x: mono.x, y: mono.y - 40, r: 80 + o * 110, color: [220, 30, 18], a: 0.25 + o * 0.5 });
        }
        for (const l of engine.loot) {
            const st = this.lootStyle(l);
            lights.push({ x: l.x, y: l.y, r: 34, color: hexRgb(st.color), a: 0.5 });
        }
        for (const pr of engine.projectiles) {
            lights.push({ x: pr.x, y: pr.y, r: 46, color: pr.owner === "player" ? [255, 200, 150] : [180, 40, 40], a: 0.45 });
        }
        return lights;
    }

    drawLightingPass(ctx, engine) {
        const lights = this.collectLights(engine);
        // Darkness deepens and the ambient light cools as sanity falls
        const sanityFactor = engine.player.sanity / 100;
        const darkness = 1 - (26 + sanityFactor * 18) / 255;
        const vx = this.camera.x, vy = this.camera.y, vw = this.viewW, vh = this.viewH;

        // Light map at half resolution
        const ls = 0.5;
        const lw = Math.ceil(vw * ls), lh = Math.ceil(vh * ls);
        if (!this.lightCanvas) this.lightCanvas = document.createElement("canvas");
        const lc = this.lightCanvas;
        if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
        const l = lc.getContext("2d");
        l.setTransform(1, 0, 0, 1, 0, 0);
        l.globalCompositeOperation = "source-over";
        // Ambient: cold and darker as sanity falls
        const amb = 255 * (1 - darkness);
        l.fillStyle = `rgb(${amb}, ${amb * 0.9}, ${amb * 1.08})`;
        l.fillRect(0, 0, lw, lh);
        l.setTransform(ls, 0, 0, ls, -vx * ls, -vy * ls);
        l.globalCompositeOperation = "lighter";
        for (const L of lights) {
            if (L.x + L.r < vx || L.x - L.r > vx + vw || L.y + L.r < vy || L.y - L.r > vy + vh) continue;
            const [r, g, b] = L.color;
            const grad = l.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${L.a})`);
            grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${L.a * 0.45})`);
            grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            l.fillStyle = grad;
            l.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
        }

        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.drawImage(lc, vx, vy, vw, vh);

        // Bloom: a faint additive haze around the brightest sources
        ctx.globalCompositeOperation = "lighter";
        for (const L of lights) {
            if (L.r < 60) continue;
            const [r, g, b] = L.color;
            const grad = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r * 0.6);
            grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.07 * L.a})`);
            grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
        }
        ctx.restore();

        this.drawFog(ctx);
        this.drawAsh(ctx);
    }

    // Two layers of slow fog hugging the floor
    drawFog(ctx) {
        if (!this.fogTexture) this.fogTexture = makeFogTexture();
        const tex = this.fogTexture;
        const size = 640;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        for (const [speed, alpha, scale, oy] of [[0.12, 0.07, 1, 0], [-0.07, 0.05, 1.6, 200]]) {
            const s2 = size * scale;
            const ox = ((this.frame * speed) % s2 + s2) % s2;
            const x0 = Math.floor((this.camera.x - ox) / s2) * s2 + ox;
            const y0 = Math.floor((this.camera.y - oy) / s2) * s2 + oy;
            ctx.globalAlpha = alpha;
            for (let x = x0 - s2; x < this.camera.x + this.viewW + s2; x += s2) {
                for (let y = y0 - s2; y < this.camera.y + this.viewH + s2; y += s2) {
                    ctx.drawImage(tex, x, y, s2, s2);
                }
            }
        }
        ctx.restore();
    }

    // Drifting ash and embers
    drawAsh(ctx) {
        ctx.save();
        for (let i = 0; i < 70; i++) {
            const seed = i * 977;
            const x = (seed * 1.7 + this.frame * (0.15 + (i % 5) * 0.05)) % WORLD_WIDTH;
            const y = (seed * 0.73 + this.frame * (0.08 + (i % 3) * 0.04) + Math.sin(this.frame * 0.01 + i) * 20) % WORLD_HEIGHT;
            const ember = i % 9 === 0;
            ctx.globalAlpha = ember ? 0.6 + Math.sin(this.frame * 0.1 + i) * 0.3 : 0.22;
            ctx.fillStyle = ember ? "#ff7a3a" : "#cfc3a8";
            ctx.fillRect(x, y, ember ? 1.6 : 1.2, ember ? 1.6 : 1.2);
        }
        ctx.restore();
    }

    drawScreenVignette(ctx, w, h) {
        // Heavy ink vignette and a subtle cold/warm grade
        const v = ctx.createRadialGradient(w / 2, h * 0.52, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
        v.addColorStop(0, "rgba(0,0,0,0)");
        v.addColorStop(0.7, "rgba(4,2,4,0.45)");
        v.addColorStop(1, "rgba(0,0,0,0.85)");
        ctx.fillStyle = v;
        ctx.fillRect(0, 0, w, h);

        // Film grain
        if (!this.grain) this.grain = makeGrainTexture();
        ctx.save();
        ctx.globalAlpha = 0.07;
        ctx.globalCompositeOperation = "overlay";
        const ox = Math.floor(Math.random() * 256), oy = Math.floor(Math.random() * 256);
        for (let x = -ox; x < w; x += 256) {
            for (let y = -oy; y < h; y += 256) ctx.drawImage(this.grain, x, y);
        }
        ctx.restore();
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
                ctx.font = "40px 'IM Fell English SC', Georgia, serif";
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
            flash.addColorStop(1, `rgba(120, 0, 0, ${this.damageFlash * 0.6})`);
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
            ctx.font = "48px 'IM Fell English SC', Georgia, serif";
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
                // Inked prompt: a bone key tab beside a word, no box
                const y = intr.y - 74;
                ctx.font = "italic 17px 'IM Fell English', Georgia, serif";
                ctx.textAlign = "left";
                const tw = ctx.measureText(label.toLowerCase()).width;
                const x0 = intr.x - (tw + 26) / 2;
                ctx.fillStyle = "#cdbf9f";
                ctx.fillRect(x0, y - 13, 18, 18);
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 1;
                ctx.strokeRect(x0 + 0.5, y - 12.5, 17, 17);
                ctx.fillStyle = "#2a1a0e";
                ctx.font = "14px 'IM Fell English SC', Georgia, serif";
                ctx.textAlign = "center";
                ctx.fillText("E", x0 + 9, y + 1);
                ctx.font = "italic 17px 'IM Fell English', Georgia, serif";
                ctx.textAlign = "left";
                ctx.lineWidth = 3;
                ctx.strokeStyle = "rgba(0,0,0,0.9)";
                ctx.strokeText(label.toLowerCase(), x0 + 26, y + 2);
                ctx.fillStyle = "#e8dcc0";
                ctx.fillText(label.toLowerCase(), x0 + 26, y + 2);
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
            const by = 150;

            // Iron-framed bar with a wax-red ink fill
            ctx.fillStyle = "#050303";
            ctx.fillRect(bx - 4, by - 4, barW + 8, barH + 8);
            ctx.strokeStyle = "#3a332c";
            ctx.lineWidth = 2;
            ctx.strokeRect(bx - 3, by - 3, barW + 6, barH + 6);
            const pct = Math.max(0, boss.health / boss.maxHealth);
            const fill = ctx.createLinearGradient(0, by, 0, by + barH);
            fill.addColorStop(0, "#b3261b");
            fill.addColorStop(0.5, "#7a0e09");
            fill.addColorStop(1, "#3d0504");
            ctx.fillStyle = fill;
            ctx.fillRect(bx, by, barW * pct, barH);
            // Seal marks every quarter
            ctx.fillStyle = "#000";
            for (let i = 1; i < 4; i++) ctx.fillRect(bx + (barW * i) / 4 - 1, by, 2, barH);

            ctx.textAlign = "center";
            ctx.font = "24px 'IM Fell English SC', Georgia, serif";
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(0,0,0,0.9)";
            ctx.strokeText("The Seal Mother", w / 2, by - 12);
            ctx.fillStyle = "#e3c9a8";
            ctx.fillText("The Seal Mother", w / 2, by - 12);
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

function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Soft tileable fog: overlapping blurred blobs wrapped at the edges
function makeFogTexture() {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    for (let i = 0; i < 40; i++) {
        const x = Math.random() * size, y = Math.random() * size, r = 30 + Math.random() * 70;
        for (const dx of [-size, 0, size]) {
            for (const dy of [-size, 0, size]) {
                const grad = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
                grad.addColorStop(0, "rgba(170, 165, 180, 0.22)");
                grad.addColorStop(1, "rgba(170, 165, 180, 0)");
                g.fillStyle = grad;
                g.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
            }
        }
    }
    return c;
}

function makeGrainTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}
