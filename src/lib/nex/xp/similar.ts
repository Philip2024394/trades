// Similar-project search — find fingerprints matching a hint.
//
// Match tiers:
//   1. Exact trade + project_type + region (best)
//   2. Same trade + project_type (relax region)
//   3. Same trade (relax project_type)
// Never crosses trades — you don't want to compare a roofer to an
// electrician.

import { evidenceFor, type ProjectFingerprint, type SimilarProject } from "./types";

export type FindSimilarInput = {
  fingerprints: ProjectFingerprint[];
  /** When set, results are restricted to fingerprints sharing this
   *  trade. When omitted, any trade is allowed and the ranker falls
   *  back to project_type / region only. */
  trade?:        string;
  project_type?: string;
  region?:       string;
  limit?:        number;
};

export function findSimilarProjects(input: FindSimilarInput): SimilarProject[] {
  const limit = input.limit ?? 8;
  const evidence = evidenceFor("XP similar-project match over contributed fingerprints", []);
  const wantTrade = input.trade?.toLowerCase();

  const sameTrade = wantTrade
    ? input.fingerprints.filter((f) => f.trade.toLowerCase() === wantTrade)
    : input.fingerprints;
  if (sameTrade.length === 0) return [];

  const results: SimilarProject[] = [];

  const tier1 = sameTrade.filter((f) => input.project_type && f.project_type === input.project_type && input.region && f.region === input.region);
  const tier2 = sameTrade.filter((f) => input.project_type && f.project_type === input.project_type && !(input.region && f.region === input.region));
  const tier3 = sameTrade.filter((f) => !input.project_type || f.project_type !== input.project_type);

  for (const f of tier1) if (results.length < limit) results.push(row(f, "same trade + type + region", evidence));
  for (const f of tier2) if (results.length < limit) results.push(row(f, "same trade + type", evidence));
  for (const f of tier3) if (results.length < limit) results.push(row(f, "same trade only", evidence));

  return results;
}

function row(f: ProjectFingerprint, note: string, evidence: ReturnType<typeof evidenceFor>): SimilarProject {
  return {
    anon_id:         f.anon_id,
    trade:           f.trade,
    project_type:    f.project_type,
    region:          f.region,
    duration_days:   f.duration_days,
    labour_hours:    f.labour_hours,
    similarity_note: note,
    evidence
  };
}
