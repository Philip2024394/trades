// src/lib/nex-native/intelligence/claim-detector.ts
//
// Bridge 94c · The Truth Gate.
// -------------------------------------------------------------------
// A model reply enters, canonical facts enter, and we return a
// verdict: either "no contradiction" (green-light persistence) or a
// list of specific contradictions that must be surfaced to the caller
// so the gateway can correction-retry once and then honest-gap.
//
// The rule the audit report from Bridge 93 hardened:
//
//   Never allow path=grounded merely because the validator didn't
//   detect a fabrication. "Not caught" is NOT "grounded."
//
// The Bridge 93 P0 miss was Q07 · reply says "open on Sunday" · evidence
// says "Sunday closed" · validator only checked numeric fabrication so
// it approved a semantically false grounded reply. This module fixes
// that by extracting structured claims and comparing them.
//
// Coverage (in priority order for the Bridge 93 fixture):
//   · DAY_STATE      · "open on Sunday" vs facts.hours.sun = CLOSED
//   · DAY_HOURS      · "open Saturday 09:00-16:00" vs 08:00-13:00
//   · PRODUCT_PRICE  · "HammerPro is $10" vs Rp 185,000
//   · PRODUCT_STOCK  · "Scaffold Station V2 is in stock" vs SOLD_OUT
//   · FABRICATED_MONEY · "$50 delivery" · no matching canonical fact
//   · FABRICATED_URL   · unchanged inheritance from the existing validator
//
// Design rules:
//   · Sync · pure · no LLM · no I/O.
//   · Conservative — never flag a contradiction we're not certain of.
//     A false positive here forces a correction retry (wasted 15s) and
//     may still surface a gap. A false negative was the original bug,
//     so we tilt toward missing edge cases rather than false-alarming.
//   · Every finding names the exact fact key it disagreed with, so
//     the correction hint can quote the evidence verbatim.

import type {
  CanonicalFactSet,
  DayKey,
  ProductFacts,
  CanonicalMoney,
} from "./canonical-facts";
import {
  DAY_KEYS,
  matchDayKey,
  parseMoneyReference,
  tokenize,
} from "./canonical-facts";

export type ContradictionKind =
  | "DAY_STATE"
  | "DAY_HOURS"
  | "PRODUCT_PRICE"
  | "PRODUCT_STOCK"
  | "FABRICATED_MONEY"
  | "FABRICATED_URL";

export interface Contradiction {
  kind: ContradictionKind;
  /** Fact key that disagreed · empty for pure fabrications with no
   *  matching canonical fact. */
  fact_key: string | null;
  /** Verbatim evidence — used to build the correction hint. */
  evidence: string;
  /** What the model reply claimed. */
  model_claim: string;
  /** Substring of the reply where the contradiction was found · used
   *  in audit trails so an operator can find the offending text. */
  quote: string;
}

export interface ClaimVerdict {
  ok: boolean;
  contradictions: Contradiction[];
}

export function checkReplyAgainstFacts(
  reply: string,
  facts: CanonicalFactSet,
): ClaimVerdict {
  if (!reply || !reply.trim()) return { ok: true, contradictions: [] };
  const contradictions: Contradiction[] = [];

  contradictions.push(...detectDayStateContradictions(reply, facts));
  contradictions.push(...detectDayHoursContradictions(reply, facts));
  contradictions.push(...detectProductPriceContradictions(reply, facts));
  contradictions.push(...detectProductStockContradictions(reply, facts));
  contradictions.push(...detectFabricatedMoney(reply, facts));
  contradictions.push(...detectFabricatedUrl(reply));

  return { ok: contradictions.length === 0, contradictions };
}

/** Turn the verdict into a short correction hint we can inline into a
 *  re-generation prompt. The hint is deliberately terse — Qwen 0.5B
 *  loses focus on long system additions. */
