// The Keeping House's fixtures: the Monolith and the interactable objects
// (ritual altar, signal pylon, lantern shrine, record chest, sealed door,
// corpses), painted in the same ink-illustration style and perspective as
// the room (world.js) and its furniture (props.js).
//
// Each fixture is painted once into sprites. Anything that moves or glows
// (flames, the Monolith's eye and glyphs, static, embers, the door and the
// chest lid) is left to the renderer, which reads the positions the painters
// record on the sprite's `meta`.

import { project, mulberry32, pathPoly, inkLine, inkPoly, hatch, drawSkull, ROOM } from "./world.js";
import { placeAt, box, candle, floorShadow, flatPaper, fillFace, buildSprite, WOOD, DARKWOOD, STONE, IRON } from "./props.js";

const P = project;
const BASALT = { top: [66, 64, 68], front: [40, 39, 43], side: [27, 26, 29] };
const GRANITE = { top: [96, 90, 86], front: [68, 63, 60], side: [44, 41, 40] };
const BRASS = "#9a7838";

// ─── Small painting helpers ──────────────────────────────────────────────

// An irregular blob lying in the floor plane (blood, ink, ash, wax)
function floorBlob(ctx, rand, u, w, ru, rw, fill, h = 0.2) {
    const pts = [];
    const n = 18;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const k = 0.72 + rand() * 0.5;
        pts.push(P(u + Math.cos(a) * ru * k, w + Math.sin(a) * rw * k, h));
    }
    ctx.beginPath();
    ctx.moveTo((pts[0].x + pts[n - 1].x) / 2, (pts[0].y + pts[n - 1].y) / 2);
    for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    return pts;
}

// Glossy liquid: a dark pool with a soft highlight
function pool(ctx, rand, u, w, ru, rw, [r, g, b]) {
    floorBlob(ctx, rand, u, w, ru * 1.08, rw * 1.08, `rgba(${r * 0.4}, ${g * 0.4}, ${b * 0.4}, 0.55)`);
    floorBlob(ctx, rand, u, w, ru, rw, `rgba(${r}, ${g}, ${b}, 0.92)`);
    const c = P(u - ru * 0.3, w + rw * 0.2, 0.3);
    ctx.fillStyle = "rgba(255, 220, 200, 0.18)";
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, ru * 0.3 * c.s, rw * 0.12 * c.s, 0, 0, Math.PI * 2);
    ctx.fill();
}

// Drips running down a vertical face from (x, y)
function drips(ctx, rand, x0, x1, y, count, len, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
        const x = x0 + rand() * (x1 - x0), l = len * (0.3 + rand() * 0.9), wd = 1.2 + rand() * 1.6;
        ctx.beginPath();
        ctx.moveTo(x - wd, y);
        ctx.lineTo(x + wd, y);
        ctx.quadraticCurveTo(x + wd * 0.6, y + l * 0.6, x + wd * 0.5, y + l);
        ctx.arc(x, y + l, wd * 0.55, 0, Math.PI);
        ctx.quadraticCurveTo(x - wd * 0.6, y + l * 0.6, x - wd, y);
        ctx.fill();
    }
}

// A chain hung along a quadratic curve, links alternating face-on and edge-on
function chain(ctx, a, c, b, link = 3.2, color = "#24211f") {
    const len = Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - a.x, c.y - a.y) * 0.3;
    const n = Math.max(3, Math.floor(len / (link * 1.5)));
    for (let i = 0; i <= n; i++) {
        const t = i / n, mt = 1 - t;
        const x = mt * mt * a.x + 2 * mt * t * c.x + t * t * b.x;
        const y = mt * mt * a.y + 2 * mt * t * c.y + t * t * b.y;
        const dx = 2 * mt * (c.x - a.x) + 2 * t * (b.x - c.x), dy = 2 * mt * (c.y - a.y) + 2 * t * (b.y - c.y);
        const ang = Math.atan2(dy, dx);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        if (i % 2 === 0) {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(0, 0, link, link * 0.55, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = "rgba(200, 180, 150, 0.22)";
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.ellipse(0, -0.4, link * 0.8, link * 0.35, 0, Math.PI * 1.1, Math.PI * 1.9);
            ctx.stroke();
        } else {
            ctx.fillStyle = color;
            ctx.fillRect(-link, -0.9, link * 2, 1.8);
        }
        ctx.restore();
    }
}

