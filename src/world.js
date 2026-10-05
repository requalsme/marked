// The Keeping House: room layout, perspective, and the painted room shell.
//
// The room is drawn in one-point perspective, a "dollhouse" view from above
// and in front, so the floor, the back wall's shelf niches and the side walls
// all converge on the same vanishing point. The shell is painted once into an
// offscreen canvas in the grim ink-illustration style of the sprite art (ink
// outlines, cross-hatched shadows, desaturated stone with wax-red accents)
// and the sprites and props are layered on top.

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1000;
export const WALL_BASE_Y = 300;   // where the back wall meets the floor

// ─── Perspective ─────────────────────────────────────────────────────────
// A floor point is (u, w): u is lateral offset from the room's centre line in
// front-edge pixels, w is depth back from the front edge. h is height above
// the floor. Lines of constant u converge on (VP_X, VP_Y).
const VP_X = 800;
const VP_Y = -2600;
const FRONT_Y = WORLD_HEIGHT;
const SPAN = FRONT_Y - VP_Y;
const FORE = 0.6;          // depth foreshortening of the floor plane
const HALF_U = 800;        // the room is 1600 front-edge pixels wide

export function depthS(y) {
    return (y - VP_Y) / SPAN;
}

export function project(u, w, h = 0) {
    const s = 1 / (1 + (w * FORE) / SPAN);
    return { x: VP_X + u * s, y: VP_Y + SPAN * s - h * s, s };
}

export function depthOfY(y) {
    return (1 / depthS(y) - 1) * SPAN / FORE;
}

// Sprite scale relative to mid-room, so things shrink slightly with distance
export function depthScale(y) {
    return depthS(y) / depthS(650);
}

// The floor narrows toward the back wall; this is the walkable x-range at y
export function walkableX(y, margin = 48) {
    const s = depthS(y);
    return { min: VP_X - HALF_U * s + margin, max: VP_X + HALF_U * s - margin };
}

const BACK_S = depthS(WALL_BASE_Y);
const BACK_W = depthOfY(WALL_BASE_Y);
const WALL_L = VP_X - HALF_U * BACK_S;   // back wall's left corner (~156)
const WALL_R = VP_X + HALF_U * BACK_S;   // back wall's right corner (~1444)
const WALL_TOP_H = WALL_BASE_Y / BACK_S; // wall height that reaches y = 0

// Back wall architecture (screen x of pillar centres)
const PILLARS = [174, 350, 526, 700, 900, 1074, 1250, 1426];
const DOOR_PILLARS = new Set([700, 900]);
const SCONCE_PILLARS = new Set([350, 526, 1074, 1250]);
const SCONCE_Y = 152;
const SHELF_BOARDS = [142, 188, 232, 268];
const PLINTH_Y = 268;

// Two tallow candles per sconce: [dx, height]
export const SCONCE_CANDLES = [[-5, 18], [5, 13]];

function sideSconce(side, w) {
    const p = project(side * HALF_U, w, 175);
    return { x: p.x + side * -2 * p.s, y: p.y, intensity: 0.7, kind: "sconce", scale: p.s, wall: true };
}

export const ROOM = {
    bounds: { minX: 70, maxX: 1530, minY: 335, maxY: 965 },
    playerStart: { x: 560, y: 520 },
    bossSpawn: { x: 800, y: 470 },
    // Furniture and props live in props.js (painted, with their own colliders)
    obstacles: [
        { x: 800, y: 620, r: 40, label: "The Monolith" }
    ],
    interactables: [
        { type: "blood_ritual_altar", x: 430, y: 800, data: { radius: 28 } },
        { type: "static_signal_pylon", x: 245, y: 575, data: { radius: 24 } },
        { type: "corpse_lantern_shrine", x: 1380, y: 790, data: { radius: 25 } },
        { type: "wax_record_chest", x: 1170, y: 905, data: { radius: 22, state: "closed" } },
        { type: "sealed_zone_door", x: 800, y: 302, data: { radius: 34, state: "closed" } }
    ],
    candles: [
        // Floor candelabras
        { x: 292, y: 356, intensity: 0.85 },
        { x: 1308, y: 356, intensity: 0.85 },
        { x: 205, y: 730, intensity: 0.75 },
        { x: 1405, y: 650, intensity: 0.75 },
        { x: 800, y: 952, intensity: 0.7 },
        // Iron sconces on the back-wall pillars
        ...[...SCONCE_PILLARS].map(x => ({ x, y: SCONCE_Y, intensity: 0.75, kind: "sconce", scale: 1, wall: true })),
        // Sconces on the side walls
        sideSconce(-1, 1040), sideSconce(-1, 420), sideSconce(1, 1040), sideSconce(1, 420)
    ],
    // Static glows baked into the architecture (the carved eye above the door)
    glows: [
        { x: 800, y: 122, r: 95, color: [210, 35, 22], a: 0.45 }
    ]
};

// ─── Utilities ───────────────────────────────────────────────────────────

// Deterministic PRNG so the room looks the same every visit
export function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function rgb(c, a = 1) {
    return `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${a})`;
}

function lerpC(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function shadeC(c, amt) {
    return [c[0] + amt, c[1] + amt, c[2] + amt];
}

export function pathPoly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
}

// A hand-inked line: slightly wobbly, slightly varying weight
export function inkLine(ctx, rand, x1, y1, x2, y2, width = 1.3, alpha = 0.9) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.floor(len / 14));
    ctx.strokeStyle = `rgba(6, 4, 4, ${alpha})`;
    ctx.lineWidth = width * (0.8 + rand() * 0.4);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const j = i === steps ? 0 : 0.7;
        ctx.lineTo(x1 + (x2 - x1) * t + (rand() - 0.5) * j, y1 + (y2 - y1) * t + (rand() - 0.5) * j);
    }
    ctx.stroke();
}

export function inkPoly(ctx, rand, pts, width = 1.3, alpha = 0.9) {
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        inkLine(ctx, rand, a.x, a.y, b.x, b.y, width, alpha);
    }
}

// Cross-hatching inside the current clip: the ink illustrator's shadow
export function hatch(ctx, rand, x, y, w, h, { angle = 0.8, gap = 4, alpha = 0.22, width = 0.7, cross = false } = {}) {
    ctx.save();
    ctx.strokeStyle = `rgba(5, 3, 3, ${alpha})`;
    ctx.lineWidth = width;
    const diag = Math.hypot(w, h);
    const cx = x + w / 2, cy = y + h / 2;
    const angles = cross ? [angle, angle + Math.PI / 2.4] : [angle];
    for (const a of angles) {
        const dx = Math.cos(a), dy = Math.sin(a);
        const nx = -dy, ny = dx;
        for (let o = -diag / 2; o < diag / 2; o += gap * (0.8 + rand() * 0.5)) {
            const px = cx + nx * o, py = cy + ny * o;
            const l = diag / 2 * (0.7 + rand() * 0.3);
            ctx.beginPath();
            ctx.moveTo(px - dx * l, py - dy * l);
            ctx.lineTo(px + dx * l + (rand() - 0.5) * 2, py + dy * l + (rand() - 0.5) * 2);
            ctx.stroke();
        }
    }
    ctx.restore();
}

function blotch(ctx, x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, color.replace(/[\d.]+\)$/, "0)"));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function makeGrain(size = 256) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const img = g.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = 128 + (Math.random() - 0.5) * 120;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}

// ─── Build ───────────────────────────────────────────────────────────────

