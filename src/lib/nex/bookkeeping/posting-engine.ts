// Nex Booker · deterministic posting engine.
//
// PURE FUNCTIONS that map business events → double-entry journal entries.
// Zero I/O. Given the same event + chart of accounts + compliance rules,
// this ALWAYS produces the same journal entry. That determinism is what
// makes the ledger rebuildable: replay the event log through this engine
// and the ledger reconstructs identically.
//
// Adding a new event type = adding a new case here + a unit test. Never
// bake accounting logic into API handlers or workers — always route
// through this engine.
//
// Naming convention: exported `postingFor*` functions per event type
// (e.g. `postingForReceiptCaptured`, `postingForInvoiceIssued`). Each
// takes a strongly-typed event input, returns a `PostingBlueprint`
// (entry + lines) ready to hand to `nexBkStore().postJournalEntry(...)`.

import type {
  CurrencyCode,
  IsoDate,
  IsoTimestamp,
  NexBkAccount,
  NexBkJournalEntryInput,
  NexBkJournalLineInput,
  Uuid,
} from "./types";

// ── Types ───────────────────────────────────────────────────────────

/** A ready-to-post entry: header + balanced lines. Guaranteed by the
 *  engine to satisfy sum(debit) = sum(credit). The stored procedure
 *  will re-check server-side (belt + braces). */
export type PostingBlueprint = {
  entry: NexBkJournalEntryInput;
  lines: NexBkJournalLineInput[];
};

/** Errors thrown by the engine when it cannot produce a valid posting. */
export class PostingEngineError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PostingEngineError";
    this.code = code;
  }
}

/** Simple lookup of the chart of accounts by code, produced from the
 *  full account list. Engine functions consume this rather than the
 *  raw array so the calling code decides how to fetch/cache accounts. */
export type ChartLookup = {
  byCode(code: string): NexBkAccount;
};

export function buildChartLookup(accounts: NexBkAccount[]): ChartLookup {
  const map = new Map<string, NexBkAccount>();
  for (const a of accounts) map.set(a.code, a);
  return {
    byCode(code: string): NexBkAccount {
      const a = map.get(code);
      if (!a) throw new PostingEngineError("account_not_found", `Chart of accounts missing code "${code}"`);
      return a;
    },
  };
}

// ── Standard account codes (UK small-business default template) ─────
//
// The eventual chart-of-accounts seeder will create accounts with these
// codes on business creation. The engine references only these codes,
// so the chart template can evolve without breaking the engine as long
// as the codes remain stable.

export const ACCT = {
  // Assets
  BANK_CURRENT:          "1000",   // Bank current account
  CASH_IN_HAND:          "1010",   // Petty cash
  ACCOUNTS_RECEIVABLE:   "1200",   // Trade debtors (customers who owe us)
  VAT_RECOVERABLE:       "1400",   // Input VAT (we can reclaim from HMRC)
  // Liabilities
  ACCOUNTS_PAYABLE:      "2100",   // Trade creditors (suppliers we owe)
  VAT_PAYABLE:           "2200",   // Output VAT (we collected, owe HMRC)
  // Income
  SALES_REVENUE:         "4000",   // Sales / turnover
  // Expenses (per typical UK trades categories)
  MATERIALS:             "5000",
  FUEL:                  "5100",
  TOOLS:                 "5200",
  EQUIPMENT_HIRE:        "5300",
  SUBCONTRACTORS:        "5400",
  VEHICLE_EXPENSES:      "5500",
  OFFICE:                "5600",
  UTILITIES:             "5700",
  PROFESSIONAL_FEES:     "5800",
  UNCATEGORISED_EXPENSE: "5900",   // Fallback when NEX cannot classify
} as const;

// ── Event input shapes ──────────────────────────────────────────────
//
// The engine deliberately takes tightly-typed inputs rather than raw
// event.after_state jsonb. Callers unpack the event and hand structured
// values to the engine. This keeps the engine strictly typed and lets
// TypeScript catch missing fields at compile time.

export type ReceiptCapturedInput = {
  business_id: Uuid;
  source_event_id: Uuid;
  entry_at: IsoTimestamp;         // Date on the receipt
  posted_by_type: "nex" | "user";
  posted_by_id?: string | null;
  compliance_package_version: string;

  gross_amount: number;           // What the user paid (incl. VAT)
  net_amount: number;             // Ex-VAT
  vat_amount: number;             // VAT portion
  currency: CurrencyCode;

  expense_account_code: string;   // Category (ACCT.MATERIALS, ACCT.FUEL, etc.)
  paid_from_account_code: string; // ACCT.BANK_CURRENT or ACCT.CASH_IN_HAND
  supplier_id?: string | null;
  project_id?: string | null;
  memo?: string | null;
};

