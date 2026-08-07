// GET  /api/nex/experiments             list all versions
// POST /api/nex/experiments             create a draft experiment + variants
import { NextResponse } from "next/server";
import { createExperiment, listExperiments } from "@/lib/nex/experiments/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, experiments: await listExperiments() });
}

export async function POST(request: Request) {
  let body: Parameters<typeof createExperiment>[0];
  try { body = await request.json() as Parameters<typeof createExperiment>[0]; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }
  const r = await createExperiment(body);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
