// Furniture and props for the Keeping House, painted in the same ink-illustration
// style and one-point perspective as the room shell (world.js).
//
// Each prop is painted once into its own offscreen canvas (its "sprite") so the
// renderer can depth-sort it against characters every frame for free. Props
// also export colliders, and the positions of candles they hold so the
// renderer can animate the flames and light the room from them.

import {
    project, depthS, depthOfY, mulberry32, rgb, shadeC, pathPoly,
    inkLine, inkPoly, hatch, drawSkull, BOOK_COLORS, ERA
} from "./world.js";

const VPX = 800;
const P = project;

// Floor coordinates (u, w) of a screen-space point on the floor
export function placeAt(x, y) {
    const s = depthS(y);
    return { u: (x - VPX) / s, w: depthOfY(y) };
}

// ─── Materials ───────────────────────────────────────────────────────────
export const WOOD = { top: [104, 72, 46], front: [70, 46, 28], side: [44, 29, 18], grain: true };
export const DARKWOOD = { top: [78, 54, 36], front: [52, 34, 22], side: [32, 22, 14], grain: true };
export const STONE = { top: [138, 135, 130], front: [104, 103, 102], side: [70, 70, 72] };
export const IRON = { top: [70, 66, 62], front: [38, 35, 33], side: [24, 22, 21] };
const CRATE = { top: [114, 92, 66], front: [84, 65, 46], side: [54, 41, 29], grain: true };
const PARCHBOX = { top: [178, 166, 138], front: [146, 134, 108], side: [102, 92, 72] };

// ─── Primitives ──────────────────────────────────────────────────────────

export function faces(u0, u1, w0, w1, h0, h1) {
    const sMid = P(0, (w0 + w1) / 2).s;
    const sideU = VPX + ((u0 + u1) / 2) * sMid < VPX ? u1 : u0; // face turned toward the centre is visible
    return {
        front: [P(u0, w0, h0), P(u1, w0, h0), P(u1, w0, h1), P(u0, w0, h1)],
        top: [P(u0, w1, h1), P(u1, w1, h1), P(u1, w0, h1), P(u0, w0, h1)],
        side: [P(sideU, w0, h0), P(sideU, w1, h0), P(sideU, w1, h1), P(sideU, w0, h1)]
    };
}

export function fillFace(ctx, poly, color, light = 10, dark = -14) {
    pathPoly(ctx, poly);
    const ys = poly.map(p => p.y);
    const g = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
    g.addColorStop(0, rgb(shadeC(color, light)));
    g.addColorStop(1, rgb(shadeC(color, dark)));
    ctx.fillStyle = g;
    ctx.fill();
}

// A solid box in perspective with grain, hatching on the shaded faces and ink edges
export function box(ctx, rand, u0, u1, w0, w1, h0, h1, mat, { ink = 1.2, hatchFront = 0.12, top = true } = {}) {
    const f = faces(u0, u1, w0, w1, h0, h1);
    fillFace(ctx, f.side, mat.side, 4, -8);
    ctx.save();
    pathPoly(ctx, f.side);
    ctx.clip();
    hatch(ctx, rand, Math.min(...f.side.map(p => p.x)) - 4, Math.min(...f.side.map(p => p.y)) - 4, 30, 400, { angle: 1.2, gap: 2.6, alpha: 0.35 });
    ctx.restore();

    fillFace(ctx, f.front, mat.front);
    if (mat.grain) grainFront(ctx, rand, u0, u1, w0, h0, h1);
    if (hatchFront) {
        ctx.save();
        pathPoly(ctx, f.front);
        ctx.clip();
        const ys = f.front.map(p => p.y);
        const y0 = Math.max(...ys) - (Math.max(...ys) - Math.min(...ys)) * 0.45;
        hatch(ctx, rand, f.front[0].x - 4, y0, f.front[1].x - f.front[0].x + 8, Math.max(...ys) - y0 + 4, { angle: 1.05, gap: 3, alpha: hatchFront });
        ctx.restore();
    }
    if (top) {
        fillFace(ctx, f.top, mat.top, 14, -4);
        if (mat.grain) grainTop(ctx, rand, u0, u1, w0, w1, h1);
        // Lit front edge of the top
        ctx.strokeStyle = "rgba(255, 235, 205, 0.18)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(f.top[3].x, f.top[3].y + 0.5);
        ctx.lineTo(f.top[2].x, f.top[2].y + 0.5);
        ctx.stroke();
        inkPoly(ctx, rand, f.top, ink * 0.9);
    }
    inkPoly(ctx, rand, f.front, ink);
    inkPoly(ctx, rand, f.side, ink * 0.8);
    return f;
}

function grainFront(ctx, rand, u0, u1, w0, h0, h1) {
    ctx.save();
    ctx.strokeStyle = "rgba(10, 5, 2, 0.22)";
    ctx.lineWidth = 0.6;
    for (let h = h0 + 2; h < h1; h += 2.5 + rand() * 3) {
        const a = P(u0, w0, h), b = P(u1, w0, h + (rand() - 0.5) * 1.5);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + (rand() - 0.5) * 2, b.x, b.y);
        ctx.stroke();
    }
    ctx.restore();
}

function grainTop(ctx, rand, u0, u1, w0, w1, h) {
    ctx.save();
    ctx.strokeStyle = "rgba(10, 5, 2, 0.2)";
    ctx.lineWidth = 0.6;
    for (let w = w0 + 2; w < w1; w += 2 + rand() * 3) {
        const a = P(u0, w, h), b = P(u1, w + (rand() - 0.5) * 2, h);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
    }
    ctx.restore();
}

// Soft contact shadow on the floor under a footprint
export function floorShadow(ctx, u0, u1, w0, w1, alpha = 0.6, blur = 8) {
    ctx.save();
    ctx.filter = `blur(${blur}px)`;
    pathPoly(ctx, [P(u0 - 6, w1 + 4), P(u1 + 6, w1 + 4), P(u1 + 10, w0 - 8), P(u0 - 10, w0 - 8)]);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fill();
    ctx.restore();
}

