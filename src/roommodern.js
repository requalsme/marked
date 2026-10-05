// The Keeping House in the present day (ERA === "present"): the same room,
// same geometry and the same places for everything, rebuilt as a 2026
// records sub-level. Painted block walls, steel archive shelving, concrete
// columns, conduit and ducting overhead, a sealed steel door, and a polished
// concrete floor with safety lines that the Monolith has cracked open.
// Drawn in the same ink-and-hatch style as the old archive (world.js).

import {
    WORLD_WIDTH, WORLD_HEIGHT, WALL_BASE_Y, GEOM, project, mulberry32, rgb, shadeC,
    pathPoly, inkLine, inkPoly, hatch, blotch, makeGrain, pillarWidth
} from "./world.js";

const { BACK_W, HALF_U, WALL_L, WALL_R, WALL_TOP_H, PILLARS, DOOR_PILLARS } = GEOM;
const FLOOR_PTS = () => [project(-HALF_U, BACK_W), project(HALF_U, BACK_W), project(HALF_U, 0), project(-HALF_U, 0)];
const PAINT = [92, 98, 96];       // institutional grey-green block paint
const DADO = [58, 66, 64];        // darker band painted up to waist height
const DADO_TOP = 170;             // screen y where the dark band ends

export function buildModernRoom(scale = 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(WORLD_WIDTH * scale);
    canvas.height = Math.round(WORLD_HEIGHT * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    const rand = mulberry32(2026);
    ctx.fillStyle = "#030303";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    drawSideWall(ctx, rand, -1);
    drawSideWall(ctx, rand, 1);
    drawBackWall(ctx, rand);
    drawFloor(ctx, rand);
    // Same printed grain as the old archive
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = ctx.createPattern(makeGrain(), "repeat");
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.restore();
    return canvas;
}

// ─── Back wall ───────────────────────────────────────────────────────────

function blockWall(ctx, rand, x0, x1, y0, y1) {
    // Concrete block coursing, painted over: soft joints, a few chips and stains
    ctx.fillStyle = rgb(PAINT);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let y = y0, row = 0; y < y1; y += 20, row++) {
        const col = y > DADO_TOP ? DADO : PAINT;
        let x = x0 - (row % 2) * 20;
        while (x < x1) {
            ctx.fillStyle = rgb(shadeC(col, (rand() - 0.5) * 7));
            ctx.fillRect(x + 1, y + 1, 39, 18);
            x += 40;
        }
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x0, y + 19, x1 - x0, 1.2);
    }
    // Waist stripe between the two paint colours
    ctx.fillStyle = "#7a2a22";
    ctx.fillRect(x0, DADO_TOP - 3, x1 - x0, 3);
    for (let i = 0; i < 26; i++) {
        const x = x0 + rand() * (x1 - x0), y = y0 + 40 + rand() * (y1 - y0 - 40);
        const g = ctx.createLinearGradient(0, y, 0, y + 30 + rand() * 60);
        g.addColorStop(0, "rgba(30, 24, 18, 0.25)");
        g.addColorStop(1, "rgba(30, 24, 18, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 2 + rand() * 6, 90);
    }
}

function drawBackWall(ctx, rand) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(WALL_L, 0, WALL_R - WALL_L, WALL_BASE_Y);
    ctx.clip();
    blockWall(ctx, rand, WALL_L, WALL_R, 0, WALL_BASE_Y);

    // Bays between the columns: lockers, archive shelving, the plant corner
    const kinds = ["lockers", "boxes", "binders", null, "binders", "boxes", "plant"];
    for (let i = 0; i < PILLARS.length - 1; i++) {
        const a = PILLARS[i], b = PILLARS[i + 1];
        const x0 = a + pillarWidth(a) / 2, x1 = b - pillarWidth(b) / 2;
        if (DOOR_PILLARS.has(a) && DOOR_PILLARS.has(b)) drawDoorBay(ctx, rand, x0, x1);
        else if (kinds[i] === "lockers") drawLockers(ctx, rand, x0 + 6, x1 - 6);
        else if (kinds[i] === "plant") drawPlantCorner(ctx, rand, x0, x1);
        else drawShelving(ctx, rand, x0 + 4, x1 - 4, kinds[i]);
    }
    for (const x of PILLARS) drawColumn(ctx, rand, x, pillarWidth(x));
    drawServices(ctx, rand);
    drawSkirting(ctx, rand);

    // Stencilled level sign across the top of the wall
    ctx.save();
    ctx.font = "bold 15px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "rgba(210, 205, 190, 0.5)";
    ctx.textAlign = "center";
    ctx.fillText("SUB-LEVEL 3", 437, 86);
    ctx.fillText("RECORDS / RETENTION", 1163, 86);
    ctx.restore();

    // The wall rises into darkness above the ducts
    const dark = ctx.createLinearGradient(0, 0, 0, 110);
    dark.addColorStop(0, "rgba(2, 2, 2, 0.97)");
    dark.addColorStop(0.6, "rgba(2, 2, 2, 0.5)");
    dark.addColorStop(1, "rgba(2, 2, 2, 0)");
    ctx.fillStyle = dark;
    ctx.fillRect(WALL_L, 0, WALL_R - WALL_L, 110);
    ctx.restore();
}

