// src/lib/nex/brains/_improvement_queue.ts
//
// Improvement Queue · Phase 2 observability
// (ADR-0038 · ADR-0041 · Philip 2026-07-28)
//
// The queue answers ONE question:
//   "What single improvement would most increase professional trust
//    tomorrow?"
//
// NEVER answers: "what feature should we build?" — that would violate
// ADR-0041 (author-driven platform evolution).
//
// Sources of improvement candidates:
//   1. Missing expected modules   (coverage.ts input)
//   2. Under-authored modules     (coverage.ts input)
//   3. Unresolved unknown answers (answers table)
//   4. Missing constitutional identity (mission/principles/promise)
//   5. Missing/expiring certification
//
// Each candidate carries:
//   • title             · one-line description
//   • why               · why doing this raises trust
//   • potential_impact  · qualitative + trust-lever hint (never a fabricated %)
//   • action            · concrete next step the author can take today
//   • effort            · rough estimate ("30 minutes", "1 hour", "1 day")
//   • signal_strength   · confidence in the recommendation (low/medium/high)

import { brainSupabase, brainSupabaseAvailable, getBrainBySlug } from "./_supabase";
import { computeCoverage } from "./_coverage";

// ---------- Types ----------

export type ImprovementItem = {
  rank: number;
  title: string;
  why: string;
  action: string;
  effort: "30 minutes" | "1 hour" | "half a day" | "1 day" | "multi-day";
  potential_impact: "raises maturity level" | "raises trust score" | "closes knowledge gap" | "unlocks production" | "prevents trust regression";
  signal_strength: "low" | "medium" | "high";
  source: "coverage" | "unknowns" | "identity" | "certification" | "activity";
  data: Record<string, unknown>;
};

export type ImprovementQueue = {
  brain_slug: string;
  question_answered: string;   // constant — the queue's north star
  items: ImprovementItem[];
  computed_at: string;
};

// ---------- Public API ----------

