// src/lib/nex/brain/quantity-intelligence.ts
//
// Wave 1 · Quantity / Count Intelligence
// Philip 2026-09-06 · AUTHORIZE · WAVE 1 · CONVERSATIONAL SEMANTIC CONTROL
//
// GOVERNING PRINCIPLE (§7 §8 §19)
//   Represent quantity as a semantic constraint, not raw text.
//   Never fabricate result counts. Compose correctly with G12 negation,
//   G04 reference, G15 confirmation.

import type { Lang } from "./language-state";

// ─── Types ──────────────────────────────────────────────────────

export type QuantityKind =
  | "EXACT"            // "two hotels"
  | "AT_LEAST"         // "at least three"
  | "AT_MOST"          // "no more than three"
  | "ONLY"             // "only two"
  | "INCREMENTAL"      // "two more" / "another one"
  | "ORDINAL_RANGE"    // "the first two" / "the last three"
  | "ALL"              // "all of them"
  | "NONE"             // "none of them"
  | "SEVERAL"          // "a few" / "several"
  | "MANY"             // "many"
  | "FEW"              // "few"
  | "UNSPECIFIED";

export type QuantityConstraint = {
  kind: QuantityKind;
  value?: number;              // numeric value where present
  ordinal_range?: { start: number; end: number };
  incremental_delta?: number;  // "two more" → +2
  markers: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
};

// ─── Tokenizer ──────────────────────────────────────────────────

function tokens(message: string): string[] {
  return (message || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?.!,;:"“”()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ─── Number words (EN + ID) ─────────────────────────────────────

const NUMBER_WORDS_EN: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20,
};

const NUMBER_WORDS_ID: Record<string, number> = {
  nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6,
  tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, duabelas: 12, duapuluh: 20,
};

function parseNumberToken(tok: string): number | null {
  if (/^\d+$/.test(tok)) return parseInt(tok, 10);
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS_EN, tok)) return NUMBER_WORDS_EN[tok];
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS_ID, tok)) return NUMBER_WORDS_ID[tok];
  return null;
}

// ─── Detector ───────────────────────────────────────────────────

