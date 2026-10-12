// Headless playtest: bots play the real engine and systems for simulated hours and report what happened.
//
//   node tools/playtest/run.js [--minutes 120] [--seeds 3] [--policy all|brawler|kiter|dasher|varied|lightbound]
//
// It mirrors the orchestrator's per-tick loop (main.js) without the DOM: the same engine, observation, sanity,
// dossier, Watcher, counters and Ledger code. The bots are crude on purpose (they never read the Watcher or the
// Dossier), so what it measures is pacing and pressure, not skill: how soon each tier arrives, how often a life ends,
// what kills it, what the Monolith turns against the player and when the story reaches them.

import { GameEngine, SANITY_HIT, BOSS } from "../../src/engine.js";
import { createProfile, getEquipmentStats, RARITY_MULTIPLIERS } from "../../src/state.js";
import { updateObservation, handleSanityDecay, TAROT_DECK, REALITY_TRAITS, traitActive } from "../../src/systems.js";
import { sampleDossier, obfuscationMask, closeLife, recordDeath, ensureDossier, diagnose, habits } from "../../src/dossier.js";
import { Watcher } from "../../src/watcher.js";
import { ritualTerms } from "../../src/ui.js";
import { activeCounters } from "../../src/adapt.js";
import { unlockFor, ensureLedger, chooseWarning } from "../../src/lore.js";
import { ROOM } from "../../src/world.js";
import { seedRandom } from "../../tests/helpers.js";

const STAY = process.argv.includes("--stay");
// --boss health,hit,seal  sweeps the Seal Mother's scaling (e.g. --boss 60,0.075,0.075)
{ const i = process.argv.indexOf("--boss"); if (i > 0) { const [h, a, b] = process.argv[i + 1].split(",").map(Number); BOSS.healthPerDamage = h; BOSS.hitShare = a; BOSS.sealShare = b ?? a; } }
const SKILL = (() => { const i = process.argv.indexOf("--skill"); return i > 0 ? Number(process.argv[i + 1]) : 1; })();
const STEP = 1 / 60;
const TIERS = [25, 50, 75, 100];

// ─── Bots ───────────────────────────────────────────────────────────────────

// Basic reflexes (--skill 1, the default): sidestep a shot that is on course to hit. --skill 0 never dodges: the worst case.
let dodge = [0, 0];

function evade(s) {
    dodge = [0, 0];
    if (!SKILL) return;
    const p = s.p;
    for (const pr of s.engine.projectiles) {
        if (pr.owner !== "enemy") continue;
        const rx = pr.x - p.x, ry = pr.y - p.y, vv = pr.vx * pr.vx + pr.vy * pr.vy || 1;
        const t = -(rx * pr.vx + ry * pr.vy) / vv;
        if (t < 0 || t > 22) continue;
        const cx = rx + pr.vx * t, cy = ry + pr.vy * t;
        if (Math.hypot(cx, cy) > pr.radius + p.radius + 10) continue;
        // step off the line of flight, to the side the shot would miss on
        const side = Math.sign(cx * -pr.vy + cy * pr.vx) || 1;
        const sp = Math.sqrt(vv);
        dodge = [dodge[0] + (-pr.vy / sp) * -side, dodge[1] + (pr.vx / sp) * -side];
    }
}

function press(engine, dx, dy, dash = false) {
    dx += dodge[0] * 1.6; dy += dodge[1] * 1.6;
    const k = engine.keys;
    k.a = dx < -0.3; k.d = dx > 0.3; k.w = dy < -0.3; k.s = dy > 0.3;
    k.shift = dash;
}

function toward(from, to, stop = 0) {
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    return d <= stop ? [0, 0] : [dx / d, dy / d];
}

const HOME = { x: 560, y: 520 };

