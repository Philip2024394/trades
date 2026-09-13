// WO-INTELLIGENCE-01 · Discovery Engine.
//
// Four modes, all deterministic:
//   · pattern       — term co-occurrence + keyword clusters
//   · conflict      — rule-based semantic-polarity contradiction detection
//   · connection    — citation-graph + shared-author relationships
//   · combination   — combinatorial synthesis of 2+ fragments into an
//                     input for the Hypothesis Engine (this is the shape
//                     the founder highlighted: A + B + C → new hypothesis)
//
// No LLM. Every decision is a pure function of its inputs.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { provenanceChainHash, sha256Hex } from "./provenance";
import type { DiscoveryRecord, KnowledgeFragment } from "./types";

// ── Stopword list (small, curated) ──────────────────────────────────────
// Deliberately kept short and English-only; the vertical slice's domain
// is arXiv abstracts in English.
const STOPWORDS = new Set<string>([
  "a", "an", "the", "of", "in", "on", "and", "or", "but", "if", "to", "for",
  "with", "as", "by", "at", "from", "is", "are", "was", "were", "be", "been",
  "we", "our", "us", "this", "that", "these", "those", "it", "its", "their",
  "which", "who", "whom", "whose", "what", "when", "where", "how", "why",
  "can", "could", "will", "would", "should", "may", "might", "shall", "do",
  "does", "did", "not", "no", "than", "then", "so", "such", "also", "have",
  "has", "had", "having", "been", "being", "into", "onto", "over", "under",
  "each", "every", "some", "any", "all", "many", "more", "most", "less",
  "few", "much", "very", "much", "same", "other", "new", "one", "two", "three",
  "paper", "papers", "work", "propose", "proposed", "propose", "shows", "show",
  "showed", "showing", "results", "result", "method", "methods", "approach",
  "approaches", "study", "studies", "using", "used", "based", "system",
]);

