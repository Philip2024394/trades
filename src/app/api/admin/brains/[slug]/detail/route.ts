// GET /api/admin/brains/[slug]/detail
//
// Control-centre bundle. Everything the Command Centre + all Phase 2
// observability sections need in one call so the detail page loads
// once and renders every section without extra network trips.
//
// Phase 2 additions (Philip 2026-07-28):
//   • maturity           · 8-level ladder, live requirements for next level
//   • trust              · explanation-first Trust Dashboard payload
//   • coverage           · per-module Coverage Map + Knowledge Health
//   • improvement_queue  · "What single improvement raises trust most?"

import { NextResponse, type NextRequest } from "next/server";
import {
  brainSupabase,
  brainSupabaseAvailable,
  getBrainBySlug,
  listBrainVersions,
  getCurrentBrainVersion,
  listBrainDependencies,
} from "@/lib/nex/brains/_supabase";
import { computeReadiness } from "@/lib/nex/brains/_readiness";
import { computeMaturity, getMaturityLadderCatalogue } from "@/lib/nex/brains/_maturity";
import { computeTrust } from "@/lib/nex/brains/_trust";
import { computeCoverage } from "@/lib/nex/brains/_coverage";
import { computeImprovementQueue } from "@/lib/nex/brains/_improvement_queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!brainSupabaseAvailable()) {
    return NextResponse.json({ ok: false, error: "supabase_unavailable" }, { status: 503 });
  }
  const { slug } = await params;
  const brain = await getBrainBySlug(slug);
  if (!brain) return NextResponse.json({ ok: false, error: "brain_not_found" }, { status: 404 });

  const sb = brainSupabase()!;

  const [
    versions,
    currentVersion,
    dependencies,
    { data: certifications },
    { data: reviewActions },
    { data: recentFeedback },
    { data: unknownQueue },
    { data: recentEvents },
    { data: totalAnsCount },
    { data: draftCount },
    readiness,
    maturity,
    trust,
    coverage,
    improvementQueue,
  ] = await Promise.all([
    listBrainVersions(slug),
    getCurrentBrainVersion(slug),
    listBrainDependencies(slug),
    sb.from("hammerex_nex_brain_certifications").select("*").eq("brain_slug", slug).order("certified_at", { ascending: false }),
    sb.from("hammerex_nex_brain_review_actions").select("*").eq("brain_slug", slug).order("occurred_at", { ascending: false }).limit(50),
    sb.from("hammerex_nex_brain_answers").select("*").eq("brain_slug", slug).order("answered_at", { ascending: false }).limit(20),
    sb.from("hammerex_nex_brain_answers").select("*").eq("brain_slug", slug).in("answer_kind", ["unknown", "low_confidence"]).order("answered_at", { ascending: false }).limit(50),
    sb.from("hammerex_nex_events").select("*").eq("entity_type", "brain").eq("entity_id", slug).order("occurred_at", { ascending: false }).limit(100),
    sb.from("hammerex_nex_brain_answers").select("id", { count: "exact", head: true }).eq("brain_slug", slug),
    sb.from("hammerex_nex_brain_drafts").select("id", { count: "exact", head: true }).eq("brain_slug", slug),
    computeReadiness(slug),
    computeMaturity(slug),
    computeTrust(slug),
    computeCoverage(slug, brain.trade),
    computeImprovementQueue(slug, brain.trade),
  ]);

  return NextResponse.json({
    ok: true,
    brain,
    current_version: currentVersion,
    versions,
    dependencies,
    certifications: certifications ?? [],
    review_actions: reviewActions ?? [],
    recent_feedback: recentFeedback ?? [],
    unknown_queue: unknownQueue ?? [],
    audit_timeline: recentEvents ?? [],
    counts: {
      answers_total: (totalAnsCount as unknown as { count?: number })?.count ?? 0,
      drafts_total:  (draftCount as unknown as { count?: number })?.count ?? 0,
      versions_total: versions.length,
      dependencies_total: dependencies.length,
      certifications_active: (certifications ?? []).filter((c: { status: string }) => c.status === "active").length,
    },
    readiness,
    // Phase 2 observability
    maturity,
    maturity_catalogue: getMaturityLadderCatalogue(),
    trust,
    coverage,
    improvement_queue: improvementQueue,
    computed_at: new Date().toISOString(),
  });
}