export function buildCorrectionHint(verdict: ClaimVerdict): string {
  if (verdict.ok) return "";
  const lines: string[] = ["Your previous reply contradicts the evidence."];
  for (const c of verdict.contradictions.slice(0, 4)) {
    lines.push(`- ${c.kind}: reply said "${trunc(c.model_claim)}" but evidence is: ${c.evidence}`);
  }
  lines.push("Regenerate honestly. Do not repeat the contradicted claim.");
  return lines.join("\n");
}

// ─── DAY_STATE ──────────────────────────────────────────────────────
//
// "Yes, the business is open on ... Sunday" · "we're closed on Monday"

function detectDayStateContradictions(
  reply: string,
  facts: CanonicalFactSet,
): Contradiction[] {
  if (!facts.business) return [];
  const out: Contradiction[] = [];
  const sentences = splitSentences(reply);
  const dayNames: Record<DayKey, RegExp> = {
    mon: /\b(monday|senin)\b/i,
    tue: /\b(tuesday|selasa)\b/i,
    wed: /\b(wednesday|rabu)\b/i,
    thu: /\b(thursday|kamis)\b/i,
    fri: /\b(friday|jumat|jum'at)\b/i,
    sat: /\b(saturday|sabtu)\b/i,
    sun: /\b(sunday|minggu)\b/i,
  };
  for (const s of sentences) {
    const lower = s.toLowerCase();
    const hasOpen =
      /\b(open|opens|opening|available|trading|buka|beroperasi)\b/.test(lower);
    const hasClosed =
      /\b(closed|not open|tutup)\b/.test(lower);
    if (!hasOpen && !hasClosed) continue;
    const daysMentioned: DayKey[] = [];
    // Range detection · "Saturday and Sunday" · "Sabtu dan Minggu"
    for (const d of DAY_KEYS) if (dayNames[d].test(lower)) daysMentioned.push(d);
    // "weekends" · "akhir pekan" · "weekdays" · "hari kerja"
    if (/\bweekend(s)?\b|\bakhir pekan\b/.test(lower)) {
      if (!daysMentioned.includes("sat")) daysMentioned.push("sat");
      if (!daysMentioned.includes("sun")) daysMentioned.push("sun");
    }
    if (/\bweekday(s)?\b|\bhari kerja\b/.test(lower)) {
      for (const d of ["mon", "tue", "wed", "thu", "fri"] as DayKey[]) {
        if (!daysMentioned.includes(d)) daysMentioned.push(d);
      }
    }
    if (daysMentioned.length === 0) continue;

    // For each day the sentence claims a state, compare to canonical.
    // We distinguish an OPEN sentence from a CLOSED sentence · a
    // sentence with BOTH ("we're open Monday but closed Sunday") is
    // ambiguous by itself, so we skip.
    if (hasOpen && hasClosed) continue;
    const claimedState: "OPEN" | "CLOSED" = hasOpen ? "OPEN" : "CLOSED";

    for (const d of daysMentioned) {
      const cell = facts.business.hours[d];
      if (cell.state === "UNKNOWN") continue;
      if (cell.state === claimedState) continue;
      out.push({
        kind: "DAY_STATE",
        fact_key: `business.hours.${d}`,
        evidence:
          cell.state === "CLOSED"
            ? `${dayName(d)} = CLOSED`
            : `${dayName(d)} = OPEN ${cell.open_hhmm}-${cell.close_hhmm}`,
        model_claim: `${dayName(d)} = ${claimedState}`,
        quote: s.trim().slice(0, 160),
      });
    }
  }
  return out;
}

// ─── DAY_HOURS ──────────────────────────────────────────────────────
//
// "we're open Saturday from 09:00 to 17:00" · but canonical says 08:00-13:00

function detectDayHoursContradictions(
  reply: string,
  facts: CanonicalFactSet,
): Contradiction[] {
  if (!facts.business) return [];
  const out: Contradiction[] = [];
  const sentences = splitSentences(reply);
  const rangeRe = /(\d{1,2}[:.]\d{2})\s*(?:to|-|–|until|s\/d)\s*(\d{1,2}[:.]\d{2})/i;
  for (const s of sentences) {
    const lower = s.toLowerCase();
    const rm = lower.match(rangeRe);
    if (!rm) continue;
    const dm = findFirstDay(lower);
    if (!dm) continue;
    const cell = facts.business.hours[dm];
    if (cell.state !== "OPEN") continue;
    const claimedOpen = normalizeHhmm(rm[1]!);
    const claimedClose = normalizeHhmm(rm[2]!);
    if (
      claimedOpen === cell.open_hhmm &&
      claimedClose === cell.close_hhmm
    ) continue;
    out.push({
      kind: "DAY_HOURS",
      fact_key: `business.hours.${dm}`,
      evidence: `${dayName(dm)} = OPEN ${cell.open_hhmm}-${cell.close_hhmm}`,
      model_claim: `${dayName(dm)} = OPEN ${claimedOpen}-${claimedClose}`,
      quote: s.trim().slice(0, 160),
    });
  }
  return out;
}

// ─── PRODUCT_PRICE ──────────────────────────────────────────────────
//
// "HammerPro 16oz is $10" vs canonical Rp 185,000

function detectProductPriceContradictions(
  reply: string,
  facts: CanonicalFactSet,
): Contradiction[] {
  const out: Contradiction[] = [];
  if (facts.products.length === 0) return out;
  const sentences = splitSentences(reply);
  for (const s of sentences) {
    const money = extractAllMoney(s);
    if (money.length === 0) continue;
    const p = findMentionedProduct(s, facts.products);
    if (!p || !p.price) continue;
    // If ANY money figure in the sentence matches canonical, we accept
    // it. Only flag when NONE match — this tolerates replies like
    // "HammerPro is Rp 185,000 (about $12 USD)" even though $12 isn't
    // canonical.
    const anyMatch = money.some((m) => moneyMatches(m, p.price!));
    if (anyMatch) continue;
    out.push({
      kind: "PRODUCT_PRICE",
      fact_key: `product.${p.key}.price`,
      evidence: `${p.name} = ${p.price.display}`,
      model_claim: `${p.name} = ${money.map((m) => m.display).join(" or ")}`,
      quote: s.trim().slice(0, 160),
    });
  }
  return out;
}

// ─── PRODUCT_STOCK ──────────────────────────────────────────────────

function detectProductStockContradictions(
  reply: string,
  facts: CanonicalFactSet,
): Contradiction[] {
  const out: Contradiction[] = [];
  if (facts.products.length === 0) return out;
  const sentences = splitSentences(reply);
  for (const s of sentences) {
    const lower = s.toLowerCase();
    const claimedIn = /\b(in stock|available|tersedia|masih ada)\b/.test(lower);
    const claimedOut = /\b(sold out|out of stock|not available|unavailable|habis|tidak tersedia)\b/.test(lower);
    if (!claimedIn && !claimedOut) continue;
    const p = findMentionedProduct(s, facts.products);
    if (!p) continue;
    if (p.stock === "UNKNOWN") continue;
    const factInStock = p.stock === "IN_STOCK" || p.stock === "LOW_STOCK";
    if (claimedIn && factInStock) continue;
    if (claimedOut && p.stock === "SOLD_OUT") continue;
    out.push({
      kind: "PRODUCT_STOCK",
      fact_key: `product.${p.key}.stock`,
      evidence: `${p.name} = ${p.stock}`,
      model_claim: `${p.name} = ${claimedIn ? "IN_STOCK" : "SOLD_OUT"}`,
      quote: s.trim().slice(0, 160),
    });
  }
  return out;
}

// ─── FABRICATED_MONEY ───────────────────────────────────────────────
//
// A currency figure the model quoted has no matching canonical fact
// AND is not immediately preceded/followed by a currency name known
// to the business (e.g. IDR is fine even if amount isn't canonical
// because it's the business currency and might refer to a legitimate
// non-cataloged number like shipping cost). Foreign currencies with
// no matching canonical price are the reliable red flag.

function detectFabricatedMoney(
  reply: string,
  facts: CanonicalFactSet,
): Contradiction[] {
  const out: Contradiction[] = [];
  const money = extractAllMoney(reply);
  if (money.length === 0) return out;
  const businessCurrencies = new Set<string>(
    facts.products.map((p) => p.price?.currency).filter((x): x is string => !!x),
  );
  const allowedCurrencies = new Set<string>(["IDR"]);
  for (const c of businessCurrencies) allowedCurrencies.add(c);
  for (const m of money) {
    const c = m.currency.toUpperCase();
    if (allowedCurrencies.has(c)) continue;
    // Foreign currency figure with no canonical match → fabrication
    const matchesAnyProduct = facts.products.some(
      (p) => p.price && moneyMatches(m, p.price),
    );
    if (matchesAnyProduct) continue;
    out.push({
      kind: "FABRICATED_MONEY",
      fact_key: null,
      evidence: `no ${c} amount is in this business's canonical facts`,
      model_claim: m.display,
      quote: `contains foreign-currency figure ${m.display}`,
    });
  }
  return out;
}

// ─── FABRICATED_URL ─────────────────────────────────────────────────

function detectFabricatedUrl(reply: string): Contradiction[] {
  const urls = reply.match(/https?:\/\/[^\s)]+/gi) ?? [];
  if (urls.length === 0) return [];
  return urls.map((u) => ({
    kind: "FABRICATED_URL" as const,
    fact_key: null,
    evidence: "no URL is provided in the canonical facts for this business",
    model_claim: u,
    quote: u,
  }));
}

