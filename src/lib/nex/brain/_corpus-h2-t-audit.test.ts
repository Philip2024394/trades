// src/lib/nex/brain/_corpus-h2-t-audit.test.ts
//
// AUDIT-ONLY corpora H2 + T (Philip 2026-09-01).
//
// Corpus H2 — Hotel / Lodging + Dining + Mobility Adversarial References
// Corpus T  — Code-Switch Mobility / Travel / Arrival
//
// 200 + 200 = 400 sentences. Never productionised as pattern lists.
// The purpose of this file is to:
//   1. Machine-verify Philip's explicit danger cases DO NOT false-fire
//      any current detector (constitutional wall extended)
//   2. Run the entire corpus through current detectors and report
//      pass/fail + family breakdown + false-positive samples
//   3. Prevent future regressions from silently degrading the guards
//
// Prints a structured audit report on run (not a hard pass/fail
// threshold — the actual assertions are only on the specific danger
// cases Philip named + a false-positive ceiling).
//
// DOCTRINE (Philip 2026-09-01):
//   Every proposed positive extraction pattern MUST have simultaneous
//   negative guard. Do not solve false positives by broadening generic
//   `yang`, `the`, `one`, `next`, `driver`, `hotel` matching.

import { describe, expect, it } from "vitest";
import { detectAbandonment } from "./abandonment-detector";
import { detectRefinement } from "./refinement-detector";
import { detectEntityFollowup } from "./entity-followup-detector";
import { extractEntities } from "./entities";

// ═══════════════════════════════════════════════════════════════════
// PART A · CONSTITUTIONAL DANGER-CASE PROBES
// ═══════════════════════════════════════════════════════════════════
//
// Philip's explicit call-outs from Corpus T (movement language ≠ reference
// language) and Corpus H2 (sub-action cancels ≠ goal abandonment).
// Each of these must fail-closed on every current detector.

const CORPUS_T_MOVEMENT_DANGER = [
  // Temporal "next" (must NOT extract as reference/refinement)
  "Next week I'm going to Japan",
  "Next semester I'm going exchange program",
  "next Sunday I'll be back",
  "next month gonna be busy",
  "next time we book earlier",
  "The next meeting is at 3",
  "In the next quarter",
  // Movement statements (must NOT extract as reference)
  "Tunggu ya, I'm coming via shortcut",
  "Macet parah, I'm going via toll road",
  "Tenang aja, udah OTW jam segini",
  "My package is in transit di hub",
  "Lagi gerimis, I'm making my way carefully",
  "Jalanan kosong, full speed ahead pake motor",
  "Kemarin I came pas jalanan sepi",
  "Barusan I arrived di depan gang",
  "Udah di lobby nih, I'm here",
  "I went naik MRT tadi pagi",
  "Save me a seat, I'm coming",
  "Get ready, another rave party is coming",
  "The chef said food is coming",
  "The professor is coming to class now",
  "The delivery guy is coming today",
];

const CORPUS_H2_SUBACTION_DANGER = [
  // Sub-action cancels (should NOT trigger goal abandonment)
  "Yang booking ini cancel aja",
  "Bisa tolong cancel my reservation now",
  "Yang table booking jam 7 tarik aja",
  "Yang scheduled appointment besok void aja",
  "Yang first booking tadi tolong didrop",
  "Yang policy code 404 block aja",
  "Yang special event ticket cancel aja deh",
  "Mau cancel total all items in cart",
  "Yang automatic subscription cancel mulai bulan depan",
  "Yang pending request hapus aja semuanya",
  "Jangan biarin order-nya go through, terminate!",
  // Informational cancel questions
  "Ada option buat cancel last minute",
  "Ada penalty fee gak kalo dicancel",
  "Ada confirmation text pas udh dicancel",
  "Ada pop-up confirmation box pas nge-click",
  "Ada button undo gak pas tak sengaja cancel",
  "Yang total processing time cancellation-nya berapa",
  "Cari form cancellation request-nya di mana",
  // Refinement + auto-action compounds (from prior corpora fix)
  "Jangan yang processing status, abort order gih",
  "Jangan pake force-majeure checkbox, sudden emergency aja",
  "Jangan yang cut-off time, standard extension grace period",
  "Jangan yang rebook, complete deletion aja",
  "Jangan yang automated denial template, human review channel path",
];