// A tallow candle standing on a surface; returns where its flame burns
export function candle(ctx, rand, u, w, h, height, radius = 2.6) {
    const base = P(u, w, h), top = P(u, w, h + height);
    const r = radius * base.s;
    // Wax pool at the foot
    ctx.fillStyle = "rgba(212, 200, 168, 0.95)";
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, r * 2, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(base.x - r, 0, base.x + r, 0);
    g.addColorStop(0, "#73664f");
    g.addColorStop(0.45, "#e2d6b4");
    g.addColorStop(1, "#5d5242");
    ctx.fillStyle = g;
    ctx.fillRect(base.x - r, top.y, r * 2, base.y - top.y);
    ctx.fillStyle = "#d8cba8";
    ctx.beginPath();
    ctx.ellipse(top.x, top.y, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Drips
    for (let i = 0; i < 2; i++) {
        const dx = (rand() - 0.5) * r * 1.6;
        ctx.fillRect(top.x + dx - 0.6, top.y, 1.3, (2 + rand() * 6) * base.s);
    }
    ctx.strokeStyle = "rgba(6,4,4,0.7)";
    ctx.lineWidth = 0.7;
    ctx.strokeRect(base.x - r, top.y, r * 2, base.y - top.y);
    ctx.fillStyle = "#120a06";
    ctx.fillRect(top.x - 0.4, top.y - 2.4 * base.s, 0.8, 2.4 * base.s);
    return { x: top.x, y: top.y - 2.4 * base.s, s: base.s };
}

export function flatPaper(ctx, rand, u, w, h, L = 8, D = 6) {
    const a = rand() * Math.PI;
    const pts = [[-L, -D], [L, -D], [L, D], [-L, D]].map(([x, y]) =>
        P(u + x * Math.cos(a) - y * Math.sin(a), w + x * Math.sin(a) + y * Math.cos(a), h));
    pathPoly(ctx, pts);
    const t = 185 + rand() * 40;
    ctx.fillStyle = `rgb(${t}, ${t * 0.92}, ${t * 0.74})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(10,6,4,0.55)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
}

// ─── Props ───────────────────────────────────────────────────────────────

// Refectory reading table with an open ledger, candles, a skull and ink
// (its two chairs are separate props so they depth-sort on their own)
function paintReadingTable(ctx, rand, u, w, out) {
    const L = 96, D = 30, H = 36;
    floorShadow(out.floor, u - L, u + L, w - D, w + D, 0.65);

    // Legs and stretcher
    for (const [du, dw] of [[-L + 8, -D + 6], [L - 8, -D + 6], [-L + 8, D - 6], [L - 8, D - 6]]) {
        box(ctx, rand, u + du - 4, u + du + 4, w + dw - 4, w + dw + 4, 0, H - 5, DARKWOOD, { hatchFront: 0.2 });
    }
    box(ctx, rand, u - L + 8, u + L - 8, w - D + 4, w - D + 8, 8, 12, DARKWOOD, { hatchFront: 0 });
    // Top
    box(ctx, rand, u - L - 4, u + L + 4, w - D - 3, w + D + 3, H - 5, H, WOOD, { hatchFront: 0.25 });

    if (ERA === "present") {
        for (let i = 0; i < 4; i++) flatPaper(ctx, rand, u + 20 + rand() * 40, w - 10 + rand() * 20, H + 0.5);
        paintLaptop(ctx, rand, u, w, H, out);
    } else {
        // Open ledger
        const lu = u - 28, lw = w;
        for (const side of [-1, 1]) {
            const page = [P(lu + side * 2, lw + 14, H + 2), P(lu + side * 30, lw + 13, H + 1), P(lu + side * 30, lw - 13, H + 1), P(lu + side * 2, lw - 14, H + 2)];
            pathPoly(ctx, page);
            const g = ctx.createLinearGradient(page[0].x, 0, page[1].x, 0);
            g.addColorStop(0, "#b9a986");
            g.addColorStop(0.3, "#e3d7b6");
            g.addColorStop(1, "#d6c8a2");
            ctx.fillStyle = g;
            ctx.fill();
            ctx.strokeStyle = "rgba(40, 24, 12, 0.5)";
            ctx.lineWidth = 0.6;
            for (let k = -10; k <= 10; k += 2.5) {
                const a = P(lu + side * 6, lw + k, H + 1.6), b = P(lu + side * (24 - rand() * 8), lw + k, H + 1.4);
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
            inkPoly(ctx, rand, page, 0.9);
        }
        // Ledger cover edge and red ribbon over the front of the table
        const rb = P(lu + 2, lw - 14, H + 2), rb2 = P(lu + 5, w - D - 3, H - 8);
        ctx.strokeStyle = "#8f1a12";
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(rb.x, rb.y);
        ctx.quadraticCurveTo(rb.x + 2, (rb.y + rb2.y) / 2, rb2.x, rb2.y + 6);
        ctx.stroke();

        // Loose pages, inkwell and quill
        for (let i = 0; i < 4; i++) flatPaper(ctx, rand, u + 20 + rand() * 40, w - 10 + rand() * 20, H + 0.5);
        const ink = P(u + 12, w - 12, H);
        ctx.fillStyle = "#0d0b10";
        ctx.beginPath();
        ctx.ellipse(ink.x, ink.y - 3, 4, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(160, 170, 200, 0.4)";
        ctx.fillRect(ink.x - 2, ink.y - 5.5, 1.2, 2);
        ctx.strokeStyle = "#e8e0cc";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ink.x, ink.y - 5);
        ctx.quadraticCurveTo(ink.x + 6, ink.y - 18, ink.x + 13, ink.y - 26);
        ctx.stroke();
        ctx.strokeStyle = "rgba(232, 224, 204, 0.6)";
        ctx.lineWidth = 0.6;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(ink.x + 3 + i * 1.6, ink.y - 10 - i * 2.4);
            ctx.lineTo(ink.x + 7 + i * 1.6, ink.y - 12 - i * 2.4);
            ctx.stroke();
        }
    }

    // Book stack at the right end
    let bh = H;
    for (let i = 0; i < 4; i++) {
        const t = 4 + rand() * 2;
        const c = BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)];
        const b0 = u + 58 + (rand() - 0.5) * 4, b1 = u + 86 + (rand() - 0.5) * 4;
        box(ctx, rand, b0, b1, w - 12, w + 10, bh, bh + t, { top: shadeC(c, 14), front: c, side: [196, 184, 156] }, { ink: 0.8, hatchFront: 0 });
        const g0 = P(b0 + 4, w - 12, bh + t / 2), g1 = P(b1 - 4, w - 12, bh + t / 2);
        ctx.strokeStyle = "rgba(196, 160, 88, 0.55)";
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(g0.x, g0.y);
        ctx.lineTo(g1.x, g1.y);
        ctx.stroke();
        bh += t;
    }

    // Candles: a tall pair at the back, a guttered stub on a skull at the left
    out.flames.push(candle(ctx, rand, u + 40, w + 16, H, 22));
    out.flames.push(candle(ctx, rand, u + 50, w + 20, H, 14));
    const sk = P(u - 74, w + 8, H);
    drawSkull(ctx, sk.x, sk.y - 8 * sk.s, 9 * sk.s, rand);
    out.flames.push(candle(ctx, rand, u - 74, w + 8, H + 15, 6, 2.2));
    // Wax run over the front edge
    const wx = P(u + 44, w - D - 3, H);
    ctx.fillStyle = "rgba(206, 194, 162, 0.9)";
    ctx.beginPath();
    ctx.moveTo(wx.x - 2.2, wx.y - 1);
    ctx.lineTo(wx.x + 2.2, wx.y - 1);
    ctx.quadraticCurveTo(wx.x + 1, wx.y + 2, wx.x + 0.9, wx.y + 4.5);
    ctx.arc(wx.x, wx.y + 4.8, 1.1, 0, Math.PI);
    ctx.quadraticCurveTo(wx.x - 1, wx.y + 2, wx.x - 2.2, wx.y - 1);
    ctx.fill();
}

// A gothic high-backed chair: "facing" shows the seat and carved back, "away" shows the back of the backrest
function highChair(ctx, rand, u, w, mode, out) {
    const S = 16, seatH = 18, backH = 64;
    floorShadow(out.floor, u - S, u + S, w - S, w + S, 0.5, 5);
    for (const [du, dw] of [[-S + 3, -S + 3], [S - 3, -S + 3], [-S + 3, S - 3], [S - 3, S - 3]]) {
        box(ctx, rand, u + du - 2, u + du + 2, w + dw - 2, w + dw + 2, 0, seatH, DARKWOOD, { hatchFront: 0, ink: 0.9 });
    }
    const backW = mode === "facing" ? w + S - 4 : w - S;
    if (mode === "facing") {
        box(ctx, rand, u - S, u + S, w - S, w + S, seatH, seatH + 4, WOOD, { hatchFront: 0.2 });
        // Oxblood cushion
        const cu = [P(u - S + 3, w + S - 6, seatH + 6), P(u + S - 3, w + S - 6, seatH + 6), P(u + S - 3, w - S + 3, seatH + 5), P(u - S + 3, w - S + 3, seatH + 5)];
        pathPoly(ctx, cu);
        ctx.fillStyle = "#5e1410";
        ctx.fill();
        inkPoly(ctx, rand, cu, 0.8);
    }
    // Backrest with a pointed top and a pierced trefoil
    const b0 = P(u - S, backW, seatH), b1 = P(u + S, backW, seatH);
    const t0 = P(u - S, backW, backH), t1 = P(u + S, backW, backH), apex = P(u, backW, backH + 16);
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(t0.x, t0.y);
    ctx.quadraticCurveTo(t0.x, apex.y + 4, apex.x, apex.y);
    ctx.quadraticCurveTo(t1.x, apex.y + 4, t1.x, t1.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.closePath();
    const g = ctx.createLinearGradient(b0.x, 0, b1.x, 0);
    g.addColorStop(0, rgb(shadeC(DARKWOOD.front, -6)));
    g.addColorStop(0.4, rgb(shadeC(DARKWOOD.front, 18)));
    g.addColorStop(1, rgb(shadeC(DARKWOOD.front, -14)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(6,4,4,0.95)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // Carving
    const c = P(u, backW, backH - 6);
    if (mode === "facing") {
        ctx.fillStyle = "#0b0605";
        for (const [dx, dy] of [[0, -3], [-3, 2], [3, 2]]) {
            ctx.beginPath();
            ctx.arc(c.x + dx * c.s, c.y + dy * c.s, 2.4 * c.s, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.strokeStyle = "rgba(200, 160, 100, 0.25)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(b0.x + 4, b0.y - 2);
        ctx.lineTo(t0.x + 4, t0.y + 4);
        ctx.stroke();
    } else {
        // Back panel: framed with a recessed panel
        const in0 = P(u - S + 4, backW, seatH + 8), in1 = P(u + S - 4, backW, backH - 4);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = 1;
        ctx.strokeRect(in0.x, in1.y, in1.x - in0.x, in0.y - in1.y);
        ctx.save();
        ctx.beginPath();
        ctx.rect(in0.x, in1.y, in1.x - in0.x, in0.y - in1.y);
        ctx.clip();
        hatch(ctx, rand, in0.x, in1.y, in1.x - in0.x, in0.y - in1.y, { angle: 1.2, gap: 3, alpha: 0.2 });
        ctx.restore();
    }
    // Finials
    ctx.fillStyle = "#1a110b";
    for (const t of [t0, t1]) {
        ctx.beginPath();
        ctx.arc(t.x, t.y - 2, 2.4 * t.s, 0, Math.PI * 2);
        ctx.fill();
    }
}

// A pew facing the Monolith: we see the back of its backrest and its carved ends
function paintPew(ctx, rand, u, w, out, opts) {
    const L = 58, D = 12;
    floorShadow(out.floor, u - L, u + L, w - D, w + D + 8, 0.6);
    // Seat (mostly hidden behind the backrest) and legs
    box(ctx, rand, u - L + 4, u + L - 4, w + 2, w + D + 6, 15, 18, WOOD, { hatchFront: 0 });
    // Backrest planks
    const f = box(ctx, rand, u - L + 4, u + L - 4, w - D, w - D + 4, 4, 40, DARKWOOD, { hatchFront: 0.18 });
    const bays = 6, bw = (2 * L - 16) / bays;
    for (let i = 0; i < bays; i++) {
        const bu = u - L + 8 + bw * (i + 0.5), aw = bw * 0.32;
        const a = P(bu - aw, w - D, 9), b = P(bu - aw, w - D, 26), apex = P(bu, w - D, 35);
        const c = P(bu + aw, w - D, 26), d = P(bu + aw, w - D, 9);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.quadraticCurveTo(b.x, apex.y + 2, apex.x, apex.y);
        ctx.quadraticCurveTo(c.x, apex.y + 2, c.x, c.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
        ctx.fill();
        ctx.strokeStyle = "rgba(6, 4, 4, 0.8)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Lit edge of the moulding
        ctx.strokeStyle = "rgba(230, 190, 140, 0.16)";
        ctx.beginPath();
        ctx.moveTo(c.x + 1, d.y);
        ctx.lineTo(c.x + 1, c.y);
        ctx.quadraticCurveTo(c.x + 1, apex.y + 3, apex.x + 1, apex.y + 1);
        ctx.stroke();
        if (i < bays - 1) {
            const m0 = P(bu + bw / 2, w - D, 6), m1 = P(bu + bw / 2, w - D, 38);
            inkLine(ctx, rand, m0.x, m0.y, m1.x, m1.y, 0.6, 0.45);
        }
    }
    if (opts.broken) {
        // A split plank and a gap
        const a = P(u + 10, w - D, 26), b = P(u + 22, w - D, 34);
        ctx.fillStyle = "#0b0705";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, a.y - 2);
        ctx.lineTo(b.x - 2, b.y);
        ctx.lineTo(a.x + 3, b.y + 3);
        ctx.closePath();
        ctx.fill();
    }
    // Top rail
    box(ctx, rand, u - L + 2, u + L - 2, w - D - 2, w - D + 6, 40, 43, WOOD, { hatchFront: 0 });
    // Carved end posts with finials
    for (const side of [-1, 1]) {
        const pu = u + side * (L - 2);
        box(ctx, rand, pu - 3, pu + 3, w - D - 3, w + D + 6, 0, 46, DARKWOOD, { hatchFront: 0.3 });
        const top = P(pu, w - D, 46);
        ctx.fillStyle = "#24170e";
        ctx.strokeStyle = "rgba(6,4,4,0.9)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(top.x - 3, top.y);
        ctx.quadraticCurveTo(top.x - 3.5, top.y - 8, top.x, top.y - 13);
        ctx.quadraticCurveTo(top.x + 3.5, top.y - 8, top.x + 3, top.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        for (const sd of [-1, 1]) {
            ctx.beginPath();
            ctx.ellipse(top.x + sd * 4, top.y - 5, 2.4, 3.2, sd * 0.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.strokeStyle = "rgba(230, 190, 140, 0.2)";
        ctx.beginPath();
        ctx.moveTo(top.x - 1, top.y - 2);
        ctx.lineTo(top.x - 0.5, top.y - 10);
        ctx.stroke();
    }
    // A hymnal left on the rail, a red seal dripping down the back
    box(ctx, rand, u - 30, u - 14, w - D - 1, w - D + 6, 43, 46, { top: [70, 24, 18], front: [214, 202, 172], side: [50, 18, 14] }, { ink: 0.8, hatchFront: 0 });
    const seal = P(u + 30, w - D, 30);
    ctx.fillStyle = "#8a140e";
    ctx.beginPath();
    ctx.arc(seal.x, seal.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(seal.x - 0.8, seal.y, 1.6, 8);
    if (opts.candle) out.flames.push(candle(ctx, rand, u + (L - 2) * opts.candle, w - D + 1, 46, 7, 2.3));
}

// Card catalogue cabinet: a tall grid of drawers, some pulled open and spilling cards
function paintCatalog(ctx, rand, u, w, out, opts) {
    const W = 30, D = 16, H = 96;
    floorShadow(out.floor, u - W, u + W, w - D, w + D, 0.7);
    // Spilled index cards on the floor in front
    for (let i = 0; i < 14; i++) flatPaper(out.floor, rand, u + (rand() - 0.5) * 70, w - D - 6 - rand() * 26, 0.3, 4.5, 3);
    box(ctx, rand, u - W - 2, u + W + 2, w - D - 2, w + D + 2, 0, 6, DARKWOOD, { hatchFront: 0.3 });
    box(ctx, rand, u - W, u + W, w - D, w + D, 6, H, WOOD, { hatchFront: 0.1 });
    // Cornice
    box(ctx, rand, u - W - 4, u + W + 4, w - D - 4, w + D + 3, H, H + 6, DARKWOOD, { hatchFront: 0 });

    // Drawer grid
    const cols = 4, rows = 8;
    const du = (2 * W - 8) / cols, dh = (H - 14) / rows;
    const open = new Set(opts.open || []);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const a0 = u - W + 4 + c * du + 1, a1 = a0 + du - 2;
            const h0 = 10 + r * dh + 1, h1 = h0 + dh - 2;
            const key = r * cols + c;
            if (open.has(key)) {
                // Pulled-out drawer: dark cavity plus a small box sticking out with cards
                const cav = [P(a0, w - D, h0), P(a1, w - D, h0), P(a1, w - D, h1), P(a0, w - D, h1)];
                pathPoly(ctx, cav);
                ctx.fillStyle = "#070403";
                ctx.fill();
                const out2 = 10 + rand() * 8;
                box(ctx, rand, a0, a1, w - D - out2, w - D, h0, h1 - 2, WOOD, { ink: 0.8, hatchFront: 0 });
                for (let k = 0; k < 6; k++) {
                    const cu = a0 + 2 + k * ((a1 - a0 - 4) / 6);
                    const p1 = P(cu, w - D - out2 + 3, h1 - 2), p2 = P(cu + 1, w - D - 2, h1 + 2);
                    ctx.strokeStyle = "#ddd2b4";
                    ctx.lineWidth = 1.4;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.stroke();
                }
                continue;
            }
            const q = [P(a0, w - D, h0), P(a1, w - D, h0), P(a1, w - D, h1), P(a0, w - D, h1)];
            pathPoly(ctx, q);
            ctx.strokeStyle = "rgba(6,4,4,0.75)";
            ctx.lineWidth = 0.8;
            ctx.stroke();
            // Paper label and brass pull
            const lb = P((a0 + a1) / 2, w - D, h1 - dh * 0.35);
            ctx.fillStyle = `rgba(${200 + rand() * 30}, ${185 + rand() * 25}, ${145 + rand() * 20}, 0.85)`;
            ctx.fillRect(lb.x - 3.5 * lb.s, lb.y - 1.6 * lb.s, 7 * lb.s, 3.2 * lb.s);
            const pull = P((a0 + a1) / 2, w - D, h0 + dh * 0.3);
            ctx.fillStyle = "#a07a3a";
            ctx.beginPath();
            ctx.arc(pull.x, pull.y, 1.4 * pull.s, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // Things on top: a skull, stacked cards, a candle stub
    const top = P(u - 12, w, H + 6);
    drawSkull(ctx, top.x, top.y - 7 * top.s, 7 * top.s, rand);
    if (opts.candle) out.flames.push(candle(ctx, rand, u + 14, w + 2, H + 6, 9, 2.4));
}

// Stone lectern bearing a huge chained tome, flanked by pricket candles
function paintLectern(ctx, rand, u, w, out) {
    floorShadow(out.floor, u - 30, u + 30, w - 20, w + 20, 0.7);
    // Chains to iron rings in the floor
    for (const side of [-1, 1]) {
        const ring = P(u + side * 40, w - 18, 0);
        out.floor.strokeStyle = "#1a1715";
        out.floor.lineWidth = 2;
        out.floor.beginPath();
        out.floor.ellipse(ring.x, ring.y, 4, 1.8, 0, 0, Math.PI * 2);
        out.floor.stroke();
    }
    // Pricket candlesticks on either side, behind the desk
    for (const side of [-1, 1]) {
        const cu = u + side * 30;
        box(ctx, rand, cu - 2, cu + 2, w + 4, w + 8, 0, 54, IRON, { hatchFront: 0, ink: 0.8 });
        const dish = P(cu, w + 6, 54);
        ctx.fillStyle = "#1a1715";
        ctx.beginPath();
        ctx.ellipse(dish.x, dish.y, 6, 2, 0, 0, Math.PI * 2);
        ctx.fill();
        out.flames.push(candle(ctx, rand, cu, w + 6, 54, 16, 3));
    }
    // Plinth, column, desk
    box(ctx, rand, u - 22, u + 22, w - 16, w + 16, 0, 8, STONE, { hatchFront: 0.3 });
    box(ctx, rand, u - 11, u + 11, w - 8, w + 8, 8, 46, STONE, { hatchFront: 0.25 });
    // Column fluting
    for (const k of [-6, 0, 6]) {
        const a = P(u + k, w - 8, 12), b = P(u + k, w - 8, 44);
        inkLine(ctx, rand, a.x, a.y, b.x, b.y, 0.6, 0.4);
    }
    // Slanted desk: front edge low, back edge high
    const d0 = 46, d1 = 58;
    const desk = [P(u - 26, w + 14, d1), P(u + 26, w + 14, d1), P(u + 26, w - 14, d0), P(u - 26, w - 14, d0)];
    const front = [P(u - 26, w - 14, d0), P(u + 26, w - 14, d0), P(u + 26, w - 14, d0 - 5), P(u - 26, w - 14, d0 - 5)];
    fillFace(ctx, front, STONE.front);
    fillFace(ctx, desk, STONE.top, 12, -6);
    inkPoly(ctx, rand, desk, 1.2);
    inkPoly(ctx, rand, front, 1.2);
    // The tome: thick open book on the slope
    for (const side of [-1, 1]) {
        const pg = [P(u + side * 1, w + 12, d1 + 4), P(u + side * 24, w + 11, d1 + 2), P(u + side * 24, w - 11, d0 + 3), P(u + side * 1, w - 12, d0 + 5)];
        pathPoly(ctx, pg);
        const g = ctx.createLinearGradient(pg[0].x, 0, pg[1].x, 0);
        g.addColorStop(0, "#a8987a");
        g.addColorStop(0.3, "#e3d7b6");
        g.addColorStop(1, "#cfc19a");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "rgba(40,24,12,0.5)";
        ctx.lineWidth = 0.6;
        for (let k = 0.15; k < 0.9; k += 0.12) {
            const a = P(u + side * 5, w + 11 - k * 22, d1 + 3 - k * (d1 - d0)), b = P(u + side * 20, w + 11 - k * 22, d1 + 2 - k * (d1 - d0));
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        inkPoly(ctx, rand, pg, 0.9);
        // Illuminated initial in red
        const ill = P(u + side * 8, w + 6, d1 + 2);
        ctx.fillStyle = "rgba(140, 20, 14, 0.85)";
        ctx.fillRect(ill.x - 2, ill.y - 2, 4, 4);
    }
    // Chains from the book's spine draped to the rings
    for (const side of [-1, 1]) {
        const a = P(u + side * 22, w - 11, d0 + 3), r = P(u + side * 40, w - 18, 0);
        ctx.strokeStyle = "#1a1715";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([3, 1.5]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(a.x + side * 10, (a.y + r.y) / 2 + 6, r.x, r.y - 1);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// Evidence easel: an A-frame holding a board of pinned notes, sketches and a
// circled portrait, strung with red thread; a candle burns on its ledge.
function paintEvidenceBoard(ctx, rand, u, w, out) {
    floorShadow(out.floor, u - 48, u + 48, w - 12, w + 22, 0.55);
    const bw = 48, h0 = 34, h1 = 114;
    const leg = (a, b, width, color) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.lineCap = "butt";
        inkLine(ctx, rand, a.x + width * 0.5, a.y, b.x + width * 0.5, b.y, 0.7, 0.7);
    };
    // Back leg, then the front pair meeting above the board
    leg(P(u, w + 24, 0), P(u, w + 3, 128), 3, "#1d130b");
    for (const side of [-1, 1]) leg(P(u + side * 40, w - 8, 0), P(u + side * 6, w - 1, 132), 3.6, "#33210f");

    const board = [P(u - bw, w, h0), P(u + bw, w, h0), P(u + bw, w, h1), P(u - bw, w, h1)];
    pathPoly(ctx, board);
    const g = ctx.createLinearGradient(0, board[2].y, 0, board[0].y);
    g.addColorStop(0, "#6e4e30");
    g.addColorStop(1, "#46301c");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // Cork speckle
    const bx = board[0].x, by = board[2].y, bW = board[1].x - board[0].x, bH = board[0].y - board[2].y;
    for (let i = 0; i < 260; i++) {
        ctx.fillStyle = rand() < 0.55 ? "rgba(0,0,0,0.2)" : "rgba(255,220,170,0.07)";
        ctx.fillRect(bx + rand() * bW, by + rand() * bH, 1.2, 1.2);
    }
    // Pinned items on a jittered grid so the board reads as worked, not random
    const pins = [];
    const pin = (cx, cy, iw, ih, draw) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((rand() - 0.5) * 0.28);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(-iw / 2 + 1.5, -ih / 2 + 2, iw, ih);
        draw(iw, ih);
        ctx.strokeStyle = "rgba(6,4,4,0.6)";
        ctx.lineWidth = 0.6;
        ctx.strokeRect(-iw / 2, -ih / 2, iw, ih);
        ctx.restore();
        pins.push({ x: cx, y: cy - ih / 2 + 1.5 });
    };
    const note = (iw, ih) => {
        const t = 196 + rand() * 34;
        ctx.fillStyle = `rgb(${t}, ${t * 0.92}, ${t * 0.74})`;
        ctx.fillRect(-iw / 2, -ih / 2, iw, ih);
        ctx.fillStyle = "rgba(40,24,12,0.55)";
        for (let k = 0; k < 4; k++) ctx.fillRect(-iw / 2 + 1.2, -ih / 2 + 2 + k * 2.2, iw * (0.45 + rand() * 0.4), 0.6);
    };
    const portrait = crossed => (iw, ih) => {
        ctx.fillStyle = "#e3d8bd";
        ctx.fillRect(-iw / 2, -ih / 2, iw, ih);
        ctx.fillStyle = "#26201c";
        ctx.fillRect(-iw / 2 + 1.4, -ih / 2 + 1.4, iw - 2.8, ih - 4.2);
        ctx.fillStyle = "#bdb196";
        ctx.beginPath();
        ctx.ellipse(0, -ih * 0.08, iw * 0.2, ih * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0b0807";
        ctx.fillRect(-iw * 0.12, -ih * 0.12, iw * 0.08, ih * 0.05);
        ctx.fillRect(iw * 0.04, -ih * 0.12, iw * 0.08, ih * 0.05);
        if (crossed) {
            ctx.strokeStyle = "#a3170f";
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(-iw / 2 + 1, -ih / 2 + 1);
            ctx.lineTo(iw / 2 - 1, ih / 2 - 3);
            ctx.moveTo(iw / 2 - 1, -ih / 2 + 1);
            ctx.lineTo(-iw / 2 + 1, ih / 2 - 3);
            ctx.stroke();
        }
    };
    const cols = 5, rows = 3;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (r === 1 && c === 2) continue; // the centre belongs to the portrait
            if (rand() < 0.12) continue;
            const cu = u - bw + 10 + (c + 0.5) * ((2 * bw - 20) / cols) + (rand() - 0.5) * 6;
            const ch = h0 + 10 + (r + 0.5) * ((h1 - h0 - 16) / rows) + (rand() - 0.5) * 6;
            const p = P(cu, w, ch);
            if (rand() < 0.35) pin(p.x, p.y, 8 * p.s, 10 * p.s, portrait(rand() < 0.5));
            else pin(p.x, p.y, (7 + rand() * 4) * p.s, (8 + rand() * 4) * p.s, note);
        }
    }
    // The circled subject in the middle
    const mc = P(u, w, (h0 + h1) / 2 + 2);
    pin(mc.x, mc.y, 13 * mc.s, 16 * mc.s, portrait(false));
    const hub = pins[pins.length - 1];
    // Red thread: everything leads back to the subject, plus a few cross-links
    ctx.strokeStyle = "rgba(170, 26, 18, 0.9)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < pins.length - 1; i++) {
        if (rand() < 0.35) continue;
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(pins[i].x, pins[i].y);
        ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
        const a = pins[Math.floor(rand() * (pins.length - 1))], b = pins[Math.floor(rand() * (pins.length - 1))];
        if (a === b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo((a.x + b.x) / 2, Math.max(a.y, b.y) + 4, b.x, b.y);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(170, 20, 14, 0.85)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.ellipse(mc.x, mc.y, 11 * mc.s, 12.5 * mc.s, -0.1, 0, Math.PI * 2);
    ctx.stroke();
    for (const p of pins) {
        ctx.fillStyle = "#b3241a";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
    }
    // Light falling off toward the lower edge
    const shade = ctx.createLinearGradient(0, by, 0, by + bH);
    shade.addColorStop(0, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = shade;
    ctx.fillRect(bx, by, bW, bH);
    ctx.restore();
    // Frame
    pathPoly(ctx, board);
    ctx.strokeStyle = "#20140b";
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.strokeStyle = "rgba(220, 170, 110, 0.18)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(board[3].x + 1.5, board[3].y + 1.5);
    ctx.lineTo(board[2].x - 1.5, board[2].y + 1.5);
    ctx.stroke();
    inkPoly(ctx, rand, board, 1.2);
    // Ledge carrying a candle stub
    box(ctx, rand, u - bw - 3, u + bw + 3, w - 6, w + 2, h0 - 4, h0, WOOD, { hatchFront: 0, ink: 0.9 });
    out.flames.push(candle(ctx, rand, u + bw - 10, w - 2, h0, 8, 2.3));
}

// Weeping angel on a memorial pedestal: veiled head bowed into both hands,
// wide sleeves hanging from the raised arms, wings folded high behind.
// Lit from the upper left; the right side falls into hatched shadow.
const MARBLE = { top: [150, 147, 140], front: [112, 110, 106], side: [76, 75, 74] };
function paintStatue(ctx, rand, u, w, out) {
    floorShadow(out.floor, u - 30, u + 30, w - 30, w + 30, 0.75);

    // ── Pedestal: base, inscribed die, moulded cap ──
    box(ctx, rand, u - 26, u + 26, w - 26, w + 26, 0, 7, MARBLE, { hatchFront: 0.3 });
    const die = box(ctx, rand, u - 20, u + 20, w - 20, w + 20, 7, 46, MARBLE, { hatchFront: 0.18 });
    // Inscription panel with carved lines and a skull-and-wings relief
    const pa = P(u - 14, w - 20, 12), pb = P(u + 14, w - 20, 40);
    ctx.fillStyle = "rgba(20, 18, 16, 0.28)";
    ctx.fillRect(pa.x, pb.y, pb.x - pa.x, pa.y - pb.y);
    ctx.strokeStyle = "rgba(6,4,4,0.75)";
    ctx.lineWidth = 0.9;
    ctx.strokeRect(pa.x, pb.y, pb.x - pa.x, pa.y - pb.y);
    ctx.strokeStyle = "rgba(220, 214, 200, 0.22)";
    ctx.beginPath();
    ctx.moveTo(pa.x + 0.8, pa.y - 0.8);
    ctx.lineTo(pb.x - 0.8, pa.y - 0.8);
    ctx.lineTo(pb.x - 0.8, pb.y + 0.8);
    ctx.stroke();
    const rel = P(u, w - 20, 33);
    drawSkull(ctx, rel.x, rel.y, 3.6 * rel.s, rand);
    for (const sd of [-1, 1]) {
        ctx.strokeStyle = "rgba(30, 26, 24, 0.7)";
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(rel.x + sd * 4 * rel.s, rel.y - 1);
            ctx.quadraticCurveTo(rel.x + sd * (7 + i * 1.5) * rel.s, rel.y - (4 - i) * rel.s, rel.x + sd * (9 + i * 1.4) * rel.s, rel.y + (i - 1) * 1.6 * rel.s);
            ctx.stroke();
        }
    }
    ctx.fillStyle = "rgba(25, 20, 18, 0.6)";
    for (let i = 0; i < 3; i++) {
        const l0 = P(u - 10 + i * 1.5, w - 20, 23 - i * 4.5), l1 = P(u + 10 - i * 1.5, w - 20, 23 - i * 4.5);
        for (let x = l0.x; x < l1.x - 1; x += 2.2 + rand() * 1.6) ctx.fillRect(x, l0.y, 1.4 + rand(), 1);
    }
    // A crack through the die and lichen along its top edge
    const c0 = P(u + 9, w - 20, 46), c1 = P(u + 13, w - 20, 7);
    inkLine(ctx, rand, c0.x, c0.y, (c0.x + c1.x) / 2 - 2, (c0.y + c1.y) / 2, 0.8, 0.7);
    inkLine(ctx, rand, (c0.x + c1.x) / 2 - 2, (c0.y + c1.y) / 2, c1.x, c1.y, 0.7, 0.6);
    for (let i = 0; i < 26; i++) {
        const lp = P(u - 20 + rand() * 40, w - 20, 44 - rand() * rand() * 14);
        ctx.fillStyle = `rgba(${60 + rand() * 30}, ${78 + rand() * 30}, ${50 + rand() * 16}, ${0.25 + rand() * 0.3})`;
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 0.6 + rand() * 1.6, 0, Math.PI * 2);
        ctx.fill();
    }
    box(ctx, rand, u - 23, u + 23, w - 23, w + 23, 46, 50, MARBLE, { hatchFront: 0 });
    box(ctx, rand, u - 25, u + 25, w - 25, w + 25, 50, 54, MARBLE, { hatchFront: 0.15 });
    void die;

    // ── Figure, built in its own units: feet at 0, crown of the head at -100 ──
    const base = P(u, w + 2, 54);
    const F = base.s * 0.98;
    const X = fx => base.x + fx * F, Y = fy => base.y + fy * F;
    const path = pts => {
        ctx.beginPath();
        ctx.moveTo(X(pts[0][0]), Y(pts[0][1]));
        for (let i = 1; i < pts.length; i++) {
            const p = pts[i];
            if (p.length === 4) ctx.quadraticCurveTo(X(p[0]), Y(p[1]), X(p[2]), Y(p[3]));
            else ctx.lineTo(X(p[0]), Y(p[1]));
        }
        ctx.closePath();
    };
    const lightGrad = (x0, x1, a = "#cdc9bf", b = "#9c988f", c = "#56534f") => {
        const g = ctx.createLinearGradient(X(x0), 0, X(x1), 0);
        g.addColorStop(0, a);
        g.addColorStop(0.45, b);
        g.addColorStop(1, c);
        return g;
    };
    const ink = (wd = 1.3, a = 0.92) => {
        ctx.strokeStyle = `rgba(6,4,4,${a})`;
        ctx.lineWidth = wd;
        ctx.stroke();
    };
    const clipped = (pathFn, fn) => {
        ctx.save();
        pathFn();
        ctx.clip();
        fn();
        ctx.restore();
    };

    // Wings: leading edge rises to a wrist above the head, primaries sweep
    // down nearly to the feet, the trailing edge is scalloped feather tips.
    const wing = sd => [
        [sd * 5, -72],
        [sd * 8, -100, sd * 20, -110],
        [sd * 30, -113, sd * 35, -101],
        [sd * 39, -84, sd * 35, -62],
        [sd * 33, -34, sd * 26, -8],
        [sd * 23, -12, sd * 21, -9],
        [sd * 19, -17, sd * 16, -15],
        [sd * 15, -25, sd * 12, -24],
        [sd * 11, -34, sd * 9, -36],
        [sd * 8, -50, sd * 7, -52]
    ];
    for (const sd of [1, -1]) {
        const pts = wing(sd);
        path(pts);
        ctx.fillStyle = sd < 0 ? lightGrad(-38, -4, "#bdb9af", "#a29e95", "#77746e") : lightGrad(4, 38, "#8a8780", "#6c6964", "#45433f");
        ctx.fill();
        clipped(() => path(pts), () => {
            // Coverts: rows of small scalloped feathers under the leading edge
            for (let row = 0; row < 3; row++) {
                ctx.strokeStyle = `rgba(20, 18, 16, ${0.42 - row * 0.06})`;
                ctx.lineWidth = 0.8;
                const n = 6 + row;
                for (let i = 0; i < n; i++) {
                    const t = i / (n - 1);
                    const fx = sd * (8 + t * 26 - row * 1.5), fy = -98 + Math.sin(t * Math.PI) * -8 + t * 8 + row * 7;
                    ctx.beginPath();
                    ctx.arc(X(fx), Y(fy), 2.6 * F, 0.15 * Math.PI, 0.85 * Math.PI);
                    ctx.stroke();
                }
            }
            // Long flight feathers fanning down to the scalloped tips
            const tips = [[26, -8], [21, -9], [16, -15], [12, -24], [9, -36], [7, -52]];
            for (let i = 0; i < 9; i++) {
                const t = i / 8;
                const start = [sd * (10 + t * 26), -82 + t * 6];
                const tip = tips[Math.min(tips.length - 1, Math.floor((1 - t) * tips.length))];
                const end = [sd * (tip[0] + (rand() - 0.5) * 2), tip[1] - 2];
                ctx.strokeStyle = "rgba(18, 16, 14, 0.5)";
                ctx.lineWidth = 0.9;
                ctx.beginPath();
                ctx.moveTo(X(start[0]), Y(start[1]));
                ctx.quadraticCurveTo(X(sd * (start[0] * sd + 6)), Y((start[1] + end[1]) / 2), X(end[0]), Y(end[1]));
                ctx.stroke();
                // Pale rachis beside each line on the lit wing
                if (sd < 0) {
                    ctx.strokeStyle = "rgba(230, 226, 214, 0.22)";
                    ctx.lineWidth = 0.6;
                    ctx.beginPath();
                    ctx.moveTo(X(start[0]) + 1, Y(start[1]));
                    ctx.quadraticCurveTo(X(sd * (start[0] * sd + 6)) + 1, Y((start[1] + end[1]) / 2), X(end[0]) + 1, Y(end[1]));
                    ctx.stroke();
                }
            }
            if (sd > 0) hatch(ctx, rand, X(0), Y(-116), 42 * F, 112 * F, { angle: 1.15, gap: 2.4, alpha: 0.34 });
            else hatch(ctx, rand, X(-40), Y(-60), 40 * F, 54 * F, { angle: 1.15, gap: 3, alpha: 0.16 });
            // Lichen speckling and a dark weathering seam
            for (let i = 0; i < 40; i++) {
                ctx.fillStyle = rand() < 0.6 ? "rgba(40, 52, 34, 0.3)" : "rgba(15, 14, 12, 0.3)";
                ctx.fillRect(X(sd * (6 + rand() * 32)), Y(-10 - rand() * 100), 1.1, 1.1);
            }
        });
        path(pts);
        ink(1.3);
        // Lit leading edge
        if (sd < 0) {
            ctx.strokeStyle = "rgba(236, 232, 220, 0.4)";
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(X(-6), Y(-76));
            ctx.quadraticCurveTo(X(-9), Y(-99), X(-20), Y(-108));
            ctx.quadraticCurveTo(X(-29), Y(-111), X(-34), Y(-101));
            ctx.stroke();
        }
    }
    // A chip broken from the far wing's tip
    ctx.fillStyle = "#3a3835";
    path([[24, -11], [27, -14], [26, -8]]);
    ctx.fill();

    // Robe: narrow at the shoulders and waist, flaring to a folded hem
    const robe = [
        [-11, -77], [-10.5, -66, -9.5, -52], [-15, -30, -17.5, -2],
        [-15.5, 1, -13.5, -1], [-11, 1.5, -8, -0.5], [-5, 1.5, -2, -0.5], [1, 1.5, 4, -0.5],
        [7, 1.5, 10, -0.5], [13, 1.5, 15, -1], [17, 1, 17.5, -2],
        [15, -30, 9.5, -52], [10.5, -66, 11, -77], [4, -80, 0, -80], [-4, -80, -11, -77]
    ];
    path(robe);
    ctx.fillStyle = lightGrad(-18, 18);
    ctx.fill();
    clipped(() => path(robe), () => {
        // Deep folds: a shadow stroke with a highlight beside it
        for (let i = 0; i < 7; i++) {
            const fx0 = -6 + i * 2, fx1 = -15 + i * 5 + (rand() - 0.5) * 2;
            ctx.strokeStyle = "rgba(25, 22, 20, 0.5)";
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            ctx.moveTo(X(fx0), Y(-50));
            ctx.quadraticCurveTo(X((fx0 + fx1) / 2 + (rand() - 0.5) * 3), Y(-25), X(fx1), Y(0));
            ctx.stroke();
            if (fx1 < 6) {
                ctx.strokeStyle = "rgba(240, 236, 226, 0.28)";
                ctx.lineWidth = 0.8;
                ctx.beginPath();
                ctx.moveTo(X(fx0 - 0.9), Y(-48));
                ctx.quadraticCurveTo(X((fx0 + fx1) / 2 - 1.5), Y(-25), X(fx1 - 1.8), Y(-1));
                ctx.stroke();
            }
        }
        // Shadow side and under the arms
        hatch(ctx, rand, X(5), Y(-80), 15 * F, 80 * F, { angle: 1.2, gap: 2.6, alpha: 0.26 });
        ctx.fillStyle = "rgba(20, 18, 16, 0.3)";
        ctx.fillRect(X(-12), Y(-62), 24 * F, 10 * F);
        // Grime running down from the hands like dried tears
        for (let i = 0; i < 6; i++) {
            const sx = -5 + rand() * 10;
            const g = ctx.createLinearGradient(0, Y(-72), 0, Y(-72 + 30 + rand() * 40));
            g.addColorStop(0, "rgba(22, 24, 20, 0.45)");
            g.addColorStop(1, "rgba(22, 24, 20, 0)");
            ctx.fillStyle = g;
            ctx.fillRect(X(sx), Y(-72), 1.1 * F, 70 * F);
        }
        // Moss creeping up the hem
        for (let i = 0; i < 60; i++) {
            ctx.fillStyle = `rgba(${48 + rand() * 20}, ${66 + rand() * 24}, ${38 + rand() * 12}, ${0.3 + rand() * 0.3})`;
            ctx.beginPath();
            ctx.arc(X(-18 + rand() * 36), Y(-rand() * rand() * 16), (0.5 + rand() * 1.3) * F, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    path(robe);
    ink(1.5);
    // Cord at the waist
    ctx.strokeStyle = "rgba(30, 26, 22, 0.8)";
    ctx.lineWidth = 1.4 * F;
    ctx.beginPath();
    ctx.moveTo(X(-9.5), Y(-52));
    ctx.quadraticCurveTo(X(0), Y(-49.5), X(9.5), Y(-52));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(X(1), Y(-50));
    ctx.quadraticCurveTo(X(2.5), Y(-40), X(1.5), Y(-30));
    ctx.stroke();

    // Veil over the bowed head, falling behind the shoulders
    const veil = [[-10, -74], [-11, -86, -8, -94], [-4, -100, 1, -99], [7, -97, 9, -90], [11, -82, 10.5, -74], [0, -77, -10, -74]];
    path(veil);
    ctx.fillStyle = lightGrad(-11, 11, "#c7c3b9", "#9d998f", "#5f5c57");
    ctx.fill();
    clipped(() => path(veil), () => hatch(ctx, rand, X(3), Y(-102), 10 * F, 30 * F, { angle: 1.2, gap: 2.2, alpha: 0.3 }));
    path(veil);
    ink(1.2);

    // Arms raised to the face: upper arms, then the forearms with sleeves hanging from them
    for (const sd of [-1, 1]) {
        const arm = [[sd * 10, -76], [sd * 14.5, -70, sd * 14, -60], [sd * 10, -60], [sd * 9, -68, sd * 7, -73]];
        path(arm);
        ctx.fillStyle = sd < 0 ? "#aaa69c" : "#6f6c66";
        ctx.fill();
        ink(1);
    }
    for (const sd of [-1, 1]) {
        // Sleeve: a bell of cloth from the forearm to below the elbow
        const sleeve = [[sd * 5, -82], [sd * 12, -70, sd * 15.5, -60], [sd * 17, -52, sd * 13, -45], [sd * 10, -50, sd * 9, -56], [sd * 7, -66, sd * 3.5, -78]];
        path(sleeve);
        ctx.fillStyle = sd < 0 ? lightGrad(-17, -3, "#c3bfb5", "#a39f96", "#7c7972") : lightGrad(3, 17, "#8b8881", "#6d6a64", "#4a4844");
        ctx.fill();
        clipped(() => path(sleeve), () => {
            ctx.strokeStyle = "rgba(25, 22, 20, 0.45)";
            ctx.lineWidth = 0.9;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(X(sd * (7 + i * 2.5)), Y(-72 + i * 3));
                ctx.quadraticCurveTo(X(sd * (11 + i * 2)), Y(-58), X(sd * (12 + i)), Y(-47));
                ctx.stroke();
            }
            if (sd > 0) hatch(ctx, rand, X(3), Y(-84), 15 * F, 40 * F, { angle: 1.2, gap: 2.3, alpha: 0.3 });
        });
        path(sleeve);
        ink(1.2);
    }
    // Hands covering the face, fingers spread over the brow
    for (const sd of [-1, 1]) {
        const hx = sd * 2.6, hy = -88.5;
        ctx.save();
        ctx.translate(X(hx), Y(hy));
        ctx.rotate(sd * 0.22);
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.6 * F, 6.6 * F, 0, 0, Math.PI * 2);
        ctx.fillStyle = sd < 0 ? "#c6c2b8" : "#8e8b84";
        ctx.fill();
        ctx.strokeStyle = "rgba(6,4,4,0.85)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.strokeStyle = "rgba(30, 26, 22, 0.55)";
        ctx.lineWidth = 0.6;
        for (let f = -1; f <= 1; f++) {
            ctx.beginPath();
            ctx.moveTo(f * 1.3 * F, -6 * F);
            ctx.lineTo(f * 1.1 * F, -1.5 * F);
            ctx.stroke();
        }
        ctx.restore();
    }
    // A thin dark tear escaping between the fingers
    const tr = ctx.createLinearGradient(0, Y(-83), 0, Y(-60));
    tr.addColorStop(0, "rgba(60, 6, 4, 0.75)");
    tr.addColorStop(1, "rgba(60, 6, 4, 0)");
    ctx.fillStyle = tr;
    ctx.fillRect(X(-0.6), Y(-83), 1.2 * F, 23 * F);

    // Offerings at the foot: votive candles and a wilted bouquet
    const bq = P(u - 4, w - 30, 0);
    ctx.strokeStyle = "#2d3320";
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(bq.x + i * 2 - 4, bq.y);
        ctx.quadraticCurveTo(bq.x + i * 3 - 6, bq.y - 6, bq.x + i * 4 - 9, bq.y - 9 - rand() * 3);
        ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
        ctx.fillStyle = ["#4a0c0a", "#5d1310", "#3a0807", "#6b1a14"][i];
        ctx.beginPath();
        ctx.arc(bq.x + i * 4 - 9, bq.y - 10 - (i % 2) * 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
    }
    out.flames.push(candle(ctx, rand, u - 18, w - 30, 0, 7, 2.6));
    out.flames.push(candle(ctx, rand, u + 12, w - 32, 0, 4.5, 2.6));
}

// An iron gibbet cage on a gallows frame, with remains inside
function paintGibbet(ctx, rand, u, w, out) {
    floorShadow(out.floor, u - 36, u + 36, w - 18, w + 18, 0.6);
    const top = 150;
    // Posts and beam
    box(ctx, rand, u - 34, u - 26, w - 4, w + 4, 0, top, DARKWOOD, { hatchFront: 0.25 });
    box(ctx, rand, u - 40, u - 20, w - 10, w + 10, 0, 6, DARKWOOD, { hatchFront: 0.3 });
    box(ctx, rand, u - 34, u + 30, w - 4, w + 4, top - 8, top, DARKWOOD, { hatchFront: 0.2 });
    // Brace
    const b0 = P(u - 26, w, top - 36), b1 = P(u - 6, w, top - 8);
    ctx.strokeStyle = "#24170e";
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(b0.x, b0.y);
    ctx.lineTo(b1.x, b1.y);
    ctx.stroke();
    // Chain
    const hook = P(u + 18, w, top - 8);
    const cageTop = P(u + 18, w, top - 34);
    ctx.strokeStyle = "#151311";
    ctx.lineWidth = 1.6;
    for (let y = hook.y; y < cageTop.y; y += 4) {
        ctx.beginPath();
        ctx.ellipse(hook.x, y + 2, 1.4, 2.2, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    // Cage: elliptical rings and bars, with remains inside
    const cx = cageTop.x, ct = cageTop.y, cb = P(u + 18, w, top - 104).y;
    const rx = 15 * cageTop.s, ry = 5 * cageTop.s;
    // Remains (drawn first, seen through the bars)
    drawSkull(ctx, cx - 2, cb - 12, 6 * cageTop.s, rand);
    ctx.strokeStyle = "#cfc4a6";
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + 2, ct + 26 + i * 6, 7 - i, 2.4, 0, Math.PI * 0.1, Math.PI * 0.9);
        ctx.stroke();
    }
    ctx.strokeStyle = "#d6cbae";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 6, cb - 4);
    ctx.lineTo(cx + 10, cb - 16);
    ctx.stroke();
    // Bars
    ctx.strokeStyle = "#171412";
    ctx.lineWidth = 1.8;
    for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI;
        const bx = cx + Math.cos(a) * rx;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * rx * 0.4, ct - 6);
        ctx.quadraticCurveTo(bx, ct + 4, bx, ct + 12);
        ctx.lineTo(bx, cb - 2);
        ctx.quadraticCurveTo(bx, cb + 6, cx + Math.cos(a) * rx * 0.5, cb + 8);
        ctx.stroke();
    }
    for (const yy of [ct + 12, (ct + cb) / 2, cb - 2]) {
        ctx.beginPath();
        ctx.ellipse(cx, yy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.strokeStyle = "rgba(170, 130, 90, 0.25)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.7, ct + 12);
    ctx.lineTo(cx - rx * 0.7, cb - 2);
    ctx.stroke();
}

// Stacked crates and document boxes, one open and spilling pages
function paintCrates(ctx, rand, u, w, out, opts) {
    floorShadow(out.floor, u - 52, u + 52, w - 30, w + 30, 0.65);
    const crate = (u0, u1, w0, w1, h0, h1, mat, stencil) => {
        const f = box(ctx, rand, u0, u1, w0, w1, h0, h1, mat, { hatchFront: 0.2 });
        // Plank seams on the face
        for (let h = h0 + 9; h < h1 - 3; h += 9) {
            const a = P(u0 + 1, w0, h), b = P(u1 - 1, w0, h);
            inkLine(ctx, rand, a.x, a.y, b.x, b.y, 0.7, 0.55);
        }
        if (stencil) {
            const c = P((u0 + u1) / 2, w0, (h0 + h1) / 2);
            ctx.save();
            ctx.font = `${7 * c.s}px Georgia, serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = "rgba(196, 184, 150, 0.3)";
            ctx.fillText(stencil, c.x, c.y);
            ctx.restore();
        }
        // Corner battens and a diagonal brace
        for (const uu of [u0 + 2.5, u1 - 2.5]) {
            const a = P(uu, w0, h0), b = P(uu, w0, h1);
            ctx.strokeStyle = "rgba(20, 12, 6, 0.7)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        const a = P(u0 + 4, w0, h0 + 2), b = P(u1 - 4, w0, h1 - 2);
        inkLine(ctx, rand, a.x, a.y, b.x, b.y, 1.1, 0.6);
        // Nail heads on the battens
        ctx.fillStyle = "rgba(150, 140, 120, 0.6)";
        for (const uu of [u0 + 2.5, u1 - 2.5]) {
            for (const hh of [h0 + 3, h1 - 3]) {
                const n = P(uu, w0, hh);
                ctx.fillRect(n.x - 0.6, n.y - 0.6, 1.2, 1.2);
            }
        }
        return f;
    };
    const flip = opts.flip ? -1 : 1;
    const now = ERA === "present", M = now ? CARDBOARD : CRATE;
    crate(u - 50, u - 6, w - 24, w + 16, 0, 36, M, now ? "EVIDENCE" : opts.flip ? "No. 13" : "ARCHIVE");
    crate(u - 2, u + 46, w - 20, w + 22, 0, 32, M, now ? "CASE 2026-0413" : opts.flip ? "" : "KEEP");
    crate(u - 44 + (flip > 0 ? 6 : 0), u - 10, w - 18, w + 12, 36, 62, M);
    // Parchment document boxes on top of the right crate
    box(ctx, rand, u + 4, u + 30, w - 14, w + 10, 32, 46, PARCHBOX, { hatchFront: 0.1 });
    box(ctx, rand, u + 8, u + 34, w - 12, w + 12, 46, 58, PARCHBOX, { hatchFront: 0.1 });
    // Open crate lid and spilled pages / scrolls
    for (let i = 0; i < 9; i++) flatPaper(out.floor, rand, u + flip * (30 + rand() * 40), w - 30 - rand() * 18, 0.3);
    const sc = P(u + flip * 40, w - 24, 2);
    for (let i = 0; i < 3; i++) {
        out.floor.fillStyle = "#d6c9a6";
        out.floor.beginPath();
        out.floor.ellipse(sc.x + i * 5, sc.y - i * 3, 6, 2.6, 0.3, 0, Math.PI * 2);
        out.floor.fill();
        out.floor.strokeStyle = "rgba(6,4,4,0.7)";
        out.floor.lineWidth = 0.7;
        out.floor.stroke();
    }
    // A lantern on top, unlit, and a coil of rope
    const lt = P(u - 28, w, 62);
    ctx.fillStyle = "#151311";
    ctx.fillRect(lt.x - 4, lt.y - 14, 8, 14);
    ctx.fillStyle = "rgba(90, 70, 40, 0.6)";
    ctx.fillRect(lt.x - 2.6, lt.y - 12, 5.2, 9);
    ctx.strokeStyle = "#151311";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(lt.x, lt.y - 15, 3, Math.PI, 0);
    ctx.stroke();
    const rope = P(u + flip * -58, w - 26, 0);
    out.floor.strokeStyle = "#7a6440";
    out.floor.lineWidth = 2;
    for (let r = 4; r < 11; r += 2.4) {
        out.floor.beginPath();
        out.floor.ellipse(rope.x, rope.y - 2, r, r * 0.38, 0, 0, Math.PI * 2);
        out.floor.stroke();
    }
    if (opts.skull) {
        const sk = P(u + 18, w, 58);
        drawSkull(ctx, sk.x, sk.y - 7 * sk.s, 7 * sk.s, rand);
    }
}

