// src/lib/nex/github-round-trip/branch-name.ts
//
// Stage 8 · deterministic branch naming from (capabilityId · version).
// Same inputs → same branch name (idempotent · re-runnable).

import type { BranchValidation } from "./types";

const CAPABILITY_RE = /^CAP-\d+$/;
const VERSION_RE = /^v\d+\.\d+\.\d+$/;

export function branchNameFor(capabilityId: string, version: string): string {
  return `nex-build/${capabilityId}/${version}`;
}

/**
 * Parse a branch name back into components. Returns null on malformed input.
 */
export function parseBranchName(
  name: string,
): { readonly capabilityId: string; readonly version: string } | null {
  const m = /^nex-build\/(CAP-\d+)\/(v\d+\.\d+\.\d+)$/.exec(name);
  if (!m) return null;
  return { capabilityId: m[1], version: m[2] };
}

export function validateBranch(input: { name: string; capabilityId: string; version: string }): BranchValidation {
  if (!CAPABILITY_RE.test(input.capabilityId)) {
    return { ok: false, code: "sec.branch_bad_capability", reason: "Invalid capability id" };
  }
  if (!VERSION_RE.test(input.version)) {
    return { ok: false, code: "sec.branch_bad_version", reason: "Invalid version" };
  }
  const expected = branchNameFor(input.capabilityId, input.version);
  if (input.name !== expected) {
    return { ok: false, code: "sec.branch_name_mismatch", reason: `Expected ${expected} · got ${input.name}` };
  }
  // Disallow reserved / protected patterns
  if (input.name.startsWith("main") || input.name === "main") {
    return { ok: false, code: "sec.branch_protected", reason: "Cannot use main as feature branch" };
  }
  return { ok: true };
}
