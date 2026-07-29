// src/lib/nex/brains/_readiness.ts
//
// Readiness Score · ADR-0037 · Philip 2026-07-28
//
// Computed automatically from 9 measurable factors. Not a manual
// number. Updates every time the calculator runs (nightly job +
// on-demand from the admin surface).
//
// The nine axes:
//   1. knowledge_coverage      — % of V1 modules authored (out of 6)
//   2. expert_certification    — 100 if an active primary certification exists, else 0
//   3. review_status           — 100 if last review within review_frequency_days, degrades linearly
//   4. test_pass_rate          — % of regression scenarios passing (Phase 1: null when no harness data)
//   5. feedback_quality        — % of last N answers with confidence ≥ 0.85
//   6. runtime_health          — 100 if current version is runtime-compatible, else 0
//   7. dependency_health       — % of declared dependencies whose current versions load cleanly
//   8. freshness               — days since last version bump vs domain expectation (default 180d)
//   9. explainability_coverage — % of last N answers carrying non-empty evidence
//
// Overall = weighted mean. Weights favour axes that reflect human
// governance (certification, review, feedback) over pure liveness
// signals — matches Philip's "trust through expert authorship" thesis.

import { brainSupabase, brainSupabaseAvailable } from "./_supabase";
import { checkVersionCompatibility } from "./_runtime";
import type { BrainRow, BrainVersionRow, ReadinessScore } from "./_living_types";

// ---------- Weights ----------

const WEIGHTS: Record<keyof Omit<ReadinessScore, "overall">, number> = {
  knowledge:     0.15,
  coverage:      0.10,
  testing:       0.10,
  author_review: 0.20,   // heaviest — expert governance
  freshness:     0.10,
  confidence:    0.15,
  // (Readiness type in _living_types.ts uses 6 axes for the DB row.
  //  We compute the 9 detailed axes internally, then fold into that shape.)
};

const REVIEW_HALF_LIFE_MULTIPLIER = 2;      // fully overdue at 2× cadence
const FRESHNESS_TARGET_DAYS = 180;          // default domain expectation
const FEEDBACK_WINDOW = 100;                // last N answers considered
const HIGH_CONFIDENCE_THRESHOLD = 0.85;

// ---------- Detailed axes (computed internally, richer than DB shape) ----------

export type ReadinessAxes = {
  knowledge_coverage:      number;
  expert_certification:    number;
  review_status:           number;
  test_pass_rate:          number | null;   // null when no regression harness data yet
  feedback_quality:        number | null;   // null when no answer log yet
  runtime_health:          number;
  dependency_health:       number;
  freshness:               number;
  explainability_coverage: number | null;
  // Bookkeeping the UI wants
  factors: {
    v1_modules_authored:      number;
    v1_modules_expected:      number;
    active_primary_cert:      boolean;
    days_since_review:        number | null;
    review_frequency_days:    number;
    days_since_last_version:  number | null;
    answers_considered:       number;
    answers_high_confidence:  number;
    answers_with_evidence:    number;
    unknown_questions:        number;
    dependency_total:         number;
    dependency_healthy:       number;
    runtime_compatible:       "compatible" | "needs_upgrade" | "unsupported" | "unknown";
  };
};

export type ReadinessResult = {
  overall:  number;
  axes:     ReadinessAxes;
  score:    ReadinessScore;             // shape stored in hammerex_nex_brains.readiness_score_json
  computed_at: string;
};

// ---------- Public entry ----------

/**
 * Compute the Readiness Score for one brain. Reads from Supabase.
 * Returns a { overall, axes, score } bundle the UI + registry
 * refresher both consume. Never throws — missing data becomes null
 * and drops out of the weighted mean.
 */
