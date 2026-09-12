// src/lib/nex/research-brain/index.ts
//
// Founder Path A · Phase A2 · Research Brain facade.
//
// The Deep-Research loop, convergent across OpenAI · Gemini · Perplexity:
//   plan → search → parse → cross-check → cite → synthesise
//
// All 4 Doctrines preserved:
//   #1  Every CitedClaim passes Fabrication Gate v2 alignment scoring
//       before entering the report · orphan or postrationalised claims
//       are silently dropped from the report.
//   #2  Research Brain proposes ACTIONS ONLY via the Action Brain
//       (this facade never executes side-effects).
//   #3  Web-derived evidence is capped at evidence_provisional in
//       reportToEvidenceItems() (mirrors vision + file precedent).
//   #4  User memory NEVER seeds a research claim · this module has no
//       memory access surface.
//
// Env flags:
//   NEX_RESEARCH_BRAIN=off       → returns null from makeDefaultResearchBrain
//   NEX_RESEARCH_MAX_SPANS       → per-report span cap (default 24)

import type { Pool } from "pg";
import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";
import { makeDefaultWebProvider } from "@/lib/nex/live-chat-completion/web-acquisition";
import type { WebProvider } from "@/lib/nex/live-chat-completion/web-acquisition/contract";
import type {
  ResearchBrainFacade, ResearchObjective, CitedReport, EvidenceSpan,
} from "./contract";
import { ResearchObjectiveSchema } from "./contract";
import type { EvidenceItem } from "@/lib/nex/live-chat-completion/llm-rescue/contract";
import { planResearch } from "./plan-worker";
import { searchStep } from "./search-worker";
import { extractSpans } from "./page-worker";
import { crossCheckSpans } from "./cross-check-worker";
import { synthesiseReport } from "./synthesis-worker";

export interface ResearchBrainOptions {
  kfPool?: Pool;
  webProvider?: WebProvider | null;
  max_spans?: number;
}

export function makeResearchBrain(opts: ResearchBrainOptions = {}): ResearchBrainFacade {
  const kfPool = opts.kfPool ?? getKnowledgeFactoryDbPool();
  const webProvider = opts.webProvider ?? makeDefaultWebProvider();
  const maxSpans = opts.max_spans ?? clampInt(process.env.NEX_RESEARCH_MAX_SPANS, 24, 4, 64);

  return {
    name: "research-brain-v1",

    async research(rawObjective: ResearchObjective): Promise<CitedReport> {
      const objective = ResearchObjectiveSchema.parse(rawObjective);
      const loopStart = performance.now();
      const providerMeta: Record<string, unknown> = {};

      // ── 1. Plan ─────────────────────────────────────────────────
      const plan = planResearch(objective);
      providerMeta.plan_method = plan.method;
      providerMeta.plan_step_count = plan.steps.length;

      // Budget per step: split remaining time evenly across steps.
      const perStepBudgetMs = Math.max(
        1000,
        Math.floor((objective.budget_ms - plan.planner_ms) / Math.max(1, plan.steps.length)),
      );

      // ── 2. Search each step in parallel (bounded fan-out) ───────
      const allHits: Awaited<ReturnType<typeof searchStep>>[] = await Promise.all(
        plan.steps.map((step) =>
          searchStep({
            step, budget_ms: perStepBudgetMs, language: objective.language,
            kfPool, webProvider,
            domain_hint: objective.domain_hint, entity_hint: objective.entity_hint,
          }),
        ),
      );
      const searchMs = allHits.reduce((s, r) => s + r.stage_ms.local + r.stage_ms.web, 0);
      providerMeta.search_hits_per_step = allHits.map((h) => h.provider_meta);

      // ── 3. Parse hits into spans (bounded by maxSpans total) ────
      // RB-2 · extractSpans is now async (may fetch URLs). Sequential
      // per step to respect per-step budget; parallel would exceed the
      // per-URL budget cap noticeably on slow sources.
      const pageT0 = performance.now();
      const spans: EvidenceSpan[] = [];
      const fetchMeta: Array<{ step_id: string; attempted: number; ok: number; failed: number; total_bytes: number; total_fetch_ms: number }> = [];
      const perStepSpanLimit = Math.max(2, Math.floor(maxSpans / Math.max(1, allHits.length)));
      for (const stepResult of allHits) {
        if (spans.length >= maxSpans) break;
        const out = await extractSpans({
          plan_id: plan.plan_id, step_id: stepResult.step_id,
          hits: stepResult.hits, limit: perStepSpanLimit,
        });
        fetchMeta.push({ step_id: stepResult.step_id, ...out.fetch_meta });
        for (const s of out.spans) {
          if (spans.length >= maxSpans) break;
          spans.push(s);
        }
      }
      const pageMs = Math.round(performance.now() - pageT0);
      providerMeta.span_count = spans.length;
      providerMeta.fetch_meta_per_step = fetchMeta;

      // ── 4. Cross-check spans ────────────────────────────────────
      const cross = crossCheckSpans({ spans });
      providerMeta.cluster_count = cross.agreement_clusters.length;
      providerMeta.disagreement_count = cross.disagreements.length;

      // ── 5. Synthesise cited report ──────────────────────────────
      const report = synthesiseReport({
        objective, plan, spans, cross_check: cross,
        loop_ms_start: loopStart,
        stage_ms: { plan: plan.planner_ms, search: searchMs, page: pageMs, cross_check: cross.stage_ms },
        provider_meta: providerMeta,
      });

      return report;
    },

    reportToEvidenceItems(report: CitedReport): EvidenceItem[] {
      // Doctrine #3 extension: web evidence capped at 0.75 confidence
      // (same as vision + file precedent). source_type = web_search.
      const cited = new Set(report.claims.flatMap((c) => c.cites));
      const items: EvidenceItem[] = [];
      for (const span of report.spans) {
        if (!cited.has(span.ref_id)) continue;
        items.push({
          ref_id: span.ref_id,
          source_type: "web_search",
          entity_ref: null,
          intent_slug: null,
          text: span.text,
          confidence: Math.min(0.75, Math.max(0, span.authority)),
          verified_at: span.extracted_at,
          source_reference: span.source_url ?? `research_hit:${span.hit_id}`,
        });
      }
      return items;
    },
  };
}

/** Env-selected default. Returns null when NEX_RESEARCH_BRAIN=off. */
export function makeDefaultResearchBrain(): ResearchBrainFacade | null {
  const enabled = process.env.NEX_RESEARCH_BRAIN;
  if (enabled === "off" || enabled === "0" || enabled === "false") return null;
  return makeResearchBrain();
}

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = Number(raw ?? def);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(Math.floor(n), min), max);
}
