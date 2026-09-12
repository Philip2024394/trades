// src/lib/nex/section-build/semver.ts
//
// Semver helpers for section revisions. Scope per ADR-0316c §4.3:
//   - v1.N within same feature scope (founder change requests)
//   - v1.N → v2.0 requires founder-authored ADR (major scope change)
//   - Master AI does NOT autonomously bump major

import type { SemverParts } from "./types";

const SEMVER_RE = /^v(\d+)\.(\d+)\.(\d+)$/;

export function parseSemver(v: string): SemverParts | null {
  const m = SEMVER_RE.exec(v);
  if (!m) return null;
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
  };
}

export function formatSemver(p: SemverParts): string {
  return `v${p.major}.${p.minor}.${p.patch}`;
}

/**
 * Increment PATCH · used for internal fixes NOT prompted by a founder change request.
 * (e.g. NEX1 self-correction cycle).
 */
export function bumpPatch(v: string): string {
  const p = parseSemver(v);
  if (!p) throw new Error(`Invalid semver: ${v}`);
  return formatSemver({ ...p, patch: p.patch + 1 });
}

/**
 * Increment MINOR · used when a founder change request spawns a new revision.
 * Resets patch to 0.
 */
export function bumpMinor(v: string): string {
  const p = parseSemver(v);
  if (!p) throw new Error(`Invalid semver: ${v}`);
  return formatSemver({ major: p.major, minor: p.minor + 1, patch: 0 });
}

/**
 * Increment MAJOR · FOUNDER-ONLY. Master AI must not call this without
 * an explicit founder-authored ADR authorising the major scope change.
 * A helper is provided so the intent is explicit in code.
 */
export function bumpMajor(v: string): string {
  const p = parseSemver(v);
  if (!p) throw new Error(`Invalid semver: ${v}`);
  return formatSemver({ major: p.major + 1, minor: 0, patch: 0 });
}

/**
 * Compare two semver strings · returns -1 · 0 · 1 like standard comparator.
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) throw new Error(`Invalid semver: ${a} or ${b}`);
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;
  return 0;
}
