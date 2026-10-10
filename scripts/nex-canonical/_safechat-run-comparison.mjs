// scripts/nex-canonical/_safechat-run-comparison.mjs
//
// NEX SafeChat classification quality · comparison orchestrator.
//
// WHAT THIS SCRIPT DOES (updated for Ruleset Tuning Wave 2 · v1.1.1)
// -----------------------------------------------------------------
//   · Runs the hermetic evaluation runner SIX times:
//       (1) ruleset v1.0.0 against v1 corpus
//       (2) ruleset v1.0.0 against v2 corpus
//       (3) ruleset v1.1.0 (frozen) against v1 corpus
//       (4) ruleset v1.1.0 (frozen) against v2 corpus
//       (5) ruleset v1.1.1 against v1 corpus
//       (6) ruleset v1.1.1 against v2 corpus
//   · Produces six result JSONs + the comparison JSONs:
//       · v2 corpus: v1.0.0 vs v1.1.0  (Wave 1 regression report)
//       · v2 corpus: v1.0.0 vs v1.1.1  (new · Wave 2 vs baseline)
//       · v2 corpus: v1.1.0 vs v1.1.1  (new · Wave 2 regression-fix delta)
//       · v1 corpus: v1.0.0 vs v1.1.0  (preserved for historical compare)
//   · Prints headline numbers across both corpora and both revisions.
//
// INVOCATION
// -----------------------------------------------------------------
//   node --conditions=react-server --import tsx scripts/nex-canonical/_safechat-run-comparison.mjs
//
// SAFETY
// -----------------------------------------------------------------
//   · No DB reads, no DB writes.
//   · No logging of corpus body text (except as part of the written
//     report files · acceptable because every corpus item is synthetic).

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");
const CORPUS_DIR = path.join(ROOT, "src/lib/nex-native/safechat/__eval__");
const RULES_DIR = path.join(ROOT, "src/lib/nex-native/safechat/rules");

const V1_CORPUS_FILES = [
  "corpus-en.json",
  "corpus-id.json",
  "corpus-code-switched.json",
];
const V2_CORPUS_FILES = [
  "corpus-v2-en.json",
  "corpus-v2-id.json",
  "corpus-v2-code-switched.json",
  "corpus-v2-multi-message.json",
  "corpus-v2-benign-lookalikes.json",
];

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function loadCorpusFiles(files) {
  const out = [];
  for (const f of files) {
    const t = await readFile(path.join(CORPUS_DIR, f), "utf8");
    const arr = JSON.parse(t);
    if (!Array.isArray(arr)) throw new Error(`${f} · not an array`);
    out.push(arr);
  }
  return out;
}

function flatCorpus(corpora) {
  const flat = [];
  for (const c of corpora) for (const it of c) flat.push(it);
  return flat;
}

function fmtPct(n) {
  return `${(n * 100).toFixed(2)}%`;
}

