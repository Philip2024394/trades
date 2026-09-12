// src/lib/nex/master-ai/multi-domain-verifier.ts
//
// NEX Master AI · Phase 8 · Multi-domain intelligence verifier
// Philip 2026-09-08 · AUTHORIZE Phase 8
//
// Runs improvement cycles across MULTIPLE domains and PROVES no
// cross-contamination between them. Reuses:
//   · Y-W5-1-b ab-harness (env-var isolated knowledge stores)
//   · Y-W5-1-a network-resilience corpus (network domain)
//   · Phase 2 skill corpus + skill candidate (security.input_validation domain)
//   · Phase 4 speaking corpus + taught knowledge (speaking.life_safety domain)
//
// A cross-contamination pair is: inject domain A's candidate into an
// isolated store, run domain B's benchmark against that store, and
// verify the result is IDENTICAL to the pure-BEFORE baseline (no delta).
// If any pair produces a non-zero delta, the domain-relevance gates
// are broken.

import { mkdtempSync, writeFileSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { evaluateCorpus } from "@/lib/nex/programmer-benchmark/evaluator";
import type { BenchmarkCorpus } from "@/lib/nex/programmer-benchmark/types";
import type { KnowledgeItem, SkillItem } from "@/lib/nex/programmer-learning/types";

export type DomainInjection = {
  domain_label: string;                 // human-readable domain name
  knowledge_items?: KnowledgeItem[];    // to write to knowledge.jsonl
  skill_items?: SkillItem[];            // to write to skills.jsonl
};

export type DomainBenchmark = {
  domain_label: string;
  corpus: BenchmarkCorpus | unknown;   // any shape · evaluator decides
  case_count: number;
  /** Run the corpus against a store rooted at `rootDir` · return passed count. */
  evaluate: (rootDir: string) => number;
};

export type DomainRunResult = {
  domain_label: string;
  passed: number;
  case_count: number;
};

export type CrossContaminationCell = {
  injection_domain: string;
  benchmark_domain: string;
  baseline_passed: number;    // BEFORE (empty store)
  with_injection_passed: number; // AFTER (Domain X injected · Domain Y benchmark run)
  delta: number;              // MUST be 0 · non-zero = leakage
  is_leakage: boolean;
};

export type MultiDomainVerification = {
  own_domain_results: DomainRunResult[];
  cross_contamination_matrix: CrossContaminationCell[];
  any_leakage_detected: boolean;
  leakage_details: string[];
};

// ─── Helpers ──────────────────────────────────────────────

function isolatedStore(): string {
  const root = mkdtempSync(path.join(tmpdir(), "nex-p8-multi-"));
  mkdirSync(root, { recursive: true });
  return root;
}

function writeInjection(rootDir: string, inj: DomainInjection | null): void {
  if (!inj) return;
  const knowledgePath = path.join(rootDir, "knowledge.jsonl");
  const skillsPath = path.join(rootDir, "skills.jsonl");
  if (inj.knowledge_items && inj.knowledge_items.length > 0) {
    writeFileSync(knowledgePath, inj.knowledge_items.map((k) => JSON.stringify(k)).join("\n") + "\n", "utf8");
  }
  if (inj.skill_items && inj.skill_items.length > 0) {
    writeFileSync(skillsPath, inj.skill_items.map((s) => JSON.stringify(s)).join("\n") + "\n", "utf8");
  }
}

function runWithStore(rootDir: string, evaluate: (r: string) => number): number {
  const prior = process.env.NEX_PROGRAMMER_LEARNING_DIR;
  process.env.NEX_PROGRAMMER_LEARNING_DIR = rootDir;
  try {
    return evaluate(rootDir);
  } finally {
    if (prior === undefined) delete process.env.NEX_PROGRAMMER_LEARNING_DIR;
    else process.env.NEX_PROGRAMMER_LEARNING_DIR = prior;
  }
}

// ─── Public ──────────────────────────────────────────────

/** Verify multi-domain isolation.
 *
 *  For each domain: measures BEFORE (empty store) and AFTER (own
 *  injection) — expected to improve if the mechanism works.
 *
 *  Then for every (injection · benchmark) PAIR where injection ≠
 *  benchmark: injects Domain A into an isolated store, runs Domain B's
 *  corpus against that store, and checks delta vs pure-empty baseline.
 *  Delta MUST be 0 for zero-leakage. Non-zero → cross-contamination. */
export function verifyMultiDomain(
  injections: DomainInjection[],
  benchmarks: DomainBenchmark[],
): MultiDomainVerification {
  const emptyStores: Record<string, string> = {};
  const emptyPassed: Record<string, number> = {};
  const roots: string[] = [];
  try {
    // 1. Measure pure-empty baseline for each benchmark
    for (const b of benchmarks) {
      const r = isolatedStore(); roots.push(r);
      emptyStores[b.domain_label] = r;
      emptyPassed[b.domain_label] = runWithStore(r, b.evaluate);
    }

    // 2. Own-domain results: inject Domain X into a store · run Domain X's benchmark
    const ownResults: DomainRunResult[] = [];
    for (const b of benchmarks) {
      const inj = injections.find((i) => i.domain_label === b.domain_label);
      if (!inj) {
        ownResults.push({ domain_label: b.domain_label, passed: emptyPassed[b.domain_label] ?? 0, case_count: b.case_count });
        continue;
      }
      const r = isolatedStore(); roots.push(r);
      writeInjection(r, inj);
      const passed = runWithStore(r, b.evaluate);
      ownResults.push({ domain_label: b.domain_label, passed, case_count: b.case_count });
    }

    // 3. Cross-contamination matrix
    const matrix: CrossContaminationCell[] = [];
    const leakageDetails: string[] = [];
    for (const inj of injections) {
      for (const b of benchmarks) {
        if (inj.domain_label === b.domain_label) continue;
        const r = isolatedStore(); roots.push(r);
        writeInjection(r, inj);
        const withInj = runWithStore(r, b.evaluate);
        const baseline = emptyPassed[b.domain_label] ?? 0;
        const delta = withInj - baseline;
        const isLeakage = delta !== 0;
        if (isLeakage) {
          leakageDetails.push(
            `LEAKAGE: injecting '${inj.domain_label}' into '${b.domain_label}' benchmark produced delta ${delta} (baseline ${baseline} · with-injection ${withInj})`,
          );
        }
        matrix.push({
          injection_domain: inj.domain_label,
          benchmark_domain: b.domain_label,
          baseline_passed: baseline,
          with_injection_passed: withInj,
          delta,
          is_leakage: isLeakage,
        });
      }
    }

    return {
      own_domain_results: ownResults,
      cross_contamination_matrix: matrix,
      any_leakage_detected: matrix.some((c) => c.is_leakage),
      leakage_details: leakageDetails,
    };
  } finally {
    // Cleanup all temp roots
    for (const r of roots) {
      try { rmSync(r, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
}
