// src/lib/nex/brain/_corpus-apa-audit.test.ts
//
// Corpus APA · Indonesian conversational pragmatics · AUDIT-ONLY
// (Philip 2026-09-01).
//
// This corpus tests the "apa" family of Indonesian conversational
// forms. It is INTENTIONALLY audit-only — no production detector for
// pragmatic interpretation exists yet (see doctrine pin
// `doctrine_indonesian_pragmatic_lexicon_2026_09_01.md`).
//
// CONSTITUTIONAL RULE (Philip 2026-09-01):
//   "apa" is an Indonesian conversational interrogative whose function
//   must be determined from its construction. Do NOT translate every
//   apa into the English concept "what". Bare `Apa?` is
//   context-sensitive · `apa lagi` asks for alternatives · `apa sih`
//   carries pragmatic attitude · `apa yang X` is a question · etc.
//
// This audit hard-asserts:
//   1. Every apa form in Philip's list fails-closed on the ABANDONMENT
//      detector (no apa form should ever be goal abandonment)
//   2. Every "Apa yang X" question form fails-closed on REFINEMENT
//      (already guarded by Corpus Q · re-pinned here)
//   3. `apa lagi` still fires ENTITY-FOLLOWUP (legitimate alternative
//      asking · 3.41.i behaviour must not regress)
//   4. Adversarial cases where apa must NOT trigger refinement/
//      abandonment/reference

import { describe, expect, it } from "vitest";
import { detectAbandonment } from "./abandonment-detector";
import { detectRefinement } from "./refinement-detector";
import { detectEntityFollowup } from "./entity-followup-detector";
import { extractEntities } from "./entities";

// ═══════════════════════════════════════════════════════════════════
// PART 1 · Bare / interjection forms
// ═══════════════════════════════════════════════════════════════════

const APA_BARE_INTERJECTION = [
  "Apa?",
  "Apa",
  "Apaan?",
  "Apaan sih?",
  "Apaan tuh?",
  "Apa sih?",
  "Apa dong?",
  "Apa ya?",
  "Apa tuh?",
  "Apa nih?",
];

