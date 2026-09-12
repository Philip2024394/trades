// src/lib/nex-debugger/sbfl.ts
//
// NEX Debugger · Spectrum-Based Fault Localization.
// Literature-named formulas only: Ochiai · Tarantula · DStar.
// Pure arithmetic on coverage matrices · no LLM · deterministic.

import { createHash, randomBytes } from "node:crypto";
import type { CoverageEntry, SBFLFormula, SBFLResult, SBFLRankingEntry } from "./types";

export function computeSBFL(coverage: readonly CoverageEntry[], formula: SBFLFormula = "ochiai"): SBFLResult {
  // Aggregate per-location counts:
  //   ef = executed by a failing test
  //   ep = executed by a passing test
  //   nf = not executed by a failing test
  //   np = not executed by a passing test
  const failingTests = coverage.filter((c) => !c.passed);
  const passingTests = coverage.filter((c) => c.passed);
  const F = failingTests.length;
  const P = passingTests.length;

  const efMap = new Map<string, number>();
  const epMap = new Map<string, number>();
  const allLocations = new Set<string>();
  for (const t of failingTests) for (const loc of t.executed_locations) { efMap.set(loc, (efMap.get(loc) ?? 0) + 1); allLocations.add(loc); }
  for (const t of passingTests) for (const loc of t.executed_locations) { epMap.set(loc, (epMap.get(loc) ?? 0) + 1); allLocations.add(loc); }

  const ranking: SBFLRankingEntry[] = [];
  for (const loc of allLocations) {
    const ef = efMap.get(loc) ?? 0;
    const ep = epMap.get(loc) ?? 0;
    const nf = F - ef;
    const np = P - ep;
    let suspicion = 0;
    if (formula === "ochiai") {
      const denom = Math.sqrt((ef + nf) * (ef + ep));
      suspicion = denom === 0 ? 0 : ef / denom;
    } else if (formula === "tarantula") {
      const failRatio = (ef + nf) === 0 ? 0 : ef / (ef + nf);
      const passRatio = (ep + np) === 0 ? 0 : ep / (ep + np);
      const total = failRatio + passRatio;
      suspicion = total === 0 ? 0 : failRatio / total;
    } else if (formula === "dstar") {
      const denom = ep + nf;
      suspicion = denom === 0 ? 0 : (ef * ef) / denom;
    }
    const [path, lineStr] = loc.split("::");
    ranking.push({ location: loc, path, line: parseInt(lineStr ?? "0", 10) || 0, suspicion });
  }

  // Deterministic sort: primarily descending suspicion, then ascending location for tie-break
  ranking.sort((a, b) => b.suspicion - a.suspicion || a.location.localeCompare(b.location));

  const top = ranking[0] && ranking[0].suspicion > 0 ? { path: ranking[0].path, line: ranking[0].line } : null;

  const matrixSerial = [...failingTests, ...passingTests]
    .map((t) => `${t.test_id}|${t.passed ? "P" : "F"}|${t.executed_locations.slice().sort().join(",")}`)
    .sort()
    .join("\n");
  const coverage_matrix_hash = createHash("sha256").update(matrixSerial).digest("hex").slice(0, 16);

  return {
    formula,
    ranking,
    top_candidate: top,
    coverage_matrix_hash,
    evidence_id: "SBFL-" + Date.now().toString(36) + "-" + randomBytes(3).toString("hex"),
  };
}
