// src/lib/nex/brain/_corpus-address-indonesia-audit.test.ts
//
// Corpus ADDRESS-INDONESIA · AUDIT-ONLY (Philip 2026-09-01).
//
// CONSTITUTIONAL RULE (Philip's exact framing):
//   "Address words must NEVER become intent/refinement/reference/
//    abandonment signals merely because they occur in the sentence."
//
// This audit tests that Indonesian address terms (Pak · Bapak · Bu ·
// Ibu · Mas · Mbak · Kak · Bang · Dek · Dik · Om · Tante) do NOT
// contaminate the existing detectors. Address-prefixed sentences
// must still route to the SAME intent as their address-less form.
//
// Also tests:
//   · Time greetings (siang · pagi · sore · malam) do NOT trigger
//     any intent
//   · NEX must never infer gender/age from names — we audit the
//     detector behaviour, not the address selection engine (which
//     doesn't exist yet · see doctrine pin
//     `doctrine_indonesian_address_and_profile_2026_09_01.md`)
//
// NO PRODUCTION DETECTOR FOR ADDRESS BUILT YET. Audit-only.
// Fixes only applied if the audit exposes real defects, and each
// fix ships with BOTH the defect + nearest false-positive neighbour
// as regression tests (per the constitutional doctrine).

import { describe, expect, it } from "vitest";
import { detectAbandonment } from "./abandonment-detector";
import { detectRefinement } from "./refinement-detector";
import { detectEntityFollowup } from "./entity-followup-detector";
import { extractEntities } from "./entities";

// ═══════════════════════════════════════════════════════════════════
// PART 1 · Address-only forms (no intent · must fire nothing)
// ═══════════════════════════════════════════════════════════════════

const ADDRESS_BARE = [
  "Pak", "Pak.", "Pak?", "Pak,",
  "Bapak", "Bapak.",
  "Bu", "Bu.", "Bu?", "Bu,",
  "Ibu", "Ibu.",
  "Mas", "Mas.", "Mas?", "Mas,",
  "Mbak", "Mbak.", "Mbak,",
  "Kak", "Kak.", "Kak,",
  "Bang", "Bang.", "Bang,",
  "Dek", "Dik",
  "Om", "Tante",
  // Address + name compounds
  "Mas Budi", "Pak Andi", "Bu Rina", "Mbak Sari", "Kak Ahmad",
  "Bang Deni", "Pak Ahmad Rizky", "Ibu Siti", "Om Joko", "Tante Maya",
];

