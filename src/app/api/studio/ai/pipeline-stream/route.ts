// POST /api/studio/ai/pipeline-stream
//
// Streaming variant of /api/studio/ai/pipeline-v2. Emits Server-Sent
// Events as each step completes so the builder shell reveals the
// composition step-by-step — the "watching it build" effect that
// makes Lovable / Bolt / v0 feel magical.
//
// Event shape:
//   { type: "step-start",  step: number, id: string, kind: "llm"|"pure" }
//   { type: "step-done",   step: number, id: string, ok: boolean, ms: number, result?: unknown }
//   { type: "final",       pipeline: FullPipelineResult }
//   { type: "error",       error: string, detail?: string }
//
// Reuses every step function from pipeline-v2; the difference is just
// the response shape (SSE) and the between-step 200 ms stagger that
// gives the reveal breathing room.

import { loadStudioSession } from "@/lib/studio/session";
import { aiGateway } from "@/lib/studio/aiGateway";
import "@/lib/studio/aiProviders";
import { TRADE_OFF_TRADES } from "@/lib/tradeOff";
import { OUTCOME_SLUGS } from "@/lib/studio/blueprints";
import { BUSINESS_MODULES } from "@/lib/studio/modules";
import { journeyRegistry } from "@/platform/journey";
import { layoutRegistry } from "@/platform/layouts";
import { navigationRegistry } from "@/platform/navigation";
import { themeRegistry } from "@/platform/themes";
import { sectionRegistry } from "@/lib/studio/sectionRegistry";
import {
  extractIntent,
  type ExtractedIntent,
  type IntentGoal
} from "@/lib/studio/ai/extractIntent";
import type { BusinessGoal } from "@/platform/layouts";
import { buildReviewPlan } from "@/lib/studio/ai/reviewPlan";
import { warehouseAppsFor } from "@/lib/apps/warehouse";
import { assemblePipelineLayouts } from "@/lib/studio/ai/assembleLayout";
import "@/lib/studio/blueprints";
import { blueprintRegistry } from "@/lib/studio/blueprints/registry";
import {
  generateBespokeProse,
  type BespokeProse
} from "@/lib/studio/ai/bespokeProse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRADE_SLUG_SET = new Set(TRADE_OFF_TRADES.map((t) => t.slug));

// Small stagger between step completions — makes the timeline read as
// a live build rather than a flash of JSON. 200 ms is enough to see
// each step land, small enough not to feel slow.
const STAGGER_MS = 200;