// ─── Finish ──────────────────────────────────────────────────────────────

let grainTile = null;
function grain() {
    if (grainTile) return grainTile;
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const img = g.createImageData(128, 128);
    const r = mulberry32(77);
    for (let i = 0; i < img.data.length; i += 4) {
        const v = r();
        const dark = v < 0.5;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = dark ? 0 : 255;
        img.data[i + 3] = dark ? (0.5 - v) * 70 : (v - 0.5) * 22;
    }
    g.putImageData(img, 0, 0);
    grainTile = c;
    return c;
}

// Same paper grain as the room shell, and a soft darkening toward the floor
function finish(canvas, ctx, groundY) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = ctx.createPattern(grain(), "repeat");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const g = ctx.createLinearGradient(0, groundY * 0.55, 0, groundY);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

// Smallest canvas holding every painted pixel, with its offset in world units
function cropToContent(canvas, scale) {
    const { width: W, height: H } = canvas;
    const px = canvas.getContext("2d").getImageData(0, 0, W, H).data;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            if (px[(y * W + x) * 4 + 3] > 2) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                y1 = y;
            }
        }
    }
    if (x1 < 0) return { canvas, x: 0, y: 0, w: W / scale, h: H / scale };
    x0 = Math.max(0, x0 - 1); y0 = Math.max(0, y0 - 1);
    x1 = Math.min(W - 1, x1 + 1); y1 = Math.min(H - 1, y1 + 1);
    const c = document.createElement("canvas");
    c.width = x1 - x0 + 1;
    c.height = y1 - y0 + 1;
    c.getContext("2d").drawImage(canvas, -x0, -y0);
    return { canvas: c, x: x0 / scale, y: y0 / scale, w: c.width / scale, h: c.height / scale };
}

