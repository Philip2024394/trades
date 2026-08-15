// ADR-0044 · PostgresStore adapter.
// Same interface as the JSONL Store · reads/writes to nex.conv_* tables
// created by migration 050. Uses the `pg` package (already in deps).
//
// Vector storage: the schema uses JSONB for `embedding` on this dev
// Postgres (pgvector not installed). On any pgvector-having Postgres,
// migration 050 §11 promotes the column type to VECTOR(384) on empty
// tables. The adapter reads JSONB either way (jsonb path or ::text
// cast of the vector) — cosine similarity is computed in application
// code the same way the JSONL store does.

import pg from 'pg';
import { newId, nowIso, assertKnowledgeItem, assertEdge } from './schema.mjs';

const BRAIN_DEFAULT = 'staircase_brain';

/**
 * PostgresStore mirrors the JSONL Store API 1:1.
 *
 * The retrieval engine (retrieve.mjs) and inference driver (infer.mjs) call
 * only these methods:
 *   init() · counts() · allEntities() · allIntents() · allEdges()
 *   allItems() · allItemsForBrain() · getItem(id) · getState(id)
 *   entitySlugForAlias(alias) · edgesFrom(id) · edgesTo(id)
 *   upsertIntent(row) · upsertEntity(row) · writeKnowledgeItem(row)
 *   writeEdge(row) · upsertState(row) · writeTurn(row)
 *   writeOutcome(row) · writeFeedback(row)
 */
export class PostgresStore {
  constructor({ connectionString, poolMax = 8 } = {}) {
    this.pool = new pg.Pool({ connectionString: connectionString ?? process.env.NEX_POSTGRES_URL, max: poolMax });
    // In-memory caches populated on init() for fast reads (the JSONL store
    // is also fully in-memory; parity is required for equivalent latency).
    this.mem = {
      intents: new Map(),
      entities: new Map(),
      knowledge_items: new Map(),
      edges: new Map(),
      states: new Map(),
      turns: new Map(),
      outcomes: new Map(),
      feedback: new Map(),
    };
    this.edgesByFrom = new Map();
    this.edgesByTo = new Map();
    this.entityAliasIdx = new Map();
  }

  async init() {
    // Verify schema present (fail loudly if migration 050 wasn't applied)
    const t = await this.pool.query(`SELECT COUNT(*)::int AS n FROM information_schema.tables
      WHERE table_schema='nex' AND table_name IN ('conv_intents','conv_entities','conv_knowledge_items','conv_edges','conv_states','conv_turns','conv_outcomes','conv_feedback')`);
    if (t.rows[0].n !== 8) throw new Error(`PostgresStore.init: expected 8 nex.conv_* tables, found ${t.rows[0].n}. Run npm run nex:apply-storage-schema first.`);

    // Detect embedding column type (jsonb fallback vs vector canonical)
    const et = await this.pool.query(`SELECT data_type FROM information_schema.columns
      WHERE table_schema='nex' AND table_name='conv_knowledge_items' AND column_name='embedding'`);
    this.embeddingType = et.rows[0]?.data_type ?? 'jsonb';

    // Load intents
    const intents = await this.pool.query(`SELECT * FROM nex.conv_intents`);
    for (const r of intents.rows) {
      this.mem.intents.set(r.slug, {
        slug: r.slug, display_name: r.display_name, class: r.class,
        example_phrases: r.example_phrases ?? [], created_at: r.created_at,
      });
    }
    // Load entities
    const entities = await this.pool.query(`SELECT slug, display_name, brain, entity_class, aliases, embedding, created_at FROM nex.conv_entities`);
    for (const r of entities.rows) {
      const row = {
        slug: r.slug, display_name: r.display_name, brain: r.brain,
        entity_class: r.entity_class, aliases: r.aliases ?? [],
        embedding: this._readEmbedding(r.embedding), created_at: r.created_at,
      };
      this.mem.entities.set(r.slug, row);
      this.entityAliasIdx.set(r.slug.toLowerCase(), r.slug);
      for (const a of row.aliases) this.entityAliasIdx.set(a.toLowerCase(), r.slug);
    }
    // Load knowledge_items
    const items = await this.pool.query(`SELECT id, brain, source_batch, source_ref, kind, question_text, answer_text, canonical_intent, entities, topics, confidence, draft_only, embedding, created_at, updated_at FROM nex.conv_knowledge_items`);
    for (const r of items.rows) {
      this.mem.knowledge_items.set(r.id, {
        id: r.id, brain: r.brain, source_batch: r.source_batch, source_ref: r.source_ref,
        kind: r.kind, question_text: r.question_text, answer_text: r.answer_text,
        canonical_intent: r.canonical_intent, entities: r.entities ?? [], topics: r.topics ?? [],
        confidence: Number(r.confidence), draft_only: r.draft_only,
        embedding: this._readEmbedding(r.embedding),
        created_at: r.created_at, updated_at: r.updated_at,
      });
    }
    // Load edges
    const edges = await this.pool.query(`SELECT * FROM nex.conv_edges`);
    for (const r of edges.rows) {
      const row = { ...r, weight: Number(r.weight), evidence_count: Number(r.evidence_count) };
      this._indexEdge(row);
    }
    // Load states, turns, outcomes, feedback
    const s = await this.pool.query(`SELECT * FROM nex.conv_states`);
    for (const r of s.rows) this.mem.states.set(r.conversation_id, r.state);
    const tr = await this.pool.query(`SELECT * FROM nex.conv_turns`);
    for (const r of tr.rows) this.mem.turns.set(r.id, r);
    const oc = await this.pool.query(`SELECT * FROM nex.conv_outcomes`);
    for (const r of oc.rows) this.mem.outcomes.set(r.conversation_id, r);
    const fb = await this.pool.query(`SELECT * FROM nex.conv_feedback`);
    for (const r of fb.rows) this.mem.feedback.set(r.id, r);

    return this;
  }

