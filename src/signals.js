// The signal feed (GDD 13): transmissions intercepted from the Monolith, the Watcher, the dead and the room.
//
// An entry is either a typed record { type, text, t, ... } or a legacy plain string from older saves and from the
// many one-line log messages ("Collected Satchel..."); legacy strings are typed by their prefix when read.

export const SIGNAL_LOG_LIMIT = 80;

export const SIGNAL_TYPES = {
    watcher: { label: "Watcher", blurb: "Remarks on what you have done." },
    memory: { label: "Memory", blurb: "Fragments of what the Keeping House was." },
    warning: { label: "Warning", blurb: "Hints about what is coming." },
    corpse: { label: "Corpse", blurb: "Transmissions from the dead." },
    ritual: { label: "Ritual", blurb: "What the bargains hide." },
    log: { label: "Log", blurb: "Everything else that happened." }
};

export const TRANSMISSION_TYPES = ["watcher", "memory", "warning", "corpse", "ritual"];

export function addSignal(profile, text, type = "log", extra = {}) {
    profile.signals.unshift({ type, text, t: Date.now(), ...extra });
    if (profile.signals.length > SIGNAL_LOG_LIMIT) profile.signals.length = SIGNAL_LOG_LIMIT;
}

export function signalText(entry) {
    return typeof entry === "string" ? entry : entry.text;
}

export function signalType(entry) {
    if (typeof entry !== "string") return entry.type || "log";
    if (/^(Watcher|Intercepted Broadcast)/.test(entry) && !/^Watcher Confrontation/.test(entry)) return /^Watcher/.test(entry) ? "watcher" : "memory";
    if (/^Watcher Confrontation/.test(entry)) return "watcher";
    if (/^Memory Signal/.test(entry) || /^\[Decoded Comm\] Memory/.test(entry)) return "memory";
    if (/^Warning Signal/.test(entry) || /^\[Decoded Comm\] Warning/.test(entry)) return "warning";
    if (/^Corpse (Broadcasted|Burned|Devoured|Recovered)/.test(entry)) return "corpse";
    return "log";
}
