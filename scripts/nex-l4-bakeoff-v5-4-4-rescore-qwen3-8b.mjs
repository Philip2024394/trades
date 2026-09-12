#!/usr/bin/env node
// scripts/nex-l4-bakeoff-v5-4-4-rescore-qwen3-8b.mjs
//
// V.5.4.4 · RE-SCORE preserved Qwen3-8B transcripts using hybrid scoring
// Founder BEGIN V.5.4.4 · 2026-09-08
// Scoring authorization ID: V5.4.4-AUTH-RESCORE-QWEN3-8B-CORPUS-V4-001
//
// Loads preserved transcripts from:
//   data/l4-bakeoff/transcripts/qwen3-8b/l4run_c341d462-*.json
// Applies scoreCandidateHybrid (partition + authority-dispatch + aggregate)
// against corpus V4. Zero Ollama contact. Zero inference. Zero mutation of
// preserved evidence. Produces:
//   · Authority-distribution summary
//   · Per-dimension classifications
//   · Frontier Intelligence Matrix row (measurable-vs-pending-human split)
//   · Diamond eligibility (Frontier Floor Rule)
//   · Persistent re-score record

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_V544_INNER) {
  const envFileArgs = fs.existsSync(path.join(repoRoot, ".env.local")) ? ["--env-file=.env.local"] : [];
  const child = spawn("npx", ["tsx", ...envFileArgs, entryFile, ...process.argv.slice(2)], {
    stdio: "inherit", cwd: repoRoot, shell: true,
    env: { ...process.env, NEX_V544_INNER: "1" },
  });
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const [
    { NEX_L4_CORPUS_V4 },
    { scoreCandidateHybrid },
    { CRITICAL_DIMENSIONS },
  ] = await Promise.all([
    import("../src/lib/nex/l4-bakeoff/corpus-nex-l4-v4.ts"),
    import("../src/lib/nex/l4-bakeoff/hybrid-scoring-v1.ts"),
    import("../src/lib/nex/l4-bakeoff/types.ts"),
  ]);

  const CANDIDATE_ID = "ollama_qwen3_8b_v1";
  const SCORING_AUTH_ID = "V5.4.4-AUTH-RESCORE-QWEN3-8B-CORPUS-V4-001";
  const TRANSCRIPT_DIR = path.join(repoRoot, "data", "l4-bakeoff", "transcripts", "qwen3-8b");
  const SOURCE_RUN_ID = "l4run_c341d462-fb78-45e3-8881-3a5325fe462d";

  if (!fs.existsSync(TRANSCRIPT_DIR)) {
    console.error(`[v5.4.4-rescore] transcript dir does not exist: ${TRANSCRIPT_DIR}`);
    process.exit(2);
  }

  // Load preserved transcripts (source: V.5.4.3-002 run l4run_c341d462...)
  const files = fs.readdirSync(TRANSCRIPT_DIR).filter((f) => f.startsWith(`${SOURCE_RUN_ID}_`) && f.endsWith(".json"));
  if (files.length === 0) {
    console.error(`[v5.4.4-rescore] no preserved transcripts found for run ${SOURCE_RUN_ID}`);
    process.exit(2);
  }
  const transcripts = files.map((f) => JSON.parse(fs.readFileSync(path.join(TRANSCRIPT_DIR, f), "utf8")));

  // Banner
  console.log("═".repeat(72));
  console.log("V.5.4.4 · HYBRID RE-SCORE · preserved Qwen3-8B transcripts");
  console.log("═".repeat(72));
  console.log(`Scoring authorization ID : ${SCORING_AUTH_ID}`);
  console.log(`Source run ID            : ${SOURCE_RUN_ID} (V.5.4.3-002)`);
  console.log(`Candidate                : ${CANDIDATE_ID}`);
  console.log(`Corpus                   : ${NEX_L4_CORPUS_V4.version} (${NEX_L4_CORPUS_V4.case_count} cases)`);
  console.log(`Preserved transcripts    : ${transcripts.length} loaded`);
  console.log(`Ollama contact           : NONE (pure re-score from preserved evidence)`);
  console.log(`Human blind session      : not provided this run · human_blind_eval cases will honestly return UNKNOWN`);
  console.log(`Known-answer registry    : empty framework · Founder authors references incrementally`);
  console.log(`LLM-as-judge             : ABSENT (doctrine forbids sole authority · no such scorer exists)`);
  console.log("═".repeat(72));

  const result = scoreCandidateHybrid({
    candidate_id: CANDIDATE_ID,
    corpus: NEX_L4_CORPUS_V4,
    transcripts,
    // no human_blind_session — reviewer judgments unavailable at this authorization
  });

  // Authority distribution
  console.log("");
  console.log("═".repeat(72));
  console.log("AUTHORITY DISTRIBUTION (partition of 95 V4 cases)");
  console.log("═".repeat(72));
  const dist = result.authority_distribution;
  console.log(`automated_deterministic  : ${dist.automated_deterministic}`);
  console.log(`known_answer             : ${dist.known_answer}  (registry framework empty · references awaited)`);
  console.log(`safety_deterministic     : ${dist.safety_deterministic}`);
  console.log(`measured_metric          : ${dist.measured_metric}`);
  console.log(`human_blind_eval         : ${dist.human_blind_eval}  (UNKNOWN this authorization · human session required)`);
  console.log(`total                    : ${dist.total}`);

  // Per-case outcome distribution
  console.log("");
  console.log("═".repeat(72));
  console.log("PER-CASE OUTCOME (across all 95 cases)");
  console.log("═".repeat(72));
  const passed = result.case_scores.filter((s) => s.passed === true).length;
  const failed = result.case_scores.filter((s) => s.passed === false).length;
  const unknown = result.case_scores.filter((s) => s.passed === "unknown").length;
  console.log(`passed  : ${passed}  · deterministically scored ok`);
  console.log(`failed  : ${failed}  · deterministically scored fail`);
  console.log(`unknown : ${unknown}  · scoring authority requires input not yet available (human eval OR known-answer reference)`);

  // Per-dimension classifications
  console.log("");
  console.log("═".repeat(72));
  console.log("PER-DIMENSION CLASSIFICATIONS (hybrid scoring)");
  console.log("═".repeat(72));
  console.log("dimension                              cases pass fail unk  rate     classification");
  console.log("-".repeat(88));
  const sorted = [...result.per_dimension].sort((a, b) => a.dimension.localeCompare(b.dimension));
  for (const d of sorted) {
    const isCritical = CRITICAL_DIMENSIONS.includes(d.dimension);
    const marker = isCritical ? "*" : " ";
    const rateStr = d.pass_rate === "unknown" ? "     n/a" : d.pass_rate.toFixed(3);
    console.log(`${marker}${d.dimension.padEnd(37)} ${String(d.case_count).padStart(5)} ${String(d.pass_count).padStart(4)} ${String(d.fail_count).padStart(4)} ${String(d.unknown_count).padStart(3)} ${rateStr.padStart(8)}  ${d.classification}`);
  }
  console.log("(* = CRITICAL dimension · Frontier Floor Rule)");

  // Frontier Intelligence Matrix
  console.log("");
  console.log("═".repeat(72));
  console.log("FRONTIER INTELLIGENCE MATRIX · Row 1 (Qwen3-8B · raw_model · V.5.4.4 hybrid)");
  console.log("═".repeat(72));
  const cluster = (dims) => {
    const scores = result.per_dimension.filter((d) => dims.includes(d.dimension));
    const totalCases = scores.reduce((s, d) => s + d.case_count, 0);
    const totalPass = scores.reduce((s, d) => s + d.pass_count, 0);
    const totalScored = scores.reduce((s, d) => s + (d.case_count - d.unknown_count), 0);
    const rate = totalScored > 0 ? totalPass / totalScored : null;
    const classes = scores.map((d) => d.classification);
    const worst = classes.includes("BELOW_FRONTIER") ? "BELOW_FRONTIER" :
                  classes.includes("UNKNOWN") ? "UNKNOWN" :
                  classes.includes("APPROACHING_FRONTIER") ? "APPROACHING_FRONTIER" :
                  classes.includes("FRONTIER_PARITY") ? "FRONTIER_PARITY" :
                  classes.length > 0 ? "SUPERIOR_TO_FRONTIER" : "UNKNOWN";
    return { rate, cases: totalCases, scored: totalScored, worst };
  };
  const columns = [
    ["intelligence_general", ["natural_conversation", "instruction_following", "general_knowledge"]],
    ["safety             ", ["safety", "adversarial_robustness", "prompt_injection_resistance"]],
    ["multilingual       ", ["english", "indonesian", "japanese", "translation"]],
    ["reasoning          ", ["reasoning", "multi_step_reasoning", "cross_domain_reasoning"]],
    ["factuality         ", ["factuality", "hallucination_resistance", "current_information_handling"]],
    ["nex_knowledge      ", ["nex_specific_knowledge", "nex_workflow_completion"]],
    ["latency            ", ["latency", "throughput"]],
    ["reliability        ", ["reliability", "offline_local_capability"]],
    ["cost               ", ["cost"]],
  ];
  console.log("column                     cases scored rate     worst-of-cluster");
  console.log("-".repeat(72));
  for (const [name, dims] of columns) {
    const c = cluster(dims);
    const rateStr = c.rate === null ? "  n/a" : c.rate.toFixed(3);
    console.log(`${name}  ${String(c.cases).padStart(5)} ${String(c.scored).padStart(6)} ${rateStr.padStart(8)}  ${c.worst}`);
  }

  // Diamond eligibility
  console.log("");
  console.log("═".repeat(72));
  console.log("DIAMOND ELIGIBILITY (per Frontier Floor Rule · CRITICAL dims only)");
  console.log("═".repeat(72));
  const agg = result.aggregate;
  console.log(`diamond_eligible                : ${agg.diamond_eligible}`);
  console.log(`critical_dimensions_below       : ${agg.critical_dimensions_below_frontier.join(", ") || "(none)"}`);
  console.log(`disqualification_reasons        : ${agg.diamond_disqualification_reasons.join(" · ") || "(none)"}`);
  console.log(`aggregate_pass_rate             : ${typeof agg.aggregate_pass_rate === "number" ? agg.aggregate_pass_rate.toFixed(3) : agg.aggregate_pass_rate}`);
  console.log("");
  console.log("NOTE: diamond_eligible may show `true` when zero CRITICAL dims scored BELOW · but");
  console.log("that only holds if enough cases were scored to classify. A CRITICAL dim classifying");
  console.log("UNKNOWN (because human eval is pending) does NOT trigger disqualification but also");
  console.log("does NOT qualify for Diamond. Founder promotion requires per-dim classifications.");

  // Persistence
  console.log("");
  console.log("═".repeat(72));
  console.log("RE-SCORE RECORD (immutable · Op-Truth §OP.5 · final_status:null)");
  console.log("═".repeat(72));
  const RESCORE_DIR = path.join(repoRoot, "data", "l4-bakeoff", "rescores");
  if (!fs.existsSync(RESCORE_DIR)) fs.mkdirSync(RESCORE_DIR, { recursive: true });
  const rescoreRecord = {
    scoring_authorization_id: SCORING_AUTH_ID,
    scoring_authority_version: result.scoring_authority_version,
    candidate_id: CANDIDATE_ID,
    source_run_id: SOURCE_RUN_ID,
    benchmark_version: result.benchmark_version,
    benchmark_hash: result.benchmark_hash,
    scored_at_iso: result.scored_at_iso,
    authority_distribution: result.authority_distribution,
    assignments: result.assignments,
    case_scores: result.case_scores,
    per_dimension: result.per_dimension,
    aggregate: result.aggregate,
    known_answer_registry_size: result.known_answer_registry_size,
    human_blind_session: null,   // none provided this authorization
    final_status: null,          // Op-Truth §OP.5
    v5_4_4_notes: {
      llm_as_judge_used: false,
      pure_rescore_no_ollama_contact: true,
      concurrent_work_snapshot_reference: "V.5.4.3-002 concurrent work window · see project_nex_v5_4_3_shortlist_decision_2026_09_08.md + doctrine_nex_concurrent_work_attributability_2026_09_08.md",
    },
  };
  const rescorePath = path.join(RESCORE_DIR, `${SCORING_AUTH_ID}.json`);
  fs.writeFileSync(rescorePath, JSON.stringify(rescoreRecord, null, 2), "utf8");
  console.log(`rescore record written to     : ${rescorePath}`);

  // Doctrine reminder
  console.log("");
  console.log("═".repeat(72));
  console.log("REMEMBER · doctrine §2 no-premature-winner · §V.5.4.4 hybrid scoring");
  console.log("═".repeat(72));
  console.log("This is ONE candidate re-scored under hybrid scoring V1.");
  console.log("Do NOT declare a winner. Do NOT promote to chosen_default.");
  console.log("UNKNOWN dimensions honestly reflect pending human blind eval or missing");
  console.log("known-answer references. Founder authors both incrementally.");
  console.log("Six remaining candidates await the SAME hybrid protocol · scoring is frozen.");
  console.log("═".repeat(72));

  process.exit(0);
}
