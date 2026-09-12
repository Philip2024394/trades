// src/lib/nex-agent/code-engine/capability-j-runtime-diagnosis.ts
//
// NEX1 · CAPABILITY J.1 · RUNTIME FAILURE DIAGNOSIS · deterministic · zero LLM.
//
// taught_by = master_ai_engineer · 2026-09-12
// Teaching infrastructure only · NOT NEX1 independent authorship.
//
// Purpose: turn messy Vitest textual output into trustworthy structured
// evidence — a list of typed Nex1RuntimeFailureFinding records — OR emit
// a clean refusal when the input cannot support a structured diagnosis.
//
// Discipline:
//   · deterministic · zero LLM · zero network
//   · REFUSE rather than fabricate: empty output, malformed output, vitest
//     infrastructure crash, permission failure, or unparseable content all
//     produce a `refused` result rather than a guessed finding
//   · classify only into the five known runtime-failure shapes:
//     assertion_mismatch · thrown_error · timeout ·
//     unhandled_rejection · snapshot_mismatch
//   · every finding includes raw_slice so downstream reasoning can verify
//     the extraction against original text
//
// This module intentionally does NOT propose repairs. That is a future
// capability (J.2/J.3). J.1 only converts text → structured evidence.
//
// Removing this module must not remove any NEX1-owned identity, memory,
// evidence, orchestration, ladder, audit, or safety mechanism.

export type Nex1RuntimeFailureKind =
  | "assertion_mismatch"
  | "thrown_error"
  | "timeout"
  | "unhandled_rejection"
  | "snapshot_mismatch";

export interface Nex1RuntimeFailureFinding {
  readonly kind: Nex1RuntimeFailureKind;
  readonly test_file: string | null;
  readonly test_name: string | null;
  readonly expected: string | null;
  readonly actual: string | null;
  readonly assertion: string | null;
  readonly error_class: string | null;
  readonly error_message: string | null;
  readonly stack_hint: string | null;
  readonly timeout_ms: number | null;
  readonly raw_slice: string;
  readonly taught_by: "master_ai_engineer";
}

export type Nex1RuntimeRefusalClass =
  | "empty_output"
  | "no_test_ran"
  | "malformed_output"
  | "vitest_infrastructure_error"
  | "permission_error";

export type Nex1RuntimeExtractResult =
  | {
      readonly kind: "ok";
      readonly findings: readonly Nex1RuntimeFailureFinding[];
      readonly taught_by: "master_ai_engineer";
    }
  | {
      readonly kind: "refused";
      readonly refusal_class: Nex1RuntimeRefusalClass;
      readonly reason: string;
      readonly taught_by: "master_ai_engineer";
    };

const ANSI_RE = /\[[0-9;]*[a-zA-Z]/g;

/**
 * @summary Parse Vitest textual output into a list of structured findings,
 * or emit a clean refusal.
 */
export function extractRuntimeFailures(rawVitestOutput: string): Nex1RuntimeExtractResult {
  const raw = rawVitestOutput ?? "";
  const stripped = raw.replace(ANSI_RE, "");
  const trimmed = stripped.trim();

  // ── Refusal guards ────────────────────────────────────────────────
  if (raw.trim().length === 0) {
    return refused("empty_output", "vitest output was empty · nothing to diagnose");
  }
  if (trimmed.length === 0) {
    return refused(
      "malformed_output",
      "output contained only escape codes / whitespace after stripping · no diagnosable content",
    );
  }

  // Permission failure signatures (before infrastructure so EPERM matches early)
  if (/\bEACCES\b|\bEPERM\b|permission denied/i.test(trimmed)) {
    return refused("permission_error", "output contains permission-error signature (EACCES/EPERM/permission denied)");
  }

  // Vitest infrastructure crash signatures
  if (
    /vitest .* crashed/i.test(trimmed) ||
    /Cannot find package /i.test(trimmed) ||
    /Cannot find module '.*vitest/i.test(trimmed) ||
    /vitest process (?:exited|died|killed) unexpectedly/i.test(trimmed) ||
    /internal error/i.test(trimmed) && !/Test Files/i.test(trimmed)
  ) {
    return refused("vitest_infrastructure_error", "output matches a vitest infrastructure failure signature");
  }

  // No test ran / no test files
  if (/No test files found/i.test(trimmed)) {
    return refused("no_test_ran", "vitest reported no test files were found");
  }

  // ── Malformed guard · sanity-check the shape of the output ─────────
  // A well-formed vitest run has at least one of: "Test Files", "FAIL", "PASS", "Tests ".
  if (!/(?:Test Files|Tests\s+\d|FAIL |PASS |RUN )/i.test(trimmed)) {
    return refused("malformed_output", "output does not contain any recognised vitest markers");
  }

  // ── Find failure blocks ────────────────────────────────────────────
  // A "failure block" starts with a line like `FAIL  path/to/file > describe > it name`
  // and continues until the next FAIL/PASS marker or the summary section.
  const findings: Nex1RuntimeFailureFinding[] = [];
  const failLine = /(?:^|\n)\s*FAIL\s+([^\s>]+)(?:\s*>\s*(.+?))?(?=\n)/g;
  const failMarkers: { path: string; testName: string | null; startIdx: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = failLine.exec(stripped)) !== null) {
    failMarkers.push({ path: m[1].trim(), testName: m[2]?.trim() ?? null, startIdx: m.index });
  }
  // Boundary index for each failure = start of NEXT marker or end of output
  const boundaries = failMarkers.map((fm, i) =>
    i + 1 < failMarkers.length ? failMarkers[i + 1].startIdx : stripped.length,
  );

  for (let i = 0; i < failMarkers.length; i++) {
    const fm = failMarkers[i];
    const block = stripped.slice(fm.startIdx, boundaries[i]);
    const finding = classifyFailureBlock(block, fm.path, fm.testName);
    if (finding) findings.push(finding);
  }

  // Also handle the "❯" arrow test failure marker without a FAIL prefix
  // (some vitest versions place test-name lines inside failures)
  // We can extend this heuristic if needed; for now, use the FAIL scan.

  // If we didn't extract any findings but the output contained known
  // failure markers, that's malformed rather than "ok with zero findings".
  const hasFailIndicator = /FAIL\s+/.test(stripped) || /\bAssertionError\b/.test(stripped);
  if (findings.length === 0 && hasFailIndicator) {
    return refused("malformed_output", "output contained FAIL/AssertionError markers but no block could be parsed");
  }

  return { kind: "ok", findings, taught_by: "master_ai_engineer" };
}

