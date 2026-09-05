// src/lib/nex/brain/abandonment-constitutional-boundaries.test.ts
//
// Constitutional regression wall (Philip 2026-08-31).
//
// From Philip's hotel + commerce adversarial corpora:
//
//   "Abandonment must mean abandonment of the current goal — not
//    rejection of an option, cancellation of a sub-action, or change
//    of preference."
//
// Four semantic behaviours the detector MUST distinguish:
//
//   1. ABANDONMENT              → intent=abandonment + clear session
//   2. PREFERENCE / REFINEMENT  → NOT abandonment (refinement is later)
//   3. ACTION SUB-CANCELLATION  → NOT abandonment (kills one op, not goal)
//   4. CANCELLATION INFORMATION → NOT abandonment (asking about policy)
//
// This suite pins current behaviour so future changes (refinement
// landing, action-verb landing, expanded vocabulary) cannot silently
// regress the detector into a false-positive machine.
//
// The corpora Philip supplied stay audit-only. THIS FILE embeds ONLY
// the specific danger cases he explicitly named as regression risks.

import { describe, expect, it } from "vitest";
import { detectAbandonment } from "./abandonment-detector";

// ═══════════════════════════════════════════════════════════════════
// 1. TRUE ABANDONMENT — detector MUST fire
// ═══════════════════════════════════════════════════════════════════

describe("constitutional · TRUE abandonment · detector fires", () => {
  it.each([
    "gak jadi beli",              // Philip's canonical
    "gak jadi",                   // bare
    "lupakan",
    "forget it",
    "cancel that",
    "never mind",
    "batal",
    "batalkan pesanan makanan",
  ])("'%s' → matched=true (real goal abandonment)", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. PREFERENCE / REFINEMENT — detector MUST NOT fire
// ═══════════════════════════════════════════════════════════════════
//
// "Jangan yang X, Y aja" is refinement (exclude X, prefer Y). It keeps
// the current vertical, current reference, and current goal ALIVE.
// Later landings (3.41.p refinement classifier) will properly route
// these to a refinement handler.

describe("constitutional · PREFERENCE / REFINEMENT · detector MUST NOT fire", () => {
  it.each([
    // Commerce corpus — Philip's specific danger cases
    "Jangan yang third-party seller, official brand aja",
    "Jangan yang non-garansi, risikonya gede",
    "Gak usah pake paylater, cash aja",
    "Jangan yang regular courier, instant delivery",
    "Gak usah read short reviews, long-form paragraph",
    "Jangan dapet auto-bot assistant channel line response, human representative please",
    // Ride corpus (Corpus R) — compound refinement + auto-action.
    // "Jangan yang X, cancel aja" is a refinement with an auto-cancel
    // instruction · NOT goal abandonment. Guarded by the "jangan yang
    // ... , cancel/batal/skip/drop aja/deh/dulu" negative pattern.
    "Jangan yang unverified driver account, cancel aja",
    "Jangan yang unverified driver account, cancel aja.",
    "Jangan yang expired voucher, skip aja",
    "Jangan yang mahal, batal aja",
    "Jangan yang PO, drop aja",
    // Hotel corpus — Philip's specific danger cases
    "Jangan yang boutique hotel, bintang 5 aja",
    "Jangan yang non-refundable, berisiko",
    "Jangan pake exchange standard, money back option",
    "Jangan pake hot sauna, warm pool",
    "Jangan parkir outside, secure basement parking",
    "Jangan dapet dirty sheets, replacement please",
    "Jangan yang heavy food, light snack",
    "Gak usah pake bathtub, shower aja",
    "Gak usah pake bellboy service, aman",
    "Gak usah pake sedotan, eco-friendly",
    "Gak usah order menu ala carte, buffet",
    "Gak usah pake fragile tape addition, aman",
    // "Below X skip" / "yang rating-nya X skip" — refinement, not abandonment
    "Yang rating-nya below 4.5 skip",
    "Yang average rating below 4.2 skip",
  ])("'%s' does NOT match (refinement / preference change)", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. ACTION SUB-CANCELLATION — detector MUST NOT fire
// ═══════════════════════════════════════════════════════════════════
//
// "Cancel the payment" · "Cancel order-an yang tadi" · "cancellation
// wrong dispute filing" all describe cancelling ONE sub-operation
// inside the ongoing session. The overall vertical/goal survives.

describe("constitutional · ACTION SUB-CANCELLATION · detector MUST NOT fire", () => {
  it.each([
    "Cancel the payment",
    "Cancel my order",
    "Cancel order-an yang tadi ya",
    "Cancel the booking for tomorrow",
    "Lagi cancellation wrong dispute filing process status line, luckily allowed",
    "Lagi cancellation spa appointment, luckily allowed",
    "Bisa fix clogged drainage system secepatnya",   // corrective sub-action, not abandonment
  ])("'%s' does NOT match (sub-action cancel, not goal abandonment)", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. CANCELLATION INFORMATION — detector MUST NOT fire
// ═══════════════════════════════════════════════════════════════════
//
// Questions ABOUT cancellation (deadline, policy, fee) never abandon.

describe("constitutional · CANCELLATION INFORMATION · detector MUST NOT fire", () => {
  it.each([
    "Udah deadline cancellation request jam berapa",
    "Ada yang free cancellation voucher?",
    "Gak sengaja typed wrong cancellation reasons reference field",
    "What's the cancellation deadline?",
    "cancellation fee-nya berapa",
    "Bisa dapet refund policy check",
  ])("'%s' does NOT match (informational question)", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Existing 3.41.k / 3.41.l guards — reinforced regression pins
// ═══════════════════════════════════════════════════════════════════
//
// Philip's explicit call-outs from the current message:
//   "Jangan lupakan aku" must remain ordinary conversation
//   "Aku gak jadi masalah" must not abandon

describe("constitutional · existing guards Philip called out explicitly", () => {
  it.each([
    "Jangan lupakan aku",
    "jangan lupakan aku",
    "Jangan lupain kado",
    "Aku gak jadi masalah",
    "gak jadi masalah",
    "nggak jadi masalah",
    "gak jadi apa-apa",
    "tidak jadi soal",
    "gak usah pusing",
    "nggak usah khawatir",
    "tidak usah takut",
    "gak usah malu",
  ])("'%s' remains ordinary conversation", (msg) => {
    expect(detectAbandonment(msg).matched).toBe(false);
  });
});