export async function computeImprovementQueue(brain_slug: string, trade: string | null = "staircase"): Promise<ImprovementQueue> {
  const computed_at = new Date().toISOString();
  const question_answered = "What single improvement would most increase professional trust tomorrow?";

  if (!brainSupabaseAvailable()) {
    return { brain_slug, question_answered, items: [], computed_at };
  }

  const brain = await getBrainBySlug(brain_slug);
  if (!brain) {
    return { brain_slug, question_answered, items: [], computed_at };
  }

  const sb = brainSupabase()!;
  const candidates: ImprovementItem[] = [];

  // ── Candidate source 1 · Constitutional identity gaps (highest lever)
  if (!brain.mission || (brain.mission ?? "").trim().length === 0) {
    candidates.push({
      rank: 0,
      title: "Author the brain's Mission statement",
      why: "The Mission is the brain's constitutional purpose. Without it the brain cannot be promoted to Production and cannot advance past Maturity Level 4.",
      action: "PATCH /api/admin/brains/" + brain.slug + "/identity with a one-sentence purpose statement.",
      effort: "30 minutes",
      potential_impact: "unlocks production",
      signal_strength: "high",
      source: "identity",
      data: {},
    });
  }
  if ((brain.principles ?? []).length === 0) {
    candidates.push({
      rank: 0,
      title: "Declare the brain's Principles",
      why: "Principles are the filter every answer passes through. Without them consistency depends on individual authors.",
      action: "PATCH /identity with an ordered array of principles (e.g. 'safety first', 'never fabricate').",
      effort: "30 minutes",
      potential_impact: "raises trust score",
      signal_strength: "high",
      source: "identity",
      data: {},
    });
  }
  if ((brain.promise?.will_do ?? []).length === 0) {
    candidates.push({
      rank: 0,
      title: "Declare the brain's Promise to users",
      why: "The Promise is the honesty contract with end-users. It is required to reach Maturity Level 4 (Production).",
      action: "PATCH /identity with { promise: { will_do: [...], will_not_do: [...] } }.",
      effort: "30 minutes",
      potential_impact: "unlocks production",
      signal_strength: "high",
      source: "identity",
      data: {},
    });
  }

  // ── Candidate source 2 · Certification gap
  const { data: primaryCert } = await sb
    .from("hammerex_nex_brain_certifications")
    .select("id, author_name, expires_at")
    .eq("brain_slug", brain_slug).eq("is_primary", true).eq("status", "active").maybeSingle();

  if (!primaryCert) {
    candidates.push({
      rank: 0,
      title: "Add an active primary certification",
      why: "Named expertise is the single strongest signal of trust available. Without a certified author, trust cannot compound.",
      action: "Insert a certification row with is_primary=true against a real named expert with credentials.",
      effort: "1 hour",
      potential_impact: "raises trust score",
      signal_strength: "high",
      source: "certification",
      data: {},
    });
  } else if ((primaryCert as { expires_at: string | null }).expires_at) {
    const days = Math.round((new Date((primaryCert as { expires_at: string }).expires_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 30) {
      candidates.push({
        rank: 0,
        title: `Renew certification — expires in ${days} days`,
        why: "A lapsed certification silently reduces trust and blocks maturity advancement.",
        action: `Contact ${(primaryCert as { author_name: string }).author_name} to renew before expiry.`,
        effort: "1 hour",
        potential_impact: "prevents trust regression",
        signal_strength: "high",
        source: "certification",
        data: { days_until_expiry: days },
      });
    }
  }

  // ── Candidate source 3 · Coverage gaps
  const coverage = await computeCoverage(brain_slug, trade);
  const missingExpected = coverage.modules.filter((m) => m.is_expected && !m.is_authored);
  for (const mod of missingExpected.slice(0, 3)) {
    candidates.push({
      rank: 0,
      title: `Author the '${mod.module}' module — currently missing`,
      why: `'${mod.module}' is an expected module for a trade brain of this type. Its absence limits both coverage and the range of questions the brain can answer.`,
      action: `Open the Draft Workspace, add a '${mod.module}' key to modules_json with initial content, submit for review.`,
      effort: "half a day",
      potential_impact: "closes knowledge gap",
      signal_strength: "high",
      source: "coverage",
      data: { module: mod.module },
    });
  }
  const underdeveloped = coverage.modules
    .filter((m) => m.is_authored && (m.status === "empty" || m.status === "developing"))
    .slice(0, 3);
  for (const mod of underdeveloped) {
    candidates.push({
      rank: 0,
      title: `Deepen the '${mod.module}' module — currently ${mod.status}`,
      why: `Modules at ${mod.status} coverage lower the brain's confidence on the topics they touch.`,
      action: `Expand the '${mod.module}' module with more structured entries. Aim for at least 10 substantive entries.`,
      effort: "1 day",
      potential_impact: "closes knowledge gap",
      signal_strength: "medium",
      source: "coverage",
      data: { module: mod.module, current_pct: mod.coverage_pct },
    });
  }

  // ── Candidate source 4 · Unknown queries (Phase 3's raw material)
  const { data: unknowns } = await sb
    .from("hammerex_nex_brain_answers")
    .select("id, query_text, confidence, answered_at")
    .eq("brain_slug", brain_slug)
    .eq("answer_kind", "unknown")
    .order("answered_at", { ascending: false })
    .limit(50);

  const unknownCount = unknowns?.length ?? 0;
  if (unknownCount >= 5) {
    // Aggregate the top themes by naive keyword co-occurrence (Phase 2 first cut · no clustering).
    const sample = (unknowns ?? []).slice(0, 5).map((u: { query_text: string }) => u.query_text.slice(0, 80));
    candidates.push({
      rank: 0,
      title: `Resolve ${unknownCount} queued unknown questions`,
      why: "Every unknown that becomes knowledge raises coverage AND trust. This is the exact feedback loop Phase 3 depends on.",
      action: `Open the Feedback section, work through the Unknown Queue, author responses via the Draft Workspace. Recent sample: ${sample.slice(0, 3).map((s) => `"${s}"`).join(" · ")}.`,
      effort: "half a day",
      potential_impact: "raises trust score",
      signal_strength: "high",
      source: "unknowns",
      data: { count: unknownCount, sample },
    });
  }

  // ── Candidate source 5 · Silence detection (no author activity)
  const since90d = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentAuthorActivity } = await sb
    .from("hammerex_nex_events")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", "brain_draft")
    .gte("occurred_at", since90d)
    .eq("metadata->>brain_slug", brain_slug);

  if ((recentAuthorActivity ?? 0) === 0 && brain.lifecycle_stage === "production") {
    candidates.push({
      rank: 0,
      title: "Restart authoring — no activity in 90 days",
      why: "A production brain with no recent authoring is a trust regression waiting to happen. Codes change, practices evolve, silence looks like abandonment.",
      action: "Even a small draft — updating one entry — signals ongoing maintenance.",
      effort: "1 hour",
      potential_impact: "prevents trust regression",
      signal_strength: "medium",
      source: "activity",
      data: { last_90d_events: 0 },
    });
  }

  // ── Rank ────────────────────────────────────────────────────────────
  // Priority order (author-driven per ADR-0041):
  //   1. unlocks production (identity + promise gaps)
  //   2. prevents trust regression (certification renewal, silence)
  //   3. raises trust score (certification present, unknown queue)
  //   4. closes knowledge gap (coverage)
  //   5. raises maturity level (future)
  const impactOrder: Record<ImprovementItem["potential_impact"], number> = {
    "unlocks production":        0,
    "prevents trust regression": 1,
    "raises trust score":        2,
    "closes knowledge gap":      3,
    "raises maturity level":     4,
  };
  const signalWeight: Record<ImprovementItem["signal_strength"], number> = { high: 0, medium: 1, low: 2 };

  const ranked = candidates
    .sort((a, b) => {
      const ia = impactOrder[a.potential_impact] - impactOrder[b.potential_impact];
      if (ia !== 0) return ia;
      return signalWeight[a.signal_strength] - signalWeight[b.signal_strength];
    })
    .slice(0, 10)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  return {
    brain_slug,
    question_answered,
    items: ranked,
    computed_at,
  };
}