export type InvoiceIssuedInput = {
  business_id: Uuid;
  source_event_id: Uuid;
  entry_at: IsoTimestamp;         // Invoice date
  posted_by_type: "nex" | "user";
  posted_by_id?: string | null;
  compliance_package_version: string;

  gross_amount: number;           // What the customer will pay
  net_amount: number;             // Ex-VAT
  vat_amount: number;             // VAT portion
  currency: CurrencyCode;

  customer_id: string;
  project_id?: string | null;
  invoice_ref: string;            // Human invoice number
};

export type PaymentReceivedInput = {
  business_id: Uuid;
  source_event_id: Uuid;
  entry_at: IsoTimestamp;
  posted_by_type: "nex" | "user";
  posted_by_id?: string | null;
  compliance_package_version: string;

  amount: number;
  currency: CurrencyCode;

  received_into_account_code: string;   // ACCT.BANK_CURRENT typically
  customer_id: string;
  invoice_ref?: string | null;
  memo?: string | null;
};

export type PaymentToSupplierInput = {
  business_id: Uuid;
  source_event_id: Uuid;
  entry_at: IsoTimestamp;
  posted_by_type: "nex" | "user";
  posted_by_id?: string | null;
  compliance_package_version: string;

  amount: number;
  currency: CurrencyCode;

  paid_from_account_code: string;
  supplier_id: string;
  memo?: string | null;
};

// ── Engine functions ────────────────────────────────────────────────

/**
 * A receipt captured by the owner (photo or manual) becomes:
 *   DR Expense (net)
 *   DR VAT Recoverable (VAT amount)
 *   CR Bank or Cash (gross)
 *
 * Rationale:
 * · The full gross amount left the business's bank/cash (credit that account).
 * · The net portion is a genuine business expense (debit expense).
 * · The VAT portion is reclaimable from HMRC and sits as an asset
 *   (debit VAT Recoverable) until the next VAT return offsets it.
 *
 * If vat_amount is 0 (supplier not VAT-registered or zero-rated), the
 * VAT line is omitted — always keep the entry minimal.
 */
export function postingForReceiptCaptured(
  input: ReceiptCapturedInput,
  chart: ChartLookup
): PostingBlueprint {
  assertPositive("gross_amount", input.gross_amount);
  assertNonNegative("net_amount", input.net_amount);
  assertNonNegative("vat_amount", input.vat_amount);
  assertClose(
    input.net_amount + input.vat_amount,
    input.gross_amount,
    "net + vat must equal gross"
  );

  const expense = chart.byCode(input.expense_account_code);
  const paidFrom = chart.byCode(input.paid_from_account_code);
  const vatRecoverable = chart.byCode(ACCT.VAT_RECOVERABLE);

  assertAccountType(expense, "expense");
  assertAccountType(paidFrom, "asset");

  const lines: NexBkJournalLineInput[] = [];

  lines.push({
    account_id: expense.id,
    debit: input.net_amount,
    currency: input.currency,
    supplier_id: input.supplier_id ?? null,
    project_id: input.project_id ?? null,
    memo: input.memo ?? null,
  });

  if (input.vat_amount > 0) {
    lines.push({
      account_id: vatRecoverable.id,
      debit: input.vat_amount,
      currency: input.currency,
      supplier_id: input.supplier_id ?? null,
    });
  }

  lines.push({
    account_id: paidFrom.id,
    credit: input.gross_amount,
    currency: input.currency,
    supplier_id: input.supplier_id ?? null,
    project_id: input.project_id ?? null,
  });

  return finalise(
    {
      business_id: input.business_id,
      entry_at: input.entry_at,
      source_event_id: input.source_event_id,
      description: `Receipt: ${expense.name}${input.memo ? ` — ${input.memo}` : ""}`,
      posted_by_type: input.posted_by_type,
      posted_by_id: input.posted_by_id ?? null,
      compliance_package_version: input.compliance_package_version,
      is_adjustment: false,
    },
    lines
  );
}

/**
 * Invoicing a customer (before they've paid) becomes:
 *   DR Accounts Receivable (gross)
 *   CR Sales Revenue (net)
 *   CR VAT Payable (VAT amount)
 *
 * Rationale:
 * · The customer now owes us the full gross amount (debit receivable).
 * · The net portion is earned revenue (credit revenue).
 * · The VAT portion is collected on behalf of HMRC and owed to them
 *   until the next return (credit VAT Payable liability).
 */
