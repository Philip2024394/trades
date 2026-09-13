// WO-INTELLIGENCE-01 · Hypothesis Engine.
//
// Takes a DiscoveryRecord + the fragments it references and produces a
// HypothesisRecord: a testable claim, an expected outcome (machine-
// comparable), and a measurable criterion.
//
// Template-based generation — the engine does NOT invent free-form
// hypotheses. It selects a hypothesis template that matches the discovery
// pattern, then instantiates it with the specific terms / authors /
// fragment set that triggered the discovery. Same input → same hypothesis.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import { canonicalJson, provenanceChainHash, sha256Hex } from "./provenance";
import type { DiscoveryRecord, HypothesisRecord, KnowledgeFragment } from "./types";

/**
 * Form a hypothesis from a Discovery + the fragments it points at.
 * Returns null when no template applies (this is honest — we do not
 * fabricate a hypothesis just to have one).
 */
export function formHypothesis(
  discovery: DiscoveryRecord,
  fragments: readonly KnowledgeFragment[],
): HypothesisRecord | null {
  const fragmentMap = new Map(fragments.map((f) => [f.fragment_id, f]));
  const inputFragments = discovery.input_fragment_ids
    .map((id) => fragmentMap.get(id))
    .filter((f): f is KnowledgeFragment => f !== undefined);
  if (inputFragments.length < 2) return null;

  switch (discovery.pattern) {
    case "pattern":       return hypothesisFromPattern(discovery, inputFragments);
    case "conflict":      return hypothesisFromConflict(discovery, inputFragments);
    case "connection":    return hypothesisFromConnection(discovery, inputFragments);
    case "combination":   return hypothesisFromCombination(discovery, inputFragments);
  }
}

// ── Templates ───────────────────────────────────────────────────────────

function hypothesisFromPattern(discovery: DiscoveryRecord, fragments: readonly KnowledgeFragment[]): HypothesisRecord {
  const term = extractTermFromDetail(discovery.detail);
  const claim = `Multiple independent papers (n=${fragments.length}) reference the concept "${term}" in cs.SE contexts, suggesting this concept is a recurring pattern in software engineering research and may be worth encoding as a NEX rule or classifier.`;
  const expected = {
    concept: term,
    supporting_fragment_count: fragments.length,
    independent_authors: [...new Set(fragments.flatMap((f) => f.authors))].length,
  };
  return build(discovery, fragments, claim, expected, `Recurring concept "${term}" is validated when ≥ ${fragments.length} distinct fragments and ≥ ${Math.max(2, Math.floor(fragments.length / 2))} distinct author sets reference it.`);
}

function hypothesisFromConflict(discovery: DiscoveryRecord, fragments: readonly KnowledgeFragment[]): HypothesisRecord {
  const positive = fragments[0];
  const negative = fragments[1];
  const claim = `Papers "${positive.external_id}" and "${negative.external_id}" appear to make conflicting claims about a shared technical concept. A NEX experiment can determine whether one, both, or neither reproduces on a controlled test set.`;
  const expected = {
    conflict_between: [positive.external_id, negative.external_id],
    resolution_direction: "unknown_until_experiment",
  };
  return build(discovery, fragments, claim, expected, `Conflict resolved when reproducible experiment shows one paper's claim holds while the other's does not on the shared concept.`);
}

function hypothesisFromConnection(discovery: DiscoveryRecord, fragments: readonly KnowledgeFragment[]): HypothesisRecord {
  const author = extractAuthorFromDetail(discovery.detail);
  const claim = `Author "${author}" contributes to ${fragments.length} fragments in this window, indicating a research programme or line of work. NEX may find higher signal by tracking their citation trail.`;
  const expected = {
    author,
    fragment_count: fragments.length,
    combined_categories: [...new Set(fragments.flatMap((f) => f.categories))].sort(),
  };
  return build(discovery, fragments, claim, expected, `Line-of-work confirmed when ≥ 2 papers by the same author share ≥ 1 category and cross-reference terminology.`);
}

function hypothesisFromCombination(discovery: DiscoveryRecord, fragments: readonly KnowledgeFragment[]): HypothesisRecord {
  // The founder-highlighted pattern: A + B + C → new hypothesis
  const externalIds = fragments.map((f) => f.external_id).sort();
  const commonTerms = extractCommonTerms(fragments);
  const claim = `Combining evidence from ${fragments.length} fragments (${externalIds.slice(0, 3).join(", ")}${externalIds.length > 3 ? ", …" : ""}) suggests a compound observation on the shared terms [${commonTerms.slice(0, 5).join(", ")}]. NEX can test whether this compound observation holds on a controlled corpus.`;
  const expected = {
    combined_from: externalIds,
    shared_terms: commonTerms.slice(0, 10),
    compound_signal_score: discovery.signal_score,
  };
  return build(discovery, fragments, claim, expected, `Combinatorial observation is confirmed when the compound claim holds across independent test cases derived from a corpus separate from the training fragments.`);
}

// ── Helpers ─────────────────────────────────────────────────────────────

function build(
  discovery: DiscoveryRecord,
  fragments: readonly KnowledgeFragment[],
  claim: string,
  expected: Record<string, unknown>,
  measurable: string,
): HypothesisRecord {
  const formed_from_fragment_ids = Object.freeze([...fragments.map((f) => f.fragment_id)].sort()) as readonly string[];
  const expected_outcome = canonicalJson(expected);
  const hypothesis_id = `intel-hypothesis-${sha256Hex(discovery.discovery_id + claim).slice(0, 16)}`;
  const base = {
    record_type: "NEX_INTELLIGENCE_HYPOTHESIS" as const,
    hypothesis_id,
    formed_at: new Date().toISOString(),
    discovery_id: discovery.discovery_id,
    formed_from_fragment_ids,
    claim,
    expected_outcome,
    measurable_criterion: measurable,
  };
  return { ...base, provenance_chain_hash: provenanceChainHash(base, [discovery.provenance_chain_hash]) };
}

function extractTermFromDetail(detail: string): string {
  const m = /term "([^"]+)"/.exec(detail);
  return m ? m[1] : "unknown";
}

function extractAuthorFromDetail(detail: string): string {
  const m = /author "([^"]+)"/.exec(detail);
  return m ? m[1] : "unknown";
}

function extractCommonTerms(fragments: readonly KnowledgeFragment[]): string[] {
  const perFragment = fragments.map((f) => new Set(
    `${f.title} ${f.abstract}`.toLowerCase()
      .replace(/[^a-z0-9\-\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4),
  ));
  if (perFragment.length === 0) return [];
  const common: string[] = [];
  const first = [...perFragment[0]];
  for (const t of first) {
    if (perFragment.every((s) => s.has(t))) common.push(t);
  }
  return common.sort();
}

// ── Persistence ─────────────────────────────────────────────────────────

export async function persistHypothesis(h: HypothesisRecord): Promise<void> {
  await getStorage().save(COLLECTIONS.nex_intelligence_hypotheses, h);
}
