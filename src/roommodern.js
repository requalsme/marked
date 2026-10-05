// The Keeping House in the present day (ERA === "present"): the same stone
// archive, converted into a public library some decades ago and abandoned
// since. Painted over the old room (world.js): library signage and notices
// on the old stone, carpet tiles laid over the flagstones and now lifting,
// water damage, graffiti, fallen ceiling tiles and the litter of squatters.

import {
    WALL_BASE_Y, GEOM, project, mulberry32, pathPoly, inkLine, inkPoly, blotch
} from "./world.js";

const { BACK_W, HALF_U, WALL_L, WALL_R } = GEOM;

export function paintPresentOverlay(canvas, scale) {
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const rand = mulberry32(2026);
    drawCarpet(ctx, rand);
    drawWaterDamage(ctx, rand);
    drawSignage(ctx, rand);
    drawGraffiti(ctx, rand);
    drawLitter(ctx, rand);
    ctx.restore();
}

// Grey-blue carpet tiles laid over the flagstones in the reading area, stained,
// lifting at the seams, missing in patches so the old stone shows through
function drawCarpet(ctx, rand) {
    const fl = [project(-HALF_U, BACK_W), project(HALF_U, BACK_W), project(HALF_U, 0), project(-HALF_U, 0)];
    ctx.save();
    pathPoly(ctx, fl);
    ctx.clip();
    const T = 60;
    for (let w = 120; w < BACK_W - 140; w += T) {
        for (let u = -HALF_U + 40; u < HALF_U - 40; u += T) {
            if (Math.abs(u + T / 2) < 150) continue;            // the runner's aisle stays stone
            const edge = Math.abs(u) > 560 || w > BACK_W - 260;  // ragged towards the walls
            if (rand() < (edge ? 0.55 : 0.12)) continue;         // torn up here
            const q = [project(u + 1, w + T - 1), project(u + T - 1, w + T - 1), project(u + T - 1, w + 1), project(u + 1, w + 1)];
            pathPoly(ctx, q);
            const t = 0.85 + rand() * 0.25;
            ctx.fillStyle = `rgba(${58 * t}, ${62 * t}, ${68 * t}, 0.88)`;
            ctx.fill();
            ctx.strokeStyle = "rgba(10, 12, 14, 0.55)";
            ctx.lineWidth = 0.8;
            ctx.stroke();
            if (rand() < 0.15) {
                // A tile lifting at one corner
                const c = q[rand() < 0.5 ? 0 : 1];
                ctx.fillStyle = "rgba(20, 22, 26, 0.6)";
                ctx.beginPath();
                ctx.moveTo(c.x, c.y);
                ctx.lineTo(c.x + 10, c.y + 2);
                ctx.lineTo(c.x + 2, c.y + 6);
                ctx.fill();
            }
        }
    }
    // Damp, footprints and stains across the carpet
    for (let i = 0; i < 60; i++) {
        const p = project((rand() - 0.5) * 1400, 140 + rand() * (BACK_W - 300));
        blotch(ctx, p.x, p.y, (20 + rand() * 70) * p.s, rand() < 0.75 ? `rgba(0, 0, 0, ${0.1 + rand() * 0.15})` : `rgba(90, 70, 40, ${0.08 + rand() * 0.08})`);
    }
    ctx.restore();
}

