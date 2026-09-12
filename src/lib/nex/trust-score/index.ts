// src/lib/nex/trust-score/index.ts
//
// Founder Phase 6 · P6-5 · NEX Trust Score.
//
// Aggregate trust score in [0..1] per entity, computed from measured
// signals only:
//   1 · citation_alignment_quality   → mean alignment of kept claims (Gate v2)
//   2 · citation_survival_rate       → kept / (kept + rejected)
//   3 · freshness_score              → 1.0 when recent, decays with age
//   4 · verification_evidence_ratio  → canonical_verified / total
//   5 · conflict_penalty             → 1 - (open_conflicts / total_facts)
//
// Doctrine-safe · zero fabrication · returns null when no data.

import type { Pool } from "pg";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

export interface TrustScoreDetail {
  entity_ref: string;
  overall: number;                       // 0..1
  components: {
    citation_alignment_quality: number | null;
    citation_survival_rate: number | null;
    freshness_score: number | null;
    verification_evidence_ratio: number | null;
    conflict_penalty: number | null;
  };
  supporting_data: {
    kept_claims: number;
    rejected_claims: number;
    canonical_verified_facts: number;
    total_facts: number;
    open_conflicts: number;
    oldest_verified_days: number | null;
    newest_verified_days: number | null;
  };
  status: "measured" | "no_data";
}

export async function computeTrustScore(entity_ref: string, pool: Pool = getKnowledgeFactoryDbPool()): Promise<TrustScoreDetail> {
  const empty: TrustScoreDetail = {
    entity_ref,
    overall: 0,
    components: {
      citation_alignment_quality: null,
      citation_survival_rate: null,
      freshness_score: null,
      verification_evidence_ratio: null,
      conflict_penalty: null,
    },
    supporting_data: {
      kept_claims: 0, rejected_claims: 0,
      canonical_verified_facts: 0, total_facts: 0, open_conflicts: 0,
      oldest_verified_days: null, newest_verified_days: null,
    },
    status: "no_data",
  };

  try {
    // 1 + 2 · alignment quality + survival rate.
    // The `source_ref` on gate events is a claim citation like `fact:<entity>:<intent>`
    // or `qv:<hash>` · we match against text containing the entity ref.
    const keeps = await pool.query(
      `SELECT AVG(alignment_score)::float AS mean_align, COUNT(*)::int AS n
         FROM nex.gate_kept_event
         WHERE source_ref ILIKE $1 AND alignment_score IS NOT NULL`,
      [`%${entity_ref}%`],
    );
    const rejects = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM nex.gate_rejection_event
         WHERE source_ref ILIKE $1`,
      [`%${entity_ref}%`],
    );
    const kept_n = Number(keeps.rows[0]?.n ?? 0);
    const kept_align = keeps.rows[0]?.mean_align != null ? Number(keeps.rows[0].mean_align) : null;
    const reject_n = Number(rejects.rows[0]?.n ?? 0);

    // 3 · freshness (from accommodation_business_field_provenance if available).
    const freshnessQ = await pool.query(
      `SELECT MIN(written_at) AS oldest, MAX(written_at) AS newest, COUNT(*)::int AS n,
              SUM(CASE WHEN trust_layer='canonical_verified' THEN 1 ELSE 0 END)::int AS canonical
         FROM nex.accommodation_business_field_provenance
         WHERE business_ref = $1`,
      [entity_ref],
    ).catch(() => ({ rows: [] as Array<{ oldest?: Date; newest?: Date; n?: number; canonical?: number }> }));
    const fr = freshnessQ.rows[0] ?? {};
    const total_facts = Number(fr.n ?? 0);
    const canonical_verified_facts = Number(fr.canonical ?? 0);
    const oldest_days = fr.oldest ? Math.round((Date.now() - new Date(fr.oldest).getTime()) / 86_400_000) : null;
    const newest_days = fr.newest ? Math.round((Date.now() - new Date(fr.newest).getTime()) / 86_400_000) : null;
    // Freshness score decays over 180 days · linear · min 0.
    const freshness_score = newest_days == null ? null : Math.max(0, Math.min(1, 1 - newest_days / 180));

    // 4 · verification ratio.
    const verification_evidence_ratio = total_facts > 0 ? canonical_verified_facts / total_facts : null;

    // 5 · conflict penalty.
    const conflictsQ = await pool.query(
      `SELECT COUNT(*)::int AS n
         FROM nex.accommodation_business_fact_conflict
         WHERE business_ref = $1 AND resolution_status = 'unresolved'`,
      [entity_ref],
    ).catch(() => ({ rows: [{ n: 0 }] }));
    const open_conflicts = Number(conflictsQ.rows[0]?.n ?? 0);
    const conflict_penalty = total_facts > 0 ? Math.max(0, 1 - open_conflicts / total_facts) : null;

    const citation_survival_rate = (kept_n + reject_n) > 0 ? kept_n / (kept_n + reject_n) : null;

    // Signals present?
    if (kept_n === 0 && total_facts === 0) {
      return { ...empty, entity_ref };
    }

    // Overall · weighted mean of components that have data.
    const parts: Array<{ v: number; w: number }> = [];
    if (kept_align != null) parts.push({ v: kept_align, w: 0.25 });
    if (citation_survival_rate != null) parts.push({ v: citation_survival_rate, w: 0.20 });
    if (freshness_score != null) parts.push({ v: freshness_score, w: 0.15 });
    if (verification_evidence_ratio != null) parts.push({ v: verification_evidence_ratio, w: 0.25 });
    if (conflict_penalty != null) parts.push({ v: conflict_penalty, w: 0.15 });
    const total_w = parts.reduce((s, p) => s + p.w, 0);
    const overall = total_w > 0 ? parts.reduce((s, p) => s + p.v * p.w, 0) / total_w : 0;

    return {
      entity_ref,
      overall: Number(overall.toFixed(3)),
      components: {
        citation_alignment_quality: kept_align != null ? Number(kept_align.toFixed(3)) : null,
        citation_survival_rate: citation_survival_rate != null ? Number(citation_survival_rate.toFixed(3)) : null,
        freshness_score: freshness_score != null ? Number(freshness_score.toFixed(3)) : null,
        verification_evidence_ratio: verification_evidence_ratio != null ? Number(verification_evidence_ratio.toFixed(3)) : null,
        conflict_penalty: conflict_penalty != null ? Number(conflict_penalty.toFixed(3)) : null,
      },
      supporting_data: {
        kept_claims: kept_n,
        rejected_claims: reject_n,
        canonical_verified_facts,
        total_facts,
        open_conflicts,
        oldest_verified_days: oldest_days,
        newest_verified_days: newest_days,
      },
      status: "measured",
    };
  } catch {
    return { ...empty, entity_ref };
  }
}
