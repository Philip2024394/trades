// Nex Booker · Double-Check System · Layer 2 (batch verification).
//
// Runs when the owner marks an accounting period ready for the accountant.
// Nothing passes to the accountant workspace while any 🟡 or 🔴 check
// remains. All checks are pure functions taking a snapshot of the period's
// data — no I/O. The caller assembles the snapshot from the store and
// hands it to `verifyPeriod`.
//
// Doctrine: project_nex_bookkeeping_accountant_oversight_2026_08_06.md
//           (Layer 1 = per-transaction · this = Layer 2 batch · Layer 3 = accountant workspace)
//
// Naming: same ValidationResult + aggregate pattern as validators.ts to
// keep the double-check surface consistent across layers.

import type { ValidationResult } from "./validators";
import { aggregate as aggregateValidations } from "./validators";

// ── Input snapshot ──────────────────────────────────────────────────

export type PeriodSnapshot = {
  business_id: string;
  period_start: string;              // ISO date
  period_end: string;                // ISO date
  currency_code: string;             // Base currency for the business

  // Posted journal entries + lines in the period
  journal_entries: Array<{
    id: string;
    entry_at: string;                // ISO
    compliance_package_version: string | null;
    is_adjustment: boolean;
  }>;
  journal_lines: Array<{
    entry_id: string;
    account_code: string;            // Chart-of-accounts code (e.g. "5000")
    account_type: "asset" | "liability" | "equity" | "income" | "expense";
    debit: number;
    credit: number;
  }>;

  // Bank transactions imported for the period (from CSV / Open Banking / manual)
  bank_transactions: Array<{
    id: string;
    date: string;                    // ISO
    amount: number;                  // Signed: +ve inflow, -ve outflow
    description: string;
    matched_entry_id?: string | null;
  }>;

  // Opening + closing bank balance for cash-flow sanity check
  bank_opening_balance: number;
  bank_closing_balance: number;

  // Expected recurring transactions (e.g. rent, subscriptions) the owner
  // has configured. Each entry says "we expect at least this many entries
  // touching this account each period."
  expected_recurring: Array<{
    label: string;                   // "Workshop rent", "CAD subscription"
    account_code: string;
    min_count: number;               // Usually 1 (once/period)
  }>;

  // Summary of the immediately prior period for drift comparison (optional)
  prior_period?: {
    expense_by_account_code: Record<string, number>;   // account_code → total expense
    total_revenue: number;
    total_expense: number;
  };

  // Unresolved Layer 1 flags across all transactions in this period
  // (produced upstream by the ingest pipeline; passed through here for aggregation)
  unresolved_layer1_flags: Array<{
    kind: "review" | "blocked";
    entity_type: string;             // "receipt" | "invoice" | ...
    entity_id: string;
    check: string;                   // Layer 1 check identifier
    reason: string;
  }>;
};

// ── Check functions ────────────────────────────────────────────────

/** Every bank transaction should be matched to a posted journal entry.
 *  Unmatched inflows/outflows mean revenue or expense may be missing. */
export function bankReconciliationCheck(snap: PeriodSnapshot): ValidationResult {
  const unmatched = snap.bank_transactions.filter((t) => !t.matched_entry_id);
  if (unmatched.length === 0) {
    return {
      kind: "verified",
      check: "bank_reconciliation",
      label: "All transactions matched",
      reason: `All ${snap.bank_transactions.length} bank transactions matched to journal entries.`,
      details: { total: snap.bank_transactions.length },
    };
  }
  const inflows = unmatched.filter((t) => t.amount > 0).length;
  const outflows = unmatched.filter((t) => t.amount < 0).length;
  return {
    kind: "review",
    check: "bank_reconciliation",
    label: `${unmatched.length} unmatched`,
    reason: `${unmatched.length} bank transactions have no matching journal entry (${inflows} inflows, ${outflows} outflows). Match them before handing to the accountant.`,
    details: {
      unmatched_count: unmatched.length,
      unmatched_ids: unmatched.slice(0, 20).map((t) => t.id),
      inflows_count: inflows,
      outflows_count: outflows,
    },
  };
}