export function detectQuantity(message: string): QuantityConstraint {
  const t = tokens(message);
  if (t.length === 0) {
    return { kind: "UNSPECIFIED", markers: [], confidence: "HIGH", reason: "empty" };
  }
  const markers: string[] = [];

  // ALL / NONE — highest specificity
  if (t.includes("all") || t.includes("everything") || t.includes("semua")) {
    markers.push("all");
    return { kind: "ALL", markers, confidence: "HIGH", reason: "all_marker" };
  }
  if (
    (t.includes("none") && (t.includes("of") || t.includes("them"))) ||
    t.some((x) => x === "tidak" && t.includes("ada"))
  ) {
    markers.push("none");
    return { kind: "NONE", markers, confidence: "HIGH", reason: "none_marker" };
  }

  // AT_MOST — "no more than N", "not more than N", "maximum N", "up to N",
  // "paling banyak N", "tidak lebih dari N", "hanya sampai N"
  for (let i = 0; i < t.length - 2; i++) {
    if ((t[i] === "no" || t[i] === "not" || t[i] === "tidak")
        && t[i + 1] === "more" && t[i + 2] === "than") {
      const num = i + 3 < t.length ? parseNumberToken(t[i + 3]) : null;
      if (num !== null) {
        markers.push("at_most", `${num}`);
        return { kind: "AT_MOST", value: num, markers, confidence: "HIGH", reason: "no_more_than_N" };
      }
    }
    if (t[i] === "paling" && t[i + 1] === "banyak") {
      const num = i + 2 < t.length ? parseNumberToken(t[i + 2]) : null;
      if (num !== null) {
        markers.push("at_most", `${num}`);
        return { kind: "AT_MOST", value: num, markers, confidence: "HIGH", reason: "id_paling_banyak" };
      }
    }
    if (t[i] === "tidak" && t[i + 1] === "lebih" && t[i + 2] === "dari") {
      const num = i + 3 < t.length ? parseNumberToken(t[i + 3]) : null;
      if (num !== null) {
        markers.push("at_most", `${num}`);
        return { kind: "AT_MOST", value: num, markers, confidence: "HIGH", reason: "id_tidak_lebih_dari" };
      }
    }
  }
  for (let i = 0; i < t.length - 1; i++) {
    if ((t[i] === "up" && t[i + 1] === "to")) {
      const num = i + 2 < t.length ? parseNumberToken(t[i + 2]) : null;
      if (num !== null) {
        markers.push("at_most", `${num}`);
        return { kind: "AT_MOST", value: num, markers, confidence: "MEDIUM", reason: "up_to_N" };
      }
    }
  }

  // AT_LEAST — "at least N", "minimum N", "setidaknya N"
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i] === "at" && t[i + 1] === "least") {
      const num = i + 2 < t.length ? parseNumberToken(t[i + 2]) : null;
      if (num !== null) {
        markers.push("at_least", `${num}`);
        return { kind: "AT_LEAST", value: num, markers, confidence: "HIGH", reason: "at_least_N" };
      }
    }
    if (t[i] === "setidaknya" || t[i] === "minimal") {
      const num = i + 1 < t.length ? parseNumberToken(t[i + 1]) : null;
      if (num !== null) {
        markers.push("at_least", `${num}`);
        return { kind: "AT_LEAST", value: num, markers, confidence: "HIGH", reason: "id_at_least" };
      }
    }
  }

  // ONLY — "only N" / "just N" / "hanya N"
  for (let i = 0; i < t.length - 1; i++) {
    if ((t[i] === "only" || t[i] === "just" || t[i] === "hanya")
        && parseNumberToken(t[i + 1]) !== null) {
      const num = parseNumberToken(t[i + 1])!;
      markers.push("only", `${num}`);
      return { kind: "ONLY", value: num, markers, confidence: "HIGH", reason: `${t[i]}_N` };
    }
  }

  // INCREMENTAL — "N more" / "another N" / "N more of" / "N lagi"
  for (let i = 0; i < t.length - 1; i++) {
    const num = parseNumberToken(t[i]);
    if (num !== null && t[i + 1] === "more") {
      markers.push("incremental", `+${num}`);
      return { kind: "INCREMENTAL", incremental_delta: num, value: num, markers, confidence: "HIGH", reason: "N_more" };
    }
    if (num !== null && t[i + 1] === "lagi") {
      markers.push("incremental_id", `+${num}`);
      return { kind: "INCREMENTAL", incremental_delta: num, value: num, markers, confidence: "HIGH", reason: "id_N_lagi" };
    }
  }
  // "another <N>" / "another one"
  if (t[0] === "another" && t[1]) {
    const nextNum = parseNumberToken(t[1]);
    if (nextNum !== null) {
      markers.push("another", `+${nextNum}`);
      return { kind: "INCREMENTAL", incremental_delta: nextNum, value: nextNum, markers, confidence: "HIGH", reason: "another_N" };
    }
    if (t[1] === "one") {
      markers.push("another_one");
      return { kind: "INCREMENTAL", incremental_delta: 1, value: 1, markers, confidence: "HIGH", reason: "another_one" };
    }
  }

  // ORDINAL_RANGE — "the first N" / "the last N" / "N pertama" / "N terakhir"
  for (let i = 0; i < t.length - 2; i++) {
    if (t[i] === "the" && (t[i + 1] === "first" || t[i + 1] === "last")) {
      const num = parseNumberToken(t[i + 2]);
      if (num !== null) {
        markers.push(`ordinal_${t[i + 1]}`, `N=${num}`);
        return {
          kind: "ORDINAL_RANGE",
          value: num,
          ordinal_range: t[i + 1] === "first"
            ? { start: 1, end: num }
            : { start: -num, end: -1 },
          markers,
          confidence: "HIGH",
          reason: `first_last_N`,
        };
      }
    }
  }
  // Indonesian "N pertama" / "N terakhir"
  for (let i = 0; i < t.length - 1; i++) {
    const num = parseNumberToken(t[i]);
    if (num !== null && (t[i + 1] === "pertama" || t[i + 1] === "terakhir")) {
      markers.push(`ordinal_id_${t[i + 1]}`, `N=${num}`);
      return {
        kind: "ORDINAL_RANGE",
        value: num,
        ordinal_range: t[i + 1] === "pertama"
          ? { start: 1, end: num }
          : { start: -num, end: -1 },
        markers,
        confidence: "HIGH",
        reason: "id_N_pertama_terakhir",
      };
    }
  }

  // SEVERAL / MANY / FEW
  if (t.some((x) => ["several", "beberapa"].includes(x))) {
    markers.push("several");
    return { kind: "SEVERAL", markers, confidence: "MEDIUM", reason: "several_marker" };
  }
  if (t.some((x) => ["many", "banyak"].includes(x))) {
    markers.push("many");
    return { kind: "MANY", markers, confidence: "MEDIUM", reason: "many_marker" };
  }
  if (t.some((x) => ["few"].includes(x))) {
    markers.push("few");
    return { kind: "FEW", markers, confidence: "MEDIUM", reason: "few_marker" };
  }

  // EXACT — bare "N <noun>" · e.g. "two hotels", "show me three"
  for (let i = 0; i < t.length; i++) {
    const num = parseNumberToken(t[i]);
    if (num !== null && num > 0) {
      markers.push("exact", `${num}`);
      return { kind: "EXACT", value: num, markers, confidence: "MEDIUM", reason: `exact_N:${num}` };
    }
  }

  return { kind: "UNSPECIFIED", markers, confidence: "HIGH", reason: "no_quantity_marker" };
}