// Grey steel archive shelving loaded with record boxes or ring binders
function drawShelving(ctx, rand, x0, x1, kind) {
    const top = 96, floor = WALL_BASE_Y - 4;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x0 + 3, top + 3, x1 - x0, floor - top);
    const shelves = [top, 146, 196, 246, floor - 4];
    for (let s = 0; s < shelves.length - 1; s++) {
        const y0 = shelves[s] + 4, y1 = shelves[s + 1];
        // Shadowed back of the shelf
        ctx.fillStyle = "#15171a";
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        let x = x0 + 3;
        while (x < x1 - 8) {
            if (rand() < 0.08) { x += 10 + rand() * 18; continue; }
            if (kind === "boxes") {
                const bw = 26 + rand() * 8, bh = Math.min(y1 - y0 - 2, 30 + rand() * 6);
                if (x + bw > x1 - 3) break;
                const t = 0.85 + rand() * 0.25;
                ctx.fillStyle = `rgb(${150 * t}, ${122 * t}, ${84 * t})`;
                ctx.fillRect(x, y1 - bh, bw - 2, bh);
                ctx.fillStyle = "rgba(255, 240, 210, 0.1)";
                ctx.fillRect(x, y1 - bh, bw - 2, 2);
                // Hand hole and a white label with a scrawled number
                ctx.fillStyle = "#1b1612";
                ctx.fillRect(x + bw / 2 - 5, y1 - bh + 5, 8, 3);
                ctx.fillStyle = "#e6e2d8";
                ctx.fillRect(x + 4, y1 - bh * 0.55, bw - 10, 8);
                ctx.fillStyle = "rgba(20, 20, 30, 0.7)";
                ctx.fillRect(x + 6, y1 - bh * 0.55 + 3, (bw - 14) * (0.4 + rand() * 0.5), 1.4);
                ctx.strokeStyle = "rgba(6,5,5,0.6)";
                ctx.lineWidth = 0.8;
                ctx.strokeRect(x, y1 - bh, bw - 2, bh);
                x += bw;
            } else {
                const bw = 6 + rand() * 4, bh = Math.min(y1 - y0 - 3, 34 + rand() * 6);
                if (x + bw > x1 - 3) break;
                const tones = [[40, 60, 110], [120, 30, 28], [30, 30, 32], [170, 160, 140], [40, 90, 70], [180, 140, 40]];
                const c = tones[Math.floor(rand() * tones.length)];
                const lean = rand() < 0.08 ? 3 : 0;
                ctx.fillStyle = rgb(shadeC(c, (rand() - 0.5) * 20));
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x + bw - 1, y1);
                ctx.lineTo(x + bw - 1 + lean, y1 - bh);
                ctx.lineTo(x + lean, y1 - bh);
                ctx.fill();
                ctx.fillStyle = "#e8e4da";
                ctx.fillRect(x + 1.5 + lean * 0.6, y1 - bh * 0.7, bw - 4, 7);
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                ctx.beginPath();
                ctx.arc(x + bw / 2 + lean * 0.2, y1 - bh * 0.25, 1.4, 0, Math.PI * 2);
                ctx.fill();
                x += bw;
            }
        }
        // The steel shelf lip
        ctx.fillStyle = "#7e8389";
        ctx.fillRect(x0 - 2, y1, x1 - x0 + 4, 4);
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(x0 - 2, y1, x1 - x0 + 4, 1);
    }
    // Perforated uprights
    for (const ux of [x0 - 3, x1 - 1]) {
        ctx.fillStyle = "#6b7076";
        ctx.fillRect(ux, top, 4, floor - top);
        ctx.fillStyle = "#2a2d31";
        for (let y = top + 4; y < floor; y += 6) ctx.fillRect(ux + 1.4, y, 1.2, 2.6);
        inkLine(ctx, rand, ux, top, ux, floor, 0.9, 0.7);
    }
    ctx.fillStyle = "#7e8389";
    ctx.fillRect(x0 - 3, top, x1 - x0 + 6, 4);
    hatch(ctx, rand, x0, top, x1 - x0, floor - top, { angle: 1.1, gap: 3.6, alpha: 0.1 });
}

