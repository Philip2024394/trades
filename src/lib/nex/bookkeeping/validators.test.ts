// Nex Booker · Double-Check System Layer 1 tests.
//
// Every validator, every branch (verified / review / blocked), plus the
// aggregator. These tests are the safety net for the "solid + accurate"
// promise — if any of these regresses, receipts might get through the
// double-check when they shouldn't (or vice versa).

import { describe, expect, it } from "vitest";
import {
  aggregate,
  currencyConsistencyCheck,
  duplicateHeuristicCheck,
  mathReconciliationCheck,
  ocrConfidenceCheck,
  roundNumberHeuristicCheck,
  taxPeriodCheck,
  vatNumberFormatCheck,
} from "./validators";

// ── OCR confidence ─────────────────────────────────────────────────

describe("ocrConfidenceCheck", () => {
  it("verified when overall + all fields above threshold", () => {
    const r = ocrConfidenceCheck({ overall: 0.98, perField: { supplier: 0.99, total: 0.97 } });
    expect(r.kind).toBe("verified");
  });

  it("review when overall below reviewThreshold but above blockThreshold", () => {
    const r = ocrConfidenceCheck({ overall: 0.70 });
    expect(r.kind).toBe("review");
  });

  it("review when overall OK but a field is below reviewThreshold", () => {
    const r = ocrConfidenceCheck({ overall: 0.95, perField: { supplier: 0.99, vat: 0.40 } });
    expect(r.kind).toBe("review");
    expect(r.reason).toContain("vat");
  });

  it("blocked when overall below block threshold", () => {
    const r = ocrConfidenceCheck({ overall: 0.30 });
    expect(r.kind).toBe("blocked");
  });

  it("custom thresholds respected", () => {
    const r = ocrConfidenceCheck({ overall: 0.65, reviewThreshold: 0.90, blockThreshold: 0.70 });
    expect(r.kind).toBe("blocked");   // 0.65 < 0.70
  });
});

// ── Math reconciliation ────────────────────────────────────────────

describe("mathReconciliationCheck", () => {
  it("verified when net + VAT = gross exactly", () => {
    const r = mathReconciliationCheck({ net: 100, vat: 20, gross: 120 });
    expect(r.kind).toBe("verified");
  });

  it("verified when within default £0.01 tolerance", () => {
    const r = mathReconciliationCheck({ net: 83.33, vat: 16.67, gross: 100 });
    expect(r.kind).toBe("verified");   // 83.33 + 16.67 = 100.00 exactly
  });

  it("verified when tiny rounding difference within tolerance", () => {
    const r = mathReconciliationCheck({ net: 83.34, vat: 16.67, gross: 100.00 });
    // Diff is 0.01 — at tolerance boundary
    expect(r.kind).toBe("verified");
  });

  it("blocked when math wrong outside tolerance", () => {
    const r = mathReconciliationCheck({ net: 100, vat: 15, gross: 120 });
    expect(r.kind).toBe("blocked");
    expect(r.reason).toContain("difference");
  });

  it("blocked handles zero-VAT receipts too (net = gross required)", () => {
    const goodZeroVat = mathReconciliationCheck({ net: 50, vat: 0, gross: 50 });
    const badZeroVat = mathReconciliationCheck({ net: 50, vat: 0, gross: 60 });
    expect(goodZeroVat.kind).toBe("verified");
    expect(badZeroVat.kind).toBe("blocked");
  });
});

// ── Duplicate heuristic ────────────────────────────────────────────

