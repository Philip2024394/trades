// GET /api/nex/code-intelligence/benchmark
// Runs the Code Intelligence benchmark + adversarial cases.
// SEPARATE evidence track from Engineering Brain ladder (CI-1).

import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { detectFile } from "@/lib/nex-code-intelligence/file-detector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BenchCase { id: string; path: string; content: string; expected_language: string; expected_confidence?: string; notes?: string; }
interface AdvCase { id: string; path: string; content: string; expected_language: string; note?: string; }

export async function GET(): Promise<NextResponse> {
  const p = resolve(process.cwd(), "data/nex1-code-intelligence/benchmark-v0.1.0.json");
  const doc = JSON.parse(readFileSync(p, "utf8"));

  const per_case: any[] = [];
  let pass = 0, fail = 0;
  for (const c of doc.cases as BenchCase[]) {
    const fi = detectFile({ path: c.path, content: c.content });
    const ok = matches(fi.language.detected_value ?? "", c.expected_language) && confidenceOK(fi.language.confidence, c.expected_confidence);
    if (ok) pass++; else fail++;
    per_case.push({ id: c.id, path: c.path, expected: c.expected_language, expected_confidence: c.expected_confidence, observed: fi.language.detected_value, observed_confidence: fi.language.confidence, ok, candidates: fi.language.candidates, notes: c.notes });
  }

  const adv_case: any[] = [];
  let adv_pass = 0, adv_fail = 0;
  for (const c of doc.adversarial_cases as AdvCase[]) {
    const fi = detectFile({ path: c.path, content: c.content });
    const observed = fi.language.detected_value ?? "";
    const observed_conf = fi.language.confidence;
    let ok = false;
    if (c.expected_language === "unresolved_or_ambiguous") {
      ok = observed_conf === "unresolved" || observed_conf === "ambiguous";
    } else if (c.expected_language.endsWith("_or_ambiguous")) {
      const preferred = c.expected_language.replace(/_or_ambiguous$/, "");
      ok = observed_conf === "ambiguous" || matches(observed, preferred);
    } else {
      ok = matches(observed, c.expected_language);
    }
    if (ok) adv_pass++; else adv_fail++;
    adv_case.push({ id: c.id, path: c.path, expected: c.expected_language, observed, observed_confidence: observed_conf, ok, candidates: fi.language.candidates, note: c.note });
  }

  return NextResponse.json({
    version: doc.version,
    total_cases: doc.cases.length,
    pass, fail,
    adversarial_total: doc.adversarial_cases.length,
    adversarial_pass: adv_pass,
    adversarial_fail: adv_fail,
    per_case, adversarial_cases: adv_case,
    attribution: { external_llm_used: false, deterministic: true, taught_by: "master_ai_engineer" },
    ci_track: "separate_from_engineering_brain_ladder · CI-1",
    at: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

function matches(observed: string, expected: string): boolean {
  if (observed === expected) return true;
  // Accept overlapping IDs (e.g. bash vs shell)
  if (expected === "shell" && observed === "bash") return true;
  if (expected === "javascript" && observed === "typescript") return false;
  if (expected === "makefile"   && observed === "makefile") return true;
  if (expected === "dockerfile" && observed === "dockerfile") return true;
  return false;
}
function confidenceOK(observed: string, expected?: string): boolean {
  if (!expected) return true;
  if (expected === "medium_or_high") return observed === "medium" || observed === "high";
  return observed === expected;
}