// A bank of grey steel lockers, one door hanging open
function drawLockers(ctx, rand, x0, x1) {
    const top = 108, floor = WALL_BASE_Y - 4, n = 4, lw = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
        const lx = x0 + i * lw;
        ctx.fillStyle = rgb(shadeC([96, 104, 112], (rand() - 0.5) * 10));
        ctx.fillRect(lx, top, lw - 2, floor - top);
        // Vents and a handle
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        for (let k = 0; k < 4; k++) ctx.fillRect(lx + 6, top + 10 + k * 5, lw - 14, 2);
        for (let k = 0; k < 4; k++) ctx.fillRect(lx + 6, floor - 30 + k * 5, lw - 14, 2);
        ctx.fillStyle = "#2a2c30";
        ctx.fillRect(lx + lw - 10, top + 80, 3, 14);
        // Number plate
        ctx.fillStyle = "#d8d4c8";
        ctx.fillRect(lx + lw / 2 - 6, top + 40, 12, 7);
        ctx.fillStyle = "#222";
        ctx.font = "6px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(31 + i), lx + lw / 2, top + 46);
        ctx.strokeStyle = "rgba(6,5,5,0.8)";
        ctx.lineWidth = 1;
        ctx.strokeRect(lx, top, lw - 2, floor - top);
        if (i === 2) {
            // Open: a dark inside, a coat on the hook, the door swung toward us
            ctx.fillStyle = "#0c0d0f";
            ctx.fillRect(lx + 2, top + 2, lw - 6, floor - top - 4);
            ctx.fillStyle = "#3b3530";
            ctx.beginPath();
            ctx.moveTo(lx + lw / 2 - 2, top + 12);
            ctx.lineTo(lx + lw - 8, top + 30);
            ctx.lineTo(lx + lw - 10, top + 110);
            ctx.lineTo(lx + 8, top + 110);
            ctx.lineTo(lx + 6, top + 30);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = rgb([104, 112, 120]);
            ctx.beginPath();
            ctx.moveTo(lx + lw - 2, top);
            ctx.lineTo(lx + lw + 12, top + 6);
            ctx.lineTo(lx + lw + 12, floor - 4);
            ctx.lineTo(lx + lw - 2, floor);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(6,5,5,0.8)";
            ctx.stroke();
        }
    }
    hatch(ctx, rand, x0, top, x1 - x0, floor - top, { angle: 1.1, gap: 3.4, alpha: 0.12 });
}

