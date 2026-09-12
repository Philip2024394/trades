// src/lib/nex/owner-identity/rotation.test.ts
//
// V.1 SECURITY CLOSURE (2026-09-08) · focused contract tests for the
// hash-only persistent supersession store + rotation lifecycle.
//
// Every test hits the REAL store code against an isolated tmp directory
// (via NEX_OWNER_IDENTITY_DATA_ROOT). No mocks. Plaintext-absence is
// verified by reading the raw JSONL bytes after each test.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { hashOwnerCredential, verifyOwnerCredential } from "./hash";
import { ingestUserMessage } from "./redaction";
import {
  rotateCredentialStore,
  readActiveCredentialHashes,
  readCredentialStore,
  invalidateAllActiveCredentials,
  summarizeCredentialStore,
  credentialStorePath,
} from "./store";

let priorRoot: string | undefined;

beforeEach(() => {
  priorRoot = process.env.NEX_OWNER_IDENTITY_DATA_ROOT;
  const iso = mkdtempSync(path.join(tmpdir(), "nex-v1-store-"));
  process.env.NEX_OWNER_IDENTITY_DATA_ROOT = iso;
});
afterEach(() => {
  if (priorRoot === undefined) delete process.env.NEX_OWNER_IDENTITY_DATA_ROOT;
  else process.env.NEX_OWNER_IDENTITY_DATA_ROOT = priorRoot;
});

// ─── § LEDGER · empty store · zero active hashes ─────────────────

describe("§V1-STORE · empty store", () => {
  it("no ledger file → zero active hashes · empty summary", () => {
    expect(readActiveCredentialHashes()).toEqual([]);
    expect(readCredentialStore()).toEqual([]);
    const s = summarizeCredentialStore();
    expect(s.total_records).toBe(0);
    expect(s.active_count).toBe(0);
    expect(s.superseded_count).toBe(0);
    expect(s.active_fingerprints).toEqual([]);
  });
});

// ─── § ROTATION · atomic swap · exactly one active hash after rotate ─

describe("§V1-ROTATION · rotate atomically supersedes prior active hashes", () => {
  it("first rotation appends exactly one ACTIVE_HASH_APPENDED · zero supersession", () => {
    const h = hashOwnerCredential("first-secure-credential-1234567");
    const r = rotateCredentialStore({ new_hash: h, created_by: "test_harness" });
    expect(r.superseded_count).toBe(0);
    const active = readActiveCredentialHashes();
    expect(active.length).toBe(1);
    expect(active[0].encoded).toBe(h.encoded);
  });

  it("second rotation supersedes the first · exactly one active hash remains", () => {
    const h1 = hashOwnerCredential("first-secure-credential-1234567");
    const h2 = hashOwnerCredential("second-secure-credential-987654321");
    rotateCredentialStore({ new_hash: h1, created_by: "test_harness" });
    const r2 = rotateCredentialStore({ new_hash: h2, created_by: "test_harness" });
    expect(r2.superseded_count).toBe(1);
    const active = readActiveCredentialHashes();
    expect(active.length).toBe(1);
    expect(active[0].encoded).toBe(h2.encoded);
    expect(active[0].encoded).not.toBe(h1.encoded);
  });

  it("third rotation supersedes only the second (first was already superseded)", () => {
    const h1 = hashOwnerCredential("first-secure-credential-1234567");
    const h2 = hashOwnerCredential("second-secure-credential-987654321");
    const h3 = hashOwnerCredential("third-secure-credential-abcdefghij");
    rotateCredentialStore({ new_hash: h1, created_by: "test_harness" });
    rotateCredentialStore({ new_hash: h2, created_by: "test_harness" });
    const r3 = rotateCredentialStore({ new_hash: h3, created_by: "test_harness" });
    expect(r3.superseded_count).toBe(1);
    const active = readActiveCredentialHashes();
    expect(active.length).toBe(1);
    expect(active[0].encoded).toBe(h3.encoded);
  });

  it("full append-only history is preserved · every rotation leaves a trace", () => {
    const h1 = hashOwnerCredential("first-secure-credential-1234567");
    const h2 = hashOwnerCredential("second-secure-credential-987654321");
    rotateCredentialStore({ new_hash: h1, created_by: "test_harness" });
    rotateCredentialStore({ new_hash: h2, created_by: "test_harness" });
    const records = readCredentialStore();
    // 2 APPENDED + 1 SUPERSEDED = 3 records
    expect(records.length).toBe(3);
    const kinds = records.map((r) => r.kind);
    expect(kinds.filter((k) => k === "ACTIVE_HASH_APPENDED").length).toBe(2);
    expect(kinds.filter((k) => k === "ACTIVE_HASH_SUPERSEDED").length).toBe(1);
  });
});

