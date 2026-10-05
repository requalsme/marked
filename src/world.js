// The Keeping House: room layout and the pre-rendered floor / back-wall texture.
//
// The packaged environment sprites are standalone illustrations, each with its
// own perspective and outline, so they cannot tile. The room shell is instead
// generated once into an offscreen canvas as one aligned, front-facing grid
// (stone flagstones in running bond, continuous bookshelves along the back
// wall) and the prop sprites are layered on top of it.

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1000;
export const WALL_BASE_Y = 300;   // where the back wall meets the floor

export const ROOM = {
    bounds: { minX: 70, maxX: 1530, minY: 335, maxY: 965 },
    playerStart: { x: 560, y: 500 },
    bossSpawn: { x: 800, y: 470 },
    obstacles: [
        { x: 258, y: 420, w: 86, h: 42, label: "Evidence Board" },
        { x: 1256, y: 424, w: 90, h: 46, label: "Nameplate Heap" },
        { x: 800, y: 610, r: 40, label: "The Monolith" }
    ],
    interactables: [
        { type: "blood_ritual_altar", x: 430, y: 800, data: { radius: 28 } },
        { type: "static_signal_pylon", x: 170, y: 560, data: { radius: 24 } },
        { type: "corpse_lantern_shrine", x: 1400, y: 790, data: { radius: 25 } },
        { type: "wax_record_chest", x: 1170, y: 900, data: { radius: 22, state: "closed" } },
        { type: "sealed_zone_door", x: 800, y: 336, data: { radius: 34, state: "closed" } }
    ],
    candles: [
        { x: 150, y: 330, intensity: 0.9 },
        { x: 520, y: 330, intensity: 0.85 },
        { x: 1080, y: 330, intensity: 0.85 },
        { x: 1450, y: 330, intensity: 0.9 },
        { x: 800, y: 590, intensity: 1.2 },
        { x: 430, y: 780, intensity: 0.8 },
        { x: 1400, y: 770, intensity: 0.8 },
        { x: 800, y: 930, intensity: 0.7 },
        { x: 150, y: 900, intensity: 0.6 }
    ]
};