describe("duplicateHeuristicCheck", () => {
  it("verified when no similar receipts", () => {
    const r = duplicateHeuristicCheck({
      candidate: { supplier_id: "sup-1", gross_amount: 100, date: "2026-08-06" },
      recent: [
        { id: "r1", supplier_id: "sup-2", gross_amount: 50, date: "2026-08-05" },
      ],
    });
    expect(r.kind).toBe("verified");
  });

  it("review when exact invoice_ref match", () => {
    const r = duplicateHeuristicCheck({
      candidate: { supplier_id: "sup-1", gross_amount: 100, date: "2026-08-06", invoice_ref: "INV-42" },
      recent: [
        { id: "r1", supplier_id: "sup-1", gross_amount: 100, date: "2026-08-06", invoice_ref: "INV-42" },
      ],
    });
    expect(r.kind).toBe("review");
    expect(r.label).toBe("Possible duplicate");
  });

  it("review when same supplier + same amount + close date", () => {
    const r = duplicateHeuristicCheck({
      candidate: { supplier_id: "sup-1", gross_amount: 100, date: "2026-08-06" },
      recent: [
        { id: "r1", supplier_id: "sup-1", gross_amount: 100, date: "2026-08-04" },
      ],
    });
    expect(r.kind).toBe("review");
  });

  it("review by supplier NAME normalisation when no id", () => {
    const r = duplicateHeuristicCheck({
      candidate: { supplier_name: "JEWSON  Ltd.", gross_amount: 100, date: "2026-08-06" },
      recent: [
        { id: "r1", supplier_name: "jewson ltd", gross_amount: 100, date: "2026-08-05" },
      ],
    });
    expect(r.kind).toBe("review");
  });

  it("verified when amount differs", () => {
    const r = duplicateHeuristicCheck({
      candidate: { supplier_id: "sup-1", gross_amount: 100, date: "2026-08-06" },
      recent: [
        { id: "r1", supplier_id: "sup-1", gross_amount: 100.50, date: "2026-08-06" },
      ],
    });
    expect(r.kind).toBe("verified");
  });

  it("verified when date is outside window", () => {
    const r = duplicateHeuristicCheck({
      candidate: { supplier_id: "sup-1", gross_amount: 100, date: "2026-08-06" },
      recent: [
        { id: "r1", supplier_id: "sup-1", gross_amount: 100, date: "2026-06-01" },   // 66 days
      ],
      windowDays: 30,
    });
    expect(r.kind).toBe("verified");
  });

  it("reports count when multiple matches", () => {
    const r = duplicateHeuristicCheck({
      candidate: { supplier_id: "sup-1", gross_amount: 100, date: "2026-08-06" },
      recent: [
        { id: "r1", supplier_id: "sup-1", gross_amount: 100, date: "2026-08-05" },
        { id: "r2", supplier_id: "sup-1", gross_amount: 100, date: "2026-08-04" },
      ],
    });
    expect(r.kind).toBe("review");
    expect(r.label).toContain("2");
  });
});

// ── Currency consistency ───────────────────────────────────────────

describe("currencyConsistencyCheck", () => {
  it("verified when currencies match", () => {
    const r = currencyConsistencyCheck({
      receipt_currency: "GBP", business_base_currency: "GBP", exchange_rate_present: false,
    });
    expect(r.kind).toBe("verified");
  });

  it("blocked when currencies differ and no exchange rate", () => {
    const r = currencyConsistencyCheck({
      receipt_currency: "EUR", business_base_currency: "GBP", exchange_rate_present: false,
    });
    expect(r.kind).toBe("blocked");
  });

  it("review when currencies differ but exchange rate provided", () => {
    const r = currencyConsistencyCheck({
      receipt_currency: "EUR", business_base_currency: "GBP", exchange_rate_present: true,
    });
    expect(r.kind).toBe("review");
  });
});

// ── Tax period check ───────────────────────────────────────────────

describe("taxPeriodCheck", () => {
  it("verified for a normal recent receipt", () => {
    const r = taxPeriodCheck({ receipt_date: "2026-08-04", today: "2026-08-06" });
    expect(r.kind).toBe("verified");
  });

  it("blocked when receipt is far in the future", () => {
    const r = taxPeriodCheck({ receipt_date: "2026-09-01", today: "2026-08-06" });
    expect(r.kind).toBe("blocked");
    expect(r.label).toBe("Future date");
  });

  it("allows 1 day of future (clock skew tolerance)", () => {
    const r = taxPeriodCheck({ receipt_date: "2026-08-07", today: "2026-08-06" });
    expect(r.kind).toBe("verified");
  });

  it("blocked when receipt is before business start", () => {
    const r = taxPeriodCheck({
      receipt_date: "2020-01-01", today: "2026-08-06", business_started_on: "2024-01-01",
    });
    expect(r.kind).toBe("blocked");
    expect(r.label).toContain("Before business");
  });

  it("review when receipt is older than 365 days", () => {
    const r = taxPeriodCheck({ receipt_date: "2024-01-01", today: "2026-08-06" });
    expect(r.kind).toBe("review");
    expect(r.label).toBe("Old receipt");
  });

  it("blocked when receipt date unparseable", () => {
    const r = taxPeriodCheck({ receipt_date: "not-a-date", today: "2026-08-06" });
    expect(r.kind).toBe("blocked");
    expect(r.label).toBe("Bad date");
  });
});

