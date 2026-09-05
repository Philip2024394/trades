// tsx driver for the Phase F fresh-process reproducibility runner.
// Philip 2026-09-06 · AUTHORIZE · PHASE F · §15

import { freezeCorpus } from "@/lib/nex/programmer-benchmark/corpus";
import { CORPUS_V1_CASES, CORPUS_VERSION } from "../programmer-benchmark-proof/_corpus_v1/cases";
import { evaluateCorpus } from "@/lib/nex/programmer-benchmark/evaluator";
import { computeCaseFingerprint } from "@/lib/nex/programmer-stability/version-manifest";

const programmerBenchmarkCorpusV1 = freezeCorpus({
  version: CORPUS_VERSION,
  authored_by: "phase_f_fresh_repro",
  cases: CORPUS_V1_CASES,
});

const evaluation = evaluateCorpus(programmerBenchmarkCorpusV1, { triggered_by: "runner" });
const fingerprint = computeCaseFingerprint(
  evaluation.results.map((r) => ({
    case_id: r.case_id,
    match_status: r.match_status,
    actual_verdict: r.actual_verdict,
    actual_finding_count: r.actual_finding_count,
  })),
);

// Print ONLY the fingerprint on the final non-empty line.
console.log(fingerprint);