// Electrical panel, a fire extinguisher, pipes dropping to the floor
function drawPlantCorner(ctx, rand, x0, x1) {
    const pnl = { x: x0 + 14, y: 128, w: 54, h: 80 };
    ctx.fillStyle = "#8c9196";
    ctx.fillRect(pnl.x, pnl.y, pnl.w, pnl.h);
    ctx.strokeStyle = "rgba(6,5,5,0.85)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(pnl.x, pnl.y, pnl.w, pnl.h);
    ctx.fillStyle = "#e9c21c";
    ctx.beginPath();
    ctx.moveTo(pnl.x + pnl.w / 2, pnl.y + 10);
    ctx.lineTo(pnl.x + pnl.w / 2 + 9, pnl.y + 26);
    ctx.lineTo(pnl.x + pnl.w / 2 - 9, pnl.y + 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.fillRect(pnl.x + pnl.w / 2 - 1, pnl.y + 15, 2, 6);
    ctx.fillRect(pnl.x + pnl.w / 2 - 1, pnl.y + 22.5, 2, 2);
    ctx.fillStyle = "#2a2c30";
    ctx.fillRect(pnl.x + pnl.w - 8, pnl.y + 40, 3, 12);
    // Conduits from the panel up into the ceiling
    for (const dx of [10, 22, 34]) {
        ctx.fillStyle = "#6e7378";
        ctx.fillRect(pnl.x + dx, 40, 4, pnl.y - 40);
        ctx.fillStyle = "rgba(255,255,255,0.15)";
        ctx.fillRect(pnl.x + dx, 40, 1, pnl.y - 40);
    }
    // Fire extinguisher on its bracket, with its sign
    const ex = x1 - 40;
    ctx.fillStyle = "#b8231b";
    ctx.beginPath();
    ctx.roundRect(ex - 7, 200, 14, 42, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(ex - 4, 205, 2, 32);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(ex - 3, 194, 6, 7);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(ex + 3, 196);
    ctx.quadraticCurveTo(ex + 12, 204, ex + 8, 226);
    ctx.stroke();
    ctx.fillStyle = "#c22a20";
    ctx.fillRect(ex - 9, 166, 18, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 5px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("FIRE", ex, 174);
    ctx.fillText("EXT.", ex, 180);
    // A floor-to-ceiling pipe with a valve wheel
    const px = x0 + 88;
    ctx.fillStyle = "#4e5a62";
    ctx.fillRect(px, 40, 10, WALL_BASE_Y - 40);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.fillRect(px + 2, 40, 2, WALL_BASE_Y - 40);
    ctx.strokeStyle = "#a02a20";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + 5, 220, 9, 0, Math.PI * 2);
    ctx.moveTo(px - 4, 220);
    ctx.lineTo(px + 14, 220);
    ctx.moveTo(px + 5, 211);
    ctx.lineTo(px + 5, 229);
    ctx.stroke();
    hatch(ctx, rand, x0, 100, x1 - x0, WALL_BASE_Y - 100, { angle: 1.1, gap: 3.8, alpha: 0.1 });
}

// Square concrete columns with steel corner guards and hazard tape at the foot
function drawColumn(ctx, rand, cx, w) {
    const x0 = cx - w / 2, x1 = cx + w / 2;
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, "#8e918f");
    g.addColorStop(0.5, "#a4a7a4");
    g.addColorStop(1, "#6a6d6c");
    ctx.fillStyle = g;
    ctx.fillRect(x0, 0, w, WALL_BASE_Y);
    // Shuttering marks, cracks and grime
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    for (let y = 30; y < WALL_BASE_Y; y += 46) ctx.fillRect(x0, y, w, 1.2);
    for (let i = 0; i < 6; i++) ctx.fillRect(x0 + rand() * w, 40 + rand() * 220, 1.2, 1.2);
    hatch(ctx, rand, cx, 0, w / 2, WALL_BASE_Y, { angle: 1.15, gap: 3, alpha: 0.2 });
    // Hazard-striped guard at the base
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, WALL_BASE_Y - 34, w, 30);
    ctx.clip();
    ctx.fillStyle = "#d8a91a";
    ctx.fillRect(x0, WALL_BASE_Y - 34, w, 30);
    ctx.fillStyle = "#111";
    for (let k = -40; k < w + 40; k += 12) {
        ctx.beginPath();
        ctx.moveTo(x0 + k, WALL_BASE_Y - 4);
        ctx.lineTo(x0 + k + 6, WALL_BASE_Y - 4);
        ctx.lineTo(x0 + k + 36, WALL_BASE_Y - 34);
        ctx.lineTo(x0 + k + 30, WALL_BASE_Y - 34);
        ctx.fill();
    }
    ctx.restore();
    // Level number stencilled on the column
    ctx.save();
    ctx.font = "bold 12px Arial, sans-serif";
    ctx.fillStyle = "rgba(30, 30, 30, 0.55)";
    ctx.textAlign = "center";
    ctx.fillText(`C${PILLARS.indexOf(cx) + 1}`, cx, 132);
    ctx.restore();
    inkLine(ctx, rand, x0, 0, x0, WALL_BASE_Y, 1.4);
    inkLine(ctx, rand, x1, 0, x1, WALL_BASE_Y, 1.4);
}

// Ducting, cable tray and sprinkler pipe running along under the ceiling
function drawServices(ctx, rand) {
    // Rectangular duct with flange seams
    ctx.fillStyle = "#7c8287";
    ctx.fillRect(WALL_L, 46, WALL_R - WALL_L, 24);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(WALL_L, 46, WALL_R - WALL_L, 3);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(WALL_L, 66, WALL_R - WALL_L, 4);
    for (let x = WALL_L + 40; x < WALL_R; x += 90) {
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(x, 46, 3, 24);
    }
    // Grilles
    for (const x of [300, 640, 960, 1300]) {
        ctx.fillStyle = "#2b2e31";
        ctx.fillRect(x, 70, 30, 8);
        ctx.fillStyle = "#575c61";
        for (let k = 0; k < 5; k++) ctx.fillRect(x + 2 + k * 6, 71, 3, 6);
    }
    inkLine(ctx, rand, WALL_L, 46, WALL_R, 46, 1.2);
    inkLine(ctx, rand, WALL_L, 70, WALL_R, 70, 1.2);
    // Cable tray with cables sagging out of it
    ctx.fillStyle = "#53585d";
    ctx.fillRect(WALL_L, 82, WALL_R - WALL_L, 5);
    ctx.strokeStyle = "#151515";
    ctx.lineWidth = 1.4;
    for (let x = WALL_L + 60; x < WALL_R - 40; x += 160 + rand() * 120) {
        ctx.beginPath();
        ctx.moveTo(x, 87);
        ctx.quadraticCurveTo(x + 20, 100 + rand() * 10, x + 50, 87);
        ctx.stroke();
    }
    // Red sprinkler main with drop heads
    ctx.fillStyle = "#8e2018";
    ctx.fillRect(WALL_L, 30, WALL_R - WALL_L, 5);
    for (let x = WALL_L + 70; x < WALL_R; x += 150) {
        ctx.fillRect(x, 35, 2, 8);
        ctx.fillStyle = "#c0a040";
        ctx.fillRect(x - 2, 42, 6, 2);
        ctx.fillStyle = "#8e2018";
    }
}

