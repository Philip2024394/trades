// GET /api/nex/evidence-engine/status
// Evidence Engine v0 capabilities · read-only

import { NextResponse } from "next/server";
import { supportedDimensions } from "@/lib/nex-evidence-engine/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    engine: "evidence-engine",
    version: "v0.1.0",
    phase: "P1",
    supported_dimensions: supportedDimensions(),
    supported_evidence_states: ["MEASURED","PASSED","FAILED","NOT_MEASURED","NOT_APPLICABLE","INCONCLUSIVE","BLOCKED","STALE"],
    supported_candidate_ids: ["cand_baseline", "cand_nex1"],
    constitutional_boundaries: {
      external_llm_used: false,
      network_dependency: false,
      mutation_of_measured_project: false,
      produces_decisions: false,
      produces_recommendations: false,
      produces_synthetic_quality_score: false,
    },
    schema_files: [
      "data/nex1-engineering-evolution/evidence-record-schema-v0.1.0.json",
      "data/nex1-engineering-evolution/evidence-bundle-schema-v0.1.0.json",
      "data/nex1-engineering-evolution/nex1-declaration-schema-v0.1.0.json",
    ],
    hold: ["nex2","nex3","lab","standard_feed","24_7","automatic_transformation"],
    attribution: { taught_by: "master_ai_engineer", deterministic: true, external_llm_used: false, role: "evidence_engine", authority: "measurement" },
    at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
