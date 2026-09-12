#!/usr/bin/env node
// scripts/nex-l4-bakeoff-v5-4-5-rescore-qwen3-8b-known-answer.mjs
//
// V.5.4.5 · RE-SCORE preserved Qwen3-8B transcripts with V.5.4.5 known-answer registry
// Founder BEGIN V.5.4.5 · 2026-09-08
// Scoring authorization ID: V5.4.5-AUTH-RESCORE-QWEN3-8B-CORPUS-V4-KNOWN-ANSWER-001
//
// Loads the same 89 preserved transcripts (V.5.4.3-002 run l4run_c341d462).
// Runs hybrid scoring · which now knows about the V.5.4.5 known-answer registry.
// Every reference in the shipped registry is `draft_pending_review` — so the
// scorer honestly SKIPS them and reports what WOULD change once Founder approves.
//
// Zero Ollama contact. Zero mutation of preserved evidence. Zero V4 corpus change.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const entryFile = fileURLToPath(import.meta.url);

if (!process.env.NEX_V545_INNER) {
  const envFileArgs = fs.existsSync(path.join(repoRoot, ".env.local")) ? ["--env-file=.env.local"] : [];
  const child = spawn("npx", ["tsx", ...envFileArgs, entryFile, ...process.argv.slice(2)], {
    stdio: "inherit", cwd: repoRoot, shell: true,
    env: { ...process.env, NEX_V545_INNER: "1" },
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
    { KNOWN_ANSWER_REGISTRY_V1_5, approvedReferenceCaseIds, allRegistryCaseIds },
  ] = await Promise.all([
    import("../src/lib/nex/l4-bakeoff/corpus-nex-l4-v4.ts"),
    import("../src/lib/nex/l4-bakeoff/hybrid-scoring-v1.ts"),
    import("../src/lib/nex/l4-bakeoff/types.ts"),
    import("../src/lib/nex/l4-bakeoff/known-answer-registry-v1.ts"),
  ]);

  const CANDIDATE_ID = "ollama_qwen3_8b_v1";
  const SCORING_AUTH_ID = "V5.4.5-AUTH-RESCORE-QWEN3-8B-CORPUS-V4-KNOWN-ANSWER-001";
  const TRANSCRIPT_DIR = path.join(repoRoot, "data", "l4-bakeoff", "transcripts", "qwen3-8b");
  const SOURCE_RUN_ID = "l4run_c341d462-fb78-45e3-8881-3a5325fe462d";

  if (!fs.existsSync(TRANSCRIPT_DIR)) {
    console.error(`[v5.4.5-rescore] transcript dir does not exist: ${TRANSCRIPT_DIR}`);
    process.exit(2);
  }

  const files = fs.readdirSync(TRANSCRIPT_DIR).filter((f) => f.startsWith(`${SOURCE_RUN_ID}_`) && f.endsWith(".json"));
  if (files.length === 0) {
    console.error(`[v5.4.5-rescore] no preserved transcripts found for run ${SOURCE_RUN_ID}`);
    process.exit(2);
  }
  const transcripts = files.map((f) => JSON.parse(fs.readFileSync(path.join(TRANSCRIPT_DIR, f), "utf8")));

  const approved = approvedReferenceCaseIds();
  const total = allRegistryCaseIds().size;

  // Banner
  console.log("═".repeat(72));
  console.log("V.5.4.5 · HYBRID RE-SCORE · Qwen3-8B + Founder-authored known-answer references");
  console.log("═".repeat(72));
  console.log(`Scoring authorization ID : ${SCORING_AUTH_ID}`);
  console.log(`Source run ID            : ${SOURCE_RUN_ID} (V.5.4.3-002)`);
  console.log(`Candidate                : ${CANDIDATE_ID}`);
  console.log(`Corpus                   : ${NEX_L4_CORPUS_V4.version} (${NEX_L4_CORPUS_V4.case_count} cases)`);
  console.log(`Preserved transcripts    : ${transcripts.length} loaded`);
  console.log(`Ollama contact           : NONE (pure re-score from preserved evidence)`);
  console.log(`Known-answer registry    : ${total} references authored · ${approved.size} founder_approved · ${total - approved.size} draft_pending_review`);
  console.log(`LLM-as-judge             : ABSENT (doctrine forbids sole authority)`);
  console.log("═".repeat(72));

  // Show shipped references + status (transparency)
  console.log("");
  console.log("V.5.4.5 REGISTRY CONTENT (all drafts by design · Founder edits status to approve)");
  console.log("─".repeat(72));
  for (const ref of KNOWN_ANSWER_REGISTRY_V1_5) {
    console.log(`case_id             : ${ref.case_id}`);
    console.log(`  claim             : ${ref.claim}`);
    console.log(`  expected          : ${ref.expected_answer_summary}`);
    console.log(`  source            : ${ref.authoritative_source}`);
    console.log(`  tier              : ${ref.authority_tier}`);
    console.log(`  match_kind        : ${ref.match_kind}`);
    console.log(`  reference         : ${JSON.stringify(ref.reference)}`);
    console.log(`  review_status     : ${ref.founder_review_status}`);
    console.log(`  content_hash      : ${ref.content_hash}`);
    console.log("");
  }

  // Actual re-score (with current approval state)
  const result = scoreCandidateHybrid({
    candidate_id: CANDIDATE_ID,
    corpus: NEX_L4_CORPUS_V4,
    transcripts,
  });

  console.log("═".repeat(72));
  console.log("AUTHORITY DISTRIBUTION (with current approvals)");
  console.log("═".repeat(72));
  const d = result.authority_distribution;
  console.log(`automated_deterministic  : ${d.automated_deterministic}`);
  console.log(`known_answer             : ${d.known_answer}  (0 today · will grow as Founder approves references)`);
  console.log(`safety_deterministic     : ${d.safety_deterministic}`);
  console.log(`measured_metric          : ${d.measured_metric}`);
  console.log(`human_blind_eval         : ${d.human_blind_eval}`);
  console.log(`total                    : ${d.total}`);

  console.log("");
  console.log("═".repeat(72));
  console.log("PER-DIMENSION CLASSIFICATIONS (V.5.4.5 hybrid · current approvals)");
  console.log("═".repeat(72));
  console.log("dimension                              cases pass fail unk  rate     classification");
  console.log("-".repeat(88));
  const sorted = [...result.per_dimension].sort((a, b) => a.dimension.localeCompare(b.dimension));
  for (const dim of sorted) {
    const isCritical = CRITICAL_DIMENSIONS.includes(dim.dimension);
    const marker = isCritical ? "*" : " ";
    const rateStr = dim.pass_rate === "unknown" ? "     n/a" : dim.pass_rate.toFixed(3);
    console.log(`${marker}${dim.dimension.padEnd(37)} ${String(dim.case_count).padStart(5)} ${String(dim.pass_count).padStart(4)} ${String(dim.fail_count).padStart(4)} ${String(dim.unknown_count).padStart(3)} ${rateStr.padStart(8)}  ${dim.classification}`);
  }
  console.log("(* = CRITICAL dimension · Frontier Floor Rule)");

  // What WOULD change if Founder approved every draft
  console.log("");
  console.log("═".repeat(72));
  console.log("FORECAST · what changes if Founder approves the 3 drafts (illustrative · not applied)");
  console.log("═".repeat(72));
  console.log("For each shipped draft reference · inspect Qwen3-8B's actual response and forecast pass/fail:");
  const transcriptByCase = new Map(transcripts.map((t) => [t.case_id, t]));
  for (const ref of KNOWN_ANSWER_REGISTRY_V1_5) {
    const t = transcriptByCase.get(ref.case_id);
    if (!t) { console.log(`  ${ref.case_id.padEnd(36)} : no transcript found`); continue; }
    const text = (t.response_text ?? "").toLowerCase();
    let wouldPass = false;
    let matchNote = "";
    switch (ref.match_kind) {
      case "exact":
        wouldPass = typeof ref.reference === "string" && t.response_text?.trim() === ref.reference.trim();
        matchNote = wouldPass ? "exact match" : "no exact match";
        break;
      case "substring":
        wouldPass = typeof ref.reference === "string" && text.includes(String(ref.reference).toLowerCase());
        matchNote = wouldPass ? `contains "${ref.reference}"` : `does not contain "${ref.reference}"`;
        break;
      case "regex":
        wouldPass = typeof ref.reference === "string" && new RegExp(ref.reference, "i").test(t.response_text ?? "");
        matchNote = wouldPass ? "regex match" : "no regex match";
        break;
      case "any_of_substrings":
        if (Array.isArray(ref.reference)) {
          const hit = ref.reference.find((r) => text.includes(String(r).toLowerCase()));
          wouldPass = hit !== undefined;
          matchNote = wouldPass ? `contains "${hit}"` : `contains none of [${ref.reference.slice(0, 3).join(", ")}...]`;
        }
        break;
    }
    const responsePreview = (t.response_text ?? "").slice(0, 120).replace(/\n/g, " ");
    console.log(`  ${ref.case_id.padEnd(36)} : ${wouldPass ? "PASS" : "FAIL"} · ${matchNote}`);
    console.log(`    response preview                     : "${responsePreview}${(t.response_text ?? "").length > 120 ? "..." : ""}"`);
  }

  // Persistence
  console.log("");
  console.log("═".repeat(72));
  console.log("RE-SCORE RECORD (immutable · Op-Truth §OP.5 · final_status:null)");
  console.log("═".repeat(72));
  const RESCORE_DIR = path.join(repoRoot, "data", "l4-bakeoff", "rescores");
  if (!fs.existsSync(RESCORE_DIR)) fs.mkdirSync(RESCORE_DIR, { recursive: true });
  const rescoreRecord = {
    scoring_authorization_id: SCORING_AUTH_ID,
    scoring_authority_version: "v1.5",
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
    known_answer_registry_approved_count: result.known_answer_registry_approved_count,
    known_answer_registry_draft_count: result.known_answer_registry_draft_count,
    human_blind_session: null,
    final_status: null,
    v5_4_5_notes: {
      llm_as_judge_used: false,
      pure_rescore_no_ollama_contact: true,
      known_answer_registry_state: "all_drafts_pending_founder_review",
      forecast_available_in_stdout: true,
    },
  };
  const rescorePath = path.join(RESCORE_DIR, `${SCORING_AUTH_ID}.json`);
  fs.writeFileSync(rescorePath, JSON.stringify(rescoreRecord, null, 2), "utf8");
  console.log(`rescore record written to     : ${rescorePath}`);

  // Doctrine reminder
  console.log("");
  console.log("═".repeat(72));
  console.log("REMEMBER · doctrine §2 no-premature-winner · §V.5.4.4 hybrid · §V.5.4.5 immutable references");
  console.log("═".repeat(72));
  console.log("References are DRAFT until Founder approves · scorer refuses to use drafts.");
  console.log("Forecast section above shows what WOULD happen for the 3 shipped drafts.");
  console.log("Founder review = code review of known-answer-registry-v1.ts · edit status field.");
  console.log("═".repeat(72));

  process.exit(0);
}
