// GET  /api/nex/predictive/models?target=  · list registered models
// POST /api/nex/predictive/models · register a new model (status='shadow' default)
import { NextResponse } from "next/server";
import { listModels, registerModel, type RegisterModelInput } from "@/lib/nex/predictive/registry";
import type { PredictionTarget } from "@/lib/nex/predictive/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("target") as PredictionTarget | null;
  const models = await listModels(target ?? undefined);
  return NextResponse.json({ ok: true, models });
}

export async function POST(request: Request) {
  let body: RegisterModelInput;
  try { body = await request.json() as RegisterModelInput; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  if (!body.target || !body.model_version || !body.model_kind || !Array.isArray(body.feature_spec)) {
    return NextResponse.json({ ok: false, error: "target + model_version + model_kind + feature_spec required" }, { status: 400 });
  }
  const model = await registerModel(body);
  if (!model) return NextResponse.json({ ok: false, error: "register_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, model });
}
