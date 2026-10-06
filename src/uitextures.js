// Procedural UI materials (GDD 17: iron frames, worn parchment, carved wood,
// black ink). Generated once at startup and exposed to CSS as custom properties
// so the HUD and panels are textured rather than flat fills.

function canvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return [c, c.getContext("2d")];
}

function noise(g, w, h, amount, light = true) {
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * amount;
        d[i] += n; d[i + 1] += n; d[i + 2] += light ? n : n * 0.8;
    }
    g.putImageData(img, 0, 0);
}

function blotches(g, w, h, count, color, maxR, alpha) {
    for (let i = 0; i < count; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 4 + Math.random() * maxR;
        const grad = g.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, color.replace("A", (alpha * (0.4 + Math.random() * 0.6)).toFixed(3)));
        grad.addColorStop(1, color.replace("A", "0"));
        g.fillStyle = grad;
        g.fillRect(x - r, y - r, r * 2, r * 2);
    }
}

// Dark wrought iron with scratches and rust bloom (tileable enough at 256)
function iron() {
    const [c, g] = canvas(256, 256);
    g.fillStyle = "#1a1714";
    g.fillRect(0, 0, 256, 256);
    blotches(g, 256, 256, 40, "rgba(60, 50, 42, A)", 50, 0.5);
    blotches(g, 256, 256, 18, "rgba(90, 40, 18, A)", 26, 0.35);   // rust
    blotches(g, 256, 256, 30, "rgba(0, 0, 0, A)", 40, 0.5);
    noise(g, 256, 256, 34);
    g.strokeStyle = "rgba(200, 190, 170, 0.06)";
    for (let i = 0; i < 60; i++) {
        const x = Math.random() * 256, y = Math.random() * 256, l = 6 + Math.random() * 30, a = Math.random() * Math.PI;
        g.lineWidth = Math.random() < 0.8 ? 0.6 : 1.2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
    }
    return c.toDataURL("image/png");
}

// Aged parchment: warm base, fibres, foxing and tide marks
function parchment(dark = false) {
    const [c, g] = canvas(384, 384);
    g.fillStyle = dark ? "#2a2117" : "#cdb88d";
    g.fillRect(0, 0, 384, 384);
    blotches(g, 384, 384, 70, dark ? "rgba(70, 55, 35, A)" : "rgba(235, 220, 180, A)", 80, 0.5);
    blotches(g, 384, 384, 45, dark ? "rgba(0, 0, 0, A)" : "rgba(120, 85, 40, A)", 60, dark ? 0.45 : 0.28);
    blotches(g, 384, 384, 25, dark ? "rgba(80, 20, 12, A)" : "rgba(100, 55, 20, A)", 14, 0.35); // foxing
    noise(g, 384, 384, dark ? 22 : 28);
    // Fibres
    g.strokeStyle = dark ? "rgba(255, 230, 190, 0.035)" : "rgba(80, 55, 25, 0.08)";
    for (let i = 0; i < 260; i++) {
        const x = Math.random() * 384, y = Math.random() * 384;
        g.lineWidth = 0.5;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + Math.random() * 10, y + Math.random() * 4, x + 6 + Math.random() * 14, y + (Math.random() - 0.5) * 6);
        g.stroke();
    }
    return c.toDataURL("image/png");
}

// Carved dark wood grain
function wood() {
    const [c, g] = canvas(512, 128);
    g.fillStyle = "#1c120b";
    g.fillRect(0, 0, 512, 128);
    for (let y = 0; y < 128; y += 1) {
        const v = Math.sin(y * 0.35 + Math.sin(y * 0.05) * 4) * 0.5 + 0.5;
        g.fillStyle = `rgba(${60 + v * 30}, ${36 + v * 18}, ${20 + v * 8}, ${0.25 + Math.random() * 0.15})`;
        g.fillRect(0, y, 512, 1);
    }
    g.strokeStyle = "rgba(0, 0, 0, 0.35)";
    for (let i = 0; i < 40; i++) {
        const y = Math.random() * 128;
        g.lineWidth = 0.5 + Math.random();
        g.beginPath();
        g.moveTo(0, y);
        for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin(x * 0.02 + i) * 3);
        g.stroke();
    }
    blotches(g, 512, 128, 12, "rgba(0, 0, 0, A)", 30, 0.5); // knots
    noise(g, 512, 128, 18);
    return c.toDataURL("image/png");
}

// Rough ink edge mask for bar fills (white = keep)
function inkEdge() {
    const [c, g] = canvas(64, 256);
    g.fillStyle = "#fff";
    g.fillRect(0, 0, 40, 256);
    for (let y = 0; y < 256; y += 2) {
        const w = 40 + Math.random() * 14 + Math.sin(y * 0.15) * 4;
        g.fillRect(0, y, w, 2);
        if (Math.random() < 0.15) {
            g.beginPath();
            g.arc(w + 2 + Math.random() * 6, y, 1 + Math.random() * 2, 0, Math.PI * 2);
            g.fill();
        }
    }
    return c.toDataURL("image/png");
}

export function installUiTextures() {
    try {
        const root = document.documentElement.style;
        root.setProperty("--tex-iron", `url(${iron()})`);
        root.setProperty("--tex-parchment", `url(${parchment(false)})`);
        root.setProperty("--tex-parchment-dark", `url(${parchment(true)})`);
        root.setProperty("--tex-wood", `url(${wood()})`);
        root.setProperty("--tex-ink-edge", `url(${inkEdge()})`);
    } catch (e) {
        console.warn("UI textures unavailable", e);
    }
}
