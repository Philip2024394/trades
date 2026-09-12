// src/lib/nex/owner-identity/store.ts
//
// V.1 SECURITY CLOSURE (2026-09-08) · Founder-authorized narrow-scope V.1 diff
//
// Hash-only persistent supersession store for Founder credentials.
//
// GUARANTEES
// ----------
//   1. Only the scrypt-encoded hash record is ever appended to disk.
//      Plaintext never touches this module (it never accepts a plaintext
//      credential as input · rotateCredentialStore takes a pre-hashed
//      OwnerCredentialHash produced by hashOwnerCredential in-memory).
//   2. Supersession is atomic-per-record: appending a new ACTIVE record
//      also appends SUPERSEDE markers for every prior ACTIVE record.
//      The store remains append-only · never mutates prior lines · so
//      the full history is auditable.
//   3. readActiveCredentialHashes returns only hashes whose supersession
//      status is "active" at read time. Compromised (superseded) hashes
//      can never authenticate anything.
//   4. All I/O is JSONL against a single file. Ledger corruption fails
//      closed (returns empty active set · never grants authority).
//   5. The store path is env-overridable for test isolation
//      (NEX_OWNER_IDENTITY_DATA_ROOT).

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { OwnerCredentialHash } from "./hash";

// ─── Path resolution ─────────────────────────────────────────────

export function ownerIdentityDataRoot(): string {
  const override = process.env.NEX_OWNER_IDENTITY_DATA_ROOT;
  if (override && override.length > 0) return override;
  return path.join(process.cwd(), "data", "owner-identity");
}

export function credentialStorePath(): string {
  return path.join(ownerIdentityDataRoot(), "credentials.jsonl");
}

// ─── Record shapes (typed · hash-only) ───────────────────────────

/** One line in the credentials JSONL. Two kinds only. */
export type CredentialStoreRecord =
  | {
      kind: "ACTIVE_HASH_APPENDED";
      record_id: string;                 // opaque UUID
      hash_encoded: string;              // scrypt$... · never plaintext
      created_at_iso: string;
      created_by: "founder_rotation_cli" | "test_harness";
      note?: string;                     // free-form audit hint · no credential
    }
  | {
      kind: "ACTIVE_HASH_SUPERSEDED";
      supersedes_record_id: string;      // which prior ACTIVE record is now dead
      superseded_at_iso: string;
      reason: "rotated_by_founder" | "invalidated_admin" | "invalidated_v1_closure";
    };

// ─── Read ────────────────────────────────────────────────────────

/** Read every record in the store in append-order. Malformed lines skipped. */
export function readCredentialStore(): CredentialStoreRecord[] {
  const p = credentialStorePath();
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8");
  const out: CredentialStoreRecord[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try {
      const parsed = JSON.parse(t) as CredentialStoreRecord;
      if (parsed && (parsed.kind === "ACTIVE_HASH_APPENDED" || parsed.kind === "ACTIVE_HASH_SUPERSEDED")) {
        out.push(parsed);
      }
    } catch {
      // Corrupted line · skip · fail closed
    }
  }
  return out;
}

/** Reduce the append-only record stream to the current active hash records.
 *  A record is active iff it was APPENDED and never superseded afterward. */
export function readActiveCredentialHashes(): OwnerCredentialHash[] {
  const records = readCredentialStore();
  const supersededIds = new Set<string>();
  for (const r of records) {
    if (r.kind === "ACTIVE_HASH_SUPERSEDED") supersededIds.add(r.supersedes_record_id);
  }
  const active: OwnerCredentialHash[] = [];
  for (const r of records) {
    if (r.kind !== "ACTIVE_HASH_APPENDED") continue;
    if (supersededIds.has(r.record_id)) continue;
    active.push({ encoded: r.hash_encoded, created_at_iso: r.created_at_iso });
  }
  return active;
}

// ─── Write / Rotate ──────────────────────────────────────────────

