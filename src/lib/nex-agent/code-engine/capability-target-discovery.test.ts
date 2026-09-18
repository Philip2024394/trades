// src/lib/nex-agent/code-engine/capability-target-discovery.test.ts
//
// Vitest suite for Batch 2B target discovery.
// Founder-authorised 2026-09-18.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  discoverTargets,
  extractIdentifierTokens,
  TARGET_DISCOVERY_VERSION,
} from "./capability-target-discovery";

// ── Group A · identifier token extraction ────────────────────────────────

describe("extractIdentifierTokens", () => {
  it("A1 · extracts camelCase", () => {
    expect(extractIdentifierTokens("Please fix computeWorkerPool.")).toEqual([
      "computeWorkerPool",
    ]);
  });

  it("A2 · extracts PascalCase", () => {
    expect(extractIdentifierTokens("The WorkerPoolResult type is wrong."))
      .toEqual(["WorkerPoolResult"]);
  });

  it("A3 · extracts snake_case", () => {
    expect(extractIdentifierTokens("There is a bug in max_retry_count."))
      .toEqual(["max_retry_count"]);
  });

  it("A4 · extracts kebab-case", () => {
    expect(extractIdentifierTokens("The nex-code-brain module is off."))
      .toEqual(["nex-code-brain"]);
  });

  it("A5 · extracts backticked identifier", () => {
    expect(extractIdentifierTokens("Please look at `computeAnswer` today."))
      .toContain("computeAnswer");
  });

  it("A6 · deduplicates repeated tokens", () => {
    const tokens = extractIdentifierTokens(
      "computeAnswer is broken. Please fix computeAnswer.",
    );
    expect(tokens).toEqual(["computeAnswer"]);
  });

  it("A7 · refuses stopwords / generic English", () => {
    expect(extractIdentifierTokens(
      "analyse the code and find the bug and fix the problem",
    )).toEqual([]);
  });

  it("A8 · returns empty on pure prose without identifiers", () => {
    expect(extractIdentifierTokens("What is wrong here?")).toEqual([]);
  });
});

// ── Group B · discovery over a temp scope ────────────────────────────────

describe("discoverTargets · temp scope", () => {
  let tmp: string;
  let repoRoot: string;

  const makeFile = (rel: string, contents: string) => {
    const abs = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents, "utf8");
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nex1-batch2b-"));
    repoRoot = tmp;
    // Simulate a src/ tree
    makeFile("src/lib/computeWorkerPool.ts",
      `export function computeWorkerPool() { return { size: 8 }; }\n`);
    makeFile("src/lib/other.ts",
      `export function other() { return 1; }\n`);
    makeFile("src/lib/deep/computeAnswer.ts",
      `export function computeAnswer(_n: number) { return { value: 41 }; }\n`);
    makeFile("src/lib/unrelated/foo.ts",
      `export const foo = 1;\n`);
    // A file that should be excluded (test file)
    makeFile("src/lib/computeWorkerPool.test.ts",
      `import { computeWorkerPool } from "./computeWorkerPool";\n`);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("B1 · finds a file by exact basename match", () => {
    const r = discoverTargets({
      repo_root: repoRoot,
      user_message: "Please look at computeWorkerPool and tell me what's wrong.",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates.length).toBeGreaterThan(0);
    expect(r.candidates[0].basename).toBe("computeWorkerPool.ts");
    expect(r.candidates[0].matched_tokens).toContain("computeWorkerPool");
    // Excludes the .test.ts variant
    expect(r.candidates.every((c) => !c.path.endsWith(".test.ts"))).toBe(true);
  });

  it("B2 · finds a file by exported symbol when basename differs", () => {
    // Add a file whose basename is different but which exports the symbol
    makeFile("src/lib/mixed.ts", `export function computeExtras() { return 2; }\n`);
    const r = discoverTargets({
      repo_root: repoRoot,
      user_message: "Please look at computeExtras and fix it.",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.candidates[0].basename).toBe("mixed.ts");
    expect(r.candidates[0].match_reason).toBe("exported_symbol");
  });

  it("B3 · ranks exact-basename higher than substring match", () => {
    makeFile("src/lib/reallyLongPrefixComputeWorkerPoolAndMore.ts",
      `export function unrelatedName() { return 0; }\n`);
    const r = discoverTargets({
      repo_root: repoRoot,
      user_message: "computeWorkerPool please",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Exact-basename file must rank first
    expect(r.candidates[0].basename).toBe("computeWorkerPool.ts");
  });

  it("B4 · refuses when no identifier tokens in prose", () => {
    const r = discoverTargets({
      repo_root: repoRoot,
      user_message: "Analyse the code and tell me what is wrong.",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("no_identifier_tokens");
  });

  it("B5 · refuses cleanly when scope dir does not exist", () => {
    const r = discoverTargets({
      repo_root: repoRoot,
      user_message: "look at computeWorkerPool",
      scope_dirs: ["nonexistent-dir"],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("search_scope_empty");
  });

  it("B6 · refuses when tokens are present but none match any file", () => {
    const r = discoverTargets({
      repo_root: repoRoot,
      user_message: "Please investigate someObscureFunctionName",
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.refusal_kind).toBe("traversal_limit_reached_with_no_hits");
  });

  it("B7 · deterministic across two consecutive runs", () => {
    const a = discoverTargets({
      repo_root: repoRoot,
      user_message: "look at computeWorkerPool please",
    });
    const b = discoverTargets({
      repo_root: repoRoot,
      user_message: "look at computeWorkerPool please",
    });
    expect(a).toEqual(b);
  });
});

// ── Group C · version marker ─────────────────────────────────────────────

describe("target discovery · versioning", () => {
  it("C1 · exposes version marker", () => {
    expect(TARGET_DISCOVERY_VERSION).toBe("batch2b.v1");
  });
});