// ─── § VERIFICATION · after rotation · old plaintext CANNOT authenticate ─

describe("§V1-VERIFY · post-rotation · old plaintext is definitively invalidated", () => {
  it("after rotation · verifying the old plaintext against the active hash returns valid=false", () => {
    const oldSecret = "old-compromised-credential-abc";
    const newSecret = "new-safe-credential-xyz-98765";
    const h1 = hashOwnerCredential(oldSecret);
    const h2 = hashOwnerCredential(newSecret);
    rotateCredentialStore({ new_hash: h1, created_by: "test_harness" });
    rotateCredentialStore({ new_hash: h2, created_by: "test_harness" });
    const active = readActiveCredentialHashes();
    expect(active.length).toBe(1);
    // The critical property: old plaintext CANNOT verify against the new active hash
    expect(verifyOwnerCredential(oldSecret, active[0]).valid).toBe(false);
    // And new plaintext DOES verify against the new active hash
    expect(verifyOwnerCredential(newSecret, active[0]).valid).toBe(true);
  });

  it("ingest with rotated hashes rejects old plaintext as invalid", () => {
    const oldSecret = "old-compromised-credential-abc";
    const newSecret = "new-safe-credential-xyz-98765";
    rotateCredentialStore({ new_hash: hashOwnerCredential(oldSecret), created_by: "test_harness" });
    rotateCredentialStore({ new_hash: hashOwnerCredential(newSecret), created_by: "test_harness" });
    const active = readActiveCredentialHashes();
    // Ingestion using ONLY the active-hash set (as the wired middleware would)
    const rOld = ingestUserMessage({ raw_message: `login ${oldSecret}`, known_credential_hashes: active });
    const rNew = ingestUserMessage({ raw_message: `login ${newSecret}`, known_credential_hashes: active });
    expect(rOld.kind).toBe("credential_detected_invalid");
    expect(rNew.kind).toBe("credential_detected_verified");
    // Both cases redact the plaintext from persistable text
    if (rOld.kind === "credential_detected_invalid") expect(rOld.safe_to_persist_message.includes(oldSecret)).toBe(false);
    if (rNew.kind === "credential_detected_verified") expect(rNew.safe_to_persist_message.includes(newSecret)).toBe(false);
  });
});

// ─── § INVALIDATE · full lockdown · zero active hashes remain ─────

describe("§V1-INVALIDATE · invalidateAllActiveCredentials leaves zero active hashes", () => {
  it("invalidateAllActiveCredentials on populated store leaves active_count=0", () => {
    rotateCredentialStore({ new_hash: hashOwnerCredential("secure-cred-abc-12345"), created_by: "test_harness" });
    expect(readActiveCredentialHashes().length).toBe(1);
    const r = invalidateAllActiveCredentials("invalidated_v1_closure");
    expect(r.superseded_count).toBe(1);
    expect(readActiveCredentialHashes().length).toBe(0);
  });

  it("invalidateAllActiveCredentials on empty store is a no-op", () => {
    const r = invalidateAllActiveCredentials("invalidated_v1_closure");
    expect(r.superseded_count).toBe(0);
    expect(readActiveCredentialHashes().length).toBe(0);
  });
});

