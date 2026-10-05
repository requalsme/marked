// Canvas Graphics Renderer with sprite-led room dressing, VFX, lighting, and HUD prompts.
import { assetLoader } from "./assets.js";
import { DEATH_ANIMATION_FRAMES } from "./engine.js";
import { ROOM, WORLD_WIDTH, WORLD_HEIGHT, buildRoomTexture, depthScale, SCONCE_CANDLES } from "./world.js";
import { RARITY_MULTIPLIERS } from "./state.js";
import { buildPropSprites, propCovers } from "./props.js";
import { buildFixtures } from "./fixtures.js";

const CORPSE_TYPES = new Set(["fresh_marked_corpse", "burned_corpse_remains", "broadcast_corpse"]);

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
    fresh_marked_corpse: { anim: "fresh_marked_corpse.idle", scale: 0.34, glow: "rgba(150, 26, 18, 0.32)", label: "SEARCH" },
    burned_corpse_remains: { anim: "burned_corpse_remains.idle", scale: 0.34, glow: "rgba(200, 90, 30, 0.26)", label: "REMAINS" },
    broadcast_corpse: { anim: "broadcast_corpse.idle", scale: 0.34, glow: "rgba(120, 150, 200, 0.24)", label: "REMAINS" }
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

const PAINTED_ROOM_URL = "assets/room/room_painted.png";
// Optional rendered corpse art (see assets/corpses/README.md). When a file is
// present it replaces the painted body; the blood pool and glows stay.
const CORPSE_ART = {
    fresh_marked_corpse: "assets/corpses/fresh_marked_corpse.png",
    burned_corpse_remains: "assets/corpses/burned_corpse_remains.png",
    broadcast_corpse: "assets/corpses/broadcast_corpse.png"
};
const CORPSE_ART_LENGTH = 92; // world units the body spans, head to feet, at y = 650

// Moonlight shafts falling from the darkness above the walls
const MOON_SHAFTS = [
    { top: { x: 330, y: 0 }, w0: 34, floor: { x: 470, y: 560 }, w1: 150 },
    { top: { x: 1270, y: 0 }, w0: 26, floor: { x: 1130, y: 520 }, w1: 110 }
];

