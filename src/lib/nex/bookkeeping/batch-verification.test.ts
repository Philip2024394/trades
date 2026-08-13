// Nex Booker · Layer 2 batch verification tests.
//
// Every check, every branch. The `verifyPeriod` aggregator covered by
// a happy-path test + a period-with-issues test that exercises all check
// types simultaneously.

import { describe, expect, it } from "vitest";
import {
  bankBalanceReconciliationCheck,
  bankReconciliationCheck,
  categoryDriftCheck,
  compliancePackageCurrencyCheck,
  missingRecurringCheck,
  unresolvedFlagsCheck,
  vatReasonabilityCheck,
  verifyPeriod,
  type PeriodSnapshot,
} from "./batch-verification";

// ── Fixtures ────────────────────────────────────────────────────────

function baseSnapshot(overrides: Partial<PeriodSnapshot> = {}): PeriodSnapshot {
  return {
    business_id: "biz-1",
    period_start: "2026-07-01",
    period_end: "2026-09-30",
    currency_code: "GBP",
    journal_entries: [],
    journal_lines: [],
    bank_transactions: [],
    bank_opening_balance: 10000,
    bank_closing_balance: 10000,
    expected_recurring: [],
    unresolved_layer1_flags: [],
    ...overrides,
  };
}

// ── Bank reconciliation ────────────────────────────────────────────

describe("bankReconciliationCheck", () => {
  it("verified when all bank transactions matched", () => {
    const r = bankReconciliationCheck(baseSnapshot({
      bank_transactions: [
        { id: "b1", date: "2026-08-01", amount: -100, description: "Fuel", matched_entry_id: "e1" },
        { id: "b2", date: "2026-08-05", amount: 1200, description: "Customer payment", matched_entry_id: "e2" },
      ],
    }));
    expect(r.kind).toBe("verified");
  });

  it("review when transactions unmatched", () => {
    const r = bankReconciliationCheck(baseSnapshot({
      bank_transactions: [
        { id: "b1", date: "2026-08-01", amount: -100, description: "Fuel", matched_entry_id: null },
        { id: "b2", date: "2026-08-05", amount: 1200, description: "?", matched_entry_id: null },
      ],
    }));
    expect(r.kind).toBe("review");
    expect(r.details?.unmatched_count).toBe(2);
    expect(r.details?.inflows_count).toBe(1);
    expect(r.details?.outflows_count).toBe(1);
  });

  it("verified when there are no bank transactions", () => {
    const r = bankReconciliationCheck(baseSnapshot());
    expect(r.kind).toBe("verified");
  });
});

// ── Bank balance reconciliation ────────────────────────────────────

describe("bankBalanceReconciliationCheck", () => {
  it("verified when movements match opening → closing delta", () => {
    const r = bankBalanceReconciliationCheck(baseSnapshot({
      bank_opening_balance: 5000,
      bank_closing_balance: 6100,
      bank_transactions: [
        { id: "b1", date: "2026-08-01", amount: -400, description: "Fuel", matched_entry_id: "e1" },
        { id: "b2", date: "2026-08-05", amount: 1500, description: "Payment", matched_entry_id: "e2" },
      ],
    }));
    expect(r.kind).toBe("verified");
  });

  it("review when movements don't add up to balance change", () => {
    const r = bankBalanceReconciliationCheck(baseSnapshot({
      bank_opening_balance: 5000,
      bank_closing_balance: 7000,
      bank_transactions: [
        { id: "b1", date: "2026-08-01", amount: -400, description: "Fuel", matched_entry_id: "e1" },
        { id: "b2", date: "2026-08-05", amount: 1500, description: "Payment", matched_entry_id: "e2" },
      ],
    }));
    expect(r.kind).toBe("review");
    expect(r.details?.diff).toBe(-900);   // Movements 1100, expected 2000
  });
});

// ── Category drift ─────────────────────────────────────────────────

