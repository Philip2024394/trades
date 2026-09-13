// WO-WORKSTATION-13 · substrate integrity attestation
//
// Founder-authorised 2026-09-13 per the substrate-hardening WO.
//
// Purpose: detect and reject any modification to the security-critical
// substrate files that determine WHO is trusted, WHAT is authorised,
// WHAT can execute, and WHAT can mutate the machine.
//
// SCOPE (deliberately tight — NOT the whole repo):
//   - wo2-founder-keys.ts     · WHO is trusted (loads founder public keys)
//   - wo2-authorization.ts    · WHAT is authorised (Ed25519 verification)
//   - wo3-challenger.ts       · WHAT is authorised (path-scope enforcement)
//   - wo3-templates.ts        · WHAT can mutate (renders content NEX will write)
//   - wo4-executor.ts         · WHAT can mutate (the Broker-mediated write path)
//   - wo5-allowed-executables · WHAT can execute (subprocess allow-list)
//   - wo13-attestation.ts     · the trust anchor for THIS integrity table
//
// The table is signed by the compiled-in attestation key
// (wo13-attestation.ts). If someone tampers with the table, the signature
// breaks. If someone tampers with a listed file, its hash mismatches.
// Both cases surface as SIGNATURE_INVALID / FILE_DRIFTED / FILE_MISSING.
//
// This module is NOT self-hashed. The signature over the file list is the
// integrity guarantee for the table's *content*. The MODULE FILE itself
// could be edited (e.g. `return { ok: true }` swap in verifySubstrateIntegrity),
// which is why the caller — verifyAuthorization — is the enforcement point:
// even if wo13-integrity.ts were replaced, wo2-authorization.ts would still
// hash it (via itself being in the scope? — no; the caller invokes THIS
// function's export). This is a limitation of software-only integrity;
// the fundamental trust root is the compiled-in attestation public key.
//
// To regenerate the table after a legitimate substrate change:
//   npx tsx scripts/nex-substrate-integrity-regen.mts

import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { verifyAttestationSignature } from "./wo13-attestation";

// ── Types ───────────────────────────────────────────────────────────────

export interface SubstrateIntegrityRecord {
  readonly path: string;          // repo-relative POSIX
  readonly sha256_hex: string;
}

export interface SubstrateIntegrityTable {
  readonly version: "wo13.v0.1";
  readonly files: readonly SubstrateIntegrityRecord[];
  /** Detached Ed25519 signature over the canonical form of `files`
   *  (see canonicalizeIntegrityFiles), by an attestation key trusted in
   *  wo13-attestation.ts. */
  readonly attestation_signature_hex: string;
}

export type SubstrateIntegrityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "SIGNATURE_INVALID"; readonly detail: string }
  | { readonly ok: false; readonly reason: "FILE_DRIFTED"; readonly drifted: readonly string[] }
  | { readonly ok: false; readonly reason: "FILE_MISSING"; readonly missing: readonly string[] };

// ── Canonical form ──────────────────────────────────────────────────────

/**
 * Deterministic canonical bytes over which the attestation signature is
 * computed. Sorted by path (POSIX), one line per record, tab-separated
 * `path<TAB>sha256_hex`, joined with `\n`, no trailing newline.
 *
 * This function MUST match exactly what scripts/nex-substrate-integrity-regen.mts
 * signs. Any drift between them will cause every integrity check to fail.
 */
export function canonicalizeIntegrityFiles(files: readonly SubstrateIntegrityRecord[]): Buffer {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  return Buffer.from(sorted.map(r => `${r.path}\t${r.sha256_hex}`).join("\n"), "utf8");
}

// ── The frozen production table ─────────────────────────────────────────
// Generated 2026-09-13 by scripts/nex-substrate-integrity-regen.mts.
// To regenerate after a legitimate substrate change, run that script and
// paste its output back here.

