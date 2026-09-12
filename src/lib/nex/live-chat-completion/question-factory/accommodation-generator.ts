// src/lib/nex/live-chat-completion/question-factory/accommodation-generator.ts
//
// Founder BEGIN Phase 2 · Accommodation question generator (reference impl).
//
// Continuous, resumable, idempotent. Same contract (§22) as future
// food/markets/transport/business/travel/attractions generators.
//
// Loop:
//   1. Bootstrap nex.entity_index from nex.accommodation_business ONCE
//      per process (or if entity_index is behind by > 1000 rows).
//   2. Pull next N entities that haven't been fully covered.
//   3. For each entity × each intent × each phrasing template:
//        - compute fingerprint
//        - UPSERT into nex.question_variant (candidate)
//   4. Return { generated, dedup, next_cursor, exhausted }.
//
// Governors respected:
//   - max_variants per batch (never generate more than requested)
//   - duplicate-rate check surfaces the dup% so worker can pause
//   - never touches nex.accommodation_business (read-only source)

import type { Pool } from "pg";
import { performance } from "node:perf_hooks";

import { INTENT_REGISTRY } from "@/lib/nex/intelligence-storage-grid/accommodation/intent-registry";
import type { QuestionGenerator, QuestionVariant } from "../contract";
import { computeFingerprint, normaliseQuestion } from "./fingerprint";
import { phrasingsForIntent, renderTemplate } from "./phrasing-templates";

const DOMAIN = "accommodation";

interface AdapterDeps {
  /** Read source · nex.accommodation_business + relatives. */
  sourcePool: Pool;
  /** Write target · nex.entity_index + question_variant. Usually same pool. */
  kfPool: Pool;
}

interface BootstrapResult {
  bootstrapped: number;
  ms: number;
}

/** Idempotent entity_index refresh from accommodation_business. */
async function ensureEntitiesIndexed(deps: AdapterDeps): Promise<BootstrapResult> {
  const t0 = performance.now();
  const src = deps.sourcePool;
  const kf = deps.kfPool;
  // Row-count sanity — cheap.
  const srcCount = await src.query(
    `SELECT COUNT(*)::int AS n FROM nex.accommodation_business
      WHERE claim_status IN ('listed','invited','claimed','paying')`,
  );
  const idxCount = await kf.query(
    `SELECT COUNT(*)::int AS n FROM nex.entity_index WHERE domain = $1`,
    [DOMAIN],
  );
  const src_n = srcCount.rows[0].n as number;
  const idx_n = idxCount.rows[0].n as number;
  if (src_n === 0) return { bootstrapped: 0, ms: Math.round(performance.now() - t0) };
  if (idx_n === src_n) return { bootstrapped: 0, ms: Math.round(performance.now() - t0) };

  // Pull source rows in chunks so we don't overwhelm memory.
  const chunk = 1000;
  let offset = 0;
  let inserted = 0;
  while (true) {
    const rows = await src.query(
      `SELECT public_listing_ref, business_name, city
         FROM nex.accommodation_business
         WHERE claim_status IN ('listed','invited','claimed','paying')
         ORDER BY public_listing_ref ASC
         LIMIT $1 OFFSET $2`,
      [chunk, offset],
    );
    if (rows.rowCount === 0) break;
    const values: string[] = [];
    const params: unknown[] = [];
    let i = 1;
    for (const r of rows.rows) {
      const ref = String(r.public_listing_ref);
      const name = String(r.business_name ?? "").trim();
      if (!name) continue;
      const city = r.city != null ? String(r.city) : null;
      values.push(`($${i++}, $${i++}, $${i++}, $${i++}, $${i++}, $${i++})`);
      params.push(ref, DOMAIN, name, city, "nex.accommodation_business", "public_listing_ref");
    }
    if (values.length > 0) {
      await kf.query(
        `INSERT INTO nex.entity_index
           (entity_ref, domain, canonical_name, city, source_table, source_pk_column)
         VALUES ${values.join(",")}
         ON CONFLICT (domain, entity_ref) DO UPDATE SET
           canonical_name = EXCLUDED.canonical_name,
           city = EXCLUDED.city,
           last_seen_at = now()`,
        params,
      );
      inserted += values.length;
    }
    offset += chunk;
    if (rows.rowCount < chunk) break;
  }
  return { bootstrapped: inserted, ms: Math.round(performance.now() - t0) };
}

export interface AccommodationGeneratorState {
  bootstrap?: BootstrapResult | null;
}