const POLICIES = {
    // Walks into the nearest witness and fights at arm's length
    brawler: { classType: "Blood Marked", act(s) {
        const e = s.nearest();
        const [dx, dy] = toward(s.p, e || HOME, e ? 42 : 20);
        press(s.engine, dx, dy);
    } },
    // Keeps a ranged class at a distance and backs away when pressed
    kiter: { classType: "Signal Marked", act(s) {
        const e = s.nearest();
        if (!e) { press(s.engine, ...toward(s.p, HOME, 20)); return; }
        const d = Math.hypot(e.x - s.p.x, e.y - s.p.y);
        const [tx, ty] = toward(s.p, e);
        if (d < 150) press(s.engine, -tx, -ty); else if (d > 230) press(s.engine, tx, ty); else press(s.engine, -ty * 0.7, tx * 0.7);
    } },
    // Closes in and dashes whenever anything gets close
    dasher: { classType: "Static Marked", act(s) {
        const e = s.nearest();
        if (!e) { press(s.engine, ...toward(s.p, HOME, 20)); return; }
        const d = Math.hypot(e.x - s.p.x, e.y - s.p.y);
        const [tx, ty] = toward(s.p, e, 38);
        const flee = d < 100 && s.engine.player.dashCooldown <= 0;
        if (flee) press(s.engine, -tx, -ty, true); else press(s.engine, tx, ty);
    } },
    // Changes how it fights every half minute, so no pattern holds
    varied: { classType: "Bone Marked", act(s) {
        const slot = Math.floor(s.engine.player.currentLifeDuration / 30) % 3;
        ([POLICIES.brawler, POLICIES.kiter, POLICIES.dasher][slot]).act(s);
    } },
    // Fights from the nearest candle and will not leave it
    lightbound: { classType: "Bone Marked", act(s) {
        const c = ROOM.candles.filter(x => !x.snuffed && x.kind !== "sconce").sort((a, b) => Math.hypot(a.x - s.p.x, a.y - s.p.y) - Math.hypot(b.x - s.p.x, b.y - s.p.y))[0] || HOME;
        press(s.engine, ...toward(s.p, c, 14));
    } }
};

const p0 = s => s.engine.player;

// ─── One bot's whole career ─────────────────────────────────────────────────

class Session {
    constructor(policyName, seed) {
        this.policyName = policyName;
        this.policy = POLICIES[policyName];
        this.seed = seed;
        this.profile = createProfile("Bot", this.policy.classType);
        this.profile.tutorialStep = 4;
        ensureLedger(this.profile);
        this.engine = new GameEngine();
        this.sanityBooks = () => ({ decay: 0, shards: 0, hits: {} });
        this.books = this.sanityBooks();
        // Wrap the engine so every point of sanity gained or lost is attributed
        const dmg = this.engine.damagePlayer.bind(this.engine);
        this.engine.damagePlayer = (amount, san = 0, sx = null, sy = null, source = this.engine.currentActor) => {
            const before = this.engine.player.sanity;
            const hpBefore = this.engine.player.health;
            dmg(amount, san, sx, sy, source);
            if (this.life.boss && !this.life.boss.defeated) { this.life.boss.damage = (this.life.boss.damage || 0) + Math.max(0, hpBefore - this.engine.player.health); this.life.boss.maxHp = this.engine.player.maxHealth; }
            const lost = before - this.engine.player.sanity;
            if (lost > 0) this.books.hits[source || "?"] = (this.books.hits[source || "?"] || 0) + lost;
        };
        const collect = this.engine.collectLoot.bind(this.engine);
        this.engine.collectLoot = (loot) => {
            const before = this.engine.player.sanity;
            collect(loot);
            this.books.shards += Math.max(0, this.engine.player.sanity - before);
        };
        this.watcher = new Watcher();
        this.traps = [];
        this.simTick = 0;
        this.lives = [];
        this.totalSeconds = 0;
        this.escapes = 0;
        this.knownCounters = new Set();
        this.startLife();
    }

    get p() { return this.engine.player; }

