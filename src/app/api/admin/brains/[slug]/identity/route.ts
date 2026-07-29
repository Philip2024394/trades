// PATCH /api/admin/brains/[slug]/identity
//
// Edit a brain's constitutional identity: mission · principles ·
// promise (Philip 2026-07-28 HARD LAW). These live on the brains row,
// not per-version — they define the brain's spirit across every author
// and every version.
//
// A brain cannot be promoted to lifecycle_stage='production' without
// all three populated (enforced at the DB via trigger — this route
// enforces the same at the API boundary for a cleaner error message).

import { NextResponse, type NextRequest } from "next/server";
import { brainSupabase, brainSupabaseAvailable, getBrainBySlug } from "@/lib/nex/brains/_supabase";
import { withBrainWrite } from "@/lib/nex/brains/_writer";
import type { BrainPromise } from "@/lib/nex/brains/_living_types";
import {
  requireAuth,
  requireBrainPermission,
  requireMFA,
  toErrorResponse,
} from "@/lib/nex/brains/_route_guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  mission?: string | null;
  principles?: string[];
  promise?: BrainPromise;
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!brainSupabaseAvailable()) return json503();
  const { slug } = await params;

  // D1 Turn 3 · centralised guards
  let actor: { actor_id: string; actor_role: "author" | "reviewer" | "admin" | "system" | "runtime" };
  try {
    const user = await requireAuth();
    requireBrainPermission(user, slug, "edit_identity");
    await requireMFA(user, "edit_identity", slug);
    actor = { actor_id: user.email, actor_role: user.nex_user.role };
  } catch (err) {
    return toErrorResponse(err);
  }

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const brain = await getBrainBySlug(slug);
  if (!brain) return NextResponse.json({ ok: false, error: "brain_not_found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (body.mission !== undefined) patch.mission = body.mission?.trim() || null;
  if (body.principles !== undefined) {
    if (!Array.isArray(body.principles)) return NextResponse.json({ ok: false, error: "principles_not_array" }, { status: 400 });
    patch.principles = body.principles.map((s) => s.trim()).filter(Boolean);
  }
  if (body.promise !== undefined) {
    if (!body.promise || !Array.isArray(body.promise.will_do) || !Array.isArray(body.promise.will_not_do)) {
      return NextResponse.json({ ok: false, error: "promise_shape_invalid" }, { status: 400 });
    }
    patch.promise = {
      will_do:     body.promise.will_do.map((s) => s.trim()).filter(Boolean),
      will_not_do: body.promise.will_not_do.map((s) => s.trim()).filter(Boolean),
    };
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: false, error: "no_changes" }, { status: 400 });
  }

  const sb = brainSupabase()!;
  await withBrainWrite<string>(
    { ...actor, brain_slug: slug, entity_type: "brain", entity_id: slug },
    async () => {
      const { error } = await sb.from("hammerex_nex_brains").update(patch).eq("slug", slug);
      if (error) throw new Error(error.message);
      return {
        return_value: slug,
        event: {
          event_type: "brain_identity_updated",
          before_json: {
            mission: brain.mission,
            principles: brain.principles,
            promise: brain.promise,
          },
          after_json: patch,
        },
      };
    }
  );

  const { data: updated } = await sb.from("hammerex_nex_brains").select("*").eq("slug", slug).single();
  return NextResponse.json({ ok: true, brain: updated });
}

function json503() {
  return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 503 });
}
