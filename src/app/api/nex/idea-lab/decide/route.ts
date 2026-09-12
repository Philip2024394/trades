// src/app/api/nex/idea-lab/decide/route.ts
//
// Founder decision on an idea · SEND_TO_CODING / SAVE_FOR_LATER / REJECT.
// Score is advice; founder's SEND is authority.

import { NextRequest, NextResponse } from "next/server";
import { ideaLabStore } from "@/lib/nex/idea-lab/idea-lab-store";
import { workstationStore } from "@/lib/nex/workstation/workstation-store";
import type { IdeaDecision } from "@/lib/nex/idea-lab";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "sec.idea_decision_bad_body", reason: "Invalid JSON" }, { status: 400 });
  }

  const ideaId = String(body.ideaId ?? "");
  const kind = String(body.kind ?? "");
  const signedBy = String(body.signedBy ?? "");
  if (!ideaLabStore.getEvaluation(ideaId)) {
    return NextResponse.json({ ok: false, code: "sec.idea_decision_unknown_idea", reason: `Idea ${ideaId} not found` }, { status: 404 });
  }
  if (!signedBy) {
    return NextResponse.json({ ok: false, code: "sec.idea_decision_missing_signature", reason: "signedBy required" }, { status: 400 });
  }
  const at = new Date().toISOString();
  let decision: IdeaDecision;
  if (kind === "SEND_TO_CODING") {
    const targetCap = String(body.targetCapabilityId ?? "");
    if (!/^CAP-\d+$/.test(targetCap)) {
      return NextResponse.json({ ok: false, code: "sec.idea_decision_bad_cap", reason: "targetCapabilityId required for SEND_TO_CODING · must match CAP-XXX" }, { status: 400 });
    }
    decision = { kind: "SEND_TO_CODING", signedBy, at, targetCapabilityId: targetCap };
  } else if (kind === "SAVE_FOR_LATER") {
    decision = { kind: "SAVE_FOR_LATER", signedBy, at, note: body.note ? String(body.note) : null };
  } else if (kind === "REJECT") {
    const reason = String(body.reason ?? "");
    if (!reason) return NextResponse.json({ ok: false, code: "sec.idea_decision_missing_reason", reason: "reason required for REJECT" }, { status: 400 });
    decision = { kind: "REJECT", signedBy, at, reason };
  } else {
    return NextResponse.json({ ok: false, code: "sec.idea_decision_bad_kind", reason: "kind must be SEND_TO_CODING / SAVE_FOR_LATER / REJECT" }, { status: 400 });
  }

  ideaLabStore.recordDecision(ideaId, decision);

  // Wire Idea Lab → NEX1 build queue via workstation event stream. Founder's
  // SEND_TO_CODING decision emits a build-queue event NEX1 picks up when
  // its current task completes (never hijacks · never autonomously prioritises).
  if (decision.kind === "SEND_TO_CODING") {
    const eval_ = ideaLabStore.getEvaluation(ideaId);
    workstationStore.appendEvent({
      at: new Date().toISOString(),
      kind: "build_started",
      agentId: "founder",
      detail: `Idea ${ideaId} SEND_TO_CODING → ${decision.targetCapabilityId} · "${eval_?.title ?? "unknown"}"`,
    });
  }

  return NextResponse.json({ ok: true, ideaId, decision }, { headers: { "Cache-Control": "no-store" } });
}