    nearest() {
        let best = null, bd = Infinity;
        for (const e of this.engine.enemies) {
            if (e.health <= 0) continue;
            const d = Math.hypot(e.x - this.p.x, e.y - this.p.y);
            if (d < bd) { bd = d; best = e; }
        }
        return best;
    }

    startLife() {
        const prof = this.profile;
        this.engine.reset();
        this.engine.canvasRenderer = { candles: ROOM.candles, triggerShake() {}, triggerDamageFlash() {}, showBanner() {} };
        const tarots = Object.keys(TAROT_DECK), traits = Object.keys(REALITY_TRAITS);
        prof.activeTarot = tarots[Math.floor(Math.random() * tarots.length)];
        prof.activeRealityTrait = traits[Math.floor(Math.random() * traits.length)];
        this.engine.setPlayer(prof, getEquipmentStats(prof));
        for (const i of ROOM.interactables) this.engine.addInteractable(i.type, i.x, i.y, { ...i.data });
        this.traps = [];
        this.knownCounters = new Set();
        this.fl = { fractured: false, lowHealth: false, autoDecode: 0 };
        this.books = this.sanityBooks();
        this.leaveAt = 0;
        this.life = { books: this.books, start: this.totalSeconds, tiers: {}, counters: {}, whispers: [], pages: {}, boss: null, kills: 0 };
        this.engine.autoAttack = true;
    }

    recalc() {
        const eq = getEquipmentStats(this.profile);
        this.engine.player.stats = eq;
        this.engine.player.maxHealth = this.profile.maxHealth + eq.health;
        this.engine.player.speed = this.engine.player.speed;
    }

    // What a sensible player does between fights: wear better gear, spend what they have on the Monolith
    manage() {
        const prof = this.profile;
        const rank = r => Object.keys(RARITY_MULTIPLIERS).indexOf(r);
        const score = it => it ? (rank(it.rarity) + 1) * 10 + (it.damage || 0) * 0.2 + (it.health || 0) * 0.05 : -1;
        for (let i = prof.inventory.length - 1; i >= 0; i--) {
            const it = prof.inventory[i];
            if (score(it) > score(prof.gear[it.type])) {
                const old = prof.gear[it.type];
                prof.gear[it.type] = it;
                if (old) prof.inventory[i] = old; else prof.inventory.splice(i, 1);
            }
        }
        let bought = true;
        while (bought) {
            bought = false;
            const up = prof.upgrades;
            if (up.body < 10 && prof.parchment >= 3 + up.body) { prof.parchment -= 3 + up.body; up.body++; prof.maxHealth += 20; this.engine.player.health += 20; bought = true; }
            else if (up.mind < 10 && prof.ink >= 3 + up.mind) { prof.ink -= 3 + up.mind; up.mind++; bought = true; }
            else if (up.obfuscation < 10 && prof.waxSeals >= 2 + up.obfuscation) { prof.waxSeals -= 2 + up.obfuscation; up.obfuscation++; bought = true; }
        }
        this.recalc();
    }

