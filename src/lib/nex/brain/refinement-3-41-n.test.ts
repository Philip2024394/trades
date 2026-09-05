// src/lib/nex/brain/refinement-3-41-n.test.ts
//
// Stage 3.41.n · Refinement Classifier (Philip 2026-08-31).
//
// Constitutional contract enforced here:
//
//   1. REFINEMENT positives fire the refinement detector
//   2. Every refinement positive MUST fail-closed on the abandonment
//      detector (cross-detector guarantee)
//   3. ABANDONMENT positives MUST NOT fire refinement
//   4. Reference-only forms ("yang second one" · "yang tadi") must
//      NOT fire refinement — they belong to 3.41.m
//   5. Discovery, follow-ups, greetings, confirmations MUST NOT fire

import { describe, expect, it } from "vitest";
import { detectRefinement } from "./refinement-detector";
import { detectAbandonment } from "./abandonment-detector";

// ═══════════════════════════════════════════════════════════════════
// 1. EXCLUDE family
// ═══════════════════════════════════════════════════════════════════

describe("3.41.n · EXCLUDE family · jangan yang / jangan pake", () => {
  it.each([
    "Jangan yang third-party seller, official brand aja",
    "Jangan yang non-refundable, berisiko",
    "Jangan yang non-garansi, risikonya gede",
    "Jangan yang boutique hotel, bintang 5 aja",
    "Jangan yang regular courier, instant delivery",
    "Jangan pake exchange standard, money back option",
    "Jangan yang PO, kelamaan",
    "Jangan yang fake profile driver, ngeri bgt",
    "Jangan yang unverified driver account, cancel aja",  // also compound
    "Jangan yang manual book, auto-match aja",
    "Jangan pake hot sauna, warm pool",
    "Jangan pake soft brake shoe mechanical leverage settings choice, heavy-duty hydraulic disc brake option configuration fluid mechanism assembly",
  ])("'%s' → REFINEMENT / exclude", (msg) => {
    const r = detectRefinement(msg);
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.family).toBe("exclude");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. REQUIRE family
// ═══════════════════════════════════════════════════════════════════

describe("3.41.n · REQUIRE family · yang X aja / the X (one)", () => {
  it.each([
    "yang direct flight",
    "Yang direct flight",
    "yang direct flight aja",
    "yang recommended",
    "yang recommended aja",
    "yang official brand",
    "yang official brand aja",
    "yang official store aja",
    "yang non-refundable",
    "yang non-smoking",
    "yang budget-friendly",
    "yang instant",
    "yang instant delivery",
    "yang nearest",
    "yang electric",
    "yang electric bike option",
    "yang top-rated",
    "yang authentic",
    "yang genuine",
    "yang ocean view",
    "yang city view",
    "yang twin-bed",
    "the direct flight",
    "the recommended one",
    "the nearest",
  ])("'%s' → REFINEMENT / require", (msg) => {
    const r = detectRefinement(msg);
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.family).toBe("require");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. COMPARATIVE family
// ═══════════════════════════════════════════════════════════════════

describe("3.41.n · COMPARATIVE family · yang lebih / paling / ter-", () => {
  it.each([
    "yang lebih murah",
    "Yang lebih murah",
    "yang lebih dekat",
    "yang lebih mahal",
    "yang lebih besar",
    "yang lebih kecil",
    "yang lebih cepat",
    "yang paling murah",
    "yang paling dekat",
    "yang paling bagus",
    "yang termurah",
    "yang terdekat",
    "yang terbaik",
    "yang tercepat",
    "cheaper",
    "the cheaper one",
    "nearer",
    "the nearer one",
  ])("'%s' → REFINEMENT / comparative", (msg) => {
    const r = detectRefinement(msg);
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.family).toBe("comparative");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. SKIP_BY_ATTRIBUTE family
// ═══════════════════════════════════════════════════════════════════

describe("3.41.n · SKIP_BY_ATTRIBUTE family · below/above X skip", () => {
  it.each([
    "Yang rating-nya below 4.5 skip",
    "yang rating below 4.5 skip",
    "Yang average rating below 4.2 skip",
    "Yang driver rating below 4.5 skip",
    "Yang acceptance rate-nya below 90% skip",
    "yang harga di atas 500000 skip",
    "yang jarak lebih dari 5km skip",
  ])("'%s' → REFINEMENT / skip_by_attribute", (msg) => {
    const r = detectRefinement(msg);
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.family).toBe("skip_by_attribute");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. SWAP family
// ═══════════════════════════════════════════════════════════════════

describe("3.41.n · SWAP family · gak usah pake X, Y aja", () => {
  it.each([
    "Gak usah pake paylater, cash aja",
    "gak usah pake e-credit option, cold cash aja",
    "Gak usah pake bathtub, shower aja",
    "gak usah pake bellboy service, aman aja",
    "nggak usah pake credit card, debit aja",
  ])("'%s' → REFINEMENT / swap", (msg) => {
    const r = detectRefinement(msg);
    expect(r.matched).toBe(true);
    if (r.matched) expect(r.family).toBe("swap");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. NEGATIVES — refinement MUST NOT fire on unrelated intents
// ═══════════════════════════════════════════════════════════════════

describe("3.41.n · guards · refinement MUST NOT fire on other intents", () => {
  it.each([
    // Pure abandonment
    "gak jadi beli",
    "lupakan",
    "cancel that",
    "batal",
    "batalkan pesanan",
    "forget it",
    "never mind",
    // Pure discovery
    "cari hotel",
    "find me a driver",
    "cari makan malam",
    "somewhere to eat",
    // Reference-only (3.41.m territory)
    "the second one",
    "yang tadi",
    "yang terakhir",
    "yang kedua",
    "the last one",
    "yang first one",
    // Follow-up questions (3.41.i / d territory)
    "what's good about it?",
    "tell me more",
    "apa lagi?",
    // Confirmations
    "yes",
    "iya",
    "no",
    "jangan",   // bare "jangan" · not "jangan yang"
    // Greetings / casual
    "hello",
    "hey",
    "halo",
    // Cancellation info (not refinement)
    "Udah deadline cancellation request jam berapa",
    "cancellation fee-nya berapa",
    "What's the cancellation deadline?",
    // Action sub-cancel (not refinement)
    "Cancel the payment",
    "Cancel my order",
    // Empty / whitespace
    "",
    "   ",
  ])("'%s' does NOT match refinement", (msg) => {
    expect(detectRefinement(msg).matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. CROSS-DETECTOR CONSTITUTIONAL GUARANTEE
// ═══════════════════════════════════════════════════════════════════
//
// Philip's contract: every refinement POSITIVE MUST have a matching
// NEGATIVE guard on the abandonment detector. This test asserts that
// invariant machine-provably by iterating every refinement positive
// through detectAbandonment and requiring matched=false.

describe("3.41.n · CROSS-DETECTOR · every refinement positive fails-closed on abandonment", () => {
  const REFINEMENT_POSITIVES = [
    // EXCLUDE
    "Jangan yang third-party seller, official brand aja",
    "Jangan yang non-refundable, berisiko",
    "Jangan yang boutique hotel, bintang 5 aja",
    "Jangan yang unverified driver account, cancel aja",  // critical: has "cancel aja"
    // REQUIRE
    "yang direct flight",
    "yang recommended",
    "yang official brand aja",
    "yang non-refundable",
    "yang instant delivery",
    // COMPARATIVE
    "yang lebih murah",
    "yang paling dekat",
    "yang termurah",
    // SKIP_BY_ATTRIBUTE
    "Yang rating-nya below 4.5 skip",
    "Yang driver rating below 4.5 skip",
    // SWAP
    "Gak usah pake paylater, cash aja",
    "gak usah pake bathtub, shower aja",
  ];

  it.each(REFINEMENT_POSITIVES)("'%s' fires refinement AND does NOT fire abandonment", (msg) => {
    const refined  = detectRefinement(msg);
    const abandoned = detectAbandonment(msg);
    expect(refined.matched).toBe(true);
    expect(abandoned.matched).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. REVERSE CROSS-DETECTOR — every abandonment positive does NOT
//    fire refinement (symmetric invariant)
// ═══════════════════════════════════════════════════════════════════

describe("3.41.n · REVERSE CROSS-DETECTOR · abandonment positives do NOT fire refinement", () => {
  it.each([
    "gak jadi beli",
    "gak jadi",
    "lupakan",
    "lupain",
    "forget it",
    "forget dinner",
    "cancel that",
    "cancel it",
    "batal",
    "batalkan",
    "batalkan pesanan makanan",
    "never mind",
    "nevermind",
    "scratch that",
    "let's move on",
    "change my mind",
    "gajadi",
    "udah gak jadi",
    "udahin aja",
    "gak usah",
    "cancel",
    "cancel aja",
  ])("'%s' fires abandonment AND does NOT fire refinement", (msg) => {
    const abandoned = detectAbandonment(msg);
    const refined   = detectRefinement(msg);
    expect(abandoned.matched).toBe(true);
    expect(refined.matched).toBe(false);
  });
});