export function postingForInvoiceIssued(
  input: InvoiceIssuedInput,
  chart: ChartLookup
): PostingBlueprint {
  assertPositive("gross_amount", input.gross_amount);
  assertNonNegative("net_amount", input.net_amount);
  assertNonNegative("vat_amount", input.vat_amount);
  assertClose(
    input.net_amount + input.vat_amount,
    input.gross_amount,
    "net + vat must equal gross"
  );

  const receivable = chart.byCode(ACCT.ACCOUNTS_RECEIVABLE);
  const sales = chart.byCode(ACCT.SALES_REVENUE);
  const vatPayable = chart.byCode(ACCT.VAT_PAYABLE);

  const lines: NexBkJournalLineInput[] = [
    {
      account_id: receivable.id,
      debit: input.gross_amount,
      currency: input.currency,
      customer_id: input.customer_id,
      project_id: input.project_id ?? null,
      memo: `Invoice ${input.invoice_ref}`,
    },
    {
      account_id: sales.id,
      credit: input.net_amount,
      currency: input.currency,
      customer_id: input.customer_id,
      project_id: input.project_id ?? null,
      memo: `Invoice ${input.invoice_ref}`,
    },
  ];

  if (input.vat_amount > 0) {
    lines.push({
      account_id: vatPayable.id,
      credit: input.vat_amount,
      currency: input.currency,
      customer_id: input.customer_id,
      memo: `Invoice ${input.invoice_ref} · VAT`,
    });
  }

  return finalise(
    {
      business_id: input.business_id,
      entry_at: input.entry_at,
      source_event_id: input.source_event_id,
      description: `Invoice ${input.invoice_ref} issued`,
      posted_by_type: input.posted_by_type,
      posted_by_id: input.posted_by_id ?? null,
      compliance_package_version: input.compliance_package_version,
      is_adjustment: false,
    },
    lines
  );
}

/**
 * A customer pays an invoice:
 *   DR Bank (amount received)
 *   CR Accounts Receivable (amount received)
 *
 * VAT is not touched here — it was already recognised when the invoice
 * was issued. This is purely a settlement.
 */
export function postingForPaymentReceived(
  input: PaymentReceivedInput,
  chart: ChartLookup
): PostingBlueprint {
  assertPositive("amount", input.amount);

  const bank = chart.byCode(input.received_into_account_code);
  const receivable = chart.byCode(ACCT.ACCOUNTS_RECEIVABLE);

  assertAccountType(bank, "asset");

  const lines: NexBkJournalLineInput[] = [
    {
      account_id: bank.id,
      debit: input.amount,
      currency: input.currency,
      customer_id: input.customer_id,
      memo: input.invoice_ref ? `Payment · Invoice ${input.invoice_ref}` : (input.memo ?? "Payment received"),
    },
    {
      account_id: receivable.id,
      credit: input.amount,
      currency: input.currency,
      customer_id: input.customer_id,
      memo: input.invoice_ref ? `Payment · Invoice ${input.invoice_ref}` : (input.memo ?? "Payment received"),
    },
  ];

  return finalise(
    {
      business_id: input.business_id,
      entry_at: input.entry_at,
      source_event_id: input.source_event_id,
      description: input.invoice_ref
        ? `Payment received · Invoice ${input.invoice_ref}`
        : "Payment received",
      posted_by_type: input.posted_by_type,
      posted_by_id: input.posted_by_id ?? null,
      compliance_package_version: input.compliance_package_version,
      is_adjustment: false,
    },
    lines
  );
}

/**
 * A payment sent to a supplier (typically settling a supplier invoice
 * that was previously recorded as accounts payable):
 *   DR Accounts Payable (reducing what we owe)
 *   CR Bank
 */
export function postingForPaymentToSupplier(
  input: PaymentToSupplierInput,
  chart: ChartLookup
): PostingBlueprint {
  assertPositive("amount", input.amount);

  const bank = chart.byCode(input.paid_from_account_code);
  const payable = chart.byCode(ACCT.ACCOUNTS_PAYABLE);

  const lines: NexBkJournalLineInput[] = [
    {
      account_id: payable.id,
      debit: input.amount,
      currency: input.currency,
      supplier_id: input.supplier_id,
      memo: input.memo ?? "Supplier payment",
    },
    {
      account_id: bank.id,
      credit: input.amount,
      currency: input.currency,
      supplier_id: input.supplier_id,
      memo: input.memo ?? "Supplier payment",
    },
  ];

  return finalise(
    {
      business_id: input.business_id,
      entry_at: input.entry_at,
      source_event_id: input.source_event_id,
      description: "Supplier payment",
      posted_by_type: input.posted_by_type,
      posted_by_id: input.posted_by_id ?? null,
      compliance_package_version: input.compliance_package_version,
      is_adjustment: false,
    },
    lines
  );
}