    tickOnce() {
        const { engine, profile: prof } = this;
        this.simTick++;
        this.totalSeconds += STEP;
        evade(this);
        this.policy.act(this);

        const result = { died: false, escaped: false };
        engine.update((event, data) => this.onEvent(event, data, result));
        if (result.died) return result;
        // --stay: a greedy player keeps farming after the boss, to see what Known costs
        if (STAY && this.leaveAt && p0(this).currentLifeDuration > this.leaveAt) { this.leaveAt = 0; result.escaped = true; return result; }

        const p = engine.player;
        const crossed = updateObservation(prof, engine, STEP);
        if (crossed) {
            this.life.tiers[crossed.at] = p.currentLifeDuration;
            if (crossed.at === 50) this.life.studied = habits(prof).slice(0, 3).map(h => `${h.id} ${h.strength.toFixed(2)}`);
            this.watcher.notify("tier" + crossed.tier);
            this.unlock("tier" + crossed.tier);
        }
        const sBefore = p.sanity;
        handleSanityDecay(prof, engine, STEP);
        this.books.decay += sBefore - p.sanity;
        this.study();
        this.resolveTraps();

        if (this.simTick % 180 === 0) {
            const need = prof.level * 100;
            if (prof.exp >= need) {
                prof.exp -= need; prof.level++; prof.maxHealth += 10; prof.health = prof.maxHealth;
                p.maxHealth += 10; p.health = p.maxHealth;
            }
            this.manage();
        }
        // A player with a clear head spends it at the altar every few minutes: Static Communion decodes the next page
        if (this.simTick % 60 === 0 && p.currentLifeDuration > 120 && p.sanity > 55) {
            const n = prof.ritualsThisDescent || 0, terms = ritualTerms(n, prof);
            if (Date.now() - (prof.lastRitualTime || 0) > 1e12 || !prof.lastRitualAt || p.currentLifeDuration - prof.lastRitualAt > terms.cooldownMs / 1000) {
                p.sanity -= terms.commSanity; prof.ritualsThisDescent = n + 1; prof.lastRitualAt = p.currentLifeDuration;
                this.unlock("communion");
            }
        }
        return result;
    }

    study() {
        const { engine, profile: prof } = this;
        const p = engine.player;
        sampleDossier(prof, engine, STEP);
        const mask = obfuscationMask(prof, p.stats);
        if (this.simTick % 60 === 0) prof.activeDiagnosis = diagnose(prof, mask);
        if (this.simTick % 120 === 0) {
            engine.counters = activeCounters(prof, prof.observation, mask);
            for (const id of Object.keys(engine.counters)) {
                if (!this.knownCounters.has(id)) { this.knownCounters.add(id); this.life.counters[id] = p.currentLifeDuration; }
            }
        }
        if (p.sanity < 40 && this.life.fractAt === undefined) this.life.fractAt = p.currentLifeDuration;
        if (p.sanity < 15 && this.life.brokenAt === undefined) this.life.brokenAt = p.currentLifeDuration;
        if (p.sanity < 40 && !this.fl.fractured) { this.fl.fractured = true; this.watcher.notify("sanity_fractured"); }
        if (p.sanity >= 60) this.fl.fractured = false;
        if (p.health < p.maxHealth * 0.25 && !this.fl.lowHealth) { this.fl.lowHealth = true; this.watcher.notify("low_health"); }
        if (p.health > p.maxHealth * 0.5) this.fl.lowHealth = false;
        if (traitActive(prof, "Static Sky")) {
            const slot = Math.floor(p.currentLifeDuration / 120);
            if (slot > this.fl.autoDecode) { this.fl.autoDecode = slot; this.unlock("communion"); }
        }
        if (this.simTick % 30 !== 15) return;
        const nearCorpse = engine.interactables.some(i => i.type === "fresh_marked_corpse" && engine.distance(p.x, p.y, i.x, i.y) < 320);
        const gapMult = (prof.activeTarot === "The Moon" ? 0.5 : 1) * (traitActive(prof, "Static Sky") ? 0.7 : 1);
        const w = this.watcher.update(prof, { life: p.currentLifeDuration, observation: prof.observation, sanity: p.sanity, mask, gapMult, nearCorpse });
        if (w) this.life.whispers.push({ at: p.currentLifeDuration, id: w.id, kind: w.kind });
    }

    unlock(trigger) {
        const page = unlockFor(this.profile, trigger);
        if (page) this.life.pages[page.id] = this.p.currentLifeDuration;
    }

