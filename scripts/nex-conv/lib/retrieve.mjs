// ADR-0044 MVP · hybrid retrieval.
// Semantic (cosine over 384-dim embeddings) + entity-array overlap +
// graph-walk from state.entities_in_focus_item_ids. Merged, reranked,
// top-K=8. Retrieval budget target: <100ms on the MVP dataset (couple
// thousand items). Actual timings are measured and reported.

import { cosine } from './embed.mjs';
import { intentCompat, jaccard } from './score.mjs';

const K_SEMANTIC = 25;
const K_ENTITY = 25;
const K_GRAPH_HOPS = 2;
const K_GRAPH_WEIGHT_FLOOR = 0.70;
const TOP_K_OUT = 8;

/**
 * @param {object} args
 * @param {Store} args.store
 * @param {Float32Array} args.queryEmbedding
 * @param {string[]} args.queryEntities
 * @param {string} args.queryIntent
 * @param {object} args.state
 * @param {string} args.brain
 * @param {boolean} args.includeDraft — if false, filter draft_only out
 */
export function retrieve(args) {
  const { store, queryEmbedding, queryEntities = [], queryIntent, state, brain, includeDraft = false } = args;
  const t0 = Date.now();

  const allBrainItems = store.allItemsForBrain(brain);
  const stageTimings = {};

  // 1) Semantic
  const t_sem = Date.now();
  const semanticHits = allBrainItems
    .filter(r => (includeDraft || !r.draft_only) && r.embedding)
    .map(r => ({ item: r, semantic: cosine(queryEmbedding, r.embedding) }))
    .sort((a, b) => b.semantic - a.semantic)
    .slice(0, K_SEMANTIC);
  stageTimings.semantic_ms = Date.now() - t_sem;

  // 2) Entity-array overlap
  const t_ent = Date.now();
  const entityMatches = allBrainItems
    .filter(r => (includeDraft || !r.draft_only) && r.entities.some(e => queryEntities.includes(e)))
    .map(r => ({ item: r, entityOverlap: jaccard(queryEntities, r.entities) }))
    .sort((a, b) => b.entityOverlap - a.entityOverlap)
    .slice(0, K_ENTITY);
  stageTimings.entity_ms = Date.now() - t_ent;

  // 3) Graph walk from state entities_in_focus_item_ids
  const t_walk = Date.now();
  const graphHits = graphWalk({ store, startIds: state?.entities_in_focus_item_ids ?? [], includeDraft });
  stageTimings.graph_ms = Date.now() - t_walk;

  // 4) Merge → dedup by id → collect per-source scores
  const t_merge = Date.now();
  const merged = new Map(); // id → { item, semantic, entityOverlap, graphHopBonus }
  for (const [i, { item, semantic }] of semanticHits.entries()) {
    merged.set(item.id, { item, semantic, entityOverlap: 0, graphHopBonus: 0, semantic_rank: 1 - i / semanticHits.length });
  }
  for (const [i, { item, entityOverlap }] of entityMatches.entries()) {
    const cur = merged.get(item.id) ?? { item, semantic: 0, entityOverlap: 0, graphHopBonus: 0, semantic_rank: 0 };
    cur.entityOverlap = entityOverlap;
    cur.entity_rank = 1 - i / entityMatches.length;
    merged.set(item.id, cur);
  }
  for (const { item, hop } of graphHits) {
    const cur = merged.get(item.id) ?? { item, semantic: 0, entityOverlap: 0, graphHopBonus: 0, semantic_rank: 0, entity_rank: 0 };
    cur.graphHopBonus = hop === 1 ? 1 : (hop === 2 ? 0.6 : 0);
    merged.set(item.id, cur);
  }
  stageTimings.merge_ms = Date.now() - t_merge;

  // 5) Rerank
  const t_rank = Date.now();
  const scored = [...merged.values()].map(m => {
    const topicContinuity = queryEntities.length && m.item.entities.length
      ? jaccard(queryEntities, m.item.entities)
      : 0;
    const intent_compat = intentCompat(queryIntent, m.item.canonical_intent);
    const final = 0.35 * (m.semantic ?? 0)
                + 0.25 * (m.entityOverlap ?? 0)
                + 0.20 * (m.graphHopBonus ?? 0)
                + 0.10 * intent_compat
                + 0.10 * topicContinuity;
    return { ...m, intent_compat, topicContinuity, final };
  }).sort((a, b) => b.final - a.final).slice(0, TOP_K_OUT);
  stageTimings.rerank_ms = Date.now() - t_rank;

  return {
    topK: scored,
    stageTimings,
    total_ms: Date.now() - t0,
    candidateCount: merged.size,
  };
}

function graphWalk({ store, startIds, includeDraft, maxHops = K_GRAPH_HOPS, minWeight = K_GRAPH_WEIGHT_FLOOR }) {
  const hits = [];
  const seen = new Set(startIds);
  let frontier = [...startIds];
  for (let hop = 1; hop <= maxHops; hop++) {
    const nextFrontier = [];
    for (const id of frontier) {
      const outEdges = store.edgesFrom(id).filter(e => e && e.weight >= minWeight);
      for (const e of outEdges) {
        if (seen.has(e.to_item)) continue;
        seen.add(e.to_item);
        const target = store.getItem(e.to_item);
        if (!target) continue;
        if (!includeDraft && target.draft_only) continue;
        hits.push({ item: target, hop });
        nextFrontier.push(e.to_item);
      }
    }
    frontier = nextFrontier;
    if (!frontier.length) break;
  }
  return hits;
}