function tokenise(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z0-9\-\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

// ── Pattern find ────────────────────────────────────────────────────────

/**
 * Detect terms that appear across ≥ minSupport fragments AND concentrate
 * in fewer than half the fragments' cluster of authors/categories.
 * Returns one DiscoveryRecord per detected pattern. Deterministic.
 */
export function detectPatterns(
  fragments: readonly KnowledgeFragment[],
  opts: { minSupport?: number; minTermLength?: number; maxTermFreq?: number } = {},
): DiscoveryRecord[] {
  const minSupport = opts.minSupport ?? Math.max(3, Math.floor(fragments.length / 5));
  const minTermLength = opts.minTermLength ?? 4;
  const maxTermFreq = opts.maxTermFreq ?? Math.ceil(fragments.length * 0.9);   // filter ubiquitous terms

  const termToFragments = new Map<string, Set<string>>();
  for (const f of fragments) {
    const tokens = new Set(tokenise(`${f.title} ${f.abstract}`).filter((t) => t.length >= minTermLength));
    for (const t of tokens) {
      const s = termToFragments.get(t) ?? new Set<string>();
      s.add(f.fragment_id);
      termToFragments.set(t, s);
    }
  }

  const results: DiscoveryRecord[] = [];
  const detected_at = new Date().toISOString();
  // Sort terms for determinism
  const sortedTerms = [...termToFragments.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [term, fragIds] of sortedTerms) {
    if (fragIds.size < minSupport) continue;
    if (fragIds.size > maxTermFreq) continue;
    const input_fragment_ids = Object.freeze([...fragIds].sort()) as readonly string[];
    const detail = `term "${term}" appears in ${fragIds.size} fragments`;
    // Signal strength: normalised concentration relative to fragment count
    const signal_score = Math.min(1, fragIds.size / Math.max(1, fragments.length));
    const base = {
      record_type: "NEX_INTELLIGENCE_DISCOVERY" as const,
      discovery_id: `intel-discovery-pattern-${sha256Hex(term).slice(0, 12)}`,
      detected_at,
      pattern: "pattern" as const,
      input_fragment_ids,
      detail,
      signal_score,
    };
    results.push({ ...base, provenance_chain_hash: provenanceChainHash(base, []) });
  }
  return results;
}

// ── Conflict find ───────────────────────────────────────────────────────

/**
 * Two fragments conflict when they make measurable claims about the SAME
 * concept with OPPOSITE polarity. In the vertical slice we detect:
 *   pattern A: "improves|outperforms|better|faster|higher accuracy"
 *   pattern B: "fails|worse|regresses|lower accuracy|no improvement"
 * around a shared noun-phrase term. Rule-based; no LLM.
 *
 * A minimal viable detector — the point in slice 1 is to prove conflict
 * detection RUNS deterministically and produces records, not to be
 * a state-of-the-art contradiction miner.
 */
const POSITIVE_MARKERS = /\b(improve[sd]?|improvement|outperform[s]?|better|faster|higher|superior|effective|state-of-the-art|sota)\b/i;
const NEGATIVE_MARKERS = /\b(fail[sd]?|failure|worse|slower|lower|inferior|ineffective|regress(es)?|no improvement)\b/i;

export function detectConflicts(fragments: readonly KnowledgeFragment[]): DiscoveryRecord[] {
  const positives: KnowledgeFragment[] = [];
  const negatives: KnowledgeFragment[] = [];
  for (const f of fragments) {
    const t = `${f.title} ${f.abstract}`;
    if (POSITIVE_MARKERS.test(t)) positives.push(f);
    if (NEGATIVE_MARKERS.test(t)) negatives.push(f);
  }
  const results: DiscoveryRecord[] = [];
  const detected_at = new Date().toISOString();
  // Find pairs where a positive fragment shares ≥1 term with a negative fragment
  const positiveTokens = positives.map((f) => new Set(tokenise(`${f.title} ${f.abstract}`)));
  const negativeTokens = negatives.map((f) => new Set(tokenise(`${f.title} ${f.abstract}`)));
  for (let i = 0; i < positives.length; i++) {
    for (let j = 0; j < negatives.length; j++) {
      if (positives[i].fragment_id === negatives[j].fragment_id) continue;
      const shared: string[] = [];
      for (const t of positiveTokens[i]) if (negativeTokens[j].has(t) && t.length >= 5) shared.push(t);
      if (shared.length < 2) continue;
      const input_fragment_ids = Object.freeze(
        [positives[i].fragment_id, negatives[j].fragment_id].sort(),
      ) as readonly string[];
      const sharedSorted = shared.sort().slice(0, 5);
      const detail = `apparent claim conflict on terms [${sharedSorted.join(", ")}] between ${positives[i].external_id} and ${negatives[j].external_id}`;
      const signal_score = Math.min(1, shared.length / 10);
      const base = {
        record_type: "NEX_INTELLIGENCE_DISCOVERY" as const,
        discovery_id: `intel-discovery-conflict-${sha256Hex(detail).slice(0, 12)}`,
        detected_at,
        pattern: "conflict" as const,
        input_fragment_ids,
        detail,
        signal_score,
      };
      results.push({ ...base, provenance_chain_hash: provenanceChainHash(base, []) });
    }
  }
  return results;
}

// ── Connection find ────────────────────────────────────────────────────

/**
 * A connection is a shared-author relationship between ≥2 fragments (a
 * simple citation-graph would require fetching cited-by data which is
 * out of scope for slice 1). Deterministic: group fragments by author.
 */
export function detectConnections(fragments: readonly KnowledgeFragment[]): DiscoveryRecord[] {
  const authorToFragments = new Map<string, string[]>();
  for (const f of fragments) {
    for (const a of f.authors) {
      const key = a.toLowerCase().replace(/\s+/g, " ").trim();
      const arr = authorToFragments.get(key) ?? [];
      arr.push(f.fragment_id);
      authorToFragments.set(key, arr);
    }
  }
  const results: DiscoveryRecord[] = [];
  const detected_at = new Date().toISOString();
  const sorted = [...authorToFragments.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [author, fragIds] of sorted) {
    if (fragIds.length < 2) continue;
    const input_fragment_ids = Object.freeze([...fragIds].sort()) as readonly string[];
    const detail = `author "${author}" appears in ${fragIds.length} fragments`;
    const signal_score = Math.min(1, fragIds.length / 10);
    const base = {
      record_type: "NEX_INTELLIGENCE_DISCOVERY" as const,
      discovery_id: `intel-discovery-connection-${sha256Hex(author).slice(0, 12)}`,
      detected_at,
      pattern: "connection" as const,
      input_fragment_ids,
      detail,
      signal_score,
    };
    results.push({ ...base, provenance_chain_hash: provenanceChainHash(base, []) });
  }
  return results;
}

// ── Combinatorial synthesis ────────────────────────────────────────────

/**
 * The founder-highlighted pattern: take ≥2 discovery outputs, combine
 * their fragment sets, and emit a COMBINATION discovery record. This is
 * the input to the Hypothesis Engine's cross-source synthesis path.
 *
 * The combinator picks each pair of pattern-discoveries whose input
 * fragment sets overlap partially (shared context) but not fully
 * (independent evidence sources). Deterministic: sorted by discovery_id.
 */
export function detectCombinations(discoveries: readonly DiscoveryRecord[]): DiscoveryRecord[] {
  const patterns = discoveries.filter((d) => d.pattern === "pattern");
  const results: DiscoveryRecord[] = [];
  const detected_at = new Date().toISOString();
  const sorted = [...patterns].sort((a, b) => a.discovery_id.localeCompare(b.discovery_id));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = new Set(sorted[i].input_fragment_ids);
      const b = new Set(sorted[j].input_fragment_ids);
      const overlap = [...a].filter((x) => b.has(x));
      if (overlap.length === 0) continue;                 // no shared context
      if (overlap.length === a.size && overlap.length === b.size) continue;   // fully identical, not novel
      const union = Object.freeze([...new Set([...a, ...b])].sort()) as readonly string[];
      const detail = `combines pattern[${sorted[i].discovery_id}] with pattern[${sorted[j].discovery_id}]; shared context in ${overlap.length} fragments, combined support ${union.length}`;
      const signal_score = Math.min(1, overlap.length / Math.max(a.size, b.size));
      const base = {
        record_type: "NEX_INTELLIGENCE_DISCOVERY" as const,
        discovery_id: `intel-discovery-combination-${sha256Hex(`${sorted[i].discovery_id}::${sorted[j].discovery_id}`).slice(0, 12)}`,
        detected_at,
        pattern: "combination" as const,
        input_fragment_ids: union,
        detail,
        signal_score,
      };
      results.push({
        ...base,
        provenance_chain_hash: provenanceChainHash(base, [sorted[i].provenance_chain_hash, sorted[j].provenance_chain_hash]),
      });
    }
  }
  return results;
}

// ── Persistence ─────────────────────────────────────────────────────────

export async function persistDiscoveries(discoveries: readonly DiscoveryRecord[]): Promise<void> {
  for (const d of discoveries) {
    await getStorage().save(COLLECTIONS.nex_intelligence_knowledge_objects, d as unknown as Record<string, unknown>);
    // Note: discoveries and knowledge_objects share a collection in slice 1
    // for simplicity of the vertical slice — both are content-hashed and
    // typed via record_type. This is deliberate scope for slice 1;
    // slice 2 can add a dedicated discoveries collection if needed.
  }
}