// Coarse alpha mask (one cell per 4 world px) so the renderer can tell when
// a prop actually covers a character standing behind it
const MASK_CELL = 4;
function coverageMask(canvas) {
    const w = Math.max(1, Math.ceil(canvas.width / MASK_CELL)), h = Math.max(1, Math.ceil(canvas.height / MASK_CELL));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(canvas, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;
    const data = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i++) data[i] = px[i * 4 + 3];
    return { w, h, data };
}

// True when any of the points (world space) falls on an opaque part of the sprite
export function propCovers(pr, points) {
    const m = pr.mask;
    for (const [x, y] of points) {
        const mx = Math.floor(((x - pr.x) / pr.w) * m.w), my = Math.floor(((y - pr.y) / pr.h) * m.h);
        if (mx < 0 || my < 0 || mx >= m.w || my >= m.h) continue;
        if (m.data[my * m.w + mx] > 110) return true;
    }
    return false;
}

// ─── The present day (ERA === "present") ────────────────────────────────
// The same archive in 2026: fluorescent tubes on chains, an exit sign, a
// CCTV camera, crime-scene markers and tape, cables run to the work lights.
// Live parts (tube flicker, screens, the camera's head) are left on `out`.

const CARDBOARD = { top: [150, 122, 84], front: [128, 100, 66], side: [92, 70, 46] };
const STEEL = { top: [120, 124, 130], front: [84, 88, 94], side: [58, 60, 66] };