/** Sum of positive bank movements minus outflows should equal (closing - opening).
 *  If not, either the bank data is incomplete or a transaction was mis-recorded. */
export function bankBalanceReconciliationCheck(snap: PeriodSnapshot): ValidationResult {
  const netMovement = round2(
    snap.bank_transactions.reduce((sum, t) => sum + t.amount, 0)
  );
  const expected = round2(snap.bank_closing_balance - snap.bank_opening_balance);
  const diff = round2(netMovement - expected);
  if (Math.abs(diff) <= 0.01) {
    return {
      kind: "verified",
      check: "bank_balance_reconciliation",
      label: "Bank balance reconciled",
      reason: `Opening ${snap.currency_code}${snap.bank_opening_balance.toFixed(2)} + movements ${netMovement.toFixed(2)} = closing ${snap.bank_closing_balance.toFixed(2)}.`,
      details: { net_movement: netMovement, expected, diff: 0 },
    };
  }
  return {
    kind: "review",
    check: "bank_balance_reconciliation",
    label: "Balance doesn't tally",
    reason: `Bank movements sum to ${netMovement.toFixed(2)} but opening → closing implies ${expected.toFixed(2)}. Difference: ${diff.toFixed(2)} ${snap.currency_code}. Some transactions may be missing.`,
    details: { net_movement: netMovement, expected, diff },
  };
}

/** Compares expense category distribution to the prior period. Flags
 *  categories that shifted by more than `driftThreshold` (default 30%).
 *  Silent when there's no prior period to compare against. */
export function categoryDriftCheck(
  snap: PeriodSnapshot,
  opts: { driftThreshold?: number } = {}
): ValidationResult {
  const threshold = opts.driftThreshold ?? 0.30;
  if (!snap.prior_period) {
    return {
      kind: "verified",
      check: "category_drift",
      label: "No prior period",
      reason: "No prior period to compare against — first period is baseline.",
    };
  }
  const current: Record<string, number> = {};
  for (const l of snap.journal_lines) {
    if (l.account_type !== "expense") continue;
    current[l.account_code] = round2((current[l.account_code] ?? 0) + l.debit - l.credit);
  }
  const shifts: Array<{ account_code: string; prior: number; current: number; pct: number }> = [];
  const codes = new Set([...Object.keys(current), ...Object.keys(snap.prior_period.expense_by_account_code)]);
  for (const code of codes) {
    const prior = snap.prior_period.expense_by_account_code[code] ?? 0;
    const cur = current[code] ?? 0;
    if (prior === 0 && cur === 0) continue;
    // If prior is 0 and current is significant, always flag
    if (prior === 0 && cur > 50) {
      shifts.push({ account_code: code, prior, current: cur, pct: Infinity });
      continue;
    }
    if (prior === 0) continue;
    const pct = (cur - prior) / prior;
    if (Math.abs(pct) >= threshold) {
      shifts.push({ account_code: code, prior, current: cur, pct });
    }
  }
  if (shifts.length === 0) {
    return {
      kind: "verified",
      check: "category_drift",
      label: "Categories stable",
      reason: `Expense distribution consistent with prior period (within ${Math.round(threshold * 100)}% per category).`,
    };
  }
  return {
    kind: "review",
    check: "category_drift",
    label: `${shifts.length} category shift${shifts.length > 1 ? "s" : ""}`,
    reason: shifts.length === 1
      ? `Account ${shifts[0].account_code} moved ${formatPct(shifts[0].pct)} vs prior period. Confirm this is expected.`
      : `${shifts.length} expense categories moved by more than ${Math.round(threshold * 100)}% vs prior period. Review before handing to accountant.`,
    details: { shifts, threshold },
  };
}

/** Checks the expected recurring transactions all appeared at least
 *  their minimum count. */
