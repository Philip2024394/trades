// scripts/nex-canonical/rule-5m-proof-aggregator.ts
//
// Rule 5m · Proof Aggregator.
//
// SEALED CLAIM:
//   Enumerates the 7 Rule 5m proofs proposed in
//   `docs/doctrine/nex-rule-5m-proof-manifest-2026-10-09.md`, checks each
//   proof's prerequisites + evidence, and emits a `rule-5m-proof.json`
//   artefact with per-proof status.
//
// SAFETY:
//   This script does NOT run the live backfill. It does NOT connect to any
//   DB. It does NOT read the live canonical pool. It reads the repository's
//   test files + fixture files + runs the dedicated proof vitest files
//   subprocess-style and parses the outcome.
//
// USAGE:
//   npx tsx scripts/nex-canonical/rule-5m-proof-aggregator.ts
//     [--json <path>]  emit result JSON to <path> (default: ./rule-5m-proof.json)
//     [--strict]       exit non-zero if any proof is not PASS
//
// OUTPUT CONTRACT:
//   The emitted artefact is a REPORT, not itself a proof. The proofs are
//   the underlying tests + fixtures. This script summarises their current
//   state so a founder reviewing the artefact can see what is / is not
//   satisfied.

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

// ═════════════════════════════════════════════════════════════════════
// §1 · Proof manifest
// ═════════════════════════════════════════════════════════════════════

type ProofStatus = "PASS" | "PARTIAL" | "FAIL" | "MISSING";

interface ProofEntry {
  readonly id: number;
  readonly name: string;
  readonly statement: string;
  readonly prerequisites: readonly string[]; // file paths relative to repo root
  readonly dedicated_test?: string;          // vitest file path
}

const REPO_ROOT = path.resolve(__dirname, "..", "..");

const PROOFS: readonly ProofEntry[] = [
  {
    id: 1,
    name: "Seed cohort provenance",
    statement:
      "Seed cohort file exists, ≥50 records, every record approved_by=founder, R1-R10 ≥3 seeds each",
    prerequisites: ["tests/fixtures/canonical/seed-cohort-v1.jsonl"],
  },
  {
    id: 2,
    name: "Eval corpus provenance",
    statement:
      "Positive/negative/ambiguous corpus files exist, pair counts met, labelled_by sealed, append-only revisions",
    prerequisites: [
      "tests/fixtures/eval/positive-pairs-v1.jsonl",
      "tests/fixtures/eval/negative-pairs-v1.jsonl",
      "tests/fixtures/eval/ambiguous-pairs-v1.jsonl",
    ],
  },
  {
    id: 3,
    name: "Resolver determinism",
    statement:
      "Byte-identical candidate + pool → byte-stable resolver verdict across 100 repeats",
    prerequisites: [],
    dedicated_test: "scripts/nex-canonical/rule-5m-proof-3-determinism.test.ts",
  },
  {
    id: 4,
    name: "Rule-5j HARD gates (false-merge ≤ 1%, precision ≥ 98%)",
    statement:
      "Measurement run on eval corpus satisfies both HARD gates; no threshold relaxation",
    prerequisites: [
      "tests/fixtures/canonical/seed-cohort-v1.jsonl",
      "tests/fixtures/eval/positive-pairs-v1.jsonl",
      "tests/fixtures/eval/negative-pairs-v1.jsonl",
      "scripts/nex-canonical/eval-measurement-runner.ts",
    ],
  },
  {
    id: 5,
    name: "Rule-5j SOFT gates (recall ≥ 70%, abstention ≥ 80%)",
    statement:
      "Measurement run on eval corpus satisfies both SOFT gates; expansion is OK, relaxation is not",
    prerequisites: [
      "tests/fixtures/canonical/seed-cohort-v1.jsonl",
      "tests/fixtures/eval/positive-pairs-v1.jsonl",
      "tests/fixtures/eval/ambiguous-pairs-v1.jsonl",
      "scripts/nex-canonical/eval-measurement-runner.ts",
    ],
  },
  {
    id: 6,
    name: "Abstention safety at the write boundary",
    statement:
      "Zero AMBIGUOUS verdict reaches canonical write; precheckHandoff always refuses with reason=resolver_ambiguous",
    prerequisites: [],
    dedicated_test:
      "scripts/nex-canonical/rule-5m-proof-6-abstention-safety.test.ts",
  },
  {
    id: 7,
    name: "Reproducibility of measurement",
    statement:
      "Measurement artefact records corpus + resolver module hashes; re-running on same hashes is byte-identical",
    prerequisites: [
      "scripts/nex-canonical/eval-measurement-runner.ts",
    ],
    dedicated_test:
      "scripts/nex-canonical/rule-5m-proof-7-reproducibility.test.ts",
  },
];

// ═════════════════════════════════════════════════════════════════════
// §2 · Prerequisite + test runners
// ═════════════════════════════════════════════════════════════════════