// Rubber cove skirting where wall meets floor
function drawSkirting(ctx, rand) {
    ctx.fillStyle = "#1e2022";
    ctx.fillRect(WALL_L, WALL_BASE_Y - 8, WALL_R - WALL_L, 8);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(WALL_L, WALL_BASE_Y - 8, WALL_R - WALL_L, 1);
}

// The doorway: a recessed steel frame (the door itself is a fixture), a
// keypad, warning signs, and the Watcher's eye sprayed above the lintel
function drawDoorBay(ctx, rand, x0, x1) {
    const cx = (x0 + x1) / 2;
    ctx.fillStyle = "#0b0c0d";
    ctx.fillRect(x0 + 24, 104, x1 - x0 - 48, WALL_BASE_Y - 104);
    // Steel frame
    ctx.strokeStyle = "#5e6368";
    ctx.lineWidth = 6;
    ctx.strokeRect(x0 + 27, 107, x1 - x0 - 54, WALL_BASE_Y - 104);
    ctx.strokeStyle = "rgba(6,5,5,0.95)";
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x0 + 24, 104, x1 - x0 - 48, WALL_BASE_Y - 101);
    // Lintel sign
    ctx.fillStyle = "#e6e2d6";
    ctx.fillRect(cx - 44, 86, 88, 12);
    ctx.fillStyle = "#b8231b";
    ctx.fillRect(cx - 44, 86, 88, 3);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 6.5px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AUTHORISED PERSONNEL ONLY", cx, 96);
    // Keypad and card reader beside the frame
    ctx.fillStyle = "#2a2c30";
    ctx.fillRect(x1 - 20, 186, 12, 18);
    ctx.fillStyle = "#4a8a4a";
    ctx.fillRect(x1 - 18, 188, 8, 3);
    ctx.fillStyle = "#5a5e64";
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) ctx.fillRect(x1 - 18 + c * 3, 193 + r * 3, 2, 2);
    // The eye, sprayed in red paint above it all, dripping
    const ey = 40;
    ctx.strokeStyle = "rgba(170, 24, 18, 0.85)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 34, ey + 30);
    ctx.quadraticCurveTo(cx, ey + 8, cx + 34, ey + 30);
    ctx.quadraticCurveTo(cx, ey + 52, cx - 34, ey + 30);
    ctx.stroke();
    ctx.fillStyle = "rgba(170, 24, 18, 0.85)";
    ctx.beginPath();
    ctx.arc(cx, ey + 30, 8, 0, Math.PI * 2);
    ctx.fill();
    for (const dx of [-22, -6, 10, 26]) ctx.fillRect(cx + dx, ey + 38 + rand() * 6, 1.6, 12 + rand() * 18);
}

// ─── Side walls ──────────────────────────────────────────────────────────

