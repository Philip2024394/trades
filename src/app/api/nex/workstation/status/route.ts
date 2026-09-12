// src/app/api/nex/workstation/status/route.ts
//
// Workstation status endpoint · reads the in-memory store + graceful
// degradation. Reports IDLE when no active task rather than fabricating one.

import { NextResponse } from "next/server";
import { workstationStore } from "@/lib/nex/workstation/workstation-store";
import { composePreviewUrl, PREVIEW_ELIGIBLE_STATES } from "@/lib/nex/preview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const task = workstationStore.currentTask();
  const allRevisions = workstationStore.listAllRevisions();

  const previewableRevisions = allRevisions
    .filter((r) => PREVIEW_ELIGIBLE_STATES.includes(r.lifecycle_state))
    .map((r) => ({
      revision_id: r.revision_id,
      capability_id: r.capability_id,
      version: r.version,
      lifecycle_state: r.lifecycle_state,
      preview_url: composePreviewUrl(r.capability_id, r.version),
    }));

  return NextResponse.json({
    ok: true,
    task: task ?? null,
    idle: task === null,
    revisions_count: allRevisions.length,
    previewable_revisions: previewableRevisions,
    generated_at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