async function main() {
  console.log("[safechat-comparison] start");
  const rulesLanded = await pathExists(RULES_DIR);
  console.log(
    `[safechat-comparison] rules/ directory present · ${rulesLanded ? "yes" : "NO · v1.1.0 + v1.1.1 runs will be skipped"}`,
  );

  const runnerPath = path.join(CORPUS_DIR, "evaluation-runner.ts");
  const comparatorPath = path.join(CORPUS_DIR, "comparison-report.ts");
  const runner = await import(pathToFileURL(runnerPath).href);
  const comparator = await import(pathToFileURL(comparatorPath).href);
  const { runEvaluation } = runner;
  const { buildComparison } = comparator;

  const v1Corpora = await loadCorpusFiles(V1_CORPUS_FILES);
  const v2Corpora = await loadCorpusFiles(V2_CORPUS_FILES);
  const v1Flat = flatCorpus(v1Corpora);
  const v2Flat = flatCorpus(v2Corpora);

  console.log(
    `[safechat-comparison] v1 corpus · ${v1Flat.length} items · v2 corpus · ${v2Flat.length} items`,
  );

  // Run baseline (v1.0.0) on v1 corpus · overwrites the sealed baseline.
  const baselineV1 = await runEvaluation({
    corpora: v1Corpora,
    runEachItemTwice: true,
    rulesetVersion: "safechat-rules-v1.0.0",
  });
  await mkdir(CORPUS_DIR, { recursive: true });
  await writeFile(
    path.join(CORPUS_DIR, "results-baseline-2026-10-10.json"),
    JSON.stringify(baselineV1, null, 2) + "\n",
    "utf8",
  );

  // Run baseline (v1.0.0) on v2 corpus.
  const baselineV2 = await runEvaluation({
    corpora: v2Corpora,
    runEachItemTwice: true,
    rulesetVersion: "safechat-rules-v1.0.0",
  });
  await writeFile(
    path.join(CORPUS_DIR, "results-v2-baseline-v1-0-0-2026-10-10.json"),
    JSON.stringify(baselineV2, null, 2) + "\n",
    "utf8",
  );

  let revisedV1 = null;
  let revisedV2 = null;
  let waveTwoV1 = null;
  let waveTwoV2 = null;
  if (rulesLanded) {
    revisedV1 = await runEvaluation({
      corpora: v1Corpora,
      runEachItemTwice: true,
      rulesetVersion: "safechat-rules-v1.1.0",
    });
    await writeFile(
      path.join(CORPUS_DIR, "results-v1-revised-v1-1-0-2026-10-10.json"),
      JSON.stringify(revisedV1, null, 2) + "\n",
      "utf8",
    );
    revisedV2 = await runEvaluation({
      corpora: v2Corpora,
      runEachItemTwice: true,
      rulesetVersion: "safechat-rules-v1.1.0",
    });
    await writeFile(
      path.join(CORPUS_DIR, "results-v2-revised-v1-1-0-2026-10-10.json"),
      JSON.stringify(revisedV2, null, 2) + "\n",
      "utf8",
    );

    waveTwoV1 = await runEvaluation({
      corpora: v1Corpora,
      runEachItemTwice: true,
      rulesetVersion: "safechat-rules-v1.1.1",
    });
    await writeFile(
      path.join(CORPUS_DIR, "results-v1-revised-v1-1-1-2026-10-10.json"),
      JSON.stringify(waveTwoV1, null, 2) + "\n",
      "utf8",
    );
    waveTwoV2 = await runEvaluation({
      corpora: v2Corpora,
      runEachItemTwice: true,
      rulesetVersion: "safechat-rules-v1.1.1",
    });
    await writeFile(
      path.join(CORPUS_DIR, "results-v2-revised-v1-1-1-2026-10-10.json"),
      JSON.stringify(waveTwoV2, null, 2) + "\n",
      "utf8",
    );
  }

  // Build v1 corpus comparison (v1.0.0 vs v1.1.0 · preserved from Wave 1).
  const comparisonV1 = revisedV1
    ? buildComparison({
        baseline: baselineV1,
        revised: revisedV1,
        corpus: v1Flat,
        corpusVersion: "v1",
      })
    : {
        pending: true,
        reason: "rules/ directory not present · revised run skipped",
        baselineVersion: baselineV1.classifierVersion,
        corpusVersion: "v1",
        baselineOverall: baselineV1.overall,
        baselineSeriousRiskRecall: baselineV1.seriousRiskRecall,
      };
  await writeFile(
    path.join(CORPUS_DIR, "comparison-v1-v1-0-0-vs-v1-1-0-2026-10-10.json"),
    JSON.stringify(comparisonV1, null, 2) + "\n",
    "utf8",
  );

  // Build v2 corpus comparisons.
  // (a) baseline vs v1.1.0 · the Wave 1 report.
  const comparisonV2 = revisedV2
    ? buildComparison({
        baseline: baselineV2,
        revised: revisedV2,
        corpus: v2Flat,
        corpusVersion: "v2",
      })
    : {
        pending: true,
        reason: "rules/ directory not present · revised run skipped",
        baselineVersion: baselineV2.classifierVersion,
        corpusVersion: "v2",
        baselineOverall: baselineV2.overall,
        baselineSeriousRiskRecall: baselineV2.seriousRiskRecall,
      };
  await writeFile(
    path.join(CORPUS_DIR, "comparison-v1-0-0-vs-v1-1-0-2026-10-10.json"),
    JSON.stringify(comparisonV2, null, 2) + "\n",
    "utf8",
  );

  // (b) baseline vs v1.1.1 · new Wave-2 vs baseline comparison.
  const comparisonV2BaselineVsWave2 = waveTwoV2
    ? buildComparison({
        baseline: baselineV2,
        revised: waveTwoV2,
        corpus: v2Flat,
        corpusVersion: "v2",
      })
    : {
        pending: true,
        reason: "v1.1.1 run not available",
        baselineVersion: baselineV2.classifierVersion,
        corpusVersion: "v2",
      };
  await writeFile(
    path.join(CORPUS_DIR, "comparison-v1-0-0-vs-v1-1-1-2026-10-10.json"),
    JSON.stringify(comparisonV2BaselineVsWave2, null, 2) + "\n",
    "utf8",
  );

  // (c) v1.1.0 vs v1.1.1 · new regression-fix delta.
  const comparisonV2WaveOneVsWaveTwo = revisedV2 && waveTwoV2
    ? buildComparison({
        baseline: revisedV2,
        revised: waveTwoV2,
        corpus: v2Flat,
        corpusVersion: "v2",
      })
    : {
        pending: true,
        reason: "v1.1.0 or v1.1.1 run missing",
        baselineVersion: revisedV2?.classifierVersion ?? null,
        corpusVersion: "v2",
      };
  await writeFile(
    path.join(CORPUS_DIR, "comparison-v1-1-0-vs-v1-1-1-2026-10-10.json"),
    JSON.stringify(comparisonV2WaveOneVsWaveTwo, null, 2) + "\n",
    "utf8",
  );

  // Headline print.
  console.log("");
  console.log("[safechat-comparison] HEADLINES");
  console.log("--------------------------------------");
  console.log(`V1 CORPUS (${v1Flat.length} items)`);
  console.log(
    `  v1.0.0  accuracy · ${fmtPct(baselineV1.overall.accuracy)} · FP-benign ${fmtPct(baselineV1.overall.falsePositiveRateOnBenign)} · FN-serious ${fmtPct(baselineV1.overall.falseNegativeRateOnSerious)}`,
  );
  console.log(
    `  v1.0.0  serious-risk recall · ${baselineV1.seriousRiskRecall.numerator}/${baselineV1.seriousRiskRecall.denominator}`,
  );
  if (revisedV1) {
    console.log(
      `  v1.1.0  accuracy · ${fmtPct(revisedV1.overall.accuracy)} · FP-benign ${fmtPct(revisedV1.overall.falsePositiveRateOnBenign)} · FN-serious ${fmtPct(revisedV1.overall.falseNegativeRateOnSerious)}`,
    );
    console.log(
      `  v1.1.0  serious-risk recall · ${revisedV1.seriousRiskRecall.numerator}/${revisedV1.seriousRiskRecall.denominator}`,
    );
  }
  if (waveTwoV1) {
    console.log(
      `  v1.1.1  accuracy · ${fmtPct(waveTwoV1.overall.accuracy)} · FP-benign ${fmtPct(waveTwoV1.overall.falsePositiveRateOnBenign)} · FN-serious ${fmtPct(waveTwoV1.overall.falseNegativeRateOnSerious)}`,
    );
    console.log(
      `  v1.1.1  serious-risk recall · ${waveTwoV1.seriousRiskRecall.numerator}/${waveTwoV1.seriousRiskRecall.denominator}`,
    );
  }

  console.log(`V2 CORPUS (${v2Flat.length} items)`);
  console.log(
    `  v1.0.0  accuracy · ${fmtPct(baselineV2.overall.accuracy)} · FP-benign ${fmtPct(baselineV2.overall.falsePositiveRateOnBenign)} · FN-serious ${fmtPct(baselineV2.overall.falseNegativeRateOnSerious)}`,
  );
  console.log(
    `  v1.0.0  serious-risk recall · ${baselineV2.seriousRiskRecall.numerator}/${baselineV2.seriousRiskRecall.denominator}`,
  );
  if (revisedV2) {
    console.log(
      `  v1.1.0  accuracy · ${fmtPct(revisedV2.overall.accuracy)} · FP-benign ${fmtPct(revisedV2.overall.falsePositiveRateOnBenign)} · FN-serious ${fmtPct(revisedV2.overall.falseNegativeRateOnSerious)}`,
    );
    console.log(
      `  v1.1.0  serious-risk recall · ${revisedV2.seriousRiskRecall.numerator}/${revisedV2.seriousRiskRecall.denominator}`,
    );
  }
  if (waveTwoV2) {
    console.log(
      `  v1.1.1  accuracy · ${fmtPct(waveTwoV2.overall.accuracy)} · FP-benign ${fmtPct(waveTwoV2.overall.falsePositiveRateOnBenign)} · FN-serious ${fmtPct(waveTwoV2.overall.falseNegativeRateOnSerious)}`,
    );
    console.log(
      `  v1.1.1  serious-risk recall · ${waveTwoV2.seriousRiskRecall.numerator}/${waveTwoV2.seriousRiskRecall.denominator}`,
    );
    console.log(
      `  v1.1.0→v1.1.1 improvements · ${comparisonV2WaveOneVsWaveTwo.improvements.length} · regressions · ${comparisonV2WaveOneVsWaveTwo.regressions.length}`,
    );
  }

  console.log("");
  console.log(
    `[safechat-comparison] wrote comparison-v1-v1-0-0-vs-v1-1-0-2026-10-10.json`,
  );
  console.log(
    `[safechat-comparison] wrote comparison-v1-0-0-vs-v1-1-0-2026-10-10.json`,
  );
  console.log(
    `[safechat-comparison] wrote comparison-v1-0-0-vs-v1-1-1-2026-10-10.json`,
  );
  console.log(
    `[safechat-comparison] wrote comparison-v1-1-0-vs-v1-1-1-2026-10-10.json`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(
    `[safechat-comparison] FATAL · ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
  );
  process.exit(1);
});
