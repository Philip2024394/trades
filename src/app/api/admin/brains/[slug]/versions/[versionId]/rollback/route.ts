// POST /api/admin/brains/[slug]/versions/[versionId]/rollback
//
// Roll the brain's current_version_id back to a prior version. The
// prior version must still exist (rows are immutable and never deleted
// per ADR-0037). The version being rolled to must not be `retired_at`.
//
// This is a POINTER FLIP — no data is destroyed. The immutable rows
// remain. `superseded_by` on the previously-current version is left
// intact for provenance; a fresh publish will overwrite it.
//
// F1 · Real authentication (Philip 2026-07-28 · critical path #1)
// F7 · Runtime cache invalidation after pointer flip (critical path #3)

import { NextResponse, type NextRequest } from "next/server";
import {
  brainSupabase,
  brainSupabaseAvailable,
  getBrainVersionById,
  getCurrentBrainVersion,
} from "@/lib/nex/brains/_supabase";
import { withBrainWrite } from "@/lib/nex/brains/_writer";
import { BRAIN_EVENT_TYPES } from "@/lib/nex/brains/_living_types";
import { brainCache } from "@/lib/nex/brains/_runtime_cache";
import {
  requireAuth,
  requireBrainPermission,
  requireMFA,
  toErrorResponse,
} from "@/lib/nex/brains/_route_guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { reason?: string };

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string; versionId: string }> }) {
  if (!brainSupabaseAvailable()) return json503();

  const { slug, versionId } = await params;

  // D1 Turn 3 · centralised guards
  let actor: { actor_id: string; actor_role: "author" | "reviewer" | "admin" | "system" | "runtime" };
  try {
    const user = await requireAuth();
    requireBrainPermission(user, slug, "rollback");
    await requireMFA(user, "rollback", versionId);
    actor = { actor_id: user.email, actor_role: user.nex_user.role };
  } catch (err) {
    return toErrorResponse(err);
  }

  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* body optional */ }

  const target = await getBrainVersionById(versionId);
  if (!target || target.brain_slug !== slug) {
    return NextResponse.json({ ok: false, error: "target_version_not_found" }, { status: 404 });
  }
  if (target.retired_at) {
    return NextResponse.json({ ok: false, error: "target_is_retired" }, { status: 409 });
  }

  const previous = await getCurrentBrainVersion(slug);
  if (previous?.id === versionId) {
    return NextResponse.json({ ok: false, error: "already_current" }, { status: 409 });
  }

  const sb = brainSupabase()!;

  await withBrainWrite<string>(
    { ...actor, brain_slug: slug, entity_type: "brain", entity_id: slug },
    async () => {
      const { error } = await sb
        .from("hammerex_nex_brains")
        .update({ current_version_id: versionId })
        .eq("slug", slug);
      if (error) throw new Error(error.message);
      return {
        return_value: versionId,
        event: {
          event_type: BRAIN_EVENT_TYPES.ROLLED_BACK,
          before_json: previous ? { from_version_id: previous.id, from_semver: previous.version_semver } : null,
          after_json:  { to_version_id: versionId, to_semver: target.version_semver },
          metadata:    { reason: body.reason ?? null },
        },
      };
    }
  );

  // F7 · Runtime cache invalidation — rollback must take effect immediately.
  brainCache.invalidate(slug);

  return NextResponse.json({
    ok: true,
    rolled_back_from: previous ? { id: previous.id, version_semver: previous.version_semver } : null,
    rolled_back_to:   { id: target.id, version_semver: target.version_semver },
    cache_invalidated: true,
  });
}

function json503() {
  return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 503 });
}
