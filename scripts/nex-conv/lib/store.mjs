// ADR-0044 MVP · file-backed store · mirrors migration 050 schema.
// Storage adapter for the MVP. Swappable with a PostgresStore later without
// changing any pipeline code (see design decision in run-report).
//
// Persistence: one JSONL file per "table" under data/nex-conv/mvp/.
// In-memory: Map<id, row> per table, rebuilt from JSONL on start.
//
// Idempotency: caller passes a stable `id` (usually a content hash) so the
// same source ingested twice does not duplicate.

import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { assertKnowledgeItem, assertEdge, newId, nowIso } from './schema.mjs';

const DEFAULT_ROOT = 'C:/Users/Victus/trades/data/nex-conv/mvp';

const TABLES = {
  knowledge_items: 'knowledge-items.jsonl',
  entities: 'entities.jsonl',
  intents: 'intents.jsonl',
  edges: 'edges.jsonl',
  states: 'states.jsonl',
  turns: 'turns.jsonl',
  outcomes: 'outcomes.jsonl',
  feedback: 'feedback.jsonl',
};

export class Store {
  constructor(root = DEFAULT_ROOT) {
    this.root = root;
    this.mem = Object.fromEntries(Object.keys(TABLES).map(k => [k, new Map()]));
    // For edges we also index by from_item and by to_item for graph walks.
    this.edgesByFrom = new Map();
    this.edgesByTo = new Map();
    // For entities we also index by alias → slug for O(1) alias lookup.
    this.entityAliasIdx = new Map();
  }

  async init() {
    if (!existsSync(this.root)) await mkdir(this.root, { recursive: true });
    for (const [table, file] of Object.entries(TABLES)) {
      const path = join(this.root, file);
      if (!existsSync(path)) { await writeFile(path, ''); continue; }
      const raw = await readFile(path, 'utf8');
      let lineNum = 0;
      for (const line of raw.split(/\r?\n/)) {
        lineNum++;
        const trimmed = line.trim();
        if (!trimmed) continue;
        let row;
        try { row = JSON.parse(trimmed); } catch (e) {
          console.warn(`store: skipping malformed ${file}:${lineNum}`);
          continue;
        }
        this._indexRow(table, row);
      }
    }
    return this;
  }

  _indexRow(table, row) {
    const key = row.id ?? row.slug ?? row.conversation_id;
    if (!key) throw new Error(`store: row in ${table} has no id/slug/conversation_id`);
    // "Latest wins" semantics — a re-emitted row (same id) supersedes prior.
    this.mem[table].set(key, row);
    if (table === 'edges') {
      if (!this.edgesByFrom.has(row.from_item)) this.edgesByFrom.set(row.from_item, new Set());
      this.edgesByFrom.get(row.from_item).add(row.id);
      if (!this.edgesByTo.has(row.to_item)) this.edgesByTo.set(row.to_item, new Set());
      this.edgesByTo.get(row.to_item).add(row.id);
    }
    if (table === 'entities') {
      this.entityAliasIdx.set(row.slug.toLowerCase(), row.slug);
      for (const a of row.aliases ?? []) this.entityAliasIdx.set(a.toLowerCase(), row.slug);
    }
  }

  async _persist(table, row) {
    const path = join(this.root, TABLES[table]);
    await appendFile(path, JSON.stringify(row) + '\n');
  }

  // --- Public API mirrors the migration 050 tables ---------------------

  async upsertIntent(row) {
    if (!row.slug) throw new Error('intent: slug required');
    const clean = { slug: row.slug, display_name: row.display_name ?? row.slug, class: row.class, example_phrases: row.example_phrases ?? [], created_at: row.created_at ?? nowIso() };
    this._indexRow('intents', clean);
    await this._persist('intents', clean);
    return clean;
  }

  async upsertEntity(row) {
    if (!row.slug) throw new Error('entity: slug required');
    const clean = { slug: row.slug, display_name: row.display_name ?? row.slug, brain: row.brain, entity_class: row.entity_class, aliases: row.aliases ?? [], embedding: row.embedding ?? null, created_at: row.created_at ?? nowIso() };
    this._indexRow('entities', clean);
    await this._persist('entities', clean);
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
    this._indexRow('knowledge_items', row);
    await this._persist('knowledge_items', row);
    return row;
  }

  async writeEdge(row) {
    if (!row.id) row.id = newId();
    row.evidence_count = row.evidence_count ?? 1;
    row.last_seen_at = nowIso();
    row.created_at = row.created_at ?? nowIso();
    assertEdge(row);
    // dedup on (from_item, to_item, edge_type) — increment evidence_count if seen
    for (const existing of this.mem.edges.values()) {
      if (existing.from_item === row.from_item && existing.to_item === row.to_item && existing.edge_type === row.edge_type) {
        existing.evidence_count += 1;
        existing.last_seen_at = nowIso();
        existing.weight = Math.min(1, existing.weight + 0.02); // small reinforcement per re-observation
        this._indexRow('edges', existing);
        await this._persist('edges', existing);
        return existing;
      }
    }
    this._indexRow('edges', row);
    await this._persist('edges', row);
    return row;
  }

  async upsertState(row) {
    if (!row.conversation_id) throw new Error('state: conversation_id required');
    row.updated_at = nowIso();
    row.created_at = row.created_at ?? nowIso();
    this._indexRow('states', row);
    await this._persist('states', row);
    return row;
  }

  async writeTurn(row) {
    if (!row.id) row.id = newId();
    row.created_at = row.created_at ?? nowIso();
    this._indexRow('turns', row);
    await this._persist('turns', row);
    return row;
  }

  async writeOutcome(row) {
    if (!row.conversation_id) throw new Error('outcome: conversation_id required');
    row.labelled_at = nowIso();
    this._indexRow('outcomes', row);
    await this._persist('outcomes', row);
    return row;
  }

  async writeFeedback(row) {
    if (!row.id) row.id = newId();
    row.created_at = row.created_at ?? nowIso();
    this._indexRow('feedback', row);
    await this._persist('feedback', row);
    return row;
  }

  // --- Read helpers -----------------------------------------------------

  getItem(id) { return this.mem.knowledge_items.get(id); }
  allItems() { return [...this.mem.knowledge_items.values()]; }
  allItemsForBrain(brain) { return this.allItems().filter(r => r.brain === brain); }
  allEdges() { return [...this.mem.edges.values()]; }
  getState(conversation_id) { return this.mem.states.get(conversation_id); }
  entitySlugForAlias(alias) { return this.entityAliasIdx.get(alias.toLowerCase()); }
  allEntities() { return [...this.mem.entities.values()]; }
  allIntents() { return [...this.mem.intents.values()]; }
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
}
