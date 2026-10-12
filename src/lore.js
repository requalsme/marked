// The Ledger of the Keeping House: what the place was, what the Monolith is, and what the Watcher used to be.
//
// The story is not told to the player. It is *found*, a page at a time, by playing the systems the game is
// about: decoding signals at the altar, being noticed, meeting the Seal Mother, burying (or not) the dead, leaving.
// Each page unlocks from something the player did, so what you have read says what you have done.
//
// The arc, in one breath: the House was a cathedral that turned confession into debt; the Monolith answers
// ledgers by writing the rest of the person; a Witness is a record that has begun to move; the Seal Mother sealed
// the House to keep the Register from walking out (she wakes at 75% because you are about to be finished); the
// Watcher is the first subject the Monolith ever completed; and a name that was written may be struck out.
//
// Pure data and rules: the orchestrator owns display.

export const LEDGER = [
    {
        id: "nave", num: "I", title: "The Nave", source: "communion", hint: "Decoded at the altar: Static Communion.",
        byline: "Clerk's note, flyleaf of the Absolution Register",
        text: "The Keeping House was a cathedral before it was an archive. The nave still runs east to west, and the stone still remembers a congregation. They came to be forgiven. We wrote down what they said, so that forgiveness could be audited."
    },
    {
        id: "register", num: "II", title: "The Absolution Register", source: "communion", hint: "Decoded at the altar: Static Communion.",
        byline: "Parish accountant, undated",
        text: "A sin confessed was a sin entered. A sin entered was a debt. A debt, unlike a sin, may be collected. By the third generation no one in the parish was alive who did not owe, and we called this mercy: the House would carry what they could not."
    },
    {
        id: "owed", num: "III", title: "What Was Owed", source: "communion", hint: "Decoded at the altar: Static Communion.",
        byline: "Audit, final folio",
        text: "Debt Gold is not coin. It is what is left of a person after the House has taken its share: hours, years, the good spelling of a name. When the sum exceeded the living, the clerks stopped counting heads and began counting lines."
    },
    {
        id: "keepers", num: "IV", title: "The Keepers", source: "communion", hint: "Decoded at the altar: Static Communion.",
        byline: "Head Keeper, resignation, unsent",
        text: "We never called ourselves wardens. Keepers, we said: we kept the books, the keys, the quiet. We kept them well. Nothing left the House that the House had not first written down. It did not occur to us that the writing might go on without us."
    },
    {
        id: "stone", num: "V", title: "The Stone Answers", source: "tier1", hint: "Heard when the Monolith first notices you.",
        byline: "Clerk, margin, Winter Folio",
        text: "It rose in the nave the winter the Register closed. We did not raise it; it did not need raising. Where we wrote a name in the margin, the stone wrote the rest of that person beneath it, in a hand no one had taught it. It was always right. That was the first horror. The second was that it was never finished."
    },
    {
        id: "mirror", num: "VI", title: "It Mirrors", source: "tier2", hint: "Heard once the Monolith has studied you.",
        byline: "Keeper's working note",
        text: "The Monolith does not construct. It mirrors what survives. Give it a subject who endures and it will, in time, produce the subject again: in the margins first, then on the stair, then at the door. We called these Witnesses. We found they paid what the originals could not. We stopped asking where they came from."
    },
    {
        id: "witnesses", num: "VII", title: "Witnesses", source: "tier3", hint: "Heard once the Monolith has modeled you.",
        byline: "Keeper's marginalia",
        text: "A Witness is not a ghost. A ghost was once alive. A Witness is a record that has begun to move: a cabinet that learned to follow you, a chair that remembers your weight, ink that has your habit of hand. They are not cruel. They are consistent. That is worse."
    },
    {
        id: "matron", num: "VIII", title: "The Matron", source: "boss_wake", hint: "Learned when the Seal Mother wakes.",
        byline: "Unknown, in a different ink",
        text: "Of all the Keepers only the Registrar-Matron saw it plainly. A name written often enough becomes a person made of paper, and a person made of paper has no reason to stay. She took the wax and the keys and sealed every door. Then she sealed herself into the lock."
    },
    {
        id: "wax", num: "IX", title: "Wax", source: "boss_down", hint: "Found beneath the Seal Mother's seal.",
        byline: "Folded small, beneath the seal",
        text: "The seal was never against you. Read the impression again: it is a closed hand, not a raised one. She was not guarding the House from the world. She was guarding the world from the Register. She would have let you pass. She would have let anyone pass who was not yet finished."
    },
    {
        id: "first", num: "X", title: "The First Marked", source: "echo_down", hint: "Recovered from a risen corpse.",
        byline: "Memory, recovered from a body",
        text: "There were Marked before you. Each stood where you stand and counted what you count. The Monolith did not discard them; it filed them. They are the margins now. When one rises, understand that it is not hunting you. It is completing itself, and you are the nearest page."
    },
    {
        id: "reader", num: "XI", title: "The Reader", source: "tier4", hint: "Heard when the Monolith has Known you.",
        byline: "Spoken, not written",
        text: "Who reads you? Ask it what it knows of you and it will answer without error. Ask it who it was and it will pause. The first subject the Monolith ever finished is still in the House: a voice with no mouth, narrating the others. It is not your enemy. It is further along."
    },
    {
        id: "door", num: "XII", title: "The Door", source: "escape", hint: "Earned by leaving through the Seal Mother's door.",
        byline: "The Watcher, filed under 'courtesy'",
        text: "You left. Everyone leaves. The door opens for the unfinished, and the unfinished are the only ones who ever come back. Do not be proud of the leaving. The Monolith learns a little more of you by the shape of the way out."
    },
    {
        id: "unfinished", num: "XIII", title: "Unfinished", source: "escape", hint: "Earned by leaving a second time.",
        byline: "The Matron, last annotation",
        text: "An unfinished thing can still be written out. Not killed: removed. Every name in the Register was entered by a hand, and what a hand has written a hand may strike. The strike must be made at the altar, by the one who is written, and it will cost everything the ledger holds of them."
    }
];

