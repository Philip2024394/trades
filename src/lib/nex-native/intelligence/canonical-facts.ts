// src/lib/nex-native/intelligence/canonical-facts.ts
//
// Bridge 94a · Canonical fact extraction.
// -------------------------------------------------------------------
// The Truth Gate reads from THIS module, not from the model's
// interpretation of prose evidence. Before Qwen ever sees a business,
// we transform structured rows into a stable, comparable representation:
//
//   business.hours.sunday        = CLOSED
//   product.trade_belt_pro.price = { currency: "IDR", amount_minor: 42500000 }
//   product.trade_belt_pro.stock = OUT_OF_STOCK
//
// Two consumers:
//   · deterministic-answerer  · resolves structured questions without
//     invoking the model at all
//   · claim-detector          · compares a model-generated reply against
//     these facts to catch contradictions like Q07 (Sunday=OPEN)
//
// Design rules:
//   · Sync · pure · no DB · no LLM · no I/O. Callers pass rows in.
//   · Structured columns win over free-text columns. hours (jsonb)
//     is authoritative; hours_display (text) is a fallback parser.
//   · Every fact carries provenance so the answerer can cite it.
//   · Fact keys are stable lowercased slugs so the answerer and the
//     claim-detector agree on lookups.

import type {
  NexBusinessRow,
  NexProductRow,
  NexAccountRow,
  NexWeeklyHours,
} from "../types";
import type { NexMenuItemRow } from "../menu-service";

// ─── Types ───────────────────────────────────────────────────────────

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const DAY_KEYS: readonly DayKey[] = [
  "mon", "tue", "wed", "thu", "fri", "sat", "sun",
];

/** How a day resolves in canonical form. `CLOSED` means the business
 *  is definitively closed. `null` means we don't have data — the
 *  answerer must gap, and the claim-detector cannot check that day. */
export type DayHoursCanonical =
  | { state: "OPEN"; open_hhmm: string; close_hhmm: string }
  | { state: "CLOSED" }
  | { state: "UNKNOWN" };

export interface CanonicalMoney {
  currency: string;
  /** Smallest unit — pence / sen / cents. */
  amount_minor: number;
  /** Human-facing display string — e.g. "Rp 425,000" or "GBP 4.25". */
  display: string;
}

export interface ProductFacts {
  key: string;
  product_id: string;
  name: string;
  name_tokens: Set<string>;
  price: CanonicalMoney | null;
  stock: "IN_STOCK" | "LOW_STOCK" | "MADE_TO_ORDER" | "SOLD_OUT" | "UNKNOWN";
  description: string | null;
  status: string;
}

export interface BusinessFacts {
  business_id: string;
  display_name: string;
  address: string | null;
  city: string | null;
  hours: Record<DayKey, DayHoursCanonical>;
  hours_source: "structured" | "text_display" | "none";
  accepts_cod: boolean;
  accepts_pickup: boolean;
  payment_methods: string[];
  category: string | null;
  status_message: string | null;
}

export interface PlanFact {
  key: string;
  title: string;
  monthly_price: CanonicalMoney | null;
  yearly_price: CanonicalMoney | null;
  one_time_price: CanonicalMoney | null;
}

export interface AccountFacts {
  account_id: string;
  display_name: string;
  tier: "gratis" | "bisnis" | "pro";
  bisnis_active: boolean;
  bisnis_expires_at: string | null;
}

export interface CanonicalFactSet {
  business: BusinessFacts | null;
  products: ProductFacts[];
  plans: PlanFact[];
  account: AccountFacts | null;
}

// ─── Public builders ─────────────────────────────────────────────────

