// POST /api/studio/ai/pipeline-v2
//
// The 14-step AI Composition Engine v2 orchestrator (M3 · Batch 8).
//
// Current coverage — steps 1..4:
//   1. business.discover   → { trade, merchantName, outcomes } (LLM)
//   2. prompt.extract-intent → audience, tone, style, urgency,
//                              goals, wants, keywords (LLM)
//   3. journey.selectFor(intent, trade) → 3-5 stage plan (pure)
//   4. layoutRegistry.rank({ trade, goals, wants, ... }) → scored
//                              layout candidates (pure)
//
// Deferred (steps 5..14 land in follow-up PRs on this same route):
//   5. Container plan     — layout.sequence → container id list
//   6. Navigation choice  — navigationRegistry.selectFor(...)
//   7. Section selection  — per-container compatibleSections
//   8. Component fill     — section slots
//   9. App recommendation — appRegistry via aiGateway.app.recommend
//   10. Theme selection   — themeRegistry.suggestFor(trade, style)
//   11. Token set choice  — designTokenRegistry.selectFor(...)
//   12. Asset fill        — assetLibrary.getRandomAsset(...)
//   13. Business runtime  — booking / form / dashboard hydration
//   14. Final assembly    — buildLayoutFromSeeds → StudioLayoutJson
//
// The response shape carries a `steps` array where each entry is
// annotated with { step, kind: "llm" | "pure", ok, ms, result }. This
// makes the pipeline inspectable end-to-end for Studio's dev tools.
//
// Auth: studio session (same as /api/studio/generate). Rate limit
// piggybacks on the composer usage log — 1 pipeline call is ~2 LLM
// calls (steps 1 + 2), so allocate 6 per merchant per 5 minutes.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { aiGateway } from "@/lib/studio/aiGateway";
import "@/lib/studio/aiProviders"; // register anthropic provider
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { OUTCOME_SLUGS } from "@/lib/studio/blueprints";
import { BUSINESS_MODULES } from "@/lib/studio/modules";
import { journeyRegistry } from "@/platform/journey";
import { layoutRegistry } from "@/platform/layouts";
import {
  extractIntent,
  type ExtractedIntent,
  type IntentGoal
} from "@/lib/studio/ai/extractIntent";
import type { BusinessGoal } from "@/platform/layouts";
import { buildReviewPlan } from "@/lib/studio/ai/reviewPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostBody = {
  prompt?: string;
  tradeSlug?: string;
  city?: string;
};

type DiscoveryResult = {
  tradeSlug: string | null;
  merchantName: string | null;
  outcomes: string[];
  confidence: number;
  reasoning: string;
};

type StepMeta = {
  step: number;
  id: string;
  kind: "llm" | "pure";
  ok: boolean;
  ms: number;
  detail?: string;
};

const TRADE_SLUG_SET = new Set(TRADE_OFF_TRADES.map((t) => t.slug));

/** IntentGoal → BusinessGoal is a subset — every intent goal we emit
 *  is a legal LayoutRankInput goal. Cast is safe by construction. */
function toLayoutGoals(goals: readonly IntentGoal[]): readonly BusinessGoal[] {
  const layoutGoalSet = new Set<BusinessGoal>([
    "lead-generation",
    "bookings",
    "quotes",
    "portfolio-showcase",
    "ecommerce",
    "brand-awareness",
    "directory-listing",
    "operations-dashboard",
    "content-publishing",
    "trust-building",
    "search-anchored"
  ]);
  return goals.filter((g): g is BusinessGoal => layoutGoalSet.has(g as BusinessGoal));
}

/** Journey goals are a subset of intent goals — every intent goal is
 *  a legal JourneyGoal. Cast is safe by construction. */
function toJourneyGoals(
  goals: readonly IntentGoal[]
): readonly IntentGoal[] {
  return goals;
}

