// src/app/api/nex/section-intervention/issue/route.ts
//
// Issue a founder-signed intervention (DISABLE · ROLLBACK · REMOVE_FROM_LIVE).
// Uses Stage 7 validation. Records intervention · locks capability against
// auto-rebuild when kind = REMOVE_FROM_LIVE.

import { NextRequest, NextResponse } from "next/server";
import { validateIntervention } from "@/lib/nex/intervention";
import { interventionStore } from "@/lib/nex/intervention/intervention-singleton";
import { randomUUID } from "node:crypto";
import type { InterventionRecord } from "@/lib/nex/intervention";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, code: "sec.intervention_bad_body", reason: "Invalid JSON" }, { status: 400 });
  }

  const input = {
    capabilityId: String(body.capabilityId ?? ""),
    targetRevisionId: String(body.targetRevisionId ?? ""),
    kind: String(body.kind ?? "") as InterventionRecord["kind"],
    rollbackTargetRevisionId: body.rollbackTargetRevisionId ? String(body.rollbackTargetRevisionId) : null,
    reason: String(body.reason ?? ""),
    issuedBy: String(body.issuedBy ?? ""),
  };

  const v = validateIntervention(input);
  if (!v.ok) return NextResponse.json({ ok: false, code: v.code, reason: v.reason }, { status: 400 });

  const record: InterventionRecord = {
    interventionId: `int-${randomUUID()}`,
    capabilityId: input.capabilityId,
    targetRevisionId: input.targetRevisionId,
    kind: input.kind,
    rollbackTargetRevisionId: input.rollbackTargetRevisionId,
    reason: input.reason,
    issuedBy: input.issuedBy,
    issuedAt: new Date().toISOString(),
    autoRebuildLocked: input.kind === "REMOVE_FROM_LIVE",
  };
  interventionStore.record(record);

  return NextResponse.json({ ok: true, intervention: record }, { headers: { "Cache-Control": "no-store" } });
}
