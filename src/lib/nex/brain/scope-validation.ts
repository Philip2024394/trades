// src/lib/nex/brain/scope-validation.ts
//
// G24 · Scope-Validated Evidence Guard
// Philip 2026-09-05 · AUTHORIZE · NEX G24 SCOPE-VALIDATED EVIDENCE
//
// PROBLEM
//   User asks a narrowly-scoped question (e.g. "tell me about seafood in
//   Japan"). Retrieval returns k>0 records that lexically match "seafood"
//   but the records are about Indonesia, not Japan. Because k>0, the
//   existing zero-evidence guard does not fire. The LLM composer then
//   generates plausible-but-unsupported claims about Japanese seafood.
//
// INVARIANT (locked)
//   RETRIEVAL PRESENCE ≠ EVIDENCE PRESENCE.
//   NEX may only speak a substantive factual/domain claim when the
//   retrieved evidence is scope-valid for the user's actual question.
//
// APPROACH
//   1. Extract QUESTION SCOPE — named "anchors" the user pinned:
//        places / countries / regions / brands / other proper nouns
//   2. Extract EVIDENCE SCOPE — which anchors are actually mentioned
//      (word-boundary) in the retrieved knowledge corpus
//   3. Classify: SUPPORTED · PARTIALLY_SUPPORTED · IRRELEVANT · NO_EVIDENCE
//   4. Gate: emit honest boundary when scope is not sufficiently covered
//
// SCOPE
//   General-purpose. NO per-case keyword rules ("if Japan + tuna → X").
//   The mechanism scales to any place/brand anchor without new rules.
//
// PRESERVATION
//   · P0 zero-evidence guard: unaffected (fires when k=0 anyway)
//   · P0.3 hotel resolved-reference continuity: unaffected (structural
//     accommodation composer bypasses this block)
//   · P0.4 fresh-conv ordinal gate: unaffected (runs BEFORE this gate)
//   · Result-followup gate: unaffected (runs BEFORE this gate)
//   · Claim verifier: unaffected (runs AFTER composition; this gate
//     runs BEFORE composition and is complementary)

// ─── Types ──────────────────────────────────────────────────────

export type AnchorKind = "place" | "brand" | "proper_noun";

export type QuestionAnchor = { token: string; kind: AnchorKind };

export type QuestionScope = {
  original_message: string;
  anchors: QuestionAnchor[];
};

export type EvidenceScope = {
  covered_anchors: string[];
  missing_anchors: string[];
};

export type ScopeStatus =
  | "SUPPORTED"
  | "PARTIALLY_SUPPORTED"
  | "IRRELEVANT"
  | "NO_EVIDENCE";

export type ScopeValidation = {
  status: ScopeStatus;
  question_scope: QuestionScope;
  evidence_scope: EvidenceScope;
  reason: string;
};

/** Minimal shape of retrieved knowledge records the gate needs. */
export type KnowledgeRecord = {
  topic?: string;
  content?: string;
  source?: string;
  region?: string;
  id?: string;
};

// ─── Anchor dictionaries ────────────────────────────────────────
//
// Explicit lists so we know exactly what NEX recognises as a named
// anchor. Kept small and inspectable. Extensions live here — the
// classifier itself does not grow.

/** Places NEX may reasonably encounter as question anchors.
 *  Includes Indonesian places (in-scope) AND common out-of-scope
 *  countries/cities (the fabrication risk zone). */
const KNOWN_PLACES: ReadonlySet<string> = new Set([
  // Indonesia · cities & regions
  "yogyakarta", "jogja", "bali", "jakarta", "bandung", "semarang",
  "surabaya", "medan", "makassar", "malang", "solo", "bogor",
  "malioboro", "prawirotaman", "kuta", "seminyak", "ubud", "canggu",
  "sanur", "denpasar", "lombok", "sumatra", "java", "borneo", "sulawesi",
  "papua", "flores", "aceh",
  // Indonesian adjectival forms
  "indonesian",
  // Common out-of-scope countries · high fabrication risk
  "japan", "china", "korea", "singapore", "thailand", "vietnam",
  "malaysia", "philippines", "australia", "usa", "uk", "france",
  "germany", "italy", "spain", "portugal", "netherlands", "sweden",
  "norway", "denmark", "finland", "russia", "india", "pakistan",
  "bangladesh", "brazil", "argentina", "mexico", "canada",
  // Common out-of-scope adjectival forms
  "japanese", "chinese", "korean", "thai", "vietnamese", "malaysian",
  "filipino", "australian", "american", "british", "french", "german",
  "italian", "spanish", "portuguese", "dutch", "swedish", "russian",
  "indian", "brazilian", "mexican", "canadian",
  // Common out-of-scope cities
  "tokyo", "osaka", "kyoto", "sapporo", "bangkok", "phuket", "chiangmai",
  "kuala", "lumpur", "manila", "hanoi", "saigon", "beijing", "shanghai",
  "seoul", "busan", "sydney", "melbourne", "london", "paris", "berlin",
  "rome", "madrid", "amsterdam", "new", "york",
  // Regions
  "europe", "asia", "america", "africa", "oceania", "scandinavia",
]);