async function runBusinessDiscovery(
  prompt: string,
  providedTradeSlug: string
): Promise<{
  discovery: DiscoveryResult | null;
  tradeSlug: string;
  usage: { inputTokens: number; outputTokens: number };
  ok: boolean;
  detail?: string;
}> {
  if (providedTradeSlug) {
    return {
      discovery: null,
      tradeSlug: providedTradeSlug,
      usage: { inputTokens: 0, outputTokens: 0 },
      ok: true,
      detail: "trade provided; discovery skipped"
    };
  }

  const trades = TRADE_OFF_TRADES.map((t) => ({ slug: t.slug, label: t.label }));
  const outcomes = (OUTCOME_SLUGS as readonly string[]).map((slug) => ({
    slug,
    label: slug
  }));
  const modules = BUSINESS_MODULES.map((m) => ({ slug: m.id, label: m.name }));

  const res = await aiGateway.complete({
    task: "business.discover",
    context: { payload: { description: prompt, trades, outcomes, modules } }
  });

  if (!res.ok) {
    return {
      discovery: null,
      tradeSlug: "",
      usage: { inputTokens: 0, outputTokens: 0 },
      ok: false,
      detail: res.error.message
    };
  }

  const raw = res.result as {
    tradeSlug?: string | null;
    merchantName?: string | null;
    outcomes?: string[];
    confidence?: number;
    reasoning?: string;
  };
  const outcomeSet = new Set(OUTCOME_SLUGS as readonly string[]);
  const validTrade =
    raw.tradeSlug && TRADE_SLUG_SET.has(raw.tradeSlug) ? raw.tradeSlug : null;
  const validOutcomes = (raw.outcomes ?? [])
    .filter((o): o is string => typeof o === "string")
    .filter((o) => outcomeSet.has(o))
    .slice(0, 3);
  const discovery: DiscoveryResult = {
    tradeSlug: validTrade,
    merchantName:
      typeof raw.merchantName === "string" && raw.merchantName.trim()
        ? raw.merchantName.trim()
        : null,
    outcomes: validOutcomes,
    confidence:
      typeof raw.confidence === "number"
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0,
    reasoning:
      typeof raw.reasoning === "string" ? raw.reasoning.slice(0, 280) : ""
  };

  return {
    discovery,
    tradeSlug: validTrade ?? "",
    usage: {
      inputTokens: res.meta?.inputTokens ?? 0,
      outputTokens: res.meta?.outputTokens ?? 0
    },
    ok: Boolean(validTrade),
    detail: validTrade
      ? undefined
      : "trade not detected from prompt"
  };
}

