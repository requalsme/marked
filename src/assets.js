// Data-Driven Asset Manager and Preloader
// Loads pack_manifest.json at runtime and configures sprite drawings

export class AssetPreloader {
    constructor() {
        this.manifest = null;
        this.manifests = [];
        this.assetsMap = {};
        this.animationsMap = {};
        this.imagesCache = {};
        this.loadedCount = 0;
        this.totalCount = 0;
    }

    async loadManifestAndAssets(onProgress) {
        try {
            this.manifest = null;
            this.manifests = [];
            this.assetsMap = {};
            this.animationsMap = {};
            this.imagesCache = {};

            const manifestsToLoad = [
                { url: "assets/pack_manifest.json", basePath: "assets/", required: true },
                {
                    url: "assets/keeping_house_final_cartoon_animated_pack/pack_manifest.json",
                    basePath: "assets/keeping_house_final_cartoon_animated_pack/",
                    required: false
                }
            ];

            for (const source of manifestsToLoad) {
                const response = await fetch(source.url);
                if (!response.ok) {
                    if (source.required) throw new Error(`Required asset manifest missing: ${source.url}`);
                    continue;
                }

                const manifest = await response.json();
                this.manifests.push(manifest);
                if (!this.manifest) this.manifest = manifest;
                this.registerManifest(manifest, source.basePath);
            }

            // Determine unique sheet sources to load
            const uniqueSheets = {};
            Object.keys(this.animationsMap).forEach(key => {
                const src = this.animationsMap[key].src;
                uniqueSheets[src] = true;
            });

            // Also load gear items _base.png files which might not be inside animations
            const gearFolders = [
                "abyssal_charm", "ash_bell", "black_offering_bowl", "blood_axe", "blood_talisman",
                "bone_mask", "bone_plate_armor", "corpse_crown", "corpse_jaw_amulet", "corpse_lantern",
                "cracked_mirror_shield", "false_signal_antenna", "hollow_gravity_boots", "impossible_key",
                "knife_that_remembers", "lantern_of_wrong_signals", "marked_hood", "memory_blade",
                "monolith_shard_relic", "obfuscation_cloak", "red_ledger_offhand", "redacted_mail",
                "ritual_blade", "ritual_chain", "sanity_charm", "signal_staff", "static_dagger",
                "static_robe", "veil_compass", "watcher_ring"
            ];
            gearFolders.forEach(folder => {
                uniqueSheets[`assets/gear/${folder}/${folder}_base.png`] = true;
            });

            // Also load tarot card _base.png files
            const tarotCards = ["death", "devil", "hermit", "judgement", "moon", "tower"];
            tarotCards.forEach(card => {
                uniqueSheets[`assets/ui/tarot/tarot_${card}/tarot_${card}_base.png`] = true;
            });

            // Preload all
            const sheetPaths = Object.keys(uniqueSheets);
            this.totalCount = sheetPaths.length;
            
            if (this.totalCount === 0) {
                return true;
            }

            return new Promise((resolve) => {
                let loaded = 0;
                sheetPaths.forEach(path => {
                    const img = new Image();
                    img.src = path;
                    img.onload = () => {
                        this.imagesCache[path] = img;
                        loaded++;
                        this.loadedCount = loaded;
                        if (onProgress) onProgress(loaded / this.totalCount);
                        if (loaded === this.totalCount) {
                            resolve(true);
                        }
                    };
                    img.onerror = () => {
                        // Safe ignore to prevent loading halts
                        console.warn(`Could not preload asset: ${path}`);
                        loaded++;
                        this.loadedCount = loaded;
                        if (onProgress) onProgress(loaded / this.totalCount);
                        if (loaded === this.totalCount) {
                            resolve(true);
                        }
                    };
                });
            });

        } catch (e) {
            console.error("Failed to load pack_manifest.json:", e);
            return false;
        }
    }

    registerManifest(manifest, basePath) {
        const assets = manifest?.content?.assets || manifest?.assets || [];
        assets.forEach(asset => {
            if (asset.id) this.assetsMap[asset.id] = asset;
        });

        const animations = manifest?.content?.animations || manifest?.animations || [];
        animations.forEach(anim => {
            if (!anim.id || !anim.sheet) return;

            this.animationsMap[anim.id] = {
                src: basePath + anim.sheet,
                frames: anim.frame_count || 1,
                fps: anim.fps || 10,
                size: anim.frame_size || manifest.frame_size || [256, 256],
                origin: anim.origin || [128, 232],
                loop: anim.loop !== undefined ? anim.loop : true,
                mirror_x: anim.mirror_x || false,
                depth_sort_offset: anim.depth_sort_offset || 0,
                scale: anim.scale || 1.0
            };
        });
    }

    getImage(path) {
        return this.imagesCache[path] || null;
    }

    hasAnimation(animId) {
        return Boolean(this.animationsMap[animId]);
    }

    drawFrame(ctx, animId, frameIndex, x, y, facing = "right", scaleFactor = 0.35, alpha = 1.0) {
        const config = this.animationsMap[animId];
        if (!config) {
            // Draw fallback indicator
            ctx.fillStyle = "#a61515";
            ctx.fillRect(x - 12, y - 24, 24, 24);
            ctx.fillStyle = "#fff";
            ctx.font = "9px monospace";
            ctx.fillText("?", x - 3, y - 10);
            return;
        }

        const img = this.getImage(config.src);
        if (!img) {
            ctx.fillStyle = "#4a3c3c";
            ctx.fillRect(x - 10, y - 20, 20, 20);
            return;
        }

        const [fw, fh] = config.size;
        const [ox, oy] = config.origin;
        const index = frameIndex % config.frames;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);

        // Apply manifest alignment flipping
        if (facing === "left" && config.mirror_x) {
            ctx.scale(-1, 1);
        }

        // Draw anchored precisely on origin
        ctx.drawImage(
            img,
            index * fw, 0, fw, fh, // source coordinates
            -ox * scaleFactor, -oy * scaleFactor, fw * scaleFactor, fh * scaleFactor // dest coordinates
        );

        ctx.restore();
    }
}

export const assetLoader = new AssetPreloader();