describe("Corpus APA · Part 1 · bare / interjection · never abandonment or refinement", () => {
  it.each(APA_BARE_INTERJECTION)("'%s' does not fire abandonment or refinement", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 2 · Interrogative constructions
// ═══════════════════════════════════════════════════════════════════

const APA_INTERROGATIVE = [
  "Apa itu?",
  "Apa ini?",
  "Ini apa?",
  "Itu apa?",
  "Kamu mau apa?",
  "Lu mau apa?",
  "Dia ngomong apa?",
  "Tadi bilang apa?",
  "Maksudnya apa?",
  "Terus apa?",
];

describe("Corpus APA · Part 2 · interrogative constructions · question intent, not refinement", () => {
  it.each(APA_INTERROGATIVE)("'%s' does not fire abandonment or refinement", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 3 · Alternative-asking forms (some SHOULD fire entity-followup)
// ═══════════════════════════════════════════════════════════════════
//
// "apa lagi" is the canonical "what else" form (3.41.i behaviour) and
// SHOULD match detectEntityFollowup — the caller composes with
// session state. Other apa forms should NOT fire entity-followup.

describe("Corpus APA · Part 3 · alternative-asking · apa lagi fires entity-followup, others do not", () => {
  it("'apa lagi?' fires entity-followup (3.41.i preserved)", () => {
    expect(detectEntityFollowup("apa lagi?").matched).toBe(true);
  });
  it("'Apa lagi?' fires entity-followup (case-insensitive)", () => {
    expect(detectEntityFollowup("Apa lagi?").matched).toBe(true);
  });
  it("'apa aja?' does NOT fire entity-followup (asks for enumeration, not alternatives)", () => {
    expect(detectEntityFollowup("apa aja?").matched).toBe(false);
  });
  it("'apa pun' does NOT fire entity-followup", () => {
    expect(detectEntityFollowup("apa pun").matched).toBe(false);
  });
  it.each([
    "apa lagi?",
    "apa aja?",
    "apa pun",
    "apa-apaan?",
  ])("'%s' fires neither abandonment nor refinement", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 4 · Greeting / status-check forms
// ═══════════════════════════════════════════════════════════════════

const APA_GREETING = [
  "Apa kabar?",
  "Apa kabar semua?",
  "Ada apa?",
  "Ada apa nih?",
  "Kenapa? Apa?",
  "Apa boleh?",
  "Apa bisa?",
  "Apa benar?",
  "Apa iya?",
];

describe("Corpus APA · Part 4 · greeting / status-check · never intent signal", () => {
  it.each(APA_GREETING)("'%s' fires no detector", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 5 · Adversarial · "Apa yang X" and short probes
// ═══════════════════════════════════════════════════════════════════
//
// Philip's specific traps. These contain refinement-adjacent vocab
// (paling, lebih, recommended, cheapest, murah) BUT are QUESTIONS.
// Corpus Q's interrogative-opener guard should catch every one.

const APA_ADVERSARIAL = [
  "Yang apa?",
  "Apa yang paling murah?",
  "Apa yang lebih murah?",
  "Apa yang kamu rekomendasikan?",
  "Cari apa?",
  "Mau apa?",
  "Beli apa?",
  "Pilih apa?",
  "Hotel apa?",
  "Restoran apa?",
];

describe("Corpus APA · Part 5 · adversarial · apa yang X is a question, not refinement", () => {
  it.each(APA_ADVERSARIAL)("'%s' does not fire refinement or abandonment", (msg) => {
    expect(detectRefinement(msg).matched).toBe(false);
    expect(detectAbandonment(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 6 · Mixed Indonesian-English forms
// ═══════════════════════════════════════════════════════════════════

const APA_MIXED_LANGUAGE = [
  "Apa the cheapest one?",
  "Ini apa sih?",
  "Apa yang paling recommended?",
  "Lu cari apa di app?",
  "Apa yang available?",
  'Apa maksudnya "in transit"?',
  "Apa yang lebih murah?",
  "Apa aja yang bisa dibooking?",
];

describe("Corpus APA · Part 6 · mixed-language · apa opens a question in English contexts too", () => {
  it.each(APA_MIXED_LANGUAGE)("'%s' does not fire refinement or abandonment", (msg) => {
    expect(detectRefinement(msg).matched).toBe(false);
    expect(detectAbandonment(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 7 · Aggregate report + hard invariants
// ═══════════════════════════════════════════════════════════════════

describe("Corpus APA · aggregate report + hard invariants", () => {
  it("full apa corpus produces zero abandonment fires + zero refinement fires except no exceptions", () => {
    const all = [
      ...APA_BARE_INTERJECTION,
      ...APA_INTERROGATIVE,
      ...APA_GREETING,
      ...APA_ADVERSARIAL,
      ...APA_MIXED_LANGUAGE,
      "apa aja?", "apa pun", "apa-apaan?",
      // Alternative-asking forms that SHOULD fire entity-followup
      "apa lagi?", "Apa lagi?",
    ];
    const abFires: string[] = [];
    const rfFires: string[] = [];
    const efFires: Array<{ msg: string; phrase?: string }> = [];
    const ordFires: Array<{ msg: string; canonicals: string[] }> = [];
    for (const msg of all) {
      if (detectAbandonment(msg).matched) abFires.push(msg);
      if (detectRefinement(msg).matched)  rfFires.push(msg);
      const ef = detectEntityFollowup(msg);
      if (ef.matched) efFires.push({ msg, phrase: ef.phrase });
      const ords = extractEntities(msg).filter((e) => e.kind === "ordinal").map((e) => e.canonical);
      if (ords.length > 0) ordFires.push({ msg, canonicals: ords });
    }

    const lines: string[] = [];
    lines.push("");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("  CORPUS APA · Indonesian Conversational Pragmatics · Audit Report");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push(`Total apa forms tested : ${all.length}`);
    lines.push(`abandonment fires      : ${abFires.length}  (expected 0)`);
    lines.push(`refinement fires       : ${rfFires.length}  (expected 0)`);
    lines.push(`entity-followup fires  : ${efFires.length}  (only apa lagi expected)`);
    lines.push(`ordinal extractions    : ${ordFires.length} (expected 0)`);
    if (efFires.length > 0) {
      lines.push("");
      lines.push("  entity-followup matches:");
      for (const e of efFires) lines.push(`    "${e.msg}"  →  phrase="${e.phrase}"`);
    }
    if (ordFires.length > 0) {
      lines.push("");
      lines.push("  ORDINAL FALSE POSITIVES:");
      for (const o of ordFires) lines.push(`    "${o.msg}"  →  ${o.canonicals.join(",")}`);
    }
    if (abFires.length > 0) {
      lines.push("");
      lines.push("  ABANDONMENT FALSE POSITIVES:");
      for (const s of abFires) lines.push(`    "${s}"`);
    }
    if (rfFires.length > 0) {
      lines.push("");
      lines.push("  REFINEMENT FALSE POSITIVES:");
      for (const s of rfFires) lines.push(`    "${s}"`);
    }
    lines.push("");
    lines.push("═════════════════════════════════════════════════════════════════════");
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));

    // Hard invariants
    expect(abFires.length).toBe(0);
    expect(rfFires.length).toBe(0);
    expect(ordFires.length).toBe(0);
    // Only apa lagi (2 casings) should fire entity-followup
    expect(efFires.length).toBe(2);
    for (const e of efFires) expect(e.msg.toLowerCase()).toContain("apa lagi");
  });
});