function drawSideWall(ctx, rand, side) {
    const U = side * HALF_U;
    const region = [project(U, BACK_W, WALL_TOP_H), project(U, BACK_W), project(U, 0), project(U, 0, WALL_TOP_H)];
    ctx.save();
    pathPoly(ctx, region);
    ctx.clip();
    ctx.fillStyle = "#1a1c1d";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    // Block courses converging on the vanishing point
    const courseH = 26;
    for (let h = 0, row = 0; h < WALL_TOP_H; h += courseH, row++) {
        const col = h < 130 ? DADO : PAINT;
        let w = BACK_W + (row % 2) * 30;
        while (w > -60) {
            const bw = 60;
            const q = [project(U, w, h + courseH - 1.5), project(U, w - bw + 2, h + courseH - 1.5), project(U, w - bw + 2, h + 1.5), project(U, w, h + 1.5)];
            pathPoly(ctx, q);
            ctx.fillStyle = rgb(shadeC(col, -18 + (rand() - 0.5) * 8));
            ctx.fill();
            w -= bw;
        }
    }
    // Waist stripe
    const st = [project(U, BACK_W, 133), project(U, 0, 133), project(U, 0, 129), project(U, BACK_W, 129)];
    pathPoly(ctx, st);
    ctx.fillStyle = "#6a241e";
    ctx.fill();
    // Concrete columns and a fire door on each side wall
    for (const wp of [1180, 260]) {
        const q = [project(U, wp + 26, WALL_TOP_H), project(U, wp - 26, WALL_TOP_H), project(U, wp - 26, 0), project(U, wp + 26, 0)];
        pathPoly(ctx, q);
        ctx.fillStyle = "#6c6f6d";
        ctx.fill();
        ctx.save();
        ctx.clip();
        hatch(ctx, rand, Math.min(q[0].x, q[2].x) - 10, 0, 60, WORLD_HEIGHT, { angle: 1.2, gap: 3.2, alpha: 0.25 });
        ctx.restore();
        inkPoly(ctx, rand, q, 1.6);
    }
    const dw0 = 820, dw1 = 640;
    const door = [project(U, dw0, 190), project(U, dw1, 190), project(U, dw1, 0), project(U, dw0, 0)];
    pathPoly(ctx, door);
    ctx.fillStyle = "#3e4448";
    ctx.fill();
    inkPoly(ctx, rand, door, 1.6);
    const win = [project(U, dw0 - 40, 160), project(U, dw0 - 80, 160), project(U, dw0 - 80, 110), project(U, dw0 - 40, 110)];
    pathPoly(ctx, win);
    ctx.fillStyle = "#0e1214";
    ctx.fill();
    inkPoly(ctx, rand, win, 1);
    const bar = [project(U, dw1 + 30, 92), project(U, dw0 - 30, 92)];
    inkLine(ctx, rand, bar[0].x, bar[0].y, bar[1].x, bar[1].y, 2.4);
    // Skirting
    const sk = [project(U, BACK_W, 10), project(U, 0, 10), project(U, 0, 0), project(U, BACK_W, 0)];
    pathPoly(ctx, sk);
    ctx.fillStyle = "#1e2022";
    ctx.fill();
    // Shade and darkness above
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    hatch(ctx, rand, side < 0 ? 0 : WALL_R - 20, 0, WALL_L + 40, WORLD_HEIGHT, { angle: side < 0 ? 0.5 : 2.6, gap: 4, alpha: 0.14 });
    const dark = ctx.createLinearGradient(0, 0, 0, 760);
    dark.addColorStop(0, "rgba(2,2,2,0.97)");
    dark.addColorStop(0.6, "rgba(2,2,2,0.5)");
    dark.addColorStop(1, "rgba(2,2,2,0)");
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, WORLD_WIDTH, 760);
    ctx.restore();
    const corner = project(U, BACK_W);
    inkLine(ctx, rand, corner.x, corner.y, corner.x, 0, 2.2);
}

// ─── Floor ───────────────────────────────────────────────────────────────

function floorLine(ctx, rand, u0, w0, u1, w1, width, color) {
    const a = project(u0, w0), b = project(u1, w1);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * (a.s + b.s) / 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
}

function floorQuad(ctx, u0, u1, w0, w1, fill) {
    pathPoly(ctx, [project(u0, w1), project(u1, w1), project(u1, w0), project(u0, w0)]);
    ctx.fillStyle = fill;
    ctx.fill();
}