// Deterministic PRNG so the room looks the same every visit
function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function buildRoomTexture(scale = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(WORLD_WIDTH * scale);
    canvas.height = Math.round(WORLD_HEIGHT * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    const rand = mulberry32(1337);

    drawFloor(ctx, rand);
    drawBackWall(ctx, rand);
    drawSideShadows(ctx);
    return canvas;
}

// ─── Floor ────────────────────────────────────────────────────────────────

function drawFloor(ctx, rand) {
    const top = WALL_BASE_Y;
    const h = WORLD_HEIGHT - top;

    // Grout / mortar base
    ctx.fillStyle = "#0d0b09";
    ctx.fillRect(0, top, WORLD_WIDTH, h);

    // Irregular flagstones, roughly character-sized. Rows get slightly taller
    // toward the viewer for a gentle sense of depth; each row starts at a random
    // offset so joints never line up into a brick pattern.
    let y = top + 2;
    while (y < WORLD_HEIGHT) {
        const rowH = 40 + (y - top) / h * 10 + Math.floor(rand() * 6);
        let x = -Math.floor(rand() * 70);
        while (x < WORLD_WIDTH + 40) {
            const w = 46 + Math.floor(rand() * 52);
            // Occasionally a stone is split into two half-height pieces
            if (rand() < 0.12) {
                const half = Math.floor(rowH / 2);
                drawFlagstone(ctx, rand, x + 2, y + 2, w - 4, half - 3);
                drawFlagstone(ctx, rand, x + 2, y + half + 1, w - 4, rowH - half - 3);
            } else {
                drawFlagstone(ctx, rand, x + 2, y + 2, w - 4, rowH - 4);
            }
            x += w;
        }
        y += rowH;
    }

    // Worn walking path through the middle of the room
    const path = ctx.createRadialGradient(800, 650, 60, 800, 650, 520);
    path.addColorStop(0, "rgba(140, 110, 70, 0.10)");
    path.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = path;
    ctx.fillRect(0, top, WORLD_WIDTH, h);

    // Scattered paper scraps and ink stains
    for (let i = 0; i < 70; i++) {
        const px = rand() * WORLD_WIDTH;
        const py = top + 30 + rand() * (h - 40);
        if (rand() < 0.35) {
            drawInkStain(ctx, rand, px, py);
        } else {
            drawPaperScrap(ctx, rand, px, py);
        }
    }

    // Contact shadow where the wall meets the floor
    const wallShadow = ctx.createLinearGradient(0, top, 0, top + 90);
    wallShadow.addColorStop(0, "rgba(0, 0, 0, 0.75)");
    wallShadow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = wallShadow;
    ctx.fillRect(0, top, WORLD_WIDTH, 90);
}

function drawFlagstone(ctx, rand, x, y, w, h) {
    // Base tone: cool grey-brown with per-stone variation
    const v = 40 + Math.floor(rand() * 16);
    const warm = Math.floor(rand() * 8);
    const base = `rgb(${v + warm + 6}, ${v + warm}, ${v - 4})`;

    // Slightly irregular corners
    const j = () => (rand() - 0.5) * 4;
    ctx.beginPath();
    ctx.moveTo(x + j(), y + j());
    ctx.lineTo(x + w + j(), y + j());
    ctx.lineTo(x + w + j(), y + h + j());
    ctx.lineTo(x + j(), y + h + j());
    ctx.closePath();

    const grad = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    grad.addColorStop(0, shade(base, 10));
    grad.addColorStop(1, shade(base, -8));
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.clip();

    // Speckle texture
    for (let i = 0; i < (w * h) / 40; i++) {
        const a = rand() * 0.12;
        ctx.fillStyle = rand() < 0.5 ? `rgba(255,240,210,${a})` : `rgba(0,0,0,${a * 1.5})`;
        ctx.fillRect(x + rand() * w, y + rand() * h, 1 + rand() * 2, 1 + rand() * 2);
    }

    // Occasional large stain / wear patch
    if (rand() < 0.35) {
        const cx = x + rand() * w, cy = y + rand() * h, r = 10 + rand() * 30;
        const patch = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
        patch.addColorStop(0, `rgba(0,0,0,${0.12 + rand() * 0.15})`);
        patch.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = patch;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }

    // Cracks
    if (rand() < 0.18) {
        ctx.strokeStyle = "rgba(5, 4, 3, 0.75)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let cx = x + rand() * w, cy = y + rand() * h;
        ctx.moveTo(cx, cy);
        const segs = 3 + Math.floor(rand() * 4);
        for (let i = 0; i < segs; i++) {
            cx += (rand() - 0.5) * 16;
            cy += (rand() - 0.3) * 9;
            ctx.lineTo(cx, cy);
        }
        ctx.stroke();
    }
    ctx.restore();

    // Bevel: lit top edge, shadowed bottom edge
    ctx.strokeStyle = "rgba(255, 235, 200, 0.08)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 1.5);
    ctx.lineTo(x + w - 2, y + 1.5);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + h - 1);
    ctx.lineTo(x + w - 2, y + h - 1);
    ctx.stroke();
}

function drawPaperScrap(ctx, rand, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rand() - 0.5) * 1.6);
    const w = 8 + rand() * 12, h = 6 + rand() * 9;
    ctx.fillStyle = `rgba(${200 + rand() * 30}, ${185 + rand() * 25}, ${140 + rand() * 30}, ${0.35 + rand() * 0.3})`;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = "rgba(30, 20, 10, 0.35)";
    for (let i = 0; i < 3; i++) ctx.fillRect(-w / 2 + 2, -h / 2 + 2 + i * 2.5, w * (0.4 + rand() * 0.5), 0.8);
    ctx.restore();
}