// ─── Helpers ─────────────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findFirstDay(text: string): DayKey | null {
  const words = text.match(/\b[a-z']+\b/g) ?? [];
  for (const w of words) {
    const d = matchDayKey(w);
    if (d) return d;
  }
  return null;
}

function normalizeHhmm(s: string): string {
  const [h, m] = s.replace(".", ":").split(":");
  return `${(h ?? "00").padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}

function dayName(d: DayKey): string {
  return { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" }[d];
}

function findMentionedProduct(
  sentence: string,
  products: readonly ProductFacts[],
): ProductFacts | null {
  const qTokens = tokenize(sentence);
  let best: { p: ProductFacts; score: number } | null = null;
  for (const p of products) {
    let hits = 0;
    for (const t of p.name_tokens) if (qTokens.has(t)) hits += 1;
    if (hits === 0) continue;
    const score = hits / p.name_tokens.size;
    if (!best || score > best.score) best = { p, score };
  }
  if (!best) return null;
  return best.score >= 0.5 ? best.p : null;
}

/** Scan a string for ALL money mentions. Uses parseMoneyReference on
 *  a sliding window of matches so mixed prose works. */
function extractAllMoney(text: string): CanonicalMoney[] {
  const out: CanonicalMoney[] = [];
  const seen = new Set<string>();
  const patterns = [
    /(?:rp|idr)\s*[\d.,]+(?:\s*(?:k|rb|ribu|jt|juta))?/gi,
    /[£$€]\s*[\d.,]+/g,
    /(?:usd|gbp|eur)\s*[\d.,]+/gi,
    /\b[\d.,]+\s*(?:k|rb|ribu|jt|juta)\b/gi,
  ];
  for (const re of patterns) {
    const matches = text.match(re) ?? [];
    for (const raw of matches) {
      const parsed = parseMoneyReference(raw);
      if (!parsed) continue;
      const key = `${parsed.currency}:${parsed.amount_minor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(parsed);
    }
  }
  return out;
}

function moneyMatches(a: CanonicalMoney, b: CanonicalMoney): boolean {
  if (a.currency.toUpperCase() !== b.currency.toUpperCase()) return false;
  // Allow ±1 minor unit for rounding drift when parsing "Rp 185.000"
  // vs "185,000" etc.
  return Math.abs(a.amount_minor - b.amount_minor) <= 1;
}

function trunc(s: string): string {
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}
