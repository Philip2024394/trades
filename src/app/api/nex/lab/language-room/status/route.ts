// src/app/api/nex/lab/language-room/status/route.ts
//
// NEX1 · LANGUAGE BRAIN · LAB STATUS ENDPOINT.
//
// Founder directive 2026-09-12: "The Lab must have a Language Room
// displaying 24/7." This endpoint recomputes the language-brain scorecard
// on demand from live registry + challenge sets + regression pool, and
// returns the exact state the CLI dashboard produces. Deterministic ·
// no LLM · no network. Cheap enough to poll every 10s.
//
// Every reply carries provenance so the UI can honestly present
// coverage (public/hidden/adversarial/regression) and benchmark
// maturity — never conflating "100% on a pilot floor" with "fluent".

import { NextResponse } from "next/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { processLanguageInput } from "@/lib/nex-language-brain/intent-bridge-v0";
import { scoreCase } from "@/lib/nex-language-brain/capability-rubric";
import {
  classifyLevel,
  classifyMaturity,
  benchmarkComplete,
  tagsToDimensions,
  tagsToLanguage,
} from "@/lib/nex-language-brain/language-scorecard";
import type { Nex1LanguageId } from "@/lib/nex-language-brain/language-scorecard";
import { scoreAmbiguitySubMetrics, aggregateAmbiguity } from "@/lib/nex-language-brain/ambiguity-sub-metrics";
import { regressionPoolClean, regressionToRubricCase } from "@/lib/nex-language-brain/regression-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CoverageBlock {
  public: number;
  hidden: number;
  adversarial: number;
  regression: number;
  total: number;
}
interface DimensionEntry {
  dimension: string;
  points: number;
  max_points: number;
  percent: number;
  case_count: number;
}
interface SectionEntry {
  language: Nex1LanguageId;
  overall_percent: number;
  case_count: number;
  level: string;
  benchmark_complete: boolean;
  benchmark_maturity: string;
  coverage: CoverageBlock;
  dimensions: DimensionEntry[];
  weak_dimensions: string[];
}
interface LanguageRoomStatus {
  at: string;
  registry_version: string;
  regression_pool_size: number;
  regression_clean: boolean;
  regression_failed_ids: string[];
  hidden_included: boolean;
  external_llm_used: false;
  independent_authorship_percent: 0;
  sections: SectionEntry[];
}

function loadRegistry() {
  const p = resolve(process.cwd(), "data/nex1-language-brain/pattern-registry-v0.json");
  return JSON.parse(readFileSync(p, "utf8"));
}
function loadChallenges() {
  const dir = resolve(process.cwd(), "data/nex1-language-brain/challenge-set-v0");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const publicCases: any[] = [];
  const hiddenCases: any[] = [];
  for (const f of files) {
    const doc = JSON.parse(readFileSync(join(dir, f), "utf8"));
    for (const c of doc.cases ?? doc.entries ?? []) {
      if (c.hidden === true || (c.tags && c.tags.includes("hidden"))) hiddenCases.push(c);
      else publicCases.push(c);
    }
  }
  return { publicCases, hiddenCases };
}
function loadRegression() {
  const p = resolve(process.cwd(), "data/nex1-language-brain/regression/regression-index.json");
  if (!existsSync(p)) return [];
  const doc = JSON.parse(readFileSync(p, "utf8"));
  return (doc.entries ?? []).map(regressionToRubricCase);
}