export const SUBSTRATE_INTEGRITY_TABLE: SubstrateIntegrityTable = Object.freeze({
  version: "wo13.v0.1",
  files: Object.freeze([
    Object.freeze({ path: "src/lib/nex1-orchestrator/wo13-attestation.ts",       sha256_hex: "ba9c79004bb19d4c68f5d5944c9b7452cde5c78c5ca379c5c9ebe70b40a4a8cb" }),
    Object.freeze({ path: "src/lib/nex1-orchestrator/wo2-authorization.ts",      sha256_hex: "f15dd39c454a7b10baad0980aa5e16c8b522dc32cd800afb74340d55fa104fc8" }),
    Object.freeze({ path: "src/lib/nex1-orchestrator/wo2-founder-keys.ts",       sha256_hex: "ad82074fdbba6e28f091c01960c82e023c81febf93b8eea364b22b4377140274" }),
    Object.freeze({ path: "src/lib/nex1-orchestrator/wo3-challenger.ts",         sha256_hex: "4a71913d6530aa1256f65ea38b2f2acb095ce512fcd63a5381818712a5dc3b0f" }),
    Object.freeze({ path: "src/lib/nex1-orchestrator/wo3-templates.ts",          sha256_hex: "6185db5e427b2b60fdf09ce29d128c54afb2c2fca19709aabab444bac6b5ca4d" }),
    Object.freeze({ path: "src/lib/nex1-orchestrator/wo4-executor.ts",           sha256_hex: "3d7001bb06d6a65621b3f541713086292cbc27ac3b5c79a6aece8678c034be5f" }),
    Object.freeze({ path: "src/lib/nex1-orchestrator/wo5-allowed-executables.ts",sha256_hex: "8e1cb0c005d676d37da10e7cb171d284ca0140659716c9fc3298599a1e84d2b3" }),
  ]) as readonly SubstrateIntegrityRecord[],
  attestation_signature_hex: "9a1fa661fbeba9928244acf1efddaa88ff9f2ddd293ce7110f61d8e84f1bfbea0fb0bda03e22032a133dd8d391028141c25c1a36165b22522e6edd0355d18506",
}) as SubstrateIntegrityTable;

// ── Runtime verification ────────────────────────────────────────────────

/**
 * Verify that every file in `table.files` still hashes to its recorded
 * sha256_hex, AND that the table itself carries a valid attestation
 * signature. Returns a discriminated result — no throws.
 *
 * `trustedKeys` is provided for tests only. In production, the compiled-in
 * TRUSTED_ATTESTATION_PUBLIC_KEYS_DER_HEX from wo13-attestation.ts is used.
 */
export async function verifySubstrateIntegrity(
  repoRoot: string,
  table: SubstrateIntegrityTable = SUBSTRATE_INTEGRITY_TABLE,
  trustedKeys?: readonly string[],
): Promise<SubstrateIntegrityResult> {
  // 1. signature check — a tampered table breaks here
  const canonical = canonicalizeIntegrityFiles(table.files);
  if (!verifyAttestationSignature(canonical, table.attestation_signature_hex, trustedKeys)) {
    return { ok: false, reason: "SIGNATURE_INVALID", detail: "integrity table attestation signature does not verify" };
  }

  // 2. per-file content check — a tampered file breaks here
  const missing: string[] = [];
  const drifted: string[] = [];
  for (const r of table.files) {
    let content: Buffer;
    try { content = await fs.readFile(path.join(repoRoot, r.path)); }
    catch { missing.push(r.path); continue; }
    const actual = createHash("sha256").update(content).digest("hex");
    if (actual !== r.sha256_hex) drifted.push(r.path);
  }
  if (missing.length > 0) return { ok: false, reason: "FILE_MISSING", missing };
  if (drifted.length > 0) return { ok: false, reason: "FILE_DRIFTED", drifted };

  return { ok: true };
}

// ── Cached process-start check ──────────────────────────────────────────

let CACHED: Promise<SubstrateIntegrityResult> | null = null;

/**
 * Same as `verifySubstrateIntegrity` but computed at most once per process.
 * `verifyAuthorization` uses this to gate every authorisation attempt.
 *
 * The cache is intentional: if the substrate was intact at process start,
 * we trust that for the process lifetime. Post-startup tampering of the
 * running code path is a separate threat model (secure boot / signed
 * binaries handle that layer). For our threat — someone edits source and
 * expects to gain authority — the startup check is what matters.
 */
export function getCachedSubstrateIntegrity(repoRoot: string = process.cwd()): Promise<SubstrateIntegrityResult> {
  if (CACHED === null) CACHED = verifySubstrateIntegrity(repoRoot);
  return CACHED;
}

/**
 * Test-only: reset the module-level cache so the next call recomputes.
 * Never exported for production use in the substrate wiring.
 */
export function _resetSubstrateIntegrityCacheForTests(): void {
  CACHED = null;
}