  async close() { await this.pool.end(); }

  // --- Read helpers (same signatures as JSONL store) ------------------

  getItem(id) { return this.mem.knowledge_items.get(id); }
  allItems() { return [...this.mem.knowledge_items.values()]; }
  allItemsForBrain(brain) { return this.allItems().filter(r => r.brain === brain); }
  allEdges() { return [...this.mem.edges.values()]; }
  allEntities() { return [...this.mem.entities.values()]; }
  allIntents() { return [...this.mem.intents.values()]; }
  getState(conversation_id) { return this.mem.states.get(conversation_id); }
  entitySlugForAlias(alias) { return this.entityAliasIdx.get(alias.toLowerCase()); }
  edgesFrom(id) { return [...(this.edgesByFrom.get(id) ?? [])].map(eid => this.mem.edges.get(eid)); }
  edgesTo(id) { return [...(this.edgesByTo.get(id) ?? [])].map(eid => this.mem.edges.get(eid)); }

  counts() {
    return {
      knowledge_items: this.mem.knowledge_items.size,
      knowledge_items_live: [...this.mem.knowledge_items.values()].filter(r => !r.draft_only).length,
      knowledge_items_draft: [...this.mem.knowledge_items.values()].filter(r => r.draft_only).length,
      entities: this.mem.entities.size,
      intents: this.mem.intents.size,
      edges: this.mem.edges.size,
      states: this.mem.states.size,
      turns: this.mem.turns.size,
      outcomes: this.mem.outcomes.size,
      feedback: this.mem.feedback.size,
    };
  }

  // --- Write API (upserts backed by SQL, mirror JSONL store) ---------

  async upsertIntent(row) {
    if (!row.slug) throw new Error('intent: slug required');
    const clean = { slug: row.slug, display_name: row.display_name ?? row.slug, class: row.class, example_phrases: row.example_phrases ?? [], created_at: row.created_at ?? nowIso() };
    await this.pool.query(
      `INSERT INTO nex.conv_intents (slug, display_name, class, example_phrases)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (slug) DO UPDATE SET display_name=EXCLUDED.display_name, class=EXCLUDED.class, example_phrases=EXCLUDED.example_phrases`,
      [clean.slug, clean.display_name, clean.class, clean.example_phrases]
    );
    this.mem.intents.set(clean.slug, clean);
    return clean;
  }

