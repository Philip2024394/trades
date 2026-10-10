// src/app/api/nex1/workstation/active-project/route.ts
//
// NEX1 · Workstation · Active Project resolver endpoint (Phase 6 · 2026-09-19)
//
// GET /api/nex1/workstation/active-project?active_project_id=X
//   → 4-state resolution outcome (RESOLVED / AMBIGUOUS / NOT_AVAILABLE / INVALID)
//
// FOUNDER RULES HONOURED
//   · Rule 6 · no silent selection · null id returns NOT_AVAILABLE with Rule 6 reason
//   · Anti-fabrication · resolver never yields process.cwd() as workspace
//   · Read-only · this endpoint never registers or modifies a project

import { NextResponse } from "next/server";
import { resolveActiveProject } from "@/lib/nex-agent/code-engine/capability-nex-project-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const active_project_id = url.searchParams.get("active_project_id");
  const by_slug_prefix = url.searchParams.get("by_slug_prefix") ?? undefined;

  const outcome = resolveActiveProject({
    active_project_id: active_project_id && active_project_id.length > 0 ? active_project_id : null,
    by_slug_prefix: by_slug_prefix && by_slug_prefix.length > 0 ? by_slug_prefix : undefined,
  });

  return NextResponse.json(outcome, { headers: { "Cache-Control": "no-store" } });
}
