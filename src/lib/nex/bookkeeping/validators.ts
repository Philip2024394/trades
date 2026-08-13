// Nex Booker · Double-Check System · Layer 1 (real-time per-transaction).
//
// Pure validators that every receipt runs through before it reaches the
// ledger. Each validator returns a `ValidationResult` with a colour-coded
// verdict: 🟢 verified / 🟡 review / 🔴 blocked, plus a short reason and
// details for the UI to explain to the owner.
//
// Every validator is a pure function — no I/O, no side effects. Testable
// in isolation. Runs client-side or server-side identically.
//
// Doctrine: project_nex_bookkeeping_accountant_oversight_2026_08_06.md
//           (three-layer double-check: this file = Layer 1, batch = Layer 2,
//           accountant workspace = Layer 3)
//
// Adding a new validator = add function + test. Never bake validation
// logic into API handlers or UI — always route through here so it's
// consistent + auditable.

// ── Result types ────────────────────────────────────────────────────

export type ValidationKind = "verified" | "review" | "blocked";

export type ValidationResult = {
  /** Overall colour verdict. blocked = do not post; review = flag to owner but posting allowed after confirmation; verified = post automatically. */
  kind: ValidationKind;
  /** Machine-readable check identifier — e.g. "ocr_confidence", "duplicate_heuristic". */
  check: string;
  /** Short human-readable label for the badge/pill UI. */
  label: string;
  /** One-sentence explanation shown to the owner. */
  reason: string;
  /** Structured detail for downstream display (numbers, references, etc.). */
  details?: Record<string, unknown>;
};

/** Convenience aggregator — combines many results into one overall verdict.
 *  If any result is `blocked`, aggregate is `blocked`. Else if any is
 *  `review`, aggregate is `review`. Else `verified`. Preserves the
 *  individual results for detail display. */
export type AggregateResult = {
  kind: ValidationKind;
  results: ValidationResult[];
  /** Count by kind for quick UI metrics. */
  counts: Record<ValidationKind, number>;
};

export function aggregate(results: ValidationResult[]): AggregateResult {
  const counts: Record<ValidationKind, number> = { verified: 0, review: 0, blocked: 0 };
  for (const r of results) counts[r.kind] += 1;
  const kind: ValidationKind =
    counts.blocked > 0 ? "blocked" :
    counts.review  > 0 ? "review" :
    "verified";
  return { kind, results, counts };
}

// ── Layer 1 validators ──────────────────────────────────────────────

/** OCR confidence check — overall + per-field. */
export type OcrConfidenceInput = {
  /** Overall confidence 0..1 as reported by the OCR pipeline. */
  overall: number;
  /** Optional per-field confidences (supplier, date, total, VAT etc.). */
  perField?: Record<string, number>;
  /** Threshold below which we flag (default 0.85). */
  reviewThreshold?: number;
  /** Threshold below which we hard-block (default 0.50 — likely garbage). */
  blockThreshold?: number;
};

export function ocrConfidenceCheck(input: OcrConfidenceInput): ValidationResult {
  const review = input.reviewThreshold ?? 0.85;
  const block = input.blockThreshold ?? 0.50;
  const belowReview = Object.entries(input.perField ?? {}).filter(([, v]) => v < review);
  if (input.overall < block) {
    return {
      kind: "blocked",
      check: "ocr_confidence",
      label: "OCR too low",
      reason: `Overall OCR confidence ${Math.round(input.overall * 100)}% is below the ${Math.round(block * 100)}% floor. Please retake the photo or enter the receipt manually.`,
      details: { overall: input.overall, threshold_block: block },
    };
  }
  if (input.overall < review || belowReview.length > 0) {
    return {
      kind: "review",
      check: "ocr_confidence",
      label: "Please confirm",
      reason: belowReview.length > 0
        ? `Some fields need confirmation: ${belowReview.map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(", ")}.`
        : `Overall OCR confidence ${Math.round(input.overall * 100)}% — please confirm the extracted values.`,
      details: { overall: input.overall, below_review: Object.fromEntries(belowReview) },
    };
  }
  return {
    kind: "verified",
    check: "ocr_confidence",
    label: "Verified",
    reason: `OCR confidence ${Math.round(input.overall * 100)}%.`,
    details: { overall: input.overall },
  };
}