// ─── § PERSISTENCE · plaintext NEVER touches the ledger bytes ─────

describe("§V1-PLAINTEXT-ABSENCE · verified against raw ledger bytes", () => {
  it("after rotation · raw ledger file contains NO plaintext credential characters", () => {
    const secret = "plaintext-must-never-appear-here-xyz98765";
    const h = hashOwnerCredential(secret);
    rotateCredentialStore({ new_hash: h, created_by: "test_harness" });
    const raw = readFileSync(credentialStorePath(), "utf8");
    expect(raw.includes(secret)).toBe(false);
    expect(raw.includes("plaintext-must-never-appear")).toBe(false);
    expect(raw.startsWith("{")).toBe(true); // JSONL
  });

  it("after 5 rotations · raw ledger contains NONE of the 5 plaintexts", () => {
    const secrets = [
      "rotation-plaintext-one-abc12345",
      "rotation-plaintext-two-def67890",
      "rotation-plaintext-three-ghi13579",
      "rotation-plaintext-four-jkl24680",
      "rotation-plaintext-five-mno97531",
    ];
    for (const s of secrets) {
      rotateCredentialStore({ new_hash: hashOwnerCredential(s), created_by: "test_harness" });
    }
    const raw = readFileSync(credentialStorePath(), "utf8");
    for (const s of secrets) {
      expect(raw.includes(s)).toBe(false);
    }
  });
});

// ─── § DEFENSE · rotateCredentialStore refuses raw plaintext + high-entropy notes ─

describe("§V1-DEFENSE · rotateCredentialStore refuses unsafe inputs", () => {
  it("refuses when new_hash is a plaintext string instead of OwnerCredentialHash", () => {
    expect(() =>
      rotateCredentialStore({
        // Force plaintext through the API to prove the guard rejects it
        new_hash: "plaintext-must-be-refused-1234567" as unknown as ReturnType<typeof hashOwnerCredential>,
        created_by: "test_harness",
      }),
    ).toThrow(/refused/i);
  });

  it("refuses when hash_encoded is not scrypt-formatted", () => {
    expect(() =>
      rotateCredentialStore({
        new_hash: { encoded: "bcrypt$fake$notallowed", created_at_iso: new Date().toISOString() },
        created_by: "test_harness",
      }),
    ).toThrow(/scrypt/i);
  });

  it("refuses when note contains a high-entropy token", () => {
    const h = hashOwnerCredential("legitimate-credential-abc-999");
    expect(() =>
      rotateCredentialStore({
        new_hash: h,
        created_by: "test_harness",
        note: "context: leaked_token abc1234567890xyz98765defgh",
      }),
    ).toThrow(/refused/i);
    // Store must be unchanged after the throw
    expect(readActiveCredentialHashes().length).toBe(0);
  });
});

// ─── § IDEMPOTENT REDACTION · marker never recurses on the marker ─

describe("§V1-REDACTION · idempotent · marker never recurses", () => {
  it("hyphenated ≥16-char credential is caught by the second pattern · marker survives re-run", () => {
    const secret = "hyphen-loaded-credential-abcdefghij";
    const active = readActiveCredentialHashes(); // empty
    const r1 = ingestUserMessage({ raw_message: `login ${secret}`, known_credential_hashes: active });
    expect(r1.kind).toBe("credential_detected_invalid");
    expect(r1.safe_to_persist_message.includes(secret)).toBe(false);
    // Re-ingest the ALREADY-redacted output · marker must not become a new match
    const r2 = ingestUserMessage({ raw_message: r1.safe_to_persist_message, known_credential_hashes: active });
    expect(r2.kind).toBe("no_credential_detected");
    expect(r2.safe_to_persist_message).toBe(r1.safe_to_persist_message);
  });
});
