// ADR-0044 MVP · row shape + enum guards. Mirrors migration 050 exactly.
// Any change here MUST be mirrored in deploy/postgres/init/050_nex_conv_learning_pipeline_schema.sql.

export const KINDS = ['qa_pair', 'statement', 'clarification', 'correction', 'recommendation'];
export const INTENT_CLASSES = ['discover', 'specify', 'compare', 'price', 'decide', 'clarify', 'correct', 'object', 'confirm', 'revisit', 'close'];
export const ENTITY_CLASSES = ['material', 'component', 'style', 'regulation', 'service', 'price_dimension', 'person', 'company', 'process', 'location', 'other'];
export const EDGE_TYPES = ['answers', 'clarifies', 'follows_from', 'corrects', 'contradicts', 'elaborates', 'alternative_of', 'comparison_to', 'prices', 'requires', 'recommends', 'warns_about', 'related_to'];
export const SPEAKERS = ['customer', 'owner', 'nex'];
export const OUTCOMES = ['resolved', 'clarification_completed', 'correction_received', 'user_abandoned', 'repeated_question', 'escalated', 'pending'];
export const FEEDBACK_SIGNALS = ['helpful', 'not_helpful', 'irrelevant', 'wrong', 'clarified', 'corrected', 'gave_up', 'followed_recommendation', 'asked_same_again'];

// ADR-0033 gates (mirror migration 050 CHECK constraints + trigger)
export const CONFIDENCE_HARD_FLOOR = 0.50; // reject below
export const CONFIDENCE_DRAFT_CEILING = 0.70; // ≥0.70 required to live
export const EDGE_WEIGHT_FLOOR = 0.50;

export function assertKnowledgeItem(row) {
  if (!row.brain) throw new Error(`ki: brain is required`);
  if (!KINDS.includes(row.kind)) throw new Error(`ki: kind ${row.kind} not in ${KINDS}`);
  if (!row.canonical_intent) throw new Error(`ki: canonical_intent is required`);
  if (typeof row.confidence !== 'number') throw new Error(`ki: confidence must be a number`);
  if (row.confidence < 0 || row.confidence > 1) throw new Error(`ki: confidence ${row.confidence} out of range`);
  if (row.confidence < CONFIDENCE_HARD_FLOOR) throw new Error(`ki: confidence ${row.confidence} < ${CONFIDENCE_HARD_FLOOR} REJECTED (ADR-0033)`);
  if (row.draft_only === false && row.confidence < CONFIDENCE_DRAFT_CEILING) {
    throw new Error(`ki: confidence ${row.confidence} < ${CONFIDENCE_DRAFT_CEILING} requires draft_only=true (ADR-0033)`);
  }
  if (!row.question_text && !row.answer_text) throw new Error(`ki: must have question_text or answer_text`);
  if (!Array.isArray(row.entities)) throw new Error(`ki: entities must be an array`);
  if (!Array.isArray(row.topics)) throw new Error(`ki: topics must be an array`);
  return true;
}

export function assertEdge(row) {
  if (!EDGE_TYPES.includes(row.edge_type)) throw new Error(`edge: edge_type ${row.edge_type} not in ${EDGE_TYPES}`);
  if (row.from_item === row.to_item) throw new Error(`edge: self-loops forbidden`);
  if (typeof row.weight !== 'number') throw new Error(`edge: weight must be a number`);
  if (row.weight < 0 || row.weight > 1) throw new Error(`edge: weight ${row.weight} out of range`);
  if (row.weight < EDGE_WEIGHT_FLOOR) throw new Error(`edge: weight ${row.weight} < ${EDGE_WEIGHT_FLOOR} REJECTED`);
  if (!Number.isInteger(row.evidence_count) || row.evidence_count < 1) throw new Error(`edge: evidence_count must be integer ≥1`);
  return true;
}

export function newId() {
  // RFC4122 v4 UUID (crypto.randomUUID present in Node 20+)
  return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function nowIso() { return new Date().toISOString(); }
