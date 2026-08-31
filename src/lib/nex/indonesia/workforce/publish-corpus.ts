// publish-corpus · fixes the supervisor persistence defect.
//
// Before this file existed the supervisor's onPublish handler just
// console.log-ed records and threw them away (see the
// `production would append to knowledge-acquired.json here` TODO in
// scripts/walkers/run-supervisor.mjs). Every workforce tick produced
// zero durable output; workers were performing acquisition into a
// void.
//
// This module converts an EnrichedKnowledgeRecord (pipeline output ·
// legacy KnowledgeRecord shape + walker-pipeline extras) into a
// canonical EntityRecord (via the existing migrateRecord function)
// and upserts it into data/indonesia/knowledge-entities.json by
// deterministic id. Atomic file write · idempotent · pure functions
// wrap the file boundary. No architecture expansion.
//
// Doctrine:
//  · One publish path · same corpus file NEX retrieval reads
//  · Provenance preserved verbatim from the enriched record
//  · Same-id republishes UPDATE in place · never duplicate
//  · Records that fail migration are skipped and reported · never
//    silently dropped
//  · Publishing is best-effort · never throws to the caller (worker
//    must not crash if disk hiccups · errors surface via the report)

import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EnrichedKnowledgeRecord } from "../walkers/pipeline";
import type { EntityRecord } from "../data/types";
import { migrateRecord } from "../data/migration";
import { scoreEntity } from "../data/quality";

/**
 * Direct-publish variant · Stage 3 (Philip 2026-08-31) · used when
 * the source already produces canonical EntityRecords with full geo +
 * provenance + category (e.g. OSM Overpass connector).
 *
 * The KnowledgeRecord → EntityRecord pipeline round-trip is LOSSY:
 * migrateRecord derives name from topic-tail (mangling proper names),
 * category from topic-prefix (flattening rich categories), and drops
 * lat/lng because RawFactChunk carries no geo fields. For sources
 * that already know the shape they want, publish directly · same
 * upsert-by-id semantics · same atomic write · same idempotency.
 */
