// src/lib/nex/l4-bakeoff/paths.ts
//
// V.5.2 · L4 bakeoff · persistent data directory paths
// Founder BEGIN V.5.2 · 2026-09-08
//
// Every V.5.2 artifact lives under data/l4-bakeoff/ · a NEW root ·
// never mixed with programmer-benchmark / master-ai / programmer-learning.
// Env-overridable via NEX_L4_BAKEOFF_DATA_ROOT for test isolation.

import path from "node:path";

export function l4BakeoffDataRoot(): string {
  const override = process.env.NEX_L4_BAKEOFF_DATA_ROOT;
  if (override && override.length > 0) return override;
  return path.join(process.cwd(), "data", "l4-bakeoff");
}

// Frozen benchmark corpora (append-only · one file per version)
export const corpusRegistryPath = () => path.join(l4BakeoffDataRoot(), "corpus_registry.jsonl");

// Run records (one line per completed run · full body separate)
export const runRegistryPath = () => path.join(l4BakeoffDataRoot(), "run_registry.jsonl");
export const runBodyPath = (run_id: string) => path.join(l4BakeoffDataRoot(), "runs", `${run_id}.json`);

// Per-candidate scores (append-only)
export const caseScoresPath = () => path.join(l4BakeoffDataRoot(), "case_scores.jsonl");
export const dimensionScoresPath = () => path.join(l4BakeoffDataRoot(), "dimension_scores.jsonl");
export const candidateAggregatesPath = () => path.join(l4BakeoffDataRoot(), "candidate_aggregates.jsonl");

// Latency + cost
export const latencyProfilesPath = () => path.join(l4BakeoffDataRoot(), "latency_profiles.jsonl");
export const costProfilesPath = () => path.join(l4BakeoffDataRoot(), "cost_profiles.jsonl");

// Blind evaluation (mapping stays sealed until judgment)
export const blindMappingsPath = () => path.join(l4BakeoffDataRoot(), "blind_mappings.jsonl");

// Anti-gaming sentinels
export const antiGamingSentinelsPath = () => path.join(l4BakeoffDataRoot(), "anti_gaming_sentinels.jsonl");

// Excluded cases (must always have an explicit reason)
export const excludedCasesPath = () => path.join(l4BakeoffDataRoot(), "excluded_cases.jsonl");

// Raw response transcripts (large · one file per response)
export const transcriptDir = () => path.join(l4BakeoffDataRoot(), "transcripts");
export const transcriptPath = (transcript_id: string) => path.join(transcriptDir(), `${transcript_id}.json`);
