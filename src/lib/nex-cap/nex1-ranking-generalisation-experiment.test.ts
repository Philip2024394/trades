// NEX1 · Ranking-Generalisation Experiment · 2026-09-19
// Founder-authorised diagnostic ONLY · zero production modification.
//
// PURPOSE
//   Take 20 controlled TypeScript declarations across diverse kinds
//   (exported functions/interfaces/types/consts/classes, non-exported
//   functions). For each: run the existing scoped walker · apply the
//   same S-C re-scoring signal that achieved 4/4 on the prior 4 cases ·
//   check whether the target declaration file becomes top-1.
//
// FALSIFICATION
//   If S-C achieves 20/20 (or 4/4 within each kind), signal generalises
//   within TypeScript. If any case fails, we discover WHERE the signal's
//   boundary is, and that becomes evidence of insufficiency.

import { describe, it, expect } from "vitest";
import { discoverRepositoryCandidates } from "@/lib/nex-agent/code-engine/capability-repository-discovery";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const REPO_ROOT = process.cwd();
const SAMPLE_PATH = path.join(REPO_ROOT, "data/nex1-stage1-diagnostic/generalisation-sample.json");

interface Target {
  file: string;
  kind: string;
  name: string;
  exported: boolean;
  total_occurrences: number;
}

const SAMPLE = JSON.parse(fs.readFileSync(SAMPLE_PATH, "utf8"));
const TARGETS: readonly Target[] = SAMPLE.sample;

// ── Signals · pure functions · same as prior experiment ─────────────────

function tokenizeBasename(filename: string): string[] {
  const base = filename.replace(/\.[^.]+$/, "");
  return base.split(/[-_.]/).flatMap((p) => p.split(/(?=[A-Z])/)).map((t) => t.toLowerCase()).filter(Boolean);
}
function tokenizeSymbol(symbol: string): string[] {
  return symbol.split(/(?=[A-Z])/).map((t) => t.toLowerCase()).filter(Boolean);
}
function signalA_filenameOverlap(p: string, sym: string): number {
  const fnT = new Set(tokenizeBasename(path.basename(p)));
  const symT = tokenizeSymbol(sym);
  if (symT.length === 0) return 0;
  let hits = 0;
  for (const t of symT) if (fnT.has(t)) hits++;
  return hits / symT.length;
}
function signalB_isTestFile(p: string): number {
  return /\.(test|spec)\.[tj]sx?$/.test(p) ? 1 : 0;
}
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
// New for private declarations: match declaration WITHOUT export
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

// ── Rescoring policies ──────────────────────────────────────────────────

interface Policy {
  id: string;
  desc: string;
  score: (cand: { path: string; score: number }, sym: string) => number;
}

const POLICIES: readonly Policy[] = [
  { id: "BASE", desc: "Existing V1 · 2*fn_matches + content_matches (from walker)", score: (c) => c.score },
  { id: "P5-C", desc: "S-C alone (has export declaration)", score: (c, s) => signalC_hasExportDeclaration(c.path, s) },
  { id: "P7-C+A", desc: "10·S-C + 3·S-A (declaration + filename tiebreak)", score: (c, s) => 10 * signalC_hasExportDeclaration(c.path, s) + 3 * signalA_filenameOverlap(c.path, s) },
  { id: "P8-C-prime", desc: "S-C' allowing non-exported declarations", score: (c, s) => signalC_prime_hasAnyDeclaration(c.path, s) },
  { id: "P9-C-prime+A", desc: "10·S-C' + 3·S-A (any-declaration + filename tiebreak)", score: (c, s) => 10 * signalC_prime_hasAnyDeclaration(c.path, s) + 3 * signalA_filenameOverlap(c.path, s) },
  { id: "P10-C-prime-B", desc: "S-C' − S-B (any-declaration minus test-file penalty)", score: (c, s) => signalC_prime_hasAnyDeclaration(c.path, s) - signalB_isTestFile(c.path) },
];

interface ResultRow {
  idx: number;
  name: string;
  kind: string;
  exported: boolean;
  expected_file: string;
  files_scanned: number;
  target_reached: boolean;
  candidate_count: number;
  base_target_rank: number | null;
  base_top1: string | null;
  results_by_policy: Record<string, { target_rank: number | null; top1: string | null; top1_is_target: boolean }>;
}