function drawInkStain(ctx, rand, x, y) {
    const r = 6 + rand() * 18;
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, "rgba(5, 5, 12, 0.55)");
    g.addColorStop(0.7, "rgba(5, 5, 12, 0.3)");
    g.addColorStop(1, "rgba(5, 5, 12, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, rand() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
}

// ─── Back wall: continuous bookshelves ────────────────────────────────────

function drawBackWall(ctx, rand) {
    const base = WALL_BASE_Y;

    // Plaster / stone wall behind the shelves
    const wall = ctx.createLinearGradient(0, 0, 0, base);
    wall.addColorStop(0, "#070606");
    wall.addColorStop(0.5, "#14100c");
    wall.addColorStop(1, "#1a1410");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, WORLD_WIDTH, base);

    // Cornice beam
    ctx.fillStyle = "#24180f";
    ctx.fillRect(0, 22, WORLD_WIDTH, 16);
    ctx.fillStyle = "rgba(255, 210, 150, 0.08)";
    ctx.fillRect(0, 22, WORLD_WIDTH, 2);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 38, WORLD_WIDTH, 4);

    // Shelf bays, except where the door stands (centre)
    const bayW = 150;
    const doorGap = { from: 690, to: 910 };
    for (let x = 0; x < WORLD_WIDTH; x += bayW) {
        if (x + bayW > doorGap.from && x < doorGap.to) continue;
        drawShelfBay(ctx, rand, x, 46, bayW, base - 46 - 26);
    }

    // Stone arch frame around the door gap
    drawDoorArch(ctx, doorGap.from, doorGap.to, base);

    // Skirting board along the whole wall
    ctx.fillStyle = "#1e150e";
    ctx.fillRect(0, base - 26, WORLD_WIDTH, 26);
    ctx.fillStyle = "rgba(255, 210, 150, 0.07)";
    ctx.fillRect(0, base - 26, WORLD_WIDTH, 2);
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, base - 3, WORLD_WIDTH, 3);
}

function drawShelfBay(ctx, rand, x, y, w, h) {
    const post = 10;
    // Back panel
    ctx.fillStyle = "#0e0a07";
    ctx.fillRect(x, y, w, h);

    // Shelves and books
    const shelfCount = 4;
    const shelfH = h / shelfCount;
    for (let s = 0; s < shelfCount; s++) {
        const sy = y + s * shelfH;
        const floorY = sy + shelfH - 7;
        let bx = x + post + 2;
        const end = x + w - post - 2;
        while (bx < end - 4) {
            if (rand() < 0.08) { bx += 6 + rand() * 14; continue; } // gap
            const bw = Math.min(end - bx, 5 + rand() * 10);
            const bh = shelfH * (0.55 + rand() * 0.35);
            drawBook(ctx, rand, bx, floorY - bh, bw, bh);
            bx += bw + (rand() < 0.2 ? 1.5 : 0.5);
        }
        // Occasional leaning book at the end of a run
        if (rand() < 0.4) {
            ctx.save();
            ctx.translate(end - 6, floorY);
            ctx.rotate(-0.35);
            drawBook(ctx, rand, -4, -shelfH * 0.6, 8, shelfH * 0.6);
            ctx.restore();
        }
        // Shelf board
        ctx.fillStyle = "#2a1c11";
        ctx.fillRect(x, floorY, w, 7);
        ctx.fillStyle = "rgba(255, 210, 150, 0.1)";
        ctx.fillRect(x, floorY, w, 1.5);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(x, floorY + 7, w, 3);
    }

    // Uprights
    for (const px of [x, x + w - post]) {
        const g = ctx.createLinearGradient(px, 0, px + post, 0);
        g.addColorStop(0, "#1b120b");
        g.addColorStop(0.5, "#33231a");
        g.addColorStop(1, "#150e08");
        ctx.fillStyle = g;
        ctx.fillRect(px, y - 4, post, h + 4);
    }

    // Pinned notes and red string, sparsely
    if (rand() < 0.5) {
        const nx = x + 25 + rand() * (w - 50), ny = y + 10 + rand() * (h - 40);
        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate((rand() - 0.5) * 0.3);
        ctx.fillStyle = "rgba(222, 206, 160, 0.85)";
        ctx.fillRect(-9, -11, 18, 22);
        ctx.fillStyle = "rgba(40, 25, 15, 0.5)";
        for (let i = 0; i < 4; i++) ctx.fillRect(-6, -7 + i * 4, 12, 1);
        ctx.fillStyle = "#8a1a14";
        ctx.beginPath();
        ctx.arc(0, -9, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

const BOOK_COLORS = ["#3b1512", "#4a2a14", "#22301f", "#1d2433", "#3a3020", "#2b1b2e", "#55301b", "#1f1f1f", "#5b4a2a"];

function drawBook(ctx, rand, x, y, w, h) {
    const c = BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)];
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, shade(c, -12));
    g.addColorStop(0.4, shade(c, 14));
    g.addColorStop(1, shade(c, -18));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // Spine bands
    if (w > 6) {
        ctx.fillStyle = "rgba(200, 160, 80, 0.35)";
        ctx.fillRect(x + 1, y + h * 0.15, w - 2, 1.2);
        ctx.fillRect(x + 1, y + h * 0.8, w - 2, 1.2);
    }
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(x + w - 0.8, y, 0.8, h);
}

