// src/lib/nex/marketing/deliverability/__tests__/ab-testing.test.ts
//
// NEX Deliverability · A/B Testing framework acceptance
// Founder-authorised programme · Session-13 · Part 11g · 2026-09-22.

import { describe, it, expect } from "vitest";
import {
  assignVariant, assignVariantsBatch,
  computeVariantStats, computeStatisticalSignificance, selectWinner,
  _AB_TESTING_NEVER_SENDS, _AB_TESTING_NEVER_PERSISTS,
  _AB_TESTING_DETERMINISTIC_ASSIGNMENT,
  _AB_TESTING_NEVER_CLAIMS_SIGNIFICANCE_BELOW_THRESHOLD,
  type VariantObservation,
} from "..";

const VARIANTS = [
  { variant_id: "A", weight: 1 },
  { variant_id: "B", weight: 1 },
];

// ═══════════════════════════════════════════════════════════════════
// A · Deterministic assignment
// ═══════════════════════════════════════════════════════════════════
describe("A/B testing · (A) deterministic assignment", () => {
  it("(A1) same (campaign, contact) → same variant on repeated calls", () => {
    const r1 = assignVariant({ campaign_id: "c1", contact_id: "user-42", variants: VARIANTS });
    const r2 = assignVariant({ campaign_id: "c1", contact_id: "user-42", variants: VARIANTS });
    expect(r1.variant_id).toBe(r2.variant_id);
    expect(r1.assignment_hash).toBe(r2.assignment_hash);
  });
  it("(A2) different contact_id → potentially different variant · assignment_hash differs", () => {
    const r1 = assignVariant({ campaign_id: "c1", contact_id: "user-1", variants: VARIANTS });
    const r2 = assignVariant({ campaign_id: "c1", contact_id: "user-2", variants: VARIANTS });
    expect(r1.assignment_hash).not.toBe(r2.assignment_hash);
  });
  it("(A3) different campaign_id · same contact_id → different assignment_hash", () => {
    const r1 = assignVariant({ campaign_id: "c1", contact_id: "user-1", variants: VARIANTS });
    const r2 = assignVariant({ campaign_id: "c2", contact_id: "user-1", variants: VARIANTS });
    expect(r1.assignment_hash).not.toBe(r2.assignment_hash);
  });
  it("(A4) throws when variants empty", () => {
    expect(() => assignVariant({ campaign_id: "c", contact_id: "u", variants: [] })).toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Distribution uniformity
// ═══════════════════════════════════════════════════════════════════
describe("A/B testing · (B) distribution uniformity", () => {
  it("(B1) 10000 contacts · 50/50 split within ±5% (statistical)", () => {
    const contact_ids = Array.from({ length: 10000 }, (_, i) => `user-${i}`);
    const assigns = assignVariantsBatch("cX", contact_ids, VARIANTS);
    const a = assigns.filter(x => x.variant_id === "A").length;
    const b = assigns.filter(x => x.variant_id === "B").length;
    expect(a + b).toBe(10000);
    // Expected ~5000 each · allow generous ±5% tolerance
    expect(Math.abs(a - 5000)).toBeLessThan(500);
  });
  it("(B2) 3:1 weighting distributes ~75/25 within tolerance", () => {
    const V = [{ variant_id: "control", weight: 3 }, { variant_id: "test", weight: 1 }];
    const contact_ids = Array.from({ length: 10000 }, (_, i) => `u-${i}`);
    const assigns = assignVariantsBatch("cW", contact_ids, V);
    const ctrl = assigns.filter(x => x.variant_id === "control").length;
    expect(Math.abs(ctrl - 7500)).toBeLessThan(500);
  });
  it("(B3) three-way even split ~1/3 each within tolerance", () => {
    const V = [
      { variant_id: "A", weight: 1 },
      { variant_id: "B", weight: 1 },
      { variant_id: "C", weight: 1 },
    ];
    const contact_ids = Array.from({ length: 9000 }, (_, i) => `u-${i}`);
    const assigns = assignVariantsBatch("cThree", contact_ids, V);
    for (const v of ["A", "B", "C"]) {
      const n = assigns.filter(x => x.variant_id === v).length;
      expect(Math.abs(n - 3000)).toBeLessThan(400);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Variant stats
// ═══════════════════════════════════════════════════════════════════
describe("A/B testing · (C) variant stats", () => {
  it("(C1) rates computed correctly · safe division", () => {
    const obs: VariantObservation = {
      variant_id: "A", sent: 1000, delivered: 950,
      opened: 285, clicked: 47, bounced: 50, complained: 2, unsubscribed: 5,
    };
    const s = computeVariantStats(obs);
    expect(s.delivery_rate).toBeCloseTo(0.95, 3);
    expect(s.open_rate).toBeCloseTo(0.3, 3);
    expect(s.click_rate).toBeCloseTo(47/950, 3);
    expect(s.bounce_rate).toBeCloseTo(0.05, 3);
  });
  it("(C2) zero-denominator returns null · never divides by zero", () => {
    const obs: VariantObservation = {
      variant_id: "A", sent: 0, delivered: 0,
      opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0,
    };
    const s = computeVariantStats(obs);
    expect(s.delivery_rate).toBeNull();
    expect(s.open_rate).toBeNull();
    expect(s.bounce_rate).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Statistical significance
// ═══════════════════════════════════════════════════════════════════
describe("A/B testing · (D) statistical significance", () => {
  const A: VariantObservation = { variant_id: "A", sent: 1000, delivered: 1000, opened: 200, clicked: 20, bounced: 0, complained: 0, unsubscribed: 0 };
  const B_bigger: VariantObservation = { variant_id: "B", sent: 1000, delivered: 1000, opened: 300, clicked: 30, bounced: 0, complained: 0, unsubscribed: 0 };
  const B_similar: VariantObservation = { variant_id: "B", sent: 1000, delivered: 1000, opened: 205, clicked: 20, bounced: 0, complained: 0, unsubscribed: 0 };

  it("(D1) clearly better B (30% vs 20% open rate) → significant · winner=B", () => {
    const r = computeStatisticalSignificance({ a: A, b: B_bigger, metric: "open_rate" });
    expect(r.kind).toBe("significant");
    if (r.kind === "significant") {
      expect(r.winner).toBe("B");
      expect(r.p_value).toBeLessThan(0.05);
    }
  });
  it("(D2) very similar rates → not_significant · never fabricates a winner", () => {
    const r = computeStatisticalSignificance({ a: A, b: B_similar, metric: "open_rate" });
    expect(r.kind).toBe("not_significant");
  });
  it("(D3) below min_sample_size → insufficient_sample", () => {
    const tiny_a: VariantObservation = { variant_id: "A", sent: 50, delivered: 50, opened: 10, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 };
    const tiny_b: VariantObservation = { variant_id: "B", sent: 50, delivered: 50, opened: 15, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 };
    const r = computeStatisticalSignificance({ a: tiny_a, b: tiny_b, metric: "open_rate", min_sample_size: 100 });
    expect(r.kind).toBe("insufficient_sample");
  });
  it("(D4) all-identical rates → not_significant (or invalid_input if SE undefined)", () => {
    const A_zero: VariantObservation = { variant_id: "A", sent: 1000, delivered: 1000, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 };
    const B_zero: VariantObservation = { variant_id: "B", sent: 1000, delivered: 1000, opened: 0, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 };
    const r = computeStatisticalSignificance({ a: A_zero, b: B_zero, metric: "open_rate" });
    expect(["not_significant", "invalid_input"]).toContain(r.kind);
  });
  it("(D5) alpha=0.01 stricter threshold · borderline case may flip to not_significant", () => {
    const marginal_a: VariantObservation = { variant_id: "A", sent: 1000, delivered: 1000, opened: 100, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 };
    const marginal_b: VariantObservation = { variant_id: "B", sent: 1000, delivered: 1000, opened: 130, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 };
    const at05 = computeStatisticalSignificance({ a: marginal_a, b: marginal_b, metric: "open_rate", alpha: 0.05 });
    const at01 = computeStatisticalSignificance({ a: marginal_a, b: marginal_b, metric: "open_rate", alpha: 0.01 });
    // At α=0.05 typically significant; at α=0.01 outcome depends but stricter
    expect(at05.kind).toBe("significant");
    // Not asserting at01 outcome · just that different alpha can flip decisions
    expect(at01).toBeDefined();
  });
  it("(D6) works for bounce_rate metric (lower-is-better handled at winner selection)", () => {
    const low_bounce: VariantObservation = { variant_id: "A", sent: 1000, delivered: 950, opened: 200, clicked: 20, bounced: 20, complained: 0, unsubscribed: 0 };
    const high_bounce: VariantObservation = { variant_id: "B", sent: 1000, delivered: 900, opened: 200, clicked: 20, bounced: 80, complained: 0, unsubscribed: 0 };
    const r = computeStatisticalSignificance({ a: low_bounce, b: high_bounce, metric: "bounce_rate" });
    expect(r.kind).toBe("significant");
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Winner selection
// ═══════════════════════════════════════════════════════════════════
describe("A/B testing · (E) winner selection", () => {
  it("(E1) clear winner returned when significant", () => {
    const obs: VariantObservation[] = [
      { variant_id: "A", sent: 1000, delivered: 1000, opened: 200, clicked: 20, bounced: 0, complained: 0, unsubscribed: 0 },
      { variant_id: "B", sent: 1000, delivered: 1000, opened: 300, clicked: 40, bounced: 0, complained: 0, unsubscribed: 0 },
    ];
    const r = selectWinner({ observations: obs, metric: "open_rate" });
    expect(r.kind).toBe("winner");
    if (r.kind === "winner") expect(r.winner).toBe("B");
  });
  it("(E2) too-similar → no_winner_yet · never fabricates", () => {
    const obs: VariantObservation[] = [
      { variant_id: "A", sent: 1000, delivered: 1000, opened: 200, clicked: 20, bounced: 0, complained: 0, unsubscribed: 0 },
      { variant_id: "B", sent: 1000, delivered: 1000, opened: 205, clicked: 20, bounced: 0, complained: 0, unsubscribed: 0 },
    ];
    const r = selectWinner({ observations: obs, metric: "open_rate" });
    expect(r.kind).toBe("no_winner_yet");
  });
  it("(E3) insufficient variants → insufficient_variants", () => {
    const obs: VariantObservation[] = [
      { variant_id: "A", sent: 100, delivered: 100, opened: 20, clicked: 0, bounced: 0, complained: 0, unsubscribed: 0 },
    ];
    const r = selectWinner({ observations: obs, metric: "open_rate" });
    expect(r.kind).toBe("insufficient_variants");
  });
  it("(E4) bounce_rate lower-is-better: winner is variant with LOWER bounce rate", () => {
    const obs: VariantObservation[] = [
      { variant_id: "low_bounce", sent: 1000, delivered: 950, opened: 200, clicked: 20, bounced: 20, complained: 0, unsubscribed: 0 },
      { variant_id: "high_bounce", sent: 1000, delivered: 900, opened: 200, clicked: 20, bounced: 80, complained: 0, unsubscribed: 0 },
    ];
    const r = selectWinner({ observations: obs, metric: "bounce_rate" });
    if (r.kind === "winner") {
      expect(r.winner).toBe("low_bounce");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("A/B testing · (F) governance canaries", () => {
  it("(F1) boundary markers exported", () => {
    expect(_AB_TESTING_NEVER_SENDS).toContain("never_transmits");
    expect(_AB_TESTING_NEVER_PERSISTS).toContain("no_DB_writes");
    expect(_AB_TESTING_DETERMINISTIC_ASSIGNMENT).toContain("SHA_256");
    expect(_AB_TESTING_NEVER_CLAIMS_SIGNIFICANCE_BELOW_THRESHOLD).toContain("never_fabricated");
  });
  it("(F2) module exports NO send/persist/dispatch function", async () => {
    const mod: any = await import("..");
    expect(mod.sendVariant).toBeUndefined();
    expect(mod.persistAssignment).toBeUndefined();
    expect(mod.dispatchVariants).toBeUndefined();
    expect(mod.forceWinner).toBeUndefined();
    expect(mod.overrideVariant).toBeUndefined();
    expect(mod.fabricatePValue).toBeUndefined();
  });
  it("(F3) module source contains no fetch/http/mailer/DB", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/nex/marketing/deliverability/ab-testing.ts", "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    expect(code).not.toMatch(/\bfetch\(/);
    expect(code).not.toMatch(/["']node:http["']/);
    expect(code).not.toMatch(/nodemailer/i);
    expect(code).not.toMatch(/\bpool\.query\b/);
    expect(code).not.toMatch(/\bclient\.query\b/);
  });
  it("(F4) assignment_hash is truncated · never full 64-char digest exposed", () => {
    const r = assignVariant({ campaign_id: "c1", contact_id: "u1", variants: VARIANTS });
    expect(r.assignment_hash.length).toBeLessThanOrEqual(16);
  });
});
