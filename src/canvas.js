// Canvas Graphics Renderer with sprite-led room dressing, VFX, lighting, and HUD prompts.
import { assetLoader } from "./assets.js";

const NEW_PICKUP_SPRITES = {
    loot_satchel: "debt_coin.idle",
    sanity_shard: "black_ink_vial.idle",
    signal_fragment: "folded_witness_note.idle",
    cursed_gear_drop: "sealed_name_tag.idle",
    memory_fragment: "impossible_key.idle"
};

const INTERACTABLE_SPRITES = {
    blood_ritual_altar: { anim: "receipt_spike_altar.idle", scale: 0.43, glow: "rgba(176, 25, 25, 0.44)", label: "SIGN" },
    static_signal_pylon: { anim: "many_handed_clock.idle", scale: 0.42, glow: "rgba(88, 151, 112, 0.36)", label: "TUNE" },
    corpse_lantern_shrine: { anim: "paper_root_growth.idle", scale: 0.46, glow: "rgba(207, 184, 101, 0.34)", label: "FILE" },
    wax_record_chest: { anim: "tiny_chained_book.idle", scale: 0.44, glow: "rgba(184, 31, 31, 0.28)", label: "OPEN" },
    sealed_zone_door: { anim: "wax_sealed_door.idle", scale: 0.58, glow: "rgba(189, 41, 34, 0.32)", label: "EXIT" }
};