export function makeAccommodationQuestionGenerator(deps: AdapterDeps): QuestionGenerator & {
  bootstrapNow: () => Promise<BootstrapResult>;
} {
  return {
    domain: DOMAIN,
    async bootstrapNow() {
      return ensureEntitiesIndexed(deps);
    },
    async generateBatch(input: { max_variants: number; cursor?: string | null }) {
      const t0 = performance.now();
      const notes: string[] = [];
      const kf = deps.kfPool;

      // Ensure the index is warm on the first call of the process (cheap
      // if already warm).
      const bootstrap = await ensureEntitiesIndexed(deps);
      if (bootstrap.bootstrapped > 0) {
        notes.push(`bootstrapped ${bootstrap.bootstrapped} entities into entity_index (${bootstrap.ms}ms)`);
      }

      // Cursor is the last entity_ref we generated for. On empty cursor,
      // start from the smallest.
      const cursorRef = input.cursor ?? "";

      // Pull entities in ref order. Deterministic cursor.
      const entityBatch = await kf.query(
        `SELECT entity_ref, canonical_name, city
           FROM nex.entity_index
           WHERE domain = $1 AND entity_ref > $2
           ORDER BY entity_ref ASC
           LIMIT 50`,
        [DOMAIN, cursorRef],
      );

      if (entityBatch.rowCount === 0) {
        notes.push("no more entities to process · marking exhausted");
        return { variants: [], next_cursor: null, exhausted: true, generation_notes: notes };
      }

      // Build all candidate variants across the entity batch — cap by max_variants.
      const variants: QuestionVariant[] = [];
      let lastRef: string = cursorRef;
      outer: for (const entity of entityBatch.rows) {
        const name = String(entity.canonical_name ?? "").trim();
        const city = entity.city != null ? String(entity.city) : null;
        const ref = String(entity.entity_ref);
        lastRef = ref;
        if (!name) continue;
        for (const intent of INTENT_REGISTRY) {
          const phrasings = phrasingsForIntent(intent);
          if (phrasings.length === 0) continue;
          const requiredFacts: string[] = [];
          for (const canon of intent.canonical_fields) requiredFacts.push(canon);
          for (const ev of intent.evidence_field_names) requiredFacts.push(ev);
          for (const p of phrasings) {
            const raw = renderTemplate(p.raw_template, {
              name, city, category: null,
              intent_display: intent.display_en.toLowerCase(),
            });
            const normalised = normaliseQuestion(raw);
            if (!normalised) continue;
            const fp = computeFingerprint({
              domain: DOMAIN, entity_ref: ref, intent_slug: intent.slug,
              normalised_text: normalised, language: p.language,
            });
            variants.push({
              fingerprint: fp,
              domain: DOMAIN,
              entity_ref: ref,
              intent_slug: intent.slug,
              raw_text: raw,
              normalised_text: normalised,
              language: p.language,
              required_fact_slugs: requiredFacts,
              source: "template",
            });
            if (variants.length >= input.max_variants) break outer;
          }
        }
      }

      // UPSERT into question_variant. Duplicate fingerprint collisions
      // just refresh updated_at; count the number of NEW rows (returning
      // xmax = 0 means insert · xmax != 0 means update).
      let inserted = 0;
      let updated = 0;
      if (variants.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < variants.length; i += chunkSize) {
          const chunk = variants.slice(i, i + chunkSize);
          const values: string[] = [];
          const params: unknown[] = [];
          let p = 1;
          for (const v of chunk) {
            values.push(`($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`);
            params.push(
              v.fingerprint,
              v.domain,
              v.entity_ref,
              v.intent_slug,
              v.raw_text,
              v.normalised_text,
              v.language,
              JSON.stringify(v.required_fact_slugs),
              v.source,
            );
          }
          const result = await kf.query(
            `INSERT INTO nex.question_variant
               (fingerprint, domain, entity_ref, intent_slug, raw_text, normalised_text,
                language, required_fact_slugs, source)
             VALUES ${values.join(",")}
             ON CONFLICT (fingerprint) DO UPDATE SET updated_at = now()
             RETURNING (xmax = 0) AS was_insert`,
            params,
          );
          for (const r of result.rows) {
            if (r.was_insert) inserted++;
            else updated++;
          }
        }
      }

      const dupPct = variants.length === 0 ? 0 : (updated / variants.length) * 100;
      const ms = Math.round(performance.now() - t0);
      notes.push(`batch · variants=${variants.length} inserted=${inserted} updated=${updated} dup_rate=${dupPct.toFixed(1)}% ms=${ms}`);

      // Exhaustion check: if this batch's entities were fewer than the
      // page-size AND we hit the end of the phrasing tree, we're done.
      // Otherwise return next cursor.
      const exhausted = entityBatch.rowCount < 50 && variants.length < input.max_variants;

      return {
        variants,
        next_cursor: exhausted ? null : lastRef,
        exhausted,
        generation_notes: notes,
      };
    },
  };
}