export function missingRecurringCheck(snap: PeriodSnapshot): ValidationResult {
  if (snap.expected_recurring.length === 0) {
    return {
      kind: "verified",
      check: "missing_recurring",
      label: "No recurring configured",
      reason: "No recurring transactions expected.",
    };
  }
  const countsByAccount: Record<string, number> = {};
  const seenEntries = new Set<string>();
  for (const l of snap.journal_lines) {
    // Count once per entry per account (so a single receipt with one line to `5100 Fuel` counts once, not per-line for balanced entries)
    const key = `${l.entry_id}::${l.account_code}`;
    if (seenEntries.has(key)) continue;
    seenEntries.add(key);
    countsByAccount[l.account_code] = (countsByAccount[l.account_code] ?? 0) + 1;
  }
  const missing = snap.expected_recurring.filter(
    (r) => (countsByAccount[r.account_code] ?? 0) < r.min_count
  );
  if (missing.length === 0) {
    return {
      kind: "verified",
      check: "missing_recurring",
      label: "All recurring present",
      reason: `All ${snap.expected_recurring.length} expected recurring items recorded.`,
    };
  }
  return {
    kind: "review",
    check: "missing_recurring",
    label: `Missing: ${missing.map((m) => m.label).join(", ")}`,
    reason: `Expected ${missing.length} recurring transaction${missing.length > 1 ? "s" : ""} not recorded this period: ${missing.map((m) => m.label).join(", ")}. Confirm nothing was skipped.`,
    details: {
      missing: missing.map((m) => ({
        label: m.label,
        account_code: m.account_code,
        expected_min: m.min_count,
        actual: countsByAccount[m.account_code] ?? 0,
      })),
    },
  };
}

/** Sanity-checks the VAT collected vs revenue ratio against the
 *  jurisdiction's standard rate. Wide tolerance because most businesses
 *  have a mix of standard-rate, zero-rate, and exempt sales. Only flags
 *  when the ratio is wildly off (>2x the standard rate = probably a
 *  posting error). */
export function vatReasonabilityCheck(
  snap: PeriodSnapshot,
  opts: { vatPayableAccountCode?: string; salesRevenueAccountCode?: string; standardVatRate?: number } = {}
): ValidationResult {
  const vatCode = opts.vatPayableAccountCode ?? "2200";
  const salesCode = opts.salesRevenueAccountCode ?? "4000";
  const rate = opts.standardVatRate ?? 0.20;

  let vatCollected = 0;
  let salesRevenue = 0;
  for (const l of snap.journal_lines) {
    if (l.account_code === vatCode) vatCollected += l.credit - l.debit;
    if (l.account_code === salesCode) salesRevenue += l.credit - l.debit;
  }
  vatCollected = round2(vatCollected);
  salesRevenue = round2(salesRevenue);

  if (salesRevenue <= 0) {
    return {
      kind: "verified",
      check: "vat_reasonability",
      label: "No sales",
      reason: "No sales revenue in this period.",
    };
  }
  const ratio = vatCollected / salesRevenue;
  const upperBound = rate * 2;      // Way above standard rate = suspicious
  const lowerBound = rate * -0.10;  // Negative VAT would indicate refunds > sales — flag
  if (ratio > upperBound) {
    return {
      kind: "review",
      check: "vat_reasonability",
      label: "VAT looks high",
      reason: `VAT collected ${snap.currency_code}${vatCollected.toFixed(2)} is ${Math.round(ratio * 100)}% of sales — more than expected for standard-rated activity. Check for double-posted VAT or misclassified sales.`,
      details: { vat_collected: vatCollected, sales_revenue: salesRevenue, ratio, expected_rate: rate },
    };
  }
  if (ratio < lowerBound) {
    return {
      kind: "review",
      check: "vat_reasonability",
      label: "Negative VAT",
      reason: `VAT collected is negative (${vatCollected.toFixed(2)}) relative to sales. Likely a refund period or a posting error.`,
      details: { vat_collected: vatCollected, sales_revenue: salesRevenue, ratio },
    };
  }
  return {
    kind: "verified",
    check: "vat_reasonability",
    label: "VAT ratio reasonable",
    reason: `VAT ${Math.round(ratio * 100)}% of sales — within expected range.`,
    details: { vat_collected: vatCollected, sales_revenue: salesRevenue, ratio },
  };
}

