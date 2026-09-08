// src/lib/nex/intelligence-storage-grid/relationship-layer/store-jsonl.ts
//
// NEX INTELLIGENCE STORAGE GRID · Cross-Domain Relationship Layer
// Founder BEGIN 2026-09-08 · Phase 4 · §11-12
//
// Deterministic, queryable relationship store. NO LLM required for
// basic relationship queries per §12.
//
// Discipline (Founder mandated):
// - Do NOT duplicate entire domain datasets into every agent
// - Use canonical entity IDs (accommodation: public_listing_ref, etc.)
// - Every relationship carries evidence + confidence + freshness + supersession
// - JSONL append-only; no destructive updates (supersede pattern)
// - Zero new Postgres tables · zero cloud storage · uses existing local FS
//
// Path convention (matches master-ai/paths.ts pattern):
//   data/intelligence-storage-grid/relationships/relationships.jsonl
//   data/intelligence-storage-grid/relationships/relationships_${date}.jsonl (rotation)

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  DomainAgentId,
  EvidenceRecord,
  FreshnessState,
  KnowledgeStatus,
  RelationshipRecord,
  RelationshipType,
} from "../types.js";

// Repo-relative root · caller can override via NEX_ISG_DATA_ROOT
function isgDataRoot(): string {
  return process.env.NEX_ISG_DATA_ROOT
    ?? path.join(process.cwd(), "data", "intelligence-storage-grid");
}
function relationshipsJsonlPath(): string {
  return path.join(isgDataRoot(), "relationships", "relationships.jsonl");
}

/** Input for creating a new relationship. */
export interface CreateRelationshipInput {
  source_domain: DomainAgentId;
  source_entity_kind: string;
  source_entity_ref: string;
  target_domain: DomainAgentId;
  target_entity_kind: string;
  target_entity_ref: string;
  relationship_type: RelationshipType;
  distance_km?: number | null;
  distance_meters?: number | null;
  bearing_degrees?: number | null;
  evidence?: EvidenceRecord | null;
  confidence?: number;
  freshness_state?: FreshnessState;
  status?: KnowledgeStatus;
}

/** Query filter for relationship lookup. */
export interface RelationshipQuery {
  source_domain?: DomainAgentId;
  source_entity_ref?: string;
  target_domain?: DomainAgentId;
  target_entity_ref?: string;
  relationship_type?: RelationshipType | RelationshipType[];
  status?: KnowledgeStatus | KnowledgeStatus[];
  max_distance_km?: number;
  limit?: number;
}

/**
 * In-memory + JSONL-persisted relationship store.
 * Read-optimised (all records loaded into memory).
 * Write-through append to JSONL.
 * Supersession = write new record with supersedes ref, do NOT delete old.
 */
export class RelationshipStore {
  private records: Map<string, RelationshipRecord> = new Map();
  private supersededIds: Set<string> = new Set();
  private jsonlPath: string;

  constructor(jsonlPath?: string) {
    this.jsonlPath = jsonlPath ?? relationshipsJsonlPath();
    this.loadFromJsonl();
  }

