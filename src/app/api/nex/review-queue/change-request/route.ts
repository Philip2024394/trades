// src/app/api/nex/review-queue/change-request/route.ts
//
// Accept a founder-typed change request. Uses Stage 6 validation. Never
// bypasses signature check. Never writes to production tables.

import { NextRequest, NextResponse } from "next/server";
import { validateChangeRequest } from "@/lib/nex/review-queue";
import { workstationStore } from "@/lib/nex/workstation/workstation-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "sec.change_request_bad_body", reason: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateChangeRequest({
    targetCapabilityId: String(body.targetCapabilityId ?? ""),
    targetRevisionId: String(body.targetRevisionId ?? ""),
    founderMessage: String(body.founderMessage ?? ""),
    attachedManifestIds: Array.isArray(body.attachedManifestIds) ? body.attachedManifestIds.map(String) : [],
    founderSignature: String(body.founderSignature ?? ""),
  });

  if (!validation.ok) {
    return NextResponse.json({ ok: false, code: validation.code, reason: validation.reason }, { status: 400 });
  }

  // Enrich workstation store with the change-request event
  workstationStore.appendEvent({
    at: new Date().toISOString(),
    kind: "review_findings",
    agentId: "founder",
    detail: `Change request on ${body.targetCapabilityId} rev ${body.targetRevisionId}: ${String(body.founderMessage).slice(0, 120)}`,
  });

  return NextResponse.json({
    ok: true,
    change_request_id: `cr-${Date.now()}`,
    note: "Change request accepted · NEX1 will spawn v1.N+1 revision · in-memory store (pg-backed persistence lands with migration apply)",
  }, { headers: { "Cache-Control": "no-store" } });
}