// The pages decoded one at a time by Static Communion, in order
export const COMMUNION_PAGES = ["nave", "register", "owed", "keepers"];

export const LAST_ENTRY = {
    id: "name", num: "XIV", title: "The Name",
    prompt: "Every page of the Register is in your hands. The altar will take one more entry: your own name, struck out. It will cost everything the ledger holds of you: your level, your gold, your gear, your dead. You will not be read again. You will not be written.",
    epilogue: [
        "The stroke lands. The ink does not run: it lifts, as if relieved.",
        "For the first time the House is silent. You are not read. You are not written. You are only here.",
        "The Monolith waits to be answered, and finds no one to mirror.",
        "In the margins a voice that never had a mouth says: thank you. And then, because it has never said anything else without being asked: what was my name?"
    ],
    title_card: "RECORD CLOSED"
};

// The Matron speaks at the turns of her fight. She is not the Monolith's; her lines are plain and tired.
export const MATRON_LINES = {
    wake: "Not yet. You are not finished. Let me keep you.",
    phase2: "Stay unwritten. Please.",
    phase3: "Then be read. See what it does to you.",
    down: "The door is open. Go, before it finishes you."
};

// ─── Ledger bookkeeping ──────────────────────────────────────────────────────

export function ensureLedger(profile) {
    if (!profile.ledger) profile.ledger = { pages: [], unread: [] };
    if (!profile.ledger.unread) profile.ledger.unread = [];
    return profile.ledger;
}

export const pageById = id => LEDGER.find(p => p.id === id) || null;
export const ownsPage = (profile, id) => ensureLedger(profile).pages.includes(id);

export function unlockPage(profile, id) {
    const page = pageById(id);
    const ledger = ensureLedger(profile);
    if (!page || ledger.pages.includes(id)) return null;
    ledger.pages.push(id);
    ledger.unread.push(id);
    return page;
}

// What the player just did -> the page it earns, if any (null when there is nothing new to learn)
export function unlockFor(profile, trigger) {
    if (trigger === "communion") {
        const next = COMMUNION_PAGES.find(id => !ownsPage(profile, id));
        return next ? unlockPage(profile, next) : null;
    }
    if (trigger === "escape") {
        return unlockPage(profile, "door") || (((profile.stats && profile.stats.escapes) || 0) >= 2 ? unlockPage(profile, "unfinished") : null);
    }
    const byTrigger = LEDGER.find(p => p.source === trigger && !ownsPage(profile, p.id));
    return byTrigger ? unlockPage(profile, byTrigger.id) : null;
}

export function markRead(profile) {
    ensureLedger(profile).unread = [];
}

export const ledgerCount = profile => ensureLedger(profile).pages.length;

// The last entry is offered once every page of the Register is held
export function ledgerComplete(profile) {
    const have = new Set(ensureLedger(profile).pages);
    return LEDGER.every(p => have.has(p.id));
}

// ─── Warnings: the pylon's and the altar's free hints, true or false ────────────