    onEvent(event, data, result) {
        const { engine } = this;
        if (event === "player_died") result.died = true;
        else if (event === "boss_wax_trap") this.traps.push({ x: data.x, y: data.y, radius: 35, timer: 60, damage: data.damage ?? 25, sanity: SANITY_HIT.waxTrap, source: "Seal Mother's wax trap", kind: "wax" });
        else if (event === "mark") this.traps.push({ x: data.x, y: data.y, radius: data.radius, timer: data.frames, damage: data.damage, sanity: data.sanity || 0, source: data.source, kind: data.kind });
        else if (event === "boss_spawned") { this.life.boss = { woke: this.p.currentLifeDuration }; this.unlock("boss_wake"); this.watcher.notify("boss_wake"); }
        else if (event === "boss_defeated") {
            this.profile.exp += 300;
            this.life.boss.defeated = this.p.currentLifeDuration;
            this.unlock("boss_down");
            if (!STAY) result.escaped = true; // the bot takes the open door unless told to stay and be Known
            else this.leaveAt = this.p.currentLifeDuration + 4 * 60;
        } else if (event === "echo_down") this.unlock("echo_down");
        else if (event === "corpse_rose") { this.life.risen = (this.life.risen || 0) + 1; this.watcher.notify("corpse_rose"); }
        else if (event === "watcher_confrontation") { this.watcher.notify("confrontation"); this.life.confrontations = (this.life.confrontations || 0) + 1; }
    }

    resolveTraps() {
        const { engine } = this;
        const p = engine.player;
        for (let i = this.traps.length - 1; i >= 0; i--) {
            const t = this.traps[i];
            if (--t.timer > 0) continue;
            if (engine.distance(p.x, p.y, t.x, t.y) < t.radius + p.radius) {
                engine.damagePlayer(t.damage, t.sanity, t.x, t.y, t.source);
                p.invulnTimer = 40;
            }
            this.traps.splice(i, 1);
        }
    }

    // Close the life: record it and (like the game) reset the descent
    endLife(kind) {
        const { profile: prof, engine } = this;
        const p = engine.player;
        const dos = ensureDossier(prof).life;
        const life = {
            ...this.life, kind, seconds: p.currentLifeDuration, level: prof.level, observation: prof.observation,
            killer: kind === "death" ? engine.lastDamageSource : null, hurtBy: { ...dos.hurtBy }, kills: Object.values(dos.kills).reduce((a, b) => a + b, 0),
            habits: prof.activeDiagnosis, lowSanity: dos.secs ? dos.lowSanity / dos.secs : 0,
            sanityAtEnd: p.sanity, dashes: dos.dashes, secs: dos.secs, engaged: dos.engaged, melee: dos.melee, mid: dos.mid, far: dos.far, retreat: dos.retreat, approach: dos.approach
        };
        this.lives.push(life);
        if (kind === "death") {
            recordDeath(prof, { cause: engine.deathCause(), killer: engine.lastDamageSource, seconds: p.currentLifeDuration, observation: prof.observation, level: prof.level });
            prof.stats.deaths++;
            prof.corpses.push({ x: p.x, y: p.y, cause: engine.deathCause(), killer: engine.lastDamageSource, seconds: Math.round(p.currentLifeDuration), level: prof.level, classType: prof.classType, state: "fresh", zone: "The Keeping House", gear: {} });
            if (prof.corpses.length > 5) prof.corpses.shift();
        } else {
            this.escapes++;
            prof.stats.escapes = (prof.stats.escapes || 0) + 1;
            this.unlock("escape");
        }
        closeLife(prof);
        this.watcher.resetLife(prof);
        prof.currentLifeDuration = 0; prof.ritualsThisDescent = 0; prof.lastRitualTime = 0; prof.lastRitualAt = 0;
        prof.observation = 0; prof.sanity = 100; prof.health = prof.maxHealth;
        this.startLife();
        // corpses are placed where they fell, as in the game
        for (const c of prof.corpses) {
            if (c.state === "risen") continue;
            const cy = this.engine.clampY(c.y);
            this.engine.addInteractable("fresh_marked_corpse", this.engine.clampX(c.x, cy), cy, { radius: 18, corpse: c });
        }
    }
}

// ─── Running and reporting ───────────────────────────────────────────────────