export function buildBusinessFacts(row: NexBusinessRow): BusinessFacts {
  const structured = buildHoursFromStructured(row.hours);
  const fromText =
    structured.source === "none" && (row as { hours_display?: string | null }).hours_display
      ? buildHoursFromText((row as { hours_display?: string | null }).hours_display ?? null)
      : null;
  const hours = structured.source !== "none" ? structured.hours : (fromText?.hours ?? emptyHours());
  const hours_source: BusinessFacts["hours_source"] =
    structured.source !== "none" ? "structured" : fromText ? "text_display" : "none";

  return {
    business_id: row.id,
    display_name: row.display_name,
    address: (row.address ?? "").trim() || null,
    city: ((row as { city?: string | null }).city ?? "").trim() || null,
    hours,
    hours_source,
    accepts_cod: !!row.accepts_cod,
    accepts_pickup: !!row.accepts_pickup,
    payment_methods: Array.isArray(row.accepted_payment_methods)
      ? Array.from(new Set(row.accepted_payment_methods.filter(Boolean)))
      : [],
    category: row.business_category ?? null,
    status_message: (row.status_message ?? "").trim() || null,
  };
}

export function buildProductFacts(row: NexProductRow): ProductFacts {
  return {
    key: productKey(row.name),
    product_id: row.id,
    name: row.name,
    name_tokens: tokenize(row.name),
    price: {
      currency: row.currency,
      amount_minor: row.price_pence,
      display: formatMoney(row.currency, row.price_pence),
    },
    stock: normalizeStock(row.stock_status),
    description: (row.description ?? "").trim() || null,
    status: row.status,
  };
}

/** Menu items follow the same shape as products for canonical-fact
 *  purposes · price + stock + name-tokens. */
export function buildMenuItemFacts(row: NexMenuItemRow): ProductFacts {
  return {
    key: productKey(row.name),
    product_id: row.id,
    name: row.name,
    name_tokens: tokenize(row.name),
    price: {
      currency: row.currency,
      amount_minor: row.price_pence,
      display: formatMoney(row.currency, row.price_pence),
    },
    stock: "UNKNOWN",
    description: (row.description ?? "").trim() || null,
    status: row.status,
  };
}

export function buildAccountFacts(row: NexAccountRow): AccountFacts {
  const now = Date.now();
  const expiresAt = row.bisnis_expires_at ? Date.parse(row.bisnis_expires_at) : null;
  const bisnisActive =
    row.tier === "bisnis" && expiresAt !== null && expiresAt > now;
  return {
    account_id: row.id,
    display_name: row.display_name,
    tier: row.tier,
    bisnis_active: bisnisActive,
    bisnis_expires_at: row.bisnis_expires_at,
  };
}

/** Build the full canonical set that the truth gate + answerer read.
 *  All arguments optional so the gateway can call this with whatever
 *  it has already loaded. */
export function buildCanonicalFactSet(input: {
  business?: NexBusinessRow | null;
  products?: NexProductRow[];
  menuItems?: NexMenuItemRow[];
  plans?: PlanFact[];
  account?: NexAccountRow | null;
}): CanonicalFactSet {
  const products: ProductFacts[] = [];
  for (const p of input.products ?? []) products.push(buildProductFacts(p));
  for (const m of input.menuItems ?? []) products.push(buildMenuItemFacts(m));
  return {
    business: input.business ? buildBusinessFacts(input.business) : null,
    products,
    plans: input.plans ?? [],
    account: input.account ? buildAccountFacts(input.account) : null,
  };
}

// ─── Public helpers used by the answerer + claim-detector ────────────

export function productKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 1),
  );
}

/** Format money for buyer-facing copy. Indonesian rupiah shows no
 *  minor units (rupiah has no fractional coin in circulation) and
 *  uses thousands separators. Other currencies use standard
 *  <currency> <major>.<minor> form. */
export function formatMoney(currency: string, amountMinor: number): string {
  const c = currency.toUpperCase();
  if (c === "IDR") {
    const major = Math.round(amountMinor / 100);
    return `Rp ${major.toLocaleString("id-ID")}`;
  }
  const major = amountMinor / 100;
  const symbol = c === "GBP" ? "£" : c === "USD" ? "$" : c === "EUR" ? "€" : `${c} `;
  return `${symbol}${major.toFixed(2)}`;
}

