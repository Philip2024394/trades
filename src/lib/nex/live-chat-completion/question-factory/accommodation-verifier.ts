// src/lib/nex/live-chat-completion/question-factory/accommodation-verifier.ts
//
// Founder BEGIN Phase 2 · Accommodation question verifier (reference impl).
//
// Pulls candidate question_variant rows and resolves each via the same
// deterministic composer path the live chat uses. Never invokes an LLM.
// Never fabricates. Every verification writes back:
//   - answer_status: answered | partially_answered | unknown | conflicting
//   - trust: canonical_verified | evidence_verified | canonical_unverified | ...
//   - reply_kind: fact | list | list_reference | unknown | ...
//   - supporting_fact_refs: JSON array of fact slugs used
//   - last_verified_at / verification_latency_ms
//
// Honest unknowns (with resolved entity) are legitimate answers.
// True unknowns without resolved entity ALSO become knowledge_gap rows.

import type { Pool } from "pg";
import { performance } from "node:perf_hooks";

import type { QuestionVerifier, VerificationResult, QuestionAnswerStatus, TrustBand, ReplyKind } from "../contract";
import { parseIntent } from "@/lib/nex/intelligence-storage-grid/accommodation/intent-parser";
import { computeFactBundle } from "@/lib/nex/intelligence-storage-grid/accommodation/fact-computer";
import { composeReply } from "@/lib/nex/intelligence-storage-grid/accommodation/deterministic-composer";
import {
  factHotGet, factHotSet, factHotSetBulk,
} from "@/lib/nex/intelligence-storage-grid/accommodation/hot-tier-facts";
import type { FactBundle } from "@/lib/nex/intelligence-storage-grid/accommodation/fact-computer";
import type { AccommodationRow, FieldProvenanceRow } from "@/lib/nex/intelligence-storage-grid/accommodation/adapter-postgres";
import type { EnrichmentEvidenceRow } from "@/lib/nex/intelligence-storage-grid/accommodation/fact-computer";

const DOMAIN = "accommodation";

interface VerifierDeps {
  sourcePool: Pool;
  kfPool: Pool;
  /** Also enqueue a knowledge_gap when a verification produces unknown. */
  enqueueGap?: (input: { entity_ref: string; intent_slug: string }) => Promise<void>;
}

/** Warm the hot-tier for a specific listing_ref set. Idempotent per ref. */
async function warmBundles(pool: Pool, refs: readonly string[]): Promise<FactBundle[]> {
  const missing = refs.filter((r) => !factHotGet(r));
  if (missing.length === 0) return refs.map((r) => factHotGet(r)!.bundle);
  try {
    const rows = await pool.query(
      `SELECT * FROM nex.accommodation_business WHERE public_listing_ref = ANY($1::text[])`,
      [missing],
    );
    if (rows.rowCount === 0) return refs.map((r) => factHotGet(r)?.bundle).filter(Boolean) as FactBundle[];
    const foundRefs = (rows.rows as AccommodationRow[]).map((r) => r.public_listing_ref);
    const provRes = await pool.query(
      `SELECT * FROM nex.accommodation_business_field_provenance WHERE business_ref = ANY($1::text[])`,
      [foundRefs],
    );
    const evRes = await pool.query(
      `SELECT business_ref, field_name, value, raw_payload, confidence, source, source_type, discovered_at
         FROM nex.accommodation_enrichment_evidence WHERE business_ref = ANY($1::text[])`,
      [foundRefs],
    );
    const provByRef = new Map<string, FieldProvenanceRow[]>();
    for (const p of provRes.rows as FieldProvenanceRow[]) {
      if (!provByRef.has(p.business_ref)) provByRef.set(p.business_ref, []);
      provByRef.get(p.business_ref)!.push(p);
    }
    const evByRef = new Map<string, EnrichmentEvidenceRow[]>();
    for (const e of evRes.rows as EnrichmentEvidenceRow[]) {
      if (!evByRef.has(e.business_ref)) evByRef.set(e.business_ref, []);
      evByRef.get(e.business_ref)!.push(e);
    }
    const bundles: FactBundle[] = (rows.rows as AccommodationRow[]).map((row) => {
      const b = computeFactBundle({
        row,
        provenance: provByRef.get(row.public_listing_ref) ?? [],
        evidence: evByRef.get(row.public_listing_ref) ?? [],
      });
      factHotSet(row.public_listing_ref, b);
      return b;
    });
    // Return in original refs order, dropping any that failed.
    return refs.map((r) => factHotGet(r)?.bundle).filter(Boolean) as FactBundle[];
  } catch {
    return refs.map((r) => factHotGet(r)?.bundle).filter(Boolean) as FactBundle[];
  }
}

function toBand(t: string): TrustBand {
  const known: TrustBand[] = ["canonical_verified", "canonical_unverified", "evidence_verified", "evidence_provisional", "unknown", "clarify", "mixed"];
  return (known as string[]).includes(t) ? (t as TrustBand) : "unknown";
}

function toStatus(reply_kind: string, answered: boolean, trust: TrustBand): QuestionAnswerStatus {
  if (!answered) {
    if (reply_kind === "unknown") return "unknown";
    return "unknown";
  }
  if (reply_kind === "unknown") return "unknown";
  if (reply_kind === "clarify" || reply_kind === "research_needed") return "unknown";
  if (trust === "canonical_verified" || trust === "evidence_verified") return "answered";
  return "partially_answered";
}

