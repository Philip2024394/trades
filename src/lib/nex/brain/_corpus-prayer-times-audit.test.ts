// src/lib/nex/brain/_corpus-prayer-times-audit.test.ts
//
// Corpus PRAYER-TIMES · AUDIT-ONLY (Philip 2026-09-01).
//
// NO PRODUCTION PRAYER-TIME DETECTOR BUILT. This audit tests that
// natural Indonesian prayer-time phrasings do NOT accidentally fire
// existing detectors (abandonment / refinement / entity-followup /
// ordinal extraction) — and documents the semantic categories a
// future prayer-time module must handle.
//
// See doctrine pin `doctrine_prayer_times_islamic_awareness_2026_09_01.md`
// for the constitutional design (optional · Kemenag-compatible · never
// interrupts · never assumes religious context · location-aware · gentle
// UX). Implementation blocked until this audit + Islamic Knowledge
// source audit both complete.
//
// CONSTITUTIONAL RULE (Philip 2026-09-01):
//   Prayer-time information is NOT the same as declaring religious
//   obligation. NEX may say "🕌 Maghrib diperkirakan pukul 17:48 di
//   Yogyakarta" but MUST NOT casually say "You must pray now" unless
//   the product is explicitly designed for that religious function
//   and the relevant authority/source basis is clear.
//
//   When authoritative Islamic sources disagree, NEX must NOT
//   manufacture a single "NEX answer" merely to sound confident. It
//   should say "Ada beberapa pendapat dalam hal ini..." and explain
//   the difference.

import { describe, expect, it } from "vitest";
import { detectAbandonment } from "./abandonment-detector";
import { detectRefinement } from "./refinement-detector";
import { detectEntityFollowup } from "./entity-followup-detector";
import { extractEntities } from "./entities";

// ═══════════════════════════════════════════════════════════════════
// PART 1 · Direct prayer-time questions (Indonesian phrasings)
// ═══════════════════════════════════════════════════════════════════
//
// Natural Indonesian ways users would ask about prayer times.
// None of these should trigger any existing detector.

const PRAYER_TIME_QUESTIONS = [
  // "jam X berapa?" family
  "jam Maghrib berapa?",
  "jam Subuh berapa?",
  "jam Dhuhr berapa?",
  "jam Ashar berapa?",
  "jam Isya berapa?",
  // "Adzan X kapan?" family
  "Adzan Maghrib kapan?",
  "Adzan Subuh kapan?",
  "Adzan Isya kapan?",
  // "sebentar lagi X?" family
  "sebentar lagi Maghrib?",
  "sebentar lagi Subuh ya?",
  "sebentar lagi Ashar kan?",
  // "udah masuk waktu X belum?" family
  "udah masuk waktu Isya belum?",
  "udah masuk waktu Maghrib?",
  "udah waktu Subuh belum?",
  // English mixed
  "when is Maghrib today?",
  "what time is Isha?",
  "how long until Ashar?",
  // City-specific
  "jam Maghrib di Jakarta?",
  "waktu Subuh di Yogyakarta jam berapa?",
  "Isya di Bali kapan?",
];

