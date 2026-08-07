// POST /api/nex/predictive/models/activate · flip a model to active
// Body: { model_id: string, deployed_by?: string }
// Any previously-active model for the same target is retired atomically.
import { NextResponse } from "next/server";
import { activateModel } from "@/lib/nex/predictive/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { model_id?: string; deployed_by?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.model_id) return NextResponse.json({ ok: false, error: "model_id required" }, { status: 400 });
  const model = await activateModel(body.model_id, body.deployed_by);
  if (!model) return NextResponse.json({ ok: false, error: "not_found_or_inactive" }, { status: 404 });
  return NextResponse.json({ ok: true, model });
}