  async upsertEntity(row) {
    if (!row.slug) throw new Error('entity: slug required');
    const clean = { slug: row.slug, display_name: row.display_name ?? row.slug, brain: row.brain ?? BRAIN_DEFAULT, entity_class: row.entity_class, aliases: row.aliases ?? [], embedding: row.embedding ?? null, created_at: row.created_at ?? nowIso() };
    await this.pool.query(
      `INSERT INTO nex.conv_entities (slug, display_name, brain, entity_class, aliases, embedding)
       VALUES ($1,$2,$3,$4,$5,${this._embeddingParam(6)})
       ON CONFLICT (slug) DO UPDATE SET
         display_name=EXCLUDED.display_name, brain=EXCLUDED.brain,
         entity_class=EXCLUDED.entity_class, aliases=EXCLUDED.aliases`,
      [clean.slug, clean.display_name, clean.brain, clean.entity_class, clean.aliases, this._writeEmbedding(clean.embedding)]
    );
    this.mem.entities.set(clean.slug, clean);
    this.entityAliasIdx.set(clean.slug.toLowerCase(), clean.slug);
    for (const a of clean.aliases) this.entityAliasIdx.set(a.toLowerCase(), clean.slug);
    return clean;
  }

  async writeKnowledgeItem(row) {
    if (!row.id) row.id = newId();
    row.updated_at = nowIso();
    row.created_at = row.created_at ?? nowIso();
    row.draft_only = row.draft_only ?? (row.confidence < 0.70);
    row.entities = row.entities ?? [];
    row.topics = row.topics ?? [];
    assertKnowledgeItem(row);
    await this.pool.query(
      `INSERT INTO nex.conv_knowledge_items
         (id, brain, source_batch, source_ref, kind, question_text, answer_text,
          canonical_intent, entities, topics, confidence, draft_only, embedding)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,${this._embeddingParam(13)})
       ON CONFLICT (id) DO UPDATE SET
         brain=EXCLUDED.brain, source_batch=EXCLUDED.source_batch, source_ref=EXCLUDED.source_ref,
         kind=EXCLUDED.kind, question_text=EXCLUDED.question_text, answer_text=EXCLUDED.answer_text,
         canonical_intent=EXCLUDED.canonical_intent, entities=EXCLUDED.entities, topics=EXCLUDED.topics,
         confidence=EXCLUDED.confidence, draft_only=EXCLUDED.draft_only, embedding=EXCLUDED.embedding`,
      [row.id, row.brain, row.source_batch, row.source_ref ?? null, row.kind, row.question_text ?? null, row.answer_text ?? null,
       row.canonical_intent, row.entities, row.topics, row.confidence, row.draft_only, this._writeEmbedding(row.embedding)]
    );
    this.mem.knowledge_items.set(row.id, row);
    return row;
  }

  async writeEdge(row) {
    if (!row.id) row.id = newId();
    row.evidence_count = row.evidence_count ?? 1;
    row.last_seen_at = nowIso();
    row.created_at = row.created_at ?? nowIso();
    assertEdge(row);
    // Upsert on (from_item, to_item, edge_type): increment evidence_count + reinforce weight
    const r = await this.pool.query(
      `INSERT INTO nex.conv_edges (id, from_item, to_item, edge_type, weight, evidence_count)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (from_item, to_item, edge_type) DO UPDATE SET
         evidence_count = nex.conv_edges.evidence_count + 1,
         weight = LEAST(1.0, nex.conv_edges.weight + 0.02),
         last_seen_at = now()
       RETURNING id, from_item, to_item, edge_type, weight, evidence_count, last_seen_at, created_at`,
      [row.id, row.from_item, row.to_item, row.edge_type, row.weight, row.evidence_count]
    );
    const stored = r.rows[0];
    stored.weight = Number(stored.weight);
    stored.evidence_count = Number(stored.evidence_count);
    // Replace any prior in-memory copy of a same-triple edge
    for (const existing of this.mem.edges.values()) {
      if (existing.from_item === stored.from_item && existing.to_item === stored.to_item && existing.edge_type === stored.edge_type) {
        this.mem.edges.delete(existing.id);
        this._removeEdgeFromIndexes(existing.id, existing.from_item, existing.to_item);
        break;
      }
    }
    this._indexEdge(stored);
    return stored;
  }