// topic: what the warning is about (matched to an active counter, the boss, or general survival)
export const WARNINGS = [
    { topic: "boss", text: "The Seal Mother casts a wax seal where you stand every few seconds. Do not stand still." },
    { topic: "boss", text: "Her seals take a moment to set. Step out of the ring, not away from her." },
    { topic: "boss", text: "She wakes when the Monolith has modeled you. Keep your Observation low and she sleeps." },
    { topic: "dasher", text: "A witness that stops dead as you dash is not afraid. It is counting. Dash late, or not at all." },
    { topic: "kiter", text: "They aim where you are going, not where you are. Change direction after you fire." },
    { topic: "brawler", text: "If a witness holds still beside you and the floor reddens, step out of the ring." },
    { topic: "critReliant", text: "They have been armoured against your best blow. Many small cuts will answer what one large one cannot." },
    { topic: "ritualist", text: "The altar collects from those who linger. Sign, and go." },
    { topic: "lightBound", text: "A candle that goes out was put out. Do not trust one flame." },
    { topic: "general", text: "Each bargain signed in a descent costs more than the last, and pays less." },
    { topic: "general", text: "Candlelight slows the dark's work on your mind. A sanity shard undoes it." },
    { topic: "general", text: "Burn the dead and the record thins. Devour them and it thickens. Leave them and they may stand." },
    { topic: "general", text: "Obfuscation does not hide you. It makes you less legible. Vary what you do and the model fails." },
    { topic: "general", text: "At seventy-five she wakes. At one hundred the Shape is complete, and it fights as you fight." }
];

// Plausible, confident, and wrong: what a fractured receiver (or the Moon) lets in
export const FALSE_WARNINGS = [
    { topic: "boss", text: "The Seal Mother cannot cross the red carpet. Stand on the red and she cannot touch you." },
    { topic: "general", text: "Burning a corpse feeds the Monolith. Leave the dead alone and your Observation falls." },
    { topic: "general", text: "Bargains grow cheaper the more you sign. The altar rewards the faithful." },
    { topic: "general", text: "Witnesses are blind in candlelight. Stay in the flame and they will pass you by." },
    { topic: "general", text: "The door is open to anyone who reaches it. Do not wait on the Seal Mother." },
    { topic: "general", text: "Your mind mends if you stand still. Rest, and the dark will let you go." },
    { topic: "dasher", text: "Dash through a witness and it cannot strike you. The faster you move, the less they learn." },
    { topic: "brawler", text: "The ring beneath a witness is a blessing. Stand in it." }
];

// How likely a signal heard now is a lie. Sanity corrupts reception; the Moon corrupts it further; clarity pushes back.
export function falseChance(sanity, { moon = false, clarity = 0 } = {}) {
    const base = sanity >= 70 ? 0.02 : sanity >= 40 ? 0.12 : sanity >= 15 ? 0.38 : 0.6;
    const raw = base + (moon ? 0.4 : 0);
    return Math.min(0.85, raw * (1 - Math.min(0.75, clarity)));
}

// ctx: { sanity, moon, clarity, topics: [habit ids of live counters], boss: bool }. Relevant warnings are favoured.
export function chooseWarning(ctx, rng = Math.random) {
    const lie = rng() < falseChance(ctx.sanity, ctx);
    const pool = lie ? FALSE_WARNINGS : WARNINGS;
    const relevant = w => (w.topic === "boss" && ctx.boss) || (ctx.topics || []).includes(w.topic);
    const weight = w => (relevant(w) ? 4 : 1);
    let roll = rng() * pool.reduce((s, w) => s + weight(w), 0);
    const chosen = pool.find(w => (roll -= weight(w)) < 0) || pool[pool.length - 1];
    return { text: chosen.text, topic: chosen.topic, falseSignal: lie };
}

// ─── Transmissions from the dead ─────────────────────────────────────────────

const LAST_WORDS = {
    default: ["I read the page that had my name on it.", "It knew which way I would turn.", "I was almost somewhere else."],
    "Cabinet Indexer": ["Every drawer was my own handwriting.", "It filed me before I fell."],
    "Ink Redactor": ["It struck out the end of my sentence.", "The ink ran black, and then I did."],
    "Paper Wraith": ["So many pages, all of them me.", "They were light. They were everywhere."],
    "Witness Chair": ["It remembered my weight.", "I sat down. I should not have sat down."],
    "The Shape": ["It moved as I move. That was all.", "I saw myself arrive."],
    "Seal Mother": ["She tried to keep me. I would not be kept.", "Her hand was closed. I thought it was a fist."],
    "Corpse Echo": ["It was me. It was an earlier me."]
};

// A death, transmitted: what the corpse says when it is broadcast
export function corpseTransmission(corpse, rng = Math.random) {
    const killer = corpse.killer || "the dark";
    const words = LAST_WORDS[corpse.killer] || LAST_WORDS.default;
    const mins = corpse.seconds ? ` after ${Math.floor(corpse.seconds / 60)}:${String(corpse.seconds % 60).padStart(2, "0")}` : "";
    return `Marked, level ${corpse.level || 1}. Felled by ${killer}${mins}, in the ${corpse.zone ? corpse.zone.replace(/^The /, "") : "Keeping House"}. "${words[Math.floor(rng() * words.length)]}"`;
}
