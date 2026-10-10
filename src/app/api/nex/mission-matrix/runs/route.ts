// GET /api/nex/mission-matrix/runs
//
// Founder-locked 2026-09-14. Passive inspection endpoint. Returns the
// persisted mission-matrix records. No decisions. No verdicts derived
// here. Just the historical evidence, honestly.

import { NextResponse } from "next/server";
import { loadAllMissionRuns } from "@/lib/nex-agent-runtime/mission-matrix/record";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(): Promise<Response> {
  const runs = await loadAllMissionRuns(500);
  // Compute domain-tally + verdict-tally · these are pure aggregates ·
  // NOT re-derivations of any verdict.
  const domainTally: Record<string, number> = {};
  const verdictTally: Record<string, number> = {};
  for (const r of runs) {
    domainTally[r.capability_domain] = (domainTally[r.capability_domain] ?? 0) + 1;
    verdictTally[r.final_verdict] = (verdictTally[r.final_verdict] ?? 0) + 1;
  }
  return NextResponse.json({
    ok: true,
    generated_at: new Date().toISOString(),
    total: runs.length,
    domain_tally: domainTally,
    verdict_tally: verdictTally,
    doctrine_note:
      "This is an evidence log. Reliability is EARNED by accumulated evidence, never declared. Each record was signed by the recorder identity; the recorder is PASSIVE and NEVER decides mission outcomes.",
    runs: runs.map((r) => ({
      mission_matrix_number: r.mission_matrix_number,
      mission_id: r.mission_id,
      capability_domain: r.capability_domain,
      title: r.title,
      final_verdict: r.final_verdict,
      verdict_reason: r.verdict_reason,
      files_changed: r.files_changed.length,
      lines_changed: r.lines_changed,
      recovery_events: r.recovery_events.length,
      refusals: r.refusals.length,
      independent_verification: r.independent_verification,
      finished_at: r.finished_at,
    })),
  });
}