// A twin-tube fluorescent fitting hung on chains in front of a shelf bay
function paintTube(ctx, rand, u, w, out) {
    const h = 176;
    for (const sd of [-1, 1]) {
        const a = P(u + sd * 34, w, h + 2), b = P(u + sd * 30, w, 300);
        ctx.strokeStyle = "#1a1918";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 1.5]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    box(ctx, rand, u - 46, u + 46, w - 5, w + 5, h, h + 5, STEEL, { hatchFront: 0, ink: 0.9 });
    const t0 = P(u - 42, w - 5, h - 1.5), t1 = P(u + 42, w - 5, h - 1.5);
    ctx.strokeStyle = "#cfd4d8";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(t0.x, t0.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.stroke();
    // A blackened end where the tube is failing
    ctx.strokeStyle = "#3a3634";
    ctx.beginPath();
    ctx.moveTo(t1.x - 7, t1.y);
    ctx.lineTo(t1.x, t1.y);
    ctx.stroke();
    ctx.lineCap = "butt";
    out.tube = { x0: t0.x, x1: t1.x, y: t0.y };
}

// Green emergency exit sign bolted to the door pillar
function paintExitSign(ctx, rand, u, w, out) {
    const c = P(u, w, 150);
    const W = 26, H = 11;
    ctx.fillStyle = "#e8ece6";
    ctx.fillRect(c.x - W / 2 - 1.5, c.y - H / 2 - 1.5, W + 3, H + 3);
    ctx.fillStyle = "#1f8a4a";
    ctx.fillRect(c.x - W / 2, c.y - H / 2, W, H);
    ctx.fillStyle = "#f2f7f2";
    // Running figure and an arrow, simplified to the pictogram's bones
    ctx.beginPath();
    ctx.arc(c.x - 8, c.y - 3, 1.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f2f7f2";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(c.x - 8.5, c.y - 1.5);
    ctx.lineTo(c.x - 9.5, c.y + 1.5);
    ctx.lineTo(c.x - 11.5, c.y + 4);
    ctx.moveTo(c.x - 9.5, c.y + 1.5);
    ctx.lineTo(c.x - 7, c.y + 4);
    ctx.moveTo(c.x - 11, c.y - 0.5);
    ctx.lineTo(c.x - 6, c.y);
    ctx.moveTo(c.x - 3, c.y);
    ctx.lineTo(c.x + 8, c.y);
    ctx.moveTo(c.x + 5, c.y - 3);
    ctx.lineTo(c.x + 8.5, c.y);
    ctx.lineTo(c.x + 5, c.y + 3);
    ctx.stroke();
    ctx.strokeStyle = "rgba(6,4,4,0.85)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(c.x - W / 2 - 1.5, c.y - H / 2 - 1.5, W + 3, H + 3);
    out.glows = [{ x: c.x, y: c.y, r: 26, color: [60, 230, 120], a: 0.5 }];
    out.lights = [{ x: c.x, y: c.y + 10, r: 110, color: [80, 220, 130], a: 0.45 }];
}

// CCTV camera on a wall bracket; the head is drawn live so it can follow you
function paintCctv(ctx, rand, u, w, out) {
    const m = P(u, w, 160);
    ctx.fillStyle = "#2a2b2e";
    ctx.fillRect(m.x - 4, m.y - 5, 8, 10);
    ctx.strokeStyle = "rgba(6,4,4,0.9)";
    ctx.lineWidth = 0.8;
    ctx.strokeRect(m.x - 4, m.y - 5, 8, 10);
    ctx.strokeStyle = "#3a3b3f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x, m.y + 9);
    ctx.stroke();
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(m.x + 3, m.y + 4);
    ctx.quadraticCurveTo(m.x + 10, m.y + 30, m.x + 6, m.y + 80);
    ctx.stroke();
    out.cctv = { x: m.x, y: m.y + 10 };
}

// A laptop left open on the reading table with a paper cup beside it
function paintLaptop(ctx, rand, u, w, H, out) {
    const lu = u - 28, lw = w;
    box(ctx, rand, lu - 16, lu + 16, lw - 11, lw + 9, H, H + 1.6, STEEL, { hatchFront: 0, ink: 0.8 });
    // Lid tilted back: a dark bezel with the screen inside it
    const s0 = P(lu - 16, lw + 9, H + 1.6), s1 = P(lu + 16, lw + 9, H + 1.6), s2 = P(lu + 15, lw + 15, H + 22), s3 = P(lu - 15, lw + 15, H + 22);
    pathPoly(ctx, [s0, s1, s2, s3]);
    ctx.fillStyle = "#1a1b1f";
    ctx.fill();
    inkPoly(ctx, rand, [s0, s1, s2, s3], 0.9);
    const k = 1.6;
    const scr = [{ x: s0.x + k, y: s0.y - k }, { x: s1.x - k, y: s1.y - k }, { x: s2.x - k, y: s2.y + k }, { x: s3.x + k, y: s3.y + k }];
    pathPoly(ctx, scr);
    ctx.fillStyle = "#26324a";
    ctx.fill();
    ctx.fillStyle = "rgba(200, 215, 240, 0.5)";
    for (let i = 0; i < 5; i++) {
        const y = scr[3].y + 3 + i * 2.6;
        ctx.fillRect(scr[3].x + 3, y, (scr[2].x - scr[3].x) * (0.3 + rand() * 0.5), 0.8);
    }
    out.glows = (out.glows || []).concat([{ x: (scr[0].x + scr[2].x) / 2, y: (scr[0].y + scr[2].y) / 2, r: 24, color: [150, 180, 255], a: 0.45 }]);
    out.lights = (out.lights || []).concat([{ x: (scr[0].x + scr[2].x) / 2, y: scr[0].y, r: 80, color: [150, 180, 255], a: 0.45 }]);
    // Keys
    const kb = P(lu, lw - 3, H + 1.7);
    ctx.fillStyle = "rgba(10, 10, 12, 0.6)";
    ctx.fillRect(kb.x - 11, kb.y - 2, 22, 4);
    // Paper coffee cup with a lid
    const cp = P(u + 12, w - 10, H);
    ctx.fillStyle = "#e4dfd2";
    ctx.beginPath();
    ctx.moveTo(cp.x - 3, cp.y - 9);
    ctx.lineTo(cp.x + 3, cp.y - 9);
    ctx.lineTo(cp.x + 2.3, cp.y);
    ctx.lineTo(cp.x - 2.3, cp.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7a5634";
    ctx.fillRect(cp.x - 3, cp.y - 6, 6, 3);
    ctx.fillStyle = "#2a2828";
    ctx.fillRect(cp.x - 3.4, cp.y - 10.5, 6.8, 1.8);
    ctx.strokeStyle = "rgba(6,4,4,0.7)";
    ctx.lineWidth = 0.6;
    ctx.strokeRect(cp.x - 3, cp.y - 9, 6, 9);
}

// A yellow numbered evidence marker tent
function paintMarker(n) {
    return (ctx, rand, u, w, out) => {
        const b0 = P(u - 6.5, w - 3, 0), b1 = P(u + 6.5, w - 3, 0), t0 = P(u - 5.5, w, 13), t1 = P(u + 5.5, w, 13);
        pathPoly(ctx, [b0, b1, t1, t0]);
        ctx.fillStyle = "#e5b51e";
        ctx.fill();
        ctx.strokeStyle = "rgba(6,4,4,0.85)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.fillStyle = "#141210";
        ctx.font = "bold 9px Arial, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(n), (b0.x + t1.x) / 2, (b0.y + t1.y) / 2 + 0.5);
    };
}

// Barrier posts with sagging caution tape between them
function paintTape(ctx, rand, u, w, out) {
    const posts = [-74, 74];
    const tops = [];
    for (const pu of posts) {
        const base = P(u + pu, w, 0), top = P(u + pu, w, 34);
        ctx.fillStyle = "#1c1c1e";
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, 6, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#2e2f33";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
        ctx.strokeStyle = "rgba(200, 205, 210, 0.3)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(base.x - 0.7, base.y);
        ctx.lineTo(top.x - 0.7, top.y);
        ctx.stroke();
        tops.push(top);
    }
    const [a, b] = tops;
    const mid = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 9 };
    ctx.strokeStyle = "#e3b51c";
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mid.x, mid.y, b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = "#141210";
    ctx.lineWidth = 3.4;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mid.x, mid.y, b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // A torn end hanging from one post
    ctx.strokeStyle = "#e3b51c";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + 2);
    ctx.quadraticCurveTo(b.x + 5, b.y + 12, b.x + 2, b.y + 22);
    ctx.stroke();
}

// Extension cables taped across the floor to the two work lights
function paintCables(ctx, rand, u, w, out) {
    const f = out.floor;
    const runs = [[[800, 318], [560, 340], [380, 352], [300, 358]], [[800, 318], [1040, 342], [1220, 350], [1300, 358]]];
    for (const run of runs) {
        const pts = run.map(([x, y]) => {
            const q = placeAt(x, y);
            return P(q.u + (rand() - 0.5) * 10, q.w, 0.3);
        });
        f.strokeStyle = "#141416";
        f.lineWidth = 1.6;
        f.beginPath();
        f.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) f.quadraticCurveTo(pts[i - 1].x + 10, (pts[i - 1].y + pts[i].y) / 2 + 4, pts[i].x, pts[i].y);
        f.stroke();
        // Gaffer tape holding it down
        for (let i = 1; i < pts.length - 1; i++) {
            f.fillStyle = "rgba(60, 60, 64, 0.95)";
            f.fillRect(pts[i].x - 5, pts[i].y - 1.6, 10, 3.2);
        }
    }
    // Power strip by the door
    const ps = P(u, w, 0);
    f.fillStyle = "#e0dcd4";
    f.fillRect(ps.x - 10, ps.y - 2, 20, 4);
    f.fillStyle = "#c22";
    f.fillRect(ps.x + 7, ps.y - 1, 2, 2);
}