function drawFloor(ctx, rand) {
    ctx.save();
    pathPoly(ctx, FLOOR_PTS());
    ctx.clip();
    // Polished concrete: mottled grey with a cold sheen
    const base = ctx.createLinearGradient(0, WALL_BASE_Y, 0, WORLD_HEIGHT);
    base.addColorStop(0, "#56595a");
    base.addColorStop(1, "#6d706f");
    ctx.fillStyle = base;
    ctx.fillRect(0, WALL_BASE_Y, WORLD_WIDTH, WORLD_HEIGHT - WALL_BASE_Y);
    for (let i = 0; i < 420; i++) {
        const p = project((rand() - 0.5) * 1700, rand() * BACK_W);
        blotch(ctx, p.x, p.y, (20 + rand() * 90) * p.s, rand() < 0.6 ? `rgba(0,0,0,${0.05 + rand() * 0.1})` : `rgba(200,205,205,${0.03 + rand() * 0.05})`);
    }
    // Aggregate speckle
    for (let i = 0; i < 3000; i++) {
        const p = project((rand() - 0.5) * 1650, rand() * BACK_W);
        ctx.fillStyle = rand() < 0.5 ? "rgba(20,20,20,0.35)" : "rgba(220,220,215,0.18)";
        ctx.fillRect(p.x, p.y, 1.2 * p.s, 1.2 * p.s);
    }
    // Saw-cut control joints on a 160-unit grid
    for (let u = -HALF_U; u <= HALF_U; u += 160) floorLine(ctx, rand, u, 0, u, BACK_W, 1.3, "rgba(15, 15, 15, 0.7)");
    for (let w = 0; w <= BACK_W; w += 160) floorLine(ctx, rand, -HALF_U, w, HALF_U, w, 1.3, "rgba(15, 15, 15, 0.7)");
    // Reflections of the ceiling lights smeared across the polish
    for (const [u, w] of [[-362, BACK_W - 60], [362, BACK_W - 60], [0, 700], [-420, 400], [420, 400]]) {
        const p = project(u, w);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 140 * p.s);
        g.addColorStop(0, "rgba(200, 215, 230, 0.12)");
        g.addColorStop(1, "rgba(200, 215, 230, 0)");
        ctx.fillStyle = g;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, 0.45);
        ctx.translate(-p.x, -p.y);
        ctx.fillRect(p.x - 140, p.y - 140, 280, 280);
        ctx.restore();
    }
    // Yellow walkway lines from the door to the front of the room
    for (const u of [-112, 112]) {
        floorQuad(ctx, u - 4, u + 4, 0, BACK_W - 130, "rgba(210, 170, 30, 0.8)");
        for (let w = 20; w < BACK_W - 140; w += 60) {
            const p = project(u, w);
            blotch(ctx, p.x, p.y, 10 * p.s, "rgba(40, 40, 40, 0.25)");
        }
    }
    // Hazard hatching in front of the door
    ctx.save();
    pathPoly(ctx, [project(-120, BACK_W - 60), project(120, BACK_W - 60), project(120, BACK_W - 130), project(-120, BACK_W - 130)]);
    ctx.clip();
    for (let u = -160; u < 160; u += 24) {
        pathPoly(ctx, [project(u, BACK_W - 60), project(u + 12, BACK_W - 60), project(u + 24, BACK_W - 130), project(u + 12, BACK_W - 130)]);
        ctx.fillStyle = "rgba(210, 170, 30, 0.75)";
        ctx.fill();
    }
    ctx.restore();
    // Oil stains, a floor drain, scuffs from trolleys
    for (const [u, w, r] of [[-250, 520, 50], [420, 180, 40], [560, 820, 36], [-600, 900, 30]]) {
        const p = project(u, w);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, 0.45);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * p.s);
        g.addColorStop(0, "rgba(10, 12, 14, 0.5)");
        g.addColorStop(0.7, "rgba(10, 12, 14, 0.25)");
        g.addColorStop(1, "rgba(10, 12, 14, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r * p.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    const dr = project(260, 560);
    ctx.save();
    ctx.translate(dr.x, dr.y);
    ctx.scale(1, 0.45);
    ctx.fillStyle = "#1c1e20";
    ctx.beginPath();
    ctx.arc(0, 0, 14 * dr.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5a5e62";
    ctx.lineWidth = 1.2;
    for (let k = -10; k <= 10; k += 4) {
        ctx.beginPath();
        ctx.moveTo(k * dr.s, -12 * dr.s);
        ctx.lineTo(k * dr.s, 12 * dr.s);
        ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < 30; i++) {
        const u = (rand() - 0.5) * 1300, w = rand() * BACK_W, len = 40 + rand() * 120, a = rand() * Math.PI;
        floorLine(ctx, rand, u, w, u + Math.cos(a) * len, w + Math.sin(a) * len, 1.2, "rgba(20, 20, 20, 0.18)");
    }
    // A ritual circle sprayed in red paint where the altar stands
    drawSprayCircle(ctx, rand, -392, 354, 100);
    // The concrete burst open around the Monolith
    drawBurst(ctx, rand);
    // Loose paper, a dropped lanyard, glass
    for (let i = 0; i < 40; i++) {
        const u = (rand() - 0.5) * 1500, w = 30 + rand() * (BACK_W - 60);
        const p = project(u, w);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(rand() * Math.PI);
        ctx.scale(1, 0.5);
        const t = 205 + rand() * 40;
        ctx.fillStyle = `rgb(${t}, ${t}, ${t * 0.97})`;
        ctx.fillRect(-7 * p.s, -9 * p.s, 14 * p.s, 18 * p.s);
        ctx.fillStyle = "rgba(30, 30, 40, 0.5)";
        for (let k = 0; k < 4; k++) ctx.fillRect(-5 * p.s, (-6 + k * 3) * p.s, 10 * p.s, 0.8);
        ctx.restore();
    }
    for (let i = 0; i < 30; i++) {
        const p = project(-180 + (rand() - 0.5) * 120, 640 + (rand() - 0.5) * 80);
        ctx.fillStyle = "rgba(200, 220, 230, 0.5)";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 3 + rand() * 4, p.y + rand() * 2);
        ctx.lineTo(p.x + rand() * 3, p.y + 2);
        ctx.fill();
    }
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
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, WALL_BASE_Y, WORLD_WIDTH, 40);
    ctx.clip();
    hatch(ctx, rand, 0, WALL_BASE_Y, WORLD_WIDTH, 40, { angle: 1.1, gap: 3.5, alpha: 0.18 });
    ctx.restore();
    // A concrete step up to the door
    const step = [project(-118, BACK_W, 10), project(118, BACK_W, 10), project(118, BACK_W - 50, 10), project(-118, BACK_W - 50, 10)];
    const riser = [project(-118, BACK_W - 50, 10), project(118, BACK_W - 50, 10), project(118, BACK_W - 50, 0), project(-118, BACK_W - 50, 0)];
    pathPoly(ctx, riser);
    ctx.fillStyle = "#3e4142";
    ctx.fill();
    pathPoly(ctx, step);
    ctx.fillStyle = "#7c7f7e";
    ctx.fill();
    floorQuad(ctx, -118, 118, BACK_W - 54, BACK_W - 50, "rgba(210, 170, 30, 0.85)");
    inkPoly(ctx, rand, step, 1.3);
    inkPoly(ctx, rand, riser, 1.1);
    ctx.restore();
    const fp = FLOOR_PTS();
    inkLine(ctx, rand, fp[0].x, fp[0].y, fp[1].x, fp[1].y, 2.2);
    inkLine(ctx, rand, fp[0].x, fp[0].y, fp[3].x, fp[3].y, 2.2);
    inkLine(ctx, rand, fp[1].x, fp[1].y, fp[2].x, fp[2].y, 2.2);
}