// ─── Gate: fresh-conv INCREMENTAL "N more" without prior result set ─
//
// "Two more" without a prior result to expand is nonsensical. Gate
// emits a clarification rather than launching a fresh search sized N.

export type QuantityGateDecision =
  | { shouldGate: false; reason: string; constraint: QuantityConstraint }
  | {
      shouldGate: true;
      reason: string;
      constraint: QuantityConstraint;
      reply: string;
      language: Lang;
    };

/** An already-presented entity from the active result set. Used by
 *  the positive-case continuation gate (D3). `presentedOffset` is
 *  1-indexed and mirrors what `capturePresentedBusinesses` produced;
 *  `refId` mirrors the original NEX-emitted refId. Non-presented
 *  positions (offset > shown-count) are treated as "not yet visible"
 *  and can be named as continuation without a fresh directory fetch. */
export type ActiveResultSetEntity = {
  raw: string;
  presentedOffset?: number;
  refId?: string;
};

export function decideQuantityGate(input: {
  userMessage: string;
  hasActiveResultSet: boolean;
  activeLanguage: Lang;
  /** NEW (Conversational Continuation Slice · D3 · Philip 2026-09-06):
   *  entities from the current active result set. When present AND
   *  `hasActiveResultSet` is true AND the constraint is INCREMENTAL,
   *  the gate emits a POSITIVE continuation reply naming entities
   *  beyond the visibly-shown top-N (default N=3, matching the
   *  accommodation composer's `realProps.slice(0, 3)` opener). */
  activeResultSetEntities?: ReadonlyArray<ActiveResultSetEntity>;
  /** NEW (Conversational Continuation Slice · D3 · Philip 2026-09-06):
   *  the number of entities that were previously VISIBLY named in the
   *  most recent NEX reply. Continuation shows entities at positions
   *  `visibleShownCount+1 .. visibleShownCount+delta`. Defaults to 3. */
  visibleShownCount?: number;
  /** NEW (Conversational Continuation Slice · D3 · Philip 2026-09-06):
   *  set by route.ts when a Wave 2 TOPIC_SHIFT with a different-vertical
   *  domain noun was detected on the same turn. When true, quantity
   *  continuation YIELDS to the topic-shift gate so
   *  "I need one more restaurant" doesn't get answered as if it were
   *  "one more hotel" (§F of the D3 safety table). */
  deferToTopicShift?: boolean;
}): QuantityGateDecision {
  const constraint = detectQuantity(input.userMessage);

  // A · defensive · fresh-conv INCREMENTAL "N more" without result set
  if (constraint.kind === "INCREMENTAL" && !input.hasActiveResultSet) {
    const reply = input.activeLanguage === "ID"
      ? `Baik — ${constraint.incremental_delta ?? 1} lagi dari apa? Saya belum menampilkan hasil apa pun untuk diperluas.`
      : `Sure — ${constraint.incremental_delta ?? 1} more of what? I haven't shown any results yet to expand on.`;
    return {
      shouldGate: true,
      reason: "incremental_without_result_set",
      constraint,
      reply,
      language: input.activeLanguage,
    };
  }

  // A · defensive · fresh-conv ORDINAL_RANGE without result set
  if (constraint.kind === "ORDINAL_RANGE" && !input.hasActiveResultSet) {
    const reply = input.activeLanguage === "ID"
      ? `Saya belum menampilkan hasil apa pun di percakapan ini. Ingin saya cari terlebih dahulu?`
      : `I haven't shown any results yet in this conversation. Want me to search first?`;
    return {
      shouldGate: true,
      reason: "ordinal_range_without_result_set",
      constraint,
      reply,
      language: input.activeLanguage,
    };
  }

  // B · POSITIVE continuation · INCREMENTAL + active result set
  // (Conversational Continuation Slice · D3 · Philip 2026-09-06)
  //
  // Requires:
  //   · constraint is INCREMENTAL from detectQuantity's semantic parse
  //     (never a phrase-match)
  //   · hasActiveResultSet is true
  //   · deferToTopicShift is NOT true — an explicit different-vertical
  //     domain noun on this turn yields to the topic-shift gate (§F)
  //   · activeResultSetEntities is provided (uses ONLY entities NEX
  //     already presented in a prior turn · no fabrication)
  if (
    constraint.kind === "INCREMENTAL"
    && input.hasActiveResultSet
    && !input.deferToTopicShift
    && input.activeResultSetEntities
    && input.activeResultSetEntities.length > 0
  ) {
    const delta = Math.max(1, constraint.incremental_delta ?? 1);
    const visibleCount = input.visibleShownCount ?? 3;
    // Sort ascending by presentedOffset · entities without offset are
    // deprioritized (placed at end).
    const sorted = [...input.activeResultSetEntities].sort((a, b) =>
      (a.presentedOffset ?? 999) - (b.presentedOffset ?? 999),
    );
    const nextEntities = sorted
      .filter((e) => (e.presentedOffset ?? 999) > visibleCount)
      .slice(0, delta);
    if (nextEntities.length > 0) {
      const names = nextEntities.map((e) => e.raw).join(", ");
      const n = nextEntities.length;
      const reply = input.activeLanguage === "ID"
        ? `Berikut ${n} lagi dari daftar: ${names}. Ada lagi yang bisa saya bantu?`
        : `Here ${n === 1 ? "is 1 more" : `are ${n} more`} from the list: ${names}. Want me to widen the search too?`;
      return {
        shouldGate: true,
        reason: `incremental_continuation:+${delta}:shown=${n}`,
        constraint,
        reply,
        language: input.activeLanguage,
      };
    }
    // Exhausted · honest boundary
    const reply = input.activeLanguage === "ID"
      ? `Itu semua yang ada dalam daftar saya saat ini. Ingin saya perluas pencarian?`
      : `That's everything I have on the current list. Want me to widen the search?`;
    return {
      shouldGate: true,
      reason: `incremental_exhausted`,
      constraint,
      reply,
      language: input.activeLanguage,
    };
  }

  return { shouldGate: false, reason: `no_gate_needed:${constraint.kind}`, constraint };
}
