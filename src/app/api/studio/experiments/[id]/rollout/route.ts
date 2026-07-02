// POST /api/studio/experiments/:id/rollout  { winner: 'A' | 'B' }
//
// Promotes the chosen variant's config into the merchant's live draft
// layout — spread over the section instance's config JSON — then marks
// the experiment `rolled_out`.
//
// After rollout, subsequent renders no longer bucket visitors: everyone
// sees the winner. Undo is a Module 19 concern; for now `rolled_out`
// is terminal (data is preserved so a later Module 19 restore can
// undo without loss).

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = { winner?: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const { id } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const winner = body.winner === "A" || body.winner === "B" ? body.winner : null;
  if (!winner) {
    return NextResponse.json({ ok: false, error: "invalid-winner" }, { status: 400 });
  }

  // Fetch the experiment + verify ownership.
  const expRes = await supabaseAdmin
    .from("studio_experiments")
    .select("id, brand_id, page_id, instance_id, variant_a_config, variant_b_config, status")
    .eq("id", id)
    .eq("brand_id", session.brand.id)
    .maybeSingle();
  if (expRes.error || !expRes.data) {
    return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
  }
  const exp = expRes.data as {
    id: string;
    page_id: string;
    instance_id: string;
    variant_a_config: Record<string, unknown>;
    variant_b_config: Record<string, unknown>;
    status: string;
  };
  if (exp.status !== "running") {
    return NextResponse.json(
      { ok: false, error: `experiment ${exp.status}, cannot rollout` },
      { status: 400 }
    );
  }
  const overlay =
    winner === "A" ? exp.variant_a_config : exp.variant_b_config;

  // Load the current draft layout, patch it, save it back.
  const layoutRes = await supabaseAdmin
    .from("studio_layouts")
    .select("id, layout_json")
    .eq("brand_id", session.brand.id)
    .eq("page_id", exp.page_id)
    .maybeSingle();
  if (layoutRes.error || !layoutRes.data) {
    return NextResponse.json(
      { ok: false, error: "layout-not-found" },
      { status: 404 }
    );
  }
  const layout = layoutRes.data.layout_json as {
    sections: { instanceId: string; config: Record<string, unknown> }[];
  };
  const patched = {
    ...layout,
    sections: layout.sections.map((s) =>
      s.instanceId === exp.instance_id
        ? { ...s, config: { ...s.config, ...(overlay ?? {}) } }
        : s
    )
  };
  const upd = await supabaseAdmin
    .from("studio_layouts")
    .update({ layout_json: patched })
    .eq("id", layoutRes.data.id);
  if (upd.error) {
    return NextResponse.json({ ok: false, error: upd.error.message }, { status: 500 });
  }

  const endUpd = await supabaseAdmin
    .from("studio_experiments")
    .update({
      status: "rolled_out",
      winner,
      ended_at: new Date().toISOString()
    })
    .eq("id", id);
  if (endUpd.error) {
    return NextResponse.json({ ok: false, error: endUpd.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, layout: patched });
}
