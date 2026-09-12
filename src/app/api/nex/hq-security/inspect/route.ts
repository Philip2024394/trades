// src/app/api/nex/hq-security/inspect/route.ts
//
// HQ Security Agent · inspection endpoint · Stage 1 · Phase D.3 core.
// Route: POST /api/nex/hq-security/inspect
//
// Body: SecurityInspectionRequest (see src/lib/nex/security-agent/types.ts)
// Returns: SecurityDecision · 200 OK regardless of accept/reject.
//
// Cache: no-store. Every inspection is a fresh registry read.

import { NextResponse } from "next/server";
import {
  SecurityAgent,
  type SecurityInspectionRequest,
} from "@/lib/nex/security-agent";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: "invalid-json",
        message: "Request body must be JSON matching SecurityInspectionRequest.",
      },
      { status: 400 },
    );
  }

  if (!isPlausibleRequest(body)) {
    return NextResponse.json(
      {
        error: "invalid-request-shape",
        message:
          "Request must include agentId, changeReason (referencing CAP-XXX), targetCapabilities[], proposedFiles[] and proposedAction.",
      },
      { status: 400 },
    );
  }

  const agent = new SecurityAgent();
  const decision = await agent.inspect(body as SecurityInspectionRequest);
  return NextResponse.json(decision, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, must-revalidate",
      "X-NEX-Security-Verdict": decision.accepted ? "ACCEPT" : "REJECT",
      "X-NEX-Security-RunId": decision.runId,
      "X-NEX-Security-AgentId": decision.agentId,
    },
  });
}

function isPlausibleRequest(body: unknown): body is SecurityInspectionRequest {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.agentId === "string" &&
    typeof b.changeReason === "string" &&
    Array.isArray(b.targetCapabilities) &&
    Array.isArray(b.proposedFiles) &&
    typeof b.proposedAction === "object" &&
    b.proposedAction !== null
  );
}
