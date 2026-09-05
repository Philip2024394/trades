// NEX Programmer Agent · Phase B · REAL LEARNING LOOP PROOF
// Philip 2026-09-05 · AUTHORIZE §17
//
// One complete learning cycle end-to-end:
//   CAPABILITY GAP → LEARNING QUESTION → SOURCE DISCOVERY →
//   AUTHORITATIVE SOURCE → EVIDENCE CAPTURE → CANDIDATE KNOWLEDGE →
//   INDEPENDENT VERIFICATION (subprocess) → VERIFIED KNOWLEDGE →
//   SKILL DERIVATION → SAFE APPLICATION (isolated tmpdir) →
//   EXPERIENCE → LESSON → RETRIEVABLE NEX LEARNING
//
// Real capability chosen: Node.js fs.readFileSync ENOENT behavior.
// Phase A explicitly captured only the general sync-throws statement ·
// NOT the specific error code. This is a genuine gap.
//
// Researcher (WebFetch) captured partial docs — the specific ENOENT
// description was truncated. Independent VERIFIER (subprocess) is the
// authoritative source for the specific runtime behavior. This is
// exactly the discipline §7 requires.
//
// After the cycle: spawns a FRESH node process (see
// _phase_b_fresh_retrieval.mjs) that reads the persisted store and
// applies the learned skill to a NEW problem to prove §13 §14.

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");

// Route to a dedicated Phase B store directory · so this proof does
// not pollute prior Phase A store · and so the fresh-retrieval runner
// (a second process) can read exactly what this process wrote.
process.env.NEX_PROGRAMMER_LEARNING_DIR = path.join(here, "phase_b_store");

if (!process.env.__PHASE_B_INNER__) {
  const child = spawn(
    "npx",
    ["tsx", fileURLToPath(import.meta.url)],
    { stdio: "inherit", cwd: repoRoot, shell: true, env: { ...process.env, __PHASE_B_INNER__: "1" } },
  );
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  await inner();
}

