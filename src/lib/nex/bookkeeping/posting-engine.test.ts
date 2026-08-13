// Nex Booker · posting engine unit tests.
//
// These tests are the accuracy guarantee. Every posting function must:
//   · Produce debits = credits (the sacred invariant)
//   · Reject invalid inputs (negative amounts, missing accounts, mismatched totals)
//   · Produce reproducible output (same input → same posting)
//   · Handle VAT correctly (rate calculations, zero-VAT edge cases)
//   · Handle reversals correctly (mirror image, reason required)
//
// Run: npx vitest run src/lib/nex/bookkeeping/posting-engine.test.ts

import { describe, expect, it } from "vitest";
import {
  ACCT,
  buildChartLookup,
  PostingEngineError,
  postingForInvoiceIssued,
  postingForPaymentReceived,
  postingForPaymentToSupplier,
  postingForReceiptCaptured,
  postingForReversal,
  type ChartLookup,
} from "./posting-engine";
import type { NexBkAccount } from "./types";

// ── Test fixtures ───────────────────────────────────────────────────

function mkAccount(code: string, type: NexBkAccount["type"], name: string): NexBkAccount {
  const normal_side: NexBkAccount["normal_side"] = type === "asset" || type === "expense" ? "debit" : "credit";
  return {
    id: `acct-${code}`,
    business_id: "biz-1",
    code,
    name,
    type,
    normal_side,
    parent_id: null,
    is_system: false,
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function stdChart(): ChartLookup {
  return buildChartLookup([
    mkAccount(ACCT.BANK_CURRENT, "asset", "Bank current account"),
    mkAccount(ACCT.CASH_IN_HAND, "asset", "Cash"),
    mkAccount(ACCT.ACCOUNTS_RECEIVABLE, "asset", "Trade debtors"),
    mkAccount(ACCT.VAT_RECOVERABLE, "asset", "VAT recoverable"),
    mkAccount(ACCT.ACCOUNTS_PAYABLE, "liability", "Trade creditors"),
    mkAccount(ACCT.VAT_PAYABLE, "liability", "VAT payable"),
    mkAccount(ACCT.SALES_REVENUE, "income", "Sales"),
    mkAccount(ACCT.MATERIALS, "expense", "Materials"),
    mkAccount(ACCT.FUEL, "expense", "Fuel"),
    mkAccount(ACCT.TOOLS, "expense", "Tools"),
  ]);
}

function sumDebits(lines: Array<{ debit?: number }>): number {
  return round2(lines.reduce((s, l) => s + (l.debit ?? 0), 0));
}
function sumCredits(lines: Array<{ credit?: number }>): number {
  return round2(lines.reduce((s, l) => s + (l.credit ?? 0), 0));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── The sacred invariant ────────────────────────────────────────────

describe("posting engine · the sacred invariant (debits = credits)", () => {
  it("receipt with VAT: net + VAT debits equal gross credit", () => {
    const chart = stdChart();
    const { lines } = postingForReceiptCaptured(
      {
        business_id: "biz-1",
        source_event_id: "evt-1",
        entry_at: "2026-08-06T10:00:00Z",
        posted_by_type: "nex",
        compliance_package_version: "GB-1.0.0",
        gross_amount: 120,
        net_amount: 100,
        vat_amount: 20,
        currency: "GBP",
        expense_account_code: ACCT.MATERIALS,
        paid_from_account_code: ACCT.BANK_CURRENT,
      },
      chart
    );
    expect(sumDebits(lines)).toBe(120);
    expect(sumCredits(lines)).toBe(120);
    expect(lines).toHaveLength(3);
  });

  it("receipt with zero VAT: single-debit single-credit, still balanced", () => {
    const chart = stdChart();
    const { lines } = postingForReceiptCaptured(
      {
        business_id: "biz-1",
        source_event_id: "evt-2",
        entry_at: "2026-08-06T10:00:00Z",
        posted_by_type: "user",
        compliance_package_version: "GB-1.0.0",
        gross_amount: 50,
        net_amount: 50,
        vat_amount: 0,
        currency: "GBP",
        expense_account_code: ACCT.FUEL,
        paid_from_account_code: ACCT.CASH_IN_HAND,
      },
      chart
    );
    expect(sumDebits(lines)).toBe(50);
    expect(sumCredits(lines)).toBe(50);
    expect(lines).toHaveLength(2);
  });

  it("invoice issued with VAT: balanced", () => {
    const chart = stdChart();
    const { lines } = postingForInvoiceIssued(
      {
        business_id: "biz-1",
        source_event_id: "evt-3",
        entry_at: "2026-08-06T09:00:00Z",
        posted_by_type: "nex",
        compliance_package_version: "GB-1.0.0",
        gross_amount: 1200,
        net_amount: 1000,
        vat_amount: 200,
        currency: "GBP",
        customer_id: "cust-1",
        invoice_ref: "INV-001",
      },
      chart
    );
    expect(sumDebits(lines)).toBe(1200);
    expect(sumCredits(lines)).toBe(1200);
  });

  it("payment received: balanced", () => {
    const chart = stdChart();
    const { lines } = postingForPaymentReceived(
      {
        business_id: "biz-1",
        source_event_id: "evt-4",
        entry_at: "2026-08-06T14:00:00Z",
        posted_by_type: "user",
        compliance_package_version: "GB-1.0.0",
        amount: 1200,
        currency: "GBP",
        received_into_account_code: ACCT.BANK_CURRENT,
        customer_id: "cust-1",
        invoice_ref: "INV-001",
      },
      chart
    );
    expect(sumDebits(lines)).toBe(1200);
    expect(sumCredits(lines)).toBe(1200);
    expect(lines).toHaveLength(2);
  });

  it("payment to supplier: balanced", () => {
    const chart = stdChart();
    const { lines } = postingForPaymentToSupplier(
      {
        business_id: "biz-1",
        source_event_id: "evt-5",
        entry_at: "2026-08-06T15:00:00Z",
        posted_by_type: "user",
        compliance_package_version: "GB-1.0.0",
        amount: 350,
        currency: "GBP",
        paid_from_account_code: ACCT.BANK_CURRENT,
        supplier_id: "sup-1",
      },
      chart
    );
    expect(sumDebits(lines)).toBe(350);
    expect(sumCredits(lines)).toBe(350);
  });
});

// ── Correct account routing ─────────────────────────────────────────

describe("posting engine · correct account routing", () => {
  it("receipt with VAT posts to: expense DR, VAT-recoverable DR, bank CR", () => {
    const chart = stdChart();
    const { lines } = postingForReceiptCaptured(
      {
        business_id: "biz-1",
        source_event_id: "evt-1",
        entry_at: "2026-08-06T10:00:00Z",
        posted_by_type: "nex",
        compliance_package_version: "GB-1.0.0",
        gross_amount: 120,
        net_amount: 100,
        vat_amount: 20,
        currency: "GBP",
        expense_account_code: ACCT.MATERIALS,
        paid_from_account_code: ACCT.BANK_CURRENT,
      },
      chart
    );
    const byAccountId = Object.fromEntries(lines.map((l) => [l.account_id, l]));
    expect(byAccountId[`acct-${ACCT.MATERIALS}`].debit).toBe(100);
    expect(byAccountId[`acct-${ACCT.VAT_RECOVERABLE}`].debit).toBe(20);
    expect(byAccountId[`acct-${ACCT.BANK_CURRENT}`].credit).toBe(120);
  });

  it("invoice posts to: receivable DR, sales CR, VAT-payable CR", () => {
    const chart = stdChart();
    const { lines } = postingForInvoiceIssued(
      {
        business_id: "biz-1",
        source_event_id: "evt-3",
        entry_at: "2026-08-06T09:00:00Z",
        posted_by_type: "nex",
        compliance_package_version: "GB-1.0.0",
        gross_amount: 1200,
        net_amount: 1000,
        vat_amount: 200,
        currency: "GBP",
        customer_id: "cust-1",
        invoice_ref: "INV-001",
      },
      chart
    );
    const byAccountId = Object.fromEntries(lines.map((l) => [l.account_id, l]));
    expect(byAccountId[`acct-${ACCT.ACCOUNTS_RECEIVABLE}`].debit).toBe(1200);
    expect(byAccountId[`acct-${ACCT.SALES_REVENUE}`].credit).toBe(1000);
    expect(byAccountId[`acct-${ACCT.VAT_PAYABLE}`].credit).toBe(200);
  });
});

// ── Input validation ────────────────────────────────────────────────

describe("posting engine · input validation", () => {
  it("throws when net + VAT != gross", () => {
    const chart = stdChart();
    expect(() =>
      postingForReceiptCaptured(
        {
          business_id: "biz-1",
          source_event_id: "evt-1",
          entry_at: "2026-08-06T10:00:00Z",
          posted_by_type: "nex",
          compliance_package_version: "GB-1.0.0",
          gross_amount: 120,
          net_amount: 100,
          vat_amount: 15,     // Should be 20 — deliberate error
          currency: "GBP",
          expense_account_code: ACCT.MATERIALS,
          paid_from_account_code: ACCT.BANK_CURRENT,
        },
        chart
      )
    ).toThrow(/net \+ vat must equal gross/);
  });

  it("throws when gross_amount is zero", () => {
    const chart = stdChart();
    expect(() =>
      postingForReceiptCaptured(
        {
          business_id: "biz-1",
          source_event_id: "evt-1",
          entry_at: "2026-08-06T10:00:00Z",
          posted_by_type: "nex",
          compliance_package_version: "GB-1.0.0",
          gross_amount: 0,
          net_amount: 0,
          vat_amount: 0,
          currency: "GBP",
          expense_account_code: ACCT.MATERIALS,
          paid_from_account_code: ACCT.BANK_CURRENT,
        },
        chart
      )
    ).toThrow(/gross_amount must be > 0/);
  });

  it("throws when account code unknown", () => {
    const chart = stdChart();
    expect(() =>
      postingForReceiptCaptured(
        {
          business_id: "biz-1",
          source_event_id: "evt-1",
          entry_at: "2026-08-06T10:00:00Z",
          posted_by_type: "nex",
          compliance_package_version: "GB-1.0.0",
          gross_amount: 60,
          net_amount: 50,
          vat_amount: 10,
          currency: "GBP",
          expense_account_code: "9999",     // Doesn't exist
          paid_from_account_code: ACCT.BANK_CURRENT,
        },
        chart
      )
    ).toThrow(/missing code "9999"/);
  });

  it("throws when paid-from is not an asset account", () => {
    const chart = stdChart();
    expect(() =>
      postingForReceiptCaptured(
        {
          business_id: "biz-1",
          source_event_id: "evt-1",
          entry_at: "2026-08-06T10:00:00Z",
          posted_by_type: "nex",
          compliance_package_version: "GB-1.0.0",
          gross_amount: 60,
          net_amount: 50,
          vat_amount: 10,
          currency: "GBP",
          expense_account_code: ACCT.MATERIALS,
          paid_from_account_code: ACCT.SALES_REVENUE,   // Wrong type
        },
        chart
      )
    ).toThrow(/expected "asset"/);
  });

  it("throws when expense_account_code points at an income account", () => {
    const chart = stdChart();
    expect(() =>
      postingForReceiptCaptured(
        {
          business_id: "biz-1",
          source_event_id: "evt-1",
          entry_at: "2026-08-06T10:00:00Z",
          posted_by_type: "nex",
          compliance_package_version: "GB-1.0.0",
          gross_amount: 60,
          net_amount: 50,
          vat_amount: 10,
          currency: "GBP",
          expense_account_code: ACCT.SALES_REVENUE,   // Wrong — income not expense
          paid_from_account_code: ACCT.BANK_CURRENT,
        },
        chart
      )
    ).toThrow(/expected "expense"/);
  });

  it("throws PostingEngineError with a code", () => {
    const chart = stdChart();
    try {
      postingForReceiptCaptured(
        {
          business_id: "biz-1",
          source_event_id: "evt-1",
          entry_at: "2026-08-06T10:00:00Z",
          posted_by_type: "nex",
          compliance_package_version: "GB-1.0.0",
          gross_amount: -50,     // Negative
          net_amount: -40,
          vat_amount: -10,
          currency: "GBP",
          expense_account_code: ACCT.MATERIALS,
          paid_from_account_code: ACCT.BANK_CURRENT,
        },
        chart
      );
      throw new Error("Expected engine to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(PostingEngineError);
      expect((err as PostingEngineError).code).toBe("invalid_amount");
    }
  });
});

// ── Determinism ─────────────────────────────────────────────────────

describe("posting engine · determinism (same input → same output)", () => {
  it("receipt engine produces identical output when called twice with same input", () => {
    const chart = stdChart();
    const input = {
      business_id: "biz-1",
      source_event_id: "evt-1",
      entry_at: "2026-08-06T10:00:00Z",
      posted_by_type: "nex" as const,
      compliance_package_version: "GB-1.0.0",
      gross_amount: 120,
      net_amount: 100,
      vat_amount: 20,
      currency: "GBP",
      expense_account_code: ACCT.MATERIALS,
      paid_from_account_code: ACCT.BANK_CURRENT,
      supplier_id: "sup-1",
      project_id: "proj-1",
      memo: "Timber",
    };
    const a = postingForReceiptCaptured(input, chart);
    const b = postingForReceiptCaptured(input, chart);
    expect(a).toEqual(b);
  });
});

// ── Reversals ───────────────────────────────────────────────────────

describe("posting engine · reversals", () => {
  it("mirror-images debits and credits", () => {
    const rev = postingForReversal({
      business_id: "biz-1",
      source_event_id: "evt-r1",
      entry_at: "2026-08-06T16:00:00Z",
      posted_by_type: "user",
      compliance_package_version: "GB-1.0.0",
      original_entry_id: "orig-1",
      original_lines: [
        { account_id: "acct-a", debit: 100, credit: 0, currency: "GBP" },
        { account_id: "acct-b", debit: 20, credit: 0, currency: "GBP" },
        { account_id: "acct-c", debit: 0, credit: 120, currency: "GBP" },
      ],
      reason: "Customer returned goods",
    });
    expect(rev.lines).toHaveLength(3);
    expect(rev.lines[0].debit).toBe(0);
    expect(rev.lines[0].credit).toBe(100);
    expect(rev.lines[2].debit).toBe(120);
    expect(rev.lines[2].credit).toBe(0);
    expect(sumDebits(rev.lines)).toBe(sumCredits(rev.lines));
    expect(rev.entry.reverses_entry_id).toBe("orig-1");
    expect(rev.entry.description).toContain("Customer returned goods");
  });

  it("throws when reversal has no reason", () => {
    expect(() =>
      postingForReversal({
        business_id: "biz-1",
        source_event_id: "evt-r1",
        entry_at: "2026-08-06T16:00:00Z",
        posted_by_type: "user",
        compliance_package_version: "GB-1.0.0",
        original_entry_id: "orig-1",
        original_lines: [
          { account_id: "acct-a", debit: 100, credit: 0, currency: "GBP" },
          { account_id: "acct-c", debit: 0, credit: 100, currency: "GBP" },
        ],
        reason: "   ",
      })
    ).toThrow(/reason/);
  });
});

// ── Rounding + edge cases ───────────────────────────────────────────

describe("posting engine · rounding + edge cases", () => {
  it("handles fractional pence in VAT calculation (tolerance 0.005)", () => {
    const chart = stdChart();
    // £83.33 net + 20% VAT £16.67 = £100.00 gross. Rounds cleanly.
    const { lines } = postingForReceiptCaptured(
      {
        business_id: "biz-1",
        source_event_id: "evt-r",
        entry_at: "2026-08-06T10:00:00Z",
        posted_by_type: "nex",
        compliance_package_version: "GB-1.0.0",
        gross_amount: 100,
        net_amount: 83.33,
        vat_amount: 16.67,
        currency: "GBP",
        expense_account_code: ACCT.MATERIALS,
        paid_from_account_code: ACCT.BANK_CURRENT,
      },
      chart
    );
    expect(sumDebits(lines)).toBe(100);
    expect(sumCredits(lines)).toBe(100);
  });

  it("supports non-GBP currency on all lines", () => {
    const chart = stdChart();
    const { lines } = postingForReceiptCaptured(
      {
        business_id: "biz-1",
        source_event_id: "evt-r",
        entry_at: "2026-08-06T10:00:00Z",
        posted_by_type: "nex",
        compliance_package_version: "GB-1.0.0",
        gross_amount: 100,
        net_amount: 100,
        vat_amount: 0,
        currency: "EUR",
        expense_account_code: ACCT.MATERIALS,
        paid_from_account_code: ACCT.BANK_CURRENT,
      },
      chart
    );
    for (const l of lines) expect(l.currency).toBe("EUR");
  });
});