/** Parse a free-text money reference from a model reply into a
 *  canonical (currency, minor) tuple. Supports:
 *    Rp 425.000 · Rp425,000 · IDR 425000 · 425k · 425rb · Rp 425k
 *    $10.00 · £4.25 · USD 12
 *  Returns null when nothing parses. */
export function parseMoneyReference(
  text: string,
): CanonicalMoney | null {
  const cleaned = text.trim();

  // Rp / IDR forms
  const rpMatch = cleaned.match(
    /(?:rp|idr)\s*([\d.,]+)\s*(k|rb|ribu|jt|juta)?/i,
  );
  if (rpMatch) {
    const digits = rpMatch[1]!.replace(/[.,]/g, "");
    let n = parseInt(digits, 10);
    if (Number.isNaN(n)) return null;
    const suffix = rpMatch[2]?.toLowerCase();
    if (suffix === "k" || suffix === "rb" || suffix === "ribu") n *= 1_000;
    else if (suffix === "jt" || suffix === "juta") n *= 1_000_000;
    return {
      currency: "IDR",
      amount_minor: n * 100,
      display: `Rp ${n.toLocaleString("id-ID")}`,
    };
  }

  // Trailing k / rb form ("425k" · "425rb")
  const suffixOnly = cleaned.match(/^([\d.,]+)\s*(k|rb|ribu|jt|juta)$/i);
  if (suffixOnly) {
    const digits = suffixOnly[1]!.replace(/[.,]/g, "");
    let n = parseInt(digits, 10);
    if (Number.isNaN(n)) return null;
    const suffix = suffixOnly[2]!.toLowerCase();
    if (suffix === "k" || suffix === "rb" || suffix === "ribu") n *= 1_000;
    else n *= 1_000_000;
    return {
      currency: "IDR",
      amount_minor: n * 100,
      display: `Rp ${n.toLocaleString("id-ID")}`,
    };
  }

  // $ / £ / € / USD / GBP / EUR forms
  const symMatch = cleaned.match(/([£$€])\s*([\d.,]+)/);
  const codeMatch = cleaned.match(/(usd|gbp|eur)\s*([\d.,]+)/i);
  if (symMatch || codeMatch) {
    const symbol = symMatch?.[1] ?? null;
    const code = codeMatch?.[1]?.toUpperCase() ?? null;
    const digits = (symMatch?.[2] ?? codeMatch?.[2] ?? "").replace(/,/g, "");
    const n = parseFloat(digits);
    if (Number.isNaN(n)) return null;
    const currency =
      code ??
      (symbol === "£" ? "GBP" : symbol === "$" ? "USD" : symbol === "€" ? "EUR" : "UNK");
    return {
      currency,
      amount_minor: Math.round(n * 100),
      display: `${symbol ?? currency} ${n.toFixed(2)}`,
    };
  }

  return null;
}

export function normalizeStock(
  stock: NexProductRow["stock_status"],
): ProductFacts["stock"] {
  if (stock === "in_stock") return "IN_STOCK";
  if (stock === "low_stock") return "LOW_STOCK";
  if (stock === "made_to_order") return "MADE_TO_ORDER";
  if (stock === "sold_out") return "SOLD_OUT";
  return "UNKNOWN";
}

/** Match the day name a customer used (English or Indonesian) to a
 *  canonical DayKey. Returns null for anything ambiguous. */
export function matchDayKey(text: string): DayKey | null {
  const t = text.toLowerCase();
  if (/^mon(day)?$/.test(t) || /^senin$/.test(t)) return "mon";
  if (/^tue(s(day)?)?$/.test(t) || /^selasa$/.test(t)) return "tue";
  if (/^wed(nesday)?$/.test(t) || /^rabu$/.test(t)) return "wed";
  if (/^thu(r(s(day)?)?)?$/.test(t) || /^kamis$/.test(t)) return "thu";
  if (/^fri(day)?$/.test(t) || /^jumat$/.test(t) || /^jum'at$/.test(t)) return "fri";
  if (/^sat(urday)?$/.test(t) || /^sabtu$/.test(t)) return "sat";
  if (/^sun(day)?$/.test(t) || /^minggu$/.test(t)) return "sun";
  return null;
}

const DAY_ENGLISH: Record<DayKey, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday",
  thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};