/** Reconciles net + VAT = gross within tolerance. Blocks if the arithmetic
 *  doesn't add up — that's a data error, not a review question. */
export type MathReconciliationInput = {
  net: number;
  vat: number;
  gross: number;
  /** Currency granularity tolerance (default £0.01 / 1p). */
  tolerance?: number;
};

export function mathReconciliationCheck(input: MathReconciliationInput): ValidationResult {
  const tolerance = input.tolerance ?? 0.01;
  const diff = round2(input.net + input.vat - input.gross);
  if (Math.abs(diff) <= tolerance) {
    return {
      kind: "verified",
      check: "math_reconciliation",
      label: "Totals match",
      reason: "Net + VAT equals gross.",
      details: { diff: 0 },
    };
  }
  return {
    kind: "blocked",
    check: "math_reconciliation",
    label: "Totals don't add up",
    reason: `Net (${input.net.toFixed(2)}) + VAT (${input.vat.toFixed(2)}) = ${round2(input.net + input.vat).toFixed(2)}, but the receipt total is ${input.gross.toFixed(2)}. That's a ${diff.toFixed(2)} difference — please recheck the receipt.`,
    details: { net: input.net, vat: input.vat, gross: input.gross, diff, tolerance },
  };
}

/** Heuristic duplicate detection against recent receipts. */
export type DuplicateHeuristicInput = {
  candidate: {
    supplier_id?: string | null;
    supplier_name?: string | null;
    gross_amount: number;
    date: string;                       // ISO date
    invoice_ref?: string | null;
  };
  recent: Array<{
    id: string;
    supplier_id?: string | null;
    supplier_name?: string | null;
    gross_amount: number;
    date: string;
    invoice_ref?: string | null;
  }>;
  /** Window in days for "recent" comparison (default 30). */
  windowDays?: number;
};

export function duplicateHeuristicCheck(input: DuplicateHeuristicInput): ValidationResult {
  const win = input.windowDays ?? 30;
  const candDate = Date.parse(input.candidate.date);
  const matches = input.recent.filter((r) => {
    if (Math.abs(input.candidate.gross_amount - r.gross_amount) > 0.01) return false;
    const rDate = Date.parse(r.date);
    if (!Number.isFinite(rDate) || !Number.isFinite(candDate)) return false;
    if (Math.abs(candDate - rDate) > win * 24 * 60 * 60 * 1000) return false;

    // Strong match: same invoice ref
    if (input.candidate.invoice_ref && r.invoice_ref && input.candidate.invoice_ref === r.invoice_ref) return true;
    // Medium match: same supplier + same amount + close date
    if (input.candidate.supplier_id && r.supplier_id && input.candidate.supplier_id === r.supplier_id) return true;
    if (input.candidate.supplier_name && r.supplier_name &&
        normalise(input.candidate.supplier_name) === normalise(r.supplier_name)) return true;
    return false;
  });

  if (matches.length > 0) {
    return {
      kind: "review",
      check: "duplicate_heuristic",
      label: matches.length === 1 ? "Possible duplicate" : `${matches.length} possible duplicates`,
      reason: matches.length === 1
        ? `A very similar receipt was already recorded (${matches[0].date}, ${matches[0].gross_amount.toFixed(2)}${matches[0].invoice_ref ? " · " + matches[0].invoice_ref : ""}). Confirm this isn't a repeat before saving.`
        : `Found ${matches.length} similar receipts in the last ${win} days. Please confirm this is a new transaction.`,
      details: { matches: matches.map((m) => ({ id: m.id, date: m.date, gross: m.gross_amount, invoice_ref: m.invoice_ref })) },
    };
  }
  return {
    kind: "verified",
    check: "duplicate_heuristic",
    label: "Unique",
    reason: "No matching recent receipts found.",
    details: { checked: input.recent.length, window_days: win },
  };
}

