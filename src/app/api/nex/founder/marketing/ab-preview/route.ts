// POST /api/nex/founder/marketing/ab-preview
//
// Founder-only DRY-RUN preview of variant assignments and (if observations
// provided) a winner projection. Read-only · zero persistence · zero sends.

import { NextResponse } from "next/server";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import {
  assignVariantsBatch, selectWinner,
  type VariantDefinition, type VariantObservation, type MetricKey,
} from "@/lib/nex/marketing/deliverability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const campaign_id = String(body?.campaign_id ?? "");
  const variants = Array.isArray(body?.variants) ? (body.variants as VariantDefinition[]) : [];
  const contact_ids = Array.isArray(body?.contact_ids) ? (body.contact_ids as string[]).map(String) : [];
  const observations = Array.isArray(body?.observations) ? (body.observations as VariantObservation[]) : null;
  const metric: MetricKey = (body?.metric as MetricKey) ?? "open_rate";

  if (!campaign_id) return NextResponse.json({ ok: false, error: "campaign_id_required" }, { status: 400 });
  if (variants.length === 0) return NextResponse.json({ ok: false, error: "variants_required" }, { status: 400 });

  const assignments = contact_ids.length > 0
    ? assignVariantsBatch(campaign_id, contact_ids, variants)
    : [];

  const per_variant_count: Record<string, number> = {};
  for (const a of assignments) per_variant_count[a.variant_id] = (per_variant_count[a.variant_id] ?? 0) + 1;

  const winner = observations && observations.length >= 2
    ? selectWinner({ observations, metric, min_sample_size: body?.min_sample_size, alpha: body?.alpha })
    : null;

  return NextResponse.json({
    ok: true,
    note: "DRY-RUN preview · no persistence · no sends",
    assignments,
    per_variant_count,
    winner,
  });
}
