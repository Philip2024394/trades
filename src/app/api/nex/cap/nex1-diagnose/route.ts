// src/app/api/nex/cap/nex1-diagnose/route.ts
//
// Founder-locked 2026-09-13.
//
// Trigger NEX1 diagnosis for a single CAP by cap_id. Produces an
// UNSIGNED proposal (or ESCALATES for security-critical kinds).
//
// This endpoint DOES NOT:
//   - execute any code changes
//   - grant founder authority
//   - bypass the Authority Broker
//   - satisfy the founder Ed25519 signature requirement
//   - modify the workstation adapter fail-closed default
//
// It is the "🤖 Send to NEX1" button target. Whatever it produces
// still requires founder Ed25519 signature before the Authority Broker
// will allow execution, AND requires WO-CAP-EXECUTION-03 (CAP→spec
// bridge) before the workstation adapter can actually resolve the CAP.
//
// Doctrine (2026-09-13 · locked):
//   - "NEX can govern weaknesses" (today)
//   - "NEX can actually resolve a bounded weakness" (post-WO-CAP-EXECUTION-03)
//   - This endpoint is a govern surface, NOT a resolve surface.

import { NextResponse } from "next/server";
import { loadCap } from "@/lib/nex-cap/registry";
import { nex1EngineerProposeFor } from "@/lib/nex-cap/nex1-engineer";
import { classifyForFounder, isTestNamespaceCap } from "@/lib/nex-cap/founder-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface DiagnoseBody {
  readonly cap_id?: string;
}

export async function POST(req: Request): Promise<Response> {
  let body: DiagnoseBody;
  try {
    body = (await req.json()) as DiagnoseBody;
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  if (!body.cap_id || typeof body.cap_id !== "string") {
    return NextResponse.json({ error: "missing_cap_id" }, { status: 400 });
  }

  const cap = await loadCap(body.cap_id);
  if (!cap) {
    return NextResponse.json({ error: "cap_not_found", cap_id: body.cap_id }, { status: 404 });
  }

  // Founder-facing safety: refuse to diagnose adversarial test artefacts
  // via the button surface. They must go through the test harness.
  if (isTestNamespaceCap(cap)) {
    return NextResponse.json({
      error: "cap_is_test_event",
      cap_id: cap.cap_id, cap_kind: cap.kind,
      reason: "This CAP is an adversarial/test event and cannot be triggered via the founder UI. It is preserved in the registry for audit only.",
    }, { status: 403 });
  }

  // Governance-preserving call. Returns { outcome: AUTO_FIX | PROPOSE | ESCALATE,
  // proposal: null|CapEngineeringProposal, reason }.
  // ESCALATE outcomes never draft a proposal — CAP goes to ESCALATED status.
  // PROPOSE / AUTO_FIX outcomes draft an UNSIGNED proposal (founder_signature_slot=null).
  const result = await nex1EngineerProposeFor(cap);

  // Never grant execution authority in this response. The proposal is
  // returned with founder_signature_slot: null so the caller sees it
  // still requires signing.
  return NextResponse.json({
    ok: true,
    cap_id: cap.cap_id,
    cap_kind: cap.kind,
    cap_priority: cap.priority,
    outcome: result.outcome,
    reason: result.reason,
    proposal: result.proposal
      ? {
          proposal_id: result.proposal.proposal_id,
          cap_id: result.proposal.cap_id,
          diagnosis: result.proposal.diagnosis,
          proposed_fix_summary: result.proposal.proposed_fix_summary,
          required_authority_scope: result.proposal.required_authority_scope,
          authorised_workstation_scope: result.proposal.authorised_workstation_scope,
          evidence_chain: result.proposal.evidence_chain,
          resolver_outcome: result.proposal.resolver_outcome,
          founder_signature_slot: result.proposal.founder_signature_slot,   // always null · P-U doctrine
          created_at: result.proposal.created_at,
        }
      : null,
    post_diagnosis_status: classifyForFounder({ ...cap, status: result.outcome === "ESCALATE" ? "ESCALATED" : "PROPOSED" }),
    execution_authority_granted: false,
    workstation_execution_ready: false,
    doctrine_note: "This diagnosis produces an unsigned proposal only. NEX1 cannot directly mutate protected code. All engineering mutation must pass authorization (founder Ed25519 signature), scope enforcement (authorised_workstation_scope), governed workstation execution (WO-01…WO-09) and 10-point verification. Autonomous workstation resolution additionally requires WO-CAP-EXECUTION-03 (CAP→spec bridge).",
  }, { status: 200 });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ error: "method_not_allowed", note: "POST cap_id to trigger NEX1 diagnosis" }, { status: 405 });
}