/** Warns when the receipt currency differs from the business base currency. */
export type CurrencyConsistencyInput = {
  receipt_currency: string;
  business_base_currency: string;
  exchange_rate_present: boolean;
};

export function currencyConsistencyCheck(input: CurrencyConsistencyInput): ValidationResult {
  if (input.receipt_currency === input.business_base_currency) {
    return {
      kind: "verified",
      check: "currency_consistency",
      label: "Base currency",
      reason: `Receipt is in ${input.receipt_currency}.`,
    };
  }
  if (!input.exchange_rate_present) {
    return {
      kind: "blocked",
      check: "currency_consistency",
      label: "Missing exchange rate",
      reason: `Receipt is in ${input.receipt_currency} but your books are in ${input.business_base_currency}. An exchange rate for the receipt date is required before saving.`,
      details: { receipt_currency: input.receipt_currency, base_currency: input.business_base_currency },
    };
  }
  return {
    kind: "review",
    check: "currency_consistency",
    label: "Foreign currency",
    reason: `Receipt in ${input.receipt_currency} converted to ${input.business_base_currency}. Please confirm the exchange rate is correct.`,
    details: { receipt_currency: input.receipt_currency, base_currency: input.business_base_currency },
  };
}

/** Sanity-checks the receipt date: not in the future, not before the business
 *  started, not implausibly old without confirmation. */
export type TaxPeriodInput = {
  receipt_date: string;             // ISO date
  today: string;                    // ISO date (injected for determinism)
  business_started_on?: string | null;
  /** Days into the future beyond which we hard-block (default 1 — small clock skew allowed). */
  futureBlockDays?: number;
  /** Days in the past beyond which we flag review (default 365). */
  reviewOlderThanDays?: number;
  /** Days beyond business start into the past we hard-block (default 0 — no receipts before business existed). */
  preExistenceBlock?: boolean;
};

export function taxPeriodCheck(input: TaxPeriodInput): ValidationResult {
  const futureBlock = input.futureBlockDays ?? 1;
  const reviewOlder = input.reviewOlderThanDays ?? 365;
  const preBlock = input.preExistenceBlock ?? true;

  const rDate = Date.parse(input.receipt_date);
  const today = Date.parse(input.today);
  if (!Number.isFinite(rDate) || !Number.isFinite(today)) {
    return {
      kind: "blocked",
      check: "tax_period",
      label: "Bad date",
      reason: "Could not parse the receipt date.",
      details: { receipt_date: input.receipt_date, today: input.today },
    };
  }

  const dayMs = 24 * 60 * 60 * 1000;
  const daysInFuture = Math.round((rDate - today) / dayMs);
  const daysInPast = Math.round((today - rDate) / dayMs);

  if (daysInFuture > futureBlock) {
    return {
      kind: "blocked",
      check: "tax_period",
      label: "Future date",
      reason: `Receipt date is ${daysInFuture} days in the future. Please recheck.`,
      details: { receipt_date: input.receipt_date, days_in_future: daysInFuture },
    };
  }

  if (input.business_started_on && preBlock) {
    const started = Date.parse(input.business_started_on);
    if (Number.isFinite(started) && rDate < started) {
      return {
        kind: "blocked",
        check: "tax_period",
        label: "Before business started",
        reason: `Receipt date (${input.receipt_date}) is before the business's recorded start date (${input.business_started_on}). If this is a legitimate pre-trading expense, record it via the accountant workspace with an adjustment posting.`,
        details: { receipt_date: input.receipt_date, business_started_on: input.business_started_on },
      };
    }
  }

  if (daysInPast > reviewOlder) {
    return {
      kind: "review",
      check: "tax_period",
      label: "Old receipt",
      reason: `Receipt date is ${daysInPast} days old (${Math.round(daysInPast / 30)} months). Please confirm you want to record it in the current period.`,
      details: { receipt_date: input.receipt_date, days_in_past: daysInPast },
    };
  }

  return {
    kind: "verified",
    check: "tax_period",
    label: "Date OK",
    reason: `Receipt dated ${input.receipt_date}.`,
    details: { receipt_date: input.receipt_date },
  };
}