// Rain has been getting in: dark streaks down the stone, a tide mark, puddles
function drawWaterDamage(ctx, rand) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(WALL_L, 0, WALL_R - WALL_L, WALL_BASE_Y);
    ctx.clip();
    for (let i = 0; i < 22; i++) {
        const x = WALL_L + rand() * (WALL_R - WALL_L), y = 20 + rand() * 60, len = 80 + rand() * 180;
        const g = ctx.createLinearGradient(0, y, 0, y + len);
        g.addColorStop(0, "rgba(10, 14, 12, 0.45)");
        g.addColorStop(1, "rgba(10, 14, 12, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 3 + rand() * 12, len);
    }
    ctx.restore();
    for (const [u, w, r] of [[-120, 900, 70], [300, 640, 50], [-560, 300, 45]]) {
        const p = project(u, w);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(1, 0.45);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * p.s);
        g.addColorStop(0, "rgba(20, 30, 36, 0.55)");
        g.addColorStop(0.8, "rgba(20, 30, 36, 0.35)");
        g.addColorStop(1, "rgba(20, 30, 36, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r * p.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(170, 190, 210, 0.14)";
        ctx.beginPath();
        ctx.ellipse(-r * 0.2 * p.s, -r * 0.1 * p.s, r * 0.4 * p.s, r * 0.12 * p.s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// The library's signs, screwed straight into the old stone
function drawSignage(ctx, rand) {
    // Name board across the frieze
    ctx.fillStyle = "#1d2a3a";
    ctx.fillRect(420, 36, 240, 18);
    ctx.fillRect(940, 36, 240, 18);
    ctx.fillStyle = "#d8dde2";
    ctx.font = "bold 9px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CITY LIBRARY · LOCAL HISTORY", 540, 48);
    ctx.fillText("ARCHIVE READING ROOM", 1060, 48);
    // Shelf-end category plaques
    const cats = ["000–099", "200–299", "900–999", "MAPS", "PARISH RECORDS", "REFERENCE"];
    [262, 438, 612, 988, 1162, 1338].forEach((x, i) => {
        ctx.fillStyle = "#e4e2da";
        ctx.fillRect(x - 22, 100, 44, 9);
        ctx.fillStyle = "#24303e";
        ctx.font = "bold 6px Arial, sans-serif";
        ctx.fillText(cats[i], x, 107);
    });
    // Notices taped to the pillars
    for (const [x, y, txt] of [[350, 210, "SILENCE"], [1074, 212, "CLOSED"], [526, 190, "NO FOOD"], [1250, 196, "BOOK RETURNS →"]]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((rand() - 0.5) * 0.1);
        ctx.fillStyle = "#efeee8";
        ctx.fillRect(-15, -10, 30, 20);
        ctx.fillStyle = "#1a1a1a";
        ctx.font = "bold 5px Arial, sans-serif";
        ctx.fillText(txt, 0, 1);
        ctx.fillStyle = "rgba(220, 210, 160, 0.6)";
        ctx.fillRect(-6, -12, 12, 4);
        ctx.restore();
    }
}

// Spray paint over the old walls and the sign: tags, an eye, a warning
function drawGraffiti(ctx, rand) {
    const spray = (fn, color, width) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        fn();
        ctx.stroke();
        ctx.restore();
    };
    // "IT SEES YOU" across the base of two bays
    ctx.save();
    ctx.font = "bold italic 22px Arial Black, Arial, sans-serif";
    ctx.fillStyle = "rgba(200, 30, 24, 0.75)";
    ctx.textAlign = "center";
    ctx.fillText("IT SEES YOU", 1080, 262);
    ctx.restore();
    for (const dx of [1010, 1046, 1094, 1130]) {
        ctx.fillStyle = "rgba(200, 30, 24, 0.6)";
        ctx.fillRect(dx, 262, 1.6, 10 + rand() * 18);
    }
    // A tag in white and green bubble letters
    spray(() => {
        let x = 214, y = 256;
        for (let i = 0; i < 6; i++) {
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + 6, y - 22 - rand() * 6, x + 12, y);
            x += 14;
        }
    }, "rgba(120, 200, 140, 0.6)", 3);
    spray(() => {
        ctx.moveTo(206, 266);
        ctx.quadraticCurveTo(260, 276, 306, 262);
    }, "rgba(230, 230, 220, 0.5)", 2);
    // The eye again, sprayed on a pillar by someone who also saw it
    spray(() => {
        ctx.moveTo(1415, 150);
        ctx.quadraticCurveTo(1426, 138, 1437, 150);
        ctx.quadraticCurveTo(1426, 162, 1415, 150);
        ctx.moveTo(1426 + 3, 150);
        ctx.arc(1426, 150, 3, 0, Math.PI * 2);
    }, "rgba(200, 30, 24, 0.7)", 1.6);
}

// Fallen ceiling tiles, drinks cans, a shopping trolley wheel, leaves blown in
function drawLitter(ctx, rand) {
    for (let i = 0; i < 14; i++) {
        const u = (rand() - 0.5) * 1400, w = 60 + rand() * (BACK_W - 200);
        if (Math.abs(u) < 130) continue;
        const a = rand() * Math.PI, L = 28, D = 28;
        const pts = [[-L, -D], [L, -D], [L, D], [-L, D]].map(([x, y]) =>
            project(u + (x * Math.cos(a) - y * Math.sin(a)) * 0.5, w + (x * Math.sin(a) + y * Math.cos(a)) * 0.5, 0.5));
        pathPoly(ctx, pts);
        ctx.fillStyle = `rgba(${196 + rand() * 20}, ${192 + rand() * 18}, ${180 + rand() * 14}, 0.95)`;
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        for (let k = 0; k < 8; k++) {
            const p = pts[0];
            ctx.fillRect(p.x + rand() * 20, p.y + rand() * 6, 1, 1);
        }
        inkPoly(ctx, rand, pts, 0.8, 0.6);
        if (rand() < 0.4) {
            // Broken in two
            inkLine(ctx, rand, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2, (pts[2].x + pts[3].x) / 2, (pts[2].y + pts[3].y) / 2, 0.8, 0.7);
        }
    }
    for (let i = 0; i < 26; i++) {
        const p = project((rand() - 0.5) * 1500, 30 + rand() * (BACK_W - 60));
        if (rand() < 0.5) {
            // A crushed can
            ctx.fillStyle = ["#b52a22", "#2a6ab0", "#c8c8c8", "#2a8a3a"][Math.floor(rand() * 4)];
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(rand() * Math.PI);
            ctx.fillRect(-4 * p.s, -2 * p.s, 8 * p.s, 4 * p.s);
            ctx.fillStyle = "rgba(255,255,255,0.35)";
            ctx.fillRect(-4 * p.s, -2 * p.s, 8 * p.s, 1);
            ctx.restore();
        } else {
            // A dead leaf
            ctx.fillStyle = `rgba(${110 + rand() * 40}, ${70 + rand() * 30}, 30, 0.85)`;
            ctx.beginPath();
            ctx.ellipse(p.x, p.y, 3.5 * p.s, 1.6 * p.s, rand() * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