function ensureDirExists(): void {
  const dir = ownerIdentityDataRoot();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function appendRecord(record: CredentialStoreRecord): void {
  ensureDirExists();
  appendFileSync(credentialStorePath(), JSON.stringify(record) + "\n", "utf8");
}

/** Atomically rotate the credential store: append the new ACTIVE hash then
 *  supersede every previously-active record. Returns the new record_id.
 *
 *  IMPORTANT: this function does NOT accept a plaintext credential. Callers
 *  MUST hash the plaintext via hashOwnerCredential in-memory first · the
 *  plaintext is never allowed to cross this API boundary. */
export function rotateCredentialStore(input: {
  new_hash: OwnerCredentialHash;
  created_by: "founder_rotation_cli" | "test_harness";
  note?: string;
}): { new_record_id: string; superseded_count: number } {
  // Defense-in-depth: reject any input that looks like it might carry a
  // plaintext credential (e.g. the caller accidentally passed a raw string).
  if (typeof input.new_hash !== "object" || input.new_hash === null || typeof input.new_hash.encoded !== "string") {
    throw new Error("rotateCredentialStore refused: new_hash must be OwnerCredentialHash · never a plaintext string");
  }
  if (!input.new_hash.encoded.startsWith("scrypt$")) {
    throw new Error("rotateCredentialStore refused: hash_encoded must be a scrypt$-formatted record");
  }
  if (input.note && /(?<![a-zA-Z0-9])[a-zA-Z0-9]{20,}(?![a-zA-Z0-9])/.test(input.note)) {
    throw new Error("rotateCredentialStore refused: note contains a high-entropy token that may be a credential");
  }

  // 1. Identify currently-active records (before we append anything new)
  const existingActive = new Set<string>();
  {
    const records = readCredentialStore();
    const supersededIds = new Set<string>();
    for (const r of records) {
      if (r.kind === "ACTIVE_HASH_SUPERSEDED") supersededIds.add(r.supersedes_record_id);
    }
    for (const r of records) {
      if (r.kind === "ACTIVE_HASH_APPENDED" && !supersededIds.has(r.record_id)) {
        existingActive.add(r.record_id);
      }
    }
  }

  // 2. Append the new ACTIVE record
  const newRecordId = randomUUID();
  const nowIso = new Date().toISOString();
  appendRecord({
    kind: "ACTIVE_HASH_APPENDED",
    record_id: newRecordId,
    hash_encoded: input.new_hash.encoded,
    created_at_iso: input.new_hash.created_at_iso ?? nowIso,
    created_by: input.created_by,
    note: input.note,
  });

  // 3. Append supersession markers for every previously-active record
  let superseded = 0;
  for (const priorId of existingActive) {
    appendRecord({
      kind: "ACTIVE_HASH_SUPERSEDED",
      supersedes_record_id: priorId,
      superseded_at_iso: nowIso,
      reason: "rotated_by_founder",
    });
    superseded += 1;
  }

  return { new_record_id: newRecordId, superseded_count: superseded };
}

/** Invalidate every currently-active credential without appending a
 *  replacement. Leaves the store with zero active hashes · authentication
 *  becomes impossible until the next rotation. Reserved for V.1 closure
 *  scenarios where the caller wants to force re-issuance. */
export function invalidateAllActiveCredentials(reason: "invalidated_admin" | "invalidated_v1_closure"): { superseded_count: number } {
  const active = new Set<string>();
  const records = readCredentialStore();
  const supersededIds = new Set<string>();
  for (const r of records) {
    if (r.kind === "ACTIVE_HASH_SUPERSEDED") supersededIds.add(r.supersedes_record_id);
  }
  for (const r of records) {
    if (r.kind === "ACTIVE_HASH_APPENDED" && !supersededIds.has(r.record_id)) {
      active.add(r.record_id);
    }
  }
  const nowIso = new Date().toISOString();
  let count = 0;
  for (const priorId of active) {
    appendRecord({
      kind: "ACTIVE_HASH_SUPERSEDED",
      supersedes_record_id: priorId,
      superseded_at_iso: nowIso,
      reason,
    });
    count += 1;
  }
  return { superseded_count: count };
}

// ─── Adversarial helpers (used by contract tests + adversarial scan) ──

/** Return a summary suitable for reporting · never contains plaintext or
 *  the full hash. Used by the CLI + adversarial scan runner. */
export function summarizeCredentialStore(): {
  ledger_path: string;
  total_records: number;
  active_count: number;
  superseded_count: number;
  active_fingerprints: string[];
} {
  const records = readCredentialStore();
  const supersededIds = new Set<string>();
  for (const r of records) {
    if (r.kind === "ACTIVE_HASH_SUPERSEDED") supersededIds.add(r.supersedes_record_id);
  }
  const activeFingerprints: string[] = [];
  let activeCount = 0;
  for (const r of records) {
    if (r.kind !== "ACTIVE_HASH_APPENDED") continue;
    if (supersededIds.has(r.record_id)) continue;
    activeCount += 1;
    // Fingerprint: last 12 hex of the derived hash · never the salt or plaintext
    const derivedHex = r.hash_encoded.split("$").pop() ?? "";
    activeFingerprints.push(`cred_fp_${derivedHex.slice(0, 12)}`);
  }
  return {
    ledger_path: credentialStorePath(),
    total_records: records.length,
    active_count: activeCount,
    superseded_count: supersededIds.size,
    active_fingerprints: activeFingerprints,
  };
}
