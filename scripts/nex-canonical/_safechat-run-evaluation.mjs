// scripts/nex-canonical/_safechat-run-evaluation.mjs
//
// NEX SafeChat classification quality · evaluation entry point.
//
// WHAT THIS SCRIPT DOES
// -----------------------------------------------------------------
//   · Loads either the v1 corpora (corpus-en/id/code-switched.json) or
//     the v2 corpora (corpus-v2-*.json) depending on --corpus.
//   · Runs the hermetic evaluation runner twice per item (consistency
//     check).
//   · Tags the run with --ruleset (v1.0.0 or v1.1.0).
//   · Writes the full EvaluationReport to a path derived from the
//     ruleset + corpus flags (so running baseline on v2 does not
//     overwrite baseline on v1).
//   · Prints headline numbers to stdout.
//   · Exits 0 regardless of score · we MEASURE, we do not gate.
//
// INVOCATION
// -----------------------------------------------------------------
//   node --conditions=react-server --import tsx scripts/nex-canonical/_safechat-run-evaluation.mjs
//     [--ruleset v1.0.0|v1.1.0] [--corpus v1|v2] [--out <path>]
//
//   · --conditions=react-server routes `server-only` to its empty-module
//     branch so the classifier TS files can be imported in plain Node.
//     This is strictly for the hermetic evaluation runner · production
//     code paths continue to resolve `server-only` via Next.js.
//   · --import tsx lets this plain-Node script execute `.ts` modules
//     on-the-fly.
//
// SAFETY
// -----------------------------------------------------------------
//   · No DB reads, no DB writes.
//   · No logging of corpus body text (except as part of the written
//     report file · acceptable because every corpus item is synthetic).
//   · Does not call the SafeChat hook, does not fire the feature flag.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..");

const CORPUS_DIR = path.join(ROOT, "src/lib/nex-native/safechat/__eval__");

function parseArgs(argv) {
  const out = { ruleset: "v1.1.0", corpus: "v1", outOverride: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--ruleset") out.ruleset = String(argv[++i] ?? "");
    else if (a === "--corpus") out.corpus = String(argv[++i] ?? "");
    else if (a === "--out") out.outOverride = String(argv[++i] ?? "");
  }
  if (!["v1.0.0", "v1.1.0"].includes(out.ruleset)) {
    throw new Error(`invalid --ruleset ${out.ruleset} · expected v1.0.0 or v1.1.0`);
  }
  if (!["v1", "v2"].includes(out.corpus)) {
    throw new Error(`invalid --corpus ${out.corpus} · expected v1 or v2`);
  }
  return out;
}

function corporaForVersion(version) {
  if (version === "v1") {
    return ["corpus-en.json", "corpus-id.json", "corpus-code-switched.json"];
  }
  return [
    "corpus-v2-en.json",
    "corpus-v2-id.json",
    "corpus-v2-code-switched.json",
    "corpus-v2-multi-message.json",
    "corpus-v2-benign-lookalikes.json",
  ];
}

function defaultOutputPath(corpusVersion, rulesetVersion) {
  const date = "2026-10-10";
  if (corpusVersion === "v1" && rulesetVersion === "v1.0.0") {
    // Preserve the original baseline filename for backward compat.
    return path.join(CORPUS_DIR, `results-baseline-${date}.json`);
  }
  const suffix =
    corpusVersion === "v2"
      ? rulesetVersion === "v1.0.0"
        ? `results-v2-baseline-v1-0-0-${date}.json`
        : `results-v2-revised-v1-1-0-${date}.json`
      : rulesetVersion === "v1.0.0"
        ? `results-v1-baseline-v1-0-0-${date}.json`
        : `results-v1-revised-v1-1-0-${date}.json`;
  return path.join(CORPUS_DIR, suffix);
}

async function loadCorpus(name) {
  const file = path.join(CORPUS_DIR, name);
  const text = await readFile(file, "utf8");
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error(`${name} · expected JSON array · got ${typeof data}`);
  }
  return data;
}

function fmtPct(n) {
  return `${(n * 100).toFixed(2)}%`;
}

async function main() {
  const argv = parseArgs(process.argv.slice(2));
  const corpusFiles = corporaForVersion(argv.corpus);
  const OUTPUT_PATH = argv.outOverride
    ? path.resolve(ROOT, argv.outOverride)
    : defaultOutputPath(argv.corpus, argv.ruleset);
  const RULESET_LABEL = `safechat-rules-${argv.ruleset}`;

  console.log(
    `[safechat-eval] start · ruleset=${RULESET_LABEL} · corpus=${argv.corpus}`,
  );

  // Dynamic import of the TypeScript runner · requires tsx + the
  // react-server condition for `server-only`.
  const runnerPath = path.join(CORPUS_DIR, "evaluation-runner.ts");
  const runner = await import(pathToFileURL(runnerPath).href);
  const { runEvaluation } = runner;

  const corpora = await Promise.all(corpusFiles.map((f) => loadCorpus(f)));

  console.log(
    `[safechat-eval] corpora loaded · ${corpusFiles
      .map((f, i) => `${f}=${corpora[i].length}`)
      .join(" · ")}`,
  );

  const report = await runEvaluation({
    corpora,
    runEachItemTwice: true,
    rulesetVersion: RULESET_LABEL,
  });

  await mkdir(CORPUS_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log("");
  console.log(`[safechat-eval] classifier version · ${report.classifierVersion}`);
  console.log(`[safechat-eval] ruleset source    · ${report.rulesetSource}`);
  console.log(`[safechat-eval] run at             · ${report.runAt}`);
  console.log("");
  console.log("[safechat-eval] overall");
  console.log(`  accuracy                · ${fmtPct(report.overall.accuracy)}`);
  console.log(`  FP-rate-on-benign       · ${fmtPct(report.overall.falsePositiveRateOnBenign)}`);
  console.log(`  FN-rate-on-serious      · ${fmtPct(report.overall.falseNegativeRateOnSerious)}`);
  console.log(
    `  serious-risk recall     · ${report.seriousRiskRecall.numerator}/${report.seriousRiskRecall.denominator}`,
  );
  console.log("");
  console.log("[safechat-eval] per-language");
  for (const lang of ["en", "id", "mixed"]) {
    const summary = report.perLanguage[lang];
    const total = report.corpusTotals[lang];
    console.log(`  ${lang} · total=${total} · accuracy=${fmtPct(summary.accuracy)}`);
  }
  console.log("");
  console.log(`[safechat-eval] consistency · ${report.consistency.description}`);
  console.log("");
  console.log(
    `[safechat-eval] failing items · ${report.failingItems.length} / ${report.failingItems.length + report.passingItems.length}`,
  );

  // Top 5 failing items by delta magnitude.
  const sortedFailing = [...report.failingItems].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  );
  console.log("[safechat-eval] top 5 failing (id · expected -> actual · tag)");
  for (const r of sortedFailing.slice(0, 5)) {
    console.log(
      `  · ${r.item.id} · ${r.item.expected_level} -> ${r.actualLevel} · ${r.item.category_tag}`,
    );
  }

  console.log("");
  console.log(`[safechat-eval] wrote · ${path.relative(ROOT, OUTPUT_PATH)}`);
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[safechat-eval] FATAL · ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
  );
  process.exit(1);
});
