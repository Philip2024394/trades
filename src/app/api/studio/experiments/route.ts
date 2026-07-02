// Studio experiments API.
//
//   GET  /api/studio/experiments?pageId=…  (auth-gated)
//     → { ok, experiments: ExperimentSummary[] }  — merchant-side list
//
//   POST /api/studio/experiments  (auth-gated)
//     { pageId, instanceId, name?, variantAConfig, variantBConfig, splitA? }
//     → { ok, experiment }
//
// The public bucketing endpoint lives at
// /api/studio/experiments/public?brandId=…&pageId=… so the preview
// iframe (no session cookie) can fetch running experiments to bucket
// the current visitor.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Row = {
  id: string;
  page_id: string;
  instance_id: string;
  name: string;
  status: string;
  winner: string | null;
  split_a: number;
  variant_a_config: Record<string, unknown>;
  variant_b_config: Record<string, unknown>;
  created_at: string;
  ended_at: string | null;
};

export async function GET(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  const url = new URL(req.url);
  const pageId = url.searchParams.get("pageId") ?? "home";
  const res = await supabaseAdmin
    .from("studio_experiments")
    .select(
      "id, page_id, instance_id, name, status, winner, split_a, variant_a_config, variant_b_config, created_at, ended_at"
    )
    .eq("brand_id", session.brand.id)
    .eq("page_id", pageId)
    .order("created_at", { ascending: false });
  if (res.error) {
    return NextResponse.json({ ok: false, error: res.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, experiments: (res.data ?? []) as Row[] });
}

type CreateBody = {
  pageId?: string;
  instanceId?: string;
  name?: string;
  variantAConfig?: Record<string, unknown>;
  variantBConfig?: Record<string, unknown>;
  splitA?: number;
};

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "unauthenticated" }, { status: 401 });
  }
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  if (
    typeof body.pageId !== "string" ||
    typeof body.instanceId !== "string" ||
    !body.pageId ||
    !body.instanceId
  ) {
    return NextResponse.json(
      { ok: false, error: "invalid-target" },
      { status: 400 }
    );
  }
  const splitA =
    typeof body.splitA === "number" && body.splitA >= 0 && body.splitA <= 100
      ? Math.round(body.splitA)
      : 50;

  const insert = await supabaseAdmin
    .from("studio_experiments")
    .insert({
      brand_id: session.brand.id,
      page_id: body.pageId,
      instance_id: body.instanceId,
      name: body.name ?? "Untitled A/B test",
      variant_a_config: body.variantAConfig ?? {},
      variant_b_config: body.variantBConfig ?? {},
      split_a: splitA,
      status: "running"
    })
    .select()
    .maybeSingle();

  if (insert.error) {
    // Unique-index conflict when a running experiment already exists on
    // the same instance — return a clean 409 so the UI can prompt.
    if (insert.error.code === "23505") {
      return NextResponse.json(
        { ok: false, error: "experiment-already-running" },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: false, error: insert.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, experiment: insert.data });
}
