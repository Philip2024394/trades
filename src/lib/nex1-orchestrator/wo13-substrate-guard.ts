// WO-WORKSTATION-13 · substrate hardening guard
//
// Founder-authorised 2026-09-13. The single enforcement point invoked by
// the two production authorisation paths (wo3-pipeline, wo4-executor)
// BEFORE any founder-authorization verification runs.
//
// Contract: if the substrate integrity table cannot be verified, or any
// listed file has drifted from its recorded hash, this guard returns a
// failure result. Callers MUST short-circuit their own operation on
// failure — they must not proceed to signature verification, code
// generation, or file writes.
//
// This is the module that makes "changing one security-critical file"
// detectable. Every legitimate authorisation flows through here.

import { getCachedSubstrateIntegrity, verifySubstrateIntegrity, type SubstrateIntegrityTable } from "./wo13-integrity";

export type SubstrateGuardResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason_code:
        | "SUBSTRATE_SIGNATURE_INVALID"
        | "SUBSTRATE_FILE_DRIFTED"
        | "SUBSTRATE_FILE_MISSING";
      readonly detail: string;
      readonly offending_paths?: readonly string[];
    };

/**
 * The production entry point. Uses the compiled-in integrity table and the
 * cached process-start check. Callers that want a fresh check without
 * caching can pass `useCache: false`.
 */
export async function assertSubstrateHardened(opts?: {
  readonly useCache?: boolean;
  readonly repoRoot?: string;
  readonly table?: SubstrateIntegrityTable;
  readonly trusted_attestation_keys?: readonly string[];
}): Promise<SubstrateGuardResult> {
  const useCache = opts?.useCache !== false;
  const repoRoot = opts?.repoRoot ?? process.cwd();

  const result =
    useCache && opts?.table === undefined && opts?.trusted_attestation_keys === undefined
      ? await getCachedSubstrateIntegrity(repoRoot)
      : await verifySubstrateIntegrity(repoRoot, opts?.table, opts?.trusted_attestation_keys);

  if (result.ok) return { ok: true };

  switch (result.reason) {
    case "SIGNATURE_INVALID":
      return { ok: false, reason_code: "SUBSTRATE_SIGNATURE_INVALID", detail: result.detail };
    case "FILE_DRIFTED":
      return {
        ok: false,
        reason_code: "SUBSTRATE_FILE_DRIFTED",
        detail: `substrate files drifted from attested hashes: ${result.drifted.join(", ")}`,
        offending_paths: result.drifted,
      };
    case "FILE_MISSING":
      return {
        ok: false,
        reason_code: "SUBSTRATE_FILE_MISSING",
        detail: `substrate files missing from disk: ${result.missing.join(", ")}`,
        offending_paths: result.missing,
      };
  }
}