function classifyFailureBlock(block: string, path: string, testName: string | null): Nex1RuntimeFailureFinding | null {
  // Pattern 1 · assertion mismatch via `expect(...).toBe(...)` / toEqual / etc.
  //   Signatures:
  //     "AssertionError: expected 1 to be 2 // Object.is equality"
  //     "Expected: 2 / Received: 1"
  const assertionSig =
    /AssertionError:\s*expected\s+(.+?)\s+to\s+([a-zA-Z]+)\s+(.+)$/m.exec(block) ||
    /Error:\s*expected\s+(.+?)\s+to\s+([a-zA-Z]+)\s+(.+)$/m.exec(block);
  const expectedLine = /Expected:\s*(.+)$/m.exec(block);
  const receivedLine = /Received:\s*(.+)$/m.exec(block);
  const toBeSig = /\.toBe(?:Called)?[A-Za-z]*\(/.test(block);
  if (assertionSig) {
    return finding("assertion_mismatch", path, testName, {
      actual: assertionSig[1].trim(),
      assertion: `to${capitalise(assertionSig[2])}`,
      expected: assertionSig[3].replace(/\s*\/\/.*$/, "").trim(),
      raw_slice: firstNChars(block, 400),
    });
  }
  if (expectedLine && receivedLine) {
    return finding("assertion_mismatch", path, testName, {
      expected: expectedLine[1].trim(),
      actual: receivedLine[1].trim(),
      assertion: toBeSig ? "toBe" : "unknown",
      raw_slice: firstNChars(block, 400),
    });
  }

  // Pattern 2 · timeout
  const timeoutSig = /Test timed out in\s+(\d+)\s*ms/i.exec(block);
  if (timeoutSig) {
    return finding("timeout", path, testName, {
      timeout_ms: Number(timeoutSig[1]),
      raw_slice: firstNChars(block, 400),
    });
  }

  // Pattern 3 · snapshot mismatch
  if (/Snapshot .*(?:mismatch|does not match|didn't match)/i.test(block) || /Snapshot .*"(.+?)"\s+mismatched/i.test(block)) {
    return finding("snapshot_mismatch", path, testName, {
      error_message: (/.*snapshot.*/i.exec(block)?.[0] ?? "").trim(),
      raw_slice: firstNChars(block, 400),
    });
  }

  // Pattern 4 · unhandled rejection
  if (/Unhandled\s+Rejection|Unhandled\s+Error|UnhandledPromiseRejection/i.test(block)) {
    const errClass = /\b(TypeError|ReferenceError|RangeError|SyntaxError|Error)\b/.exec(block)?.[1] ?? null;
    const errMsg = /(?:TypeError|ReferenceError|RangeError|SyntaxError|Error):\s*(.+)$/m.exec(block)?.[1]?.trim() ?? null;
    return finding("unhandled_rejection", path, testName, {
      error_class: errClass,
      error_message: errMsg,
      raw_slice: firstNChars(block, 400),
    });
  }

  // Pattern 5 · thrown error (fallback)
  const errClassSig = /\b(TypeError|ReferenceError|RangeError|SyntaxError|Error)\b:\s*(.+?)$/m.exec(block);
  if (errClassSig) {
    return finding("thrown_error", path, testName, {
      error_class: errClassSig[1],
      error_message: errClassSig[2].trim(),
      stack_hint: (/\s*❯\s+(.+):(\d+):\d+/.exec(block)?.[0] ?? null)?.trim() ?? null,
      raw_slice: firstNChars(block, 400),
    });
  }

  return null;
}

function finding(
  kind: Nex1RuntimeFailureKind,
  test_file: string | null,
  test_name: string | null,
  fields: Partial<Nex1RuntimeFailureFinding>,
): Nex1RuntimeFailureFinding {
  return {
    kind,
    test_file,
    test_name,
    expected: fields.expected ?? null,
    actual: fields.actual ?? null,
    assertion: fields.assertion ?? null,
    error_class: fields.error_class ?? null,
    error_message: fields.error_message ?? null,
    stack_hint: fields.stack_hint ?? null,
    timeout_ms: fields.timeout_ms ?? null,
    raw_slice: fields.raw_slice ?? "",
    taught_by: "master_ai_engineer",
  };
}

function refused(refusal_class: Nex1RuntimeRefusalClass, reason: string): Nex1RuntimeExtractResult {
  return { kind: "refused", refusal_class, reason, taught_by: "master_ai_engineer" };
}

function firstNChars(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n);
}

function capitalise(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