// A wax seal: a red disc with a raised rim, a stamped sigil and a drip
function waxSeal(ctx, rand, x, y, r, sigil = "eye") {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(x + r * 0.15, y + r * 0.2, r * 1.05, r, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, "#c2322a");
    g.addColorStop(0.6, "#8c1610");
    g.addColorStop(1, "#4e0806");
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 2, rr = r * (0.94 + rand() * 0.1);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(40, 4, 2, 0.8)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.strokeStyle = "rgba(60, 6, 4, 0.7)";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.66, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 150, 130, 0.35)";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.66, Math.PI * 1.05, Math.PI * 1.6);
    ctx.stroke();
    ctx.strokeStyle = "rgba(50, 4, 2, 0.85)";
    ctx.lineWidth = Math.max(0.6, r * 0.09);
    if (sigil === "eye") {
        ctx.beginPath();
        ctx.moveTo(x - r * 0.45, y);
        ctx.quadraticCurveTo(x, y - r * 0.38, x + r * 0.45, y);
        ctx.quadraticCurveTo(x, y + r * 0.38, x - r * 0.45, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(50, 4, 2, 0.85)";
        ctx.beginPath();
        ctx.arc(x, y, r * 0.13, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.moveTo(x, y - r * 0.42);
        ctx.lineTo(x, y + r * 0.42);
        ctx.moveTo(x - r * 0.3, y - r * 0.1);
        ctx.lineTo(x + r * 0.3, y - r * 0.1);
        ctx.stroke();
    }
    ctx.restore();
}

// A pinned paper note with a few ink lines, slightly rotated
function note(ctx, rand, x, y, wd, ht, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(-wd / 2 + 1.2, -ht / 2 + 1.5, wd, ht);
    const t = 190 + rand() * 30;
    ctx.fillStyle = `rgb(${t}, ${t * 0.91}, ${t * 0.72})`;
    ctx.beginPath();
    ctx.moveTo(-wd / 2, -ht / 2);
    ctx.lineTo(wd / 2, -ht / 2);
    ctx.lineTo(wd / 2, ht / 2 - 2);
    ctx.lineTo(wd / 2 - 3, ht / 2);
    ctx.lineTo(-wd / 2, ht / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(40, 24, 12, 0.6)";
    for (let k = 0; k < Math.floor(ht / 2.6) - 1; k++) ctx.fillRect(-wd / 2 + 1.2, -ht / 2 + 2.2 + k * 2.4, wd * (0.4 + rand() * 0.45), 0.6);
    ctx.strokeStyle = "rgba(6,4,4,0.6)";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.fillStyle = "#2a2522";
    ctx.beginPath();
    ctx.arc(0, -ht / 2 + 1.4, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Rotate a point about a hinge line running along u, in the w–h plane
function hinge(u, dw, dh, angle, w0, h0) {
    const c = Math.cos(angle), s = Math.sin(angle);
    return P(u, w0 + dw * c + dh * s, h0 - dw * s + dh * c);
}

// Signed screen-space area: >0 when a face is wound clockwise on screen
// (each lid face lists its corners so that this means "facing the viewer")
function facing(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        a += p.x * q.y - q.x * p.y;
    }
    return a;
}

// ─── The Monolith ────────────────────────────────────────────────────────
// An octagonal basalt obelisk on three stepped tiers: a carved panel of
// glyphs, a lidded eye under the pyramidion, chains, cracks, nailed notes,
// candles and a heap of wax seals and paper at its foot.

function paintMonolith(ctx, rand, u, w, out) {
    floorShadow(out.floor, u - 58, u + 58, w - 40, w + 40, 0.9, 12);

    // Stepped tiers
    const tiers = [[54, 38, 0, 9], [44, 30, 9, 17], [35, 23, 17, 25]];
    for (const [hu, hw, h0, h1] of tiers) {
        const f = box(ctx, rand, u - hu, u + hu, w - hw, w + hw, h0, h1, BASALT, { hatchFront: 0.32 });
        // Worn bright arris along each tread
        ctx.strokeStyle = "rgba(170, 170, 185, 0.22)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(f.front[3].x + 2, f.front[3].y + 0.6);
        ctx.lineTo(f.front[2].x - 2, f.front[2].y + 0.6);
        ctx.stroke();
    }
    // Carved runes along the lowest tier
    const rb = P(u, w - 38, 4.5);
    ctx.strokeStyle = "rgba(10, 8, 8, 0.7)";
    ctx.lineWidth = 0.8;
    for (let x = rb.x - 40; x < rb.x + 40; x += 6 + rand() * 3) {
        ctx.beginPath();
        ctx.moveTo(x, rb.y - 2.5);
        ctx.lineTo(x + (rand() - 0.5) * 3, rb.y + 2.5);
        if (rand() < 0.5) {
            ctx.moveTo(x - 1.5, rb.y - 0.5);
            ctx.lineTo(x + 1.5, rb.y + 0.5);
        }
        ctx.stroke();
    }

    // Shaft geometry: the front face leans back as the shaft tapers
    const hb = 25, ht = 252, hp = 292;
    const F0 = 22, F1 = 13, C0 = 8, C1 = 5, D0 = 17, D1 = 10;
    const lerp = (a, b, t) => a + (b - a) * t;
    const at = h => {
        const t = (h - hb) / (ht - hb);
        return { F: lerp(F0, F1, t), C: lerp(C0, C1, t), D: lerp(D0, D1, t) };
    };
    const fp = (fu, h) => {
        const g = at(h);
        return P(u + fu * g.F, w - g.D, h); // fu in -1..1 across the front face
    };
    const front = [fp(-1, hb), fp(1, hb), fp(1, ht), fp(-1, ht)];
    const cham = sd => [P(u + sd * F0, w - D0, hb), P(u + sd * (F0 + C0), w - D0 + C0, hb), P(u + sd * (F1 + C1), w - D1 + C1, ht), P(u + sd * F1, w - D1, ht)];
    const apex = P(u, w, hp);
    const capFront = [fp(-1, ht), fp(1, ht), apex];
    const capSide = sd => [P(u + sd * F1, w - D1, ht), P(u + sd * (F1 + C1), w - D1 + C1, ht), apex];

    // Chamfers: the left catches cold moonlight, the right sinks into shadow
    for (const sd of [-1, 1]) {
        const q = cham(sd);
        pathPoly(ctx, q);
        const g = ctx.createLinearGradient(0, apex.y, 0, q[0].y);
        if (sd < 0) {
            g.addColorStop(0, "#5c5e68");
            g.addColorStop(1, "#2b2c33");
        } else {
            g.addColorStop(0, "#151315");
            g.addColorStop(1, "#0a0909");
        }
        ctx.fillStyle = g;
        ctx.fill();
        inkPoly(ctx, rand, q, 1.2);
        const cs = capSide(sd);
        pathPoly(ctx, cs);
        ctx.fillStyle = sd < 0 ? "#5f616b" : "#121011";
        ctx.fill();
        inkPoly(ctx, rand, cs, 1.1);
    }
    // Front face
    pathPoly(ctx, front);
    const fg = ctx.createLinearGradient(front[0].x, 0, front[1].x, 0);
    fg.addColorStop(0, "#2d292b");
    fg.addColorStop(0.45, "#1c191a");
    fg.addColorStop(1, "#0e0c0d");
    ctx.fillStyle = fg;
    ctx.fill();
    ctx.save();
    pathPoly(ctx, front);
    ctx.clip();
    const fx0 = front[0].x, fx1 = front[1].x, fy0 = front[3].y, fy1 = front[0].y;
    // Basalt speckle, strata and weathering streaks
    for (let i = 0; i < 420; i++) {
        ctx.fillStyle = rand() < 0.5 ? "rgba(150, 145, 150, 0.08)" : "rgba(0, 0, 0, 0.25)";
        ctx.fillRect(fx0 + rand() * (fx1 - fx0), fy0 + rand() * (fy1 - fy0), 1, 1);
    }
    ctx.strokeStyle = "rgba(120, 115, 120, 0.06)";
    ctx.lineWidth = 0.7;
    for (let y = fy0 + 6; y < fy1; y += 7 + rand() * 9) {
        ctx.beginPath();
        ctx.moveTo(fx0, y);
        ctx.lineTo(fx1, y + (rand() - 0.5) * 2);
        ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
        const x = fx0 + rand() * (fx1 - fx0), y = fy0 + rand() * (fy1 - fy0) * 0.6;
        const g = ctx.createLinearGradient(0, y, 0, y + 40 + rand() * 80);
        g.addColorStop(0, "rgba(0,0,0,0.3)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 1 + rand() * 1.5, 120);
    }
    hatch(ctx, rand, (fx0 + fx1) / 2, fy0, (fx1 - fx0) / 2 + 4, fy1 - fy0, { angle: 1.2, gap: 2.6, alpha: 0.3 });
    // Moonlight sheen down the lit edge
    const sheen = ctx.createLinearGradient(fx0, 0, fx0 + 10, 0);
    sheen.addColorStop(0, "rgba(150, 160, 190, 0.16)");
    sheen.addColorStop(1, "rgba(150, 160, 190, 0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(fx0, fy0, 12, fy1 - fy0);
    ctx.restore();
    inkPoly(ctx, rand, front, 1.5);
    // Pyramidion front facet
    pathPoly(ctx, capFront);
    const cg = ctx.createLinearGradient(0, apex.y, 0, capFront[0].y);
    cg.addColorStop(0, "#4a4648");
    cg.addColorStop(1, "#262224");
    ctx.fillStyle = cg;
    ctx.fill();
    inkPoly(ctx, rand, capFront, 1.3);
    // Cold rim light on the left arrises
    ctx.strokeStyle = "rgba(170, 180, 210, 0.45)";
    ctx.lineWidth = 1;
    const lc = cham(-1);
    ctx.beginPath();
    ctx.moveTo(lc[1].x + 0.6, lc[1].y);
    ctx.lineTo(lc[2].x + 0.6, lc[2].y);
    ctx.lineTo(apex.x, apex.y + 1);
    ctx.stroke();
    // Warm rim from the red pool on the right
    ctx.strokeStyle = "rgba(200, 70, 40, 0.3)";
    const rc = cham(1);
    ctx.beginPath();
    ctx.moveTo(rc[1].x - 0.6, rc[1].y - 2);
    ctx.lineTo(rc[2].x - 0.6, rc[2].y + 30);
    ctx.stroke();

    // Carved panel: a bevelled border inside the face
    const panel = [fp(-0.78, 40), fp(0.78, 40), fp(0.78, 206), fp(-0.78, 206)];
    pathPoly(ctx, panel);
    ctx.strokeStyle = "rgba(4, 3, 3, 0.95)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = "rgba(140, 135, 145, 0.18)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(panel[0].x + 1, panel[0].y + 1.2);
    ctx.lineTo(panel[1].x + 1, panel[1].y + 1.2);
    ctx.lineTo(panel[2].x + 1, panel[2].y + 1.2);
    ctx.stroke();

    // Glyph column: carved grooves now, burning later (the renderer relights them)
    out.glyphs = [];
    const strokesFor = () => {
        const s = [];
        const kind = rand();
        if (kind < 0.55) s.push([[0, 0], [0, 1]]);
        else {
            const ring = [];
            for (let i = 0; i <= 10; i++) {
                const a = (i / 10) * Math.PI * 2;
                ring.push([Math.cos(a) * 0.38, 0.5 + Math.sin(a) * 0.38]);
            }
            s.push(ring);
            s.push([[0, 0.12], [0, -0.05]]);
        }
        const extras = [
            () => { const y = 0.2 + rand() * 0.6; return [[-0.7, y], [0.7, y - 0.12]]; },
            () => { const a = 0.15 + rand() * 0.3; return [[-0.7, a], [0, a + 0.3], [0.7, a]]; },
            () => [[0, 1], [0.6, 0.85], [0.6, 0.55]],
            () => [[-0.6, 0.1], [0.6, 0.9]],
            () => [[-0.7, 1], [0.7, 1]],
            () => [[-0.55, 0.65], [-0.2, 0.35], [-0.55, 0.05]]
        ];
        const n = 1 + Math.floor(rand() * 2);
        for (let i = 0; i < n; i++) s.push(extras[Math.floor(rand() * extras.length)]());
        return s;
    };
    let row = 0;
    for (let h = 54; h <= 192; h += 17, row++) {
        const half = at(h).F * 0.42, gh = 11;
        for (const st of strokesFor()) {
            const pts = st.map(([gx, gy]) => fp((gx * half) / at(h + gy * gh).F, h + gh - gy * gh));
            out.glyphs.push({ pts, row });
            // The groove: dark cut with a lit lower lip
            for (const [col, dx, dy, wd] of [["rgba(160, 150, 150, 0.2)", 0.7, 0.9, 1], ["#050404", 0, 0, 1.9]]) {
                ctx.strokeStyle = col;
                ctx.lineWidth = wd;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(pts[0].x + dx, pts[0].y + dy);
                for (const p of pts.slice(1)) ctx.lineTo(p.x + dx, p.y + dy);
                ctx.stroke();
            }
        }
    }
    ctx.lineCap = "butt";
    out.glyphRows = row;

    // The eye socket under the pyramidion (lids and iris are drawn live)
    const ec = fp(0, 226), ew = at(226).F * 0.82 * ec.s, eh = 7.5 * ec.s;
    out.eye = { x: ec.x, y: ec.y, rw: ew, rh: eh };
    ctx.fillStyle = "#020101";
    ctx.beginPath();
    ctx.moveTo(ec.x - ew - 3, ec.y);
    ctx.quadraticCurveTo(ec.x, ec.y - eh * 2.1, ec.x + ew + 3, ec.y);
    ctx.quadraticCurveTo(ec.x, ec.y + eh * 2.1, ec.x - ew - 3, ec.y);
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 145, 150, 0.3)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(ec.x - ew - 4, ec.y - 1);
    ctx.quadraticCurveTo(ec.x, ec.y - eh * 2.4, ec.x + ew + 4, ec.y - 1);
    ctx.stroke();
    // Radiating lashes cut into the stone
    ctx.strokeStyle = "rgba(5, 4, 4, 0.9)";
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
        const a = -Math.PI / 2 + i * 0.32;
        ctx.beginPath();
        ctx.moveTo(ec.x + Math.cos(a) * ew * 0.9, ec.y - eh * 1.1 + Math.sin(a) * 2);
        ctx.lineTo(ec.x + Math.cos(a) * ew * 1.25, ec.y - eh * 1.1 + Math.sin(a) * 7);
        ctx.stroke();
    }

    // Cracks: dark fissures (they bleed red light with Observation)
    out.cracks = [];
    const crack = (fu, h0, steps, dh) => {
        const pts = [fp(fu, h0)];
        let cu = fu, ch = h0;
        for (let i = 0; i < steps; i++) {
            cu = Math.max(-0.95, Math.min(0.95, cu + (rand() - 0.5) * 0.28));
            ch += dh * (0.7 + rand() * 0.6);
            pts.push(fp(cu, ch));
        }
        out.cracks.push(pts);
        ctx.strokeStyle = "rgba(150, 140, 140, 0.18)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(pts[0].x + 0.8, pts[0].y + 0.6);
        for (const p of pts.slice(1)) ctx.lineTo(p.x + 0.8, p.y + 0.6);
        ctx.stroke();
        ctx.strokeStyle = "#030202";
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };
    crack(0.62, hb + 1, 9, 9);
    crack(0.7, hb + 44, 3, 7);
    crack(-0.85, 150, 5, 8);
    crack(-0.2, 232, 3, 4);

    // Chains wrapped across the shaft, disappearing round the edges
    for (const [hl, hr, sag] of [[152, 128, 16], [96, 108, 12]]) {
        const a = P(u - at(hl).F - at(hl).C, w - at(hl).D + 4, hl), b = P(u + at(hr).F + at(hr).C, w - at(hr).D + 4, hr);
        const c = { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + sag };
        chain(ctx, a, c, b, 3.2);
        for (const e of [a, b]) {
            ctx.fillStyle = "#1a1716";
            ctx.beginPath();
            ctx.arc(e.x, e.y, 2.4, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // A padlock hanging from the lower chain
    const lk = P(u + 3, w - at(100).D, 96);
    ctx.fillStyle = "#3a3026";
    ctx.fillRect(lk.x - 4, lk.y + 4, 8, 7);
    ctx.strokeStyle = "#1a1612";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(lk.x, lk.y + 4, 2.8, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = "rgba(220, 180, 120, 0.3)";
    ctx.lineWidth = 0.6;
    ctx.strokeRect(lk.x - 4, lk.y + 4, 8, 7);

    // Notes nailed to the stone
    for (const [fu, h, wd, ht, rot] of [[-0.55, 72, 9, 12, -0.12], [0.5, 168, 8, 10, 0.1], [-0.6, 128, 6, 8, 0.2]]) {
        const p = fp(fu, h);
        note(ctx, rand, p.x, p.y, wd * p.s, ht * p.s, rot);
    }

    // Wax seals pressed onto the shaft's foot, bleeding down the tiers
    for (const [fu, h, r] of [[-0.45, 33, 5], [0.2, 30, 6.5], [0.7, 36, 4.2]]) {
        const p = fp(fu, h);
        waxSeal(ctx, rand, p.x, p.y, r * p.s, "eye");
    }
    const t3 = P(u, w - 23, 25), t2 = P(u, w - 30, 17);
    drips(ctx, rand, t3.x - 22, t3.x + 26, t3.y, 7, 9, "rgba(150, 22, 16, 0.9)");
    drips(ctx, rand, t2.x - 30, t2.x + 34, t2.y, 6, 8, "rgba(140, 20, 14, 0.85)");

    // Candles on the tiers
    out.flames.push(candle(ctx, rand, u - 46, w - 32, 9, 14, 2.8));
    out.flames.push(candle(ctx, rand, u - 39, w - 33, 9, 8, 2.6));
    out.flames.push(candle(ctx, rand, u + 44, w - 31, 9, 11, 2.8));
    out.flames.push(candle(ctx, rand, u - 28, w - 20, 25, 6, 2.4));
    out.flames.push(candle(ctx, rand, u + 27, w - 19, 25, 16, 2.6));

    // Heap of spent wax seals at the front-left foot, crumpled paper at the right
    for (let i = 0; i < 16; i++) {
        const p = P(u - 50 + rand() * 26, w - 46 + rand() * 14, 0);
        waxSeal(ctx, rand, p.x, p.y - rand() * 5, (2.6 + rand() * 2.8) * p.s, rand() < 0.5 ? "eye" : "cross");
    }
    for (let i = 0; i < 9; i++) {
        const p = P(u + 30 + rand() * 30, w - 46 + rand() * 14, 0);
        const r = (2.5 + rand() * 3) * p.s;
        ctx.fillStyle = `rgb(${190 + rand() * 30}, ${176 + rand() * 24}, ${140 + rand() * 20})`;
        ctx.beginPath();
        for (let k = 0; k < 7; k++) {
            const a = (k / 7) * Math.PI * 2, rr = r * (0.7 + rand() * 0.5);
            if (k === 0) ctx.moveTo(p.x + Math.cos(a) * rr, p.y - r + Math.sin(a) * rr);
            else ctx.lineTo(p.x + Math.cos(a) * rr, p.y - r + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(6,4,4,0.6)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.strokeStyle = "rgba(80, 60, 40, 0.5)";
        ctx.beginPath();
        ctx.moveTo(p.x - r * 0.5, p.y - r);
        ctx.lineTo(p.x + r * 0.3, p.y - r * 0.7);
        ctx.stroke();
    }
    out.pool = P(u, w - 10, 0);
}

// ─── Blood ritual altar ──────────────────────────────────────────────────
// A granite altar on the ritual circle, draped in black, its top pooled with
// blood running down the front; a bowl, a dagger, a grimoire, a skull and a
// thicket of candles.

function paintAltar(ctx, rand, u, w, out) {
    floorShadow(out.floor, u - 50, u + 50, w - 28, w + 28, 0.75);
    pool(out.floor, rand, u + 8, w - 34, 22, 8, [96, 8, 6]);
    pool(out.floor, rand, u - 20, w - 32, 8, 4, [96, 8, 6]);

    box(ctx, rand, u - 49, u + 49, w - 28, w + 28, 0, 5, GRANITE, { hatchFront: 0.3 });
    box(ctx, rand, u - 44, u + 44, w - 24, w + 24, 5, 31, GRANITE, { hatchFront: 0.2 });
    // Carved front: three panels, the centre one bearing the sigil
    for (const [a0, a1] of [[-40, -16], [-14, 14], [16, 40]]) {
        const q = [P(u + a0, w - 24, 9), P(u + a1, w - 24, 9), P(u + a1, w - 24, 27), P(u + a0, w - 24, 27)];
        pathPoly(ctx, q);
        ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
        ctx.fill();
        ctx.strokeStyle = "rgba(6,4,4,0.8)";
        ctx.lineWidth = 0.9;
        ctx.stroke();
        ctx.strokeStyle = "rgba(200, 190, 180, 0.14)";
        ctx.beginPath();
        ctx.moveTo(q[0].x + 1, q[0].y - 1);
        ctx.lineTo(q[1].x - 1, q[1].y - 1);
        ctx.lineTo(q[2].x - 1, q[2].y + 1);
        ctx.stroke();
    }
    const sg = P(u, w - 24, 18);
    ctx.strokeStyle = "rgba(10, 6, 6, 0.85)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(sg.x, sg.y, 7, 0, Math.PI * 2);
    ctx.moveTo(sg.x - 6, sg.y - 3.5);
    ctx.lineTo(sg.x + 6, sg.y - 3.5);
    ctx.lineTo(sg.x, sg.y + 6.5);
    ctx.closePath();
    ctx.stroke();
    // Top slab with an overhang
    box(ctx, rand, u - 47, u + 47, w - 26, w + 26, 31, 36, GRANITE, { hatchFront: 0.1 });

    // Black altar cloth: across the top and hanging down the front
    const H = 36;
    const top = [P(u - 17, w + 26, H + 0.4), P(u + 17, w + 26, H + 0.4), P(u + 17, w - 26, H + 0.4), P(u - 17, w - 26, H + 0.4)];
    pathPoly(ctx, top);
    ctx.fillStyle = "#151112";
    ctx.fill();
    const c0 = P(u - 17, w - 26.5, H), c1 = P(u + 17, w - 26.5, H), hem = P(u, w - 26.5, 8).y;
    ctx.beginPath();
    ctx.moveTo(c0.x, c0.y);
    ctx.lineTo(c1.x, c1.y);
    ctx.lineTo(c1.x + 1.5, hem);
    for (let x = c1.x; x > c0.x; x -= 3.4) ctx.lineTo(x - 1.7, hem + (rand() < 0.5 ? 2.5 : 0.5) + rand() * 1.5);
    ctx.lineTo(c0.x - 1.5, hem);
    ctx.closePath();
    const cl = ctx.createLinearGradient(0, c0.y, 0, hem);
    cl.addColorStop(0, "#2a2426");
    cl.addColorStop(1, "#100d0e");
    ctx.fillStyle = cl;
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 0.8;
    for (let x = c0.x + 4; x < c1.x - 2; x += 5 + rand() * 3) {
        ctx.beginPath();
        ctx.moveTo(x, c0.y + 2);
        ctx.quadraticCurveTo(x + 1, (c0.y + hem) / 2, x - 0.5, hem - 1);
        ctx.stroke();
    }
    // Red embroidered border and a sigil stitched in the middle
    ctx.strokeStyle = "rgba(150, 28, 20, 0.85)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(c0.x + 2, c0.y + 1.5);
    ctx.lineTo(c0.x + 2, hem - 2);
    ctx.moveTo(c1.x - 2, c1.y + 1.5);
    ctx.lineTo(c1.x - 2, hem - 2);
    ctx.moveTo(c0.x + 2, hem - 3);
    ctx.lineTo(c1.x - 2, hem - 3);
    ctx.stroke();
    const st = P(u, w - 26.5, 22);
    ctx.beginPath();
    ctx.moveTo(st.x, st.y - 6);
    ctx.lineTo(st.x + 5, st.y + 3);
    ctx.lineTo(st.x - 5, st.y + 3);
    ctx.closePath();
    ctx.moveTo(st.x, st.y - 8);
    ctx.lineTo(st.x, st.y + 6);
    ctx.stroke();
    inkPoly(ctx, rand, top, 0.8, 0.7);

    // Blood pooled on the slab and running down the front
    floorBlob(ctx, rand, u + 22, w - 8, 15, 12, "rgba(70, 4, 3, 0.95)", H + 0.6);
    floorBlob(ctx, rand, u + 22, w - 8, 12, 9, "rgba(118, 10, 6, 0.95)", H + 0.7);
    const gl = P(u + 19, w - 5, H + 0.8);
    ctx.fillStyle = "rgba(255, 200, 190, 0.22)";
    ctx.beginPath();
    ctx.ellipse(gl.x, gl.y, 7, 1.6, -0.1, 0, Math.PI * 2);
    ctx.fill();
    const edge = P(u + 24, w - 26, H);
    drips(ctx, rand, edge.x - 8, edge.x + 10, edge.y - 1, 5, 24, "rgba(110, 8, 6, 0.95)");

    // Brass bowl brimming with blood
    const bw = P(u - 30, w + 8, H);
    ctx.fillStyle = "#4b3517";
    ctx.beginPath();
    ctx.ellipse(bw.x, bw.y - 2, 9, 3.6, 0, 0, Math.PI);
    ctx.lineTo(bw.x - 9, bw.y - 2);
    ctx.fill();
    ctx.fillStyle = BRASS;
    ctx.beginPath();
    ctx.moveTo(bw.x - 9, bw.y - 3);
    ctx.quadraticCurveTo(bw.x, bw.y + 6, bw.x + 9, bw.y - 3);
    ctx.lineTo(bw.x + 9, bw.y - 4);
    ctx.lineTo(bw.x - 9, bw.y - 4);
    ctx.fill();
    ctx.fillStyle = "#5e0806";
    ctx.beginPath();
    ctx.ellipse(bw.x, bw.y - 4, 8, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d8b060";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(bw.x, bw.y - 4, 8.6, 2.9, 0, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();

    // Grimoire open at the back, pages stained
    for (const sd of [-1, 1]) {
        const pg = [P(u + 4 + sd * 1, w + 18, H + 2), P(u + 4 + sd * 17, w + 17, H + 1.2), P(u + 4 + sd * 17, w + 5, H + 1.2), P(u + 4 + sd * 1, w + 4, H + 2)];
        pathPoly(ctx, pg);
        ctx.fillStyle = sd < 0 ? "#cfc2a0" : "#ddd1b0";
        ctx.fill();
        ctx.strokeStyle = "rgba(40, 24, 12, 0.5)";
        ctx.lineWidth = 0.5;
        for (let k = 6; k < 17; k += 2.4) {
            const a = P(u + 4 + sd * 4, w + k, H + 1.6), b = P(u + 4 + sd * 14, w + k, H + 1.4);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        inkPoly(ctx, rand, pg, 0.8);
    }
    const stain = P(u + 12, w + 9, H + 1.6);
    ctx.fillStyle = "rgba(110, 10, 6, 0.6)";
    ctx.beginPath();
    ctx.ellipse(stain.x, stain.y, 3.5, 1.4, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Ritual dagger across the front of the slab
    const d0 = P(u - 22, w - 18, H + 1.4), d1 = P(u - 2, w - 20, H + 1.4), d2 = P(u + 4, w - 21, H + 1.4);
    ctx.strokeStyle = "#cfd2d6";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120, 10, 6, 0.9)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(d0.x + (d1.x - d0.x) * 0.15, d0.y + 0.4);
    ctx.lineTo(d0.x + (d1.x - d0.x) * 0.55, d0.y + (d1.y - d0.y) * 0.55 + 0.4);
    ctx.stroke();
    ctx.strokeStyle = "#2a1c12";
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.stroke();
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(d1.x, d1.y - 3);
    ctx.lineTo(d1.x, d1.y + 3);
    ctx.stroke();

    // Skull crowned with a candle at the right corner
    const sk = P(u + 32, w + 6, H);
    drawSkull(ctx, sk.x, sk.y - 7 * sk.s, 7.5 * sk.s, rand);
    out.flames.push(candle(ctx, rand, u + 32, w + 6, H + 12, 7, 2.4));
    // A thicket of candles at the back and sides, dripping over the edge
    for (const [cu, cw, ch, r] of [[-38, 18, 26, 3], [-30, 21, 17, 2.8], [-41, 10, 11, 2.6], [24, 20, 30, 3], [34, 18, 19, 2.8], [40, 12, 9, 2.4]]) {
        out.flames.push(candle(ctx, rand, u + cu, w + cw, H, ch, r));
    }
    const wl = P(u - 46, w - 2, H), wr = P(u + 46, w + 2, H);
    drips(ctx, rand, wl.x - 1, wl.x + 2, wl.y - 1, 2, 10, "rgba(214, 200, 168, 0.95)");
    drips(ctx, rand, wr.x - 2, wr.x + 1, wr.y - 1, 2, 12, "rgba(214, 200, 168, 0.95)");
    out.glowAt = P(u + 20, w - 6, H + 2);
}

// ─── Static signal pylon ─────────────────────────────────────────────────
// A wireless apparatus: a wooden receiver cabinet on an iron tripod, a mast
// with porcelain insulators and a copper coil, a brass horn, guy wires and a
// crown of spikes that crackles with static.

function paintPylon(ctx, rand, u, w, out) {
    floorShadow(out.floor, u - 30, u + 30, w - 24, w + 26, 0.7);
    // Ticker tape spilling from the cabinet across the floor
    const tape = out.floor;
    let tu = u + 6, tw = w - 14;
    const tpts = [P(tu, tw, 0.4)];
    for (let i = 0; i < 9; i++) {
        tu += 5 + rand() * 4;
        tw -= 2 + rand() * 4;
        tu += Math.sin(i * 1.3) * 4;
        tpts.push(P(tu, tw, 0.4));
    }
    tape.strokeStyle = "#d8cba6";
    tape.lineWidth = 3;
    tape.lineJoin = "round";
    tape.beginPath();
    tape.moveTo(tpts[0].x, tpts[0].y);
    for (const p of tpts.slice(1)) tape.lineTo(p.x, p.y);
    tape.stroke();
    tape.fillStyle = "rgba(30, 20, 14, 0.7)";
    for (const p of tpts.slice(1)) tape.fillRect(p.x - 0.5, p.y - 0.5, 1, 1);
    // Guy-wire anchors
    const anchors = [P(u - 44, w + 12, 0), P(u + 42, w - 8, 0)];
    for (const a of anchors) {
        out.floor.fillStyle = "#1a1715";
        out.floor.fillRect(a.x - 1.5, a.y - 4, 3, 4);
    }

    // Tripod
    const foot = [P(u - 24, w - 18, 0), P(u + 24, w - 16, 0), P(u + 2, w + 22, 0)];
    const hub = P(u, w, 12);
    for (const f of [foot[2], foot[0], foot[1]]) {
        ctx.strokeStyle = "#1c1917";
        ctx.lineWidth = 2.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.quadraticCurveTo((hub.x + f.x) / 2, (hub.y + f.y) / 2 - 4, f.x, f.y);
        ctx.stroke();
        ctx.fillStyle = "#2a2624";
        ctx.beginPath();
        ctx.ellipse(f.x, f.y, 3.2, 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.lineCap = "butt";

    // Receiver cabinet
    box(ctx, rand, u - 17, u + 17, w - 12, w + 12, 10, 38, DARKWOOD, { hatchFront: 0.15 });
    box(ctx, rand, u - 18, u + 18, w - 13, w + 13, 38, 41, WOOD, { hatchFront: 0 });
    // Speaker grille: woven cloth behind a carved sunburst
    const gr = P(u - 7, w - 12, 25);
    ctx.save();
    ctx.beginPath();
    ctx.arc(gr.x, gr.y, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = "#3a2c1c";
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = "rgba(10, 6, 3, 0.5)";
    ctx.lineWidth = 0.5;
    for (let k = -8; k <= 8; k += 1.4) {
        ctx.beginPath();
        ctx.moveTo(gr.x + k, gr.y - 8);
        ctx.lineTo(gr.x + k, gr.y + 8);
        ctx.moveTo(gr.x - 8, gr.y + k);
        ctx.lineTo(gr.x + 8, gr.y + k);
        ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = "#1e130b";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        ctx.beginPath();
        ctx.moveTo(gr.x, gr.y);
        ctx.lineTo(gr.x + Math.cos(a) * 7.5, gr.y + Math.sin(a) * 7.5);
        ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(gr.x, gr.y, 7.5, 0, Math.PI * 2);
    ctx.stroke();
    // Tuning dial (lit live) and two bakelite knobs
    const dl = P(u + 8, w - 12, 28);
    ctx.fillStyle = "#1a120a";
    ctx.beginPath();
    ctx.arc(dl.x, dl.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(220, 200, 150, 0.6)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.1 + i * 0.1);
        ctx.beginPath();
        ctx.moveTo(dl.x + Math.cos(a) * 4.8, dl.y + Math.sin(a) * 4.8);
        ctx.lineTo(dl.x + Math.cos(a) * 3.6, dl.y + Math.sin(a) * 3.6);
        ctx.stroke();
    }
    out.dial = { x: dl.x, y: dl.y, r: 4.2 };
    for (const ku of [4, 12]) {
        const kp = P(u + ku, w - 12, 17);
        ctx.fillStyle = "#0e0b09";
        ctx.beginPath();
        ctx.arc(kp.x, kp.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(220, 200, 170, 0.35)";
        ctx.fillRect(kp.x - 0.5, kp.y - 2, 1, 1.4);
    }
    // Brass maker's plate
    const mp = P(u, w - 12, 13.5);
    ctx.fillStyle = "#6d5426";
    ctx.fillRect(mp.x - 6, mp.y - 1.6, 12, 3.2);

    // Mast
    box(ctx, rand, u - 2.4, u + 2.4, w - 2.4, w + 2.4, 41, 168, IRON, { hatchFront: 0, ink: 0.9 });
    // Porcelain insulator stack
    for (let h = 44; h < 60; h += 3.2) {
        const p = P(u, w, h);
        ctx.fillStyle = "#6d6352";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 1, 6.4, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#d9cfb8";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 6.4, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(6,4,4,0.6)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
    }
    // Copper coil: a dark former with the windings over it
    const k0 = P(u, w, 66), k1 = P(u, w, 104);
    ctx.fillStyle = "#24170e";
    ctx.fillRect(k0.x - 6, k1.y, 12, k0.y - k1.y);
    ctx.strokeStyle = "rgba(6,4,4,0.85)";
    ctx.lineWidth = 1;
    ctx.strokeRect(k0.x - 6, k1.y, 12, k0.y - k1.y);
    for (let y = k1.y + 1.5; y < k0.y - 1; y += 2.1) {
        ctx.strokeStyle = "#b0683a";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(k0.x - 6.4, y + 0.8);
        ctx.lineTo(k0.x + 6.4, y - 0.4);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 200, 150, 0.35)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(k0.x - 4, y + 0.1);
        ctx.lineTo(k0.x - 1, y);
        ctx.stroke();
    }
    out.coil = { x: k0.x, y0: k1.y, y1: k0.y };
    out.lightAt = P(u, w, 70);

    // Brass horn on a bracket, its bell turned toward the room
    const hr0 = P(u - 2, w, 116), bell = P(u - 30, w - 8, 124);
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(hr0.x, hr0.y);
    ctx.lineTo(hr0.x - 6, hr0.y + 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hr0.x - 4, hr0.y - 1.6);
    ctx.quadraticCurveTo(bell.x + 14, hr0.y - 2, bell.x + 2, bell.y - 12);
    ctx.lineTo(bell.x + 2, bell.y + 12);
    ctx.quadraticCurveTo(bell.x + 14, hr0.y + 4, hr0.x - 4, hr0.y + 1.6);
    ctx.closePath();
    const hg = ctx.createLinearGradient(0, bell.y - 12, 0, bell.y + 12);
    hg.addColorStop(0, "#c8a050");
    hg.addColorStop(0.5, "#8a6a2a");
    hg.addColorStop(1, "#4a3614");
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = "rgba(6,4,4,0.9)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#1a1208";
    ctx.beginPath();
    ctx.ellipse(bell.x, bell.y, 5.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#d8b060";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.strokeStyle = "rgba(6,4,4,0.8)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(bell.x, bell.y, 6.2, 12.8, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Crossbar with insulators, guy wires drooping to the floor anchors
    const bl = P(u - 24, w, 146), br = P(u + 24, w, 146);
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(bl.x, bl.y);
    ctx.lineTo(br.x, br.y);
    ctx.stroke();
    for (const [e, a] of [[bl, anchors[0]], [br, anchors[1]]]) {
        ctx.fillStyle = "#d9cfb8";
        ctx.fillRect(e.x - 2, e.y - 1, 4, 6);
        ctx.strokeStyle = "rgba(6,4,4,0.6)";
        ctx.lineWidth = 0.6;
        ctx.strokeRect(e.x - 2, e.y - 1, 4, 6);
        ctx.strokeStyle = "rgba(30, 26, 22, 0.85)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + 5);
        ctx.quadraticCurveTo((e.x + a.x) / 2, (e.y + a.y) / 2 + 14, a.x, a.y - 3);
        ctx.stroke();
    }
    // A wire from the coil down into the cabinet
    ctx.strokeStyle = "#8a4a26";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(k0.x + 6, k0.y - 3);
    ctx.quadraticCurveTo(k0.x + 18, (k0.y + P(u, w, 41).y) / 2, P(u + 12, w - 6, 41).x, P(u + 12, w - 6, 41).y);
    ctx.stroke();

    // Crown of spikes around a brass ball
    const cr = P(u, w, 168);
    out.spikes = [];
    for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.42;
        const tip = { x: cr.x + Math.cos(a) * 15, y: cr.y + Math.sin(a) * 17 };
        ctx.strokeStyle = "#1c1917";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cr.x, cr.y);
        ctx.lineTo(tip.x, tip.y);
        ctx.stroke();
        out.spikes.push(tip);
    }
    const ball = ctx.createRadialGradient(cr.x - 1.5, cr.y - 3.5, 0.5, cr.x, cr.y - 2, 4.5);
    ball.addColorStop(0, "#f0d590");
    ball.addColorStop(1, "#6a4e1c");
    ctx.fillStyle = ball;
    ctx.beginPath();
    ctx.arc(cr.x, cr.y - 2, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(6,4,4,0.85)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    out.crown = { x: cr.x, y: cr.y - 2 };
}

// ─── Corpse lantern shrine ───────────────────────────────────────────────
// A gabled reliquary cabinet on a stone footing, doors thrown open on a
// niche of skulls and tied case files, a lantern hanging inside, paper tags
// strung from the eaves.

function paintShrine(ctx, rand, u, w, out) {
    floorShadow(out.floor, u - 36, u + 30, w - 26, w + 20, 0.7);
    for (let i = 0; i < 5; i++) flatPaper(out.floor, rand, u - 30 + rand() * 50, w - 24 - rand() * 12, 0.3, 4, 3);

    box(ctx, rand, u - 25, u + 25, w - 17, w + 17, 0, 12, STONE, { hatchFront: 0.3 });
    box(ctx, rand, u - 20, u + 20, w - 13, w + 13, 12, 76, DARKWOOD, { hatchFront: 0.1 });
    // Niche: a pointed recess warmed from inside by the lantern
    const n0 = P(u - 15, w - 13, 18), n1 = P(u + 15, w - 13, 18), nTop = P(u, w - 13, 74), nSpring = P(u, w - 13, 62);
    const niche = () => {
        ctx.beginPath();
        ctx.moveTo(n0.x, n0.y);
        ctx.lineTo(n0.x, nSpring.y);
        ctx.quadraticCurveTo(n0.x, nTop.y + 2, nTop.x, nTop.y);
        ctx.quadraticCurveTo(n1.x, nTop.y + 2, n1.x, nSpring.y);
        ctx.lineTo(n1.x, n1.y);
        ctx.closePath();
    };
    niche();
    const ng = ctx.createLinearGradient(0, nTop.y, 0, n0.y);
    ng.addColorStop(0, "#0b0605");
    ng.addColorStop(0.55, "#2a160b");
    ng.addColorStop(1, "#140a06");
    ctx.fillStyle = ng;
    ctx.fill();
    ctx.save();
    niche();
    ctx.clip();
    // Back boards and a shelf
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 0.7;
    for (let x = n0.x + 5; x < n1.x; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x, nTop.y);
        ctx.lineTo(x, n0.y);
        ctx.stroke();
    }
    const sh = P(u, w - 13, 38);
    ctx.fillStyle = "#3a2414";
    ctx.fillRect(n0.x, sh.y - 1.5, n1.x - n0.x, 3);
    ctx.fillStyle = "rgba(255, 190, 110, 0.25)";
    ctx.fillRect(n0.x, sh.y - 1.5, n1.x - n0.x, 0.8);
    // Skulls on the shelf, case files tied with red string below
    drawSkull(ctx, sh.x - 8, sh.y - 6, 5, rand);
    drawSkull(ctx, sh.x + 9, sh.y - 5.5, 4.4, rand);
    let fy = n0.y - 1;
    for (let i = 0; i < 4; i++) {
        const fw = 18 + rand() * 6, fh = 2.6 + rand() * 1.2, fx = sh.x - fw / 2 + (rand() - 0.5) * 4;
        ctx.fillStyle = `rgb(${170 + rand() * 30}, ${150 + rand() * 25}, ${110 + rand() * 20})`;
        ctx.fillRect(fx, fy - fh, fw, fh);
        ctx.strokeStyle = "rgba(6,4,4,0.6)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(fx, fy - fh, fw, fh);
        ctx.fillStyle = "#9c1c14";
        ctx.fillRect(fx + fw * 0.5, fy - fh, 0.9, fh);
        fy -= fh;
    }
    ctx.restore();
    niche();
    ctx.strokeStyle = "rgba(6,4,4,0.95)";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // The hanging lantern
    const hook = P(u, w - 10, 72), lt = P(u, w - 10, 58), lb = P(u, w - 10, 46);
    ctx.strokeStyle = "#141110";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hook.x, hook.y);
    ctx.lineTo(lt.x, lt.y - 3);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 190, 110, 0.35)";
    ctx.fillRect(lb.x - 4, lt.y, 8, lb.y - lt.y);
    ctx.strokeStyle = "#141110";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(lb.x - 4, lt.y, 8, lb.y - lt.y);
    ctx.beginPath();
    ctx.moveTo(lb.x, lt.y);
    ctx.lineTo(lb.x, lb.y);
    ctx.stroke();
    ctx.fillStyle = "#141110";
    ctx.beginPath();
    ctx.moveTo(lt.x - 5, lt.y);
    ctx.lineTo(lt.x, lt.y - 4);
    ctx.lineTo(lt.x + 5, lt.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(lb.x - 5, lb.y, 10, 1.8);
    out.lantern = { x: lb.x, y: (lt.y + lb.y) / 2 };

    // Doors thrown open, a faded painted saint inside each
    for (const sd of [-1, 1]) {
        const hu = u + sd * 20, ou = u + sd * 33, ow = w - 25;
        const q = [P(hu, w - 13, 14), P(ou, ow, 14), P(ou, ow, 74), P(hu, w - 13, 74)];
        fillFace(ctx, q, sd < 0 ? [70, 48, 30] : [44, 30, 19]);
        ctx.save();
        pathPoly(ctx, q);
        ctx.clip();
        const mid = { x: (q[0].x + q[1].x) / 2, y: (q[0].y + q[2].y) / 2 };
        ctx.fillStyle = "rgba(170, 140, 90, 0.22)";
        ctx.beginPath();
        ctx.ellipse(mid.x, mid.y - 8, 3, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(mid.x - 3.5, mid.y - 4, 7, 16);
        ctx.strokeStyle = "rgba(200, 160, 60, 0.3)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(mid.x, mid.y - 8, 5, 0, Math.PI * 2);
        ctx.stroke();
        if (sd > 0) hatch(ctx, rand, Math.min(q[0].x, q[1].x) - 2, q[2].y - 4, 20, 80, { angle: 1.1, gap: 2.6, alpha: 0.3 });
        ctx.restore();
        inkPoly(ctx, rand, q, 1);
    }

    // Gabled roof: ridge running front to back, shingled planes, a front gable
    const ridgeF = P(u, w - 18, 98), ridgeB = P(u, w + 18, 98);
    for (const sd of [-1, 1]) {
        const eF = P(u + sd * 28, w - 18, 74), eB = P(u + sd * 28, w + 18, 74);
        const plane = [ridgeB, ridgeF, eF, eB];
        fillFace(ctx, plane, sd < 0 ? [74, 64, 60] : [44, 38, 36], 8, -10);
        ctx.save();
        pathPoly(ctx, plane);
        ctx.clip();
        ctx.strokeStyle = "rgba(10, 8, 8, 0.55)";
        ctx.lineWidth = 0.7;
        for (let t = 0.15; t < 1; t += 0.17) {
            const a = { x: ridgeF.x + (eF.x - ridgeF.x) * t, y: ridgeF.y + (eF.y - ridgeF.y) * t };
            const b = { x: ridgeB.x + (eB.x - ridgeB.x) * t, y: ridgeB.y + (eB.y - ridgeB.y) * t };
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            for (let k = 0.1; k < 1; k += 0.2) {
                const m = { x: a.x + (b.x - a.x) * (k + t * 0.1), y: a.y + (b.y - a.y) * (k + t * 0.1) };
                ctx.beginPath();
                ctx.moveTo(m.x, m.y);
                ctx.lineTo(m.x + (eF.x - ridgeF.x) * 0.15, m.y + (eF.y - ridgeF.y) * 0.15);
                ctx.stroke();
            }
        }
        ctx.restore();
        inkPoly(ctx, rand, plane, 1.1);
    }
    const gable = [P(u - 28, w - 18, 74), P(u + 28, w - 18, 74), ridgeF];
    fillFace(ctx, gable, [58, 38, 24]);
    inkPoly(ctx, rand, gable, 1.3);
    const oc = P(u, w - 18, 84);
    ctx.strokeStyle = "#160e09";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(oc.x - 6, oc.y);
    ctx.quadraticCurveTo(oc.x, oc.y - 4, oc.x + 6, oc.y);
    ctx.quadraticCurveTo(oc.x, oc.y + 4, oc.x - 6, oc.y);
    ctx.stroke();
    ctx.fillStyle = "#7a1810";
    ctx.beginPath();
    ctx.arc(oc.x, oc.y, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // Iron finial
    ctx.strokeStyle = "#141110";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ridgeF.x, ridgeF.y);
    ctx.lineTo(ridgeF.x, ridgeF.y - 10);
    ctx.moveTo(ridgeF.x - 3.5, ridgeF.y - 6);
    ctx.lineTo(ridgeF.x + 3.5, ridgeF.y - 6);
    ctx.stroke();
    // Paper tags strung from the eaves
    for (const sd of [-1, 1]) {
        const e = P(u + sd * 28, w - 18, 74);
        for (let i = 0; i < 3; i++) {
            const tx = e.x - sd * (2 + i * 6), ty = e.y + 2 + (sd < 0 ? i * 0.5 : -i * 0.5), len = 6 + rand() * 7;
            ctx.strokeStyle = "rgba(40, 30, 24, 0.8)";
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx, ty + len);
            ctx.stroke();
            note(ctx, rand, tx, ty + len + 3, 4, 6, (rand() - 0.5) * 0.4);
        }
    }
    // Candle stubs on the footing
    out.flames.push(candle(ctx, rand, u - 20, w - 16, 12, 6, 2.2));
    out.flames.push(candle(ctx, rand, u + 18, w - 15, 12, 9, 2.4));
}

// ─── Wax record chest ────────────────────────────────────────────────────
// Iron-bound oak, its lid sealed shut with wax and ribbon. Painted at several
// lid angles; the renderer steps through them while it opens.

function paintChest(lidAngle) {
    return (ctx, rand, u, w, out) => {
        const L = 30, D = 17, BH = 24, LH = 9;
        floorShadow(out.floor, u - L, u + L, w - D, w + D, 0.7);
        const open = lidAngle > 0.01;

        const lidFaces = () => {
            const A = lidAngle, w0 = w + D, h0 = BH;
            const pt = (uu, dw, dh) => hinge(uu, dw, dh, A, w0, h0);
            const uL = u - L - 1, uR = u + L + 1, dF = -2 * D - 1;
            return {
                outer: [pt(uL, 0, LH), pt(uR, 0, LH), pt(uR, dF, LH), pt(uL, dF, LH)],
                inner: [pt(uL, dF, 0), pt(uR, dF, 0), pt(uR, 0, 0), pt(uL, 0, 0)],
                lip: [pt(uL, dF, LH), pt(uR, dF, LH), pt(uR, dF, 0), pt(uL, dF, 0)]
            };
        };
        const drawLid = () => {
            const f = lidFaces();
            // Inner face (seen once the lid lifts), then the outer top, then the front lip
            if (open && facing(f.inner) > 0) {
                fillFace(ctx, f.inner, [46, 30, 18], 6, -10);
                inkPoly(ctx, rand, f.inner, 1);
            }
            if (facing(f.outer) > 0) {
                fillFace(ctx, f.outer, DARKWOOD.top, 14, -4);
                ctx.save();
                pathPoly(ctx, f.outer);
                ctx.clip();
                for (const k of [-20, 20]) {
                    const A = lidAngle, pt = (uu, dw) => hinge(uu, dw, LH + 0.2, A, w + D, BH);
                    const a0 = pt(u + k - 3, 0), a1 = pt(u + k + 3, 0), b1 = pt(u + k + 3, -2 * D - 1), b0 = pt(u + k - 3, -2 * D - 1);
                    pathPoly(ctx, [a0, a1, b1, b0]);
                    ctx.fillStyle = "#1e1b19";
                    ctx.fill();
                }
                ctx.restore();
                inkPoly(ctx, rand, f.outer, 1.1);
            }
            if (facing(f.lip) > 0) {
                fillFace(ctx, f.lip, DARKWOOD.front);
                inkPoly(ctx, rand, f.lip, 1.1);
                if (!open) {
                    for (const k of [-20, 20]) {
                        const a = P(u + k - 3, w - D - 1, BH), b = P(u + k + 3, w - D - 1, BH + LH);
                        ctx.fillStyle = "#1e1b19";
                        ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
                    }
                }
            }
        };

        if (open && lidAngle > 1.3) drawLid();
        // Body
        box(ctx, rand, u - L, u + L, w - D, w + D, 0, BH, DARKWOOD, { hatchFront: 0.2, top: !open });
        // Plank seams and iron furniture
        for (const h of [8, 16]) {
            const a = P(u - L + 1, w - D, h), b = P(u + L - 1, w - D, h);
            inkLine(ctx, rand, a.x, a.y, b.x, b.y, 0.7, 0.55);
        }
        for (const k of [-20, 20]) {
            const a = P(u + k - 3, w - D, 0), b = P(u + k + 3, w - D, BH);
            ctx.fillStyle = "#1e1b19";
            ctx.fillRect(a.x, b.y, b.x - a.x, a.y - b.y);
            ctx.fillStyle = "rgba(200, 180, 150, 0.35)";
            for (let h = 3; h < BH; h += 5) {
                const r = P(u + k, w - D, h);
                ctx.fillRect(r.x - 0.6, r.y - 0.6, 1.2, 1.2);
            }
        }
        for (const sd of [-1, 1]) {
            const c = P(u + sd * L, w - D, 0), c2 = P(u + sd * (L - 6), w - D, 6);
            ctx.fillStyle = "#1e1b19";
            ctx.fillRect(Math.min(c.x, c2.x), c2.y, Math.abs(c2.x - c.x), c.y - c2.y);
        }
        // Lock plate
        const lp = P(u, w - D, BH - 2);
        ctx.fillStyle = "#2a2522";
        ctx.beginPath();
        ctx.moveTo(lp.x - 5, lp.y - 4);
        ctx.lineTo(lp.x + 5, lp.y - 4);
        ctx.lineTo(lp.x + 5, lp.y + 5);
        ctx.lineTo(lp.x, lp.y + 8);
        ctx.lineTo(lp.x - 5, lp.y + 5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(200, 170, 120, 0.3)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.fillStyle = "#050404";
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(lp.x - 0.5, lp.y, 1, 3);

        if (open) {
            // The cavity, the record rolls inside, and the broken seals' halves
            const cav = [P(u - L + 2, w + D - 2, BH), P(u + L - 2, w + D - 2, BH), P(u + L - 2, w - D + 2, BH), P(u - L + 2, w - D + 2, BH)];
            pathPoly(ctx, cav);
            const cg = ctx.createLinearGradient(0, cav[0].y, 0, cav[2].y);
            cg.addColorStop(0, "#050302");
            cg.addColorStop(1, "#1a0f08");
            ctx.fillStyle = cg;
            ctx.fill();
            const rim = [P(u - L, w + D, BH), P(u + L, w + D, BH), P(u + L, w - D, BH), P(u - L, w - D, BH)];
            ctx.strokeStyle = "#5a3d24";
            ctx.lineWidth = 2;
            pathPoly(ctx, rim);
            ctx.stroke();
            inkPoly(ctx, rand, rim, 0.9);
            for (let i = 0; i < 7; i++) {
                const ru = u - 22 + i * 7.2 + (rand() - 0.5) * 2, rw = w + (rand() - 0.5) * 8, tilt = (rand() - 0.5) * 6;
                const a = P(ru + tilt, rw + 10, BH + 1.5), b = P(ru - tilt, rw - 10, BH + 1.5);
                ctx.strokeStyle = "#cdbf98";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.strokeStyle = "rgba(90, 70, 40, 0.55)";
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                ctx.moveTo(a.x + 1.2, a.y);
                ctx.lineTo(b.x + 1.2, b.y);
                ctx.stroke();
                ctx.fillStyle = "#e4d8b8";
                ctx.beginPath();
                ctx.ellipse(b.x, b.y, 1.7, 1, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "rgba(90, 70, 40, 0.7)";
                ctx.lineWidth = 0.4;
                ctx.beginPath();
                ctx.arc(b.x, b.y, 0.8, 0, Math.PI * 1.6);
                ctx.stroke();
                const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                ctx.fillStyle = "#8a1a12";
                ctx.fillRect(m.x - 1.8, m.y - 0.5, 3.6, 1);
            }
            box(ctx, rand, u + 10, u + 24, w - 6, w + 8, BH - 2, BH + 3, { top: [70, 26, 20], front: [214, 202, 172], side: [50, 18, 14] }, { ink: 0.7, hatchFront: 0 });
            for (let i = 0; i < 5; i++) {
                const c = P(u - 18 + rand() * 30, w - 12 + rand() * 4, BH + 0.5);
                ctx.fillStyle = "#c9a040";
                ctx.beginPath();
                ctx.ellipse(c.x, c.y, 1.8, 0.8, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            out.glowAt = P(u, w, BH + 4);
            for (const k of [-12, 0, 12]) {
                const s = P(u + k, w - D, BH - 1);
                ctx.save();
                ctx.beginPath();
                ctx.rect(s.x - 8, s.y - 1, 16, 10);
                ctx.clip();
                waxSeal(ctx, rand, s.x, s.y, 4.4, "eye");
                ctx.restore();
            }
        }
        if (!open || lidAngle <= 1.3) drawLid();
        if (!open) {
            // Seals across the seam with ribbons hanging below
            for (const k of [-12, 0, 12]) {
                const s = P(u + k, w - D - 1.5, BH);
                ctx.strokeStyle = "#7a1410";
                ctx.lineWidth = 1.6;
                ctx.beginPath();
                ctx.moveTo(s.x - 1.5, s.y);
                ctx.lineTo(s.x - 3, s.y + 12 + rand() * 4);
                ctx.moveTo(s.x + 1.5, s.y);
                ctx.lineTo(s.x + 3.5, s.y + 10 + rand() * 4);
                ctx.stroke();
                waxSeal(ctx, rand, s.x, s.y, 4.6, "eye");
            }
        }
    };
}

// ─── Corpses of previous Marked ──────────────────────────────────────────
// Painted lying in the floor plane at a reference depth; the renderer moves
// and scales them to wherever the body fell. The body lies along u, head
// toward -u.

function paintCorpse(kind) {
    return (ctx, rand, u, w, out) => {
        const flo = out.floor;
        const at = (du, dw, h = 0) => P(u + du, w + dw, h);
        const shape = (pts, fill, ink = 1.2) => {
            ctx.beginPath();
            ctx.moveTo((pts[0].x + pts[pts.length - 1].x) / 2, (pts[0].y + pts[pts.length - 1].y) / 2);
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length];
                ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
            }
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
            if (ink) {
                ctx.strokeStyle = "rgba(4,3,3,0.9)";
                ctx.lineWidth = ink;
                ctx.stroke();
            }
        };
        const line = (a, b, wd, col, cap = "round") => {
            ctx.strokeStyle = col;
            ctx.lineWidth = wd;
            ctx.lineCap = cap;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            ctx.lineCap = "butt";
        };

        if (kind === "burned") {
            // Scorch, ash and a charred skeleton lying on its back
            floorBlob(flo, rand, u + 4, w, 44, 24, "rgba(6, 4, 3, 0.8)");
            floorBlob(flo, rand, u, w, 34, 16, "rgba(46, 40, 36, 0.55)");
            for (let i = 0; i < 90; i++) {
                const p = at((rand() - 0.5) * 76, (rand() - 0.5) * 38, 0.3);
                flo.fillStyle = rand() < 0.55 ? "rgba(160, 150, 140, 0.35)" : "rgba(0, 0, 0, 0.45)";
                flo.fillRect(p.x, p.y, 1.3 + rand(), 1);
            }
            const ch = "#6a6158", hi = "rgba(225, 216, 200, 0.55)";
            const bone = (a, b, wd = 2.2) => {
                line(a, b, wd, ch);
                line({ x: a.x, y: a.y - wd * 0.3 }, { x: b.x, y: b.y - wd * 0.3 }, wd * 0.35, hi);
                for (const e of [a, b]) {
                    ctx.fillStyle = ch;
                    ctx.beginPath();
                    ctx.arc(e.x, e.y, wd * 0.75, 0, Math.PI * 2);
                    ctx.fill();
                }
            };
            // Spine with vertebrae
            const s0 = at(-17, 0, 3), s1 = at(13, 0, 2.5);
            line(s0, s1, 2.4, ch);
            for (let i = 0; i < 9; i++) {
                const v = at(-16 + i * 3.4, 0, 3);
                ctx.fillStyle = i % 2 ? ch : "#3a322c";
                ctx.fillRect(v.x - 1, v.y - 1.6, 2, 3.2);
            }
            // Ribs curving up from the spine on both sides, the far ones broken
            for (let i = 0; i < 6; i++) {
                const ru = -14 + i * 3.3;
                for (const sd of [-1, 1]) {
                    if (sd < 0 && i === 4) continue;
                    const a = at(ru, 0, 3.5), c = at(ru - 2, sd * 7, 7 - i * 0.3), b = at(ru + 2.5, sd * (10 - i * 0.6), 1);
                    ctx.strokeStyle = ch;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.quadraticCurveTo(c.x, c.y, b.x, b.y);
                    ctx.stroke();
                    ctx.strokeStyle = hi;
                    ctx.lineWidth = 0.5;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y - 0.6);
                    ctx.quadraticCurveTo(c.x, c.y - 0.6, b.x, b.y - 0.6);
                    ctx.stroke();
                }
            }
            // Pelvis
            const pv = at(16, 0, 3);
            ctx.fillStyle = ch;
            for (const sd of [-1, 1]) {
                ctx.beginPath();
                ctx.ellipse(pv.x, pv.y + sd * 2.2, 4.4, 2.6, sd * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = "#0a0706";
            ctx.beginPath();
            ctx.ellipse(pv.x + 1, pv.y, 1.6, 1.2, 0, 0, Math.PI * 2);
            ctx.fill();
            // Limbs flung out, one arm raised as if shielding the face
            bone(at(-13, -6, 3), at(-22, -15, 2), 2);
            bone(at(-22, -15, 2), at(-30, -10, 3), 1.7);
            bone(at(-13, 6, 3), at(-6, 15, 1), 2);
            bone(at(-6, 15, 1), at(3, 17, 0.5), 1.7);
            bone(at(18, -3, 2), at(32, -8, 1), 2.4);
            bone(at(32, -8, 1), at(45, -6, 0.5), 2);
            bone(at(18, 3, 2), at(31, 9, 1), 2.4);
            bone(at(31, 9, 1), at(40, 17, 0.5), 2);
            // Charred skull with a slack jaw
            const sk = at(-25, 0, 5);
            ctx.fillStyle = "#3b332d";
            ctx.beginPath();
            ctx.ellipse(sk.x, sk.y, 7, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(4,3,3,0.9)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.fillStyle = "rgba(170, 160, 150, 0.3)";
            ctx.beginPath();
            ctx.ellipse(sk.x - 2, sk.y - 2.4, 3.2, 1.6, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#070505";
            for (const dx of [-2.4, 2.4]) {
                ctx.beginPath();
                ctx.ellipse(sk.x + dx, sk.y - 0.3, 1.7, 2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.beginPath();
            ctx.moveTo(sk.x - 0.8, sk.y + 2);
            ctx.lineTo(sk.x + 0.8, sk.y + 2);
            ctx.lineTo(sk.x, sk.y + 0.8);
            ctx.fill();
            ctx.fillStyle = "#2e2622";
            ctx.fillRect(sk.x - 3.5, sk.y + 5, 7, 2.2);
            out.embers = [];
            for (let i = 0; i < 10; i++) out.embers.push(at(-32 + rand() * 76, (rand() - 0.5) * 22, 1 + rand() * 3));
            out.eyes = [{ x: sk.x - 2.4, y: sk.y - 0.3 }, { x: sk.x + 2.4, y: sk.y - 0.3 }];
            return;
        }

        if (kind === "broadcast") pool(flo, rand, u - 2, w + 2, 32, 13, [8, 8, 12]);
        else pool(flo, rand, u - 22, w + 3, 30, 14, [104, 10, 8]);
        floorShadow(flo, u - 36, u + 40, w - 14, w + 14, 0.5, 6);

        const cloak = kind === "broadcast" ? [40, 36, 40] : [34, 30, 32];
        const rgbS = (c, k = 0) => `rgb(${c[0] + k}, ${c[1] + k}, ${c[2] + k})`;
        // The cloak spread on the floor around the body, its hem ragged
        const spread = [];
        const rim = [[-18, -15], [-4, -18], [12, -17], [28, -14], [40, -10], [44, -2], [42, 8], [30, 14], [14, 17], [-2, 18], [-16, 15], [-20, 2]];
        for (const [du, dw] of rim) spread.push(at(du + (rand() - 0.5) * 3, dw + (rand() - 0.5) * 3, 0.6));
        shape(spread, rgbS(cloak, -18), 1.1);
        // Fold lines radiating out across the spread hem
        ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
        ctx.lineWidth = 0.8;
        for (let i = 0; i < 9; i++) {
            const a = at(-6 + i * 5, (rand() - 0.5) * 6, 5), b = at(-10 + i * 6.5, i % 2 ? -16 : 15, 0.6);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        // Boots poking out at the feet
        for (const dw of [-5, 5]) {
            const a = at(38, dw, 3), b = at(48, dw * 1.5, 2.5);
            line(a, b, 5, "#1b1412");
            line(b, at(49, dw * 1.5, 0.5), 5, "#0e0a09");
            line({ x: a.x, y: a.y - 1.5 }, { x: b.x, y: b.y - 1.5 }, 0.8, "rgba(200, 170, 140, 0.18)");
        }
        // The back and shoulders: a hump under the cloth, lit along its crest
        const back = [at(-16, -10, 8), at(-2, -12, 10), at(16, -11, 9), at(32, -8, 6), at(36, 0, 5), at(32, 8, 5), at(14, 11, 7), at(-2, 12, 8), at(-16, 9, 7)];
        shape(back, rgbS(cloak, 0), 1.3);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(back[0].x, back[0].y);
        for (const p of back.slice(1)) ctx.lineTo(p.x, p.y);
        ctx.closePath();
        ctx.clip();
        const crest = ctx.createLinearGradient(0, at(0, -12, 10).y, 0, at(0, 12, 8).y);
        crest.addColorStop(0, "rgba(190, 180, 175, 0.4)");
        crest.addColorStop(0.45, "rgba(0, 0, 0, 0)");
        crest.addColorStop(1, "rgba(0, 0, 0, 0.45)");
        ctx.fillStyle = crest;
        ctx.fillRect(at(-20, 0).x, at(0, -14, 12).y, 60, 30);
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 0.9;
        for (let i = 0; i < 5; i++) {
            const a = at(-10 + i * 9, -11, 9), b = at(-6 + i * 9, 11, 7);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.quadraticCurveTo((a.x + b.x) / 2 + 3, (a.y + b.y) / 2, b.x, b.y);
            ctx.stroke();
        }
        ctx.restore();
        // Hood, face down
        const hood = [at(-17, -8, 8), at(-24, -10, 9), at(-31, -6, 7), at(-33, 2, 5), at(-28, 8, 5), at(-19, 8, 7)];
        shape(hood, rgbS(cloak, -10), 1.2);
        // Cold rim light along the crest of the hood and back
        ctx.strokeStyle = "rgba(200, 196, 205, 0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(hood[3].x + 1, hood[3].y - 1);
        ctx.quadraticCurveTo(hood[2].x, hood[2].y - 1, hood[1].x, hood[1].y - 0.5);
        ctx.quadraticCurveTo(back[1].x, back[1].y - 1, back[2].x, back[2].y - 0.5);
        ctx.quadraticCurveTo(back[3].x, back[3].y, back[4].x, back[4].y);
        ctx.stroke();
        // An arm reaching out toward the room, the hand open on the stone
        const arm = [at(-12, -9, 7), at(-22, -18, 4), at(-34, -20, 2), at(-35, -15, 2), at(-23, -12, 4), at(-14, -4, 6)];
        shape(arm, rgbS(cloak, -4), 1.1);
        const hn = at(-38, -18, 1);
        ctx.fillStyle = "#b5a993";
        ctx.beginPath();
        ctx.ellipse(hn.x + 1, hn.y, 3, 2.1, 0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(4,3,3,0.7)";
        ctx.lineWidth = 0.6;
        ctx.stroke();
        ctx.strokeStyle = "#b5a993";
        ctx.lineWidth = 0.9;
        ctx.lineCap = "round";
        for (let f = 0; f < 4; f++) {
            ctx.beginPath();
            ctx.moveTo(hn.x - 1.5, hn.y - 1.2 + f * 0.9);
            ctx.lineTo(hn.x - 5.5 - (f === 1 ? 1 : 0), hn.y - 2.4 + f * 1.6);
            ctx.stroke();
        }
        ctx.lineCap = "butt";
        out.mark = at(8, 0, 10);

        if (kind === "broadcast") {
            // Bound in ticker tape and a few loose turns of copper wire
            for (let i = 0; i < 3; i++) {
                const a = at(-8 + i * 13, -12, 9), b = at(-2 + i * 13, 12, 7);
                ctx.strokeStyle = "#d8cba6";
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.quadraticCurveTo((a.x + b.x) / 2 + 3, (a.y + b.y) / 2 - 3, b.x, b.y);
                ctx.stroke();
                ctx.strokeStyle = "rgba(6,4,4,0.5)";
                ctx.lineWidth = 0.5;
                ctx.stroke();
                ctx.fillStyle = "rgba(30, 20, 14, 0.8)";
                for (let k = 0.2; k < 0.9; k += 0.2) ctx.fillRect(a.x + (b.x - a.x) * k + 1, a.y + (b.y - a.y) * k - 1, 0.9, 0.9);
            }
            // A loose coil of copper wire trailing from the aerial to the floor
            const coil = at(-6, 20, 0.5);
            ctx.strokeStyle = "#b0683a";
            ctx.lineWidth = 0.8;
            for (let r = 3; r < 9; r += 2) {
                ctx.beginPath();
                ctx.ellipse(coil.x + r * 0.3, coil.y, r, r * 0.4, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
            const wb = at(10, -2, 10);
            ctx.beginPath();
            ctx.moveTo(wb.x, wb.y);
            ctx.quadraticCurveTo(wb.x - 6, (wb.y + coil.y) / 2 + 6, coil.x + 8, coil.y);
            ctx.stroke();
            // An aerial driven into the back
            const base = at(10, -2, 10), top = { x: base.x + 2, y: base.y - 46 };
            line(base, top, 1.4, "#1c1917");
            for (const [dy, half] of [[6, 9], [14, 7], [22, 5]]) line({ x: top.x - half, y: top.y + dy }, { x: top.x + half, y: top.y + dy - 1 }, 1.1, "#1c1917");
            ctx.fillStyle = "#3a0806";
            ctx.beginPath();
            ctx.arc(top.x, top.y - 1.5, 2.1, 0, Math.PI * 2);
            ctx.fill();
            out.beacon = { x: top.x, y: top.y - 1.5 };
        } else {
            // The blade they died holding
            const a = at(-8, -24, 0.5), b = at(24, -27, 0.5), hilt = at(-14, -23, 0.5);
            line(a, b, 2, "#b8bcc2", "butt");
            line({ x: a.x, y: a.y - 0.7 }, { x: b.x, y: b.y - 0.7 }, 0.5, "rgba(255,255,255,0.5)", "butt");
            line(a, hilt, 2.6, "#2a1c12");
            line({ x: a.x - 1, y: a.y - 4 }, { x: a.x + 1, y: a.y + 4 }, 1.4, "#6a5634");
        }
    };
}

// ─── The sealed door ─────────────────────────────────────────────────────
// Painted flat in the back wall's plane, inside the innermost archivolt of
// the door bay (world.js). Two oak leaves, iron straps and studs; a great
// wax seal across the meeting stiles and chains crossed over both leaves.

const DOOR = { x0: 757, x1: 843, spring: 139.6, apex: 90.4, bottom: 286 };

function doorArch(ctx) {
    const cx = (DOOR.x0 + DOOR.x1) / 2;
    ctx.beginPath();
    ctx.moveTo(DOOR.x0, DOOR.bottom);
    ctx.lineTo(DOOR.x0, DOOR.spring);
    ctx.quadraticCurveTo(DOOR.x0, DOOR.apex + (DOOR.spring - DOOR.apex) * 0.2, cx, DOOR.apex);
    ctx.quadraticCurveTo(DOOR.x1, DOOR.apex + (DOOR.spring - DOOR.apex) * 0.2, DOOR.x1, DOOR.spring);
    ctx.lineTo(DOOR.x1, DOOR.bottom);
    ctx.closePath();
}

function canvasFor(x, y, w, h, scale) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const g = c.getContext("2d");
    g.scale(scale, scale);
    g.translate(-x, -y);
    return [c, g];
}

function paintDoor(scale) {
    const rand = mulberry32(911);
    const { x0, x1, apex, bottom } = DOOR;
    const cx = (x0 + x1) / 2;
    const leaf = side => {
        const lx0 = side < 0 ? x0 : cx, lx1 = side < 0 ? cx : x1;
        const [c, g] = canvasFor(lx0, apex - 2, lx1 - lx0, bottom - apex + 4, scale);
        g.save();
        doorArch(g);
        g.clip();
        g.beginPath();
        g.rect(lx0, apex - 2, lx1 - lx0, bottom - apex + 4);
        g.clip();
        // Vertical oak boards
        for (let x = lx0; x < lx1; x += 7.2) {
            const t = 0.85 + rand() * 0.3;
            g.fillStyle = `rgb(${66 * t}, ${44 * t}, ${28 * t})`;
            g.fillRect(x, apex, 7.2, bottom - apex);
            g.strokeStyle = "rgba(10, 5, 2, 0.3)";
            g.lineWidth = 0.6;
            for (let k = 0; k < 3; k++) {
                const gx = x + 1.5 + rand() * 4;
                g.beginPath();
                g.moveTo(gx, apex);
                g.bezierCurveTo(gx + 1.5, apex + 60, gx - 1.5, bottom - 80, gx + 0.5, bottom);
                g.stroke();
            }
            g.fillStyle = "rgba(0,0,0,0.55)";
            g.fillRect(x, apex, 0.9, bottom - apex);
        }
        // Darkness gathering under the arch and at the hinge side
        const v = g.createLinearGradient(0, apex, 0, bottom);
        v.addColorStop(0, "rgba(0,0,0,0.6)");
        v.addColorStop(0.35, "rgba(0,0,0,0.15)");
        v.addColorStop(1, "rgba(0,0,0,0.35)");
        g.fillStyle = v;
        g.fillRect(lx0, apex, lx1 - lx0, bottom - apex);
        hatch(g, rand, lx0, apex, lx1 - lx0, bottom - apex, { angle: 1.15, gap: 3, alpha: side > 0 ? 0.22 : 0.12 });
        // Strap hinges with split scroll ends, from the hinge side
        for (const y of [128, 196, 262]) {
            const from = side < 0 ? x0 : x1, to = cx - side * 5;
            g.fillStyle = "#171412";
            g.fillRect(Math.min(from, to), y - 2.6, Math.abs(to - from), 5.2);
            g.strokeStyle = "#171412";
            g.lineWidth = 1.6;
            g.beginPath();
            g.moveTo(to, y);
            g.quadraticCurveTo(to + side * 4, y - 6, to + side * 1, y - 8);
            g.moveTo(to, y);
            g.quadraticCurveTo(to + side * 4, y + 6, to + side * 1, y + 8);
            g.stroke();
            g.fillStyle = "rgba(200, 180, 150, 0.4)";
            for (let x = Math.min(from, to) + 3; x < Math.max(from, to); x += 6) g.fillRect(x, y - 0.6, 1.2, 1.2);
            g.strokeStyle = "rgba(200, 180, 150, 0.15)";
            g.lineWidth = 0.6;
            g.beginPath();
            g.moveTo(Math.min(from, to), y - 2.4);
            g.lineTo(Math.max(from, to), y - 2.4);
            g.stroke();
        }
        // Studs
        for (let y = 150; y < bottom - 6; y += 22) {
            for (let x = lx0 + 6; x < lx1 - 3; x += 9) {
                g.fillStyle = "#14110f";
                g.beginPath();
                g.arc(x, y, 1.3, 0, Math.PI * 2);
                g.fill();
                g.fillStyle = "rgba(220, 200, 170, 0.3)";
                g.fillRect(x - 0.6, y - 0.9, 0.8, 0.8);
            }
        }
        // Ring pull near the meeting stile
        const rx = cx - side * 7, ry = 226;
        g.strokeStyle = "#1a1715";
        g.lineWidth = 1.8;
        g.beginPath();
        g.arc(rx, ry + 4, 4, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = "#1a1715";
        g.beginPath();
        g.arc(rx, ry, 2.2, 0, Math.PI * 2);
        g.fill();
        g.restore();
        // Meeting-stile shadow and an inked outline
        g.save();
        doorArch(g);
        g.clip();
        g.fillStyle = "rgba(0,0,0,0.6)";
        g.fillRect(cx - 1, apex, 2, bottom - apex);
        g.restore();
        doorArch(g);
        g.strokeStyle = "rgba(4,3,3,0.95)";
        g.lineWidth = 2;
        g.stroke();
        return { canvas: c, x: lx0, y: apex - 2, w: lx1 - lx0, h: bottom - apex + 4 };
    };
    // Seal and chains, drawn over both leaves while the door is shut
    const [sc, sg] = canvasFor(x0 - 6, apex, x1 - x0 + 12, bottom - apex + 30, scale);
    const sealY = 182;
    chain(sg, { x: x0 + 2, y: 140 }, { x: cx - 4, y: 216 }, { x: x1 - 3, y: 266 }, 3.6, "#1f1c1a");
    chain(sg, { x: x1 - 2, y: 140 }, { x: cx + 4, y: 216 }, { x: x0 + 3, y: 266 }, 3.6, "#1f1c1a");
    for (const p of [[x0 + 2, 140], [x1 - 2, 140], [x0 + 3, 266], [x1 - 3, 266]]) {
        sg.fillStyle = "#151210";
        sg.beginPath();
        sg.arc(p[0], p[1], 3, 0, Math.PI * 2);
        sg.fill();
    }
    // Padlock where the chains cross
    sg.fillStyle = "#3a2e22";
    sg.fillRect(cx - 6, 214, 12, 11);
    sg.strokeStyle = "#191512";
    sg.lineWidth = 2;
    sg.beginPath();
    sg.arc(cx, 214, 4, Math.PI, 0);
    sg.stroke();
    sg.strokeStyle = "rgba(220, 180, 120, 0.35)";
    sg.lineWidth = 0.7;
    sg.strokeRect(cx - 6, 214, 12, 11);
    sg.fillStyle = "#050404";
    sg.fillRect(cx - 0.7, 218, 1.4, 4);
    // Ribbons and the great seal across the meeting stiles
    sg.strokeStyle = "#7a1410";
    sg.lineWidth = 3;
    sg.beginPath();
    sg.moveTo(cx - 2, sealY);
    sg.quadraticCurveTo(cx - 8, sealY + 20, cx - 6, sealY + 34);
    sg.moveTo(cx + 2, sealY);
    sg.quadraticCurveTo(cx + 9, sealY + 18, cx + 7, sealY + 30);
    sg.stroke();
    drips(sg, rand, cx - 8, cx + 8, sealY + 8, 5, 16, "rgba(140, 18, 12, 0.95)");
    waxSeal(sg, rand, cx, sealY, 14, "eye");
    const seal = { canvas: sc, x: x0 - 6, y: apex, w: x1 - x0 + 12, h: bottom - apex + 30, sealX: cx, sealY };

    // What lies beyond: steps falling away into red fog
    const [vc, vg] = canvasFor(x0, apex, x1 - x0, bottom - apex, scale);
    vg.save();
    doorArch(vg);
    vg.clip();
    const vgr = vg.createLinearGradient(0, apex, 0, bottom);
    vgr.addColorStop(0, "#020101");
    vgr.addColorStop(0.6, "#1a0403");
    vgr.addColorStop(1, "#3a0806");
    vg.fillStyle = vgr;
    vg.fillRect(x0, apex, x1 - x0, bottom - apex);
    for (let i = 0; i < 7; i++) {
        const y = bottom - 6 - i * 9, inset = 4 + i * 4.5;
        vg.fillStyle = `rgba(${70 - i * 8}, ${12 - i}, ${8 - i}, 1)`;
        vg.fillRect(x0 + inset, y, x1 - x0 - inset * 2, 4);
        vg.fillStyle = "rgba(0,0,0,0.6)";
        vg.fillRect(x0 + inset, y + 4, x1 - x0 - inset * 2, 5);
    }
    vg.restore();
    const beyond = { canvas: vc, x: x0, y: apex, w: x1 - x0, h: bottom - apex };
    return { left: leaf(-1), right: leaf(1), seal, beyond, cx, arch: DOOR };
}

// Pre-rendered glow for a set of polylines (a blurred halo under a bright
// core), so the renderer can fade it in and out without per-frame shadows
function glowLayer(lines, scale, rgb, core = 1.3, halo = 3) {
    const pts = lines.flat();
    const x0 = Math.floor(Math.min(...pts.map(p => p.x)) - 14), x1 = Math.ceil(Math.max(...pts.map(p => p.x)) + 14);
    const y0 = Math.floor(Math.min(...pts.map(p => p.y)) - 14), y1 = Math.ceil(Math.max(...pts.map(p => p.y)) + 14);
    const [c, g] = canvasFor(x0, y0, x1 - x0, y1 - y0, scale);
    g.lineCap = "round";
    g.lineJoin = "round";
    const stroke = (wd, a) => {
        g.strokeStyle = `rgba(${rgb}, ${a})`;
        g.lineWidth = wd;
        for (const pl of lines) {
            g.beginPath();
            g.moveTo(pl[0].x, pl[0].y);
            for (const p of pl.slice(1)) g.lineTo(p.x, p.y);
            g.stroke();
        }
    };
    g.filter = `blur(${halo * scale}px)`;
    stroke(core * 3.5, 0.6);
    g.filter = "none";
    stroke(core, 1);
    return { canvas: c, x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ─── Building ────────────────────────────────────────────────────────────

const room = type => ROOM.interactables.find(i => i.type === type) || { x: 800, y: 650 };
const REF = { x: 800, y: 650 }; // where relocatable fixtures (corpses) are painted

// Footprints (floor units) for the solid fixtures
const FIXTURE_DEFS = {
    blood_ritual_altar: { du: 48, dw: 27, height: 80, paint: paintAltar },
    static_signal_pylon: { du: 20, dw: 14, height: 190, paint: paintPylon, extent: { du: 50 } },
    corpse_lantern_shrine: { du: 26, dw: 17, height: 115, paint: paintShrine, extent: { du: 40 } },
    wax_record_chest: { du: 31, dw: 18, height: 70, paint: paintChest(0) }
};
const CHEST_ANGLES = [0, 0.35, 0.75, 1.15, 1.6, 1.9];

// Colliders for the solid fixtures, in the engine's obstacle format
export const FIXTURE_COLLIDERS = Object.entries(FIXTURE_DEFS).map(([type, d]) => {
    const at = room(type);
    const { u, w } = placeAt(at.x, at.y);
    const a = P(u - d.du * 0.85, w + d.dw * 0.8), c = P(u + d.du * 0.85, w - d.dw * 0.8);
    return { x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y, label: "fixture", id: type };
});

export function buildFixtures(scale = 1) {
    const rand = mulberry32(6060);
    const at = type => room(type);
    const sprite = (id, pos, def) => buildSprite({ id, x: pos.x, y: pos.y, ...def }, scale, rand);
    const fixtures = {
        monolith: sprite("monolith", { x: 800, y: 620 }, { du: 56, dw: 38, height: 300, paint: paintMonolith, extent: { du: 30, dw0: 40 } }),
        door: paintDoor(scale),
        interactables: {}
    };
    for (const [type, def] of Object.entries(FIXTURE_DEFS)) {
        fixtures.interactables[type] = sprite(type, at(type), def);
    }
    // The Monolith's glyphs light one row at a time; its cracks glow together
    const mm = fixtures.monolith.meta;
    mm.glyphGlow = [];
    for (let r = 0; r < mm.glyphRows; r++) {
        const lines = mm.glyphs.filter(gl => gl.row === r).map(gl => gl.pts);
        if (lines.length) mm.glyphGlow.push({ row: r, ...glowLayer(lines, scale, "255, 80, 28") });
    }
    mm.crackGlow = glowLayer(mm.cracks, scale, "235, 45, 22", 0.9, 2.5);
    const chestAt = at("wax_record_chest");
    fixtures.chestFrames = CHEST_ANGLES.map(a => sprite("wax_record_chest", chestAt, { ...FIXTURE_DEFS.wax_record_chest, paint: paintChest(a) }));
    for (const [type, kind] of [["fresh_marked_corpse", "fresh"], ["burned_corpse_remains", "burned"], ["broadcast_corpse", "broadcast"]]) {
        fixtures.interactables[type] = sprite(type, REF, { du: 46, dw: 24, height: 60, paint: paintCorpse(kind), relocatable: true });
    }
    return fixtures;
}