export function buildRoomTexture(scale = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(WORLD_WIDTH * scale);
    canvas.height = Math.round(WORLD_HEIGHT * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    const rand = mulberry32(1337);

    // The void beyond the cut-away walls
    ctx.fillStyle = "#030202";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    drawSideWall(ctx, rand, -1);
    drawSideWall(ctx, rand, 1);
    drawBackWall(ctx, rand);
    drawFloor(ctx, rand);
    drawFinish(ctx);
    return canvas;
}

// ─── Floor ───────────────────────────────────────────────────────────────

const FLOOR_PTS = () => [project(-HALF_U, BACK_W), project(HALF_U, BACK_W), project(HALF_U, 0), project(-HALF_U, 0)];

function drawFloor(ctx, rand) {
    ctx.save();
    pathPoly(ctx, FLOOR_PTS());
    ctx.clip();

    // Mortar
    ctx.fillStyle = "#0d0b0a";
    ctx.fillRect(0, WALL_BASE_Y, WORLD_WIDTH, WORLD_HEIGHT - WALL_BASE_Y);

    // Flagstones in perspective: rows of roughly equal floor depth, staggered
    let w = -10;
    while (w < BACK_W) {
        const rowD = 46 + Math.floor(rand() * 14);
        let u = -HALF_U - 40 - rand() * 70;
        while (u < HALF_U + 40) {
            const sw = 48 + Math.floor(rand() * 50);
            const r = rand();
            if (r < 0.14) {
                // Two half-depth stones
                const half = Math.round(rowD * (0.4 + rand() * 0.2));
                drawFloorStone(ctx, rand, u, w, sw, half);
                drawFloorStone(ctx, rand, u, w + half, sw, rowD - half);
            } else if (r < 0.22) {
                // A run of small setts
                const n = 2 + Math.floor(rand() * 2);
                for (let k = 0; k < n; k++) drawFloorStone(ctx, rand, u + (sw / n) * k, w, sw / n, rowD);
            } else {
                drawFloorStone(ctx, rand, u, w, sw, rowD);
            }
            u += sw;
        }
        w += rowD;
    }

    // Grime: damp patches, soot, worn lighter stone
    for (let i = 0; i < 140; i++) {
        const p = project((rand() - 0.5) * 1700, rand() * BACK_W);
        const r = (40 + rand() * 140) * p.s;
        blotch(ctx, p.x, p.y, r, rand() < 0.72 ? `rgba(0, 0, 0, ${0.12 + rand() * 0.2})` : `rgba(150, 135, 115, ${0.04 + rand() * 0.06})`);
    }

    // Dust settled along the walls, a scuffed path beside the runner
    for (let i = 0; i < 60; i++) {
        const u = (rand() < 0.5 ? -1 : 1) * (560 + rand() * 230), w = rand() * BACK_W;
        const p = project(u, w);
        blotch(ctx, p.x, p.y, (30 + rand() * 60) * p.s, `rgba(160, 150, 135, ${0.05 + rand() * 0.05})`);
    }
    for (let i = 0; i < 40; i++) {
        const p = project((rand() < 0.5 ? -1 : 1) * (110 + rand() * 60), rand() * BACK_W);
        blotch(ctx, p.x, p.y, (20 + rand() * 30) * p.s, "rgba(180, 170, 155, 0.06)");
    }
    for (const [u, w, r] of [[-250, 520, 42], [420, 180, 34], [560, 820, 30], [-640, 980, 26]]) drawPuddle(ctx, rand, u, w, r);

    drawRitualCircle(ctx, rand, -392, 354, 100);
    drawRunner(ctx, rand);
    drawMonolithScar(ctx, rand);
    drawFloorDebris(ctx, rand);

    // Ambient occlusion where the floor meets the walls
    ctx.save();
    ctx.filter = "blur(18px)";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = 60;
    const fl = FLOOR_PTS();
    ctx.beginPath();
    ctx.moveTo(fl[3].x, fl[3].y);
    ctx.lineTo(fl[0].x, fl[0].y);
    ctx.lineTo(fl[1].x, fl[1].y);
    ctx.lineTo(fl[2].x, fl[2].y);
    ctx.stroke();
    ctx.restore();
    const ao = ctx.createLinearGradient(0, WALL_BASE_Y, 0, WALL_BASE_Y + 70);
    ao.addColorStop(0, "rgba(0,0,0,0.6)");
    ao.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = ao;
    ctx.fillRect(0, WALL_BASE_Y, WORLD_WIDTH, 70);

    // Hatched shadow bands along the walls
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, WALL_BASE_Y, WORLD_WIDTH, 40);
    ctx.clip();
    hatch(ctx, rand, 0, WALL_BASE_Y, WORLD_WIDTH, 40, { angle: 1.1, gap: 3.5, alpha: 0.18 });
    ctx.restore();
    drawDoorSteps(ctx, rand);
    ctx.restore();

    // Ink edge where floor meets wall
    const fp = FLOOR_PTS();
    inkLine(ctx, rand, fp[0].x, fp[0].y, fp[1].x, fp[1].y, 2.2);
    inkLine(ctx, rand, fp[0].x, fp[0].y, fp[3].x, fp[3].y, 2.2);
    inkLine(ctx, rand, fp[1].x, fp[1].y, fp[2].x, fp[2].y, 2.2);
}

const STONE_TONES = [[84, 82, 80], [92, 86, 78], [70, 70, 71], [78, 81, 82], [98, 92, 84], [64, 62, 60], [88, 80, 72]];

function drawFloorStone(ctx, rand, u, w, du, dw) {
    const gap = 1.8;
    const j = () => (rand() - 0.5) * 3;
    const q = [
        project(u + gap + j(), w + dw - gap + j()),
        project(u + du - gap + j(), w + dw - gap + j()),
        project(u + du - gap + j(), w + gap + j()),
        project(u + gap + j(), w + gap + j())
    ];
    const tone = STONE_TONES[Math.floor(rand() * STONE_TONES.length)];
    const base = shadeC(tone, (rand() - 0.5) * 14);

    pathPoly(ctx, q);
    const top = Math.min(q[0].y, q[1].y), bot = Math.max(q[2].y, q[3].y);
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, rgb(shadeC(base, 8)));
    g.addColorStop(0.6, rgb(base));
    g.addColorStop(1, rgb(shadeC(base, -16)));
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.clip();
    const cx = (q[0].x + q[2].x) / 2, cy = (q[0].y + q[2].y) / 2;
    const s = q[2].s;
    blotch(ctx, cx + (rand() - 0.5) * 40 * s, cy + (rand() - 0.5) * 16 * s, (20 + rand() * 40) * s, rand() < 0.6 ? "rgba(0,0,0,0.22)" : "rgba(210,195,170,0.10)");
    // Pitting and grain
    for (let i = 0; i < 6; i++) {
        const px = q[3].x + (q[2].x - q[3].x) * rand(), py = top + (bot - top) * rand();
        ctx.fillStyle = rand() < 0.5 ? "rgba(0,0,0,0.25)" : "rgba(230,215,190,0.08)";
        ctx.fillRect(px, py, 1 + rand() * 2.5 * s, 1 + rand() * 1.5 * s);
    }
    // Chipped corner
    if (rand() < 0.25) {
        const c = q[Math.floor(rand() * 4)];
        ctx.fillStyle = "rgba(12, 10, 9, 0.9)";
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + (rand() - 0.5) * 16 * s, c.y + (rand() - 0.5) * 6 * s);
        ctx.lineTo(c.x + (rand() - 0.5) * 16 * s, c.y + (rand() - 0.5) * 6 * s);
        ctx.fill();
    }
    // Crack
    if (rand() < 0.22) {
        let x = q[0].x + (q[1].x - q[0].x) * rand(), y = q[0].y + 2;
        ctx.strokeStyle = "rgba(8, 6, 5, 0.85)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < 5; i++) {
            x += (rand() - 0.5) * 16 * s;
            y += (bot - top) / 5;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    ctx.restore();

    // Worn bevel: lit far edge, inked joints
    ctx.strokeStyle = "rgba(235, 222, 200, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(q[3].x, q[3].y + 1);
    ctx.lineTo(q[2].x, q[2].y + 1);
    ctx.stroke();
    pathPoly(ctx, q);
    ctx.strokeStyle = "rgba(6, 5, 4, 0.55)";
    ctx.lineWidth = 0.9;
    ctx.stroke();
}