async function inner() {
  const { _resetProgrammerLearningStoreForTests, newProvenance, generateId } = await import("../../../src/lib/nex/programmer-learning/store.ts");
  const { captureEngineeringEvent } = await import("../../../src/lib/nex/programmer-learning/ingestion.ts");
  const { newLearningQuestion, newLearningRun, researchAndVerifyKnowledge, deriveSkill, promoteSkillAfterApplication, retrieveLatestVerifiedKnowledgeByTechnology } =
    await import("../../../src/lib/nex/programmer-learning/learning-loop.ts");
  const { verifyViaSubprocess } = await import("../../../src/lib/nex/programmer-learning/independent-verifier.ts");
  const { applySkillSafely } = await import("../../../src/lib/nex/programmer-learning/skill-application.ts");
  const { readExperiences, readKnowledge, readSkills, readLearningRuns } = await import("../../../src/lib/nex/programmer-learning/store.ts");
  const { computeLearningStats } = await import("../../../src/lib/nex/programmer-learning/query.ts");

  _resetProgrammerLearningStoreForTests();

  console.log("\n═══ NEX Programmer-Agent Phase B · Learning Loop · REAL ═══\n");

  // ─── STEP 1 · Capability gap + STEP 2 · Learning question ────

  console.log("─── STEP 1-2 · Capability gap + Learning question ───");
  const question = newLearningQuestion({
    gap_statement: "Phase A knowledge for Node.js fs contains only the general 'sync APIs throw' statement. It does NOT specify the error code that fs.readFileSync throws when the file does not exist. NEX cannot safely program error-handling for missing files without this specific knowledge.",
    question: "What error code (err.code) does Node.js fs.readFileSync throw when the file does not exist, and how can NEX safely detect that specific condition versus other filesystem errors?",
    technology: "nodejs",
    domain: "runtime.filesystem.errors",
    scope_bound: "fs.readFileSync missing-file case specifically · not covering EACCES / EISDIR / EMFILE etc.",
    testable_via: "subprocess_probe",
  });
  console.log(`  ✓ question_id=${question.question_id}`);
  console.log(`  ✓ question=${question.question}`);

  const run = newLearningRun(question);
  console.log(`  ✓ run_id=${run.run.run_id}`);

  // ─── STEP 3-4 · Source discovery + evidence capture ──────────

  console.log("\n─── STEP 3-4 · Authoritative source + evidence capture ───");

  // The WebFetch tool captured (out-of-band, before this runner) the
  // following partial content from https://nodejs.org/api/errors.html
  // and https://nodejs.org/api/errors.html#common-system-errors — the
  // truncation is REAL and REPORTED HONESTLY here. This is exactly
  // the discipline §7 requires: the researcher (WebFetch) is NOT the
  // sole verifier. The subprocess below is the independent verifier.
  const nodejsErrorsRawContent = `SOURCE URL: https://nodejs.org/api/errors.html
RETRIEVED AT: ${new Date().toISOString()}
NOTE ON RETRIEVAL INTEGRITY: The docs content was truncated by the
research pipeline. The specific ENOENT description was NOT captured
in the extracted excerpt. What WAS extracted (verbatim):

  "error.code should be used to identify an error rather than
   error.message"

  "System errors are triggered by underlying operating system
   constraints such as attempting to open a file that does not exist"

The specific claim we intend to verify — that err.code === 'ENOENT'
for missing-file readFileSync — is NOT confirmed by this excerpt.
Phase B independent verification is REQUIRED before promotion.`;

  // ─── STEP 5-7 · Candidate knowledge + independent verification + promotion ─

  console.log("\n─── STEP 5-7 · Candidate → Independent verification → Promotion ───");

  const candidateStatement = "fs.readFileSync throws an Error whose `code` property equals the string 'ENOENT' when the target file does not exist.";

  // INDEPENDENT VERIFICATION: subprocess actually runs the code.
  // NOT the researcher · NOT the LLM · a separate deterministic
  // execution environment.
  const subprocessScript = "try{require('fs').readFileSync('/nex_definitely_missing_p0_4_verification_only_x9y8z7');}catch(e){process.stdout.write(e.code||'NO_CODE');process.exit(0);}process.stdout.write('NO_THROW');process.exit(0);";
  const verificationEvidence = await verifyViaSubprocess({
    candidate_claim: candidateStatement,
    expected_outcome: "subprocess stdout equals 'ENOENT'",
    node_script: subprocessScript,
    outcome_matcher: (stdout) => stdout.trim() === "ENOENT",
    mechanism_detail: "spawn(node, [-e, script]) · fixed argv · no shell · 8s timeout",
  });
  console.log(`  ✓ verifier_method=${verificationEvidence.method}`);
  console.log(`  ✓ verifier_passed=${verificationEvidence.passed}`);
  console.log(`  ✓ observed_output(truncated)=${verificationEvidence.observed_output.slice(0, 100).replace(/\n/g, " | ")}`);
  console.log(`  ✓ evidence_pointer=${verificationEvidence.evidence_pointer}`);

  // Now bridge: ingest source + verify + promote
  const rv = await researchAndVerifyKnowledge({
    url: "https://nodejs.org/api/errors.html",
    source_title: "Node.js API · Errors (Common System Errors)",
    technology: "nodejs",
    domain: "runtime.filesystem.errors",
    statement: candidateStatement,
    raw_content: nodejsErrorsRawContent,
    verification: verificationEvidence,
    run,
  });
  console.log(`  ✓ candidate.knowledge_id=${rv.candidate.knowledge_id} · status=${rv.candidate.verification_status}`);
  console.log(`  ✓ verified.knowledge_id=${rv.verified.knowledge_id} · status=${rv.verified.verification_status}`);

  if (!rv.verified_passed || rv.verified.verification_status !== "VERIFIED") {
    console.error("FATAL: verification did not pass · aborting learning cycle");
    run.addError("verification_failed");
    run.complete();
    process.exit(2);
  }

  // ─── STEP 8 · Skill derivation ────────────────────────────────

  console.log("\n─── STEP 8 · Skill derivation from VERIFIED knowledge ───");
  const skill = deriveSkill({
    name: "Safely detect missing-file condition via err.code === 'ENOENT'",
    domain: "nodejs.filesystem.errorHandling",
    description: "Given a file path, safely determine whether the path exists by attempting to open/read it via fs.readFileSync inside try/catch, then check err.code === 'ENOENT' to distinguish 'file missing' from other error conditions (EACCES · EISDIR · etc.). Return a typed { exists: boolean; errorCode: string | null } result.",
    knowledge_dependencies: [rv.verified],
    verification_recipe: "1. Attempt fs.readFileSync(path). 2. If throws, inspect err.code. 3. Report { exists: false, errorCode: 'ENOENT' } iff err.code === 'ENOENT'. 4. Report { exists: false, errorCode: err.code } for other errors. 5. Report { exists: true, errorCode: null } on success.",
    run,
  });
  console.log(`  ✓ skill_id=${skill.skill_id} · state=${skill.promotion_state}`);

  // ─── STEP 9 · Safe application in isolated tmpdir ────────────

  console.log("\n─── STEP 9 · Safe application in isolated tmpdir ───");
  const application = await applySkillSafely({
    skill_id: skill.skill_id,
    skill_name: skill.name,
    task: "Apply ENOENT-detection skill to 2 fixture paths",
    initial_hypothesis: "Existing file → exists=true. Missing file → exists=false, errorCode='ENOENT'",
    related_knowledge: [rv.verified.knowledge_id],
    provenance: newProvenance({
      source: "phase-b-application",
      source_type: "test_runner",
      authority_tier: "TIER_1",
      evidence_pointer: "phase-b:applySkillSafely",
      observed_by: "system",
    }),
    apply_fn: async (tmpDir) => {
      // The application IS the skill — implemented as a small utility
      // using the verified knowledge. This is intentionally the same
      // logic another module could call after retrieval.
      const fs = await import("node:fs");
      const path = await import("node:path");
      function safeReadExists(p) {
        try { fs.readFileSync(p); return { exists: true, errorCode: null }; }
        catch (e) { return { exists: false, errorCode: e?.code ?? "UNKNOWN" }; }
      }
      const existingPath = path.join(tmpDir, "exists.txt");
      fs.writeFileSync(existingPath, "hello");
      const missingPath = path.join(tmpDir, "definitely_missing.txt");

      const existingResult = safeReadExists(existingPath);
      const missingResult = safeReadExists(missingPath);

      const passed =
        existingResult.exists === true
        && existingResult.errorCode === null
        && missingResult.exists === false
        && missingResult.errorCode === "ENOENT";

      return {
        outcome: passed ? "success" : "failure",
        expected_result: "existingResult={exists:true, errorCode:null} · missingResult={exists:false, errorCode:'ENOENT'}",
        actual_result: `existingResult=${JSON.stringify(existingResult)} · missingResult=${JSON.stringify(missingResult)}`,
        evidence: [
          `tmpdir:${tmpDir}`,
          `existing:${existingPath}`,
          `missing:${missingPath}`,
          `runtime:node ${process.version}`,
        ],
        ...(passed ? {} : { root_cause: "runtime behavior differs from verified knowledge" }),
        lessons: passed
          ? ["Verified knowledge matches observed runtime · skill demonstrable in isolated environment"]
          : ["Runtime disagreement · verifier disproved candidate at application time"],
      };
    },
  });
  console.log(`  ✓ experience_id=${application.experience_id}`);
  console.log(`  ✓ application.outcome=${application.outcome}`);
  console.log(`  ✓ application.actual_result=${application.result.actual_result}`);
  run.count("experiences_created", 1);
  run.count("events_captured", 1);  // captureExperience emits an event
  run.addEvent(`applied_skill:${skill.skill_id}:${application.outcome}`);

  // ─── STEP 10-11 · Skill promotion + persistence ──────────────

  console.log("\n─── STEP 10-11 · Promote skill after successful application ───");
  const promotion = promoteSkillAfterApplication({
    skill,
    supporting_experience_id: application.experience_id,
    knowledge_dependencies: [rv.verified],
    target_state: "VERIFIED",
    run,
  });
  console.log(`  ✓ promotion.promoted=${promotion.attempt.promoted} · reason=${promotion.attempt.reason}`);
  if (promotion.attempt.promoted && promotion.new_skill_record) {
    console.log(`  ✓ new_skill_record.promotion_state=${promotion.new_skill_record.promotion_state}`);
  }

  // Track application-outcome event for observability
  captureEngineeringEvent({
    kind: "learning",
    description: `Learning cycle complete for ${question.question}. Verified knowledge + practiced skill + supporting experience.`,
    source: "phase-b-runner",
    source_type: "internal_artifact",
    evidence_pointer: `run:${run.run.run_id}`,
    project: "nex",
    task: `learn:nodejs.fs.ENOENT`,
    status: "CHECKED",
    meta: {
      question_id: question.question_id,
      verified_knowledge_id: rv.verified.knowledge_id,
      skill_id: skill.skill_id,
      experience_id: application.experience_id,
    },
  });
  run.count("events_captured", 1);

  const completed = run.complete();
  console.log(`\n✓ LearningRun persisted · run_id=${completed.run_id} · final_status=${completed.final_status}`);

  // ─── STEP 12-13 · Spawn FRESH process for retrieval + reuse proof ─

  console.log("\n─── STEP 12-13 · Spawn fresh process for retrieval + reuse ───");
  const freshResult = await new Promise((resolve) => {
    const child = spawn(
      "npx",
      ["tsx", path.join(here, "_phase_b_fresh_retrieval.mjs")],
      { stdio: ["ignore", "pipe", "pipe"], cwd: repoRoot, shell: true, env: { ...process.env, __PHASE_B_INNER__: undefined } },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += String(d); process.stdout.write(String(d)); });
    child.stderr.on("data", (d) => { stderr += String(d); process.stderr.write(String(d)); });
    child.on("exit", (code) => resolve({ code, stdout, stderr }));
  });
  console.log(`\n✓ fresh_process exit_code=${freshResult.code}`);

  // ─── Emit summary + report inputs ────────────────────────────

  const stats = computeLearningStats();
  const summary = {
    run,
    stats,
    question,
    candidate_knowledge: rv.candidate,
    verified_knowledge: rv.verified,
    skill_initial: skill,
    skill_promoted: promotion.new_skill_record ?? null,
    application_experience_id: application.experience_id,
    application_outcome: application.outcome,
    verification_evidence: verificationEvidence,
    fresh_retrieval: { exit_code: freshResult.code, stdout_len: freshResult.stdout.length, stderr_len: freshResult.stderr.length },
    latest_verified_retrieval: retrieveLatestVerifiedKnowledgeByTechnology("nodejs"),
    all_learning_runs: readLearningRuns(),
    experiences_total: readExperiences().length,
    knowledge_total: readKnowledge().length,
    skills_total: readSkills().length,
  };
  const summaryPath = path.join(here, "_phase_b_run_summary.json");
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
  console.log(`\n═══ Learning stats ═══`);
  console.log(JSON.stringify(stats, null, 2));
  console.log(`\n→ ${summaryPath}`);
}
