// Procedural WebAudio sound design. No audio files: every sound is synthesized.
//
// Routing:  sfx ─┐
//         music ─┼─> master ─> lowpass (sanity muffling) ─> destination
//       ambient ─┘
//
// Game code calls audioManager.play("event_name") for one-shots and
// audioManager.update({...}) once per frame to drive the ambient/music layers.

const SETTINGS_KEY = "the_marked_audio_settings";

function loadSettings() {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) return { muted: false, volume: 0.6, ...JSON.parse(raw) };
    } catch (e) { /* storage unavailable */ }
    return { muted: false, volume: 0.6 };
}

export class AudioManager {
    constructor() {
        this.ctx = null;
        this.initialized = false;
        this.settings = loadSettings();

        this.buses = {};
        this.layers = {};          // music layers keyed by event name (gameplay_tension, combat_music, ...)
        this.ambience = {};        // room_ambience, monolith_hum
        this.musicState = "silent";

        this.sanityLevel = 100;
        this.wasBroken = false;
        this.nextHeartbeat = 0;
        this.nextCombatBeat = 0;
        this.combatBeatIndex = 0;
        this.nextBossBeat = 0;
        this.noiseBuffer = null;
    }

    // ─── Setup ────────────────────────────────────────────────────────────

    init() {
        if (this.initialized) {
            this.resume();
            return;
        }
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            this.ctx = new Ctx();

            this.lowPassFilter = this.ctx.createBiquadFilter();
            this.lowPassFilter.type = "lowpass";
            this.lowPassFilter.frequency.value = 20000;
            this.lowPassFilter.connect(this.ctx.destination);

            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.lowPassFilter);
            this.applyVolume();

            this.buses.sfx = this.makeBus(0.9);
            this.buses.music = this.makeBus(0.45);
            this.buses.ambient = this.makeBus(0.55);

            // One shared second of white noise, reused by every noise-based sound.
            const len = this.ctx.sampleRate;
            this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const data = this.noiseBuffer.getChannelData(0);
            for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