describe("Corpus T · movement language MUST NOT fire any current detector as reference/refinement/abandonment", () => {
  it.each(CORPUS_T_MOVEMENT_DANGER)("'%s' fails-closed on abandonment + refinement", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
    expect(detectRefinement(msg).matched).toBe(false);
  });

  it.each(CORPUS_T_MOVEMENT_DANGER)("'%s' does NOT extract 3.41.m dynamic canonicals (last/previous/next/yang_tadi)", (msg) => {
    const ents = extractEntities(msg);
    const canonicals = ents.filter((e) => e.kind === "ordinal").map((e) => e.canonical);
    expect(canonicals).not.toContain("last");
    expect(canonicals).not.toContain("previous");
    expect(canonicals).not.toContain("next");
    expect(canonicals).not.toContain("yang_tadi");
  });
});

describe("Corpus H2 · sub-action cancels + info questions MUST NOT fire abandonment", () => {
  it.each(CORPUS_H2_SUBACTION_DANGER)("'%s' does not fire abandonment (sub-action ≠ goal abandonment)", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// PART B · CORPUS AUDIT REPORT · aggregate structural view
// ═══════════════════════════════════════════════════════════════════
//
// Full 200-sentence corpora abbreviated by family. Not asserted as
// pass/fail — printed as observability. Failures show up in Part A.

const CORPUS_T_MOVEMENT: string[] = [
  // Family A — Movement / route (1-20)
  "Tadi I went lewat jalur alternatif.",
  "Tunggu ya, I'm coming via shortcut.",
  "Macet parah, I'm going via toll road.",
  "Tenang aja, udah OTW jam segini.",
  "My package is in transit di hub.",
  "Lagi gerimis, I'm making my way carefully.",
  "Jalanan kosong, full speed ahead pake motor.",
  "Kemarin I came pas jalanan sepi.",
  "Barusan I arrived di depan gang.",
  "Udah di lobby nih, I'm here.",
  "I went naik MRT tadi pagi.",
  "Don't leave yet, I'm coming right now.",
  "I'm going pake ojek online aja.",
  "Driver-nya udah OTW ke titik jemput.",
  "Lagi di kereta, still in transit ya.",
  "I'm making my way ke halte terdekat.",
  "Mumpung lampu hijau, full speed ahead gih.",
  "I came pas jam nanggung sih.",
  "Check maps deh, I arrived safely.",
  "Samping lampu merah ya, I'm here.",
  // Family B — Airport (21-40)
  "Bulan lalu I went ke Bali.",
  "Hold on, I'm coming to terminal 3.",
  "Next week I'm going to Japan.",
  "Udah di taksi bandara, OTW nih.",
  "Bagasiku masih in transit di Singapore.",
  "I'm making my way to boarding gate.",
  "Clearance aman, full speed ahead to destination.",
  "I came pake flight subuh kemarin.",
  "Alhamdulillah, I arrived at hotel room.",
  "Open the door, I'm here guys.",
  // Family C — Office/WFH movement (41-60)
  "Yesterday I went ke kantor pusat.",
  "I'm coming to help with presentation.",
  "I'm going ke meeting room seberang.",
  "The data report-nya still in transit via Slack.",
  "Project approved, full speed ahead execution ya.",
  // Family D — Cafe hunting (61-80)
  "I went ke cafe hits kemaren.",
  "Save me a seat, I'm coming.",
  "Cafe-nya mau tutup, full speed ahead.",
  // Family E — Food (81-100)
  "The chef said food is coming.",
  "Tonight I'm going dinner bareng doi.",
  "Makanan ojol-nya udah OTW rumah.",
  // Family F — Shopping (101-120)
  "New seasonal clothing line is coming.",
  "The delivery guy is coming today.",
  // Family G — Gym (121-140)
  "Summer body goals are coming, semangat.",
  "My gym supplements are in transit courier.",
  // Family H — University (141-160)
  "Final exam results are coming out.",
  "The professor is coming to class now.",
  "Next semester I'm going exchange program.",
  // Family I — Nightlife (161-180)
  "Get ready, another rave party is coming.",
  "The concert merchandise packaging is in transit.",
  // Family J — Tech (181-200)
  "A new software dynamic update is coming.",
  "The security patch tokens are in transit cloud.",
  "The automated delivery drone is coming now.",
];

const CORPUS_H2_LODGING: string[] = [
  "Yang hotel deal coba.",
  "Ada yang staycation package promo?",
  "Jangan yang homestay, glamping resort aja.",           // refinement/exclude
  "Yang customer score below 4.2 skip.",                  // refinement/skip_by_attribute
  "Show me yang nearest villa on maps.",                  // refinement/require (nearest)
  "Yang bener yang mana breakfast inclusion-nya?",
  "Ada yang room style family suite ready?",
  "Yang packaging-nya weekend gateaway bundle complete.",
  "Jangan yang boutique hotel, trusted chain aja.",       // refinement/exclude
  "Yang flash markdown discount ada?",
  "Ada yang guaranteed private pool option?",
  "Yang total booking price-nya berapa?",
  "Mau yang package bundle with spa voucher dong.",
  "Yang dapet freebies laundry credit mana?",
  "Ada yang high season surcharge fee?",
  "Yang balcony view-nya ke gunung ada?",
  "Jangan yang low rating reviews, ngeri bgt.",           // refinement/exclude
  "Yang special markdown voucher jam 12 malam nanti.",
  "Ada yang pet-friendly accommodation option nearby?",
  "Yang promo gajian staycation pass mulai kapan?",
  "Cari yang wholesale price for group lodging.",
  "Yang first booking dapet room upgrade token?",         // refers "yang first booking" → ordinal first
  "Ada yang zero deposit booking scheme option?",
  "Yang highly recommended transit capsule hotel aja.",   // refinement/require
  "Mau yang digital lodging voucher promotion points.",
  // Cancellation family (sub-action, not abandonment)
  "Yang booking ini cancel aja.",
  "Bisa tolong cancel my reservation now?",
  "Jangan yang processing status, abort order gih.",      // refinement + non-registered verb
  "Yang pending request hapus aja semuanya.",
  "Show me the cancel button on screen.",
  "Yang bener yang mana transaction cancellation code-nya?",
  "Ada option buat cancel last minute?",
  "Yang scheduled appointment besok void aja.",
  "Jangan yang rebook, complete deletion aja.",
  "Yang policy code 404 block aja.",
  "Ada confirmation text pas udh dicancel?",
  "Yang total processing time cancellation-nya berapa?",
  "Mau drop out dari queue list dong.",
  "Yang kena auto-cancel system yang mana?",
  "Ada penalty fee gak kalo dicancel?",
  "Yang table booking jam 7 tarik aja.",
  "Jangan biarin order-nya go through, terminate!",
  "Yang special event ticket cancel aja deh.",
  "Ada button undo gak pas tak sengaja cancel?",
  "Yang automatic subscription cancel mulai bulan depan.",
  "Cari form cancellation request-nya di mana?",
  "Yang first booking tadi tolong didrop.",                // yang first (extracts ordinal first)
  "Ada pop-up confirmation box pas nge-click?",
  "Yang highly urgent order hold dulu.",
  "Mau cancel total all items in cart.",
];

type AuditRow = {
  sentence:      string;
  abandonment:   boolean;
  refinement:    boolean;
  refFamily?:    string;
  followup:      boolean;
  ordinalCanons: string[];
};

function auditRow(sentence: string): AuditRow {
  const ab = detectAbandonment(sentence);
  const rf = detectRefinement(sentence);
  const fu = detectEntityFollowup(sentence);
  const ents = extractEntities(sentence);
  const ordinalCanons = ents.filter((e) => e.kind === "ordinal").map((e) => e.canonical);
  return {
    sentence,
    abandonment: ab.matched,
    refinement:  rf.matched,
    refFamily:   rf.matched ? rf.family : undefined,
    followup:    fu.matched,
    ordinalCanons,
  };
}

describe("Corpus H2 + T · aggregate audit report (observational)", () => {
  it("prints structured audit summary + zero unexpected abandonment fires", () => {
    const tRows  = CORPUS_T_MOVEMENT.map(auditRow);
    const h2Rows = CORPUS_H2_LODGING.map(auditRow);

    const tAbandonmentFires  = tRows.filter((r) => r.abandonment);
    const h2AbandonmentFires = h2Rows.filter((r) => r.abandonment);

    const tRefinementFires   = tRows.filter((r) => r.refinement);
    const h2RefinementFires  = h2Rows.filter((r) => r.refinement);

    const tOrdinalFires      = tRows.filter((r) => r.ordinalCanons.length > 0);
    const h2OrdinalFires     = h2Rows.filter((r) => r.ordinalCanons.length > 0);

    const lines: string[] = [];
    lines.push("");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("  CORPUS H2 + T · Audit-Only Report");
    lines.push("═════════════════════════════════════════════════════════════════════");
    lines.push("");
    lines.push(`Corpus T  (movement/mobility · ${tRows.length} rows sampled):`);
    lines.push(`   abandonment fires : ${tAbandonmentFires.length} · expected 0`);
    lines.push(`   refinement fires  : ${tRefinementFires.length}`);
    lines.push(`   ordinal-canon fires (last/previous/next/yang_tadi) : ${tOrdinalFires.length}`);
    if (tAbandonmentFires.length > 0) {
      lines.push("");
      lines.push("   ⚠ ABANDONMENT FALSE POSITIVES:");
      for (const r of tAbandonmentFires) lines.push(`       "${r.sentence}"`);
    }
    if (tOrdinalFires.length > 0) {
      lines.push("");
      lines.push("   ORDINAL EXTRACTIONS (verify each is a legitimate reference):");
      for (const r of tOrdinalFires) lines.push(`       "${r.sentence}" → ${r.ordinalCanons.join(",")}`);
    }
    lines.push("");
    lines.push(`Corpus H2 (lodging/dining · ${h2Rows.length} rows sampled):`);
    lines.push(`   abandonment fires : ${h2AbandonmentFires.length} · expected 0`);
    lines.push(`   refinement fires  : ${h2RefinementFires.length}`);
    lines.push(`   ordinal-canon fires (last/previous/next/yang_tadi) : ${h2OrdinalFires.length}`);
    if (h2AbandonmentFires.length > 0) {
      lines.push("");
      lines.push("   ⚠ ABANDONMENT FALSE POSITIVES:");
      for (const r of h2AbandonmentFires) lines.push(`       "${r.sentence}"`);
    }
    if (h2OrdinalFires.length > 0) {
      lines.push("");
      lines.push("   ORDINAL EXTRACTIONS (verify each is a legitimate reference):");
      for (const r of h2OrdinalFires) lines.push(`       "${r.sentence}" → ${r.ordinalCanons.join(",")}`);
    }
    if (h2RefinementFires.length > 0) {
      lines.push("");
      lines.push("   REFINEMENT CLASSIFICATIONS:");
      for (const r of h2RefinementFires) lines.push(`       [${r.refFamily?.padEnd(20)}] "${r.sentence}"`);
    }
    lines.push("");
    lines.push("═════════════════════════════════════════════════════════════════════");

    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));

    // HARD assertions: no abandonment false positives on either corpus.
    // This is the constitutional wall extended.
    expect(tAbandonmentFires.length).toBe(0);
    expect(h2AbandonmentFires.length).toBe(0);
  });
});