describe("categoryDriftCheck", () => {
  it("verified when no prior period supplied", () => {
    const r = categoryDriftCheck(baseSnapshot());
    expect(r.kind).toBe("verified");
    expect(r.reason).toContain("No prior period");
  });

  it("verified when categories within tolerance", () => {
    const r = categoryDriftCheck(baseSnapshot({
      journal_lines: [
        { entry_id: "e1", account_code: "5000", account_type: "expense", debit: 900, credit: 0 },
        { entry_id: "e2", account_code: "5100", account_type: "expense", debit: 300, credit: 0 },
      ],
      prior_period: {
        expense_by_account_code: { "5000": 1000, "5100": 280 },
        total_revenue: 5000,
        total_expense: 1280,
      },
    }));
    expect(r.kind).toBe("verified");
  });

  it("review when a category shifts more than threshold", () => {
    const r = categoryDriftCheck(baseSnapshot({
      journal_lines: [
        { entry_id: "e1", account_code: "5000", account_type: "expense", debit: 2000, credit: 0 },   // 100% increase
        { entry_id: "e2", account_code: "5100", account_type: "expense", debit: 300, credit: 0 },
      ],
      prior_period: {
        expense_by_account_code: { "5000": 1000, "5100": 300 },
        total_revenue: 5000,
        total_expense: 1300,
      },
    }));
    expect(r.kind).toBe("review");
    expect((r.details?.shifts as Array<{ account_code: string }>)?.[0]?.account_code).toBe("5000");
  });

  it("flags a brand-new significant category (prior was zero)", () => {
    const r = categoryDriftCheck(baseSnapshot({
      journal_lines: [
        { entry_id: "e1", account_code: "5300", account_type: "expense", debit: 500, credit: 0 },  // New category with prior = 0
      ],
      prior_period: {
        expense_by_account_code: { "5000": 1000 },
        total_revenue: 5000,
        total_expense: 1000,
      },
    }));
    expect(r.kind).toBe("review");
  });

  it("respects custom drift threshold", () => {
    const r = categoryDriftCheck(baseSnapshot({
      journal_lines: [
        { entry_id: "e1", account_code: "5000", account_type: "expense", debit: 1200, credit: 0 },
      ],
      prior_period: {
        expense_by_account_code: { "5000": 1000 },
        total_revenue: 5000,
        total_expense: 1000,
      },
    }), { driftThreshold: 0.50 });   // 20% shift, threshold 50% — should pass
    expect(r.kind).toBe("verified");
  });
});

// ── Missing recurring ──────────────────────────────────────────────

describe("missingRecurringCheck", () => {
  it("verified when no recurring configured", () => {
    const r = missingRecurringCheck(baseSnapshot());
    expect(r.kind).toBe("verified");
  });

  it("verified when all recurring present", () => {
    const r = missingRecurringCheck(baseSnapshot({
      journal_lines: [
        { entry_id: "e1", account_code: "5700", account_type: "expense", debit: 500, credit: 0 },
      ],
      expected_recurring: [
        { label: "Workshop rent", account_code: "5700", min_count: 1 },
      ],
    }));
    expect(r.kind).toBe("verified");
  });

  it("review when a recurring is missing", () => {
    const r = missingRecurringCheck(baseSnapshot({
      journal_lines: [
        { entry_id: "e1", account_code: "5000", account_type: "expense", debit: 500, credit: 0 },
      ],
      expected_recurring: [
        { label: "Workshop rent", account_code: "5700", min_count: 1 },
        { label: "CAD subscription", account_code: "5600", min_count: 1 },
      ],
    }));
    expect(r.kind).toBe("review");
    expect(r.label).toContain("Workshop rent");
    expect(r.label).toContain("CAD subscription");
  });

  it("counts entries not lines (balanced entries have two lines)", () => {
    const r = missingRecurringCheck(baseSnapshot({
      journal_lines: [
        // A single receipt for rent: 1 entry, 2 lines
        { entry_id: "e1", account_code: "5700", account_type: "expense", debit: 500, credit: 0 },
        { entry_id: "e1", account_code: "1000", account_type: "asset", debit: 0, credit: 500 },
      ],
      expected_recurring: [
        { label: "Workshop rent", account_code: "5700", min_count: 1 },
      ],
    }));
    expect(r.kind).toBe("verified");   // Should count as 1 rent entry, not 2
  });
});

// ── VAT reasonability ──────────────────────────────────────────────

describe("vatReasonabilityCheck", () => {
  it("verified when no sales", () => {
    const r = vatReasonabilityCheck(baseSnapshot());
    expect(r.kind).toBe("verified");
  });

  it("verified when VAT ratio close to standard rate", () => {
    const r = vatReasonabilityCheck(baseSnapshot({
      journal_lines: [
        // £5000 sales + £1000 VAT = 20% ratio (matches UK standard)
        { entry_id: "e1", account_code: "4000", account_type: "income", debit: 0, credit: 5000 },
        { entry_id: "e1", account_code: "2200", account_type: "liability", debit: 0, credit: 1000 },
      ],
    }));
    expect(r.kind).toBe("verified");
  });

  it("review when VAT much higher than expected", () => {
    const r = vatReasonabilityCheck(baseSnapshot({
      journal_lines: [
        { entry_id: "e1", account_code: "4000", account_type: "income", debit: 0, credit: 1000 },
        { entry_id: "e1", account_code: "2200", account_type: "liability", debit: 0, credit: 800 },   // 80% VAT — impossible
      ],
    }));
    expect(r.kind).toBe("review");
    expect(r.label).toContain("high");
  });

  it("review when VAT is negative relative to sales", () => {
    const r = vatReasonabilityCheck(baseSnapshot({
      journal_lines: [
        { entry_id: "e1", account_code: "4000", account_type: "income", debit: 0, credit: 5000 },
        { entry_id: "e1", account_code: "2200", account_type: "liability", debit: 2000, credit: 0 },  // Net -£2000 VAT
      ],
    }));
    expect(r.kind).toBe("review");
  });

  it("verified when some sales are zero-rated (low VAT ratio is fine)", () => {
    const r = vatReasonabilityCheck(baseSnapshot({
      journal_lines: [
        { entry_id: "e1", account_code: "4000", account_type: "income", debit: 0, credit: 10000 },
        { entry_id: "e1", account_code: "2200", account_type: "liability", debit: 0, credit: 500 },   // 5% overall
      ],
    }));
    expect(r.kind).toBe("verified");   // Low is fine, high is not
  });
});