            this.startAmbience();
            this.startMusicLayers();
            this.initialized = true;
        } catch (e) {
            console.warn("WebAudio API not supported", e);
        }
    }

    makeBus(level) {
        const g = this.ctx.createGain();
        g.gain.value = level;
        g.connect(this.masterGain);
        return g;
    }

    resume() {
        if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
    }

    applyVolume() {
        if (!this.masterGain) return;
        const target = this.settings.muted ? 0 : this.settings.volume;
        this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }

    saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
        } catch (e) { /* storage unavailable */ }
    }

    toggleMute() {
        this.settings.muted = !this.settings.muted;
        this.applyVolume();
        this.saveSettings();
        return this.settings.muted;
    }

    // ─── Primitive voices ─────────────────────────────────────────────────

    tone(freq, { type = "sine", dur = 0.2, gain = 0.3, slideTo = null, delay = 0, attack = 0.005, bus = "sfx", pan = 0 } = {}) {
        const t = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        this.route(g, bus, pan);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    noise({ dur = 0.2, filter = "bandpass", freq = 1000, q = 1, gain = 0.3, slideTo = null, delay = 0, attack = 0.005, bus = "sfx", pan = 0 } = {}) {
        const t = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        const f = this.ctx.createBiquadFilter();
        f.type = filter;
        f.frequency.setValueAtTime(freq, t);
        if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        f.Q.value = q;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f);
        f.connect(g);
        this.route(g, bus, pan);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.05);
    }

    route(node, bus, pan) {
        const dest = this.buses[bus] || this.buses.sfx;
        if (pan && this.ctx.createStereoPanner) {
            const p = this.ctx.createStereoPanner();
            p.pan.value = Math.max(-1, Math.min(1, pan));
            node.connect(p);
            p.connect(dest);
        } else {
            node.connect(dest);
        }
    }

    // ─── One-shot events ──────────────────────────────────────────────────

    play(event, opts = {}) {
        if (!this.ctx || this.settings.muted) return;
        this.resume();
        const recipe = SFX[event];
        if (!recipe) return;
        try {
            recipe(this, opts);
        } catch (e) { /* never let audio break the game loop */ }
    }

    // Backwards-compatible helpers
    playClick() { this.play("button_click"); }
    playHit() { this.play("hit_enemy"); }
    playDeath() { this.play("player_death"); }
    playLevelUp() { this.play("level_up"); }
    playWhisper() { this.play("whisper"); }

    // ─── Ambient bed ──────────────────────────────────────────────────────

    startAmbience() {
        // room_ambience: low drone + filtered air noise
        this.ambience.room_ambience = this.buses.ambient;
        this.ambientOsc = this.ctx.createOscillator();
        this.ambientOsc.type = "sine";
        this.ambientOsc.frequency.value = 55;
        const droneGain = this.ctx.createGain();
        droneGain.gain.value = 0.08;
        this.ambientOsc.connect(droneGain);
        droneGain.connect(this.buses.ambient);
        this.ambientOsc.start();

        const air = this.ctx.createBufferSource();
        air.buffer = this.noiseBuffer;
        air.loop = true;
        const airFilter = this.ctx.createBiquadFilter();
        airFilter.type = "lowpass";
        airFilter.frequency.value = 380;
        const airGain = this.ctx.createGain();
        airGain.gain.value = 0.05;
        air.connect(airFilter);
        airFilter.connect(airGain);
        airGain.connect(this.buses.ambient);
        air.start();

        // monolith_hum: sub-bass whose loudness follows Observation
        this.monolithOsc = this.ctx.createOscillator();
        this.monolithOsc.type = "triangle";
        this.monolithOsc.frequency.value = 36.7;
        this.monolithGain = this.ctx.createGain();
        this.monolithGain.gain.value = 0.0;
        this.monolithOsc.connect(this.monolithGain);
        this.monolithGain.connect(this.buses.ambient);
        this.monolithOsc.start();
        this.ambience.monolith_hum = this.monolithGain;
    }

    // ─── Music layers ─────────────────────────────────────────────────────

    startMusicLayers() {
        const pad = (freqs, type, detune) => {
            const g = this.ctx.createGain();
            g.gain.value = 0;
            const f = this.ctx.createBiquadFilter();
            f.type = "lowpass";
            f.frequency.value = 900;
            f.connect(g);
            g.connect(this.buses.music);
            for (const fr of freqs) {
                const o = this.ctx.createOscillator();
                o.type = type;
                o.frequency.value = fr;
                o.detune.value = (Math.random() - 0.5) * detune;
                o.connect(f);
                o.start();
            }
            return g;
        };
        // gameplay_tension: minor-second cluster, title_music: hollow fifth
        this.layers.gameplay_tension = pad([73.4, 77.8, 110], "sawtooth", 14);
        this.layers.title_music = pad([65.4, 98, 130.8], "triangle", 8);
        // combat_music and boss_encounter are rhythmic: gain nodes for scheduled hits
        this.layers.combat_music = this.ctx.createGain();
        this.layers.combat_music.gain.value = 0;
        this.layers.combat_music.connect(this.buses.music);
        this.layers.boss_encounter = this.ctx.createGain();
        this.layers.boss_encounter.gain.value = 0;
        this.layers.boss_encounter.connect(this.buses.music);
        this.layers.boss_pad = pad([55, 58.3, 82.4], "square", 20);
    }

    // Crossfade between music states: "title" | "gameplay" | "combat" | "boss" | "silent"
    setMusicState(state) {
        if (!this.ctx || state === this.musicState) return;
        this.musicState = state;
        const fade = 2.5; // seconds (crossfade time constant ~ fade / 3)
        const levels = {
            title:    { title_music: 0.22, gameplay_tension: 0,    combat_music: 0,   boss_encounter: 0,   boss_pad: 0 },
            gameplay: { title_music: 0,    gameplay_tension: 0.10, combat_music: 0,   boss_encounter: 0,   boss_pad: 0 },
            combat:   { title_music: 0,    gameplay_tension: 0.12, combat_music: 0.8, boss_encounter: 0,   boss_pad: 0 },
            boss:     { title_music: 0,    gameplay_tension: 0.05, combat_music: 0.4, boss_encounter: 1.0, boss_pad: 0.10 },
            silent:   { title_music: 0,    gameplay_tension: 0,    combat_music: 0,   boss_encounter: 0,   boss_pad: 0 }
        }[state] || {};
        const t = this.ctx.currentTime;
        for (const [name, level] of Object.entries(levels)) {
            const layer = this.layers[name];
            if (!layer) continue;
            layer.gain.cancelScheduledValues(t);
            layer.gain.setTargetAtTime(level, t, fade / 3);
        }
    }

    // ─── Per-frame driver ─────────────────────────────────────────────────

    update({ sanity = 100, observation = 0, enemiesNear = 0, bossActive = false } = {}) {
        if (!this.ctx) return;
        this.updateSanity(sanity);

        const t = this.ctx.currentTime;
        this.monolithGain.gain.setTargetAtTime(0.02 + (observation / 100) * 0.16, t, 0.5);
        this.monolithOsc.frequency.setTargetAtTime(36.7 + (observation / 100) * 4, t, 0.5);

        this.setMusicState(bossActive ? "boss" : enemiesNear > 0 ? "combat" : "gameplay");

        // combat_music: low pulse in 6/8
        if (this.layers.combat_music.gain.value > 0.01 && t >= this.nextCombatBeat) {
            const accent = this.combatBeatIndex % 3 === 0;
            this.pulse(this.layers.combat_music, accent ? 62 : 49, accent ? 0.5 : 0.25);
            this.combatBeatIndex++;
            this.nextCombatBeat = t + 0.22;
        }
        // boss_encounter: heavy taiko-like hits
        if (this.layers.boss_encounter.gain.value > 0.01 && t >= this.nextBossBeat) {
            this.pulse(this.layers.boss_encounter, 41, 0.7);
            this.nextBossBeat = t + 0.66;
        }

        // sanity_drain: heartbeat that speeds up as sanity falls
        if (sanity < 45 && t >= this.nextHeartbeat) {
            const severity = 1 - sanity / 45;
            this.play("sanity_drain", { severity });
            this.nextHeartbeat = t + 1.1 - severity * 0.55;
        }

        // candle_flicker: rare soft crackles
        if (Math.random() < 0.004) this.play("candle_flicker");
    }

    pulse(dest, freq, gain) {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(freq * 2, t);
        o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        o.connect(g);
        g.connect(dest);
        o.start(t);
        o.stop(t + 0.4);
    }

    updateSanity(sanity) {
        this.sanityLevel = sanity;
        if (!this.ctx || !this.ambientOsc) return;
        const n = Math.max(0, Math.min(100, sanity)) / 100;
        const t = this.ctx.currentTime;

        this.ambientOsc.frequency.setTargetAtTime(55 + (1 - n) * 15, t, 0.3);
        // Muffle everything as sanity drops (underwater feeling)
        this.lowPassFilter.frequency.setTargetAtTime(600 + 19400 * n * n, t, 0.3);

        if (sanity < 15 && !this.wasBroken) {
            this.wasBroken = true;
            this.play("sanity_broken");
        } else if (sanity > 25) {
            this.wasBroken = false;
        }

        if (sanity < 40 && Math.random() < 0.003 * (1 - n)) {
            this.play("whisper");
        }
    }
}

