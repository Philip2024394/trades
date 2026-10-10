// NEX1 · Ranking-Generalisation · Methods / Arrows / Multi-line Probe
// Founder-authorised diagnostic ONLY · 2026-09-19
//
// EMPIRICAL SCOPE OF THIS EXPERIMENT (source-verified via
// scripts/nex1-stage1-diagnostic/enumerate-rare-forms.mjs):
//   · multi-line exports · 0 real cases in src/lib/nex-agent · NOT TESTABLE
//   · arrow-const-exports · 3 real cases but all IIFE-style already
//     matched by S-C's `const` alternative · NOT DISTINCT
//   · class methods · 19 real cases across 2 files · TESTABLE
//
// The probe therefore focuses on class methods · the actual gap.
// Zero production modification.

import { describe, it, expect } from "vitest";
import { discoverRepositoryCandidates } from "@/lib/nex-agent/code-engine/capability-repository-discovery";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();

interface MethodTarget {
  id: string;
  name: string;
  expected_file: string;
  class_name: string;
}

// 8 known-answer cases · verified via source grep · line numbers checked
const METHOD_TARGETS: readonly MethodTarget[] = [
  { id: "M1", name: "interpretTask",     expected_file: "src/lib/nex-agent/code-engine/nex1-decision-trail.ts", class_name: "Nex1DecisionTrailBuilder" },
  { id: "M2", name: "composeContext",    expected_file: "src/lib/nex-agent/code-engine/nex1-decision-trail.ts", class_name: "Nex1DecisionTrailBuilder" },
  { id: "M3", name: "acceptCandidate",   expected_file: "src/lib/nex-agent/code-engine/nex1-decision-trail.ts", class_name: "Nex1DecisionTrailBuilder" },
  { id: "M4", name: "evaluateDiff",      expected_file: "src/lib/nex-agent/code-engine/nex1-decision-trail.ts", class_name: "Nex1DecisionTrailBuilder" },
  { id: "M5", name: "recordDiagnosis",   expected_file: "src/lib/nex-agent/code-engine/nex1-decision-trail.ts", class_name: "Nex1DecisionTrailBuilder" },
  { id: "M6", name: "chooseFor",         expected_file: "src/lib/nex-agent/code-engine/registry.ts", class_name: "Nex1ReasoningRegistry" },
  { id: "M7", name: "recordEvidence",    expected_file: "src/lib/nex-agent/code-engine/nex1-decision-trail.ts", class_name: "Nex1DecisionTrailBuilder" },
  // ADVERSARIAL common-name method · appears in many contexts across the codebase
  { id: "M8", name: "register",          expected_file: "src/lib/nex-agent/code-engine/registry.ts", class_name: "Nex1ReasoningRegistry" },
];

// ── Signals · same as prior + one new · pure functions · read-only ────

function signalC_hasExportDeclaration(candPath: string, sym: string): number {
  const abs = path.join(REPO_ROOT, candPath);
  let content: string;
  try { content = fs.readFileSync(abs, "utf8"); } catch { return 0; }
  const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(
    `^\\s*export\\s+(?:async\\s+)?(?:function|const|let|var|interface|type|class|enum)\\s+${escaped}\\b`,
    "m",
  );
  return rx.test(content) ? 1 : 0;
}

function signalC_prime_hasAnyDeclaration(candPath: string, sym: string): number {
  const abs = path.join(REPO_ROOT, candPath);
  let content: string;
  try { content = fs.readFileSync(abs, "utf8"); } catch { return 0; }
  const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(
    `^\\s*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|var|interface|type|class|enum)\\s+${escaped}\\b`,
    "m",
  );
  return rx.test(content) ? 1 : 0;
}

// NEW · Signal-M · class method pattern · indented line · optional modifiers · symbol + opening paren
// Only fires when file also contains an exported class declaration.
function signalM_isClassMethod(candPath: string, sym: string): number {
  const abs = path.join(REPO_ROOT, candPath);
  let content: string;
  try { content = fs.readFileSync(abs, "utf8"); } catch { return 0; }
  // Require the file to actually define a class · otherwise a plain function
  // inside a function scope with the same name would incorrectly match
  if (!/^\s*export\s+(?:abstract\s+)?class\s+\w+/m.test(content)) return 0;
  const escaped = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rx = new RegExp(
    `^\\s{2,}(?:(?:public|private|protected|static|async|readonly)\\s+)*${escaped}\\s*(?:<[^>]+>)?\\s*\\(`,
    "m",
  );
  return rx.test(content) ? 1 : 0;
}

interface Policy {
  id: string;
  desc: string;
  score: (cand: { path: string; score: number }, sym: string) => number;
}

const POLICIES: readonly Policy[] = [
  { id: "BASE", desc: "Existing V1", score: (c) => c.score },
  { id: "P5-C", desc: "S-C alone (exported declarations only)", score: (c, s) => signalC_hasExportDeclaration(c.path, s) },
  { id: "P8-C-prime", desc: "S-C' allowing non-export", score: (c, s) => signalC_prime_hasAnyDeclaration(c.path, s) },
  { id: "P11-M", desc: "S-M · class method signal ONLY", score: (c, s) => signalM_isClassMethod(c.path, s) },
  { id: "P12-C-or-M", desc: "S-C ∨ S-M (declaration OR class method)", score: (c, s) => Math.max(signalC_hasExportDeclaration(c.path, s), signalM_isClassMethod(c.path, s)) },
  { id: "P13-C-prime-or-M", desc: "S-C' ∨ S-M (any-declaration OR class method)", score: (c, s) => Math.max(signalC_prime_hasAnyDeclaration(c.path, s), signalM_isClassMethod(c.path, s)) },
];