// Standing water: a dark glossy pool that catches a little light
function drawPuddle(ctx, rand, u, w, r) {
    const pts = [];
    for (let i = 0; i < 20; i++) {
        const t = (i / 20) * Math.PI * 2;
        const rr = r * (0.7 + rand() * 0.45);
        pts.push(project(u + Math.cos(t) * rr * 1.4, w + Math.sin(t) * rr));
    }
    ctx.save();
    pathPoly(ctx, pts);
    ctx.fillStyle = "rgba(14, 16, 20, 0.42)";
    ctx.fill();
    ctx.clip();
    const c = project(u - r * 0.3, w + r * 0.2);
    const g = ctx.createLinearGradient(c.x - r, c.y, c.x + r, c.y);
    g.addColorStop(0, "rgba(160, 175, 190, 0)");
    g.addColorStop(0.5, "rgba(160, 175, 190, 0.16)");
    g.addColorStop(1, "rgba(160, 175, 190, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(c.x - r, c.y - 3, r * 2, 5);
    ctx.restore();
    pathPoly(ctx, pts);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
}

// Chalk circle and bloodied sigil under the ritual altar
function drawRitualCircle(ctx, rand, u0, w0, r) {
    const ring = (rad, n = 72) => {
        const pts = [];
        for (let i = 0; i <= n; i++) {
            const t = (i / n) * Math.PI * 2;
            pts.push(project(u0 + Math.cos(t) * rad, w0 + Math.sin(t) * rad));
        }
        return pts;
    };
    const strokeRing = (pts, color, width, broken = 0) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
            if (broken && rand() < broken) { ctx.moveTo(pts[i].x, pts[i].y); continue; }
            if (i === 0) ctx.moveTo(pts[i].x, pts[i].y); else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
    };
    // Old blood soaked into the stone
    const c = project(u0, w0);
    ctx.save();
    ctx.scale(1, 1);
    blotch(ctx, c.x, c.y, r * c.s * 1.2, "rgba(70, 6, 4, 0.35)");
    ctx.restore();
    strokeRing(ring(r), "rgba(215, 205, 180, 0.55)", 2.2, 0.06);
    strokeRing(ring(r - 12), "rgba(215, 205, 180, 0.35)", 1.2, 0.1);
    // Seven-pointed star in blood
    const star = [];
    for (let i = 0; i < 7; i++) {
        const t = -Math.PI / 2 + (i * 3 * Math.PI * 2) / 7;
        star.push(project(u0 + Math.cos(t) * (r - 14), w0 + Math.sin(t) * (r - 14)));
    }
    ctx.strokeStyle = "rgba(120, 12, 8, 0.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    star.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    // Runes between the rings
    ctx.strokeStyle = "rgba(220, 210, 185, 0.5)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
        const t = (i / 18) * Math.PI * 2;
        const a = project(u0 + Math.cos(t) * (r - 3), w0 + Math.sin(t) * (r - 3));
        const b = project(u0 + Math.cos(t) * (r - 9), w0 + Math.sin(t) * (r - 9));
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        if (i % 2) ctx.lineTo(b.x + 3, b.y - 1);
        ctx.stroke();
    }
}