async function play(policyName, seed, minutes) {
    const restore = seedRandom(seed);
    const s = new Session(policyName, seed);
    const total = minutes * 60;
    let guard = 0;
    while (s.totalSeconds < total) {
        const r = s.tickOnce();
        if (r.died) s.endLife("death");
        else if (r.escaped) s.endLife("escape");
        if (++guard % 240 === 0) await new Promise(res => setImmediate(res)); // let async loot drops land
    }
    restore();
    return s;
}

const median = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const fmt = (v, d = 1) => v === null || v === undefined ? "-" : (typeof v === "number" ? v.toFixed(d) : v);
const mins = v => v === null ? "-" : (v / 60).toFixed(1);

function report(name, sessions) {
    const lives = sessions.flatMap(s => s.lives);
    const deaths = lives.filter(l => l.kind === "death");
    const escapes = lives.filter(l => l.kind === "escape");
    const hours = sessions.reduce((a, s) => a + s.totalSeconds, 0) / 3600;
    const tier = t => median(lives.filter(l => l.tiers[t] !== undefined).map(l => l.tiers[t]));
    const reached = t => (lives.filter(l => l.tiers[t] !== undefined).length / lives.length * 100).toFixed(0) + "%";
    const killers = {};
    for (const d of deaths) killers[d.killer || "?"] = (killers[d.killer || "?"] || 0) + 1;
    const counterFirst = {};
    for (const l of lives) for (const [id, at] of Object.entries(l.counters)) (counterFirst[id] = counterFirst[id] || []).push(at);
    const whispers = lives.reduce((a, l) => a + l.whispers.length, 0);
    const lifeMin = lives.reduce((a, l) => a + l.seconds, 0) / 60;
    const pageAt = {};
    for (const s of sessions) for (const l of s.lives) for (const [id, at] of Object.entries(l.pages)) (pageAt[id] = pageAt[id] || []).push(at);
    const ownedPages = sessions.map(s => s.profile.ledger.pages.length);
    const damageBy = {};
    for (const l of lives) for (const [src, v] of Object.entries(l.hurtBy)) damageBy[src] = (damageBy[src] || 0) + v;
    const topDamage = Object.entries(damageBy).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${(v / Math.max(1, lives.length)).toFixed(0)}`).join(", ");

    console.log(`\n── ${name} ── ${hours.toFixed(1)} h played, ${lives.length} lives (${deaths.length} deaths, ${escapes.length} escapes)`);
    console.log(`  life length: median ${mins(median(lives.map(l => l.seconds)))} min | deaths/hour ${(deaths.length / hours).toFixed(2)} | median death at ${mins(median(deaths.map(d => d.seconds)))} min, obs ${fmt(median(deaths.map(d => d.observation)), 0)}%, level ${fmt(median(lives.map(l => l.level)), 0)}`);
    console.log(`  tiers (median min, % of lives reaching): 25% ${mins(tier(25))} (${reached(25)}) | 50% ${mins(tier(50))} (${reached(50)}) | 75% ${mins(tier(75))} (${reached(75)}) | 100% ${mins(tier(100))} (${reached(100)})`);
    console.log(`  killed by: ${Object.entries(killers).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "-"}`);
    console.log(`  damage taken per life: ${topDamage || "-"}`);
    console.log(`  counters (lives that met it, median first minute): ${Object.entries(counterFirst).map(([k, v]) => `${k} ${v.length}/${lives.length} @${mins(median(v))}`).join(", ") || "none"}`);
    const studied = {};
    for (const l of lives) for (const h of l.studied || []) { const [id] = h.split(" "); studied[id] = (studied[id] || 0) + 1; }
    const reachedStudied = lives.filter(l => l.studied).length;
    console.log(`  habits read at Studied (${reachedStudied} lives): ${Object.entries(studied).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`);
    const share = k => mean(lives.filter(l => l.engaged > 30).map(l => l[k] / l.engaged));
    console.log(`  fighting distance (share of engaged time): melee ${fmt(share("melee") * 100, 0)}% | mid ${fmt(share("mid") * 100, 0)}% | far ${fmt(share("far") * 100, 0)}% | approaching ${fmt(share("approach") * 100, 0)}% | retreating ${fmt(share("retreat") * 100, 0)}% | dashes/min ${fmt(mean(lives.filter(l => l.secs > 30).map(l => l.dashes / (l.secs / 60))), 1)}`);
    const first = k => { const v = lives.filter(l => l[k] !== undefined).map(l => l[k]); return `${mins(median(v))} min (${(v.length / lives.length * 100).toFixed(0)}% of lives)`; };
    console.log(`  first Fractured (<40): ${first("fractAt")} | first Broken (<15): ${first("brokenAt")}`);
    console.log(`  sanity: ${fmt(mean(lives.map(l => l.lowSanity)) * 100, 0)}% of life spent below 40 | median sanity at end ${fmt(median(lives.map(l => l.sanityAtEnd)), 0)}`);
    const per = (f) => mean(lives.filter(l => l.seconds > 30).map(l => f(l.books) / (l.seconds / 60)));
    const hitSources = {};
    for (const l of lives) for (const [k, v] of Object.entries(l.books.hits)) hitSources[k] = (hitSources[k] || 0) + v;
    const totalMin = lives.reduce((a, l) => a + l.seconds / 60, 0) || 1;
    console.log(`  sanity budget per minute: decay -${fmt(per(b => b.decay), 1)} | hits -${fmt(per(b => Object.values(b.hits).reduce((x, y) => x + y, 0)), 1)} (${Object.entries(hitSources).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${(v / totalMin).toFixed(1)}`).join(", ")}) | shards +${fmt(per(b => b.shards), 1)}`);
    const fights = lives.filter(l => l.boss && l.boss.defeated);
    if (lives.some(l => l.boss)) {
        console.log(`  boss fight: median ${fmt(median(fights.map(l => l.boss.defeated - l.boss.woke)), 0)} s | player took median ${fmt(median(fights.map(l => (l.boss.damage || 0) / (l.boss.maxHp || 1) * 100)), 0)}% of max flesh | unbeaten ${lives.filter(l => l.boss && !l.boss.defeated).length} (${lives.filter(l => l.boss && !l.boss.defeated && l.kind === "death").length} died to it)`);
    }
    const ids = {};
    for (const l of lives) for (const w of l.whispers) ids[w.id] = (ids[w.id] || 0) + 1;
    console.log(`  whispers by line: ${Object.entries(ids).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([k, v]) => `${k.replace("event_", "!").replace("habit_", "")} ${v}`).join(", ") || "-"}`);
    console.log(`  Watcher: ${(whispers / Math.max(1, lifeMin)).toFixed(2)} whispers per minute alive | Seal Mother woke in ${lives.filter(l => l.boss).length}/${lives.length} lives, beaten in ${lives.filter(l => l.boss && l.boss.defeated).length}`);
    console.log(`  Ledger: ${ownedPages.map(n => n + "/13").join(", ")} pages by the end; first reached at (min of life): ${Object.entries(pageAt).map(([k, v]) => `${k} ${mins(median(v))}`).join(", ") || "-"}`);
    return { name, deaths: deaths.length, hours };
}

export { Session, POLICIES };
if (import.meta.url !== `file://${process.argv[1]}`) { /* imported for inspection: do not run */ } else {
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const minutes = Number(arg("minutes", 120));
const seeds = Number(arg("seeds", 3));
const which = arg("policy", "all");
const names = which === "all" ? Object.keys(POLICIES) : [which];

const t0 = Date.now();
for (const name of names) {
    const sessions = [];
    for (let i = 0; i < seeds; i++) sessions.push(await play(name, 1000 + i * 17, minutes));
    report(name, sessions);
}
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s wall time)`);
}