  async upsertState(row) {
    if (!row.conversation_id) throw new Error('state: conversation_id required');
    const { conversation_id, business_id = null, brain } = row;
    await this.pool.query(
      `INSERT INTO nex.conv_states (conversation_id, business_id, brain, state)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (conversation_id) DO UPDATE SET state=EXCLUDED.state, business_id=EXCLUDED.business_id, brain=EXCLUDED.brain`,
      [conversation_id, business_id, brain, row]
    );
    this.mem.states.set(conversation_id, row);
    return row;
  }

  async writeTurn(row) {
    if (!row.id) row.id = newId();
    row.created_at = row.created_at ?? nowIso();
    await this.pool.query(
      `INSERT INTO nex.conv_turns
         (id, conversation_id, turn_index, speaker, text, detected_intent, detected_entities, used_item_ids, walked_edge_ids, latency_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (conversation_id, turn_index) DO UPDATE SET
         text=EXCLUDED.text, detected_intent=EXCLUDED.detected_intent,
         detected_entities=EXCLUDED.detected_entities,
         used_item_ids=EXCLUDED.used_item_ids, walked_edge_ids=EXCLUDED.walked_edge_ids,
         latency_ms=EXCLUDED.latency_ms`,
      [row.id, row.conversation_id, row.turn_index, row.speaker, row.text,
       row.detected_intent ?? null, row.detected_entities ?? [],
       row.used_item_ids ?? [], row.walked_edge_ids ?? [], row.latency_ms ?? null]
    );
    this.mem.turns.set(row.id, row);
    return row;
  }

  async writeOutcome(row) {
    if (!row.conversation_id) throw new Error('outcome: conversation_id required');
    await this.pool.query(
      `INSERT INTO nex.conv_outcomes (conversation_id, outcome, outcome_note, labelled_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (conversation_id) DO UPDATE SET
         outcome=EXCLUDED.outcome, outcome_note=EXCLUDED.outcome_note,
         labelled_by=EXCLUDED.labelled_by, labelled_at=now()`,
      [row.conversation_id, row.outcome, row.outcome_note ?? null, row.labelled_by]
    );
    this.mem.outcomes.set(row.conversation_id, { ...row, labelled_at: nowIso() });
    return row;
  }

  async writeFeedback(row) {
    if (!row.id) row.id = newId();
    row.created_at = row.created_at ?? nowIso();
    await this.pool.query(
      `INSERT INTO nex.conv_feedback (id, turn_id, signal, source, note) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO NOTHING`,
      [row.id, row.turn_id, row.signal, row.source, row.note ?? null]
    );
    this.mem.feedback.set(row.id, row);
    return row;
  }

  // --- Internals ------------------------------------------------------

  _readEmbedding(value) {
    if (value == null) return null;
    // JSONB path (dev fallback) — pg returns JS array/object
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return value;
    // VECTOR path (canonical) — pg returns string like "[0.1,0.2,...]"
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return null; }
    }
    return null;
  }

  _writeEmbedding(vec) {
    if (vec == null) return null;
    const arr = Array.isArray(vec) ? vec : Array.from(vec);
    return this.embeddingType === 'jsonb' ? JSON.stringify(arr) : `[${arr.join(',')}]`;
  }

  _embeddingParam(paramIdx) {
    return this.embeddingType === 'jsonb' ? `$${paramIdx}::jsonb` : `$${paramIdx}::vector`;
  }

  _indexEdge(row) {
    this.mem.edges.set(row.id, row);
    if (!this.edgesByFrom.has(row.from_item)) this.edgesByFrom.set(row.from_item, new Set());
    this.edgesByFrom.get(row.from_item).add(row.id);
    if (!this.edgesByTo.has(row.to_item)) this.edgesByTo.set(row.to_item, new Set());
    this.edgesByTo.get(row.to_item).add(row.id);
  }

  _removeEdgeFromIndexes(id, fromId, toId) {
    this.edgesByFrom.get(fromId)?.delete(id);
    this.edgesByTo.get(toId)?.delete(id);
  }
}