// ── Round number heuristic ─────────────────────────────────────────

describe("roundNumberHeuristicCheck", () => {
  it("review when £100 round with zero VAT from VAT-registered supplier", () => {
    const r = roundNumberHeuristicCheck({ gross_amount: 100, vat_amount: 0, supplier_is_vat_registered: true });
    expect(r.kind).toBe("review");
  });

  it("verified when round total but supplier NOT VAT-registered (normal)", () => {
    const r = roundNumberHeuristicCheck({ gross_amount: 100, vat_amount: 0, supplier_is_vat_registered: false });
    expect(r.kind).toBe("verified");
  });

  it("verified when not round", () => {
    const r = roundNumberHeuristicCheck({ gross_amount: 87.34, vat_amount: 0, supplier_is_vat_registered: true });
    expect(r.kind).toBe("verified");
  });

  it("verified when round but has VAT (legitimate)", () => {
    const r = roundNumberHeuristicCheck({ gross_amount: 120, vat_amount: 20, supplier_is_vat_registered: true });
    expect(r.kind).toBe("verified");
  });

  it("verified for small amounts even if round", () => {
    const r = roundNumberHeuristicCheck({ gross_amount: 20, vat_amount: 0, supplier_is_vat_registered: true });
    expect(r.kind).toBe("verified");
  });
});

// ── VAT number format ──────────────────────────────────────────────

describe("vatNumberFormatCheck", () => {
  it("verified: valid UK 9-digit VAT number", () => {
    const r = vatNumberFormatCheck({ vat_number: "GB123456789", country_code: "GB" });
    expect(r.kind).toBe("verified");
  });

  it("verified: valid UK number without GB prefix", () => {
    const r = vatNumberFormatCheck({ vat_number: "123456789", country_code: "GB" });
    expect(r.kind).toBe("verified");
  });

  it("verified: valid AU ABN (11 digits)", () => {
    const r = vatNumberFormatCheck({ vat_number: "12345678901", country_code: "AU" });
    expect(r.kind).toBe("verified");
  });

  it("review: bad format for known country", () => {
    const r = vatNumberFormatCheck({ vat_number: "12345", country_code: "GB" });
    expect(r.kind).toBe("review");
    expect(r.label).toBe("Bad format");
  });

  it("review: unknown country cannot be validated", () => {
    const r = vatNumberFormatCheck({ vat_number: "999999999", country_code: "ZZ" });
    expect(r.kind).toBe("review");
  });

  it("verified when not required and absent", () => {
    const r = vatNumberFormatCheck({ vat_number: null, country_code: "GB", required: false });
    expect(r.kind).toBe("verified");
  });

  it("review when required and absent", () => {
    const r = vatNumberFormatCheck({ vat_number: null, country_code: "GB", required: true });
    expect(r.kind).toBe("review");
    expect(r.label).toBe("Missing VAT number");
  });

  it("normalises whitespace + case", () => {
    const r = vatNumberFormatCheck({ vat_number: " gb 123 456 789 ", country_code: "GB" });
    expect(r.kind).toBe("verified");
  });
});

// ── Aggregate ──────────────────────────────────────────────────────

describe("aggregate", () => {
  const verified = { kind: "verified" as const, check: "a", label: "OK", reason: "ok" };
  const review = { kind: "review" as const, check: "b", label: "?", reason: "check" };
  const blocked = { kind: "blocked" as const, check: "c", label: "X", reason: "stop" };

  it("verified when all verified", () => {
    expect(aggregate([verified, verified]).kind).toBe("verified");
  });

  it("review when any review + no blocked", () => {
    expect(aggregate([verified, review, verified]).kind).toBe("review");
  });

  it("blocked when any blocked (even if others verified)", () => {
    expect(aggregate([verified, verified, blocked]).kind).toBe("blocked");
  });

  it("blocked wins over review", () => {
    expect(aggregate([verified, review, blocked]).kind).toBe("blocked");
  });

  it("returns counts", () => {
    const agg = aggregate([verified, verified, review, blocked, blocked]);
    expect(agg.counts).toEqual({ verified: 2, review: 1, blocked: 2 });
  });

  it("empty aggregate defaults to verified", () => {
    expect(aggregate([]).kind).toBe("verified");
  });
});