/**
 * Reverses an existing entry by producing a mirror-image posting.
 * Every debit becomes a credit and vice versa. Used for corrections,
 * customer refunds, cancelled invoices, etc. The reversal entry
 * carries `reverses_entry_id` pointing at the original.
 *
 * The engine cannot invent the reason for a reversal — the caller
 * must supply a description explaining why. This is deliberate: bare
 * "Reversal of X" descriptions in a ledger are unhelpful come audit time.
 */
export function postingForReversal(input: {
  business_id: Uuid;
  source_event_id: Uuid;
  entry_at: IsoTimestamp;
  posted_by_type: "nex" | "user" | "accountant";
  posted_by_id?: string | null;
  compliance_package_version: string;
  original_entry_id: Uuid;
  original_lines: Array<{
    account_id: Uuid;
    debit: number;
    credit: number;
    currency: CurrencyCode;
    project_id?: string | null;
    customer_id?: string | null;
    supplier_id?: string | null;
    memo?: string | null;
  }>;
  reason: string;                      // Required — audit-critical
}): PostingBlueprint {
  if (!input.reason || input.reason.trim().length === 0) {
    throw new PostingEngineError("reversal_reason_required", "Reversal entries must carry a non-empty reason for audit clarity");
  }

  const lines: NexBkJournalLineInput[] = input.original_lines.map((l) => ({
    account_id: l.account_id,
    debit: l.credit,                   // Swap
    credit: l.debit,                   // Swap
    currency: l.currency,
    project_id: l.project_id ?? null,
    customer_id: l.customer_id ?? null,
    supplier_id: l.supplier_id ?? null,
    memo: l.memo ? `Reversal: ${l.memo}` : "Reversal",
  }));

  return finalise(
    {
      business_id: input.business_id,
      entry_at: input.entry_at,
      source_event_id: input.source_event_id,
      description: `Reversal — ${input.reason}`,
      posted_by_type: input.posted_by_type,
      posted_by_id: input.posted_by_id ?? null,
      reverses_entry_id: input.original_entry_id,
      compliance_package_version: input.compliance_package_version,
      is_adjustment: false,
    },
    lines
  );
}

// ── Internal helpers ────────────────────────────────────────────────

function finalise(entry: NexBkJournalEntryInput, lines: NexBkJournalLineInput[]): PostingBlueprint {
  const debitTotal = lines.reduce((s, l) => s + (l.debit ?? 0), 0);
  const creditTotal = lines.reduce((s, l) => s + (l.credit ?? 0), 0);
  const diff = round2(debitTotal - creditTotal);
  if (diff !== 0) {
    throw new PostingEngineError(
      "unbalanced",
      `Engine produced unbalanced entry: debits=${round2(debitTotal)} credits=${round2(creditTotal)} diff=${diff}`
    );
  }
  if (debitTotal === 0) {
    throw new PostingEngineError("zero_amount", "Engine produced zero-total entry");
  }
  for (const l of lines) {
    const debit = l.debit ?? 0;
    const credit = l.credit ?? 0;
    if (debit < 0 || credit < 0) {
      throw new PostingEngineError("negative_amount", `Line contains negative amount (debit=${debit} credit=${credit})`);
    }
    if (debit > 0 && credit > 0) {
      throw new PostingEngineError("debit_and_credit", "Line cannot have both debit and credit populated");
    }
    if (debit === 0 && credit === 0) {
      throw new PostingEngineError("empty_line", "Line has both debit and credit zero");
    }
  }
  return { entry, lines };
}

function assertPositive(field: string, value: number): void {
  if (!(value > 0)) {
    throw new PostingEngineError("invalid_amount", `${field} must be > 0 (received ${value})`);
  }
}

function assertNonNegative(field: string, value: number): void {
  if (!(value >= 0)) {
    throw new PostingEngineError("invalid_amount", `${field} must be >= 0 (received ${value})`);
  }
}

function assertClose(a: number, b: number, message: string, tolerance = 0.005): void {
  if (Math.abs(a - b) > tolerance) {
    throw new PostingEngineError("amount_mismatch", `${message}: ${round2(a)} vs ${round2(b)}`);
  }
}

function assertAccountType(account: NexBkAccount, expected: NexBkAccount["type"]): void {
  if (account.type !== expected) {
    throw new PostingEngineError(
      "wrong_account_type",
      `Account "${account.code}" is type "${account.type}", expected "${expected}"`
    );
  }
}

/** Round to 2 decimal places (currency granularity). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