// Worn oxblood runner from the door steps to the front of the room
function drawRunner(ctx, rand) {
    const U = 92, w0 = 40, w1 = BACK_W - 120;
    const quad = (ua, ub, wa, wb) => [project(ua, wb), project(ub, wb), project(ub, wa), project(ua, wa)];
    const body = quad(-U, U, w0, w1);
    ctx.save();
    pathPoly(ctx, body);
    ctx.clip();

    // Base cloth with lengthwise shading
    const p0 = project(-U, 0), p1 = project(U, 0);
    const g = ctx.createLinearGradient(p0.x, 0, p1.x, 0);
    g.addColorStop(0, "#2a0605");
    g.addColorStop(0.18, "#5a0f0b");
    g.addColorStop(0.5, "#6e1610");
    g.addColorStop(0.82, "#5a0f0b");
    g.addColorStop(1, "#2a0605");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Weave
    ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
    ctx.lineWidth = 0.8;
    for (let w = w0; w < w1; w += 5) {
        const a = project(-U, w), b = project(U, w);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 180, 150, 0.04)";
    for (let u = -U; u < U; u += 6) {
        const a = project(u, w0), b = project(u, w1);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }

    // Border bands and a diamond motif
    for (const side of [-1, 1]) {
        const bandA = quad(side * 70, side * 74, w0, w1);
        pathPoly(ctx, bandA);
        ctx.fillStyle = "rgba(150, 110, 50, 0.55)";
        ctx.fill();
        const bandB = quad(side * 78, side * 92, w0, w1);
        pathPoly(ctx, bandB);
        ctx.fillStyle = "rgba(15, 4, 3, 0.75)";
        ctx.fill();
        for (let w = w0 + 14; w < w1 - 10; w += 30) {
            const d = [project(side * 85, w - 7), project(side * 89, w), project(side * 85, w + 7), project(side * 81, w)];
            pathPoly(ctx, d);
            ctx.fillStyle = "rgba(160, 120, 60, 0.6)";
            ctx.fill();
        }
    }
    // Central lozenges
    for (let w = w0 + 120; w < w1 - 80; w += 260) {
        const d = [project(0, w - 40), project(30, w), project(0, w + 40), project(-30, w)];
        pathPoly(ctx, d);
        ctx.strokeStyle = "rgba(160, 120, 60, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const di = [project(0, w - 18), project(13, w), project(0, w + 18), project(-13, w)];
        pathPoly(ctx, di);
        ctx.fillStyle = "rgba(20, 4, 3, 0.6)";
        ctx.fill();
    }

    // Wear, stains and a crease
    for (let i = 0; i < 26; i++) {
        const p = project((rand() - 0.5) * 120, w0 + rand() * (w1 - w0));
        blotch(ctx, p.x, p.y, (12 + rand() * 40) * p.s, rand() < 0.5 ? "rgba(0,0,0,0.35)" : "rgba(170,90,70,0.12)");
    }
    for (const wc of [520, 905]) {
        const a = project(-U, wc), b = project(U, wc);
        const g2 = ctx.createLinearGradient(0, a.y - 6, 0, a.y + 6);
        g2.addColorStop(0, "rgba(0,0,0,0)");
        g2.addColorStop(0.45, "rgba(255,170,140,0.12)");
        g2.addColorStop(0.55, "rgba(0,0,0,0.35)");
        g2.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g2;
        ctx.fillRect(a.x, a.y - 6, b.x - a.x, 12);
    }
    hatch(ctx, rand, p0.x - 10, WALL_BASE_Y, p1.x - p0.x + 20, WORLD_HEIGHT - WALL_BASE_Y, { angle: 1.25, gap: 5, alpha: 0.08 });
    ctx.restore();

    // Ink edges and frayed fringe at the near end
    inkLine(ctx, rand, body[0].x, body[0].y, body[3].x, body[3].y, 1.6);
    inkLine(ctx, rand, body[1].x, body[1].y, body[2].x, body[2].y, 1.6);
    inkLine(ctx, rand, body[2].x, body[2].y, body[3].x, body[3].y, 1.6);
    ctx.strokeStyle = "rgba(120, 30, 20, 0.85)";
    ctx.lineWidth = 1.2;
    for (let u = -U + 3; u < U; u += 5) {
        const a = project(u, w0), b = project(u + (rand() - 0.5) * 6, w0 - 10 - rand() * 8);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
}

// Scorched, cracked stone around the Monolith's base
function drawMonolithScar(ctx, rand) {
    const c = { x: 800, y: 638 };
    blotch(ctx, c.x, c.y, 110, "rgba(0, 0, 0, 0.55)");
    blotch(ctx, c.x, c.y, 60, "rgba(60, 6, 4, 0.35)");
    ctx.strokeStyle = "rgba(6, 4, 4, 0.9)";
    for (let i = 0; i < 11; i++) {
        let a = (i / 11) * Math.PI * 2 + rand() * 0.3;
        let x = c.x + Math.cos(a) * 34, y = c.y + Math.sin(a) * 12;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const len = 40 + rand() * 90;
        for (let d = 0; d < len; d += 10) {
            a += (rand() - 0.5) * 0.5;
            x += Math.cos(a) * 10;
            y += Math.sin(a) * 4;
            ctx.lineTo(x, y);
            ctx.lineWidth = Math.max(0.5, 1.6 - d / len * 1.2);
        }
        ctx.stroke();
    }
}

// Two worn stone steps up to the sealed door
function drawDoorSteps(ctx, rand) {
    const steps = [
        { u: 118, wa: BACK_W - 124, wb: BACK_W - 62, h: 9 },
        { u: 100, wa: BACK_W - 62, wb: BACK_W, h: 18 }
    ];
    for (const st of steps) {
        const top = [project(-st.u, st.wb, st.h), project(st.u, st.wb, st.h), project(st.u, st.wa, st.h), project(-st.u, st.wa, st.h)];
        const riser = [project(-st.u, st.wa, st.h), project(st.u, st.wa, st.h), project(st.u, st.wa, st.h - 9), project(-st.u, st.wa, st.h - 9)];
        pathPoly(ctx, riser);
        ctx.fillStyle = "#4a4845";
        ctx.fill();
        ctx.save();
        ctx.clip();
        hatch(ctx, rand, riser[0].x, riser[0].y, riser[1].x - riser[0].x, 12, { angle: 0.9, gap: 3, alpha: 0.35 });
        ctx.restore();
        pathPoly(ctx, top);
        const g = ctx.createLinearGradient(0, top[0].y, 0, top[2].y);
        g.addColorStop(0, "#77746f");
        g.addColorStop(1, "#9a958d");
        ctx.fillStyle = g;
        ctx.fill();
        // Worn dip in the middle of each tread
        const m = project(0, (st.wa + st.wb) / 2, st.h);
        blotch(ctx, m.x, m.y, 40, "rgba(0,0,0,0.18)");
        inkPoly(ctx, rand, top, 1.4);
        inkPoly(ctx, rand, riser, 1.2);
    }
}

function drawFloorDebris(ctx, rand) {
    // Loose parchment, lying flat in the floor plane
    for (let i = 0; i < 46; i++) {
        const u = (rand() - 0.5) * 1560, w = 30 + rand() * (BACK_W - 60);
        if (Math.abs(u) < 100 && w < BACK_W - 120) continue; // keep the runner mostly clear
        drawFloorPaper(ctx, rand, u, w);
    }
    // Wax puddles and drips
    for (let i = 0; i < 34; i++) {
        const p = project((rand() - 0.5) * 1500, rand() * BACK_W);
        ctx.fillStyle = `rgba(${110 + rand() * 50}, ${10 + rand() * 12}, ${8 + rand() * 8}, ${0.45 + rand() * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, (2 + rand() * 6) * p.s, (1 + rand() * 2.4) * p.s, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    // Old blood trails
    for (let i = 0; i < 9; i++) {
        let p = project((rand() - 0.5) * 1300, 80 + rand() * (BACK_W - 200));
        const a = rand() * Math.PI * 2;
        for (let k = 0; k < 16; k++) {
            const r = (7 - k * 0.35) * p.s;
            ctx.fillStyle = `rgba(${60 + rand() * 30}, 6, 5, ${0.25 + rand() * 0.2})`;
            ctx.beginPath();
            ctx.ellipse(p.x + Math.cos(a) * k * 7, p.y + Math.sin(a) * k * 2.6, Math.max(1, r), Math.max(0.6, r * 0.4), 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // Fallen books near the shelves, and heaps of tomes against the wall
    for (const [u, w] of [[-560, BACK_W - 70], [-210, BACK_W - 55], [330, BACK_W - 64], [610, BACK_W - 80], [-700, 640], [690, 900]]) {
        drawFallenBook(ctx, rand, u, w);
    }
    for (const [u, n] of [[-690, 5], [-430, 3], [-255, 4], [270, 4], [470, 3], [700, 5]]) {
        drawBookHeap(ctx, rand, u, BACK_W - 22, n);
    }
    // Scattered bones by the lantern shrine
    for (const [u, w] of [[640, 300], [600, 250], [690, 230]]) drawBone(ctx, rand, u, w);
    drawFloorSkull(ctx, rand, 655, 275);
}

function drawFloorPaper(ctx, rand, u, w) {
    const a = rand() * Math.PI;
    const L = 9 + rand() * 9, H = 6 + rand() * 6;
    const corners = [[-L, -H], [L, -H], [L, H], [-L, H]].map(([x, y]) => project(u + x * Math.cos(a) - y * Math.sin(a), w + x * Math.sin(a) + y * Math.cos(a)));
    pathPoly(ctx, corners);
    const tone = 165 + rand() * 50;
    ctx.fillStyle = `rgba(${tone}, ${tone * 0.9}, ${tone * 0.7}, ${0.55 + rand() * 0.3})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(10, 6, 4, 0.6)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Ink writing
    ctx.strokeStyle = "rgba(30, 18, 10, 0.45)";
    for (let i = 1; i < 4; i++) {
        const t = -0.6 + i * 0.35;
        const p1 = project(u + (-L * 0.7) * Math.cos(a) - (H * t) * Math.sin(a), w + (-L * 0.7) * Math.sin(a) + (H * t) * Math.cos(a));
        const p2 = project(u + (L * 0.5) * Math.cos(a) - (H * t) * Math.sin(a), w + (L * 0.5) * Math.sin(a) + (H * t) * Math.cos(a));
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }
    if (rand() < 0.3) {
        const c = project(u, w);
        ctx.fillStyle = "rgba(140, 16, 10, 0.85)";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 1.8 * c.s, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFallenBook(ctx, rand, u, w) {
    const a = rand() * Math.PI;
    const L = 16, H = 11, T = 6;
    const pt = (x, y, h) => project(u + x * Math.cos(a) - y * Math.sin(a), w + x * Math.sin(a) + y * Math.cos(a), h);
    const top = [pt(-L, -H, T), pt(L, -H, T), pt(L, H, T), pt(-L, H, T)];
    const front = [pt(-L, H, T), pt(L, H, T), pt(L, H, 0), pt(-L, H, 0)];
    const colors = ["#4a1712", "#1f2b22", "#3a2414", "#1c2230"];
    pathPoly(ctx, front);
    ctx.fillStyle = "#d8ccae";
    ctx.fill();
    pathPoly(ctx, top);
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.fill();
    inkPoly(ctx, rand, top, 1);
    inkPoly(ctx, rand, front, 0.9);
}

// A heap of tomes stacked against the wall, each a small box in perspective
function drawBookHeap(ctx, rand, u, w, n) {
    let h = 0;
    for (let i = 0; i < n; i++) {
        const L = 15 + rand() * 6, D = 10 + rand() * 4, T = 4 + rand() * 3;
        const du = (rand() - 0.5) * 6, dw = (rand() - 0.5) * 4;
        const top = [project(u + du - L, w + dw + D, h + T), project(u + du + L, w + dw + D, h + T), project(u + du + L, w + dw - D, h + T), project(u + du - L, w + dw - D, h + T)];
        const front = [project(u + du - L, w + dw - D, h + T), project(u + du + L, w + dw - D, h + T), project(u + du + L, w + dw - D, h), project(u + du - L, w + dw - D, h)];
        const c = BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)];
        pathPoly(ctx, front);
        ctx.fillStyle = rand() < 0.5 ? "#d2c6a6" : rgb(shadeC(c, -10));
        ctx.fill();
        pathPoly(ctx, top);
        ctx.fillStyle = rgb(shadeC(c, 10));
        ctx.fill();
        inkPoly(ctx, rand, top, 0.9);
        inkPoly(ctx, rand, front, 0.9);
        h += T;
    }
}

function drawBone(ctx, rand, u, w) {
    const a = rand() * Math.PI;
    const p1 = project(u - Math.cos(a) * 16, w - Math.sin(a) * 16);
    const p2 = project(u + Math.cos(a) * 16, w + Math.sin(a) * 16);
    ctx.strokeStyle = "#cfc4a6";
    ctx.lineWidth = 3.4 * p1.s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.fillStyle = "#d8cdb0";
    for (const p of [p1, p2]) {
        ctx.beginPath();
        ctx.arc(p.x - 1.5, p.y, 2.6 * p.s, 0, Math.PI * 2);
        ctx.arc(p.x + 1.5, p.y, 2.6 * p.s, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawFloorSkull(ctx, rand, u, w) {
    const p = project(u, w);
    drawSkull(ctx, p.x, p.y - 6 * p.s, 9 * p.s, rand);
}

export function drawSkull(ctx, x, y, r, rand) {
    ctx.save();
    ctx.fillStyle = "#d6cbae";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - r * 0.55, y + r * 0.4, r * 1.1, r * 0.6);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, 0, x, y, r * 1.2);
    g.addColorStop(0, "rgba(255,255,240,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#120a08";
    ctx.beginPath();
    ctx.ellipse(x - r * 0.38, y + r * 0.05, r * 0.26, r * 0.3, 0, 0, Math.PI * 2);
    ctx.ellipse(x + r * 0.38, y + r * 0.05, r * 0.26, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.35);
    ctx.lineTo(x - r * 0.1, y + r * 0.55);
    ctx.lineTo(x + r * 0.1, y + r * 0.55);
    ctx.fill();
    ctx.strokeStyle = "#120a08";
    ctx.lineWidth = Math.max(0.6, r * 0.08);
    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * r * 0.18, y + r * 0.72);
        ctx.lineTo(x + i * r * 0.18, y + r * 0.98);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(6,4,4,0.9)";
    ctx.lineWidth = Math.max(0.8, r * 0.1);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.9, 0, Math.PI * 0.85, Math.PI * 2.15);
    ctx.stroke();
    ctx.restore();
}

// ─── Back wall ───────────────────────────────────────────────────────────

function drawBackWall(ctx, rand) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(WALL_L, 0, WALL_R - WALL_L, WALL_BASE_Y);
    ctx.clip();

    // Ashlar masonry behind everything
    const stone = [70, 72, 76];
    ctx.fillStyle = rgb(shadeC(stone, -30));
    ctx.fillRect(WALL_L, 0, WALL_R - WALL_L, WALL_BASE_Y);
    for (let y = 0, row = 0; y < WALL_BASE_Y; y += 24, row++) {
        let x = WALL_L - (row % 2) * 26 - rand() * 10;
        while (x < WALL_R) {
            const bw = 44 + rand() * 30;
            const c = shadeC(stone, (rand() - 0.5) * 18);
            ctx.fillStyle = rgb(c);
            ctx.fillRect(x + 1.5, y + 1.5, bw - 3, 21);
            ctx.fillStyle = "rgba(255, 245, 225, 0.06)";
            ctx.fillRect(x + 1.5, y + 1.5, bw - 3, 2);
            ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
            ctx.fillRect(x + 1.5, y + 19.5, bw - 3, 3);
            x += bw;
        }
    }

    drawFrieze(ctx, rand);

    // Shelf bays between pillars, and the door bay at the centre
    for (let i = 0; i < PILLARS.length - 1; i++) {
        const a = PILLARS[i], b = PILLARS[i + 1];
        const x0 = a + pillarWidth(a) / 2, x1 = b - pillarWidth(b) / 2;
        if (DOOR_PILLARS.has(a) && DOOR_PILLARS.has(b)) drawDoorBay(ctx, rand, x0, x1);
        else drawShelfBay(ctx, rand, x0, x1);
    }

    drawPlinth(ctx, rand);
    for (const x of PILLARS) drawPillar(ctx, rand, x, pillarWidth(x), SCONCE_PILLARS.has(x));

    // Red thread strung between the pillars, hung with notes
    for (let i = 0; i < PILLARS.length - 1; i++) {
        const a = PILLARS[i], b = PILLARS[i + 1];
        if (DOOR_PILLARS.has(a) && DOOR_PILLARS.has(b)) continue;
        drawThread(ctx, rand, a + 8, b - 8, 112 + rand() * 10, 10 + rand() * 10);
    }

    // Tattered banners flanking the door
    drawBanner(ctx, rand, 672, 6, 236);
    drawBanner(ctx, rand, 928, 6, 228);

    // The wall rises into darkness
    const dark = ctx.createLinearGradient(0, 0, 0, 120);
    dark.addColorStop(0, "rgba(2, 1, 1, 0.97)");
    dark.addColorStop(0.55, "rgba(2, 1, 1, 0.55)");
    dark.addColorStop(1, "rgba(2, 1, 1, 0)");
    ctx.fillStyle = dark;
    ctx.fillRect(WALL_L, 0, WALL_R - WALL_L, 120);
    ctx.restore();
}

function pillarWidth(x) {
    return DOOR_PILLARS.has(x) ? 42 : 34;
}

function drawFrieze(ctx, rand) {
    const y0 = 34, y1 = 54;
    ctx.fillStyle = "#4a4b4f";
    ctx.fillRect(WALL_L, y0, WALL_R - WALL_L, y1 - y0);
    ctx.fillStyle = "rgba(255, 245, 225, 0.1)";
    ctx.fillRect(WALL_L, y0, WALL_R - WALL_L, 2);
    // Dentils
    for (let x = WALL_L; x < WALL_R; x += 12) {
        ctx.fillStyle = "#2a2b2e";
        ctx.fillRect(x + 2, y0 + 6, 7, 8);
        ctx.fillStyle = "rgba(255,245,225,0.08)";
        ctx.fillRect(x + 2, y0 + 6, 7, 1.5);
    }
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(WALL_L, y1 - 3, WALL_R - WALL_L, 3);
    inkLine(ctx, rand, WALL_L, y0, WALL_R, y0, 1.4);
    inkLine(ctx, rand, WALL_L, y1, WALL_R, y1, 1.6);
}

function archPath(ctx, x0, x1, spring, apex, bottom) {
    const cx = (x0 + x1) / 2;
    ctx.beginPath();
    ctx.moveTo(x0, bottom);
    ctx.lineTo(x0, spring);
    ctx.quadraticCurveTo(x0, apex + (spring - apex) * 0.2, cx, apex);
    ctx.quadraticCurveTo(x1, apex + (spring - apex) * 0.2, x1, spring);
    ctx.lineTo(x1, bottom);
    ctx.closePath();
}

export const BOOK_COLORS = [
    [92, 26, 20], [70, 44, 24], [36, 54, 40], [34, 42, 60], [92, 72, 38],
    [52, 34, 52], [104, 62, 30], [30, 28, 26], [120, 104, 70], [62, 20, 18], [48, 40, 34]
];

function drawShelfBay(ctx, rand, x0, x1) {
    const cx = (x0 + x1) / 2;
    const spring = 96, apex = 62;
    const toward = Math.sign(VP_X - cx);            // which inner side face is visible
    const faceW = 4 + Math.abs(cx - VP_X) * 0.008;

    ctx.save();
    archPath(ctx, x0, x1, spring, apex, PLINTH_Y);
    ctx.clip();

    // Dark wood back panel
    const back = ctx.createLinearGradient(0, apex, 0, PLINTH_Y);
    back.addColorStop(0, "#120b07");
    back.addColorStop(1, "#24170e");
    ctx.fillStyle = back;
    ctx.fillRect(x0, apex, x1 - x0, PLINTH_Y - apex);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    for (let x = x0 + 9; x < x1; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x, apex);
        ctx.lineTo(x, PLINTH_Y);
        ctx.stroke();
    }

    // Stone tracery in the arch head: a trefoil cut through a stone panel
    const tTop = apex, tBot = 104;
    ctx.fillStyle = "#56575b";
    ctx.fillRect(x0, tTop, x1 - x0, tBot - tTop);
    hatch(ctx, rand, x0, tTop, x1 - x0, tBot - tTop, { angle: 0.7, gap: 4, alpha: 0.15 });
    const tc = { x: cx, y: (tTop + tBot) / 2 + 6 };
    ctx.fillStyle = "#0b0705";
    for (const [dx, dy] of [[0, -7], [-7, 4], [7, 4]]) {
        ctx.beginPath();
        ctx.arc(tc.x + dx, tc.y + dy, 6.5, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.strokeStyle = "rgba(6,4,4,0.9)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(tc.x, tc.y, 15, 0, Math.PI * 2);
    ctx.stroke();
    inkLine(ctx, rand, x0, tBot, x1, tBot, 1.6);

    // Shelf rows
    let top = tBot + 4;
    for (const board of SHELF_BOARDS) {
        drawShelfRow(ctx, rand, x0 + 3, x1 - 3, top, board - 3);
        // Shadow under the board above
        const sh = ctx.createLinearGradient(0, top - 4, 0, top + 14);
        sh.addColorStop(0, "rgba(0,0,0,0.7)");
        sh.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sh;
        ctx.fillRect(x0, top - 4, x1 - x0, 18);
        if (board !== PLINTH_Y) {
            // Board: visible top face, then the front edge
            ctx.fillStyle = "#5a3e26";
            ctx.fillRect(x0, board - 4, x1 - x0, 4);
            ctx.fillStyle = "#2c1b10";
            ctx.fillRect(x0, board, x1 - x0, 6);
            ctx.fillStyle = "rgba(255, 220, 170, 0.12)";
            ctx.fillRect(x0, board, x1 - x0, 1);
            inkLine(ctx, rand, x0, board - 4, x1, board - 4, 0.9, 0.7);
            inkLine(ctx, rand, x0, board + 6, x1, board + 6, 1.2);
        }
        top = board + 8;
    }

    // Inner side face of the niche (perspective: the face turned toward the viewer)
    ctx.fillStyle = "#2c1d12";
    ctx.beginPath();
    if (toward > 0) {
        ctx.moveTo(x0, apex);
        ctx.lineTo(x0 + faceW, apex + 6);
        ctx.lineTo(x0 + faceW, PLINTH_Y);
        ctx.lineTo(x0, PLINTH_Y);
    } else {
        ctx.moveTo(x1, apex);
        ctx.lineTo(x1 - faceW, apex + 6);
        ctx.lineTo(x1 - faceW, PLINTH_Y);
        ctx.lineTo(x1, PLINTH_Y);
    }
    ctx.closePath();
    ctx.fill();

    // Niche occlusion: darker toward the edges and the arch
    for (const [gx0, gx1] of [[x0, x0 + 26], [x1, x1 - 26]]) {
        const g = ctx.createLinearGradient(gx0, 0, gx1, 0);
        g.addColorStop(0, "rgba(0,0,0,0.6)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(Math.min(gx0, gx1), apex, 26, PLINTH_Y - apex);
    }

    // Cobwebs in the top corners
    drawCobweb(ctx, rand, x0 + 1, tBot + 5, 1);
    if (rand() < 0.6) drawCobweb(ctx, rand, x1 - 1, tBot + 5, -1);
    ctx.restore();

    // Arch moulding outline
    ctx.save();
    archPath(ctx, x0, x1, spring, apex, PLINTH_Y);
    ctx.strokeStyle = "rgba(255, 240, 215, 0.12)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(6, 4, 4, 0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
}

function drawShelfRow(ctx, rand, x0, x1, top, floor) {
    const rowH = floor - top;
    let x = x0;
    let skullDone = false;
    while (x < x1 - 4) {
        const r = rand();
        if (r < 0.05) { x += 6 + rand() * 10; continue; }
        if (r < 0.13 && x1 - x > 34) {
            x += drawBookStack(ctx, rand, x, floor, Math.min(30, x1 - x - 2));
            continue;
        }
        if (r < 0.18 && x1 - x > 22) {
            x += drawScrolls(ctx, rand, x, floor);
            continue;
        }
        if (r < 0.21 && !skullDone && x1 - x > 22) {
            skullDone = true;
            drawSkull(ctx, x + 10, floor - 9, 8, rand);
            x += 21;
            continue;
        }
        if (r < 0.24 && x1 - x > 14) {
            drawJar(ctx, rand, x + 6, floor, Math.min(rowH - 6, 20));
            x += 14;
            continue;
        }
        const bw = Math.min(x1 - x, 5 + rand() * 8);
        const bh = rowH * (0.62 + rand() * 0.33);
        if (rand() < 0.07 && x1 - x > 14) {
            // Leaning book
            ctx.save();
            ctx.translate(x + 2, floor);
            ctx.rotate(-0.28);
            drawBook(ctx, rand, 0, -bh, bw, bh);
            ctx.restore();
            x += bw + 6;
            continue;
        }
        drawBook(ctx, rand, x, floor - bh, bw, bh);
        x += bw + 0.6;
    }
}

function drawBook(ctx, rand, x, y, w, h) {
    const c = shadeC(BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)], (rand() - 0.5) * 16);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, rgb(shadeC(c, -22)));
    g.addColorStop(0.35, rgb(shadeC(c, 18)));
    g.addColorStop(1, rgb(shadeC(c, -30)));
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    // Gilt bands and a title label
    if (w > 5) {
        ctx.fillStyle = "rgba(190, 150, 80, 0.45)";
        ctx.fillRect(x + 0.5, y + h * 0.12, w - 1, 1);
        ctx.fillRect(x + 0.5, y + h * 0.84, w - 1, 1);
        if (rand() < 0.35) {
            ctx.fillStyle = "rgba(210, 195, 160, 0.4)";
            ctx.fillRect(x + 1.2, y + h * 0.3, w - 2.4, h * 0.14);
        }
    }
    // Torn top / worn spine
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x + w - 0.8, y, 0.8, h);
    ctx.fillStyle = "rgba(255,235,200,0.08)";
    ctx.fillRect(x, y, w, 1);
}