// A ring of red spray paint with runes and a pentacle, overspray at the edges
function drawSprayCircle(ctx, rand, u0, w0, r) {
    const ring = (rr, width, a) => {
        ctx.strokeStyle = `rgba(165, 20, 16, ${a})`;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i = 0; i <= 60; i++) {
            const t = (i / 60) * Math.PI * 2;
            const p = project(u0 + Math.cos(t) * rr * (1 + (rand() - 0.5) * 0.02), w0 + Math.sin(t) * rr);
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
    };
    ring(r + 4, 9, 0.12);
    ring(r, 3.2, 0.8);
    ring(r * 0.82, 2, 0.7);
    ctx.strokeStyle = "rgba(165, 20, 16, 0.75)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
        const t = -Math.PI / 2 + (i * 2 * (Math.PI * 2)) / 5;
        const p = project(u0 + Math.cos(t) * r * 0.8, w0 + Math.sin(t) * r * 0.8);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    // Overspray dots
    for (let i = 0; i < 160; i++) {
        const t = rand() * Math.PI * 2, rr = r + (rand() - 0.5) * 14;
        const p = project(u0 + Math.cos(t) * rr, w0 + Math.sin(t) * rr);
        ctx.fillStyle = "rgba(165, 20, 16, 0.4)";
        ctx.fillRect(p.x, p.y, 1, 1);
    }
}

// Radiating cracks and heaved slabs round the Monolith's foot
function drawBurst(ctx, rand) {
    const c = project(0, 708);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(1, 0.45);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 120);
    g.addColorStop(0, "rgba(0,0,0,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 14; i++) {
        let a = rand() * Math.PI * 2, r = 50, x = Math.cos(a) * r, y = Math.sin(a) * r;
        ctx.strokeStyle = "rgba(8, 8, 8, 0.85)";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
            a += (rand() - 0.5) * 0.5;
            r += 14 + rand() * 18;
            x = Math.cos(a) * r;
            y = Math.sin(a) * r;
            ctx.lineTo(x, y);
            ctx.lineWidth = Math.max(0.6, 2.2 - k * 0.3);
        }
        ctx.stroke();
    }
    ctx.restore();
}
