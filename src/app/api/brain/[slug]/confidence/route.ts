// GET /api/brain/[slug]/confidence?subject=<subject>&region=<region>
//
// Returns the computed confidence tier for a (brain_slug, subject,
// region) triple per Gap 4 math. Inputs come from the learning signals
// table + the Brain's Author-set base confidence.

import type { NextRequest } from "next/server";
import { brainRegistry, computeConfidence } from "@/lib/nex/brains";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { jsonError, jsonOk, requireBrainRuntime } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const off = requireBrainRuntime();
  if (off) return off;

  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const subject = url.searchParams.get("subject") ?? "";
  const region = url.searchParams.get("region") ?? undefined;

  if (subject.trim() === "") return jsonError("bad_request", "subject query param is required");

  const brain = brainRegistry.get(slug);
  if (!brain) return jsonError("brain_not_registered", `Brain '${slug}' is not registered`, 404);

  const kTarget = kTargetFor(subject);

  // Learning signals may not exist yet (pending migration). Treat
  // missing table as "no field signals" — confidence collapses to
  // Author-set base modulated by freshness only.
  let sample_size = 0;
  let p95_delta_pct: number | undefined;
  try {
    const { data } = await supabaseAdmin
      .from("hammerex_nex_brain_learning_signals")
      .select("sample_size, p95_delta_pct")
      .eq("brain_slug", slug)
      .eq("prediction_subject", subject)
      .eq("region_code", region ?? null)
      .order("computed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      sample_size = data.sample_size ?? 0;
      p95_delta_pct = data.p95_delta_pct ?? undefined;
    }
  } catch {
    // Swallow — pending-migration state expected.
  }

  const months = monthsSince(brain.manifest.last_reviewed_at);

  const result = computeConfidence({
    author_base: "medium",              // TODO: pull from module-level fact when we resolve per-subject
    sample_size,
    k_target: kTarget,
    p95_delta_pct,
    months_since_last_review: months
  });

  return jsonOk({
    brain_slug: slug,
    subject,
    region: region ?? null,
    tier:   result.tier,
    raw:    result.raw,
    reason: result.reason,
    breakdown: result.breakdown,
    computed_at: new Date().toISOString()
  });
}

function kTargetFor(subject: string): number {
  const lower = subject.toLowerCase();
  if (lower.includes("margin")) return 20;
  if (lower.includes("pric") || lower.includes("cost") || lower.includes("labour")) return 10;
  return 5;
}

function monthsSince(iso: string | null | undefined): number {
  if (!iso) return 12;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 12;
  const now = Date.now();
  const days = (now - then) / (1000 * 60 * 60 * 24);
  return Math.max(0, days / 30);
}
