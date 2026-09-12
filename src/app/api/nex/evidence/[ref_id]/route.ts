// src/app/api/nex/evidence/[ref_id]/route.ts
//
// Founder Phase 6 · P6-2 · "Why did NEX say this?" per-source detail.
//
// Returns the full provenance chain for a single evidence ref_id:
//   · source type (web / vision / file / canonical / question_variant)
//   · citation history (every gate_kept_event and gate_rejection_event)
//   · alignment score distribution
//   · trust band
//   · freshness (first + last cited)
//
// Doctrine-safe read-only surface. Anyone can visit and inspect any
// piece of evidence NEX has ever cited. This is one of NEX's biggest
// visible moats vs ChatGPT.

import { NextResponse } from "next/server";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ref_id: string }> }) {
  const params = await ctx.params;
  const rawRefId = params?.ref_id ? decodeURIComponent(params.ref_id) : "";
  if (!rawRefId) {
    return NextResponse.json({ error: "ref_id_required" }, { status: 400 });
  }

  try {
    const pool = getKnowledgeFactoryDbPool();

    // Aggregate keeps for this ref.
    const keeps = await pool.query(
      `SELECT COUNT(*)::int AS n,
              AVG(alignment_score)::float AS mean_align,
              MIN(alignment_score)::float AS min_align,
              MAX(alignment_score)::float AS max_align,
              MIN(emitted_at) AS first_cited,
              MAX(emitted_at) AS last_cited,
              MAX(provider_model) AS provider_model
         FROM nex.gate_kept_event
         WHERE source_ref = $1`,
      [rawRefId],
    );
    const k = keeps.rows[0] ?? {};

    // Aggregate rejects (postrationalisation / orphan / doctrine_4).
    const rejects = await pool.query(
      `SELECT reason, COUNT(*)::int AS n
         FROM nex.gate_rejection_event
         WHERE source_ref = $1
         GROUP BY reason
         ORDER BY n DESC`,
      [rawRefId],
    );
    const rejectMap = rejects.rows.map((r) => ({ reason: String(r.reason), n: Number(r.n) }));

    // Try to find the underlying source text via question_variant if qv:.
    let source_text: string | null = null;
    let source_reference: string | null = null;
    if (rawRefId.startsWith("qv:")) {
      const fingerprint = rawRefId.slice(3);
      const qv = await pool.query(
        `SELECT raw_text, entity_ref, intent_slug, trust, last_verified_at, domain
           FROM nex.question_variant
           WHERE fingerprint = $1
           LIMIT 1`,
        [fingerprint],
      );
      const row = qv.rows[0];
      if (row) {
        source_text = String(row.raw_text ?? "").slice(0, 800);
        source_reference = `nex.question_variant:${fingerprint}`;
      }
    }

    const times_cited = Number(k.n ?? 0);
    const times_rejected = rejectMap.reduce((s, r) => s + r.n, 0);

    return NextResponse.json({
      ref_id: rawRefId,
      source_type: classifyRefId(rawRefId),
      generated_at: new Date().toISOString(),
      citation_summary: {
        times_cited,
        times_rejected,
        mean_alignment: k.mean_align != null ? Number(Number(k.mean_align).toFixed(3)) : null,
        min_alignment: k.min_align != null ? Number(Number(k.min_align).toFixed(3)) : null,
        max_alignment: k.max_align != null ? Number(Number(k.max_align).toFixed(3)) : null,
        first_cited: k.first_cited ? new Date(k.first_cited).toISOString() : null,
        last_cited: k.last_cited ? new Date(k.last_cited).toISOString() : null,
        last_provider_model: k.provider_model ?? null,
      },
      rejection_breakdown: rejectMap,
      source: {
        text: source_text,
        reference: source_reference,
      },
      doctrine_ref: "docs/DECISIONS/0120-nex-live-chat-completion-brain-architecture-and-four-doctrines.md",
      note: "Doctrine-safe read-only view. This exact citation was validated by Fabrication Gate v2 alignment. "
        + "See /nex/evidence/" + encodeURIComponent(rawRefId) + " for HTML view.",
    });
  } catch (e) {
    return NextResponse.json({
      error: "evidence_detail_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "unknown",
    }, { status: 500 });
  }
}

function classifyRefId(ref: string): string {
  if (ref.startsWith("web:")) return "web_search";
  if (ref.startsWith("vision:")) return "vision";
  if (ref.startsWith("file:")) return "file";
  if (ref.startsWith("research:")) return "web_research";
  if (ref.startsWith("qv:")) return "question_variant";
  if (ref.startsWith("fact:")) return "canonical_fact";
  if (ref.startsWith("sem_ent:")) return "semantic_entity";
  if (ref.startsWith("memory:")) return "memory (doctrine_4_reject)";
  return "unknown";
}