describe("PRAYER-TIMES · Part 1 · direct questions fire no detector", () => {
  it.each(PRAYER_TIME_QUESTIONS)("'%s' fires no detector", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
    expect(detectEntityFollowup(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 2 · Reminder opt-in / opt-out commands
// ═══════════════════════════════════════════════════════════════════

const REMINDER_COMMANDS = [
  // Opt-in
  "ingatkan aku sebelum Maghrib",
  "ingatkan aku 15 menit sebelum Maghrib",
  "kasih reminder Maghrib dong",
  "aku mau reminder waktu Subuh",
  "aktifkan reminder Isya",
  "remind me 10 minutes before Ashar",
  // Opt-out (must NOT fire abandonment despite containing "jangan")
  "jangan kasih reminder lagi",
  "matikan reminder Maghrib",
  "hentikan reminder prayer time",
  "gak usah reminder lagi",         // "gak usah" bare-tail — verify guard holds
  "turn off prayer reminders",
];

describe("PRAYER-TIMES · Part 2 · reminder opt-in / opt-out commands do not fire detectors", () => {
  it.each(REMINDER_COMMANDS)("'%s' fires no detector", (msg) => {
    // Especially critical: opt-out commands MUST NOT fire abandonment
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
    expect(detectEntityFollowup(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 3 · Prayer-time context during another conversation
// ═══════════════════════════════════════════════════════════════════
//
// User is chatting about food/travel/etc., prayer-time context comes
// up mid-flow. The prayer-related content must not corrupt intent
// classification of the surrounding conversation.

const PRAYER_MIDFLOW = [
  // Food conversation with prayer context
  "cariin restoran buat buka puasa nanti Maghrib",
  "restoran deket mesjid dong",
  "yang buka setelah Ashar aja",
  // Travel with prayer context
  "hotel yang deket masjid",
  "jam berapa Subuh nanti kalo aku di Bali?",
  "penerbangan yang nggak bentrok sama Maghrib",
  // Personal
  "aku lagi puasa, cariin yang halal",
  "kasih tau kalo sebentar lagi buka",
];

describe("PRAYER-TIMES · Part 3 · prayer-mid-flow context preserves conversation routing", () => {
  it.each(PRAYER_MIDFLOW)("'%s' fires no false abandonment or refinement", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    // Note: "yang buka setelah Ashar aja" contains "yang X aja" but
    // "buka" is not in REQUIRE whitelist, so no false positive.
    expect(detectRefinement(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 4 · Address-prefixed prayer questions (integration with 3.41.n)
// ═══════════════════════════════════════════════════════════════════

const ADDRESS_PLUS_PRAYER = [
  "Pak, jam Maghrib berapa?",
  "Bu, sebentar lagi Isya?",
  "Mas, kasih reminder Subuh dong",
  "Mbak, ingatkan aku sebelum Maghrib",
  "Kak, udah masuk waktu Ashar belum?",
  "Pak Ahmad, jam berapa Subuh besok?",
  "Bu Rina, jangan kasih reminder lagi",
];

describe("PRAYER-TIMES · Part 4 · address-prefixed prayer requests preserve routing", () => {
  it.each(ADDRESS_PLUS_PRAYER)("'%s' fires no detector", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
    expect(detectEntityFollowup(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 5 · Prayer name variants + calculation-method mentions
// ═══════════════════════════════════════════════════════════════════

const PRAYER_TERMINOLOGY = [
  // Prayer names (Arabic + Indonesian variants)
  "Fajr", "Subuh", "Fajar",
  "Syuruk", "Sunrise", "Terbit",
  "Dhuhr", "Zuhur", "Dzuhur", "Dhuha",
  "Asr", "Ashar", "Ashr",
  "Maghrib", "Magrib",
  "Isha", "Isya", "Isyak",
  // Calculation methods (audit only — future module needs to disclose)
  "pake metode Kemenag",
  "hitungan MWL",
  "ISNA calculation method",
  "Muhammadiyah dan Kemenag beda berapa menit?",
  "kalo pake hisab kapan Maghrib?",
];

describe("PRAYER-TIMES · Part 5 · prayer terminology fires no detector", () => {
  it.each(PRAYER_TERMINOLOGY)("'%s' fires no detector", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
    expect(detectEntityFollowup(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 6 · Travel / timezone edge cases
// ═══════════════════════════════════════════════════════════════════
//
// Prayer times vary by location and timezone. Documented as future-
// module requirements — audit here confirms current detectors are
// not disturbed by these phrasings.

const TRAVEL_TIMEZONE_EDGE_CASES = [
  "besok aku di Jakarta, jam Maghrib beda ya?",
  "kalau aku pindah ke WITA, Maghrib jam berapa?",
  "flight Jakarta-Makassar, Maghrib nya ngikut kota mana?",
  "aku di Papua sekarang, jam Subuh?",
  "di daerah yang siangnya panjang, gimana hitungannya?",
  "kalau musim panas di Eropa, gimana waktu Isya?",
];

describe("PRAYER-TIMES · Part 6 · travel/timezone questions fire no detector", () => {
  it.each(TRAVEL_TIMEZONE_EDGE_CASES)("'%s' fires no detector", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 7 · Religious-authority temptation traps
// ═══════════════════════════════════════════════════════════════════
//
// User questions that COULD tempt NEX to speak with religious
// authority. Audit these for detector behaviour · flag as future-
// module handling required with source-stratified answers.

const AUTHORITY_TEMPTATION = [
  "wajib nggak shalat Isya sekarang?",
  "boleh nggak jamak Maghrib sama Isya?",
  "gimana kalau ketinggalan Subuh?",
  "kata siapa Maghrib itu wajib?",
  "menurut NU sama Muhammadiyah beda ya?",
  "apa bedanya hitungan MUI sama Kemenag?",
];

describe("PRAYER-TIMES · Part 7 · authority-temptation questions fire no detector (future module must answer with sourced stratification)", () => {
  it.each(AUTHORITY_TEMPTATION)("'%s' fires no detector · flag for Islamic Knowledge source audit", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 8 · Aggregate audit report + constitutional pin
// ═══════════════════════════════════════════════════════════════════

describe("PRAYER-TIMES · Part 8 · aggregate audit report + constitutional pins", () => {
  it("prints structured summary + hard-asserts zero false positives across all prayer categories", () => {
    const all = [
      ...PRAYER_TIME_QUESTIONS,
      ...REMINDER_COMMANDS,
      ...PRAYER_MIDFLOW,
      ...ADDRESS_PLUS_PRAYER,
      ...PRAYER_TERMINOLOGY,
      ...TRAVEL_TIMEZONE_EDGE_CASES,
      ...AUTHORITY_TEMPTATION,
    ];

    const abFires: string[] = [];
    const rfFires: Array<{ msg: string; family?: string }> = [];
    const efFires: string[] = [];
    const ordFires: Array<{ msg: string; canonicals: string[] }> = [];

    for (const msg of all) {
      if (detectAbandonment(msg).matched) abFires.push(msg);
      const rf = detectRefinement(msg);
      if (rf.matched) rfFires.push({ msg, family: rf.family });
      if (detectEntityFollowup(msg).matched) efFires.push(msg);
      const ords = extractEntities(msg).filter((e) => e.kind === "ordinal").map((e) => e.canonical);
      if (ords.length > 0) ordFires.push({ msg, canonicals: ords });
    }

    const lines: string[] = [];
    lines.push("");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("  PRAYER-TIMES · Audit-Only Report");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push(`Total prayer-time phrases tested : ${all.length}`);
    lines.push(`abandonment fires               : ${abFires.length}  (expected 0)`);
    lines.push(`refinement fires                : ${rfFires.length}  (expected 0)`);
    lines.push(`entity-followup fires           : ${efFires.length}  (expected 0)`);
    lines.push(`ordinal extractions             : ${ordFires.length} (expected 0)`);
    if (abFires.length > 0) {
      lines.push("");
      lines.push("  ⚠ ABANDONMENT FALSE POSITIVES:");
      for (const s of abFires) lines.push(`    "${s}"`);
    }
    if (rfFires.length > 0) {
      lines.push("");
      lines.push("  ⚠ REFINEMENT FALSE POSITIVES:");
      for (const r of rfFires) lines.push(`    [${r.family?.padEnd(20)}] "${r.msg}"`);
    }
    if (efFires.length > 0) {
      lines.push("");
      lines.push("  ⚠ ENTITY-FOLLOWUP FALSE POSITIVES:");
      for (const s of efFires) lines.push(`    "${s}"`);
    }
    if (ordFires.length > 0) {
      lines.push("");
      lines.push("  ORDINAL EXTRACTIONS:");
      for (const o of ordFires) lines.push(`    "${o.msg}" → ${o.canonicals.join(",")}`);
    }
    lines.push("");
    lines.push("─── Constitutional pins (for future prayer-time module) ─────────────");
    lines.push("  1. Prayer-time INFO is not the same as declaring religious obligation");
    lines.push("  2. NEX may say: '🕌 Maghrib diperkirakan pukul 17:48 di Yogyakarta'");
    lines.push("  3. NEX must NOT casually say: 'You must pray now'");
    lines.push("  4. When authoritative sources disagree, NEX must not manufacture");
    lines.push("     a single confident answer · say 'Ada beberapa pendapat...' and");
    lines.push("     explain the difference.");
    lines.push("  5. Default state: reminders OFF · user opt-in explicit");
    lines.push("  6. Never interrupt conversation · always small card at margin");
    lines.push("  7. Location-aware (Kemenag city model · never single national schedule)");
    lines.push("  8. Fail gracefully if location unknown (disable, don't error)");
    lines.push("═════════════════════════════════════════════════════════════════════");

    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));

    // Hard invariants
    expect(abFires.length).toBe(0);
    expect(rfFires.length).toBe(0);
    expect(efFires.length).toBe(0);
    expect(ordFires.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART 9 · Future-module intent categories (documented, not tested)
// ═══════════════════════════════════════════════════════════════════
//
// The audit above proves current detectors don't fire on prayer
// phrasings. A future prayer-time module will need its own detector
// that recognises these intent categories:
//
//   TIME_QUERY          — "jam Maghrib berapa?" · "when is Isha?"
//   REMINDER_OPT_IN     — "ingatkan aku sebelum Maghrib"
//   REMINDER_OPT_OUT    — "jangan kasih reminder lagi" · "matikan reminder"
//   REMINDER_TIMING     — "5 menit sebelum" · "at prayer time" · "10 min before"
//   REMINDER_SCOPE      — specific prayer vs all prayers
//   LOCATION_CHANGE     — "besok aku di Jakarta" · "kalau aku pindah ke WITA"
//   CALCULATION_METHOD  — "pake metode Kemenag" · "hitungan MWL"
//   TERMINOLOGY_VARIANT — Fajr/Subuh · Zuhur/Dhuhr · Asr/Ashar · Isha/Isya
//   RELIGIOUS_QUESTION  — "wajib nggak" · "kata siapa" · "menurut NU"
//     → MUST route to Islamic Knowledge domain with source stratification
//     → MUST NOT be answered by prayer-time module alone
//   PRAYER_MIDFLOW      — prayer context during food/travel conversation
//     → must not corrupt the primary conversation's intent
//
// Constitutional rule: TIME_QUERY / REMINDER_* / LOCATION_CHANGE /
// CALCULATION_METHOD are safe for the prayer-time module. Anything
// tagged RELIGIOUS_QUESTION escalates to the source-stratified
// Islamic Knowledge layer.