  private loadFromJsonl(): void {
    if (!fs.existsSync(this.jsonlPath)) return;
    const content = fs.readFileSync(this.jsonlPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line) as RelationshipRecord;
        this.records.set(rec.relationship_id, rec);
        if (rec.supersedes) this.supersededIds.add(rec.supersedes);
      } catch { /* skip malformed */ }
    }
  }

  /**
   * Create a new relationship record.
   * If (source, target, type) already exists · existing is superseded.
   * Symmetric relationships (e.g., NEARBY) are NOT auto-created reverse ·
   * caller decides based on relationship semantics.
   */
  create(input: CreateRelationshipInput): RelationshipRecord {
    const now = new Date().toISOString();
    const id = `rel_${crypto.randomBytes(6).toString("hex")}_${Date.now()}`;

    // Check for existing same-shape relationship to supersede
    const existing = this.findExistingSameShape(input);
    if (existing) this.supersededIds.add(existing.relationship_id);

    const rec: RelationshipRecord = {
      relationship_id: id,
      source_domain: input.source_domain,
      source_entity_kind: input.source_entity_kind,
      source_entity_ref: input.source_entity_ref,
      target_domain: input.target_domain,
      target_entity_kind: input.target_entity_kind,
      target_entity_ref: input.target_entity_ref,
      relationship_type: input.relationship_type,
      distance_km: input.distance_km ?? null,
      distance_meters: input.distance_meters ?? null,
      bearing_degrees: input.bearing_degrees ?? null,
      evidence: input.evidence ?? null,
      confidence: input.confidence ?? 0.8,
      freshness_state: input.freshness_state ?? "FRESH",
      status: input.status ?? "OBSERVED",
      created_at_iso: now,
      verified_at_iso: null,
      refreshed_at_iso: null,
      supersedes: existing?.relationship_id ?? null,
      superseded_by: null,
    };
    this.records.set(id, rec);
    if (existing) {
      const existingRec = this.records.get(existing.relationship_id);
      if (existingRec) existingRec.superseded_by = id;
    }
    this.persist(rec);
    return rec;
  }

  /**
   * Query relationships. All predicates AND-ed. Superseded records excluded
   * unless explicitly requested.
   */
  query(filter: RelationshipQuery, includeSuperseded: boolean = false): RelationshipRecord[] {
    const results: RelationshipRecord[] = [];
    const limit = filter.limit ?? 100;
    for (const rec of this.records.values()) {
      if (!includeSuperseded && this.supersededIds.has(rec.relationship_id)) continue;
      if (filter.source_domain && rec.source_domain !== filter.source_domain) continue;
      if (filter.source_entity_ref && rec.source_entity_ref !== filter.source_entity_ref) continue;
      if (filter.target_domain && rec.target_domain !== filter.target_domain) continue;
      if (filter.target_entity_ref && rec.target_entity_ref !== filter.target_entity_ref) continue;
      if (filter.relationship_type) {
        const types = Array.isArray(filter.relationship_type) ? filter.relationship_type : [filter.relationship_type];
        if (!types.includes(rec.relationship_type)) continue;
      }
      if (filter.status) {
        const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
        if (!statuses.includes(rec.status)) continue;
      }
      if (filter.max_distance_km !== undefined && (rec.distance_km === null || rec.distance_km > filter.max_distance_km)) continue;
      results.push(rec);
      if (results.length >= limit) break;
    }
    return results;
  }

  /**
   * Traverse relationships starting from an entity, up to max hops.
   * Returns records found + entities visited.
   * Deterministic breadth-first. No LLM.
   */
  traverse(input: {
    start_domain: DomainAgentId;
    start_entity_ref: string;
    max_hops: number;
    relationship_types?: RelationshipType[];
    max_distance_km_per_hop?: number;
  }): {
    visited_entities: Array<{ domain: DomainAgentId; entity_ref: string; hop: number }>;
    relationships: RelationshipRecord[];
  } {
    const visited: Array<{ domain: DomainAgentId; entity_ref: string; hop: number }> = [
      { domain: input.start_domain, entity_ref: input.start_entity_ref, hop: 0 },
    ];
    const visitedKey = new Set<string>([`${input.start_domain}::${input.start_entity_ref}`]);
    const foundRels: RelationshipRecord[] = [];
    let frontier = [{ domain: input.start_domain, entity_ref: input.start_entity_ref, hop: 0 }];

    for (let hop = 0; hop < input.max_hops; hop++) {
      const nextFrontier: typeof frontier = [];
      for (const node of frontier) {
        const rels = this.query({
          source_domain: node.domain,
          source_entity_ref: node.entity_ref,
          relationship_type: input.relationship_types,
          max_distance_km: input.max_distance_km_per_hop,
          limit: 50,
        });
        for (const rel of rels) {
          foundRels.push(rel);
          const key = `${rel.target_domain}::${rel.target_entity_ref}`;
          if (!visitedKey.has(key)) {
            visitedKey.add(key);
            const entry = { domain: rel.target_domain, entity_ref: rel.target_entity_ref, hop: hop + 1 };
            visited.push(entry);
            nextFrontier.push(entry);
          }
        }
      }
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }
    return { visited_entities: visited, relationships: foundRels };
  }

  /** Delete-by-supersession · never actual delete. */
  supersede(relationship_id: string, reason: string): void {
    const existing = this.records.get(relationship_id);
    if (!existing) return;
    this.supersededIds.add(relationship_id);
    // Persist a marker record so replay reproduces supersession
    const now = new Date().toISOString();
    const marker: RelationshipRecord = {
      ...existing,
      relationship_id: `rel_supersedemarker_${crypto.randomBytes(6).toString("hex")}_${Date.now()}`,
      status: "SUPERSEDED",
      created_at_iso: now,
      supersedes: relationship_id,
      superseded_by: null,
      evidence: existing.evidence
        ? { ...existing.evidence, value_normalised: `superseded: ${reason}` }
        : null,
    };
    this.records.set(marker.relationship_id, marker);
    existing.superseded_by = marker.relationship_id;
    this.persist(marker);
  }

  /** Statistics · MEASURED. */
  stats(): {
    total_records: number;
    active_records: number;
    superseded_records: number;
    by_type: Record<string, number>;
    by_source_domain: Record<string, number>;
    by_target_domain: Record<string, number>;
  } {
    const byType: Record<string, number> = {};
    const bySrc: Record<string, number> = {};
    const byTgt: Record<string, number> = {};
    let active = 0;
    for (const r of this.records.values()) {
      if (!this.supersededIds.has(r.relationship_id) && r.status !== "SUPERSEDED") {
        active++;
        byType[r.relationship_type] = (byType[r.relationship_type] ?? 0) + 1;
        bySrc[r.source_domain] = (bySrc[r.source_domain] ?? 0) + 1;
        byTgt[r.target_domain] = (byTgt[r.target_domain] ?? 0) + 1;
      }
    }
    return {
      total_records: this.records.size,
      active_records: active,
      superseded_records: this.supersededIds.size,
      by_type: byType,
      by_source_domain: bySrc,
      by_target_domain: byTgt,
    };
  }

  private findExistingSameShape(input: CreateRelationshipInput): RelationshipRecord | null {
    for (const rec of this.records.values()) {
      if (this.supersededIds.has(rec.relationship_id)) continue;
      if (
        rec.source_domain === input.source_domain &&
        rec.source_entity_ref === input.source_entity_ref &&
        rec.target_domain === input.target_domain &&
        rec.target_entity_ref === input.target_entity_ref &&
        rec.relationship_type === input.relationship_type
      ) {
        return rec;
      }
    }
    return null;
  }

  private persist(rec: RelationshipRecord): void {
    const dir = path.dirname(this.jsonlPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(this.jsonlPath, JSON.stringify(rec) + "\n", "utf8");
  }
}
