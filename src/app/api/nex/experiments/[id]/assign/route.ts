// POST /api/nex/experiments/{id}/assign · get or create sticky assignment
// Body: { contact_id: string }
// Used by tests and manual assignment · same code path the journey node uses.
import { NextResponse } from "next/server";
import { getOrAssign } from "@/lib/nex/experiments/assignment";
import { getExperiment } from "@/lib/nex/experiments/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: { contact_id?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.contact_id) return NextResponse.json({ ok: false, error: "contact_id required" }, { status: 400 });
  const bundle = await getExperiment(id);
  if (!bundle) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const r = await getOrAssign(bundle.experiment, bundle.variants, body.contact_id);
  return NextResponse.json({ ok: true, experiment_id: id, ...r });
}