function drawDoorArch(ctx, from, to, base) {
    const g = ctx.createLinearGradient(from, 0, to, 0);
    g.addColorStop(0, "#1a1511");
    g.addColorStop(0.5, "#2a221b");
    g.addColorStop(1, "#1a1511");
    ctx.fillStyle = g;
    ctx.fillRect(from, 46, to - from, base - 46);

    // Recess
    const mid = (from + to) / 2;
    ctx.fillStyle = "#060505";
    ctx.beginPath();
    ctx.moveTo(mid - 78, base);
    ctx.lineTo(mid - 78, 150);
    ctx.quadraticCurveTo(mid, 60, mid + 78, 150);
    ctx.lineTo(mid + 78, base);
    ctx.closePath();
    ctx.fill();

    // Masonry blocks on the arch frame
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    for (let yy = 70; yy < base; yy += 34) {
        ctx.beginPath();
        ctx.moveTo(from, yy);
        ctx.lineTo(mid - 82, yy);
        ctx.moveTo(mid + 82, yy);
        ctx.lineTo(to, yy);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 220, 170, 0.06)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(mid - 82, base);
    ctx.lineTo(mid - 82, 150);
    ctx.quadraticCurveTo(mid, 54, mid + 82, 150);
    ctx.lineTo(mid + 82, base);
    ctx.stroke();
}

function drawSideShadows(ctx) {
    for (const [x0, x1] of [[0, 120], [WORLD_WIDTH, WORLD_WIDTH - 120]]) {
        const g = ctx.createLinearGradient(x0, 0, x1, 0);
        g.addColorStop(0, "rgba(0,0,0,0.75)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(Math.min(x0, x1), 0, 120, WORLD_HEIGHT);
    }
    const g = ctx.createLinearGradient(0, WORLD_HEIGHT - 80, 0, WORLD_HEIGHT);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = g;
    ctx.fillRect(0, WORLD_HEIGHT - 80, WORLD_WIDTH, 80);
}

function shade(hexOrRgb, amt) {
    let r, g, b;
    if (hexOrRgb.startsWith("#")) {
        const n = parseInt(hexOrRgb.slice(1), 16);
        r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    } else {
        [r, g, b] = hexOrRgb.match(/\d+/g).map(Number);
    }
    const c = (v) => Math.max(0, Math.min(255, v + amt));
    return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}