export function dayLabelEnglish(day: DayKey): string {
  return DAY_ENGLISH[day];
}

// ─── Internal helpers ────────────────────────────────────────────────

function emptyHours(): Record<DayKey, DayHoursCanonical> {
  return {
    mon: { state: "UNKNOWN" }, tue: { state: "UNKNOWN" },
    wed: { state: "UNKNOWN" }, thu: { state: "UNKNOWN" },
    fri: { state: "UNKNOWN" }, sat: { state: "UNKNOWN" },
    sun: { state: "UNKNOWN" },
  };
}

function buildHoursFromStructured(
  hours: NexWeeklyHours | null,
): { source: "structured" | "none"; hours: Record<DayKey, DayHoursCanonical> } {
  if (!hours) return { source: "none", hours: emptyHours() };
  const out = emptyHours();
  let any = false;
  for (const d of DAY_KEYS) {
    const cell = hours[d];
    if (cell === null) {
      out[d] = { state: "CLOSED" };
      any = true;
    } else if (cell && typeof cell.open === "string" && typeof cell.close === "string") {
      out[d] = { state: "OPEN", open_hhmm: cell.open, close_hhmm: cell.close };
      any = true;
    }
  }
  return { source: any ? "structured" : "none", hours: out };
}

/** Best-effort parser for a text hours_display like:
 *    "Monday-Friday 08:00-17:00 · Saturday 08:00-13:00 · Sunday closed"
 *  Returns UNKNOWN for any day it can't parse. */
function buildHoursFromText(
  text: string | null,
): { hours: Record<DayKey, DayHoursCanonical> } | null {
  if (!text || !text.trim()) return null;
  const out = emptyHours();
  const parts = text.split(/[·|,;\n]+/).map((p) => p.trim()).filter(Boolean);
  const rangeRe = /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/;
  const closedRe = /\b(closed|tutup)\b/i;
  const dayNameMap: Record<string, DayKey> = {
    monday: "mon", tuesday: "tue", wednesday: "wed",
    thursday: "thu", friday: "fri", saturday: "sat", sunday: "sun",
    senin: "mon", selasa: "tue", rabu: "wed",
    kamis: "thu", jumat: "fri", sabtu: "sat", minggu: "sun",
    mon: "mon", tue: "tue", wed: "wed",
    thu: "thu", fri: "fri", sat: "sat", sun: "sun",
  };
  for (const part of parts) {
    const lower = part.toLowerCase();
    const dayHits: DayKey[] = [];
    // Range like "monday-friday" or "senin-jumat"
    const rangeM = lower.match(/([a-z]{3,9})\s*[-–]\s*([a-z]{3,9})/);
    if (rangeM) {
      const from = dayNameMap[rangeM[1]!];
      const to = dayNameMap[rangeM[2]!];
      if (from && to) {
        const startIdx = DAY_KEYS.indexOf(from);
        const endIdx = DAY_KEYS.indexOf(to);
        if (startIdx >= 0 && endIdx >= startIdx) {
          for (let i = startIdx; i <= endIdx; i += 1) dayHits.push(DAY_KEYS[i]!);
        }
      }
    }
    if (dayHits.length === 0) {
      for (const [name, key] of Object.entries(dayNameMap)) {
        const re = new RegExp(`\\b${name}\\b`);
        if (re.test(lower) && !dayHits.includes(key)) dayHits.push(key);
      }
    }
    if (dayHits.length === 0) continue;
    if (closedRe.test(lower)) {
      for (const d of dayHits) out[d] = { state: "CLOSED" };
      continue;
    }
    const rm = lower.match(rangeRe);
    if (rm) {
      for (const d of dayHits) {
        out[d] = { state: "OPEN", open_hhmm: rm[1]!, close_hhmm: rm[2]! };
      }
    }
  }
  return { hours: out };
}