function scoreCasesForLang(
  scored: readonly any[],
  lang: Nex1LanguageId,
): SectionEntry {
  const casesForLang = scored.filter((cr) => tagsToLanguage(cr.tags) === lang);
  const dimBuckets: Record<string, { total: number; max: number; case_count: number }> = {};
  for (const cr of casesForLang) {
    for (const d of tagsToDimensions(cr.tags)) {
      if (!dimBuckets[d]) dimBuckets[d] = { total: 0, max: 0, case_count: 0 };
      dimBuckets[d].total += cr.case_score;
      dimBuckets[d].max += 5;
      dimBuckets[d].case_count += 1;
    }
  }
  const ambCases = casesForLang.map((cr) => cr.ambiguity_sub_metrics);
  const ambAgg = aggregateAmbiguity(ambCases);
  if (ambAgg.applicable_case_count > 0) {
    dimBuckets["ambiguity"] = {
      total: Math.round(ambAgg.composite_percent),
      max: 100,
      case_count: ambAgg.applicable_case_count,
    };
  }
  const dimensions: DimensionEntry[] = Object.entries(dimBuckets).map(([dimension, b]) => ({
    dimension,
    points: b.total,
    max_points: b.max,
    percent: b.max === 0 ? 0 : (b.total / b.max) * 100,
    case_count: b.case_count,
  }));
  const overallPoints = casesForLang.reduce((acc, cr) => acc + cr.case_score, 0);
  const overallMax = casesForLang.length * 5;
  const overallPercent = overallMax === 0 ? 0 : (overallPoints / overallMax) * 100;
  const hiddenForLang = casesForLang.some((cr) => cr.provenance === "hidden");
  const advForLang = casesForLang.some((cr) => cr.tags.includes("adversarial"));
  const regForLang = casesForLang.some((cr) => cr.provenance === "regression");
  const bcomplete = benchmarkComplete(hiddenForLang, advForLang, regForLang, dimensions.map((d) => ({
    dimension: d.dimension as any,
    points: d.points,
    max_points: d.max_points,
    percent: d.percent,
    case_count: d.case_count,
  })));
  const coverage: CoverageBlock = {
    public: casesForLang.filter((cr) => cr.provenance === "public" && !cr.tags.includes("adversarial")).length,
    hidden: casesForLang.filter((cr) => cr.provenance === "hidden").length,
    adversarial: casesForLang.filter((cr) => cr.tags.includes("adversarial")).length,
    regression: casesForLang.filter((cr) => cr.provenance === "regression").length,
    total: casesForLang.length,
  };
  const maturity = classifyMaturity(coverage);
  const level = classifyLevel(overallPercent, bcomplete, maturity);
  const weak = dimensions.filter((d) => d.percent < 60 && d.case_count > 0).map((d) => d.dimension);
  return {
    language: lang,
    overall_percent: overallPercent,
    case_count: casesForLang.length,
    level,
    benchmark_complete: bcomplete,
    benchmark_maturity: maturity,
    coverage,
    dimensions: dimensions.sort((a, b) => b.percent - a.percent),
    weak_dimensions: weak,
  };
}

export async function GET(): Promise<NextResponse<LanguageRoomStatus>> {
  const registry = loadRegistry();
  const { publicCases, hiddenCases } = loadChallenges();
  const regressionCases = loadRegression();

  const runOne = (tc: any, provenance: "public" | "hidden" | "regression") => {
    const observed = processLanguageInput(
      { utterance: tc.utterance, language_hint: tc.language_hint, prior_context: tc.prior_context },
      { registry },
    );
    const cr = scoreCase(tc, observed);
    const expectedIsRefusal = tc.expected.kind === "refuse";
    const ambSub = scoreAmbiguitySubMetrics(tc.tags ?? [], observed, expectedIsRefusal);
    return { ...cr, tags: tc.tags ?? [], ambiguity_sub_metrics: ambSub, provenance };
  };

  const scored = [
    ...regressionCases.map((tc: any) => runOne(tc, "regression")),
    ...publicCases.map((tc) => runOne(tc, "public")),
    ...hiddenCases.map((tc) => runOne(tc, "hidden")),
  ];

  const regressionCheck = regressionPoolClean(scored as any);

  const languages: Nex1LanguageId[] = ["english", "bahasa_indonesia", "code_switch", "programming"];
  const sections = languages.map((l) => scoreCasesForLang(scored, l));

  const payload: LanguageRoomStatus = {
    at: new Date().toISOString(),
    registry_version: registry.version,
    regression_pool_size: regressionCases.length,
    regression_clean: regressionCheck.clean,
    regression_failed_ids: regressionCheck.failed_ids,
    hidden_included: hiddenCases.length > 0,
    external_llm_used: false,
    independent_authorship_percent: 0,
    sections,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
