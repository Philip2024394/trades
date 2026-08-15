// ADR-0044 MVP · edge builder.
// Semantic similarity alone is NEVER proof of an edge. It's evidence that
// makes two items candidates for linking; the edge_type is derived from
// concrete rule cues (same-source sequential turns · negation cues · shared
// entities · question→answer kind pairing).

import { cosine } from './embed.mjs';
import { jaccard, edgeWeight } from './score.mjs';

const SEMANTIC_CANDIDATE_FLOOR = 0.70;   // below this, no edge is created
const ENTITY_CANDIDATE_FLOOR = 0.25;     // OR shared entities passing this Jaccard
const TOP_K_NEIGHBOURS = 25;             // how many candidates to consider per item

/**
 * For a newly-added item, compute typed edges to relevant existing items.
 * Returns array of edge rows ready for store.writeEdge().
 */
export function proposeEdgesForItem(item, allItems, opts = {}) {
  const { conversationSequence = null } = opts;
  const edges = [];
  const seen = new Set(); // (to_id, edge_type) dedup

  // 1) Semantic top-K neighbours
  const candidates = allItems
    .filter(o => o.id !== item.id && o.embedding && item.embedding)
    .map(o => ({ o, sim: cosine(item.embedding, o.embedding) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, TOP_K_NEIGHBOURS);

  for (const { o, sim } of candidates) {
    if (sim < SEMANTIC_CANDIDATE_FLOOR && jaccard(item.entities, o.entities) < ENTITY_CANDIDATE_FLOOR) continue;
    const derived = deriveEdgeTypes({ from: item, to: o, semantic: sim, conversationSequence });
    for (const { edge_type, weight, evidence } of derived) {
      const key = `${o.id}::${edge_type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        from_item: item.id,
        to_item: o.id,
        edge_type,
        weight,
        evidence_count: 1,
        evidence,
      });
    }
  }

  return edges;
}

/**
 * Derive one or more edge types from concrete cues.
 * Semantic similarity feeds the weight but NOT the type.
 */
function deriveEdgeTypes({ from, to, semantic, conversationSequence }) {
  const out = [];
  const sameSource = from.source_ref && to.source_ref && from.source_ref === to.source_ref;
  const sharedEntities = jaccard(from.entities, to.entities);
  const w = (type, extra = {}) => edgeWeight({
    semantic,
    entities_a: from.entities,
    entities_b: to.entities,
    intent_a: from.canonical_intent,
    intent_b: to.canonical_intent,
    ...extra,
  });

  // 1) Same-source sequential turns → follows_from
  if (sameSource && conversationSequence) {
    const fromIdx = conversationSequence.indexOf(from.id);
    const toIdx = conversationSequence.indexOf(to.id);
    if (fromIdx >= 0 && toIdx === fromIdx + 1) {
      out.push({ edge_type: 'follows_from', weight: Math.max(0.75, w('follows_from')), evidence: 'same-source sequential turn' });
    }
  }

  // 2) Question → answer in same source
  if (sameSource && from.kind === 'qa_pair' && to.kind === 'qa_pair' && from.question_text && to.answer_text) {
    // For our schema a Q+A pair holds both, so we mostly emit `answers` self-referentially inside one row.
    // Cross-item answers-edge is created when a customer question in source A is answered by an authoritative statement in source B.
  }

  // 3) Correction cue on `from`
  if (from.canonical_intent === 'correct') {
    out.push({ edge_type: 'corrects', weight: Math.max(0.7, w('corrects')), evidence: 'from-item is a correction' });
  }

  // 4) Clarification: from is a clarification kind or intent
  if (from.kind === 'clarification' || from.canonical_intent === 'clarify_nex') {
    out.push({ edge_type: 'clarifies', weight: Math.max(0.7, w('clarifies')), evidence: 'from-item is a clarification' });
  }

  // 5) Alternative-of: shared entities + specify intent on both, but different materials
  if (sharedEntities > 0.4 && from.canonical_intent === 'specify_material' && to.canonical_intent === 'specify_material') {
    const fromMats = from.entities.filter(e => e === 'oak' || e === 'walnut' || e === 'ash' || e === 'pine' || e === 'glass' || e === 'metal');
    const toMats = to.entities.filter(e => e === 'oak' || e === 'walnut' || e === 'ash' || e === 'pine' || e === 'glass' || e === 'metal');
    if (fromMats.length && toMats.length && fromMats[0] !== toMats[0]) {
      out.push({ edge_type: 'alternative_of', weight: w('alternative_of'), evidence: 'shared topic, different materials' });
    }
  }

  // 6) Comparison: comparison intent on either
  if (from.canonical_intent === 'compare' || to.canonical_intent === 'compare') {
    out.push({ edge_type: 'comparison_to', weight: w('comparison_to'), evidence: 'comparison intent present' });
  }

  // 7) Price-of: price intent on one side + shared entities
  if ((from.canonical_intent === 'ask_price' || to.canonical_intent === 'ask_price') && sharedEntities > 0.2) {
    out.push({ edge_type: 'prices', weight: w('prices'), evidence: 'price intent + shared entities' });
  }

  // 8) Requires: installation topic + material topic overlap
  if ((from.entities.includes('installation') && to.entities.some(e => ['oak','walnut','glass','metal','staircase'].includes(e)))
      || (to.entities.includes('installation') && from.entities.some(e => ['oak','walnut','glass','metal','staircase'].includes(e)))) {
    out.push({ edge_type: 'requires', weight: Math.max(0.6, w('requires')), evidence: 'installation + product entity co-occurrence' });
  }

  // 9) Elaborates: to-item is a longer statement on the same entities
  if (sharedEntities > 0.3 && (to.answer_text?.length ?? 0) > (from.answer_text?.length ?? 0) * 1.5) {
    out.push({ edge_type: 'elaborates', weight: w('elaborates'), evidence: 'expands the same entities with more detail' });
  }

  // 10) related_to fallback — only if no stronger edge and semantic is high
  if (out.length === 0 && semantic >= 0.80) {
    out.push({ edge_type: 'related_to', weight: w('related_to'), evidence: 'high semantic similarity, no stronger cue' });
  }

  // Filter below the edge-weight floor (0.50) — validator will reject anyway.
  return out.filter(e => e.weight >= 0.50);
}

export const _internals = { SEMANTIC_CANDIDATE_FLOOR, ENTITY_CANDIDATE_FLOOR };
