// WO-INTELLIGENCE-01 · provenance chain hashing helper.
//
// Every persistent record in the Intelligence subsystem carries a
// provenance_chain_hash. That hash covers the record's canonical form
// plus the provenance hashes of every antecedent, so tampering with any
// step in the chain surfaces as a mismatch at the next verification.

import { createHash } from "node:crypto";

/**
 * Compute a canonical JSON representation with sorted keys — same object
 * shape always produces the same bytes regardless of insertion order.
 */
export function canonicalJson(value: unknown): string {
  // Sort keys deterministically at every object level. Arrays keep their
  // order (order is meaningful). Shared subtrees are fine — only true
  // cycles would be a problem, and JSON.stringify throws on those.
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(walk);
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      sorted[k] = walk((v as Record<string, unknown>)[k]);
    }
    return sorted;
  };
  return JSON.stringify(walk(value));
}

/**
 * Compute a provenance chain hash: SHA-256 over the canonical form of
 * `self` (with any existing provenance_chain_hash zeroed out) plus the
 * antecedent provenance hashes, tab-joined.
 */
export function provenanceChainHash(self: Record<string, unknown>, antecedentHashes: readonly string[]): string {
  const stripped: Record<string, unknown> = { ...self };
  delete stripped.provenance_chain_hash;
  const antecedent = [...antecedentHashes].sort().join("\t");
  const canonical = canonicalJson(stripped) + "\n" + antecedent;
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Compute the SHA-256 of arbitrary bytes; used for content hashes on
 * SourceRecord.content_hash_sha256, fragment.content_hash_sha256, etc.
 */
export function sha256Hex(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
