// src/app/api/nex/evidence/list/route.ts
//
// Founder Phase 6 · P6-1 · Public evidence catalog.
//
// Reads nex.gate_kept_event · aggregates by source_ref · returns the
// top-N sources NEX has successfully cited (i.e. survived Fabrication
// Gate v2). Every entry is a claim NEX will stand behind because it
// passed the citation alignment check.
//
// This is one of NEX's biggest visible moats vs ChatGPT: anyone can
// see what NEX cites, how often, and with what alignment quality.
//
// Doctrine-safe read-only surface. Reads only. Zero side effects.

import { NextResponse } from "next/server";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50), 1), 500);
  const since = url.searchParams.get("since"); // optional ISO date
  const source_type = url.searchParams.get("source_type"); // optional filter

  try {
    const pool = getKnowledgeFactoryDbPool();

    const conds: string[] = ["source_ref IS NOT NULL"];
    const params: unknown[] = [];
    let p = 0;
    if (since) { params.push(since); conds.push(`emitted_at >= $${++p}`); }
    params.push(limit);
    const limitParamIdx = ++p;

    const r = await pool.query(
      `SELECT source_ref,
              COUNT(*)::int AS times_cited,
              AVG(alignment_score)::float AS mean_alignment,
              MIN(alignment_score)::float AS min_alignment,
              MAX(alignment_score)::float AS max_alignment,
              MIN(emitted_at) AS first_cited,
              MAX(emitted_at) AS last_cited,
              MAX(provider_model) AS provider_model
         FROM nex.gate_kept_event
         WHERE ${conds.join(" AND ")}
         GROUP BY source_ref
         ORDER BY times_cited DESC, mean_alignment DESC
         LIMIT $${limitParamIdx}`,
      params,
    );

    let rows = r.rows.map((row) => ({
      ref_id: String(row.source_ref),
      source_type: classifyRefId(String(row.source_ref)),
      provider_model: row.provider_model ?? null,
      times_cited: Number(row.times_cited),
      mean_alignment: row.mean_alignment != null ? Number(Number(row.mean_alignment).toFixed(3)) : null,
      min_alignment: row.min_alignment != null ? Number(Number(row.min_alignment).toFixed(3)) : null,
      max_alignment: row.max_alignment != null ? Number(Number(row.max_alignment).toFixed(3)) : null,
      first_cited: row.first_cited ? new Date(row.first_cited).toISOString() : null,
      last_cited: row.last_cited ? new Date(row.last_cited).toISOString() : null,
    }));

    if (source_type) {
      rows = rows.filter((r) => r.source_type === source_type);
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      total_sources: rows.length,
      note: "Sources NEX has successfully cited (survived Fabrication Gate v2 alignment). "
        + "Every reference is verifiable by GET /api/nex/evidence/[ref_id].",
      sources: rows,
      doctrine_ref: "Doctrine #1 · Fabrication Gate v2",
    });
  } catch (e) {
    return NextResponse.json({
      error: "evidence_list_error",
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
