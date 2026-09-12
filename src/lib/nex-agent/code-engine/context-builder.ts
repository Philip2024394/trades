// src/lib/nex-agent/code-engine/context-builder.ts
//
// NEX1's context builder · assembles the reasoning context under strict
// allowlist rules · never sends secrets or protected content to adapters.

import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve as pathResolve } from "node:path";
import type { Nex1FileSlice, Nex1ReasoningContext } from "./types";
import { isProtected } from "./scope-enforcer";

const REPO_ROOT = process.cwd();
const MAX_SLICE_BYTES = 40_000;

// Sprint-1 hardening (2026-09-12): Challenge 3.B exposed a false-positive on
// files that contain SECRET-SHAPED REGEX FIXTURES (e.g. code-engine.test.ts
// contains /sk-[A-Za-z0-9_-]{20,}/ as a test pattern for the scanner itself).
// NEX1's context-builder now distinguishes:
//   (a) actual credential-looking literals inside string quotes → BLOCK
//   (b) regex-syntax patterns that describe secret SHAPES → ALLOW (they teach the scanner)
//   (c) test / spec files → apply the STRICT variant that only matches quoted literals
//
// PEM private-key banners remain absolutely rejected everywhere.
const SECRET_PATTERNS_STRICT: readonly RegExp[] = [
  // Only match if the token appears inside a quoted string literal
  /(["'])sk-[A-Za-z0-9_-]{30,}\1/,
  /(["'])sk_live_[A-Za-z0-9]{20,}\1/,
  /(["'])re_[A-Za-z0-9_]{20,}\1/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:api[_-]?key|token|secret)\s*[:=]\s*["'][A-Za-z0-9._-]{20,}["']/i,
];
const SECRET_PATTERNS_LOOSE: readonly RegExp[] = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /sk_live_[A-Za-z0-9]+/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /re_[A-Za-z0-9_]+/,
  /(?:api[_-]?key|token|secret)\s*[:=]\s*["'][A-Za-z0-9._-]{16,}/i,
];

function isTestOrFixturePath(path: string | undefined): boolean {
  if (!path) return false;
  return /\.(?:test|spec)\.[jt]sx?$/.test(path) || /(?:^|\/)(?:tests?|fixtures)\//.test(path);
}

export interface BuildContextInput {
  readonly taskPrompt: string;
  readonly declaredScope: readonly string[];
  readonly relevantAdrs?: readonly string[];
  readonly repoRoot?: string;
}

export interface BuildContextResult {
  readonly ok: boolean;
  readonly context?: Nex1ReasoningContext;
  readonly reason?: string;
  readonly rejectedPath?: string;
}

/**
 * @summary Build the reasoning context by reading every file in declaredScope · rejecting protected or secret-containing content.
 */
export function buildContext(input: BuildContextInput): BuildContextResult {
  const root = input.repoRoot ?? REPO_ROOT;
  const slices: Nex1FileSlice[] = [];
  for (const rel of input.declaredScope) {
    if (isProtected(rel)) {
      return { ok: false, reason: "declared_scope contains protected path", rejectedPath: rel };
    }
    const abs = pathResolve(root, rel);
    if (!abs.startsWith(root)) {
      return { ok: false, reason: "declared_scope escapes repo root", rejectedPath: rel };
    }
    if (existsSync(abs)) {
      const st = statSync(abs);
      if (!st.isFile()) {
        return { ok: false, reason: "declared_scope entry is not a file", rejectedPath: rel };
      }
      if (st.size > MAX_SLICE_BYTES) {
        return { ok: false, reason: `file exceeds ${MAX_SLICE_BYTES} bytes`, rejectedPath: rel };
      }
      const content = readFileSync(abs, "utf8");
      if (containsSecret(content, rel)) {
        return { ok: false, reason: "secret pattern detected in file", rejectedPath: rel };
      }
      slices.push({
        path: rel,
        content,
        content_hash: sha256(content),
      });
    }
    // Non-existent paths are fine · NEX1 may be requesting a scaffold of a new file
  }
  const context: Nex1ReasoningContext = {
    task_prompt: input.taskPrompt,
    repo_snapshot_hash: sha256(slices.map((s) => `${s.path}:${s.content_hash}`).join("|")),
    file_slices: slices,
    relevant_adrs: input.relevantAdrs ?? [],
    declared_scope: input.declaredScope,
  };
  return { ok: true, context };
}

/**
 * @summary Contains secret.
 */
/**
 * @summary Detect credential-looking content in a file.
 * @remarks
 * · Test / spec / fixtures paths use the STRICT variant so they may legitimately
 *   contain regex patterns describing secret shapes (as scanner fixtures do).
 * · Non-test paths use the LOOSE variant which matches bare tokens too.
 * · PEM private-key banners always block regardless of path.
 */
export function containsSecret(text: string, filePath?: string): boolean {
  const patterns = isTestOrFixturePath(filePath) ? SECRET_PATTERNS_STRICT : SECRET_PATTERNS_LOOSE;
  return patterns.some((r) => r.test(text));
}

/**
 * @summary Compute the SHA-256 hex of an input string · deterministic.
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