interface ResultRow {
  id: string;
  name: string;
  expected_file: string;
  class_name: string;
  reached: boolean;
  candidate_count: number;
  base_rank: number | null;
  base_top1: string | null;
  results_by_policy: Record<string, { rank: number | null; top1: string | null; top1_is_target: boolean; false_positive_count: number }>;
}

describe("NEX1 · Ranking-Methods-Arrows-Multiline Probe", () => {
  it(
    "8 class-method cases + false-positive check · report S-M boundary",
    () => {
      const outDir = path.join(REPO_ROOT, "data/nex1-stage1-diagnostic");
      fs.mkdirSync(outDir, { recursive: true });
      const rows: ResultRow[] = [];

      for (const t of METHOD_TARGETS) {
        const r = discoverRepositoryCandidates({
          concepts: [t.name.toLowerCase()],
          repo_root: REPO_ROOT,
          allowed_root_prefixes: ["src/lib/nex-agent"],
          max_files_scanned: 500,
          max_candidates: 50,
        });
        const cands = r.candidates.map((c) => ({
          path: c.repo_relative_path.replace(/\\/g, "/"),
          score: c.match_score,
        }));
        const baseIdx = cands.findIndex((c) => c.path === t.expected_file);

        const perPolicy: ResultRow["results_by_policy"] = {};
        for (const pol of POLICIES) {
          const scored = cands
            .map((c) => ({ path: c.path, s: pol.score(c, t.name) }))
            .sort((a, b) => (b.s - a.s) || a.path.localeCompare(b.path));
          const rank = scored.findIndex((s) => s.path === t.expected_file);
          const top1 = scored[0]?.path ?? null;
          // False-positive count · files where signal fires but they are neither
          // the expected file nor a legitimate co-declaration.
          // For this analysis: count files where signal > 0 (matched) minus the expected.
          const positives = scored.filter((s) => s.s > 0).length;
          perPolicy[pol.id] = {
            rank: rank >= 0 ? rank : null,
            top1,
            top1_is_target: top1 === t.expected_file,
            false_positive_count: positives - (scored.find((s) => s.path === t.expected_file && s.s > 0) ? 1 : 0),
          };
        }

        rows.push({
          id: t.id,
          name: t.name,
          expected_file: t.expected_file,
          class_name: t.class_name,
          reached: cands.some((c) => c.path === t.expected_file),
          candidate_count: cands.length,
          base_rank: baseIdx >= 0 ? baseIdx : null,
          base_top1: cands[0]?.path ?? null,
          results_by_policy: perPolicy,
        });

        console.log(
          `[${t.id}] ${t.name.padEnd(20)} in ${t.class_name.padEnd(28)} reached=${cands.some((c) => c.path === t.expected_file) ? "✓" : "✗"} · BASE-rank=${baseIdx >= 0 ? baseIdx : "n/a"} · P5-C=${perPolicy["P5-C"].top1_is_target ? "✓" : "✗"} · P11-M=${perPolicy["P11-M"].top1_is_target ? "✓" : "✗"} · P12-C∨M=${perPolicy["P12-C-or-M"].top1_is_target ? "✓" : "✗"}`,
        );
      }

      const summary: Record<string, { correct: number; total_fp: number }> = {};
      for (const pol of POLICIES) {
        summary[pol.id] = {
          correct: rows.filter((r) => r.results_by_policy[pol.id].top1_is_target).length,
          total_fp: rows.reduce((a, r) => a + r.results_by_policy[pol.id].false_positive_count, 0),
        };
      }

      console.log();
      console.log("Aggregate over 8 class-method cases:");
      for (const pol of POLICIES) {
        const s = summary[pol.id];
        console.log(
          `  ${pol.id.padEnd(20)} · ${s.correct}/8 correct top-1 · total_false_positives=${s.total_fp} · "${pol.desc}"`,
        );
      }

      const sig = createHash("sha256")
        .update(JSON.stringify(rows.map((r) => ({ id: r.id, base_top1: r.base_top1, p: r.results_by_policy }))))
        .digest("hex")
        .slice(0, 16);
      console.log(`\n[DETERMINISM] signature = ${sig}`);

      fs.writeFileSync(
        path.join(outDir, "ranking-methods-probe.json"),
        JSON.stringify(
          {
            experiment: "Ranking-Methods-Arrows-Multiline-Probe",
            empirical_findings: {
              multiline_exports_in_scope: 0,
              arrow_const_exports_in_scope: 3,
              arrow_const_all_iife_covered_by_S_C: true,
              class_methods_in_scope: 19,
              tested_class_methods: METHOD_TARGETS.length,
            },
            policies: POLICIES.map((p) => ({ id: p.id, desc: p.desc })),
            summary,
            rows,
            determinism_signature: sig,
          },
          null,
          2,
        ),
      );

      expect(rows.length).toBe(METHOD_TARGETS.length);
    },
    120000,
  );
});
