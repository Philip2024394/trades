// GET /api/admin/brains/list
//
// Dashboard index bundle. Returns one row per brain with the at-a-glance
// health signals Philip specified. Computed live from Supabase; readiness
// is either read from the stored score_json or recomputed on demand.

import { NextResponse, type NextRequest } from "next/server";
import { brainSupabase, brainSupabaseAvailable, listBrains } from "@/lib/nex/brains/_supabase";
import { computeReadiness } from "@/lib/nex/brains/_readiness";
import type { BrainRow } from "@/lib/nex/brains/_living_types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!brainSupabaseAvailable()) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 503 });
  }
  const url = new URL(req.url);
  const includeRetired = url.searchParams.get("include_retired") === "1";
  const recomputeReadiness = url.searchParams.get("recompute") === "1";

  const rows = await listBrains();
  const sb = brainSupabase()!;

  const bundles = await Promise.all(rows.map(async (b) => bundle(b, sb, recomputeReadiness)));
  const filtered = includeRetired ? bundles : bundles.filter((b) => b.brain.status !== "retired");

  return NextResponse.json({
    ok: true,
    total: filtered.length,
    brains: filtered.sort((a, b) => (b.readiness_overall ?? 0) - (a.readiness_overall ?? 0)),
    computed_at: new Date().toISOString(),
  });
}

async function bundle(
  brain: BrainRow,
  sb: ReturnType<typeof brainSupabase>,
  recompute: boolean
) {
  let readiness = brain.readiness_score_json;
  let readinessAxes: unknown = null;

  if (recompute || !readiness) {
    const r = await computeReadiness(brain.slug);
    readiness = r.score;
    readinessAxes = r.axes;
  }

  if (!sb) {
    return {
      brain,
      readiness_overall: readiness?.overall ?? 0,
      readiness_score: readiness,
      readiness_axes: readinessAxes,
      current_version_semver: null,
      certified_author: null,
      answers_answered_total: 0,
      unknown_questions: 0,
      dependencies_healthy_pct: 100,
    };
  }

  // Current version semver
  const { data: v } = brain.current_version_id
    ? await sb.from("hammerex_nex_brain_versions").select("version_semver").eq("id", brain.current_version_id).maybeSingle()
    : { data: null };

  // Certified author
  const { data: cert } = await sb
    .from("hammerex_nex_brain_certifications")
    .select("author_name, credentials_text, certified_at, expires_at")
    .eq("brain_slug", brain.slug)
    .eq("is_primary", true)
    .eq("status", "active")
    .maybeSingle();

  // Answer counts (lifetime)
  const [{ count: totalAns }, { count: unknownAns }] = await Promise.all([
    sb.from("hammerex_nex_brain_answers").select("id", { count: "exact", head: true }).eq("brain_slug", brain.slug),
    sb.from("hammerex_nex_brain_answers").select("id", { count: "exact", head: true }).eq("brain_slug", brain.slug).in("answer_kind", ["unknown", "low_confidence"]),
  ]);

  // Dependency health
  const { data: deps } = await sb
    .from("hammerex_nex_brain_dependencies")
    .select("child_brain_slug")
    .eq("parent_brain_slug", brain.slug)
    .is("removed_at", null);
  let depHealthyPct = 100;
  if (deps && deps.length > 0) {
    const childSlugs = deps.map((d: { child_brain_slug: string }) => d.child_brain_slug);
    const { data: children } = await sb
      .from("hammerex_nex_brains")
      .select("current_version_id")
      .in("slug", childSlugs);
    const healthy = (children ?? []).filter((c: { current_version_id: string | null }) => c.current_version_id).length;
    depHealthyPct = Math.round((healthy / deps.length) * 100);
  }

  return {
    brain,
    readiness_overall: readiness?.overall ?? 0,
    readiness_score: readiness,
    readiness_axes: readinessAxes,
    current_version_semver: (v as { version_semver: string } | null)?.version_semver ?? null,
    certified_author: cert
      ? {
          author_name: (cert as { author_name: string }).author_name,
          credentials_text: (cert as { credentials_text: string }).credentials_text,
          certified_at: (cert as { certified_at: string }).certified_at,
          expires_at: (cert as { expires_at: string | null }).expires_at,
        }
      : null,
    answers_answered_total: totalAns ?? 0,
    unknown_questions: unknownAns ?? 0,
    dependencies_healthy_pct: depHealthyPct,
  };
}