// ─── Sound recipes, keyed by event name ─────────────────────────────────────

const SFX = {
    // Combat
    hit_player: (a) => {
        a.tone(140, { type: "sawtooth", dur: 0.22, gain: 0.45, slideTo: 45 });
        a.noise({ dur: 0.12, filter: "lowpass", freq: 900, gain: 0.35 });
    },
    hit_enemy: (a, o) => {
        a.noise({ dur: 0.09, filter: "bandpass", freq: 1800 + Math.random() * 600, q: 1.5, gain: 0.25, pan: o.pan });
        a.tone(220 + Math.random() * 40, { type: "triangle", dur: 0.1, gain: 0.18, slideTo: 90, pan: o.pan });
    },
    crit_hit: (a, o) => {
        a.noise({ dur: 0.18, filter: "bandpass", freq: 2600, q: 2, gain: 0.35, pan: o.pan });
        a.tone(520, { type: "square", dur: 0.25, gain: 0.16, slideTo: 130, pan: o.pan });
        a.tone(1040, { type: "sine", dur: 0.35, gain: 0.08, delay: 0.02, pan: o.pan });
    },
    enemy_death: (a, o) => {
        a.noise({ dur: 0.45, filter: "lowpass", freq: 1600, slideTo: 120, gain: 0.3, pan: o.pan });
        a.tone(180, { type: "sawtooth", dur: 0.4, gain: 0.15, slideTo: 40, pan: o.pan });
    },
    attack_swing: (a) => {
        a.noise({ dur: 0.14, filter: "bandpass", freq: 700, slideTo: 2400, q: 0.8, gain: 0.12, attack: 0.03 });
    },
    projectile_fire: (a, o) => {
        a.tone(900, { type: "square", dur: 0.12, gain: 0.07, slideTo: 300, pan: o.pan });
    },
    dash: (a) => {
        a.noise({ dur: 0.2, filter: "highpass", freq: 1200, slideTo: 300, gain: 0.14, attack: 0.02 });
    },
    player_death: (a) => {
        a.tone(110, { type: "square", dur: 1.6, gain: 0.35, slideTo: 18 });
        a.noise({ dur: 1.4, filter: "lowpass", freq: 2000, slideTo: 60, gain: 0.3 });
        SFX.death_sting(a);
    },
    death_sting: (a) => {
        // Dissonant tritone stab followed by a falling cluster
        a.tone(146.8, { type: "sawtooth", dur: 2.4, gain: 0.18, attack: 0.02, bus: "music" });
        a.tone(207.6, { type: "sawtooth", dur: 2.4, gain: 0.14, attack: 0.02, bus: "music" });
        a.tone(311, { type: "triangle", dur: 2.0, gain: 0.1, slideTo: 150, delay: 0.3, bus: "music" });
    },

    // UI
    button_click: (a) => {
        a.tone(800, { type: "triangle", dur: 0.08, gain: 0.18, slideTo: 300 });
    },
    tab_switch: (a) => {
        a.noise({ dur: 0.16, filter: "bandpass", freq: 3200, q: 0.7, gain: 0.1, attack: 0.04 });
    },
    equip_item: (a) => {
        a.tone(330, { type: "triangle", dur: 0.12, gain: 0.2 });
        a.tone(495, { type: "triangle", dur: 0.18, gain: 0.16, delay: 0.07 });
        a.noise({ dur: 0.08, filter: "highpass", freq: 3000, gain: 0.12 });
    },
    unequip_item: (a) => {
        a.tone(495, { type: "triangle", dur: 0.1, gain: 0.15 });
        a.tone(330, { type: "triangle", dur: 0.14, gain: 0.12, delay: 0.06 });
    },
    upgrade_purchase: (a) => {
        [196, 293.7, 392, 587.3].forEach((f, i) =>
            a.tone(f, { type: "sine", dur: 0.9 - i * 0.1, gain: 0.18, delay: i * 0.06, attack: 0.02 }));
        a.tone(49, { type: "sine", dur: 1.2, gain: 0.3 });
    },
    error_sound: (a) => {
        a.tone(110, { type: "square", dur: 0.18, gain: 0.12 });
        a.tone(104, { type: "square", dur: 0.18, gain: 0.12, delay: 0.09 });
    },
    interact_prompt: (a) => {
        a.tone(660, { type: "sine", dur: 0.25, gain: 0.05, attack: 0.05 });
    },
    level_up: (a) => {
        [440, 554.4, 659.3, 880].forEach((f, i) =>
            a.tone(f, { type: "sine", dur: 0.6, gain: 0.22, delay: i * 0.12, attack: 0.01 }));
        a.tone(220, { type: "triangle", dur: 1.4, gain: 0.15, delay: 0.36 });
    },

    // Systems
    sanity_drain: (a, o) => {
        const sev = o.severity || 0;
        a.tone(58, { type: "sine", dur: 0.16, gain: 0.25 + sev * 0.3, slideTo: 40 });
        a.tone(52, { type: "sine", dur: 0.18, gain: 0.18 + sev * 0.25, slideTo: 36, delay: 0.18 });
    },
    sanity_broken: (a) => {
        a.noise({ dur: 1.2, filter: "bandpass", freq: 4000, slideTo: 300, q: 4, gain: 0.35 });
        a.tone(1760, { type: "sawtooth", dur: 0.9, gain: 0.08, slideTo: 1600 });
        a.tone(1865, { type: "sawtooth", dur: 0.9, gain: 0.08, slideTo: 1700 });
    },
    sanity_recover: (a) => {
        a.tone(392, { type: "sine", dur: 0.9, gain: 0.14, attack: 0.1 });
        a.tone(587.3, { type: "sine", dur: 1.1, gain: 0.1, delay: 0.15, attack: 0.1 });
    },
    observation_increase: (a) => {
        a.tone(73.4, { type: "sine", dur: 1.5, gain: 0.12, attack: 0.5 });
    },
    observation_threshold: (a, o) => {
        // Deeper and longer per tier: Noticed(1) → Known(4)
        const tier = o.tier || 1;
        a.tone(98 / tier, { type: "sawtooth", dur: 1.5 + tier * 0.4, gain: 0.2, attack: 0.05 });
        a.tone(98 / tier * 1.414, { type: "sine", dur: 1.5 + tier * 0.4, gain: 0.12, attack: 0.3 });
        a.noise({ dur: 1.2, filter: "lowpass", freq: 300, gain: 0.25, attack: 0.2 });
    },
    ritual_perform: (a, o) => {
        if (o.kind === "static_comm") {
            a.noise({ dur: 0.8, filter: "bandpass", freq: 2200, slideTo: 900, q: 3, gain: 0.25 });
        } else {
            a.noise({ dur: 0.5, filter: "lowpass", freq: 700, slideTo: 150, gain: 0.35 });
        }
        a.tone(130.8, { type: "sawtooth", dur: 1.4, gain: 0.15, attack: 0.05 });
        a.tone(185, { type: "sawtooth", dur: 1.4, gain: 0.12, attack: 0.05 });
    },
    ritual_fail: (a) => {
        a.tone(82, { type: "square", dur: 0.4, gain: 0.2, slideTo: 60 });
        a.noise({ dur: 0.25, filter: "lowpass", freq: 400, gain: 0.2 });
    },
    signal_decode: (a) => {
        a.noise({ dur: 0.5, filter: "bandpass", freq: 3000, slideTo: 1000, q: 5, gain: 0.2 });
        a.tone(1000, { type: "sine", dur: 0.3, gain: 0.1, delay: 0.45 });
    },
    corpse_interact: (a, o) => {
        if (o.kind === "burn") a.noise({ dur: 1.0, filter: "highpass", freq: 1500, gain: 0.18, attack: 0.1 });
        else if (o.kind === "devour") a.noise({ dur: 0.3, filter: "lowpass", freq: 500, gain: 0.35 });
        else if (o.kind === "broadcast") SFX.signal_decode(a);
        else a.tone(98, { type: "triangle", dur: 0.6, gain: 0.25, slideTo: 60 });
    },
    corpse_spawn: (a) => {
        a.tone(55, { type: "sine", dur: 0.6, gain: 0.4, slideTo: 30 });
    },
    loot_pickup: (a, o) => {
        const rare = o.rare;
        a.tone(rare ? 880 : 1320, { type: "triangle", dur: 0.12, gain: 0.14 });
        a.tone(rare ? 1320 : 1760, { type: "triangle", dur: 0.18, gain: 0.1, delay: 0.05 });
        if (rare) a.tone(1760, { type: "sine", dur: 0.6, gain: 0.1, delay: 0.12 });
    },
    whisper: (a) => {
        a.noise({ dur: 0.5 + Math.random() * 0.5, filter: "bandpass", freq: 1000 + Math.random() * 2000, q: 2, gain: 0.15, attack: 0.1, pan: Math.random() * 2 - 1, bus: "ambient" });
    },

    // Ambient
    candle_flicker: (a) => {
        a.noise({ dur: 0.05, filter: "highpass", freq: 4000, gain: 0.04, pan: Math.random() * 2 - 1, bus: "ambient" });
    },

    // Boss
    boss_spawn: (a) => {
        a.tone(41, { type: "sawtooth", dur: 3.0, gain: 0.35, attack: 0.4 });
        a.tone(43.6, { type: "sawtooth", dur: 3.0, gain: 0.3, attack: 0.4 });
        a.noise({ dur: 2.5, filter: "lowpass", freq: 200, slideTo: 1200, gain: 0.3, attack: 0.8 });
    },
    boss_attack: (a) => {
        a.tone(70, { type: "square", dur: 0.4, gain: 0.35, slideTo: 30 });
        a.noise({ dur: 0.3, filter: "lowpass", freq: 600, gain: 0.35 });
    },
    boss_defeated: (a) => {
        [130.8, 196, 261.6, 392, 523.3].forEach((f, i) =>
            a.tone(f, { type: "triangle", dur: 2.0, gain: 0.16, delay: i * 0.15, attack: 0.05, bus: "music" }));
    },
    wax_trap: (a) => {
        a.tone(300, { type: "sine", dur: 0.5, gain: 0.08, slideTo: 600, attack: 0.2 });
    },
    wax_trap_trigger: (a) => {
        a.noise({ dur: 0.35, filter: "lowpass", freq: 900, gain: 0.4 });
        a.tone(90, { type: "square", dur: 0.3, gain: 0.25, slideTo: 40 });
    },
    victory: (a) => {
        [261.6, 329.6, 392, 523.3].forEach((f, i) =>
            a.tone(f, { type: "sine", dur: 2.5, gain: 0.16, delay: i * 0.2, attack: 0.1, bus: "music" }));
    },
    idle_return_music: (a) => {
        a.tone(196, { type: "sine", dur: 1.6, gain: 0.14, attack: 0.3 });
        a.tone(246.9, { type: "sine", dur: 1.6, gain: 0.1, delay: 0.3, attack: 0.3 });
    },
    title_music: (a) => {
        a.setMusicState("title");
    }
};

export const audioManager = new AudioManager();