function drawBookStack(ctx, rand, x, floor, maxW) {
    const n = 2 + Math.floor(rand() * 3);
    let y = floor;
    let width = 0;
    for (let i = 0; i < n; i++) {
        const bw = Math.min(maxW, 20 + rand() * 9);
        const bh = 4 + rand() * 3;
        const off = (rand() - 0.5) * 3;
        const c = BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)];
        ctx.fillStyle = rgb(c);
        ctx.fillRect(x + off, y - bh, bw, bh);
        ctx.fillStyle = "#cfc2a0";
        ctx.fillRect(x + off + bw - 2, y - bh + 1, 2, bh - 2);
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(x + off, y - 0.8, bw, 0.8);
        y -= bh;
        width = Math.max(width, bw + off);
    }
    return width + 3;
}

function drawScrolls(ctx, rand, x, floor) {
    const rad = 4.2;
    const pts = [[rad, -rad], [rad * 3, -rad], [rad * 2, -rad * 2.7]];
    for (const [dx, dy] of pts) {
        ctx.fillStyle = "#d6c9a6";
        ctx.beginPath();
        ctx.arc(x + dx, floor + dy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(6,4,4,0.8)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.fillStyle = "#6b5a3a";
        ctx.beginPath();
        ctx.arc(x + dx, floor + dy, 1.4, 0, Math.PI * 2);
        ctx.fill();
        if (rand() < 0.5) {
            ctx.fillStyle = "#8a140e";
            ctx.beginPath();
            ctx.arc(x + dx + rad * 0.6, floor + dy + rad * 0.5, 1.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    return rad * 4 + 3;
}

function drawJar(ctx, rand, x, floor, h) {
    const w = 10;
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, "rgba(40, 60, 50, 0.85)");
    g.addColorStop(0.3, "rgba(120, 150, 130, 0.6)");
    g.addColorStop(1, "rgba(20, 30, 25, 0.9)");
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, floor - h, w, h);
    ctx.fillStyle = rand() < 0.5 ? "rgba(90, 20, 15, 0.85)" : "rgba(30, 25, 15, 0.9)";
    ctx.fillRect(x - w / 2 + 1, floor - h * 0.55, w - 2, h * 0.55 - 1);
    ctx.fillStyle = "#3a2a1a";
    ctx.fillRect(x - w / 2 - 0.5, floor - h - 3, w + 1, 3);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x - w / 2 + 2, floor - h + 2, 1.2, h - 5);
    ctx.strokeStyle = "rgba(6,4,4,0.8)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x - w / 2, floor - h, w, h);
}

function drawCobweb(ctx, rand, x, y, dir) {
    ctx.save();
    ctx.strokeStyle = "rgba(220, 215, 205, 0.16)";
    ctx.lineWidth = 0.6;
    const R = 20 + rand() * 10;
    const spokes = 5;
    for (let i = 0; i <= spokes; i++) {
        const a = (i / spokes) * (Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dir * Math.cos(a) * R, y + Math.sin(a) * R);
        ctx.stroke();
    }
    for (let r = 6; r < R; r += 5) {
        ctx.beginPath();
        for (let i = 0; i <= spokes; i++) {
            const a = (i / spokes) * (Math.PI / 2);
            const px = x + dir * Math.cos(a) * r, py = y + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.quadraticCurveTo(x + dir * Math.cos(a - 0.15) * r * 0.85, y + Math.sin(a - 0.15) * r * 0.85, px, py);
        }
        ctx.stroke();
    }
    ctx.restore();
}

function drawDoorBay(ctx, rand, x0, x1) {
    const cx = (x0 + x1) / 2;
    const spring = 118, apex = 58;

    // Deep recess
    ctx.save();
    archPath(ctx, x0, x1, spring, apex, PLINTH_Y + 32);
    ctx.clip();
    const g = ctx.createLinearGradient(0, apex, 0, WALL_BASE_Y);
    g.addColorStop(0, "#020101");
    g.addColorStop(0.7, "#0b0605");
    g.addColorStop(1, "#1a0806");
    ctx.fillStyle = g;
    ctx.fillRect(x0, apex, x1 - x0, WALL_BASE_Y - apex);
    // Receding archivolts: concentric arches shrinking toward the vanishing point
    for (let i = 1; i <= 4; i++) {
        const inset = i * 9;
        ctx.save();
        archPath(ctx, x0 + inset, x1 - inset, spring + inset * 0.6, apex + inset * 0.9, WALL_BASE_Y + 40);
        ctx.strokeStyle = `rgba(110, 108, 112, ${0.38 - i * 0.07})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = "rgba(6, 4, 4, 0.8)";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();

    // Carved roundel with the Watcher's eye above the door
    const ey = 122, r = 22;
    ctx.save();
    ctx.fillStyle = "#5c5d61";
    ctx.beginPath();
    ctx.arc(cx, ey, r, 0, Math.PI * 2);
    ctx.fill();
    hatch(ctx, rand, cx - r, ey - r, r * 2, r * 2, { angle: 0.6, gap: 3.5, alpha: 0.12 });
    ctx.strokeStyle = "rgba(6,4,4,0.95)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, ey, r - 5, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#1a1210";
    ctx.beginPath();
    ctx.moveTo(cx - 13, ey);
    ctx.quadraticCurveTo(cx, ey - 10, cx + 13, ey);
    ctx.quadraticCurveTo(cx, ey + 10, cx - 13, ey);
    ctx.fill();
    const iris = ctx.createRadialGradient(cx, ey, 0, cx, ey, 6);
    iris.addColorStop(0, "#ffb070");
    iris.addColorStop(0.5, "#c2241a");
    iris.addColorStop(1, "#3a0604");
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(cx, ey, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#050000";
    ctx.fillRect(cx - 1, ey - 4, 2, 8);
    ctx.restore();

    // Recess arch outline
    ctx.save();
    archPath(ctx, x0, x1, spring, apex, PLINTH_Y + 32);
    ctx.strokeStyle = "rgba(6,4,4,0.95)";
    ctx.lineWidth = 2.4;
    ctx.stroke();
    ctx.restore();
}

function drawPlinth(ctx, rand) {
    const y0 = PLINTH_Y, y1 = WALL_BASE_Y;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, "#5b5c60");
    g.addColorStop(0.25, "#46474b");
    g.addColorStop(1, "#2a2b2e");
    ctx.fillStyle = g;
    ctx.fillRect(WALL_L, y0, 700 - WALL_L - 20, y1 - y0);
    ctx.fillRect(920, y0, WALL_R - 920, y1 - y0);
    for (const [a, b] of [[WALL_L, 680], [920, WALL_R]]) {
        for (let x = a; x < b; x += 58 + rand() * 20) {
            inkLine(ctx, rand, x, y0 + 6, x, y1, 0.9, 0.6);
        }
        ctx.fillStyle = "rgba(255, 245, 225, 0.12)";
        ctx.fillRect(a, y0, b - a, 2);
        inkLine(ctx, rand, a, y0, b, y0, 1.6);
        inkLine(ctx, rand, a, y0 + 6, b, y0 + 6, 0.9, 0.6);
        ctx.save();
        ctx.beginPath();
        ctx.rect(a, y0 + 8, b - a, y1 - y0 - 8);
        ctx.clip();
        hatch(ctx, rand, a, y0 + 8, b - a, y1 - y0 - 8, { angle: 0.9, gap: 3.5, alpha: 0.2 });
        ctx.restore();
    }
}

function drawPillar(ctx, rand, cx, w, sconce) {
    const x0 = cx - w / 2, x1 = cx + w / 2;
    // Shaft with cylindrical shading (light from the front-left)
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, "#202124");
    g.addColorStop(0.22, "#55575b");
    g.addColorStop(0.45, "#66676b");
    g.addColorStop(0.75, "#3a3b3f");
    g.addColorStop(1, "#151518");
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, w, PLINTH_Y);
    // Fluting
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.2;
    for (const t of [0.3, 0.5, 0.7]) {
        ctx.beginPath();
        ctx.moveTo(x0 + w * t, 74);
        ctx.lineTo(x0 + w * t, PLINTH_Y - 18);
        ctx.stroke();
    }
    // Shadow side hatching
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0 + w * 0.68, 0, w * 0.32, PLINTH_Y);
    ctx.clip();
    hatch(ctx, rand, x0 + w * 0.6, 0, w * 0.4, PLINTH_Y, { angle: 1.15, gap: 3, alpha: 0.35, cross: true });
    ctx.restore();
    // Capital
    const cw = w + 12;
    ctx.fillStyle = "#5e5f63";
    ctx.fillRect(cx - cw / 2, 58, cw, 14);
    ctx.fillStyle = "rgba(255,245,225,0.14)";
    ctx.fillRect(cx - cw / 2, 58, cw, 2);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(cx - cw / 2, 68, cw, 4);
    inkPoly(ctx, rand, [{ x: cx - cw / 2, y: 58 }, { x: cx + cw / 2, y: 58 }, { x: cx + cw / 2, y: 72 }, { x: cx - cw / 2, y: 72 }], 1.3);
    // Base
    const bw = w + 14;
    ctx.fillStyle = "#4e4f53";
    ctx.fillRect(cx - bw / 2, PLINTH_Y - 18, bw, WALL_BASE_Y - PLINTH_Y + 18);
    ctx.fillStyle = "rgba(255,245,225,0.12)";
    ctx.fillRect(cx - bw / 2, PLINTH_Y - 18, bw, 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx + bw * 0.15, PLINTH_Y - 18, bw * 0.35, 50);
    ctx.clip();
    hatch(ctx, rand, cx, PLINTH_Y - 18, bw / 2, 50, { angle: 1.1, gap: 3, alpha: 0.3 });
    ctx.restore();
    inkPoly(ctx, rand, [{ x: cx - bw / 2, y: PLINTH_Y - 18 }, { x: cx + bw / 2, y: PLINTH_Y - 18 }, { x: cx + bw / 2, y: WALL_BASE_Y }, { x: cx - bw / 2, y: WALL_BASE_Y }], 1.4);
    // Cracks
    if (rand() < 0.6) {
        let x = x0 + w * (0.2 + rand() * 0.5), y = 90 + rand() * 120;
        ctx.strokeStyle = "rgba(6,4,4,0.8)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let i = 0; i < 4; i++) {
            x += (rand() - 0.5) * 6;
            y += 6 + rand() * 8;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    }
    inkLine(ctx, rand, x0, 0, x0, PLINTH_Y - 18, 1.8);
    inkLine(ctx, rand, x1, 0, x1, PLINTH_Y - 18, 2.2);

    if (sconce) drawSconceBracket(ctx, rand, cx, SCONCE_Y, 1);
}

// Iron sconce: wall plate, arm, drip dish and two tallow candles (flames are animated at runtime)
function drawSconceBracket(ctx, rand, x, y, s) {
    // Soot climbing the stone above the flames
    const soot = ctx.createRadialGradient(x, y - 40 * s, 0, x, y - 40 * s, 46 * s);
    soot.addColorStop(0, "rgba(0,0,0,0.55)");
    soot.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = soot;
    ctx.beginPath();
    ctx.ellipse(x, y - 40 * s, 22 * s, 50 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "#151311";
    ctx.beginPath();
    ctx.moveTo(-5, 4);
    ctx.lineTo(5, 4);
    ctx.lineTo(4, 22);
    ctx.lineTo(0, 27);
    ctx.lineTo(-4, 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#151311";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, 18);
    ctx.quadraticCurveTo(0, 6, 0, 2);
    ctx.stroke();
    ctx.fillStyle = "#1c1916";
    ctx.beginPath();
    ctx.ellipse(0, 1, 12, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(160,140,110,0.35)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(0, 0.5, 12, 3.2, 0, Math.PI, Math.PI * 2);
    ctx.stroke();
    for (const [dx, hh] of SCONCE_CANDLES) {
        const cg = ctx.createLinearGradient(dx - 2.5, 0, dx + 2.5, 0);
        cg.addColorStop(0, "#6f6250");
        cg.addColorStop(0.45, "#dccfae");
        cg.addColorStop(1, "#5c5142");
        ctx.fillStyle = cg;
        ctx.fillRect(dx - 2.5, -hh, 5, hh);
        ctx.fillStyle = "#d2c5a2";
        ctx.fillRect(dx - 2.5, -hh, 1.3, 4 + rand() * 4);
        ctx.fillStyle = "#120a06";
        ctx.fillRect(dx - 0.4, -hh - 2.5, 0.8, 2.5);
    }
    ctx.restore();
}

// A long oxblood banner, gold-edged, bearing the Watcher's eye, frayed at the hem
function drawBanner(ctx, rand, cx, top, bottom) {
    const w = 46;
    const x0 = cx - w / 2, x1 = cx + w / 2;
    // Hanging rod
    ctx.fillStyle = "#151311";
    ctx.fillRect(x0 - 8, top + 30, w + 16, 4);
    ctx.fillStyle = "#2a2622";
    ctx.beginPath();
    ctx.arc(x0 - 8, top + 32, 3.5, 0, Math.PI * 2);
    ctx.arc(x1 + 8, top + 32, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Cloth with a slight drape
    const path = () => {
        ctx.beginPath();
        ctx.moveTo(x0, top + 32);
        ctx.lineTo(x1, top + 32);
        ctx.quadraticCurveTo(x1 + 3, (top + bottom) / 2, x1 - 1, bottom - 14);
        // Ragged hem
        const teeth = 7;
        for (let i = 0; i <= teeth; i++) {
            const tx = x1 - 1 - ((w - 2) * i) / teeth;
            const ty = bottom - 14 + (i % 2 ? 14 + rand() * 6 : rand() * 4);
            ctx.lineTo(tx, ty);
        }
        ctx.quadraticCurveTo(x0 - 3, (top + bottom) / 2, x0, top + 32);
        ctx.closePath();
    };
    ctx.save();
    path();
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, "#2a0605");
    g.addColorStop(0.3, "#6e130e");
    g.addColorStop(0.55, "#7d1811");
    g.addColorStop(1, "#2a0605");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.clip();
    // Fold shading
    for (const fx of [0.25, 0.62]) {
        const fg = ctx.createLinearGradient(x0 + w * fx - 5, 0, x0 + w * fx + 5, 0);
        fg.addColorStop(0, "rgba(0,0,0,0)");
        fg.addColorStop(0.5, "rgba(0,0,0,0.35)");
        fg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fg;
        ctx.fillRect(x0 + w * fx - 5, top, 10, bottom - top);
    }
    // Gold trim
    ctx.strokeStyle = "rgba(170, 130, 60, 0.75)";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x0 + 4, top + 38, w - 8, bottom - top - 66);
    // The eye sigil
    const ey = top + 92;
    ctx.fillStyle = "rgba(190, 150, 80, 0.85)";
    ctx.beginPath();
    ctx.moveTo(cx - 14, ey);
    ctx.quadraticCurveTo(cx, ey - 11, cx + 14, ey);
    ctx.quadraticCurveTo(cx, ey + 11, cx - 14, ey);
    ctx.fill();
    ctx.fillStyle = "#2a0605";
    ctx.beginPath();
    ctx.arc(cx, ey, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(190, 150, 80, 0.85)";
    ctx.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 6, ey - 12);
        ctx.lineTo(cx + i * 7.5, ey - 17);
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx, ey + 14);
    ctx.lineTo(cx, ey + 46);
    ctx.moveTo(cx - 8, ey + 26);
    ctx.lineTo(cx + 8, ey + 26);
    ctx.stroke();
    hatch(ctx, rand, x0, top, w, bottom - top, { angle: 1.35, gap: 4, alpha: 0.18 });
    ctx.restore();
    path();
    ctx.strokeStyle = "rgba(6,4,4,0.95)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
}

function drawThread(ctx, rand, x0, x1, y, sag) {
    const mx = (x0 + x1) / 2;
    // Cast shadow on the shelves behind
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x0 + 2, y + 5);
    ctx.quadraticCurveTo(mx + 2, y + sag * 2 + 5, x1 + 2, y + 5);
    ctx.stroke();
    ctx.strokeStyle = "#8f1a12";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(mx, y + sag * 2, x1, y);
    ctx.stroke();
    // Notes pinned along the thread
    const n = 2 + Math.floor(rand() * 2);
    for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
        const py = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * (y + sag * 2) + t * t * y;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((rand() - 0.5) * 0.35);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(-6, 3, 13, 16);
        ctx.fillStyle = `rgb(${200 + rand() * 25}, ${185 + rand() * 20}, ${145 + rand() * 20})`;
        ctx.fillRect(-7, 0, 13, 16);
        ctx.fillStyle = "rgba(40, 24, 12, 0.55)";
        for (let k = 0; k < 4; k++) ctx.fillRect(-5, 4 + k * 3, 8 + rand() * 1, 0.8);
        ctx.strokeStyle = "rgba(6,4,4,0.7)";
        ctx.lineWidth = 0.7;
        ctx.strokeRect(-7, 0, 13, 16);
        ctx.fillStyle = "#8a140e";
        ctx.beginPath();
        ctx.arc(-0.5, 1, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ─── Side walls ──────────────────────────────────────────────────────────

function drawSideWall(ctx, rand, side) {
    const U = side * HALF_U;
    const corner = project(U, BACK_W);
    const front = project(U, 0);
    const topBack = project(U, BACK_W, WALL_TOP_H);
    const topFront = project(U, 0, WALL_TOP_H);
    const region = [topBack, corner, front, topFront];

    ctx.save();
    pathPoly(ctx, region);
    ctx.clip();
    ctx.fillStyle = "#16171a";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Masonry courses converging on the vanishing point
    const courseH = 30;
    for (let h = 0, row = 0; h < WALL_TOP_H; h += courseH, row++) {
        let w = BACK_W + (row % 2) * 40 + rand() * 20;
        while (w > -60) {
            const bw = 80 + rand() * 50;
            const q = [project(U, w, h + courseH - 2), project(U, w - bw + 3, h + courseH - 2), project(U, w - bw + 3, h + 2), project(U, w, h + 2)];
            const tone = 52 + rand() * 14;
            pathPoly(ctx, q);
            ctx.fillStyle = rgb([tone, tone + 1, tone + 5]);
            ctx.fill();
            ctx.strokeStyle = "rgba(6,5,5,0.85)";
            ctx.lineWidth = 1;
            ctx.stroke();
            w -= bw;
        }
    }

    // Pilasters
    for (const wp of [1180, 720, 260]) {
        const q = [project(U, wp + 24, WALL_TOP_H), project(U, wp - 24, WALL_TOP_H), project(U, wp - 24, 0), project(U, wp + 24, 0)];
        pathPoly(ctx, q);
        ctx.fillStyle = "#4a4b50";
        ctx.fill();
        ctx.save();
        ctx.clip();
        hatch(ctx, rand, Math.min(q[0].x, q[2].x) - 10, 0, 60, WORLD_HEIGHT, { angle: 1.2, gap: 3.2, alpha: 0.25 });
        ctx.restore();
        inkPoly(ctx, rand, q, 1.6);
    }

    // Skirting course along the base
    const sk = [project(U, BACK_W, 28), project(U, 0, 28), project(U, 0, 0), project(U, BACK_W, 0)];
    pathPoly(ctx, sk);
    ctx.fillStyle = "#3e3f43";
    ctx.fill();
    inkPoly(ctx, rand, sk, 1.4);

    for (const w of [1040, 420]) {
        const p = project(U, w, 175);
        drawSconceBracket(ctx, rand, p.x - side * 2 * p.s, p.y, p.s);
    }

    // Shade: the side walls catch less light, deepest near the back corner
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    hatch(ctx, rand, side < 0 ? 0 : WALL_R - 20, 0, WALL_L + 40, WORLD_HEIGHT, { angle: side < 0 ? 0.5 : 2.6, gap: 4, alpha: 0.14 });
    // Rising into darkness
    const dark = ctx.createLinearGradient(0, 0, 0, 760);
    dark.addColorStop(0, "rgba(2,1,1,0.97)");
    dark.addColorStop(0.6, "rgba(2,1,1,0.5)");
    dark.addColorStop(1, "rgba(2,1,1,0)");
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, WORLD_WIDTH, 760);
    ctx.restore();

    // Corner edge
    inkLine(ctx, rand, corner.x, corner.y, corner.x, 0, 2.2);
}

// ─── Finishing ───────────────────────────────────────────────────────────

function drawFinish(ctx) {
    // Paper-grain over everything for a printed, inked feel
    const grain = makeGrain();
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = ctx.createPattern(grain, "repeat");
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.restore();
}
