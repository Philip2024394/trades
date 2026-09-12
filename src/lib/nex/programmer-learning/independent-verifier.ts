// src/lib/nex/programmer-learning/independent-verifier.ts
//
// NEX Programmer Agent · Phase B · Independent verifier
// Philip 2026-09-05 · AUTHORIZE · PHASE B
//
// Discipline (AUTHORIZE §7):
//   The model that RESEARCHES the information must NOT be the sole
//   authority for VERIFICATION. Verification runs a DIFFERENT
//   mechanism (subprocess execution · file inspection · deterministic
//   test) and can REJECT the researcher's candidate.
//
// Verification methods available in Phase B:
//   · subprocess_probe · spawn a Node process and inspect its output
//   · deterministic_test · run a small unit-test-shaped assertion
//   · file_inspection · read a file and check invariants
//   · cross_source · compare candidate against a second Tier-1 source
//
// Every verification produces a VerificationEvidence record with:
//   · method identifier
//   · what was executed / read / compared
//   · observed output (raw)
//   · expected outcome
//   · pass/fail
//   · pointer to on-disk evidence (log file)
//
// The verifier is INTENTIONALLY SIMPLE — it uses Node stdlib only,
// no LLM, no shell interpolation of user input, no network fetches.
// Subprocess execution uses a fixed argv array (no shell) with a
// bounded timeout. The verifier can reject any candidate.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateId, programmerLearningDir, stableHash } from "./store";

// ─── Types ──────────────────────────────────────────────────────

export type VerificationMethod =
  | "subprocess_probe"
  | "deterministic_test"
  | "file_inspection"
  | "cross_source";

export type VerificationEvidence = {
  verification_id: string;
  method: VerificationMethod;
  candidate_claim: string;
  expected_outcome: string;
  observed_output: string;
  passed: boolean;
  evidence_pointer: string;
  duration_ms: number;
  timestamp: string;
  /** Optional detail about the mechanism used (script path, source URL, etc.) */
  mechanism_detail?: string;
};

// ─── Subprocess probe ───────────────────────────────────────────

/** Run a small Node.js script as a subprocess and inspect its output.
 *
 *  SAFETY:
 *   · uses spawn(node, [-e, script]) — no shell, no interpolation
 *   · caller-supplied script must be a string literal (not user-derived)
 *   · bounded timeout (default 8s)
 *   · captures stdout+stderr for evidence
 *
 *  This is how NEX independently verifies runtime behavior of the
 *  language/runtime under study. The researcher may say "fs.readFileSync
 *  throws ENOENT on missing files" — the verifier ACTUALLY runs it. */