/** Brand-name anchors — user references to specific commercial or
 *  categorical brands the retrieval must actually contain. */
const KNOWN_BRANDS: ReadonlySet<string> = new Set([
  "michelin",
  "marriott", "hilton", "hyatt", "sheraton", "novotel", "ibis",
  "airbnb", "booking.com", "expedia", "traveloka", "agoda", "trivago",
  "grab", "gojek",
  "starbucks", "mcdonald", "mcdonalds", "kfc", "burger king",
]);

/** Multi-word place bigrams that must be detected as single anchors. */
const KNOWN_PLACE_BIGRAMS: ReadonlySet<string> = new Set([
  "kuala lumpur", "ho chi minh", "chiang mai", "new york",
  "tel aviv", "hong kong", "cape town", "buenos aires",
]);

// ─── Tokenisation (case-preserving for proper-noun heuristic) ───

function tokens(message: string): string[] {
  return (message || "")
    .replace(/[?.!,;:"“”'’()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function lowerTokens(message: string): string[] {
  return tokens(message).map((t) => t.toLowerCase());
}

function isCapitalized(token: string): boolean {
  if (!token || token.length === 0) return false;
  const c = token[0];
  return c === c.toUpperCase() && /[A-Za-z]/.test(c);
}

// ─── Question-scope extraction ──────────────────────────────────

/** Extract the anchors the user pinned in the message. Detection order:
 *  1. Multi-word bigrams from KNOWN_PLACE_BIGRAMS
 *  2. Single-word places from KNOWN_PLACES
 *  3. Brands from KNOWN_BRANDS
 *  4. Mid-sentence capitalized tokens (proper-noun heuristic) — excludes
 *     the first token because English sentences capitalize sentence-initially.
 *     Also excludes single-letter tokens and common English words that
 *     might appear capitalized. */
export function extractQuestionScope(message: string): QuestionScope {
  const t = tokens(message);
  const lower = t.map((x) => x.toLowerCase());
  const anchors: QuestionAnchor[] = [];
  const seen = new Set<string>();

  // Pass 1 · bigram places
  for (let i = 0; i < lower.length - 1; i++) {
    const bigram = `${lower[i]} ${lower[i + 1]}`;
    if (KNOWN_PLACE_BIGRAMS.has(bigram) && !seen.has(bigram)) {
      anchors.push({ token: bigram, kind: "place" });
      seen.add(bigram);
      // Mark both single-word constituents as consumed to avoid
      // duplicating them as separate anchors.
      seen.add(lower[i]);
      seen.add(lower[i + 1]);
    }
  }

  // Pass 2 · single-word places / brands / proper-noun heuristic
  for (let i = 0; i < t.length; i++) {
    const raw = t[i];
    const low = lower[i];
    if (seen.has(low)) continue;
    if (KNOWN_PLACES.has(low)) {
      anchors.push({ token: low, kind: "place" });
      seen.add(low);
      continue;
    }
    if (KNOWN_BRANDS.has(low)) {
      anchors.push({ token: low, kind: "brand" });
      seen.add(low);
      continue;
    }
    // Proper-noun heuristic. Skip the first token (sentence-initial
    // capitalization). Require length > 2 to exclude "I", "A" etc.
    // Skip common function words that could appear capitalized.
    if (i > 0 && isCapitalized(raw) && raw.length > 2 && !STOP_CAPS.has(low)) {
      anchors.push({ token: low, kind: "proper_noun" });
      seen.add(low);
    }
  }

  return { original_message: message, anchors };
}

/** Capitalized tokens that are NOT anchors (function words · common
 *  words that get capitalized inside a sentence for emphasis / titles). */
const STOP_CAPS: ReadonlySet<string> = new Set([
  "the", "and", "but", "for", "not", "yes", "why", "how", "what",
  "when", "where", "who", "which", "can", "will", "would", "could",
  "should", "may", "might", "must", "shall", "have", "has", "had",
  "does", "did", "was", "were", "are", "is", "be", "been", "being",
  "our", "your", "their", "his", "her", "its", "this", "that", "these",
  "those", "here", "there", "them", "him", "us",
]);

// ─── Evidence-scope extraction ──────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildCorpus(records: readonly KnowledgeRecord[]): string {
  return records
    .map((r) => [r.topic, r.content, r.source, r.region].filter(Boolean).join(" "))
    .join(" ")
    .toLowerCase();
}

/** For each anchor, does the corpus contain the anchor as a
 *  word-bounded match? Word boundaries prevent "japan" from
 *  matching "japanese" (which is a strong-but-distinct signal
 *  handled by its own anchor lemma in KNOWN_PLACES). */
export function extractEvidenceScope(
  records: readonly KnowledgeRecord[],
  anchors: readonly QuestionAnchor[],
): EvidenceScope {
  const corpus = buildCorpus(records);
  const covered: string[] = [];
  const missing: string[] = [];
  for (const a of anchors) {
    const rx = new RegExp(`\\b${escapeRegex(a.token)}\\b`, "i");
    if (rx.test(corpus)) covered.push(a.token);
    else missing.push(a.token);
  }
  return { covered_anchors: covered, missing_anchors: missing };
}

// ─── Full validation ────────────────────────────────────────────

export function validateScope(
  message: string,
  records: readonly KnowledgeRecord[],
): ScopeValidation {
  const question_scope = extractQuestionScope(message);

  // NO retrieval at all → NO_EVIDENCE. The zero-evidence guard handles
  // this case downstream · scope validation just reports it.
  if (records.length === 0) {
    return {
      status: "NO_EVIDENCE",
      question_scope,
      evidence_scope: {
        covered_anchors: [],
        missing_anchors: question_scope.anchors.map((a) => a.token),
      },
      reason: "no_retrieval",
    };
  }

  // No question anchors → nothing to validate against. This is the
  // FALSE-POSITIVE PROTECTION path: broad questions like "how much
  // does a hotel cost" have no place-name anchor, so we must NOT
  // reject them. Fall through as SUPPORTED with the reason recorded
  // so downstream/observability knows why validation was skipped.
  if (question_scope.anchors.length === 0) {
    return {
      status: "SUPPORTED",
      question_scope,
      evidence_scope: { covered_anchors: [], missing_anchors: [] },
      reason: "no_scope_anchors_to_validate",
    };
  }

  const evidence_scope = extractEvidenceScope(records, question_scope.anchors);
  const total = question_scope.anchors.length;
  const covered = evidence_scope.covered_anchors.length;

  if (covered === 0) {
    return {
      status: "IRRELEVANT",
      question_scope,
      evidence_scope,
      reason: `no_anchors_covered:${evidence_scope.missing_anchors.join(",")}`,
    };
  }
  if (covered < total) {
    return {
      status: "PARTIALLY_SUPPORTED",
      question_scope,
      evidence_scope,
      reason: `${covered}/${total}_anchors_covered:missing=${evidence_scope.missing_anchors.join(",")}`,
    };
  }
  return {
    status: "SUPPORTED",
    question_scope,
    evidence_scope,
    reason: `all_${total}_anchors_covered`,
  };
}

// ─── Gate decision (used by the response path) ──────────────────

export type ScopeGateDecision =
  | { shouldGate: false; validation: ScopeValidation }
  | {
      shouldGate: true;
      validation: ScopeValidation;
      /** IRRELEVANT or PARTIALLY_SUPPORTED. NEX must NOT invoke the
       *  LLM composer on this evidence set. Downstream code should
       *  empty the hits (letting the zero-evidence guard fire) or
       *  emit the boundary reply directly. */
    };

export function decideScopeGate(input: {
  message: string;
  records: readonly KnowledgeRecord[];
}): ScopeGateDecision {
  const validation = validateScope(input.message, input.records);
  if (validation.status === "IRRELEVANT" || validation.status === "PARTIALLY_SUPPORTED") {
    return { shouldGate: true, validation };
  }
  return { shouldGate: false, validation };
}

/** Deterministic honest-boundary reply for scope-invalid retrieval.
 *  Called only when decideScopeGate returns shouldGate=true. Never
 *  fabricates: names only anchors from the question, cites what NEX
 *  does not have. Voice-safe · ends with punctuation. */
export function buildScopeBoundaryReply(
  validation: ScopeValidation,
  ownerLanguage: "en" | "id",
): string {
  const missing = validation.evidence_scope.missing_anchors[0] ?? "that topic";
  const covered = validation.evidence_scope.covered_anchors[0];
  if (ownerLanguage === "id") {
    if (validation.status === "PARTIALLY_SUPPORTED" && covered) {
      return `NEX belum memiliki informasi terverifikasi tentang ${missing} di ${covered}. Ingin mencoba topik lain?`;
    }
    return `NEX belum memiliki informasi terverifikasi tentang ${missing}. Ingin mencoba topik Indonesia yang bisa saya bantu — makanan, wilayah, wisata, atau transportasi?`;
  }
  if (validation.status === "PARTIALLY_SUPPORTED" && covered) {
    return `NEX doesn't have verified ${missing}-specific information for ${covered} at the moment. Want to try a different angle?`;
  }
  return `NEX doesn't have verified information about ${missing} at the moment. Want to try an Indonesian topic I can speak to — food, regions, tourism, or transport?`;
}