export function makeAccommodationVerifier(deps: VerifierDeps): QuestionVerifier {
  return {
    domain: DOMAIN,
    async verifyBatch(input: { max_variants: number }) {
      const kf = deps.kfPool;
      const src = deps.sourcePool;

      // Pull oldest candidates first so we don't starve tail entries.
      const cand = await kf.query(
        `SELECT fingerprint, entity_ref, intent_slug, raw_text, normalised_text, language
           FROM nex.question_variant
           WHERE domain = $1 AND answer_status = 'candidate'
           ORDER BY created_at ASC
           LIMIT $2`,
        [DOMAIN, input.max_variants],
      );
      if (cand.rowCount === 0) {
        const remaining = await kf.query(
          `SELECT COUNT(*)::int AS n FROM nex.question_variant WHERE domain = $1 AND answer_status = 'candidate'`,
          [DOMAIN],
        );
        return { results: [], remaining_candidates: remaining.rows[0].n };
      }

      // Warm every referenced bundle at once (batched) — MUCH faster than per-question fetch.
      const uniqueRefs = Array.from(new Set(cand.rows.map((r) => String(r.entity_ref))));
      await warmBundles(src, uniqueRefs);

      const results: VerificationResult[] = [];

      for (const row of cand.rows) {
        const t0 = performance.now();
        const fingerprint = String(row.fingerprint);
        const entity_ref = String(row.entity_ref);
        const intent_slug = String(row.intent_slug);
        const raw_text = String(row.raw_text);
        const language = (row.language === "id" ? "id" : "en") as "en" | "id";

        const parsed = parseIntent(raw_text, {
          known_names: uniqueRefs.map((r) => {
            const hit = factHotGet(r);
            return hit ? { listing_ref: r, business_name: hit.bundle.business_name } : null;
          }).filter(Boolean) as { listing_ref: string; business_name: string }[],
        });

        // The verifier trusts the STORED intent_slug more than the parser
        // when they conflict — the generator authored a variant intending
        // a specific intent. But if the parser resolves a different slug
        // that IS a per-property fact intent, we accept the parser's read.
        // For now, use the STORED slug to compose so we test the actual
        // intended coverage.
        const effectiveParsed = {
          ...parsed,
          intent_slug,
          intent: parsed.intent, // may be null if slug isn't in the registry
        };

        // Resolve bundles for this variant.
        const bundle = factHotGet(entity_ref)?.bundle;
        const bundles: FactBundle[] = bundle ? [bundle] : [];

        const composed = composeReply({
          parsed: effectiveParsed as Parameters<typeof composeReply>[0]["parsed"],
          bundles,
          context: {
            language,
            focus_listing_ref: entity_ref,
          },
        });

        const trust = toBand(composed.trust);
        // Adapter-level "honest unknown" logic:
        const adapterAnswered = composed.answered
          || (composed.reply_kind === "unknown" && composed.listing_ref !== null);
        const status = toStatus(composed.reply_kind, adapterAnswered, trust);
        const ms = Math.round(performance.now() - t0);

        results.push({
          fingerprint,
          answer_status: status,
          trust,
          reply_kind: composed.reply_kind as ReplyKind,
          supporting_fact_refs: bundle && composed.answered ? [effectiveParsed.intent_slug] : [],
          composed_preview: composed.reply_text,
          latency_ms: ms,
          verified_at: new Date().toISOString(),
        });

        // Feedback loop: unknown with resolved entity → knowledge_gap.
        if (deps.enqueueGap && composed.reply_kind === "unknown" && bundle) {
          try { await deps.enqueueGap({ entity_ref, intent_slug }); } catch { /* non-fatal */ }
        }
      }

      // Write back verifier verdicts in one UPDATE per row (chunked).
      const chunkSize = 200;
      for (let i = 0; i < results.length; i += chunkSize) {
        const chunk = results.slice(i, i + chunkSize);
        const values: string[] = [];
        const params: unknown[] = [];
        let p = 1;
        for (const r of chunk) {
          values.push(`($${p++}::text, $${p++}::text, $${p++}::text, $${p++}::text, $${p++}::jsonb, $${p++}::timestamptz, $${p++}::int)`);
          params.push(
            r.fingerprint, r.answer_status, r.trust, r.reply_kind,
            JSON.stringify(r.supporting_fact_refs), r.verified_at, r.latency_ms,
          );
        }
        await kf.query(
          `UPDATE nex.question_variant q SET
             answer_status = v.answer_status,
             trust = v.trust,
             reply_kind = v.reply_kind,
             supporting_fact_refs = v.supporting_fact_refs,
             last_verified_at = v.last_verified_at,
             verification_latency_ms = v.verification_latency_ms,
             updated_at = now()
           FROM (VALUES ${values.join(",")}) AS v(fingerprint, answer_status, trust, reply_kind, supporting_fact_refs, last_verified_at, verification_latency_ms)
           WHERE q.fingerprint = v.fingerprint`,
          params,
        );
      }

      const remaining = await kf.query(
        `SELECT COUNT(*)::int AS n FROM nex.question_variant WHERE domain = $1 AND answer_status = 'candidate'`,
        [DOMAIN],
      );
      return { results, remaining_candidates: remaining.rows[0].n };
    },
  };
}