// ─── Placement ───────────────────────────────────────────────────────────
// x, y: where the prop's footprint centre sits in the room (screen/world space).
// du, dw: footprint half-extents in floor units (for colliders and shadows).
// height: tallest point in floor units (for the sprite's bounds).
const TABLE = placeAt(600, 470);
const nearTable = (du, dw) => {
    const p = P(TABLE.u + du, TABLE.w + dw);
    return { x: p.x, y: p.y };
};
export const PROP_DEFS = [
    { id: "reading_table", x: 600, y: 470, du: 100, dw: 34, height: 70, paint: paintReadingTable },
    // Far chair facing us across the table; near chair pulled out, its back to us
    { id: "chair_far", ...nearTable(-30, 56), du: 16, dw: 16, height: 90, paint: (c, r, u, w, o) => highChair(c, r, u, w, "facing", o) },
    { id: "chair_near", ...nearTable(22, -50), du: 16, dw: 16, height: 90, paint: (c, r, u, w, o) => highChair(c, r, u, w, "away", o) },
    { id: "pew_left", x: 642, y: 735, du: 60, dw: 14, height: 62, paint: (c, r, u, w, o) => paintPew(c, r, u, w, o, { candle: -1 }) },
    { id: "pew_right", x: 958, y: 735, du: 60, dw: 14, height: 62, paint: (c, r, u, w, o) => paintPew(c, r, u, w, o, { broken: true }) },
    { id: "catalog_a", x: 995, y: 440, du: 34, dw: 18, height: 112, paint: (c, r, u, w, o) => paintCatalog(c, r, u, w, o, { open: [9, 22, 27], candle: true }), extent: { dw0: 40 } },
    { id: "catalog_b", x: 1130, y: 440, du: 34, dw: 18, height: 112, paint: (c, r, u, w, o) => paintCatalog(c, r, u, w, o, { open: [5, 14] }), extent: { dw0: 40 } },
    { id: "lectern", x: 1268, y: 470, du: 36, dw: 20, height: 90, paint: paintLectern },
    { id: "evidence_board", x: 333, y: 461, du: 46, dw: 14, height: 140, paint: paintEvidenceBoard },
    { id: "statue", x: 1396, y: 428, du: 26, dw: 26, height: 180, paint: paintStatue, extent: { dw0: 40 } },
    { id: "gibbet", x: 1268, y: 705, du: 40, dw: 18, height: 160, paint: paintGibbet },
    { id: "crates_left", x: 205, y: 912, du: 54, dw: 30, height: 80, paint: (c, r, u, w, o) => paintCrates(c, r, u, w, o, { skull: true }) },
    { id: "crates_right", x: 1440, y: 905, du: 54, dw: 30, height: 80, paint: (c, r, u, w, o) => paintCrates(c, r, u, w, o, { flip: true }) },
    // The present day: things the living have brought in since
    { id: "tube_left", era: "present", solid: false, x: 438, y: 306, du: 46, dw: 5, height: 300, paint: paintTube, extent: { dw0: 6, dw1: 6 } },
    { id: "tube_right", era: "present", solid: false, x: 1162, y: 306, du: 46, dw: 5, height: 300, paint: paintTube, extent: { dw0: 6, dw1: 6 } },
    { id: "exit_sign", era: "present", solid: false, x: 700, y: 306, du: 16, dw: 2, height: 170, paint: paintExitSign, extent: { dw0: 4, dw1: 4 } },
    { id: "cctv", era: "present", solid: false, x: 1074, y: 306, du: 10, dw: 2, height: 180, paint: paintCctv, extent: { dw0: 4, dw1: 4 } },
    { id: "cables", era: "present", solid: false, x: 800, y: 318, du: 520, dw: 4, height: 4, paint: paintCables, extent: { dw0: 60, dw1: 10 } },
    { id: "tape", era: "present", solid: false, x: 1268, y: 752, du: 80, dw: 3, height: 50, paint: paintTape },
    ...[[560, 600, 1], [700, 640, 2], [470, 760, 3], [905, 580, 4], [1160, 640, 5], [380, 560, 6]].map(([x, y, n]) => (
        { id: `marker_${n}`, era: "present", solid: false, x, y, du: 7, dw: 3, height: 16, paint: paintMarker(n), extent: { du: 4, dw0: 4, dw1: 4 } }
    ))
].filter(d => !d.era || d.era === ERA);