interface ProofResult {
  readonly id: number;
  readonly name: string;
  readonly statement: string;
  readonly status: ProofStatus;
  readonly prerequisite_check: ReadonlyArray<{
    readonly path: string;
    readonly exists: boolean;
  }>;
  readonly dedicated_test_file: string | null;
  readonly dedicated_test_status: "PASS" | "FAIL" | "NOT_RUN";
  readonly blocker: string | null;
}

function checkPrerequisites(
  proof: ProofEntry,
): ReadonlyArray<{ path: string; exists: boolean }> {
  return proof.prerequisites.map((p) => ({
    path: p,
    exists: fs.existsSync(path.join(REPO_ROOT, p)),
  }));
}

function runDedicatedTest(testPath: string): "PASS" | "FAIL" | "NOT_RUN" {
  const abs = path.join(REPO_ROOT, testPath);
  if (!fs.existsSync(abs)) return "NOT_RUN";
  try {
    execSync(
      `npx vitest run --config scripts/nex-canonical/vitest.local.config.ts ${testPath}`,
      {
        cwd: REPO_ROOT,
        stdio: "pipe",
        timeout: 60000,
      },
    );
    return "PASS";
  } catch {
    return "FAIL";
  }
}

function evaluateProof(proof: ProofEntry): ProofResult {
  const prereqChecks = checkPrerequisites(proof);
  const missingPrereqs = prereqChecks.filter((c) => !c.exists);
  const dedicatedTest = proof.dedicated_test ?? null;
  const dedicatedResult = dedicatedTest
    ? runDedicatedTest(dedicatedTest)
    : "NOT_RUN";

  let status: ProofStatus;
  let blocker: string | null = null;

  if (missingPrereqs.length > 0) {
    status = "MISSING";
    blocker = `Missing prerequisite(s): ${missingPrereqs.map((c) => c.path).join(", ")}`;
  } else if (dedicatedTest === null) {
    status = "PARTIAL";
    blocker = "No dedicated proof test file bound";
  } else if (dedicatedResult === "FAIL") {
    status = "FAIL";
    blocker = `Dedicated test failed: ${dedicatedTest}`;
  } else if (dedicatedResult === "PASS") {
    status = "PASS";
  } else {
    status = "MISSING";
    blocker = `Dedicated test file missing: ${dedicatedTest}`;
  }

  return {
    id: proof.id,
    name: proof.name,
    statement: proof.statement,
    status,
    prerequisite_check: prereqChecks,
    dedicated_test_file: dedicatedTest,
    dedicated_test_status: dedicatedResult,
    blocker,
  };
}

// ═════════════════════════════════════════════════════════════════════
// §3 · Main
// ═════════════════════════════════════════════════════════════════════

function parseArgs(argv: readonly string[]): {
  jsonPath: string;
  strict: boolean;
} {
  let jsonPath = path.join(REPO_ROOT, "rule-5m-proof.json");
  let strict = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json" && i + 1 < argv.length) {
      jsonPath = argv[++i];
    } else if (argv[i] === "--strict") {
      strict = true;
    }
  }
  return { jsonPath, strict };
}

export function aggregate(): {
  readonly manifest_doc: string;
  readonly generated_at: string;
  readonly proofs: readonly ProofResult[];
  readonly summary: {
    readonly pass: number;
    readonly partial: number;
    readonly fail: number;
    readonly missing: number;
    readonly all_seven_pass: boolean;
  };
} {
  const proofs = PROOFS.map(evaluateProof);
  const summary = {
    pass: proofs.filter((p) => p.status === "PASS").length,
    partial: proofs.filter((p) => p.status === "PARTIAL").length,
    fail: proofs.filter((p) => p.status === "FAIL").length,
    missing: proofs.filter((p) => p.status === "MISSING").length,
    all_seven_pass: proofs.every((p) => p.status === "PASS"),
  };

  return {
    manifest_doc: "docs/doctrine/nex-rule-5m-proof-manifest-2026-10-09.md",
    generated_at: new Date().toISOString(),
    proofs,
    summary,
  };
}

function main() {
  const { jsonPath, strict } = parseArgs(process.argv.slice(2));
  const report = aggregate();

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");

  console.log("Rule 5m · Proof Aggregator");
  console.log("─".repeat(80));
  for (const p of report.proofs) {
    const marker =
      p.status === "PASS" ? "✓" : p.status === "PARTIAL" ? "~" : "✗";
    console.log(`  ${marker} Proof ${p.id} · ${p.name} · ${p.status}`);
    if (p.blocker) {
      console.log(`      → ${p.blocker}`);
    }
  }
  console.log("─".repeat(80));
  console.log(
    `Summary: PASS=${report.summary.pass} PARTIAL=${report.summary.partial} FAIL=${report.summary.fail} MISSING=${report.summary.missing}`,
  );
  console.log(`all_seven_pass: ${report.summary.all_seven_pass}`);
  console.log(`Artefact written to: ${jsonPath}`);

  if (strict && !report.summary.all_seven_pass) {
    process.exit(1);
  }
}

const isMain = (() => {
  try {
    return require.main === module;
  } catch {
    return false;
  }
})();

if (isMain) {
  main();
}
