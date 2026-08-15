// ADR-0044 MVP · confidence + edge weight scoring.
// Formulas from ADR-0044 §3. All scores in [0, 1].

/** Jaccard similarity between two entity slug arrays. */
export function jaccard(a, b) {
  if (!a?.length || !b?.length) return 0;
  const sa = new Set(a), sb = new Set(b);
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return union ? inter / union : 0;
}

/** Simple intent-class compatibility table. */
const INTENT_COMPAT = {
  discover:  { discover: 1, specify: 0.7, compare: 0.7, clarify: 0.9, revisit: 0.8, decide: 0.7, price: 0.7, confirm: 0.5, correct: 0.4, close: 0.3 },
  specify:   { specify: 1, discover: 0.7, revisit: 0.8, compare: 0.8, correct: 0.7, clarify: 0.6, confirm: 0.7, decide: 0.7, price: 0.6, close: 0.3 },
  compare:   { compare: 1, specify: 0.8, discover: 0.7, decide: 0.9, price: 0.7, revisit: 0.7, clarify: 0.6, correct: 0.5, confirm: 0.5, close: 0.3 },
  price:     { price: 1, discover: 0.7, specify: 0.6, decide: 0.8, compare: 0.7, revisit: 0.8, clarify: 0.5, correct: 0.5, confirm: 0.6, close: 0.4 },
  decide:    { decide: 1, compare: 0.9, price: 0.8, specify: 0.7, discover: 0.7, revisit: 0.7, confirm: 0.9, clarify: 0.5, correct: 0.6, close: 0.5 },
  clarify:   { clarify: 1, discover: 0.9, specify: 0.6, compare: 0.6, correct: 0.7, confirm: 0.6, price: 0.5, revisit: 0.6, decide: 0.5, close: 0.3 },
  correct:   { correct: 1, specify: 0.7, discover: 0.4, revisit: 0.6, compare: 0.5, decide: 0.5, price: 0.5, clarify: 0.7, confirm: 0.3, close: 0.2 },
  revisit:   { revisit: 1, discover: 0.8, compare: 0.7, specify: 0.7, price: 0.8, decide: 0.7, correct: 0.6, clarify: 0.6, confirm: 0.5, close: 0.3 },
  confirm:   { confirm: 1, decide: 0.9, specify: 0.7, compare: 0.5, price: 0.6, revisit: 0.5, discover: 0.5, correct: 0.3, clarify: 0.6, close: 0.7 },
  close:     { close: 1, confirm: 0.7, decide: 0.5 },
  object:    { object: 1, correct: 0.7, discover: 0.4 },
};
export function intentCompat(a, b) {
  if (!a || !b) return 0.5;
  const table = INTENT_COMPAT[a] ?? {};
  return table[b] ?? 0.4;
}

/**
 * Edge weight formula (ADR-0044 §3):
 *   weight = 0.40*semantic + 0.25*entity_jaccard + 0.20*intent_compat
 *          + 0.10*evidence_norm + 0.05*outcome_bias
 */
export function edgeWeight({ semantic, entities_a, entities_b, intent_a, intent_b, evidence_count = 1, outcome_bias = 0 }) {
  const sem = clamp(semantic ?? 0);
  const ej = jaccard(entities_a, entities_b);
  const ic = intentCompat(intent_a, intent_b);
  const ev = Math.min(1, Math.log2(1 + evidence_count) / 4); // 1→0.25, 15→~1
  const ob = clamp(outcome_bias);
  return clamp(0.40 * sem + 0.25 * ej + 0.20 * ic + 0.10 * ev + 0.05 * ob);
}

/**
 * Item confidence (ADR-0044 proposal §6):
 *   min(classification_confidence, extraction_confidence, embedding_neighbourhood_density)
 * where neighbourhood density is a proxy for how well-supported the item is
 * by nearby similar items. For MVP we start with min(classification, extraction);
 * neighbourhood is computed in the linking pass and can lift confidence upward
 * via a mild bonus, but never above the caller's supplied gate.
 */
export function itemConfidence({ classification, extraction, neighbourhood = null }) {
  const parts = [classification, extraction].filter(v => typeof v === 'number');
  if (!parts.length) return 0.5;
  let base = Math.min(...parts);
  if (neighbourhood !== null) {
    // Small +/- lift capped at ±0.05 — evidence is not proof.
    const lift = Math.max(-0.05, Math.min(0.05, (neighbourhood - 0.5) * 0.1));
    base = clamp(base + lift);
  }
  return +base.toFixed(3);
}

function clamp(v) { return Math.max(0, Math.min(1, v)); }