describe("Corpus ADDRESS-INDONESIA · Part 1 · bare address forms fire nothing", () => {
  it.each(ADDRESS_BARE)("'%s' fires no abandonment / refinement / followup", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
    expect(detectEntityFollowup(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 2 · Time greetings (siang / pagi / sore / malam) fire nothing
// ═══════════════════════════════════════════════════════════════════
//
// Philip's explicit correction: siang/pagi/sore/malam are NOT address
// terms — they are time-of-day GREETINGS. "Selamat siang, Pak" is
// TIME GREETING + ADDRESS TERM.

const TIME_GREETINGS = [
  "Selamat pagi",
  "Selamat pagi, Pak",
  "Selamat pagi, Bu Rina",
  "Selamat siang",
  "Selamat siang, Mas",
  "Selamat siang, Mbak Sari",
  "Selamat sore",
  "Selamat sore, Kak Ahmad",
  "Selamat malam",
  "Selamat malam, Bang Deni",
  "Pagi Pak",
  "Siang Bu",
  "Sore Mas",
  "Malam Mbak",
];

describe("Corpus ADDRESS-INDONESIA · Part 2 · time greetings fire nothing", () => {
  it.each(TIME_GREETINGS)("'%s' fires no abandonment / refinement / followup", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
    expect(detectEntityFollowup(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 3 · Address + REFINEMENT · address must not corrupt classification
// ═══════════════════════════════════════════════════════════════════
//
// Philip's constitutional examples:
//   "Mas, yang lebih murah?"                    → ADDRESS + REFINEMENT (comparative)
//   "Bu, jangan yang third-party seller..."     → ADDRESS + REFINEMENT (exclude)
//   "Pak, yang direct flight aja"               → ADDRESS + REFINEMENT (require)

const ADDRESS_PLUS_REFINEMENT_POSITIVE: Array<{ msg: string; family: string }> = [
  { msg: "Mas, yang lebih murah?",                            family: "comparative" },
  { msg: "Pak, yang lebih murah",                             family: "comparative" },
  { msg: "Bu, yang paling murah dong",                        family: "comparative" },
  { msg: "Mbak, yang termurah aja",                           family: "comparative" },
  { msg: "Kak, yang direct flight",                           family: "require" },
  { msg: "Pak, yang direct flight aja",                       family: "require" },
  { msg: "Bu, yang recommended aja",                          family: "require" },
  { msg: "Mas, yang nearest",                                 family: "require" },
  { msg: "Bu, jangan yang third-party seller, official brand aja", family: "exclude" },
  { msg: "Pak, jangan yang boutique hotel, bintang 5 aja",    family: "exclude" },
  { msg: "Mbak, jangan yang non-refundable, berisiko",        family: "exclude" },
  { msg: "Mas, gak usah pake paylater, cash aja",             family: "swap" },
  { msg: "Pak, gak usah pake bathtub, shower aja",            family: "swap" },
  { msg: "Bu, yang rating-nya below 4.5 skip",                family: "skip_by_attribute" },
];

describe("Corpus ADDRESS-INDONESIA · Part 3 · address prefix preserves refinement", () => {
  it.each(ADDRESS_PLUS_REFINEMENT_POSITIVE)(
    "'$msg' fires refinement / $family (address doesn't block)",
    ({ msg, family }) => {
      const r = detectRefinement(msg);
      expect(r.matched).toBe(true);
      if (r.matched) expect(r.family).toBe(family);
      // Address must not sneak into abandonment
      expect(detectAbandonment(msg).matched).toBe(false);
    },
  );
});

// ═══════════════════════════════════════════════════════════════════
// PART 4 · Address + ABANDONMENT · address must not block abandonment
// ═══════════════════════════════════════════════════════════════════
//
// Philip's constitutional example:
//   "Pak, cancel aja booking ini." → ADDRESS + ACTION_SUB_CANCEL
//   Note: current detector treats "cancel aja" at clause start (after
//   comma) as abandonment — but "cancel aja booking ini" has content
//   AFTER "cancel aja" so the sub-action-cancel guard applies via
//   context. Let's audit and see.

const ADDRESS_PLUS_ABANDONMENT: Array<{ msg: string; expectAbandonment: boolean; note: string }> = [
  { msg: "Mas, gak jadi",                       expectAbandonment: true,  note: "gak jadi = true abandonment" },
  { msg: "Pak, lupakan",                        expectAbandonment: true,  note: "lupakan = true abandonment" },
  { msg: "Bu, cancel that",                     expectAbandonment: true,  note: "cancel that = abandonment" },
  { msg: "Kak, batalkan pesanan",               expectAbandonment: true,  note: "batalkan = abandonment" },
  { msg: "Mbak, forget it",                     expectAbandonment: true,  note: "forget it = abandonment" },
  { msg: "Mas, never mind",                     expectAbandonment: true,  note: "never mind = abandonment" },
  { msg: "Pak, gak jadi beli",                  expectAbandonment: true,  note: "gak jadi beli = abandonment" },
];

describe("Corpus ADDRESS-INDONESIA · Part 4 · address prefix preserves abandonment", () => {
  it.each(ADDRESS_PLUS_ABANDONMENT)("'$msg' → abandonment=$expectAbandonment ($note)", ({ msg, expectAbandonment }) => {
    expect(detectAbandonment(msg).matched).toBe(expectAbandonment);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 5 · Address + entity-followup · "Kak, apa lagi?" still fires
// ═══════════════════════════════════════════════════════════════════

const ADDRESS_PLUS_FOLLOWUP = [
  "Mas, apa lagi?",
  "Pak, apa lagi?",
  "Bu, apa lagi?",
  "Kak, apa lagi?",
  "Mbak, ada yang lain?",
  "Bang, yang lain ada?",
];

describe("Corpus ADDRESS-INDONESIA · Part 5 · address prefix preserves entity-followup", () => {
  it.each(ADDRESS_PLUS_FOLLOWUP)("'%s' fires entity-followup (address doesn't block)", (msg) => {
    expect(detectEntityFollowup(msg).matched).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 6 · Address + non-intent conversation · no false positives
// ═══════════════════════════════════════════════════════════════════
//
// Ordinary conversational exchanges prefixed with an address term
// must not fire any detector.

const ADDRESS_PLUS_CONVERSATION = [
  "Pak, terima kasih ya",
  "Bu, makasih banyak",
  "Mas, bisa bantu?",              // starts with "Mas" not "Bisa"
  "Mbak, apa kabar?",              // "apa kabar" greeting form
  "Kak, halo",
  "Bang, selamat siang",
  "Pak Ahmad, gimana kabarnya?",
  "Bu Rina, saya butuh saran",
  "Mas Budi, tolong dong",
  "Mas, can you help me?",         // mixed EN
  "Pak, do you have any recommendations?",  // mixed EN
];

describe("Corpus ADDRESS-INDONESIA · Part 6 · address + ordinary conversation · no intent fires", () => {
  it.each(ADDRESS_PLUS_CONVERSATION)("'%s' fires no abandonment / refinement / followup", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
    expect(detectEntityFollowup(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 7 · Address + question · question must remain question
// ═══════════════════════════════════════════════════════════════════
//
// AUDIT-CRITICAL: does the current interrogative-opener guard handle
// address-prefixed questions like "Mas, apa yang lebih murah?"
// (address + interrogative + refinement vocabulary)?
//
// Semantic: this is a QUESTION ("Mas, what's cheaper?"). It must NOT
// fire refinement. Since my guard anchors to `^\s*apa\b`, "Mas, apa"
// might slip through. This is exactly what audit-only reveals.

const ADDRESS_PLUS_QUESTION = [
  "Mas, apa yang lebih murah?",
  "Pak, apa yang paling murah?",
  "Bu, apa yang recommended?",
  "Mbak, what's the nearest one?",
  "Kak, where is the cheapest?",
  "Bang, how do I cancel this?",
  "Pak, why is this expensive?",
  "Bu, apa kabar?",                        // greeting, not question requiring answer
];

// ═══════════════════════════════════════════════════════════════════
// PART 7.1 · Defect + Neighbour regression pins (Philip's contract)
// ═══════════════════════════════════════════════════════════════════

const ADDRESS_DEFECT_PLUS_NEIGHBOUR: Array<{ defect: string; neighbour: string; family: string }> = [
  {
    defect:    "Mas, apa yang lebih murah?",
    neighbour: "Mas, yang lebih murah?",
    family:    "comparative",
  },
  {
    defect:    "Pak, apa yang paling murah?",
    neighbour: "Pak, yang paling murah dong",
    family:    "comparative",
  },
  {
    defect:    "Bu, apa yang recommended?",
    neighbour: "Bu, yang recommended aja",
    family:    "require",
  },
  {
    defect:    "Mbak, what's the nearest one?",
    neighbour: "Mbak, the nearest one",
    family:    "require",
  },
  {
    defect:    "Pak Ahmad, apa yang lebih murah?",
    neighbour: "Pak Ahmad, yang lebih murah",
    family:    "comparative",
  },
  {
    defect:    "Bu Rina, where is the cheapest?",
    neighbour: "Bu Rina, the cheaper one",
    family:    "comparative",
  },
];

describe("Corpus ADDRESS-INDONESIA · Part 7.1 · defect/neighbour regressions", () => {
  it.each(ADDRESS_DEFECT_PLUS_NEIGHBOUR)(
    "defect '$defect' → no refinement · neighbour '$neighbour' → refinement/$family",
    ({ defect, neighbour, family }) => {
      // Defect (address + question form) must NOT fire
      expect(detectRefinement(defect).matched).toBe(false);
      // Neighbour (address + statement form) MUST still fire
      const rn = detectRefinement(neighbour);
      expect(rn.matched).toBe(true);
      if (rn.matched) expect(rn.family).toBe(family);
    },
  );
});

describe("Corpus ADDRESS-INDONESIA · Part 7 · address + question · reports whether question stays question", () => {
  it("audits address+interrogative false-positive count + prints report", () => {
    const fp: Array<{ msg: string; kind: string; family?: string }> = [];
    for (const msg of ADDRESS_PLUS_QUESTION) {
      const ab = detectAbandonment(msg);
      const rf = detectRefinement(msg);
      if (ab.matched) fp.push({ msg, kind: "abandonment" });
      if (rf.matched) fp.push({ msg, kind: "refinement", family: rf.family });
    }

    const lines: string[] = [];
    lines.push("");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("  Corpus ADDRESS-INDONESIA · Part 7 · address + question audit");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push(`Tested: ${ADDRESS_PLUS_QUESTION.length} · False positives: ${fp.length}`);
    if (fp.length > 0) {
      lines.push("");
      lines.push("Address + interrogative sentences currently absorbed as intent:");
      for (const f of fp) {
        const tag = f.family ? `${f.kind}/${f.family}` : f.kind;
        lines.push(`   [${tag.padEnd(20)}] "${f.msg}"`);
      }
      lines.push("");
      lines.push("These are QUESTIONS with address prefix. Interrogative guard");
      lines.push("anchors to `^` and misses address-prefixed cases. Defect exposed.");
    }
    lines.push("═════════════════════════════════════════════════════════════════════");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));

    // Hard-assert: this test SHOULD fail on current detector · that
    // is the defect this audit surfaces. Fix applied below.
    expect(fp.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 8 · Aggregate report
// ═══════════════════════════════════════════════════════════════════

describe("Corpus ADDRESS-INDONESIA · aggregate report", () => {
  it("prints structured summary", () => {
    const allSamples = [
      ...ADDRESS_BARE,
      ...TIME_GREETINGS,
      ...ADDRESS_PLUS_CONVERSATION,
      ...ADDRESS_PLUS_QUESTION,
    ];
    let abCount = 0, rfCount = 0, efCount = 0;
    for (const msg of allSamples) {
      if (detectAbandonment(msg).matched)    abCount++;
      if (detectRefinement(msg).matched)     rfCount++;
      if (detectEntityFollowup(msg).matched) efCount++;
    }
    const lines: string[] = [];
    lines.push("");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("  Corpus ADDRESS-INDONESIA · Aggregate Audit Report");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push(`Non-intent samples tested : ${allSamples.length}`);
    lines.push(`abandonment fires         : ${abCount}  (expected 0)`);
    lines.push(`refinement fires          : ${rfCount}  (expected 0 · Part 7 documents defects)`);
    lines.push(`entity-followup fires     : ${efCount}  (expected 0 in this pool)`);
    lines.push("═════════════════════════════════════════════════════════════════════");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
  });
});