export async function computeReadiness(brain_slug: string): Promise<ReadinessResult> {
  const now = new Date();
  if (!brainSupabaseAvailable()) {
    return emptyReadiness(now.toISOString());
  }
  const sb = brainSupabase()!;

  const [brainRes, versionsRes, certRes, depsRes, ansRes] = await Promise.all([
    sb.from("hammerex_nex_brains").select("*").eq("slug", brain_slug).maybeSingle(),
    sb.from("hammerex_nex_brain_versions").select("*").eq("brain_slug", brain_slug).order("authored_at", { ascending: false }).limit(20),
    sb.from("hammerex_nex_brain_certifications").select("*").eq("brain_slug", brain_slug).eq("status", "active").eq("is_primary", true).maybeSingle(),
    sb.from("hammerex_nex_brain_dependencies").select("child_brain_slug").eq("parent_brain_slug", brain_slug).is("removed_at", null),
    sb.from("hammerex_nex_brain_answers").select("confidence, evidence_json, answer_kind").eq("brain_slug", brain_slug).order("answered_at", { ascending: false }).limit(FEEDBACK_WINDOW),
  ]);

  const brain = brainRes.data as BrainRow | null;
  const versions = (versionsRes.data ?? []) as BrainVersionRow[];
  const cert = certRes.data as { id: string } | null;
  const deps = (depsRes.data ?? []) as Array<{ child_brain_slug: string }>;
  const answers = (ansRes.data ?? []) as Array<{ confidence: number; evidence_json: unknown[]; answer_kind: string }>;

  const currentVersion =
    (brain?.current_version_id && versions.find((v) => v.id === brain.current_version_id)) ??
    versions.find((v) => v.published_at) ?? null;

  // ── Knowledge coverage ──
  const v1Present = currentVersion
    ? countV1ModulesPresent(currentVersion)
    : 0;
  const knowledge_coverage = pct(v1Present / 6);

  // ── Expert certification ──
  const active_primary_cert = !!cert;
  const expert_certification = active_primary_cert ? 100 : 0;

  // ── Review status ──
  const daysSinceReview = brain?.last_review_at
    ? daysBetween(new Date(brain.last_review_at), now)
    : null;
  const reviewFreq = brain?.review_frequency_days ?? 90;
  const review_status =
    daysSinceReview == null ? 0 :
    daysSinceReview <= reviewFreq ? 100 :
    daysSinceReview >= reviewFreq * REVIEW_HALF_LIFE_MULTIPLIER ? 0 :
    Math.round(100 * (1 - (daysSinceReview - reviewFreq) / (reviewFreq * (REVIEW_HALF_LIFE_MULTIPLIER - 1))));

  // ── Test pass rate ── (Phase 1 · null until regression harness ships)
  const test_pass_rate: number | null = currentVersion?.regression_result_json
    ? extractPassRate(currentVersion.regression_result_json)
    : null;

  // ── Feedback quality ──
  const answers_high_confidence = answers.filter((a) => a.confidence >= HIGH_CONFIDENCE_THRESHOLD).length;
  const unknown_questions = answers.filter((a) => a.answer_kind === "unknown").length;
  const feedback_quality =
    answers.length === 0 ? null : pct(answers_high_confidence / answers.length);

  // ── Runtime health ──
  let runtime_health = 100;
  let runtime_status: ReadinessAxes["factors"]["runtime_compatible"] = "unknown";
  if (currentVersion) {
    const check = checkVersionCompatibility({
      brain_api_version: currentVersion.brain_api_version,
      minimum_runtime_version: currentVersion.minimum_runtime_version,
    });
    runtime_status = check.status;
    runtime_health = check.ok ? 100 : 0;
  }

  // ── Dependency health ── (Phase 1 · a dep is "healthy" if its brain exists in the registry)
  let dependency_total = deps.length;
  let dependency_healthy = 0;
  if (deps.length > 0) {
    const childSlugs = deps.map((d) => d.child_brain_slug);
    const { data: children } = await sb
      .from("hammerex_nex_brains")
      .select("slug, current_version_id")
      .in("slug", childSlugs);
    dependency_healthy = (children ?? []).filter((c: { current_version_id: string | null }) => c.current_version_id).length;
  }
  const dependency_health =
    dependency_total === 0 ? 100 : pct(dependency_healthy / dependency_total);

  // ── Freshness ──
  const daysSinceLastVersion = versions[0]?.published_at
    ? daysBetween(new Date(versions[0].published_at), now)
    : versions[0]?.authored_at
    ? daysBetween(new Date(versions[0].authored_at), now)
    : null;
  const freshness =
    daysSinceLastVersion == null ? 0 :
    daysSinceLastVersion <= FRESHNESS_TARGET_DAYS ? 100 :
    daysSinceLastVersion >= FRESHNESS_TARGET_DAYS * 2 ? 0 :
    Math.round(100 * (2 - daysSinceLastVersion / FRESHNESS_TARGET_DAYS));

  // ── Explainability coverage ──
  const answers_with_evidence = answers.filter((a) => Array.isArray(a.evidence_json) && a.evidence_json.length > 0).length;
  const explainability_coverage =
    answers.length === 0 ? null : pct(answers_with_evidence / answers.length);

  // ── Assemble ──
  const axes: ReadinessAxes = {
    knowledge_coverage,
    expert_certification,
    review_status,
    test_pass_rate,
    feedback_quality,
    runtime_health,
    dependency_health,
    freshness,
    explainability_coverage,
    factors: {
      v1_modules_authored: v1Present,
      v1_modules_expected: 6,
      active_primary_cert,
      days_since_review: daysSinceReview,
      review_frequency_days: reviewFreq,
      days_since_last_version: daysSinceLastVersion,
      answers_considered: answers.length,
      answers_high_confidence,
      answers_with_evidence,
      unknown_questions,
      dependency_total,
      dependency_healthy,
      runtime_compatible: runtime_status,
    },
  };

  // Fold detailed axes into the 6-axis DB shape (for readiness_score_json)
  const score: ReadinessScore = {
    knowledge: knowledge_coverage,
    coverage:  dependency_health,
    testing:   test_pass_rate ?? 0,
    author_review: Math.round((expert_certification + review_status) / 2),
    freshness,
    confidence: feedback_quality ?? 0,
    overall: 0,
  };
  score.overall = weightedMean(score);

  return {
    overall: score.overall,
    axes,
    score,
    computed_at: now.toISOString(),
  };
}

