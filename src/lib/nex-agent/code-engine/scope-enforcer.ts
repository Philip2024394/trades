// src/lib/nex-agent/code-engine/scope-enforcer.ts
//
// NEX1's scope enforcement · every proposed diff is checked against the
// declared_scope BEFORE it reaches the worktree.
//
// Protected paths are hard-blocked even if declared_scope tries to include
// them · this defence-in-depth protects the Independence Constitution.

const PROTECTED_PATHS: readonly string[] = [
  ".env",
  ".env.local",
  "data/nex-image-manifest.json",
  "docs/DECISIONS/0024-", // ADR-0024 image manifest rule
  "docs/DECISIONS/0025-",
  "docs/DECISIONS/0026-",
  "docs/DECISIONS/0027-",
  "docs/DECISIONS/0028-",
  "docs/DECISIONS/0029-",
  "docs/DECISIONS/0030-",
  "docs/DECISIONS/0031-",
  "docs/DECISIONS/0032-",
  "docs/DECISIONS/0033-",
  "docs/DECISIONS/0034-",
  "docs/DECISIONS/0316d-",
  // Test-only protected prefix for Capability H test H5. Any TS file placed
  // under this path is treated as protected by isProtected(). This lets us
  // measure the planner's refusal behaviour without touching real ADRs.
  "data/nex1-code-engine/__protected-fixture__/",
];

export interface ScopeCheck {
  readonly ok: boolean;
  readonly violation?: string;
  readonly violated_path?: string;
}

/**
 * @summary Is protected.
 */
export function isProtected(path: string): boolean {
  return PROTECTED_PATHS.some((p) => path === p || path.startsWith(p));
}

/**
 * Given a proposed diff and NEX1's declared_scope, verify every touched path
 * is inside declared_scope AND is not protected.
 */
export function enforceScope(diff: string, declaredScope: readonly string[]): ScopeCheck {
  const touched = extractTouchedPaths(diff);
  for (const path of touched) {
    if (isProtected(path)) {
      return { ok: false, violation: "protected_path", violated_path: path };
    }
    if (!declaredScope.includes(path)) {
      return { ok: false, violation: "out_of_scope", violated_path: path };
    }
  }
  return { ok: true };
}

/**
 * @summary Parse `+++ b/<path>` and `--- a/<path>` headers to list touched paths.
 */
export function extractTouchedPaths(diff: string): string[] {
  const set = new Set<string>();
  for (const line of diff.split(/\r?\n/)) {
    const m = /^(?:\+\+\+|---)\s+[ab]\/(.+?)\s*$/.exec(line);
    if (m && m[1] !== "/dev/null") set.add(m[1]);
  }
  return Array.from(set);
}