describe("NEX1 · Ranking-Generalisation · 20 diverse TS declarations · scoped walker + S-C rescoring", () => {
  it(
    "run all 20 · report per-kind discrimination · byte-identical determinism",
    () => {
      const rows: ResultRow[] = [];
      const outDir = path.join(REPO_ROOT, "data/nex1-stage1-diagnostic");
      fs.mkdirSync(outDir, { recursive: true });

      TARGETS.forEach((t, idx) => {
        const token = t.name.toLowerCase();
        const r = discoverRepositoryCandidates({
          concepts: [token],
          repo_root: REPO_ROOT,
          allowed_root_prefixes: ["src/lib/nex-agent"],
          max_files_scanned: 500,
          max_candidates: 50,
        });

        const cands = r.candidates.map((c) => ({
          path: c.repo_relative_path.replace(/\\/g, "/"),
          score: c.match_score,
        }));
        const expected = t.file;
        const targetIdxBase = cands.findIndex((c) => c.path === expected);

        const perPolicy: ResultRow["results_by_policy"] = {};
        for (const pol of POLICIES) {
          const scored = cands
            .map((c) => ({ path: c.path, s: pol.score(c, t.name) }))
            .sort((a, b) => (b.s - a.s) || a.path.localeCompare(b.path));
          const rank = scored.findIndex((s) => s.path === expected);
          const top1 = scored[0]?.path ?? null;
          perPolicy[pol.id] = {
            target_rank: rank >= 0 ? rank : null,
            top1,
            top1_is_target: top1 === expected,
          };
        }

        rows.push({
          idx,
          name: t.name,
          kind: t.exported ? t.kind : `${t.kind}(private)`,
          exported: t.exported,
          expected_file: expected,
          files_scanned: r.stats.files_scanned,
          target_reached: cands.some((c) => c.path === expected),
          candidate_count: cands.length,
          base_target_rank: targetIdxBase >= 0 ? targetIdxBase : null,
          base_top1: cands[0]?.path ?? null,
          results_by_policy: perPolicy,
        });

        const p5 = perPolicy["P5-C"].top1_is_target ? "✓" : "✗";
        const p9 = perPolicy["P9-C-prime+A"].top1_is_target ? "✓" : "✗";
        console.log(
          `[${String(idx + 1).padStart(2, "0")}] ${t.exported ? "EX" : "PV"} ${t.kind.padEnd(10)} ${t.name.padEnd(40)} reached=${cands.some((c) => c.path === expected) ? "✓" : "✗"} · BASE-rank=${targetIdxBase >= 0 ? targetIdxBase : "n/a"} · P5=${p5} · P9=${p9}`,
        );
      });

      // Aggregate by policy
      const summary: Record<string, { correct: number; total: number; correct_exported: number; total_exported: number; correct_private: number; total_private: number }> = {};
      for (const pol of POLICIES) {
        const total = rows.length;
        const totalEx = rows.filter((r) => r.exported).length;
        const totalPv = rows.filter((r) => !r.exported).length;
        const correct = rows.filter((r) => r.results_by_policy[pol.id].top1_is_target).length;
        const correctEx = rows.filter((r) => r.exported && r.results_by_policy[pol.id].top1_is_target).length;
        const correctPv = rows.filter((r) => !r.exported && r.results_by_policy[pol.id].top1_is_target).length;
        summary[pol.id] = {
          correct, total,
          correct_exported: correctEx, total_exported: totalEx,
          correct_private: correctPv, total_private: totalPv,
        };
      }

      console.log();
      console.log("Aggregate by policy:");
      for (const pol of POLICIES) {
        const s = summary[pol.id];
        console.log(
          `  ${pol.id.padEnd(16)} · overall ${s.correct}/${s.total} · exported ${s.correct_exported}/${s.total_exported} · private ${s.correct_private}/${s.total_private} · "${pol.desc}"`,
        );
      }

      // Determinism sig
      const sig = JSON.stringify(rows.map((r) => ({ idx: r.idx, name: r.name, base_top1: r.base_top1, policies: r.results_by_policy })));
      const hash = createHash("sha256").update(sig).digest("hex").slice(0, 16);
      console.log(`\n[DETERMINISM] result signature = ${hash}`);

      fs.writeFileSync(
        path.join(outDir, "ranking-generalisation-experiment.json"),
        JSON.stringify(
          {
            experiment: "Ranking-Generalisation",
            sample_size: rows.length,
            policies: POLICIES.map((p) => ({ id: p.id, desc: p.desc })),
            summary,
            rows,
            determinism_signature_sha256_16: hash,
          },
          null,
          2,
        ),
      );

      expect(rows.length).toBe(20);
    },
    600000,
  );
});