export async function POST(req: Request) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid-json" },
      { status: 400 }
    );
  }

  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 8) {
    return NextResponse.json(
      { ok: false, error: "prompt-too-short" },
      { status: 400 }
    );
  }
  const providedTradeSlug = (body.tradeSlug ?? "").trim();
  if (providedTradeSlug && !TRADE_SLUG_SET.has(providedTradeSlug)) {
    return NextResponse.json(
      { ok: false, error: "unknown-trade-slug", tradeSlug: providedTradeSlug },
      { status: 400 }
    );
  }

  const steps: StepMeta[] = [];
  const usageTotals = { inputTokens: 0, outputTokens: 0 };

  // ─── Step 1: business.discover ────────────────────────────────
  const t1 = Date.now();
  const step1 = await runBusinessDiscovery(prompt, providedTradeSlug);
  steps.push({
    step: 1,
    id: "business.discover",
    kind: "llm",
    ok: step1.ok,
    ms: Date.now() - t1,
    detail: step1.detail
  });
  usageTotals.inputTokens += step1.usage.inputTokens;
  usageTotals.outputTokens += step1.usage.outputTokens;

  const tradeSlug = step1.tradeSlug;
  if (!tradeSlug) {
    return NextResponse.json({
      ok: false,
      error: "trade-not-detected",
      detail:
        "Pass tradeSlug explicitly or add trade-specific language to the prompt.",
      steps,
      discovery: step1.discovery
    }, { status: 422 });
  }

  // ─── Step 2: prompt.extract-intent ────────────────────────────
  const t2 = Date.now();
  const step2 = await extractIntent({
    description: prompt,
    tradeSlug,
    city: body.city
  });
  steps.push({
    step: 2,
    id: "prompt.extract-intent",
    kind: "llm",
    ok: step2.intent !== null,
    ms: Date.now() - t2,
    detail: step2.intent ? undefined : "intent extraction failed"
  });
  if (step2.usage) {
    usageTotals.inputTokens += step2.usage.inputTokens;
    usageTotals.outputTokens += step2.usage.outputTokens;
  }

  // Fallback intent — trade-typical defaults so the pipeline continues
  // even without an LLM response.
  const intent: ExtractedIntent =
    step2.intent ?? {
      audience: "homeowner",
      tone: "trades-native",
      style: "modern",
      urgency: "planned",
      goals: ["lead-generation", "quotes"] as IntentGoal[],
      wants: {
        booking: false,
        ecommerce: false,
        portfolio: false,
        search: false,
        map: false,
        floatingCta: true
      },
      keywords: [],
      confidence: 0
    };

  // ─── Step 3: journey.selectFor ────────────────────────────────
  const t3 = Date.now();
  const journeyRank = journeyRegistry.rank({
    trade: tradeSlug,
    urgency: intent.urgency,
    goals: toJourneyGoals(intent.goals),
    keywords: intent.keywords,
    wantsBooking: intent.wants.booking,
    wantsEcommerce: intent.wants.ecommerce,
    wantsPortfolio: intent.wants.portfolio,
    wantsSearch: intent.wants.search
  });
  const journey = journeyRank[0];
  steps.push({
    step: 3,
    id: "journey.selectFor",
    kind: "pure",
    ok: Boolean(journey),
    ms: Date.now() - t3,
    detail: journey ? undefined : "no journey scored above zero"
  });

  // ─── Step 4: layoutRegistry.rank ──────────────────────────────
  const t4 = Date.now();
  const layoutGoals = toLayoutGoals(intent.goals);
  const layoutRank = layoutRegistry.rank({
    trade: tradeSlug,
    goals: layoutGoals,
    keywords: intent.keywords,
    wantsBooking: intent.wants.booking,
    wantsEcommerce: intent.wants.ecommerce,
    wantsPortfolio: intent.wants.portfolio,
    wantsSearch: intent.wants.search,
    wantsMap: intent.wants.map,
    wantsFloatingCta: intent.wants.floatingCta
  });
  const layoutTop = layoutRank[0];
  steps.push({
    step: 4,
    id: "layoutRegistry.rank",
    kind: "pure",
    ok: Boolean(layoutTop),
    ms: Date.now() - t4,
    detail: layoutTop
      ? undefined
      : "no layout scored above zero — did any patterns register?"
  });

  return NextResponse.json({
    ok: true,
    pipeline: {
      brand: { id: session.brand.id },
      steps,
      usage: usageTotals,

      // ─── Step outputs ───
      discovery: step1.discovery,
      intent,
      journey: journey
        ? {
            slug: journey.journey.slug,
            name: journey.journey.name,
            tagline: journey.journey.tagline,
            score: journey.score,
            reasons: journey.reasons,
            stages: journey.journey.stages,
            pageSet: journey.journey.pageSet,
            chrome: journey.journey.chrome,
            typicalLayoutSlugs: journey.journey.decision.typicalLayoutSlugs
          }
        : null,
      review: journey
        ? buildReviewPlan(journey.journey, {
            isMerchantFacing: journey.journey.category !== "directory-first"
          })
        : null,
      layout: layoutTop
        ? {
            slug: layoutTop.layout.slug,
            name: layoutTop.layout.name,
            tagline: layoutTop.layout.tagline,
            score: layoutTop.score,
            reasons: layoutTop.reasons,
            sequence: layoutTop.layout.sequence
          }
        : null,

      // ─── Deferred (steps 5-14) ───
      pending: [
        { step: 5, id: "container.plan" },
        { step: 6, id: "navigation.select" },
        { step: 7, id: "section.select" },
        { step: 8, id: "component.fill" },
        { step: 9, id: "app.recommend" },
        { step: 10, id: "theme.select" },
        { step: 11, id: "tokens.select" },
        { step: 12, id: "asset.fill" },
        { step: 13, id: "runtime.hydrate" },
        { step: 14, id: "layout.assemble" }
      ]
    }
  });
}
