// src/lib/nex/research-brain/contract.ts
//
// Founder BEGIN Path A · Phase A2 · Research Brain contract.
//
// Ships the Deep-Research loop convergent across OpenAI, Gemini, and
// Perplexity Pro Search (documented in docs/research/nex_architecture_
// research_2026_09_09.md):
//
//   plan → search → browse/parse → cross-check → cite → synthesise
//
// Doctrine anchors (all four preserved):
//   #1  Every claim in a CitedReport carries source_ref + span_offset
//       and passes Fabrication Gate v2 alignment scoring.
//   #2  The Research Brain proposes actions only via the Action Brain
//       · never executes side-effects itself.
//   #3  Web-derived evidence is capped at evidence_provisional (same
//       precedent as vision + file · Phase 3.8 + 3.9).
//   #4  User memory shapes what topics the user cares about
//       (personalization signal) · never seeds a research claim as truth.
//
// Composition-first discipline: this brain only fires when the
// domain adapter honestly UNKNOWNs and lower-cost paths (deterministic
// composer · knowledge factory · web-acquisition rescue) haven't
// produced a verified answer.

import { z } from "zod";
import type { EvidenceItem } from "@/lib/nex/live-chat-completion/llm-rescue/contract";

// ═══════════════════════════════════════════════════════════════════
// Research objective + plan
// ═══════════════════════════════════════════════════════════════════

export const ResearchObjectiveSchema = z.object({
  objective: z.string().min(3).max(1000),
  language: z.enum(["en", "id"]).default("en"),
  domain_hint: z.string().max(60).optional(),
  entity_hint: z.string().max(200).optional(),
  /** Absolute wall-clock budget in ms for the entire loop. */
  budget_ms: z.number().int().min(500).max(120_000).default(20_000),
  /** How thorough: 1 = single-step lookup · 3 = light research · 5 = deep. */
  depth: z.number().int().min(1).max(5).default(2),
});
export type ResearchObjective = z.infer<typeof ResearchObjectiveSchema>;

export interface ResearchStep {
  step_id: string;                    // "s1", "s2", …
  question: string;                   // the sub-question to answer
  reason?: string;                    // why this step (observability)
  depends_on?: readonly string[];     // step_ids this depends on
}

export interface ResearchPlan {
  plan_id: string;                    // "plan_<hash>"
  objective: string;
  steps: readonly ResearchStep[];
  method: "deterministic" | "llm_fallback" | "single_step";
  planner_ms: number;
}

// ═══════════════════════════════════════════════════════════════════
// Search / page / evidence
// ═══════════════════════════════════════════════════════════════════

export interface SearchHit {
  hit_id: string;                     // stable id · used in ref_id chains
  step_id: string;
  source_kind: "local_kf" | "wikipedia" | "duckduckgo" | "web" | "domain_source";
  url?: string;
  title?: string;
  snippet: string;                    // short summary · used for ranking
  authority: number;                  // 0..1 · source-level authority score
  freshness_days?: number;            // days since publication (if known)
  raw?: unknown;                      // optional provider payload for parsing later
}

export interface ParsedPage {
  hit_id: string;
  mime_type?: string;
  text: string;                       // extracted textual content · bounded
  extracted_at: string;               // ISO
}

/**
 * EvidenceSpan · a specific portion of a parsed page that supports a
 * claim. Carries a byte-offset so the Fabrication Gate can bind claims
 * to specific spans (not merely to a URL).
 */
export interface EvidenceSpan {
  ref_id: string;                     // research:<plan_id>:<step>:<idx>
  hit_id: string;
  source_url?: string;
  text: string;                       // the actual span text · CLAIM MUST ALIGN TO THIS
  span_offset?: { start: number; end: number };
  authority: number;                  // 0..1 inherited from SearchHit
  freshness_days?: number;
  extracted_at: string;               // ISO
}

// ═══════════════════════════════════════════════════════════════════
// Cross-check
// ═══════════════════════════════════════════════════════════════════

export interface CrossCheckResult {
  /** Groups of spans that agree on the same claim (by lexical overlap). */
  agreement_clusters: readonly {
    cluster_id: string;
    span_ref_ids: readonly string[];
    representative_text: string;
  }[];
  /** Pairs of spans that appear to disagree. Surfaced, not suppressed. */
  disagreements: readonly {
    a_ref_id: string;
    b_ref_id: string;
    reason: string;
  }[];
}

// ═══════════════════════════════════════════════════════════════════
// Cited report (the Research Brain's output)
// ═══════════════════════════════════════════════════════════════════

export interface CitedClaim {
  /** The claim text as it will appear in the report. */
  text: string;
  /** Which EvidenceSpan(s) support this claim. Every claim MUST have ≥1. */
  cites: readonly string[];           // EvidenceSpan.ref_id values
  /** Alignment score (Gate v2) between claim text and best supporting span. */
  alignment_score: number;
  /** evidence_provisional CEILING · web claims never elevate to canonical_verified. */
  trust: "unknown" | "evidence_provisional";
}

export interface CitedReport {
  report_id: string;
  objective: string;
  plan_id: string;
  answered: boolean;                  // false = honest UNKNOWN after research
  headline: string;                   // one-sentence answer for surfacing
  claims: readonly CitedClaim[];
  spans: readonly EvidenceSpan[];     // the corpus the report is grounded in
  disagreements: readonly CrossCheckResult["disagreements"][number][];
  /** Reason when answered=false. */
  unverified_reason?: string;
  /** Wall-clock latency for the whole loop. */
  latency_ms: number;
  /** Stage-by-stage timing. */
  stage_ms: {
    plan?: number;
    search?: number;
    page?: number;
    cross_check?: number;
    synthesis?: number;
  };
  /** Provider meta per stage (models used, tokens if known). */
  provider_meta: Readonly<Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════════
// Facade
// ═══════════════════════════════════════════════════════════════════

export interface ResearchBrainFacade {
  name: string;
  /** Runs the full plan → search → parse → cross-check → cite → synthesise loop. */
  research(objective: ResearchObjective): Promise<CitedReport>;
  /**
   * Convenience: convert a CitedReport into EvidenceItem[] that can be
   * merged into a RetrievalBundle for a downstream LLM rescue call.
   * All items are source_type="web_search" with confidence capped at 0.75.
   */
  reportToEvidenceItems(report: CitedReport): EvidenceItem[];
}

// ═══════════════════════════════════════════════════════════════════
// Deterministic ref_id helpers
// ═══════════════════════════════════════════════════════════════════

export function makePlanId(objective: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return "plan_" + createHash("sha256").update(objective).digest("hex").slice(0, 12);
}

export function makeSpanRefId(plan_id: string, step_id: string, idx: number): string {
  return `research:${plan_id}:${step_id}:${idx}`;
}

export function makeReportId(plan_id: string): string {
  return "report_" + plan_id.replace(/^plan_/, "");
}