/**
 * Persist a freshly-computed readiness score back to the brain row.
 * Called by the nightly refresher + on-demand from the admin surface.
 */
export async function persistReadiness(brain_slug: string, result: ReadinessResult): Promise<void> {
  if (!brainSupabaseAvailable()) return;
  const sb = brainSupabase()!;
  await sb
    .from("hammerex_nex_brains")
    .update({
      readiness_score_json: result.score,
      quality_score: result.overall,
      confidence: result.axes.feedback_quality != null ? result.axes.feedback_quality / 100 : null,
      coverage: result.axes.knowledge_coverage,
    })
    .eq("slug", brain_slug);
}

// ---------- Helpers ----------

function pct(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.round(Math.max(0, Math.min(1, v)) * 100);
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime());
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function countV1ModulesPresent(v: BrainVersionRow): number {
  const modules = v.modules_json as Record<string, unknown> | null;
  if (!modules) return 0;
  const v1 = ["craft", "regulations", "materials", "workflow", "defects", "pricing_model"];
  return v1.filter((name) => modules[name] != null).length;
}

function extractPassRate(regression_result_json: unknown): number | null {
  if (!regression_result_json || typeof regression_result_json !== "object") return null;
  const r = regression_result_json as { passed?: number; total?: number };
  if (typeof r.passed !== "number" || typeof r.total !== "number" || r.total === 0) return null;
  return pct(r.passed / r.total);
}

function weightedMean(s: ReadinessScore): number {
  let sum = 0;
  let weight = 0;
  for (const [axis, w] of Object.entries(WEIGHTS) as Array<[keyof typeof WEIGHTS, number]>) {
    const v = s[axis];
    if (typeof v === "number") { sum += v * w; weight += w; }
  }
  return weight > 0 ? Math.round(sum / weight) : 0;
}

function emptyReadiness(computed_at: string): ReadinessResult {
  const axes: ReadinessAxes = {
    knowledge_coverage: 0, expert_certification: 0, review_status: 0,
    test_pass_rate: null, feedback_quality: null, runtime_health: 0,
    dependency_health: 100, freshness: 0, explainability_coverage: null,
    factors: {
      v1_modules_authored: 0, v1_modules_expected: 6, active_primary_cert: false,
      days_since_review: null, review_frequency_days: 90, days_since_last_version: null,
      answers_considered: 0, answers_high_confidence: 0, answers_with_evidence: 0,
      unknown_questions: 0, dependency_total: 0, dependency_healthy: 0,
      runtime_compatible: "unknown",
    },
  };
  const score: ReadinessScore = {
    knowledge: 0, coverage: 100, testing: 0, author_review: 0,
    freshness: 0, confidence: 0, overall: 0,
  };
  return { overall: 0, axes, score, computed_at };
}
