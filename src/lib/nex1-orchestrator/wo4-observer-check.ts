// WO-WORKSTATION-04 · Observer-side verification
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// After the Broker has finished executing the writes, an independent
// filesystem walk confirms the observed on-disk state matches the diff we
// intended. This is the "Observer independently sees what actually changed"
// acceptance criterion.
//
// Uses the existing IndependentObserver at
// src/lib/nex-independent-observer/observer.ts — its walk() returns a
// Map<workspace-relative-path, { sha256 (16 truncated), size }>. We compare
// that against the bundle's candidate_files' expected content hashes,
// truncated to the same 16-char form the observer produces.

import { createHash } from "node:crypto";
import { IndependentObserver } from "@/lib/nex-independent-observer/observer";
import type { AuthorisedDiffBundle } from "./wo3-types";
import type { ObserverVerdict, ObserverFileFinding } from "./wo4-types";

/** Truncate a full 64-char sha256 hex to the 16-char form Observer + Broker
 *  emit. Used only for comparison. */
function shortHash(fullHexOrRaw: string): string {
  // If already truncated (16 chars), return as-is; otherwise slice.
  if (/^[0-9a-f]{16}$/.test(fullHexOrRaw)) return fullHexOrRaw;
  return fullHexOrRaw.slice(0, 16);
}

/**
 * Perform the observer walk + reconcile against the intended diff.
 * Returns a verdict describing MATCH or the specific mismatches. Never
 * throws for expected-domain errors.
 *
 * Observer walk is REAL — reads every file under workspace_root through
 * the existing IndependentObserver. Independent of the Broker event log:
 * we walk what's actually there.
 */
export async function observerCheck(input: {
  readonly bundle: AuthorisedDiffBundle;
  readonly workspace_root: string;
  readonly broker_public_key_der_hex: string;
  readonly clock?: () => string;
}): Promise<ObserverVerdict> {
  const clock = input.clock ?? (() => new Date().toISOString());
  const observer = new IndependentObserver(input.broker_public_key_der_hex);
  const walk_started_at = clock();
  const walk = await observer.walk(input.workspace_root);
  const walk_completed_at = clock();

  const findings: ObserverFileFinding[] = [];

  // Every candidate must be present with the expected short hash
  for (const candidate of input.bundle.candidate_files) {
    const expected_short = shortHash(candidate.content_hash);
    const observed = walk.get(candidate.path);
    if (!observed) {
      findings.push({
        path: candidate.path,
        expected_hash_short: expected_short,
        observed_hash_short: null,
        detail: "expected file is missing from workspace after execution",
      });
      continue;
    }
    if (observed.sha256 !== expected_short) {
      findings.push({
        path: candidate.path,
        expected_hash_short: expected_short,
        observed_hash_short: observed.sha256,
        detail: `observed content_hash does not match expected (expected ${expected_short}, observed ${observed.sha256})`,
      });
    }
  }

  // Delete entries in the diff must NOT be present on disk after execution
  for (const entry of input.bundle.diff.entries) {
    if (entry.kind !== "delete") continue;
    const observed = walk.get(entry.path);
    if (observed) {
      findings.push({
        path: entry.path,
        expected_hash_short: null,
        observed_hash_short: observed.sha256,
        detail: "path was scheduled for delete but is present on disk",
      });
    }
  }

  const verdict_kind = findings.length === 0
    ? "MATCH"
    : findings.some((f) => f.observed_hash_short === null && f.expected_hash_short !== null)
      ? "MISSING_EXPECTED_FILE"
      : "UNEXPECTED_FILE_STATE";

  return {
    record_type: "NEX1_OBSERVER_VERDICT",
    verdict_kind,
    observer_key_id: observer.signing_key.key_id,
    walk_started_at,
    walk_completed_at,
    files_observed: walk.size,
    findings,
  };
}

/**
 * Convenience for tests: recompute the truncated hash of an arbitrary
 * bytes buffer using the same rule Observer + Broker apply.
 */
export function shortHashOfBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 16);
}
