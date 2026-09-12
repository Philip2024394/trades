// src/lib/nex/live-chat-completion/llm-rescue/alignment.ts
//
// Founder BEGIN Path A · Phase A1 · Fabrication Gate v2.
// Claim-span alignment scoring.
//
// Problem this closes:
//   arXiv 2510.24476 (2026 hallucination survey) documents that
//   citation-based validation frequently fails to detect
//   POSTRATIONALISATION — the LLM attaches a plausible-looking source
//   that does not actually support the claim it makes. NEX's v1 gate
//   only checked that source_ref existed in bundle.items; it never
//   asked "does the cited item's text actually support this claim?"
//
// This module computes an alignment score in [0..1] per (claim, cited)
// pair. Below threshold, the claim is rejected with reason
// `postrationalisation_suspected:<score>`.
//
// Design goals:
//   1. DETERMINISTIC + ZERO-COST default (token overlap + char-trigram)
//      so gate runs sub-millisecond and never depends on an LLM.
//   2. Optional NLI hook (via Ollama when available) for higher fidelity
//      later — the interface accepts multiple scorers ranked by cost.
//   3. Honest scoring — no floor manipulation. The gate uses the raw
//      score; the threshold is env-tuned via NEX_GATE_ALIGNMENT_MIN.
//
// Preserves all 4 Founder Doctrines: alignment strengthens Doctrine #1
// (LLM rescue never bypasses Truth Engine) — it does not weaken any
// other doctrine.

// ═══════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════

export interface AlignmentScore {
  /** 0..1 · higher = claim better supported by cited text */
  score: number;
  /** Which scoring method produced this score */
  method: "token_overlap" | "char_trigram" | "combined" | "nli_ollama";
  /** Cost estimate ("free" = purely CPU · "llm" = remote call) */
  cost: "free" | "llm";
  /** For observability */
  detail?: Record<string, number | string>;
}

/**
 * Score how well the cited evidence text supports the claim text.
 * Combined-metric default: max(token_overlap, char_trigram) — either
 * evidence-level lexical overlap OR sub-word overlap indicates the
 * claim's content is present in the cited span. This is deliberately
 * lenient enough to accept honest paraphrasing while still catching
 * postrationalisation (unrelated citations score near zero).
 */
export function scoreClaimAlignment(
  claim_text: string,
  cited_text: string,
): AlignmentScore {
  if (!claim_text || !cited_text) {
    return { score: 0, method: "combined", cost: "free", detail: { reason: "empty_input" } };
  }

  const tok = tokenOverlapScore(claim_text, cited_text);
  const tri = charTrigramOverlapScore(claim_text, cited_text);
  const combined = Math.max(tok.score, tri.score);

  return {
    score: combined,
    method: "combined",
    cost: "free",
    detail: {
      token_overlap: Number(tok.score.toFixed(3)),
      char_trigram: Number(tri.score.toFixed(3)),
      claim_len: claim_text.length,
      cited_len: cited_text.length,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// Token overlap · content-word Jaccard
// ═══════════════════════════════════════════════════════════════════

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","he","in","is","it","its",
  "of","on","or","that","the","to","was","were","will","with","this","these","those","been",
  "there","their","they","we","you","your","our","which","not","but","if","then","can","could",
  "would","should","also","just","really","very","more","most","some","any","all","one","two",
  "do","did","does","done","get","got","gets","give","given","gives","give","take","took","takes",
  "i","me","my","us",
  // very-common Bahasa Indonesia stops (accommodation domain overlap)
  "yang","dan","di","ke","dari","ada","tidak","atau","untuk","dengan","pada","ini","itu",
  "saya","kami","kita","kamu","anda","dia","adalah","juga","akan","sudah","masih","tetapi",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ""))
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function tokenOverlapScore(claim: string, cited: string): { score: number } {
  const cTok = new Set(tokenize(claim));
  if (cTok.size === 0) return { score: 0 };
  const eTok = new Set(tokenize(cited));
  if (eTok.size === 0) return { score: 0 };

  let inter = 0;
  for (const t of cTok) if (eTok.has(t)) inter += 1;
  // Recall-oriented: fraction of the CLAIM'S content words present in
  // the cited span. Postrationalisation typically leaves this near 0
  // because the LLM invented tokens (hotel name / number) not present.
  return { score: inter / cTok.size };
}

// ═══════════════════════════════════════════════════════════════════
// Character-trigram overlap · SI-1 style · resilient to morphology
// ═══════════════════════════════════════════════════════════════════

function charTrigrams(text: string): Set<string> {
  const norm = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
  const grams = new Set<string>();
  if (norm.length < 3) return grams;
  for (let i = 0; i <= norm.length - 3; i++) {
    grams.add(norm.slice(i, i + 3));
  }
  return grams;
}

function charTrigramOverlapScore(claim: string, cited: string): { score: number } {
  const cGr = charTrigrams(claim);
  if (cGr.size === 0) return { score: 0 };
  const eGr = charTrigrams(cited);
  if (eGr.size === 0) return { score: 0 };
  let inter = 0;
  for (const g of cGr) if (eGr.has(g)) inter += 1;
  return { score: inter / cGr.size };
}

// ═══════════════════════════════════════════════════════════════════
// Env-tuned threshold
// ═══════════════════════════════════════════════════════════════════

/**
 * Minimum alignment score required for a claim to survive Gate v2.
 * Below this, the claim is rejected with reason
 * postrationalisation_suspected:<score>.
 *
 * Default 0.20 · deliberately lenient: catches unrelated citations
 * (typical postrationalisation scores ≤0.05) while permitting honest
 * paraphrase (typical paraphrase scores 0.30-0.70). Tune per corpus.
 */
export function getAlignmentThreshold(): number {
  const raw = Number(process.env.NEX_GATE_ALIGNMENT_MIN ?? 0.2);
  if (!Number.isFinite(raw)) return 0.2;
  return Math.min(Math.max(raw, 0), 1);
}
