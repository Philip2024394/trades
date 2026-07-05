// POST /api/studio/assembly/preview
//   Body: { moduleIds: string[]; includeInstalled?: boolean }
//
// Resolves an Assembly Plan for the requested modules. When
// `includeInstalled` is true the resolver also folds in every module
// already installed for the merchant's brand — so conflict detection
// against the merchant's actual site is real, not hypothetical.
//
// Previously-recorded decisions are attached: proposals the merchant
// already accepted or dismissed carry a `priorDecision` field so the UI
// can grey them out or auto-tick them.
//
// Response:
//   { ok: true, plan: ResolvedAssemblyPlan, priorDecisions: Record<proposalId, 'accepted'|'dismissed'> }

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAssemblyPlan } from "@/lib/studio/assembly";

export const runtime = "nodejs";

type PreviewRequest = {
  moduleIds?: unknown;
  includeInstalled?: unknown;
};

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: PreviewRequest;
  try {
    body = (await req.json()) as PreviewRequest;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  const moduleIds = Array.isArray(body.moduleIds)
    ? body.moduleIds.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];

  if (moduleIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: "moduleIds-required" },
      { status: 400 }
    );
  }

  const includeInstalled = body.includeInstalled === true;

  let installedModuleIds: string[] = [];
  if (includeInstalled) {
    // installed_apps is keyed by merchant_id (one install per merchant,
    // brands share). Filter uninstalled rows so re-install proposals
    // don't collide against a stale ledger.
    const installed = await supabaseAdmin
      .from("installed_apps")
      .select("app_slug")
      .eq("merchant_id", session.merchant.id)
      .is("uninstalled_at", null);
    installedModuleIds = (installed.data ?? [])
      .map((r) => r.app_slug as string)
      .filter((s) => typeof s === "string" && !moduleIds.includes(s));
  }

  const plan = resolveAssemblyPlan({
    moduleIds: [...moduleIds, ...installedModuleIds]
  });

  const decisions = await supabaseAdmin
    .from("studio_assembly_decisions")
    .select("proposal_id, decision")
    .eq("brand_id", session.brand.id)
    .in(
      "proposal_id",
      plan.proposals.map((p) => p.id)
    );

  const priorDecisions: Record<string, "accepted" | "dismissed"> = {};
  for (const row of decisions.data ?? []) {
    priorDecisions[row.proposal_id as string] = row.decision as
      | "accepted"
      | "dismissed";
  }

  return NextResponse.json({ ok: true, plan, priorDecisions });
}