/** Every posted entry should have a compliance_package_version. If any
 *  are missing, the entry was posted without recording which rule set was
 *  in force — a gap in the audit trail. */
export function compliancePackageCurrencyCheck(snap: PeriodSnapshot): ValidationResult {
  const missing = snap.journal_entries.filter((e) => !e.compliance_package_version);
  if (missing.length === 0) {
    return {
      kind: "verified",
      check: "compliance_package_currency",
      label: "All entries pinned",
      reason: `All ${snap.journal_entries.length} entries pinned to a compliance package version.`,
    };
  }
  return {
    kind: "review",
    check: "compliance_package_currency",
    label: `${missing.length} entries unpinned`,
    reason: `${missing.length} journal entries have no compliance_package_version. Audit trail is weakened — retro-tag them before handing to the accountant.`,
    details: { unpinned_entry_ids: missing.slice(0, 20).map((e) => e.id) },
  };
}

/** Aggregates any unresolved Layer 1 flags from the ingest pipeline into a
 *  batch-level result. A period cannot pass to the accountant with red
 *  flags outstanding; yellow flags are flagged for owner attention. */
export function unresolvedFlagsCheck(snap: PeriodSnapshot): ValidationResult {
  const blocked = snap.unresolved_layer1_flags.filter((f) => f.kind === "blocked");
  const review = snap.unresolved_layer1_flags.filter((f) => f.kind === "review");
  if (blocked.length > 0) {
    return {
      kind: "blocked",
      check: "unresolved_flags",
      label: `${blocked.length} blocked item${blocked.length > 1 ? "s" : ""}`,
      reason: `${blocked.length} transactions are blocked with unresolved issues. These MUST be resolved before this period can be handed to the accountant.`,
      details: { blocked_flags: blocked.slice(0, 20) },
    };
  }
  if (review.length > 0) {
    return {
      kind: "review",
      check: "unresolved_flags",
      label: `${review.length} pending review`,
      reason: `${review.length} transactions have unresolved review flags. Review them before handing to the accountant.`,
      details: { review_flags: review.slice(0, 20) },
    };
  }
  return {
    kind: "verified",
    check: "unresolved_flags",
    label: "No outstanding flags",
    reason: "All Layer 1 flags are resolved.",
  };
}

// ── Top-level verifier ─────────────────────────────────────────────

export type PeriodReport = {
  business_id: string;
  period_start: string;
  period_end: string;
  aggregate: ValidationResult["kind"];
  ready_for_accountant: boolean;    // True only when aggregate is "verified"
  checks: ValidationResult[];
  counts: Record<ValidationResult["kind"], number>;
};

/** Runs every Layer 2 check and returns a consolidated period report.
 *  Ready-for-accountant only when the aggregate is "verified". */
export function verifyPeriod(snap: PeriodSnapshot, opts: {
  driftThreshold?: number;
  vatPayableAccountCode?: string;
  salesRevenueAccountCode?: string;
  standardVatRate?: number;
} = {}): PeriodReport {
  const checks: ValidationResult[] = [
    unresolvedFlagsCheck(snap),
    bankReconciliationCheck(snap),
    bankBalanceReconciliationCheck(snap),
    categoryDriftCheck(snap, opts),
    missingRecurringCheck(snap),
    vatReasonabilityCheck(snap, opts),
    compliancePackageCurrencyCheck(snap),
  ];
  const agg = aggregateValidations(checks);
  return {
    business_id: snap.business_id,
    period_start: snap.period_start,
    period_end: snap.period_end,
    aggregate: agg.kind,
    ready_for_accountant: agg.kind === "verified",
    checks: agg.results,
    counts: agg.counts,
  };
}

// ── Internal helpers ───────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatPct(x: number): string {
  if (!Number.isFinite(x)) return "new";
  const pct = Math.round(x * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}