// Foreground chains: world x anchor and hanging length (world units)
const FOREGROUND_CHAINS = [
    { x: 120, len: 260, hook: true },
    { x: 360, len: 120 },
    { x: 1250, len: 170, hook: true },
    { x: 1500, len: 300 },
    { x: 760, len: 70 }
];

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
        this.props = [];
        this.propScale = 0;
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
        // Furniture is painted procedurally even over a hand-painted room plate
        const newProps = !this.props.length || wanted > this.propScale + 0.25;
        if (newProps) {
            this.propScale = wanted;
            this.props = buildPropSprites(wanted);
            this.fixtures = buildFixtures(wanted);
        }
        if (!this.paintedRoom && (newProps || !this.roomTexture || wanted > this.roomTextureScale + 0.25)) {
            this.roomTextureScale = wanted;
            this.roomTexture = buildRoomTexture(wanted);
            this.bakePropFloors(this.roomTexture, wanted);
        }
        this.loadPaintedRoom();
        this.loadCorpseArt();
    }

    loadCorpseArt() {
        if (this.corpseArt) return;
        this.corpseArt = {};
        for (const [type, url] of Object.entries(CORPSE_ART)) {
            const img = new Image();
            img.onload = () => { this.corpseArt[type] = img; };
            img.onerror = () => {};
            img.src = url;
        }
    }

    // Prop shadows and spilled paper never move, so bake them into the floor
    bakePropFloors(texture, scale) {
        const g = texture.getContext("2d");
        g.save();
        g.setTransform(scale, 0, 0, scale, 0, 0);
        for (const pr of this.staticFloors()) g.drawImage(pr.floorCanvas, pr.floorRect.x, pr.floorRect.y, pr.floorRect.w, pr.floorRect.h);
        g.restore();
        this.bakedTexture = texture;
    }

    // A hand-painted room plate (a repaint of docs/art/reference/room_shell_paintover_base.png
    // with the same composition) replaces the procedural shell when present.
    loadPaintedRoom() {
        if (this.paintedRoomRequested) return;
        this.paintedRoomRequested = true;
        const img = new Image();
        img.onload = () => {
            this.paintedRoom = img;
            this.roomTexture = img;
        };
        img.onerror = () => {}; // not provided: keep the procedural room
        img.src = PAINTED_ROOM_URL;
    }

    get viewW() { return this.cssW / this.zoom; }
    // Does a world-space rectangle intersect what the camera shows?
    inView(x, y, w, h) {
        return x + w > this.camera.x && x < this.camera.x + this.viewW && y + h > this.camera.y && y < this.camera.y + this.viewH;
    }
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
        this.drawFixtureFloors(ctx, engine);
        this.drawDecals(ctx, engine);
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
            entities.push({ type: "intr", y: this.intrSortY(intr), ref: intr });
        }
        for (const obs of engine.obstacles) {
            if (obs.label === "prop" || obs.label === "fixture") continue; // drawn as sprites
            const mono = obs.label === "The Monolith" && this.fixtures ? this.fixtures.monolith : null;
            entities.push({ type: "obstacle", y: mono ? mono.sortY : obs.r ? obs.y + 10 : obs.y + obs.h, ref: obs });
        }
        for (const pr of this.props) {
            if (this.inView(pr.x, pr.y, pr.w, pr.h)) entities.push({ type: "prop", y: pr.sortY, ref: pr });
        }
        for (const fx of engine.deathFx || []) {
            entities.push({ type: "deathfx", y: fx.y - 1, ref: fx });
        }
        entities.sort((a, b) => a.y - b.y);
        for (const ent of entities) {
            if (ent.type === "player") this.drawPlayer(ctx, ent.ref);
            else if (ent.type === "deathfx") this.drawDeathFx(ctx, ent.ref);
            else if (ent.type === "intr") this.drawInteractable(ctx, ent.ref, engine);
            else if (ent.type === "obstacle") this.drawObstacle(ctx, ent.ref, engine);
            else if (ent.type === "prop") this.drawProp(ctx, ent.ref, engine);
            else this.drawEnemy(ctx, ent.ref);
        }

        this.drawProjectiles(ctx, engine);
        this.drawParticles(ctx, engine);
        if (this.onDrawWorld) this.onDrawWorld(ctx);
        this.drawLightingPass(ctx, engine);
        this.drawMoonShafts(ctx);
        // Drawn after lighting so they read clearly in the dark
        this.drawLootHighlights(ctx, engine);
        this.drawFloatingTexts(ctx, engine);
        this.drawInteractPrompts(ctx, engine);
        this.drawEnemyHealthBars(ctx, engine);

        // ── Screen pass (CSS pixels) ──
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.drawForeground(ctx, w, h);
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
        if (this.roomTexture !== this.bakedTexture) {
            for (const pr of this.staticFloors()) {
                const f = pr.floorRect;
                if (this.inView(f.x, f.y, f.w, f.h)) ctx.drawImage(pr.floorCanvas, f.x, f.y, f.w, f.h);
            }
        }
        for (const c of this.candles) {
            if (c.kind === "sconce") this.drawSconceFlames(ctx, c);
            else this.drawCandle(ctx, c);
        }
    }

    // Flames for the iron sconces baked into the room texture
    drawSconceFlames(ctx, c) {
        const s = c.scale || 1;
        for (const [dx, hh] of SCONCE_CANDLES) {
            this.drawFlame(ctx, c.x + dx * s, c.y - (hh + 2.5) * s, s * 1.1, c.x + dx);
        }
    }

    drawFlame(ctx, x, top, s, seed) {
        const t = this.frame;
        const sway = (Math.sin(t * 0.18 + seed) * 1.2 + (Math.random() - 0.5) * 0.6) * s;
        const fh = (7 + Math.sin(t * 0.27 + seed) * 1.2) * s;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const halo = ctx.createRadialGradient(x, top - fh * 0.5, 0, x, top - fh * 0.5, 14 * s);
        halo.addColorStop(0, "rgba(255, 170, 80, 0.35)");
        halo.addColorStop(1, "rgba(255, 120, 40, 0)");
        ctx.fillStyle = halo;
        ctx.fillRect(x - 14 * s, top - fh * 0.5 - 14 * s, 28 * s, 28 * s);
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = "rgba(255, 150, 50, 0.9)";
        ctx.beginPath();
        ctx.moveTo(x - 2.3 * s, top);
        ctx.quadraticCurveTo(x - 2.5 * s, top - fh * 0.6, x + sway, top - fh);
        ctx.quadraticCurveTo(x + 2.5 * s, top - fh * 0.6, x + 2.3 * s, top);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255, 244, 210, 0.95)";
        ctx.beginPath();
        ctx.ellipse(x + sway * 0.3, top - 2 * s, 0.9 * s, 2.1 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Wrought-iron candelabrum: tripod foot, twisted stem, three cups
    drawCandle(ctx, c) {
        const k = depthScale(c.y);
        const seed = c.x * 0.37;
        const x = c.x, y = c.y;
        const H = 54 * k;
        ctx.save();
        this.drawGroundShadow(ctx, x, y + 1, 16 * k, 5 * k, 0.6);
        ctx.strokeStyle = "#0f0d0c";
        ctx.lineCap = "round";
        // Tripod feet
        ctx.lineWidth = 2.4 * k;
        for (const dx of [-9, 0, 9]) {
            ctx.beginPath();
            ctx.moveTo(x, y - 7 * k);
            ctx.quadraticCurveTo(x + dx * 0.6 * k, y - 2 * k, x + dx * k, y + (dx === 0 ? 2 : 0) * k);
            ctx.stroke();
        }
        // Stem with knots
        ctx.lineWidth = 2.6 * k;
        ctx.beginPath();
        ctx.moveTo(x, y - 6 * k);
        ctx.lineTo(x, y - H);
        ctx.stroke();
        ctx.fillStyle = "#151210";
        for (const t of [0.35, 0.7]) {
            ctx.beginPath();
            ctx.ellipse(x, y - H * t, 3 * k, 2 * k, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        // Arms
        ctx.lineWidth = 2 * k;
        ctx.beginPath();
        ctx.moveTo(x - 15 * k, y - H + 9 * k);
        ctx.quadraticCurveTo(x - 15 * k, y - H + 1 * k, x, y - H + 3 * k);
        ctx.quadraticCurveTo(x + 15 * k, y - H + 1 * k, x + 15 * k, y - H + 9 * k);
        ctx.stroke();
        // Highlight along the iron
        ctx.strokeStyle = "rgba(190, 150, 110, 0.25)";
        ctx.lineWidth = 0.8 * k;
        ctx.beginPath();
        ctx.moveTo(x - 0.8 * k, y - 6 * k);
        ctx.lineTo(x - 0.8 * k, y - H);
        ctx.stroke();
        // Cups, candles, flames
        const cups = [[-15, 9, 13], [0, -2, 18], [15, 9, 11]];
        for (const [dx, dy, ch] of cups) {
            const cx = x + dx * k, cy = y - H + dy * k;
            ctx.fillStyle = "#151210";
            ctx.beginPath();
            ctx.ellipse(cx, cy, 4.5 * k, 1.8 * k, 0, 0, Math.PI * 2);
            ctx.fill();
            const g = ctx.createLinearGradient(cx - 2.4 * k, 0, cx + 2.4 * k, 0);
            g.addColorStop(0, "#6f6250");
            g.addColorStop(0.45, "#ddd0ae");
            g.addColorStop(1, "#5c5142");
            ctx.fillStyle = g;
            ctx.fillRect(cx - 2.4 * k, cy - ch * k, 4.8 * k, ch * k);
            ctx.fillStyle = "#d4c7a4";
            ctx.fillRect(cx - 2.4 * k, cy - ch * k, 1.3 * k, (3 + (Math.sin(seed + dx) + 1) * 2.5) * k);
            ctx.fillStyle = "#120a06";
            ctx.fillRect(cx - 0.4 * k, cy - ch * k - 2.5 * k, 0.8 * k, 2.5 * k);
            this.drawFlame(ctx, cx, cy - ch * k - 2.5 * k, k, seed + dx);
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
        if (obs.label === "The Monolith") this.drawMonolith(ctx, obs, engine);
    }

    // A painted furniture sprite; it thins to a ghost when the player walks
    // behind it so they are never lost, and its candles burn on top.
    drawProp(ctx, pr, engine) {
        const p = engine.player;
        let behind = false;
        if (p && p.y < pr.sortY && p.y > pr.y) {
            const k = depthScale(p.y);
            behind = propCovers(pr, [[p.x, p.y - 6 * k], [p.x, p.y - 30 * k], [p.x - 9 * k, p.y - 44 * k], [p.x + 9 * k, p.y - 44 * k], [p.x, p.y - 62 * k]]);
        }
        pr.alpha = (pr.alpha ?? 1) + ((behind ? 0.5 : 1) - (pr.alpha ?? 1)) * 0.15;
        ctx.save();
        ctx.globalAlpha = pr.alpha;
        ctx.drawImage(pr.canvas, pr.x, pr.y, pr.w, pr.h);
        ctx.restore();
        for (const f of pr.flames) {
            this.drawFlame(ctx, f.x, f.y, f.s * 0.8, f.x * 0.31 + f.y);
        }
    }

    // The Monolith (painted in fixtures.js): its glyphs ignite row by row,
    // its cracks bleed light and its eye opens as Observation rises.
    drawMonolith(ctx, obs, engine) {
        const spr = this.fixtures && this.fixtures.monolith;
        if (!spr) return;
        const o = Math.min(100, engine.player.profile.observation) / 100;
        const m = spr.meta, t = this.frame;
        const pool = ctx.createRadialGradient(m.pool.x, m.pool.y, 4, m.pool.x, m.pool.y, 130);
        pool.addColorStop(0, `rgba(150, 18, 12, ${0.16 + o * 0.34})`);
        pool.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = pool;
        ctx.beginPath();
        ctx.ellipse(m.pool.x, m.pool.y, 130, 44, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.globalAlpha = this.ghostAlpha(obs, spr, engine, spr.ax, spr.ay, 1);
        ctx.drawImage(spr.canvas, spr.x, spr.y, spr.w, spr.h);
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const flicker = 0.85 + Math.sin(t * 0.13) * 0.08 + Math.random() * 0.07;
        const layer = (L, a) => {
            ctx.globalAlpha = Math.max(0, Math.min(1, a));
            ctx.drawImage(L.canvas, L.x, L.y, L.w, L.h);
        };
        for (const L of m.glyphGlow) {
            const lit = Math.max(0, Math.min(1, o * (m.glyphRows + 1.5) - L.row));
            layer(L, (0.08 + lit * 0.88) * flicker);
        }
        layer(m.crackGlow, (0.04 + o * 0.6) * (0.8 + Math.sin(t * 0.05) * 0.2));
        ctx.restore();
        this.drawMonolithEye(ctx, m.eye, o, engine);
        for (const f of spr.flames) this.drawFlame(ctx, f.x, f.y, f.s * 0.8, f.x * 0.31 + f.y);
    }

    drawInteractable(ctx, intr, engine) {
        const visual = INTERACTABLE_SPRITES[intr.type];
        if (!visual) return;
        const painted = this.fixtureSprite(intr);
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
        const k = depthScale(intr.y);
        const vs = visual.scale * k;
        const state = intr.data && intr.data.state;
        if (intr.type === "sealed_zone_door" && this.fixtures) {
            this.drawDoor(ctx, intr);
        } else if (painted) {
            this.drawFixture(ctx, intr, painted, engine);
        } else if (visual.open && (state === "opening" || state === "open")) {
            this.drawGroundShadow(ctx, intr.x, intr.y + 2, 40 * vs / 0.5, 12 * k, 0.6);
            // Play the activate animation once, then hold its last frame
            const config = assetLoader.animationsMap[visual.open];
            intr.openT = (intr.openT || 0) + 1;
            const idx = config ? Math.min(config.frames - 1, Math.floor(intr.openT * (config.fps / 60))) : 0;
            assetLoader.drawFrame(ctx, visual.open, idx, intr.x, intr.y + 4, "right", vs, 1);
        } else {
            this.drawGroundShadow(ctx, intr.x, intr.y + 2, 40 * vs / 0.5, 12 * k, 0.6);
            this.drawSprite(ctx, visual.anim, intr.x, intr.y + 4, vs, 1, "right", intr.x);
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

    // ─── Painted fixtures (fixtures.js) ───────────────────────────────────
    // Fixed fixtures are drawn where they were painted; corpses are painted
    // once and moved (and rescaled for depth) to wherever the body lies.
    fixturePlacement(intr, spr) {
        const moved = Math.abs(intr.x - spr.ax) > 0.5 || Math.abs(intr.y - spr.ay) > 0.5;
        return { moved, k: moved ? depthScale(intr.y) / depthScale(spr.ay) : 1 };
    }

    fixtureSprite(intr) {
        if (!this.fixtures || intr.type === "sealed_zone_door") return null;
        if (intr.type === "wax_record_chest") {
            const frames = this.fixtures.chestFrames, st = intr.data && intr.data.state;
            if (st === "open") return frames[frames.length - 1];
            if (st === "opening") {
                const p = 1 - Math.max(0, intr.data.timer) / 45;
                return frames[Math.min(frames.length - 1, Math.floor(p * frames.length))];
            }
            return frames[0];
        }
        return this.fixtures.interactables[intr.type] || null;
    }

    // Depth-sort key: the front edge of the fixture's footprint
    intrSortY(intr) {
        const spr = this.fixtureSprite(intr);
        if (!spr) return intr.y;
        return intr.y + (spr.sortY - spr.ay) * this.fixturePlacement(intr, spr).k;
    }

    // World position of a point recorded on a fixture sprite, for this interactable
    fixturePoint(intr, spr, pt) {
        const { k } = this.fixturePlacement(intr, spr);
        return { x: intr.x + (pt.x - spr.ax) * k, y: intr.y + (pt.y - spr.ay) * k };
    }

    // Floor layers that never move (props, fixed fixtures), baked into the room
    staticFloors() {
        const list = this.props.map(pr => pr);
        if (this.fixtures) {
            list.push(this.fixtures.monolith);
            for (const [type, spr] of Object.entries(this.fixtures.interactables)) {
                if (type === "wax_record_chest" || CORPSE_TYPES.has(type)) continue;
                list.push(spr);
            }
            list.push(this.fixtures.chestFrames[0]);
        }
        return list;
    }

    // Floor layers of moved fixtures (corpses)
    drawFixtureFloors(ctx, engine) {
        for (const intr of engine.interactables) {
            const spr = this.fixtureSprite(intr);
            if (!spr) continue;
            const { k, moved } = this.fixturePlacement(intr, spr);
            if (!moved) continue;
            const f = spr.floorRect;
            ctx.save();
            ctx.translate(intr.x, intr.y);
            ctx.scale(k, k);
            ctx.translate(-spr.ax, -spr.ay);
            ctx.drawImage(spr.floorCanvas, f.x, f.y, f.w, f.h);
            ctx.restore();
        }
    }

    // Fade a sprite while it actually covers the player. (ox, oy, k) place the
    // sprite: world = o + (sprite - anchor) * k.
    ghostAlpha(holder, spr, engine, ox, oy, k = 1) {
        const p = engine.player;
        let behind = false;
        if (p) {
            const lx = (p.x - ox) / k + spr.ax, ly = (p.y - oy) / k + spr.ay;
            if (ly < spr.sortY && ly > spr.y) {
                const s = depthScale(p.y) / k;
                behind = propCovers(spr, [[lx, ly - 6 * s], [lx, ly - 30 * s], [lx - 9 * s, ly - 44 * s], [lx + 9 * s, ly - 44 * s], [lx, ly - 62 * s]]);
            }
        }
        holder.ghost = (holder.ghost ?? 1) + ((behind ? 0.5 : 1) - (holder.ghost ?? 1)) * 0.15;
        return holder.ghost;
    }

    drawFixture(ctx, intr, spr, engine) {
        const { k } = this.fixturePlacement(intr, spr);
        const alpha = this.ghostAlpha(intr, spr, engine, intr.x, intr.y, k);
        ctx.save();
        ctx.translate(intr.x, intr.y);
        ctx.scale(k, k);
        ctx.translate(-spr.ax, -spr.ay);
        ctx.globalAlpha = alpha;
        const art = this.corpseArt && this.corpseArt[intr.type];
        if (art) {
            // Rendered body: centred on the corpse, its lowest pixels resting on the floor
            const w = CORPSE_ART_LENGTH, h = w * art.height / art.width;
            ctx.drawImage(art, spr.ax - w / 2, spr.ay + 8 - h, w, h);
            ctx.globalAlpha = 1;
            this.drawFixtureLife(ctx, intr, { ...spr, flames: [], meta: { embers: spr.meta.embers } });
        } else {
            ctx.drawImage(spr.canvas, spr.x, spr.y, spr.w, spr.h);
            ctx.globalAlpha = 1;
            this.drawFixtureLife(ctx, intr, spr);
        }
        ctx.restore();
    }

    // The living parts of a fixture: flames, static, embers and glows
    drawFixtureLife(ctx, intr, spr) {
        const m = spr.meta, t = this.frame;
        for (const f of spr.flames) this.drawFlame(ctx, f.x, f.y, f.s * 0.8, f.x * 0.31 + f.y);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const glow = (x, y, r, [cr, cg, cb], a) => {
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${Math.max(0, a)})`);
            g.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        };
        if (m.dial) glow(m.dial.x, m.dial.y, 8, [255, 190, 110], 0.55 + Math.sin(t * 0.3) * 0.15 + Math.random() * 0.1);
        if (m.crown) glow(m.crown.x, m.crown.y, 18, [150, 190, 255], 0.22 + Math.random() * 0.2);
        if (m.spikes && Math.random() < 0.35) {
            const a = m.spikes[Math.floor(Math.random() * m.spikes.length)];
            const b = Math.random() < 0.5 ? m.crown : m.spikes[Math.floor(Math.random() * m.spikes.length)];
            if (a !== b) this.drawStatic(ctx, a, b);
        }
        if (m.coil && Math.random() < 0.05) {
            const y = m.coil.y0 + Math.random() * (m.coil.y1 - m.coil.y0);
            this.drawStatic(ctx, { x: m.coil.x - 7, y }, { x: m.coil.x - 15 - Math.random() * 8, y: y + (Math.random() - 0.5) * 10 });
        }
        if (m.lantern) glow(m.lantern.x, m.lantern.y, 28, [255, 170, 80], 0.45 + Math.sin(t * 0.2) * 0.06 + Math.random() * 0.06);
        if (m.glowAt && intr.type === "blood_ritual_altar") glow(m.glowAt.x, m.glowAt.y, 34, [200, 30, 16], 0.2 + Math.sin(t * 0.05) * 0.08);
        if (m.glowAt && intr.type === "wax_record_chest") glow(m.glowAt.x, m.glowAt.y, 28, [255, 200, 120], 0.35 + Math.sin(t * 0.08) * 0.1);
        if (m.embers) {
            for (const e of m.embers) glow(e.x, e.y, 4.5, [255, 120, 40], (0.5 + Math.sin(t * 0.1 + e.x) * 0.3 + Math.random() * 0.2) * 0.7);
        }
        if (m.eyes) for (const e of m.eyes) glow(e.x, e.y, 3, [255, 90, 30], 0.4 + Math.random() * 0.2);
        if (m.mark) glow(m.mark.x, m.mark.y, 11, [190, 20, 14], 0.22 + Math.sin(t * 0.06) * 0.12);
        if (m.beacon && Math.floor(t / 20) % 3 === 0) glow(m.beacon.x, m.beacon.y, 8, [255, 40, 30], 0.9);
        // A dead phone's screen, still waking now and then
        if (m.phone) glow(m.phone.x, m.phone.y, 12, [150, 185, 255], (t + m.phone.x * 7) % 300 < 200 ? 0.45 + Math.random() * 0.08 : 0.08);
        ctx.restore();
    }

    // A jagged blue-white thread of static between two points
    drawStatic(ctx, a, b) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        for (let i = 1; i < 5; i++) {
            const f = i / 5;
            ctx.lineTo(a.x + (b.x - a.x) * f + (Math.random() - 0.5) * 6, a.y + (b.y - a.y) * f + (Math.random() - 0.5) * 6);
        }
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = "rgba(120, 160, 255, 0.3)";
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.strokeStyle = "rgba(200, 220, 255, 0.9)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.restore();
    }

    // The sealed door: shut under seal and chains; when it opens the seal
    // shudders, the chains drop and the leaves swing in on the stair beyond
    drawDoor(ctx, intr) {
        const d = this.fixtures.door, st = intr.data.state, t = this.frame, A = d.arch;
        const p = st === "open" ? 1 : st === "opening" ? 1 - Math.max(0, intr.data.timer) / 60 : 0;
        const swing = Math.max(0, Math.min(1, (p - 0.3) / 0.7));
        if (swing > 0) ctx.drawImage(d.beyond.canvas, d.beyond.x, d.beyond.y, d.beyond.w, d.beyond.h);
        const open = Math.cos(swing * 1.35);
        for (const [leaf, side] of [[d.left, -1], [d.right, 1]]) {
            const w = leaf.w * open;
            ctx.drawImage(leaf.canvas, side < 0 ? leaf.x : leaf.x + leaf.w - w, leaf.y, w, leaf.h);
        }
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        // Red light leaking under the door and through the meeting stiles
        const leak = 0.3 + Math.sin(t * 0.07) * 0.12 + p * 0.5;
        const under = ctx.createLinearGradient(0, A.bottom - 7, 0, A.bottom);
        under.addColorStop(0, "rgba(220, 40, 20, 0)");
        under.addColorStop(1, `rgba(220, 40, 20, ${Math.min(0.8, leak)})`);
        ctx.fillStyle = under;
        ctx.fillRect(A.x0 + 2, A.bottom - 7, A.x1 - A.x0 - 4, 7);
        if (swing === 0) {
            ctx.fillStyle = `rgba(220, 40, 20, ${0.12 + p * 0.6})`;
            ctx.fillRect(d.cx - 0.6, A.apex + 20, 1.2, A.bottom - A.apex - 20);
        }
        ctx.restore();
        if (p < 0.55) {
            const drop = Math.max(0, p - 0.3) / 0.25;
            const shake = st === "opening" && p < 0.3 ? (Math.random() - 0.5) * 2.6 : 0;
            ctx.save();
            ctx.globalAlpha = 1 - drop;
            ctx.drawImage(d.seal.canvas, d.seal.x + shake, d.seal.y + drop * drop * 70, d.seal.w, d.seal.h);
            if (st === "opening") {
                ctx.globalCompositeOperation = "lighter";
                const g = ctx.createRadialGradient(d.seal.sealX, d.seal.sealY, 0, d.seal.sealX, d.seal.sealY, 30);
                g.addColorStop(0, `rgba(255, 90, 40, ${0.6 * (1 - drop)})`);
                g.addColorStop(1, "rgba(255, 90, 40, 0)");
                ctx.fillStyle = g;
                ctx.fillRect(d.seal.sealX - 30, d.seal.sealY - 30, 60, 60);
            }
            ctx.restore();
        }
    }

    drawMonolithEye(ctx, e, o, engine) {
        const t = this.frame;
        const blink = t % 480 < 7 ? 0.15 : 1;
        const h = e.rh * (0.12 + o * 0.88) * blink;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(e.x - e.rw, e.y);
        ctx.quadraticCurveTo(e.x, e.y - h * 2, e.x + e.rw, e.y);
        ctx.quadraticCurveTo(e.x, e.y + h * 2, e.x - e.rw, e.y);
        ctx.closePath();
        const sc = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.rw);
        sc.addColorStop(0, "#6a120c");
        sc.addColorStop(1, "#160303");
        ctx.fillStyle = sc;
        ctx.fill();
        ctx.save();
        ctx.clip();
        // The iris follows the player across the room
        const ix = e.x + Math.max(-1, Math.min(1, (engine.player.x - e.x) / 320)) * e.rw * 0.45;
        const iy = e.y + Math.max(-1, Math.min(1, (engine.player.y - e.y) / 500)) * e.rh * 0.35;
        const ir = e.rh * 0.95;
        const iris = ctx.createRadialGradient(ix, iy, 0, ix, iy, ir);
        iris.addColorStop(0, "#ffd8a8");
        iris.addColorStop(0.35, `rgb(255, ${70 + o * 70}, 30)`);
        iris.addColorStop(1, "#4a0604");
        ctx.fillStyle = iris;
        ctx.beginPath();
        ctx.arc(ix, iy, ir, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#050000";
        ctx.beginPath();
        ctx.ellipse(ix, iy, ir * 0.16 + (1 - o) * ir * 0.1, ir * 0.82, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.globalCompositeOperation = "lighter";
        const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.rw * 2.6);
        g.addColorStop(0, `rgba(255, 60, 20, ${(0.12 + o * 0.4) * blink})`);
        g.addColorStop(1, "rgba(255, 60, 20, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(e.x - e.rw * 2.6, e.y - e.rw * 2.6, e.rw * 5.2, e.rw * 5.2);
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
            this.drawSprite(ctx, anim, l.x, l.y + bob, PICKUP_SCALE * depthScale(l.y), 1, "right", l.x);
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
        const k = depthScale(p.y);
        this.drawGroundShadow(ctx, p.x, p.y + 4, 22 * k, 7 * k, 0.6);

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
        assetLoader.drawFrame(ctx, key, idx, p.x, p.y, p.facing, 0.36 * depthScale(p.y), alpha);
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
        assetLoader.drawFrame(ctx, spec.death, idx, fx.x, fx.y + 6, fx.facing, spec.scale * depthScale(fx.y), (spec.alpha ?? 1) * fade);
        ctx.restore();
    }

    drawEnemy(ctx, e) {
        ctx.save();
        const spec = ENEMY_ART[e.type] || ENEMY_ART["Cabinet Indexer"];
        const ek = depthScale(e.y);
        this.drawGroundShadow(ctx, e.x, e.y + 2, e.radius * 1.5 * ek, Math.max(6, e.radius * 0.4) * ek, 0.6);

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

        const scale = spec.scale * depthScale(e.y);
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
            if (p.liquid) {
                // A drop in flight: its shadow on the floor, the drop drawn up at its height
                const col = p.liquid === "ink" ? "10, 10, 16" : "120, 10, 8";
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.beginPath();
                ctx.ellipse(p.x, p.y, p.size * 0.8, p.size * 0.35, 0, 0, Math.PI * 2);
                ctx.fill();
                const dx = p.vx, dy = p.vy - p.vz, len = Math.hypot(dx, dy) || 1;
                ctx.save();
                ctx.translate(p.x, p.y - p.z);
                ctx.rotate(Math.atan2(dy, dx));
                ctx.fillStyle = `rgba(${col}, 0.95)`;
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size * (1 + Math.min(1.6, len * 0.35)), p.size * 0.7, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                continue;
            }
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

    // ─── Stains: blood, ink, paper and splinters left where things bled and fell ──
    // Pressed once into a floor-sized layer that slowly fades over minutes.
    drawDecals(ctx, engine) {
        if (!this.decalLayer || this.decalEpoch !== engine.decalEpoch) {
            const sc = Math.min(1.5, this.roomTextureScale || 1);
            const c = this.decalLayer && this.decalLayer.canvas.width === Math.round(WORLD_WIDTH * sc) ? this.decalLayer.canvas : document.createElement("canvas");
            c.width = Math.round(WORLD_WIDTH * sc);
            c.height = Math.round(WORLD_HEIGHT * sc);
            this.decalLayer = { canvas: c, g: c.getContext("2d"), sc };
            this.decalEpoch = engine.decalEpoch;
        }
        const { canvas, g, sc } = this.decalLayer;
        if (engine.decals.length) {
            g.setTransform(sc, 0, 0, sc, 0, 0);
            for (const d of engine.decals) this.stampDecal(g, d);
            engine.decals.length = 0;
        }
        if (this.frame % 240 === 0) {
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.globalCompositeOperation = "destination-out";
            g.fillStyle = "rgba(0, 0, 0, 0.035)";
            g.fillRect(0, 0, canvas.width, canvas.height);
            g.globalCompositeOperation = "source-over";
        }
        // Only the part of the layer the camera sees
        const vx = Math.max(0, this.camera.x), vy = Math.max(0, this.camera.y);
        const vw = Math.min(WORLD_WIDTH - vx, this.viewW + 2), vh = Math.min(WORLD_HEIGHT - vy, this.viewH + 2);
        if (vw > 0 && vh > 0) ctx.drawImage(canvas, vx * sc, vy * sc, vw * sc, vh * sc, vx, vy, vw, vh);
    }

    stampDecal(g, d) {
        const k = depthScale(d.y);
        const blob = (x, y, rx, ry, fill, jag = 0.35) => {
            const n = 14, pts = [];
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2, f = 1 - jag / 2 + Math.random() * jag;
                pts.push([x + Math.cos(a) * rx * f, y + Math.sin(a) * ry * f]);
            }
            g.beginPath();
            g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
            for (let i = 0; i < n; i++) {
                const a = pts[i], b = pts[(i + 1) % n];
                g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
            }
            g.fillStyle = fill;
            g.fill();
        };
        const tone = d.liquid === "ink" ? ["rgba(6, 6, 12, 0.82)", "rgba(2, 2, 6, 0.6)", "rgba(120, 130, 170, 0.12)"]
            : ["rgba(92, 8, 6, 0.78)", "rgba(40, 3, 2, 0.6)", "rgba(255, 170, 150, 0.1)"];
        if (d.kind === "drop") {
            const r = d.r * k * (0.6 + Math.random() * 0.8);
            g.globalAlpha = 0.45 + Math.random() * 0.45;
            const a = Math.atan2(d.vy, d.vx), sp = Math.hypot(d.vx, d.vy);
            if (sp > 1.2 && Math.random() < 0.5) {
                // Smeared where it landed moving: a tapering streak
                g.save();
                g.translate(d.x, d.y);
                g.scale(1, 0.5);
                g.rotate(a);
                g.fillStyle = tone[0];
                g.beginPath();
                g.moveTo(-r, -r * 0.6);
                g.quadraticCurveTo(r * (2 + sp), 0, -r, r * 0.6);
                g.closePath();
                g.fill();
                g.restore();
            } else {
                blob(d.x, d.y, r, r * 0.5, tone[0], 0.5);
            }
            g.globalAlpha = 1;
            return;
        }
        const R = d.r * k;
        if (d.liquid === "paper") {
            for (let i = 0; i < 12; i++) {
                const a = Math.random() * Math.PI * 2, dist = Math.random() * R * 1.4;
                const x = d.x + Math.cos(a) * dist, y = d.y + Math.sin(a) * dist * 0.45;
                g.save();
                g.translate(x, y);
                g.rotate(Math.random() * Math.PI);
                g.scale(1, 0.5);
                const t = 170 + Math.random() * 50, w = (3 + Math.random() * 5) * k, h = (2 + Math.random() * 4) * k;
                g.fillStyle = `rgba(${t}, ${t * 0.92}, ${t * 0.74}, 0.9)`;
                g.fillRect(-w / 2, -h / 2, w, h);
                g.strokeStyle = "rgba(10, 6, 4, 0.5)";
                g.lineWidth = 0.5;
                g.strokeRect(-w / 2, -h / 2, w, h);
                g.restore();
            }
            return;
        }
        if (d.liquid === "splinters") {
            g.lineCap = "round";
            for (let i = 0; i < 10; i++) {
                const a = Math.random() * Math.PI * 2, dist = Math.random() * R * 1.3;
                const x = d.x + Math.cos(a) * dist, y = d.y + Math.sin(a) * dist * 0.45, l = (3 + Math.random() * 7) * k, b = Math.random() * Math.PI;
                g.strokeStyle = `rgba(${70 + Math.random() * 30}, ${46 + Math.random() * 20}, 26, 0.9)`;
                g.lineWidth = 1 + Math.random() * 1.2;
                g.beginPath();
                g.moveTo(x, y);
                g.lineTo(x + Math.cos(b) * l, y + Math.sin(b) * l * 0.45);
                g.stroke();
            }
            g.lineCap = "butt";
            blob(d.x, d.y, R * 0.5, R * 0.22, tone[0]);
            return;
        }
        // A pool with a darker rim, splash streaks and thrown droplets
        blob(d.x, d.y, R * 1.08, R * 0.5, tone[1]);
        blob(d.x, d.y, R, R * 0.45, tone[0]);
        for (let i = 0; i < 9; i++) {
            const a = Math.random() * Math.PI * 2, dist = R * (0.9 + Math.random() * 0.9);
            const x = d.x + Math.cos(a) * dist, y = d.y + Math.sin(a) * dist * 0.45;
            g.strokeStyle = tone[0];
            g.lineWidth = (0.8 + Math.random() * 1.6) * k;
            g.beginPath();
            g.moveTo(d.x + Math.cos(a) * R * 0.7, d.y + Math.sin(a) * R * 0.32);
            g.lineTo(x, y);
            g.stroke();
            blob(x, y, (1 + Math.random() * 2) * k, (0.6 + Math.random()) * k, tone[0]);
        }
        blob(d.x - R * 0.25, d.y - R * 0.12, R * 0.35, R * 0.1, tone[2], 0.2);
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
            if (c.kind === "sconce") {
                const sc = c.scale || 1;
                lights.push({ x: c.x, y: c.y - 22 * sc, r: 230 * c.intensity * f * sc, color: [255, 165, 90], a: 0.8 * f });
            } else {
                lights.push({ x: c.x, y: c.y - 50 * depthScale(c.y), r: 165 * c.intensity * f, color: [255, 170, 95], a: 0.85 * f });
            }
        }
        for (const pr of this.props) {
            for (const fl of pr.flames) {
                if (!this.inView(fl.x - 110, fl.y - 110, 220, 220)) continue;
                const f = 1 + Math.sin(t * 0.23 + fl.x) * 0.06 + (Math.random() - 0.5) * 0.08;
                lights.push({ x: fl.x, y: fl.y - 4, r: 105 * f, color: [255, 172, 96], a: 0.62 * f });
            }
        }
        for (const sh of MOON_SHAFTS) {
            lights.push({ x: sh.floor.x, y: sh.floor.y, r: sh.w1 * 1.1, color: [140, 160, 205], a: 0.55 });
        }
        for (const gl of ROOM.glows || []) {
            const pulse = 0.85 + Math.sin(t * 0.04) * 0.15;
            lights.push({ x: gl.x, y: gl.y, r: gl.r, color: gl.color, a: gl.a * pulse });
        }
        for (const intr of engine.interactables) {
            const v = INTERACTABLE_SPRITES[intr.type];
            if (v && v.light) {
                const pulse = 0.85 + Math.sin(t * 0.05 + intr.x) * 0.15;
                const spr = this.fixtureSprite(intr), m = spr && spr.meta;
                const src = m && (m.lightAt || m.lantern || m.glowAt);
                const at = src ? this.fixturePoint(intr, spr, src) : { x: intr.x, y: intr.y - 30 };
                lights.push({ x: at.x, y: at.y, r: 130, color: hexRgb(v.light), a: 0.7 * pulse });
            }
            if (intr.type === "sealed_zone_door") {
                // The seal smoulders while the door is shut; the stair beyond floods red once open
                if (intr.data.state === "open") lights.push({ x: intr.x, y: intr.y - 60, r: 220, color: [220, 40, 24], a: 0.9 });
                else lights.push({ x: intr.x, y: 190, r: 125, color: [210, 60, 34], a: 0.5 + Math.sin(t * 0.06) * 0.1 });
            }
            const cs = CORPSE_TYPES.has(intr.type) && this.fixtureSprite(intr);
            if (cs && cs.meta.phone && (t + cs.meta.phone.x * 7) % 300 < 200) {
                lights.push({ ...this.fixturePoint(intr, cs, cs.meta.phone), r: 55, color: [150, 185, 255], a: 0.5 });
            }
            if (intr.type === "wax_record_chest" && intr.data.state !== "closed") {
                const spr = this.fixtureSprite(intr);
                if (spr && spr.meta.glowAt) lights.push({ ...this.fixturePoint(intr, spr, spr.meta.glowAt), r: 110, color: [255, 200, 120], a: 0.6 });
            }
        }
        const mono = engine.obstacles.find(o => o.label === "The Monolith");
        if (mono) {
            const o = Math.min(100, p.profile.observation) / 100;
            lights.push({ x: mono.x, y: mono.y - 40, r: 80 + o * 110, color: [220, 30, 18], a: 0.25 + o * 0.5 });
            const eye = this.fixtures && this.fixtures.monolith.meta.eye;
            if (eye) lights.push({ x: eye.x, y: eye.y, r: 40 + o * 90, color: [255, 60, 24], a: 0.2 + o * 0.6 });
            for (const fl of this.fixtures ? this.fixtures.monolith.flames : []) {
                if (this.inView(fl.x - 90, fl.y - 90, 180, 180)) lights.push({ x: fl.x, y: fl.y - 4, r: 90, color: [255, 172, 96], a: 0.5 });
            }
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

    // Cold light falling from a slit high in the dark, with dust turning in it.
    // Each shaft is pre-rendered once with a heavy blur so its edges are soft.
    buildShaft(sh) {
        const pad = 60;
        const minX = Math.min(sh.top.x - sh.w0, sh.floor.x - sh.w1) - pad;
        const maxX = Math.max(sh.top.x + sh.w0, sh.floor.x + sh.w1) + pad;
        const minY = sh.top.y - pad, maxY = sh.floor.y + sh.w1 * 0.4 + pad;
        const c = document.createElement("canvas");
        c.width = Math.ceil(maxX - minX);
        c.height = Math.ceil(maxY - minY);
        const g = c.getContext("2d");
        g.translate(-minX, -minY);
        g.filter = "blur(14px)";
        const grad = g.createLinearGradient(sh.top.x, sh.top.y, sh.floor.x, sh.floor.y);
        grad.addColorStop(0, "rgba(150, 170, 210, 0)");
        grad.addColorStop(0.3, "rgba(150, 170, 210, 0.35)");
        grad.addColorStop(1, "rgba(175, 190, 225, 0.75)");
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(sh.top.x - sh.w0 / 2, sh.top.y);
        g.lineTo(sh.top.x + sh.w0 / 2, sh.top.y);
        g.lineTo(sh.floor.x + sh.w1 / 2, sh.floor.y);
        g.lineTo(sh.floor.x - sh.w1 / 2, sh.floor.y);
        g.closePath();
        g.fill();
        // Pool where it lands
        g.fillStyle = "rgba(175, 190, 225, 0.8)";
        g.beginPath();
        g.ellipse(sh.floor.x, sh.floor.y, sh.w1 * 0.6, sh.w1 * 0.2, 0, 0, Math.PI * 2);
        g.fill();
        return { canvas: c, x: minX, y: minY };
    }

    drawMoonShafts(ctx) {
        if (!this.shafts) this.shafts = MOON_SHAFTS.map(sh => this.buildShaft(sh));
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        MOON_SHAFTS.forEach((sh, i) => {
            const breathe = 0.85 + Math.sin(this.frame * 0.01 + sh.floor.x) * 0.15;
            const img = this.shafts[i];
            ctx.globalAlpha = 0.16 * breathe;
            ctx.drawImage(img.canvas, img.x, img.y);
            ctx.globalAlpha = 1;
            // Motes
            for (let m = 0; m < 26; m++) {
                const t = ((m * 0.137 + this.frame * 0.0006 * (1 + (m % 3))) % 1);
                const lx = sh.top.x + (sh.floor.x - sh.top.x) * t;
                const ly = sh.top.y + (sh.floor.y - sh.top.y) * t;
                const half = (sh.w0 + (sh.w1 - sh.w0) * t) / 2;
                const ox = Math.sin(m * 12.9 + this.frame * 0.01) * half * 0.7;
                ctx.fillStyle = `rgba(220, 225, 240, ${0.35 * Math.sin(t * Math.PI)})`;
                ctx.fillRect(lx + ox, ly, 1.3, 1.3);
            }
        });
        ctx.restore();
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

    // Chains hanging in front of the scene, moving faster than the room
    // (parallax) so the space reads as deep. Kept dark and to the edges.
    drawForeground(ctx, w, h) {
        const par = 1.35;
        const cxw = this.camera.x + this.viewW / 2;
        ctx.save();
        for (const ch of FOREGROUND_CHAINS) {
            const sx = w / 2 + (ch.x - cxw) * this.zoom * par;
            if (sx < -60 || sx > w + 60) continue;
            const len = ch.len * this.zoom;
            const sway = Math.sin(this.frame * 0.012 + ch.x) * 6;
            const link = 13 * this.zoom * 0.9;
            for (let y = -10, i = 0; y < len; y += link * 0.82, i++) {
                const t = y / len;
                const x = sx + sway * t * t;
                ctx.strokeStyle = "rgba(4, 3, 3, 0.96)";
                ctx.lineWidth = 3.4 * this.zoom * 0.8;
                ctx.beginPath();
                if (i % 2 === 0) ctx.ellipse(x, y, link * 0.32, link * 0.55, 0, 0, Math.PI * 2);
                else ctx.ellipse(x, y, link * 0.1, link * 0.55, 0, 0, Math.PI * 2);
                ctx.stroke();
                // Faint rim light from the room
                ctx.strokeStyle = "rgba(180, 110, 60, 0.12)";
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            if (ch.hook) {
                const x = sx + sway;
                ctx.strokeStyle = "rgba(4, 3, 3, 0.96)";
                ctx.lineWidth = 4 * this.zoom * 0.8;
                ctx.beginPath();
                ctx.arc(x + 6 * this.zoom, len + 6 * this.zoom, 9 * this.zoom, Math.PI * 1.1, Math.PI * 0.4, true);
                ctx.stroke();
            }
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