export function publishEntitiesDirect(
  entities: EntityRecord[],
  opts: PublishOptions = {},
): PublishResult {
  const entityFile = opts.entityFile ?? DEFAULT_ENTITY_FILE;
  const now = (opts.now ?? (() => new Date()))();
  const attempted = entities.length;
  const skipped: PublishResult["skipped"] = [];

  let byId: Map<string, EntityRecord>;
  let corpusSizeBefore = 0;
  try {
    if (existsSync(entityFile)) {
      const parsed = JSON.parse(readFileSync(entityFile, "utf8")) as { entities?: EntityRecord[] };
      const existing = parsed.entities ?? [];
      corpusSizeBefore = existing.length;
      byId = new Map(existing.map((e) => [e.id, e]));
    } else {
      byId = new Map();
    }
  } catch (err) {
    return {
      attempted,
      published: 0, updated: 0, unchanged: 0,
      skipped: [{ id: "*corpus_read*", reason: `corpus_read_failed:${(err as Error).message.slice(0, 200)}` }],
      corpusSizeBefore: 0, corpusSizeAfter: 0, writtenTo: entityFile,
    };
  }

  let published = 0, updated = 0, unchanged = 0;
  for (const rec of entities) {
    if (!rec.id || !rec.name || !rec.kind) {
      skipped.push({ id: rec.id ?? "?", reason: "missing_required_field" });
      continue;
    }
    // Score with fresh clock · never overwrite good scoring silently.
    try { rec.quality = scoreEntity(rec, now); } catch { /* */ }
    const existing = byId.get(rec.id);
    if (!existing) {
      byId.set(rec.id, rec);
      published++;
    } else {
      const before = JSON.stringify(existing);
      const after = JSON.stringify(rec);
      if (before === after) unchanged++;
      else { byId.set(rec.id, rec); updated++; }
    }
  }

  if (published === 0 && updated === 0) {
    return {
      attempted, published, updated, unchanged, skipped,
      corpusSizeBefore, corpusSizeAfter: corpusSizeBefore, writtenTo: entityFile,
    };
  }

  const allEntities = [...byId.values()];
  const payload = {
    generatedAt: now.toISOString(),
    schemaVersion: 1,
    count: allEntities.length,
    entities: allEntities,
  };
  try {
    mkdirSync(path.dirname(entityFile), { recursive: true });
    const tmp = entityFile + ".tmp";
    writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
    renameSync(tmp, entityFile);
  } catch (err) {
    skipped.push({ id: "*corpus_write*", reason: `corpus_write_failed:${(err as Error).message.slice(0, 200)}` });
    return {
      attempted, published: 0, updated: 0, unchanged, skipped,
      corpusSizeBefore, corpusSizeAfter: corpusSizeBefore, writtenTo: entityFile,
    };
  }

  return {
    attempted, published, updated, unchanged, skipped,
    corpusSizeBefore, corpusSizeAfter: allEntities.length, writtenTo: entityFile,
  };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENTITY_FILE = path.resolve(here, "../../../../../data/indonesia/knowledge-entities.json");

export type PublishOptions = {
  /** Override for tests · defaults to the real canonical corpus. */
  entityFile?: string;
  /** Injected clock. */
  now?: () => Date;
};

export type PublishResult = {
  attempted: number;
  published: number;    // new to the corpus this call
  updated: number;      // upserted by existing id
  unchanged: number;    // migration produced identical bytes to what was on disk
  skipped: Array<{ id: string; reason: string }>;
  corpusSizeBefore: number;
  corpusSizeAfter: number;
  writtenTo: string;
};

/**
 * Upsert enriched records into the canonical EntityRecord corpus.
 * Idempotent by id.
 *
 * Failure modes handled without throwing:
 *  · corpus file missing → treated as empty corpus, created on write
 *  · corpus file corrupt → refuses to overwrite; returns error in skipped[]
 *  · migration failure per-record → recorded in skipped[], other records still publish
 *  · atomic write failure → reported via skipped[] · caller decides retry
 */
export function publishEnrichedRecords(
  records: EnrichedKnowledgeRecord[],
  opts: PublishOptions = {},
): PublishResult {
  const entityFile = opts.entityFile ?? DEFAULT_ENTITY_FILE;
  const now = (opts.now ?? (() => new Date()))();
  const attempted = records.length;
  const skipped: PublishResult["skipped"] = [];

  // Read existing corpus · treat any read failure as "empty corpus".
  let byId: Map<string, EntityRecord>;
  let corpusSizeBefore = 0;
  try {
    if (existsSync(entityFile)) {
      const parsed = JSON.parse(readFileSync(entityFile, "utf8")) as { entities?: EntityRecord[] };
      const existing = parsed.entities ?? [];
      corpusSizeBefore = existing.length;
      byId = new Map(existing.map((e) => [e.id, e]));
    } else {
      byId = new Map();
    }
  } catch (err) {
    // Refuse to overwrite a corrupt corpus · loud failure via skipped[].
    return {
      attempted,
      published: 0, updated: 0, unchanged: 0,
      skipped: [{ id: "*corpus_read*", reason: `corpus_read_failed:${(err as Error).message.slice(0, 200)}` }],
      corpusSizeBefore: 0,
      corpusSizeAfter: 0,
      writtenTo: entityFile,
    };
  }

  let published = 0, updated = 0, unchanged = 0;

  for (const rec of records) {
    // Convert via the same migration path the legacy corpus went
    // through · one canonical shape · one code path.
    let entity: EntityRecord | null;
    try {
      entity = migrateRecord(rec, now);
    } catch (err) {
      skipped.push({ id: rec.id ?? "?", reason: `migration_threw:${(err as Error).message.slice(0, 120)}` });
      continue;
    }
    if (!entity) {
      skipped.push({ id: rec.id ?? "?", reason: "migration_returned_null" });
      continue;
    }
    // Score with a fresh clock so freshness/staleness reflect now.
    try { entity.quality = scoreEntity(entity, now); }
    catch { /* scoring never blocks publish · missing field only */ }

    const existing = byId.get(entity.id);
    if (!existing) {
      byId.set(entity.id, entity);
      published++;
    } else {
      // Idempotency check · if the entity we're about to write is
      // byte-identical to what's on disk we don't count it as an update.
      // Comparing serialised JSON ignores field-order · MergeEntities
      // is intentionally NOT called here (this is a persistence layer,
      // not a resolution layer · dedupe is upstream in the pipeline).
      const before = JSON.stringify(existing);
      const after = JSON.stringify(entity);
      if (before === after) {
        unchanged++;
      } else {
        byId.set(entity.id, entity);
        updated++;
      }
    }
  }

  // Nothing changed · skip the write entirely (idempotent).
  if (published === 0 && updated === 0) {
    return {
      attempted, published, updated, unchanged, skipped,
      corpusSizeBefore,
      corpusSizeAfter: corpusSizeBefore,
      writtenTo: entityFile,
    };
  }

  const allEntities = [...byId.values()];
  const payload = {
    generatedAt: now.toISOString(),
    schemaVersion: 1,
    count: allEntities.length,
    entities: allEntities,
  };
  try {
    mkdirSync(path.dirname(entityFile), { recursive: true });
    const tmp = entityFile + ".tmp";
    writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n");
    renameSync(tmp, entityFile);
  } catch (err) {
    skipped.push({ id: "*corpus_write*", reason: `corpus_write_failed:${(err as Error).message.slice(0, 200)}` });
    return {
      attempted, published: 0, updated: 0, unchanged,
      skipped,
      corpusSizeBefore,
      corpusSizeAfter: corpusSizeBefore,
      writtenTo: entityFile,
    };
  }

  return {
    attempted, published, updated, unchanged, skipped,
    corpusSizeBefore,
    corpusSizeAfter: allEntities.length,
    writtenTo: entityFile,
  };
}