export async function verifyViaSubprocess(input: {
  candidate_claim: string;
  expected_outcome: string;
  node_script: string;              // string literal · NEVER user input
  timeout_ms?: number;
  outcome_matcher: (stdout: string, stderr: string, exit_code: number | null) => boolean;
  mechanism_detail?: string;
}): Promise<VerificationEvidence> {
  const started = Date.now();
  const timeout = Math.max(1000, Math.min(input.timeout_ms ?? 8000, 30000));

  const result = await new Promise<{ stdout: string; stderr: string; exit_code: number | null; timed_out: boolean }>((resolve) => {
    const child = spawn(process.execPath, ["-e", input.node_script], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout?.on("data", (d) => { stdout += String(d); });
    child.stderr?.on("data", (d) => { stderr += String(d); });
    child.on("error", (e) => { stderr += String(e); resolve({ stdout, stderr, exit_code: null, timed_out: false }); });
    child.on("exit", (code, signal) => {
      timedOut = signal === "SIGTERM";
      resolve({ stdout, stderr, exit_code: code, timed_out: timedOut });
    });
  });

  const passed = !result.timed_out && input.outcome_matcher(result.stdout, result.stderr, result.exit_code);
  const observed = `EXIT=${result.exit_code}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}${result.timed_out ? "\n[TIMED_OUT]" : ""}`;

  const verification_id = generateId("run");
  const evidencePath = writeEvidenceFile(verification_id, {
    method: "subprocess_probe",
    candidate: input.candidate_claim,
    expected: input.expected_outcome,
    node_script: input.node_script,
    observed,
    passed,
  });

  return {
    verification_id,
    method: "subprocess_probe",
    candidate_claim: input.candidate_claim,
    expected_outcome: input.expected_outcome,
    observed_output: observed.slice(0, 4000),
    passed,
    evidence_pointer: evidencePath,
    duration_ms: Date.now() - started,
    timestamp: new Date().toISOString(),
    mechanism_detail: input.mechanism_detail ?? "node -e (subprocess)",
  };
}

// ─── Deterministic-test verification ────────────────────────────

/** Run a caller-supplied synchronous test function and record its
 *  outcome as an independent-verifier evidence record. The function
 *  is expected to be side-effect-free and to return a boolean. Errors
 *  are captured as failure with the error message in observed_output. */
export function verifyViaDeterministicTest(input: {
  candidate_claim: string;
  expected_outcome: string;
  test_fn: () => boolean;
  mechanism_detail?: string;
}): VerificationEvidence {
  const started = Date.now();
  let passed = false;
  let observed = "";
  try {
    const result = input.test_fn();
    passed = result === true;
    observed = `deterministic_test returned: ${String(result)}`;
  } catch (e) {
    passed = false;
    observed = `deterministic_test threw: ${String((e as Error)?.message ?? e)}`;
  }
  const verification_id = generateId("run");
  const evidencePath = writeEvidenceFile(verification_id, {
    method: "deterministic_test",
    candidate: input.candidate_claim,
    expected: input.expected_outcome,
    observed,
    passed,
  });
  return {
    verification_id,
    method: "deterministic_test",
    candidate_claim: input.candidate_claim,
    expected_outcome: input.expected_outcome,
    observed_output: observed,
    passed,
    evidence_pointer: evidencePath,
    duration_ms: Date.now() - started,
    timestamp: new Date().toISOString(),
    mechanism_detail: input.mechanism_detail ?? "in-process deterministic test",
  };
}

// ─── Cross-source verification ──────────────────────────────────

/** Compare a candidate statement against a second authoritative source's
 *  content. Passes when the second source contains a supporting token
 *  set (all required tokens present · at least one contradicting token
 *  ABSENT). No LLM. Simple string containment. */
export function verifyViaCrossSource(input: {
  candidate_claim: string;
  expected_outcome: string;
  second_source_content: string;
  required_tokens: string[];           // ALL must appear
  forbidden_tokens?: string[];         // if any present · fails
  mechanism_detail?: string;
}): VerificationEvidence {
  const started = Date.now();
  const haystack = input.second_source_content.toLowerCase();
  const missingRequired = input.required_tokens.filter((t) => !haystack.includes(t.toLowerCase()));
  const presentForbidden = (input.forbidden_tokens ?? []).filter((t) => haystack.includes(t.toLowerCase()));
  const passed = missingRequired.length === 0 && presentForbidden.length === 0;
  const observed = `required_missing=[${missingRequired.join(", ")}] forbidden_present=[${presentForbidden.join(", ")}]`;
  const verification_id = generateId("run");
  const evidencePath = writeEvidenceFile(verification_id, {
    method: "cross_source",
    candidate: input.candidate_claim,
    expected: input.expected_outcome,
    observed,
    passed,
    required: input.required_tokens,
    forbidden: input.forbidden_tokens ?? [],
    second_source_hash: stableHash(input.second_source_content),
  });
  return {
    verification_id,
    method: "cross_source",
    candidate_claim: input.candidate_claim,
    expected_outcome: input.expected_outcome,
    observed_output: observed,
    passed,
    evidence_pointer: evidencePath,
    duration_ms: Date.now() - started,
    timestamp: new Date().toISOString(),
    mechanism_detail: input.mechanism_detail ?? "cross-source token comparison",
  };
}

// ─── Evidence file writer (dedicated verification/ subdir) ──────

function writeEvidenceFile(verification_id: string, payload: unknown): string {
  const root = programmerLearningDir();
  const dir = path.join(root, "verifications");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filename = `${verification_id}.json`;
  const p = path.join(dir, filename);
  writeFileSync(p, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return `programmer-learning/verifications/${filename}`;
}

// Guard against unused-import lint (some builds strip these)
void fileURLToPath;
