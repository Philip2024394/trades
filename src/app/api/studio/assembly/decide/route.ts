// POST /api/studio/assembly/decide
//   Body: {
//     moduleIds: string[];               // input to resolver (must match preview)
//     accepted: string[];                // proposalIds the merchant accepted
//     dismissed: string[];               // proposalIds the merchant dismissed
//   }
//
// Records the merchant's decisions in studio_assembly_decisions. Idempotent —
// re-deciding the same proposal updates the row instead of duplicating.
//
// This endpoint DOES NOT fire the actions yet. That's a downstream step
// (S2.K2 — action executor) so the storage layer stays audit-clean and
// the failure surface of action execution doesn't corrupt the decision
// log.
//
// Response:
//   { ok: true, recorded: number, skipped: string[] }

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAssemblyPlan } from "@/lib/studio/assembly";
import type { AssemblyProposal } from "@/lib/studio/assembly";

export const runtime = "nodejs";

type DecideRequest = {
  moduleIds?: unknown;
  accepted?: unknown;
  dismissed?: unknown;
};

function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
}

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: DecideRequest;
  try {
    body = (await req.json()) as DecideRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  const moduleIds = strArray(body.moduleIds);
  const accepted = strArray(body.accepted);
  const dismissed = strArray(body.dismissed);

  if (moduleIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "moduleIds-required" },
      { status: 400 }
    );
  }
  if (accepted.length === 0 && dismissed.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no-decisions" },
      { status: 400 }
    );
  }

  // Re-resolve so the persisted rationale/action snapshots match what
  // the merchant saw. Trusting a client-supplied rationale would let
  // the frontend rewrite the audit trail.
  const plan = resolveAssemblyPlan({ moduleIds });
  const byId: Record<string, AssemblyProposal> = {};
  for (const p of plan.proposals) byId[p.id] = p;

  const skipped: string[] = [];
  const rows: Array<{
    merchant_id: string;
    brand_id: string;
    proposal_id: string;
    module_id: string;
    rule_id: string;
    decision: "accepted" | "dismissed";
    action_json: AssemblyProposal["action"];
    rationale_snapshot: string;
    decided_by: string | null;
  }> = [];

  const buildRow = (
    proposalId: string,
    decision: "accepted" | "dismissed"
  ): void => {
    const proposal = byId[proposalId];
    if (!proposal) {
      skipped.push(proposalId);
      return;
    }
    rows.push({
      merchant_id: session.merchant.id,
      brand_id: session.brand.id,
      proposal_id: proposalId,
      module_id: proposal.moduleId,
      rule_id: proposal.ruleId,
      decision,
      action_json: proposal.action,
      rationale_snapshot: proposal.rationale,
      decided_by: session.merchant.id
    });
  };

  for (const id of accepted) buildRow(id, "accepted");
  for (const id of dismissed) buildRow(id, "dismissed");

  if (rows.length === 0) {
    return NextResponse.json(
      { ok: false, error: "no-valid-proposals", skipped },
      { status: 400 }
    );
  }

  const ins = await supabaseAdmin
    .from("studio_assembly_decisions")
    .upsert(rows, { onConflict: "brand_id,proposal_id" })
    .select("id");

  if (ins.error) {
    return NextResponse.json(
      { ok: false, error: ins.error.message, skipped },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    recorded: ins.data?.length ?? 0,
    skipped
  });
}
