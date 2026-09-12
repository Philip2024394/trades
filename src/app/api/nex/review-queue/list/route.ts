// src/app/api/nex/review-queue/list/route.ts
//
// Returns the founder review queue rows from the in-memory workstation store
// filtered to revisions in review-eligible states.

import { NextResponse } from "next/server";
import { workstationStore } from "@/lib/nex/workstation/workstation-store";
import { composePreviewUrl } from "@/lib/nex/preview";
import type { ReviewQueueRow } from "@/lib/nex/review-queue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REVIEW_STATES = new Set(["AWAITING_PREVIEW", "IN_REVIEW", "REQUEST_UPDATE", "APPROVED"]);

export async function GET() {
  const all = workstationStore.listAllRevisions();
  const inReview = all.filter((r) => REVIEW_STATES.has(r.lifecycle_state));

  const rows: ReviewQueueRow[] = inReview.map((r) => {
    const artifact = workstationStore.getArtifact(r.artifact_id);
    return {
      revisionId: r.revision_id,
      capabilityId: r.capability_id,
      capabilityTitle: r.capability_id,   // in-memory · Work Map lookup happens in Stage 6+ full wire
      version: r.version,
      parentVersion: null,
      lifecycleState: r.lifecycle_state,
      submittedAt: r.created_at,
      agentId: r.created_by_agent_id,
      artifactId: r.artifact_id,
      filesCount: artifact?.files_count ?? 0,
      totalBytes: artifact?.total_bytes ?? 0,
      testsPassed: artifact?.tests_passed ?? 0,
      testsTotal: artifact?.tests_total ?? 0,
      guardianVerdict: artifact?.guardian_verdict ?? null,
      uiDnaVerdict: artifact?.ui_dna_verdict ?? null,
      changeRequestId: r.change_request_id,
      previewUrl: composePreviewUrl(r.capability_id, r.version),
    };
  });

  return NextResponse.json({ ok: true, rows, generated_at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