// Colliders as screen-space rectangles over each footprint (engine obstacle format)
export const PROP_COLLIDERS = PROP_DEFS.filter(d => d.solid !== false).map(d => {
    const { u, w } = placeAt(d.x, d.y);
    const a = P(u - d.du, w + d.dw), b = P(u + d.du, w + d.dw), c = P(u + d.du, w - d.dw), e = P(u - d.du, w - d.dw);
    const x0 = Math.min(a.x, e.x), x1 = Math.max(b.x, c.x);
    return { x: x0, y: a.y, w: x1 - x0, h: c.y - a.y, label: "prop", id: d.id };
});

// Paint every prop into its own pair of canvases. Returns sprites plus their flames.
export function buildPropSprites(scale = 1) {
    const rand = mulberry32(4242);
    return PROP_DEFS.map(d => buildSprite(d, scale, rand));
}

// Paint one def ({ x, y, du, dw, height, extent?, paint }) into an upright
// sprite (depth-sorted, trimmed, with a coverage mask) and a floor layer.
// The painter can leave anything it likes on `out` for the renderer (meta).
export function buildSprite(d, scale, rand) {
    const { u, w } = placeAt(d.x, d.y);
    const ext = d.extent || {};
    const reachBack = d.dw + (ext.dw1 ?? 30), reachFront = d.dw + (ext.dw0 ?? 30), side = ext.du ?? 30;
    const corners = [
        P(u - d.du - side, w + reachBack, d.height + 20), P(u + d.du + side, w + reachBack, d.height + 20),
        P(u - d.du - side, w - reachFront, 0), P(u + d.du + side, w - reachFront, 0)
    ];
    const x0 = Math.floor(Math.min(...corners.map(p => p.x)) - 10);
    const x1 = Math.ceil(Math.max(...corners.map(p => p.x)) + 10);
    const y0 = Math.floor(Math.min(...corners.map(p => p.y)) - 20);
    const y1 = Math.ceil(Math.max(...corners.map(p => p.y)) + 10);
    const layer = () => {
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round((x1 - x0) * scale));
        c.height = Math.max(1, Math.round((y1 - y0) * scale));
        const g = c.getContext("2d");
        g.scale(scale, scale);
        g.translate(-x0, -y0);
        return [c, g];
    };
    // Floor layer (shadows, spilled paper) sits under every character;
    // the upright layer is depth-sorted with them.
    const [floorCanvas, floor] = layer();
    const [canvas, ctx] = layer();
    const out = { flames: [], floor };
    d.paint(ctx, rand, u, w, out);
    finish(canvas, ctx, (P(u, w - d.dw).y - y0) * scale);
    // Trim the generous painting margins so each frame draws fewer pixels
    const t = cropToContent(canvas, scale);
    delete out.floor;
    return {
        mask: coverageMask(t.canvas),
        id: d.id,
        canvas: t.canvas,
        floorCanvas,
        floorRect: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
        x: x0 + t.x, y: y0 + t.y, w: t.w, h: t.h,
        ax: d.x, ay: d.y,
        sortY: P(u, w - d.dw).y,
        topY: P(u, w, d.height).y,
        flames: out.flames,
        meta: out
    };
}