export class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.screenShake = 0;
        this.frame = 0;
        this.candles = [
            { x: 96, y: 150, intensity: 0.9 },
            { x: 660, y: 154, intensity: 0.9 },
            { x: 372, y: 246, intensity: 1.15 },
            { x: 206, y: 334, intensity: 0.75 },
            { x: 630, y: 324, intensity: 0.75 }
        ];
    }

    triggerShake(amount) {
        this.screenShake = Math.max(this.screenShake, amount);
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
        this.levelUpBannerTimer = 180;
        this.levelUpLevel = level;
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
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.save();
        if (this.screenShake > 0) {
            const dx = (Math.random() - 0.5) * this.screenShake;
            const dy = (Math.random() - 0.5) * this.screenShake;
            ctx.translate(dx, dy);
            this.screenShake *= 0.9;
            if (this.screenShake < 0.2) this.screenShake = 0;
        }

        this.drawRoomBackdrop(ctx, w, h);
        this.drawObstacles(ctx, engine);
        this.drawInteractables(ctx, engine);
        this.drawLoot(ctx, engine);

        const entities = [];
        if (engine.player && engine.player.health > 0) {
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
        this.drawFloatingTexts(ctx, engine);
        this.drawMonolithRunes(ctx, engine);
        this.drawLightingPass(ctx, w, h, engine);
        this.drawCanvasUI(ctx, w, h, engine);
        this.applyGlitchShader(ctx, w, h, engine);

        ctx.restore();
    }

    drawRoomBackdrop(ctx, w, h) {
        const wallGrad = ctx.createLinearGradient(0, 0, 0, h);
        wallGrad.addColorStop(0, "#050405");
        wallGrad.addColorStop(0.42, "#11100d");
        wallGrad.addColorStop(0.43, "#15110e");
        wallGrad.addColorStop(1, "#090806");
        ctx.fillStyle = wallGrad;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "rgba(115, 77, 45, 0.12)";
        for (let y = 34; y < 180; y += 28) {
            ctx.fillRect(0, y, w, 1);
        }

        for (let x = -10; x < w + 100; x += 126) {
            this.drawSprite(ctx, "record_shelf_wall.idle", x + 70, 194, 0.54, 0.98, "right", x);
        }

        this.drawSprite(ctx, "ink_wall_stain.idle", 384, 190, 0.44, 0.82);
        this.drawSprite(ctx, "red_string_evidence_board.idle", 152, 203, 0.39, 0.92);
        this.drawSprite(ctx, "brass_nameplate_cluster.idle", 594, 205, 0.39, 0.94);

        const floorGrad = ctx.createLinearGradient(0, 170, 0, h);
        floorGrad.addColorStop(0, "rgba(45, 35, 24, 0.42)");
        floorGrad.addColorStop(0.45, "rgba(31, 26, 19, 0.92)");
        floorGrad.addColorStop(1, "rgba(9, 8, 6, 1)");
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, 170, w, h - 170);

        for (let y = 285; y < h + 120; y += 92) {
            for (let x = -42; x < w + 140; x += 112) {
                this.drawSprite(ctx, "cracked_archive_floor.idle", x, y, 0.58, 0.88, "right", x + y);
            }
        }

        ctx.fillStyle = "rgba(0, 0, 0, 0.26)";
        ctx.fillRect(0, 170, w, 18);
        this.drawSprite(ctx, "paper_root_growth.idle", 78, 422, 0.42, 0.5, "right", 9);
        this.drawSprite(ctx, "wax_seal_growth.idle", 694, 418, 0.38, 0.5, "right", 31);
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

    drawLoot(ctx, engine) {
        for (const l of engine.loot) {
            ctx.save();
            const hoverY = Math.sin(this.frame * 0.08 + l.x) * 3;
            const anim = NEW_PICKUP_SPRITES[l.id] || `${l.id}.idle`;
            this.drawGroundShadow(ctx, l.x, l.y + 9, 12, 5, 0.28);
            this.drawSprite(ctx, anim, l.x, l.y + hoverY, 0.28, 1, "right", l.x);
            ctx.restore();
        }
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
            idx = loop ? Math.floor(this.frame * (config.fps / 60)) % config.frames : Math.min(config.frames - 1, Math.floor(elapsed * (config.fps / 60)));
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
            idx = oneShot ? Math.min(config.frames - 1, Math.floor(elapsed * (config.fps / 60))) : Math.floor(this.frame * (config.fps / 60)) % config.frames;
        }

        const scale = e.type === "Seal Mother" ? 0.7 : e.type === "Witness Chair" ? 0.45 : e.type === "Paper Wraith" ? 0.43 : 0.4;
        const alpha = e.type === "The Shape" ? 0.55 : e.type === "Paper Wraith" ? 0.94 : 1;

        if (e.type === "The Shape" || e.type === "Paper Wraith") {
            ctx.shadowColor = e.type === "The Shape" ? "#7b438f" : "#162015";
            ctx.shadowBlur = 12;
        }

        assetLoader.drawFrame(ctx, key, idx, e.x, e.y, facing, scale, alpha);
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

    drawLightingPass(ctx, w, h, engine) {
        ctx.save();
        const sanityFactor = engine.player.sanity / 100;
        const darkness = 0.62 - sanityFactor * 0.18;

        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = `rgba(13, 10, 10, ${darkness})`;
        ctx.fillRect(0, 0, w, h);

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
        if (sanityFactor < 0.15) {
            // Sanity broken vignette
            const vignette = ctx.createRadialGradient(w/2, h/2, h/4, w/2, h/2, h);
            vignette.addColorStop(0, "rgba(0,0,0,0)");
            vignette.addColorStop(1, "rgba(20, 0, 5, 0.95)");
            ctx.fillStyle = vignette;
            ctx.fillRect(0, 0, w, h);
            
            // Jitter / distort
            ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
        }

        const vignette = ctx.createRadialGradient(w / 2, h / 2, 120, w / 2, h / 2, 420);
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, "rgba(0,0,0,0.42)");
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);

        ctx.globalAlpha = 0.07;
        ctx.fillStyle = "#f1e2b7";
        for (let i = 0; i < 34; i++) {
            const x = (i * 97 + this.frame * 0.4) % w;
            const y = (i * 53 + this.frame * 0.13) % h;
            ctx.fillRect(x, y, 1, 1);
        }

        ctx.restore();
    }

    drawCanvasUI(ctx, w, h, engine) {
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

        const boss = engine.enemies.find(e => e.type === "Seal Mother");
        if (boss) {
            const barW = 400;
            const barH = 13;
            const bx = (w - barW) / 2;
            const by = 34;

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

        if (this.levelUpBannerTimer > 0) {
            this.levelUpBannerTimer--;
            const alpha = Math.min(1, this.levelUpBannerTimer / 30);
            ctx.fillStyle = `rgba(212, 175, 55, ${this.levelUpBannerTimer / 60})`;
            ctx.font = "bold 28px Courier New";
            ctx.textAlign = "center";
            ctx.shadowColor = "#000";
            ctx.shadowBlur = 8;
            ctx.fillText(`- REGISTRY UPDATED: LEVEL ${this.levelUpLevel} -`, w / 2, 80);
            ctx.shadowBlur = 0;
        }

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
        ctx.fillStyle = "rgba(255, 0, 0, 0.4)";
        ctx.drawImage(this.canvas, 0, yOffset, w, sliceHeight, xOffset + 5 * intensity, yOffset, w, sliceHeight);
        ctx.fillRect(xOffset + 5 * intensity, yOffset, w, sliceHeight);
        
        // Cyan Shift
        ctx.fillStyle = "rgba(0, 255, 255, 0.4)";
        ctx.drawImage(this.canvas, 0, yOffset, w, sliceHeight, xOffset - 5 * intensity, yOffset, w, sliceHeight);
        ctx.fillRect(xOffset - 5 * intensity, yOffset, w, sliceHeight);
        
        ctx.restore();
    }
}