// ── Compliance package currency ────────────────────────────────────

describe("compliancePackageCurrencyCheck", () => {
  it("verified when all entries have compliance_package_version", () => {
    const r = compliancePackageCurrencyCheck(baseSnapshot({
      journal_entries: [
        { id: "e1", entry_at: "2026-08-01", compliance_package_version: "GB-1.1.0", is_adjustment: false },
        { id: "e2", entry_at: "2026-08-05", compliance_package_version: "GB-1.1.0", is_adjustment: false },
      ],
    }));
    expect(r.kind).toBe("verified");
  });

  it("review when any entry unpinned", () => {
    const r = compliancePackageCurrencyCheck(baseSnapshot({
      journal_entries: [
        { id: "e1", entry_at: "2026-08-01", compliance_package_version: "GB-1.1.0", is_adjustment: false },
        { id: "e2", entry_at: "2026-08-05", compliance_package_version: null, is_adjustment: false },
      ],
    }));
    expect(r.kind).toBe("review");
    expect((r.details?.unpinned_entry_ids as string[]).length).toBe(1);
  });

  it("verified when no entries", () => {
    const r = compliancePackageCurrencyCheck(baseSnapshot());
    expect(r.kind).toBe("verified");
  });
});

// ── Unresolved flags ───────────────────────────────────────────────

describe("unresolvedFlagsCheck", () => {
  it("verified when no flags", () => {
    const r = unresolvedFlagsCheck(baseSnapshot());
    expect(r.kind).toBe("verified");
  });

  it("review when only review-kind flags", () => {
    const r = unresolvedFlagsCheck(baseSnapshot({
      unresolved_layer1_flags: [
        { kind: "review", entity_type: "receipt", entity_id: "r1", check: "duplicate_heuristic", reason: "?" },
      ],
    }));
    expect(r.kind).toBe("review");
  });

  it("blocked when any blocked-kind flag", () => {
    const r = unresolvedFlagsCheck(baseSnapshot({
      unresolved_layer1_flags: [
        { kind: "review", entity_type: "receipt", entity_id: "r1", check: "duplicate_heuristic", reason: "?" },
        { kind: "blocked", entity_type: "receipt", entity_id: "r2", check: "math_reconciliation", reason: "Totals don't add up" },
      ],
    }));
    expect(r.kind).toBe("blocked");
  });
});

// ── Top-level verifyPeriod ─────────────────────────────────────────

describe("verifyPeriod", () => {
  it("happy path: ready_for_accountant = true when everything passes", () => {
    const report = verifyPeriod(baseSnapshot({
      bank_opening_balance: 1000,
      bank_closing_balance: 1500,
      bank_transactions: [
        { id: "b1", date: "2026-08-01", amount: 500, description: "Payment", matched_entry_id: "e1" },
      ],
      journal_entries: [
        { id: "e1", entry_at: "2026-08-01", compliance_package_version: "GB-1.1.0", is_adjustment: false },
      ],
    }));
    expect(report.aggregate).toBe("verified");
    expect(report.ready_for_accountant).toBe(true);
    expect(report.counts.blocked).toBe(0);
  });

  it("period with mixed issues: ready_for_accountant = false, aggregate = blocked when any blocked flag", () => {
    const report = verifyPeriod(baseSnapshot({
      bank_opening_balance: 1000,
      bank_closing_balance: 1500,
      bank_transactions: [
        { id: "b1", date: "2026-08-01", amount: 500, description: "?", matched_entry_id: null },   // Unmatched → review
      ],
      journal_entries: [
        { id: "e1", entry_at: "2026-08-01", compliance_package_version: null, is_adjustment: false },  // Unpinned → review
      ],
      unresolved_layer1_flags: [
        { kind: "blocked", entity_type: "receipt", entity_id: "r1", check: "math_reconciliation", reason: "?" },
      ],
    }));
    expect(report.aggregate).toBe("blocked");
    expect(report.ready_for_accountant).toBe(false);
    expect(report.counts.blocked).toBeGreaterThan(0);
    expect(report.counts.review).toBeGreaterThan(0);
  });

  it("returns all checks in the report for UI display", () => {
    const report = verifyPeriod(baseSnapshot());
    expect(report.checks.length).toBeGreaterThanOrEqual(7);
    const checkNames = report.checks.map((c) => c.check).sort();
    expect(checkNames).toContain("bank_reconciliation");
    expect(checkNames).toContain("category_drift");
    expect(checkNames).toContain("missing_recurring");
    expect(checkNames).toContain("vat_reasonability");
    expect(checkNames).toContain("compliance_package_currency");
    expect(checkNames).toContain("unresolved_flags");
    expect(checkNames).toContain("bank_balance_reconciliation");
  });
});