const encoder = new TextEncoder();
function sse(obj: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
}
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function toLayoutGoals(goals: readonly IntentGoal[]): readonly BusinessGoal[] {
  const set = new Set<BusinessGoal>([
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
  return goals.filter((g): g is BusinessGoal => set.has(g as BusinessGoal));
}

export async function POST(req: Request): Promise<Response> {
  const session = await loadStudioSession();
  if (!session) {
    return new Response(
      JSON.stringify({ ok: false, error: "unauthenticated" }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  let body: { prompt?: string; tradeSlug?: string; city?: string; templateId?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid-json" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  const prompt = (body.prompt ?? "").trim();
  const providedTradeSlug = (body.tradeSlug ?? "").trim();
  if (prompt.length < 8) {
    return new Response(
      JSON.stringify({ ok: false, error: "prompt-too-short" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }
  if (providedTradeSlug && !TRADE_SLUG_SET.has(providedTradeSlug)) {
    return new Response(
      JSON.stringify({ ok: false, error: "unknown-trade-slug" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (o: unknown) => controller.enqueue(sse(o));

      try {
        const totalUsage = { inputTokens: 0, outputTokens: 0 };
        let discovery: unknown = null;
        let intent: ExtractedIntent | null = null;
        let tradeSlug = providedTradeSlug;

        // ─── Step 1: business.discover ────────────────────────
        emit({ type: "step-start", step: 1, id: "business.discover", kind: "llm" });
        const t1 = Date.now();
        if (!tradeSlug) {
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
          if (res.ok) {
            const raw = res.result as {
              tradeSlug?: string | null;
              merchantName?: string | null;
              outcomes?: string[];
              confidence?: number;
              reasoning?: string;
            };
            const validTrade =
              raw.tradeSlug && TRADE_SLUG_SET.has(raw.tradeSlug) ? raw.tradeSlug : null;
            const outcomeSet = new Set(OUTCOME_SLUGS as readonly string[]);
            const validOutcomes = (raw.outcomes ?? [])
              .filter((o): o is string => typeof o === "string")
              .filter((o) => outcomeSet.has(o))
              .slice(0, 3);
            discovery = {
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
            tradeSlug = validTrade ?? "";
            totalUsage.inputTokens += res.meta?.inputTokens ?? 0;
            totalUsage.outputTokens += res.meta?.outputTokens ?? 0;
          }
        }
        emit({
          type: "step-done",
          step: 1,
          id: "business.discover",
          ok: Boolean(tradeSlug),
          ms: Date.now() - t1,
          result: { tradeSlug, discovery }
        });
        if (!tradeSlug) {
          emit({
            type: "error",
            error: "trade-not-detected",
            detail:
              "Pass tradeSlug explicitly or add trade-specific language to the prompt."
          });
          controller.close();
          return;
        }
        await sleep(STAGGER_MS);

        // ─── Step 2: prompt.extract-intent ────────────────────
        emit({ type: "step-start", step: 2, id: "prompt.extract-intent", kind: "llm" });
        const t2 = Date.now();
        const step2 = await extractIntent({
          description: prompt,
          tradeSlug,
          city: body.city
        });
        intent =
          step2.intent ??
          ({
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
          } as ExtractedIntent);
        if (step2.usage) {
          totalUsage.inputTokens += step2.usage.inputTokens;
          totalUsage.outputTokens += step2.usage.outputTokens;
        }
        emit({
          type: "step-done",
          step: 2,
          id: "prompt.extract-intent",
          ok: step2.intent !== null,
          ms: Date.now() - t2,
          result: intent
        });
        await sleep(STAGGER_MS);

        // ─── Step 3: journey.selectFor ────────────────────────
        emit({ type: "step-start", step: 3, id: "journey.selectFor", kind: "pure" });
        const t3 = Date.now();
        const journeyRank = journeyRegistry.rank({
          trade: tradeSlug,
          urgency: intent.urgency,
          goals: intent.goals,
          keywords: intent.keywords,
          wantsBooking: intent.wants.booking,
          wantsEcommerce: intent.wants.ecommerce,
          wantsPortfolio: intent.wants.portfolio,
          wantsSearch: intent.wants.search
        });
        const journey = journeyRank[0];
        emit({
          type: "step-done",
          step: 3,
          id: "journey.selectFor",
          ok: Boolean(journey),
          ms: Date.now() - t3,
          result: journey
            ? {
                slug: journey.journey.slug,
                name: journey.journey.name,
                tagline: journey.journey.tagline,
                score: journey.score,
                reasons: journey.reasons,
                stages: journey.journey.stages,
                pageSet: journey.journey.pageSet,
                chrome: journey.journey.chrome
              }
            : null
        });
        await sleep(STAGGER_MS);

        // ─── Step 4: layoutRegistry.rank ──────────────────────
        emit({ type: "step-start", step: 4, id: "layoutRegistry.rank", kind: "pure" });
        const t4 = Date.now();
        const layoutRank = layoutRegistry.rank({
          trade: tradeSlug,
          goals: toLayoutGoals(intent.goals),
          keywords: intent.keywords,
          wantsBooking: intent.wants.booking,
          wantsEcommerce: intent.wants.ecommerce,
          wantsPortfolio: intent.wants.portfolio,
          wantsSearch: intent.wants.search,
          wantsMap: intent.wants.map,
          wantsFloatingCta: intent.wants.floatingCta
        });
        const layoutTop = layoutRank[0];
        emit({
          type: "step-done",
          step: 4,
          id: "layoutRegistry.rank",
          ok: Boolean(layoutTop),
          ms: Date.now() - t4,
          result: layoutTop
            ? {
                slug: layoutTop.layout.slug,
                name: layoutTop.layout.name,
                tagline: layoutTop.layout.tagline,
                score: layoutTop.score,
                reasons: layoutTop.reasons,
                sequence: layoutTop.layout.sequence
              }
            : null
        });
        await sleep(STAGGER_MS);

        // ─── Step 6: container plan (pure) ────────────────────
        let containerPlan: Array<{
          containerId: string;
          role: string;
        }> = [];
        if (layoutTop) {
          emit({ type: "step-start", step: 5, id: "container.plan", kind: "pure" });
          const t6 = Date.now();
          containerPlan = layoutTop.layout.sequence.map((s) => ({
            containerId: s.containerId,
            role: s.role
          }));
          emit({
            type: "step-done",
            step: 6,
            id: "container.plan",
            ok: containerPlan.length > 0,
            ms: Date.now() - t6,
            result: containerPlan
          });
          await sleep(STAGGER_MS);
        }

        // ─── Step 7: navigation.select (pure) ─────────────────
        let navPick: { slug: string; name: string; pattern: string; devices: readonly string[] } | null = null;
        if (layoutTop) {
          emit({ type: "step-start", step: 6, id: "navigation.select", kind: "pure" });
          const t7 = Date.now();
          const navRank = navigationRegistry.rank({
            layoutId: layoutTop.layout.slug,
            device: "desktop"
          });
          const top = navRank[0];
          if (top) {
            navPick = {
              slug: top.nav.slug,
              name: top.nav.name,
              pattern: top.nav.pattern,
              devices: top.nav.devices
            };
          } else {
            // Fallback — use the layout's declared default nav id.
            const defaultNavId = layoutTop.layout.defaultNavigationId;
            const fallback = defaultNavId ? navigationRegistry.get(defaultNavId) : undefined;
            if (fallback) {
              navPick = {
                slug: fallback.slug,
                name: fallback.name,
                pattern: fallback.pattern,
                devices: fallback.devices
              };
            }
          }
          emit({
            type: "step-done",
            step: 7,
            id: "navigation.select",
            ok: Boolean(navPick),
            ms: Date.now() - t7,
            result: navPick
          });
          await sleep(STAGGER_MS);
        }

        // ─── Step 8: section.select per container (pure) ──────
        // For each step in the container plan, pick the best-fit
        // registered section. Priority: the layout step's
        // compatibleSections, then any section whose id contains
        // the role hint, then the first section in a category
        // matching the role, then null.
        type SectionPick = {
          role: string;
          containerId: string;
          sectionId: string | null;
          library: string | null;
        };
        let sectionPicks: SectionPick[] = [];
        if (chosenBlueprint) {
          emit({ type: "step-start", step: 7, id: "section.select", kind: "pure" });
          const t8 = Date.now();
          // Blueprint path — every section from the blueprint's home
          // becomes a pick. The role is derived from slotHint so the
          // assembler + KG prose still map the right prose fields.
          const home = Array.isArray(chosenBlueprint.layout?.home)
            ? chosenBlueprint.layout.home
            : [];
          sectionPicks = home.map((s) => {
            const reg = sectionRegistry.get(s.key);
            return {
              role: s.slotHint ?? "body",
              containerId: "containers.single-column",
              sectionId: sectionRegistry.has(s.key) ? s.key : null,
              library: (reg?.category as string | undefined) ?? null
            };
          });
          const filled = sectionPicks.filter((p) => p.sectionId !== null).length;
          emit({
            type: "step-done",
            step: 7,
            id: "section.select",
            ok: filled > 0,
            ms: Date.now() - t8,
            result: sectionPicks,
            detail: `template=${chosenTemplateId} · ${filled}/${sectionPicks.length} slots filled`
          });
          await sleep(STAGGER_MS);
        } else if (layoutTop) {
          emit({ type: "step-start", step: 7, id: "section.select", kind: "pure" });
          const t8 = Date.now();
          sectionPicks = layoutTop.layout.sequence.map((step) => {
            const compat = step.compatibleSections ?? [];
            let sectionId: string | null = null;
            let library: string | null = null;

            for (const cand of compat) {
              if (sectionRegistry.has(cand)) {
                sectionId = cand;
                const reg = sectionRegistry.get(cand);
                library = (reg?.category as string | undefined) ?? null;
                break;
              }
            }
            if (!sectionId) {
              // Fallback: any registered section whose id contains
              // the role as a substring (heuristic match).
              const all = sectionRegistry.list();
              const hit = all.find((r) => r.id.toLowerCase().includes(step.role.toLowerCase()));
              if (hit) {
                sectionId = hit.id;
                library = (hit.category as string | undefined) ?? null;
              }
            }
            return {
              role: step.role,
              containerId: step.containerId,
              sectionId,
              library
            };
          });
          const filled = sectionPicks.filter((p) => p.sectionId !== null).length;
          emit({
            type: "step-done",
            step: 8,
            id: "section.select",
            ok: filled > 0,
            ms: Date.now() - t8,
            result: sectionPicks,
            detail: `${filled}/${sectionPicks.length} slots filled`
          });
          await sleep(STAGGER_MS);
        }

        // ─── Step 9: app.recommend (pure, deterministic) ──────
        // Warehouse apps for the trade, filtered by journey affinity.
        let appRecs: Array<{ slug: string; name: string; tier: string; reason: string }> = [];
        if (tradeSlug && journey) {
          emit({ type: "step-start", step: 8, id: "app.recommend", kind: "pure" });
          const t9 = Date.now();
          const pool = warehouseAppsFor(tradeSlug);
          const journeySlug = journey.journey.slug;
          const scored = pool.map((a) => {
            let score = 0;
            const reasons: string[] = [];
            if (a.featured) {
              score += 10;
              reasons.push("featured");
            }
            if (a.recommendForJourneys?.includes(journeySlug)) {
              score += 30;
              reasons.push(`fits ${journeySlug} journey`);
            }
            if (a.tier === "free") {
              score += 5;
              reasons.push("included in your plan");
            }
            return {
              slug: a.slug,
              name: a.name,
              tier: a.tier,
              score,
              reason: reasons.join(", ") || "trade match"
            };
          });
          appRecs = scored
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(({ slug, name, tier, reason }) => ({ slug, name, tier, reason }));
          emit({
            type: "step-done",
            step: 9,
            id: "app.recommend",
            ok: appRecs.length > 0,
            ms: Date.now() - t9,
            result: appRecs
          });
          await sleep(STAGGER_MS);
        }

        // ─── Step 10: theme.select (pure) ─────────────────────
        let themeSlug: string | null = null;
        if (tradeSlug) {
          emit({ type: "step-start", step: 9, id: "theme.select", kind: "pure" });
          const t10 = Date.now();
          themeSlug = themeRegistry.rank(tradeSlug);
          const themeReg = themeRegistry.get(themeSlug);
          emit({
            type: "step-done",
            step: 10,
            id: "theme.select",
            ok: Boolean(themeSlug),
            ms: Date.now() - t10,
            result: themeReg
              ? {
                  slug: themeReg.slug,
                  name: themeReg.name,
                  description: themeReg.description,
                  motion: themeReg.motion,
                  vars: themeReg.vars
                }
              : null
          });
          await sleep(STAGGER_MS);
        }

        // ─── Step 11: tokens.select (pure) ────────────────────
        // Tokens follow the chosen theme's CSS vars — a live token
        // set is materialised at render time by ThemeProvider. For
        // pipeline observability we surface the theme's vars.
        emit({ type: "step-start", step: 10, id: "tokens.select", kind: "pure" });
        const t11 = Date.now();
        const themeReg = themeSlug ? themeRegistry.get(themeSlug) : undefined;
        const tokenSet = themeReg?.vars ?? null;
        emit({
          type: "step-done",
          step: 11,
          id: "tokens.select",
          ok: tokenSet !== null,
          ms: Date.now() - t11,
          result: tokenSet
        });
        await sleep(STAGGER_MS);

        // ─── Step 5: bespoke prose (KG → per-page copy) ───────
        // The moat activation. Horizontal builders can't do this —
        // they don't have the trade's Knowledge Graph.
        let prose: BespokeProse | null = null;
        if (journey && intent) {
          emit({ type: "step-start", step: 11, id: "prose.bespoke", kind: "llm" });
          const t5 = Date.now();
          const merchantName =
            (discovery as { merchantName?: string | null } | null)?.merchantName ??
            "Your Business";
          const requiredPageIds = journey.journey.pageSet
            .filter((p) => p.required)
            .map((p) => p.id);
          const proseResult = await generateBespokeProse({
            merchantName,
            tradeSlug,
            city: body.city,
            intent,
            pageIds: requiredPageIds,
            journeySlug: journey.journey.slug
          });
          prose = proseResult.prose;
          if (proseResult.usage) {
            totalUsage.inputTokens += proseResult.usage.inputTokens;
            totalUsage.outputTokens += proseResult.usage.outputTokens;
          }
          emit({
            step: 12,
            id: "prose.bespoke",
            type: "step-done",
            ok: prose !== null,
            ms: Date.now() - t5,
            result: prose,
            attempts: proseResult.attempts,
            violationsRemaining: proseResult.finalViolations.length
          });
          await sleep(STAGGER_MS);
        }

        // ─── Step 12: layout.assemble (pure) ──────────────────
        // The moment the plan preview becomes a real StudioLayoutJson.
        // Home page assembles from sectionPicks + prose; StudioLiveShell
        // renders this same shape for the published profile.
        emit({ type: "step-start", step: 12, id: "layout.assemble", kind: "pure" });
        const t12 = Date.now();
        const journeyPageIds = journey?.journey.pageSet
          .filter((p) => p.required)
          .map((p) => p.id) ?? [];
        const assembledLayouts = assemblePipelineLayouts({
          merchantName:
            (discovery as { merchantName?: string | null } | null)?.merchantName ??
            "Your Business",
          tradeSlug,
          sectionPicks,
          prose,
          pageIds: journeyPageIds
        });
        const assembledPageCount = Object.keys(assembledLayouts).length;
        emit({
          type: "step-done",
          step: 12,
          id: "layout.assemble",
          ok: assembledPageCount > 0,
          ms: Date.now() - t12,
          result: {
            pagesAssembled: Object.keys(assembledLayouts),
            homeSectionCount: assembledLayouts.home?.sections.length ?? 0,
            totalPages: assembledPageCount
          }
        });
        await sleep(STAGGER_MS);

        // ─── Final assembly ───────────────────────────────────
        const review = journey
          ? buildReviewPlan(journey.journey, {
              isMerchantFacing: journey.journey.category !== "directory-first"
            })
          : null;

        emit({
          type: "final",
          pipeline: {
            brand: { id: session.brand.id },
            steps: [
              { step: 1, id: "business.discover", kind: "llm", ok: Boolean(tradeSlug), ms: 0 },
              { step: 2, id: "prompt.extract-intent", kind: "llm", ok: intent.confidence > 0, ms: 0 },
              { step: 3, id: "journey.selectFor", kind: "pure", ok: Boolean(journey), ms: 0 },
              { step: 4, id: "layoutRegistry.rank", kind: "pure", ok: Boolean(layoutTop), ms: 0 },
              { step: 5, id: "container.plan", kind: "pure", ok: containerPlan.length > 0, ms: 0 },
              { step: 6, id: "navigation.select", kind: "pure", ok: Boolean(navPick), ms: 0 },
              { step: 7, id: "section.select", kind: "pure", ok: sectionPicks.some((p) => p.sectionId !== null), ms: 0 },
              { step: 8, id: "app.recommend", kind: "pure", ok: appRecs.length > 0, ms: 0 },
              { step: 9, id: "theme.select", kind: "pure", ok: Boolean(themeSlug), ms: 0 },
              { step: 10, id: "tokens.select", kind: "pure", ok: tokenSet !== null, ms: 0 },
              { step: 11, id: "prose.bespoke", kind: "llm", ok: prose !== null, ms: 0 },
              { step: 12, id: "layout.assemble", kind: "pure", ok: Boolean(assembledLayouts.home), ms: 0 }
            ],
            usage: totalUsage,
            discovery,
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
            containerPlan,
            navigation: navPick,
            sectionPicks,
            apps: appRecs,
            theme: themeSlug ? themeRegistry.get(themeSlug) : null,
            tokens: tokenSet,
            review,
            prose,
            assembledLayouts
          }
        });
        controller.close();
      } catch (e) {
        emit({ type: "error", error: "pipeline-crash", detail: (e as Error).message });
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no"
    }
  });
}