/** Flags suspicious round totals with zero VAT — typically indicates an
 *  estimate or draft, not a real receipt. Weak heuristic — always review, never block. */
export type RoundNumberHeuristicInput = {
  gross_amount: number;
  vat_amount: number;
  supplier_is_vat_registered?: boolean | null;
};

export function roundNumberHeuristicCheck(input: RoundNumberHeuristicInput): ValidationResult {
  const isRound = input.gross_amount >= 50 && input.gross_amount % 50 === 0;
  const vatIsZero = input.vat_amount === 0;
  const supplierIsVATReg = input.supplier_is_vat_registered === true;

  if (isRound && vatIsZero && supplierIsVATReg) {
    return {
      kind: "review",
      check: "round_number_heuristic",
      label: "Unusual",
      reason: `£${input.gross_amount.toFixed(2)} round total with no VAT from a VAT-registered supplier is unusual. Confirm this isn't an estimate or a receipt without VAT breakdown.`,
      details: { gross: input.gross_amount, vat: input.vat_amount },
    };
  }
  return {
    kind: "verified",
    check: "round_number_heuristic",
    label: "OK",
    reason: "Amount pattern is normal.",
  };
}

/** VAT number format check per jurisdiction. */
export type VatNumberFormatInput = {
  vat_number: string | null | undefined;
  country_code: string;                // ISO 3166-1 alpha-2 e.g. "GB", "IE", "AU", "US"
  required?: boolean;                  // Set true if the receipt should have a VAT number
};

const VAT_PATTERNS: Record<string, RegExp> = {
  // UK: 9 or 12 digits, optionally prefixed with GB; also GBGD (gov't dept) + GBHA (health authority) variants
  GB: /^(GB)?(\d{9}|\d{12}|(GD|HA)\d{3})$/,
  // Ireland: 7-8 chars, letter+digits+letter mix — several accepted patterns
  IE: /^(IE)?(\d{7}[A-Z]{1,2}|\d[A-Z]\d{5}[A-Z]|\d{7}[A-Z]W?)$/,
  // Australia ABN: 11 digits with checksum (we validate length + numeric only here; full checksum is a separate check)
  AU: /^\d{11}$/,
};

export function vatNumberFormatCheck(input: VatNumberFormatInput): ValidationResult {
  const vat = (input.vat_number ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (!vat) {
    if (input.required) {
      return {
        kind: "review",
        check: "vat_number_format",
        label: "Missing VAT number",
        reason: `A VAT/GST/ABN number is expected on this receipt for ${input.country_code} — please confirm none was shown.`,
      };
    }
    return {
      kind: "verified",
      check: "vat_number_format",
      label: "N/A",
      reason: "No VAT/GST/ABN number provided (not required).",
    };
  }
  const pattern = VAT_PATTERNS[input.country_code];
  if (!pattern) {
    // Unknown jurisdiction — we can't validate format. Flag review so the
    // owner or accountant can confirm.
    return {
      kind: "review",
      check: "vat_number_format",
      label: "Unverified format",
      reason: `We don't yet check tax-number format for ${input.country_code}. Please confirm this looks right.`,
      details: { vat_number: vat, country_code: input.country_code },
    };
  }
  if (pattern.test(vat)) {
    return {
      kind: "verified",
      check: "vat_number_format",
      label: "Format OK",
      reason: `Tax number matches ${input.country_code} format.`,
    };
  }
  return {
    kind: "review",
    check: "vat_number_format",
    label: "Bad format",
    reason: `Tax number "${vat}" doesn't match the expected ${input.country_code} format. Please recheck.`,
    details: { vat_number: vat, country_code: input.country_code },
  };
}

// ── Internal helpers ────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s&]/g, "")
    .trim();
}
