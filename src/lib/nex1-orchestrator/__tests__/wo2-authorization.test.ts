// WO-WORKSTATION-02 · founder cryptographic authorization acceptance tests
//
// Founder-authorised 2026-09-13 per ADR-0319 Workstation Activation Programme.
// Real execution: real Ed25519 sign/verify against the existing primitive,
// real GB storage jsonl backend, real replay + chain integrity checks.
// No fixtures, no LIMITED_V0 passes.

import { describe, it, expect, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyPair } from "@/lib/nex-controlled-hands/ed25519";
import {
  loadFounderKeyManifestFromJson,
  loadFounderKeyManifestFromFile,
  loadFounderKeyManifestFromEnv,
  findFounderKeyById,
  buildFounderKeyRecordForTest,
  EMPTY_FOUNDER_KEY_MANIFEST,
  type FounderKeyManifest,
} from "../wo2-founder-keys";
import {
  signAuthorization,
  verifyAuthorization,
  verifyAuthorizationForAction,
  hashAuthorization,
  canonicalisePayload,
} from "../wo2-authorization";
import {
  saveAuthorization,
  getLatestAuthorizationForTrace,
  listAuthorizationsForTrace,
  computePreviousHashForTrace,
  isNonceUsed,
  verifyAuthorizationChainForTrace,
} from "../wo2-authorization-store";

const STORAGE_ROOT = path.join(process.cwd(), "data", "nex-storage");
const WO2_COLLECTIONS = ["nex1_founder_authorizations.jsonl"];

async function cleanCollections(): Promise<void> {
  for (const name of WO2_COLLECTIONS) {
    const file = path.join(STORAGE_ROOT, name);
    try { await fs.unlink(file); } catch { /* ok · not present */ }
  }
}

function buildTestManifest(opts: {
  keypair: { key_id: string; public_der_hex: string };
  validFrom?: string;
  validUntil?: string;
  revokedAt?: string;
}): FounderKeyManifest {
  return {
    version: "wo2.v0.1",
    keys: [
      buildFounderKeyRecordForTest(opts.keypair, {
        validFrom: opts.validFrom ?? "2020-01-01T00:00:00.000Z",
        validUntil: opts.validUntil,
        revokedAt: opts.revokedAt,
      }),
    ],
  };
}

// ── Fresh trace_id per test so tests don't collide on chain state ───────
let TRACE_COUNTER = 0;
function nextTraceId(): string { TRACE_COUNTER++; return `wo2-test-trace-${Date.now()}-${TRACE_COUNTER}`; }

describe("WO-WORKSTATION-02 · founder cryptographic authorization", () => {
  beforeEach(async () => {
    await cleanCollections();
  });

  // ── 1 · Key manifest ────────────────────────────────────────────────────

  it("EMPTY_FOUNDER_KEY_MANIFEST rejects every lookup (secure default)", () => {
    const r = findFounderKeyById(EMPTY_FOUNDER_KEY_MANIFEST, "any-key", new Date());
    expect(r.ok).toBe(false);
  });

  it("loadFounderKeyManifestFromJson accepts a valid manifest", () => {
    const kp = generateKeyPair("founder-test-a");
    const m = loadFounderKeyManifestFromJson(JSON.stringify({
      version: "wo2.v0.1",
      keys: [{
        key_id: kp.key_id,
        algorithm: "ed25519",
        public_key_der_hex: kp.public_der_hex,
        purpose: "workstation_authorization",
        valid_from: "2020-01-01T00:00:00.000Z",
      }],
    }));
    expect(m.keys).toHaveLength(1);
    expect(m.keys[0].key_id).toBe(kp.key_id);
  });

  it("loadFounderKeyManifestFromJson rejects malformed manifests", () => {
    expect(() => loadFounderKeyManifestFromJson("{}")).toThrow(/version/);
    expect(() => loadFounderKeyManifestFromJson(JSON.stringify({ version: "wo2.v0.1" }))).toThrow(/keys/);
    expect(() => loadFounderKeyManifestFromJson(JSON.stringify({ version: "wo2.v0.1", keys: [{ key_id: "", algorithm: "ed25519", public_key_der_hex: "aa", purpose: "workstation_authorization", valid_from: "2020-01-01T00:00:00.000Z" }] }))).toThrow(/key_id/);
    expect(() => loadFounderKeyManifestFromJson(JSON.stringify({ version: "wo2.v0.1", keys: [{ key_id: "k", algorithm: "rsa", public_key_der_hex: "aa", purpose: "workstation_authorization", valid_from: "2020-01-01T00:00:00.000Z" }] }))).toThrow(/algorithm/);
    expect(() => loadFounderKeyManifestFromJson(JSON.stringify({ version: "wo2.v0.1", keys: [{ key_id: "k", algorithm: "ed25519", public_key_der_hex: "NOT-HEX", purpose: "workstation_authorization", valid_from: "2020-01-01T00:00:00.000Z" }] }))).toThrow(/hex/);
  });

  it("loadFounderKeyManifestFromFile throws MANIFEST_NOT_FOUND on missing file", async () => {
    let caught: NodeJS.ErrnoException | null = null;
    try { await loadFounderKeyManifestFromFile("/nonexistent-manifest-" + Math.random()); }
    catch (err) { caught = err as NodeJS.ErrnoException; }
    expect(caught).not.toBeNull();
    expect(caught!.code).toBe("MANIFEST_NOT_FOUND");
  });

  it("loadFounderKeyManifestFromEnv returns empty when no env vars set", async () => {
    delete process.env.NEX_FOUNDER_KEY_MANIFEST_JSON;
    delete process.env.NEX_FOUNDER_KEY_MANIFEST_PATH;
    const m = await loadFounderKeyManifestFromEnv();
    expect(m.keys).toHaveLength(0);
  });

  it("findFounderKeyById enforces valid_from", () => {
    const kp = generateKeyPair("founder-test-b");
    const m = buildTestManifest({ keypair: kp, validFrom: "2099-01-01T00:00:00.000Z" });
    const r = findFounderKeyById(m, kp.key_id, new Date("2026-01-01T00:00:00.000Z"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/not yet valid/);
  });

  it("findFounderKeyById enforces valid_until", () => {
    const kp = generateKeyPair("founder-test-c");
    const m = buildTestManifest({ keypair: kp, validUntil: "2020-01-02T00:00:00.000Z" });
    const r = findFounderKeyById(m, kp.key_id, new Date("2026-01-01T00:00:00.000Z"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/expired at/);
  });

  it("findFounderKeyById enforces revoked_at", () => {
    const kp = generateKeyPair("founder-test-d");
    const m = buildTestManifest({ keypair: kp, revokedAt: "2020-06-01T00:00:00.000Z" });
    const r = findFounderKeyById(m, kp.key_id, new Date("2026-01-01T00:00:00.000Z"));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toMatch(/revoked/);
  });

  // ── 2 · Canonical + hash determinism ────────────────────────────────────

  it("canonicalisePayload is deterministic for identical input", () => {
    const kp = generateKeyPair("founder-test-e");
    const a1 = signAuthorization({
      trace_id: "t", work_order_id: "wo", founder_key: kp,
      authorised_actions: ["a", "b"], expires_at: "2099-01-01T00:00:00.000Z",
      nonce: "fixed-nonce-1", previous_authorization_hash: null,
      authorization_id: "auth-1", issued_at: "2026-09-13T00:00:00.000Z",
    });
    const { signature: _s, ...withoutSig } = a1; void _s;
    const b1 = canonicalisePayload(withoutSig);
    const b2 = canonicalisePayload(withoutSig);
    expect(b1.equals(b2)).toBe(true);
  });

  it("hashAuthorization is deterministic and differs when payload differs", () => {
    const kp = generateKeyPair("founder-test-f");
    const base = signAuthorization({
      trace_id: "t1", work_order_id: "wo", founder_key: kp,
      authorised_actions: ["a"], expires_at: "2099-01-01T00:00:00.000Z",
      nonce: "n1", previous_authorization_hash: null,
      authorization_id: "auth-x", issued_at: "2026-09-13T00:00:00.000Z",
    });
    const { signature: _s, ...bws } = base; void _s;
    const h1 = hashAuthorization(bws);
    const h2 = hashAuthorization(bws);
    expect(h1).toBe(h2);
    // Different trace_id → different hash
    const bws2 = { ...bws, trace_id: "t2" };
    expect(hashAuthorization(bws2)).not.toBe(h1);
  });

  // ── 3 · Sign + verify round-trip ────────────────────────────────────────

  it("signAuthorization + verifyAuthorization round-trip", () => {
    const kp = generateKeyPair("founder-test-g");
    const m = buildTestManifest({ keypair: kp });
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo-workstation-03",
      founder_key: kp, authorised_actions: ["nex1.code_generate"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    const r = verifyAuthorization({ authorization: auth, manifest: m });
    expect(r.ok).toBe(true);
  });

  it("verify rejects a tampered signature", () => {
    const kp = generateKeyPair("founder-test-h");
    const m = buildTestManifest({ keypair: kp });
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo-x",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    const tampered = { ...auth, signature: "0".repeat(auth.signature.length) };
    const r = verifyAuthorization({ authorization: tampered, manifest: m });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("SIGNATURE_INVALID");
  });

  it("verify rejects a tampered payload (different trace_id) with same signature", () => {
    const kp = generateKeyPair("founder-test-i");
    const m = buildTestManifest({ keypair: kp });
    const auth = signAuthorization({
      trace_id: "original-trace", work_order_id: "wo-x",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    const tampered = { ...auth, trace_id: "different-trace" };
    const r = verifyAuthorization({ authorization: tampered, manifest: m });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("SIGNATURE_INVALID");
  });

  it("verify rejects an unknown key_id", () => {
    const kp = generateKeyPair("founder-test-j");
    const otherKp = generateKeyPair("founder-test-other");
    // Manifest only knows the OTHER key
    const m = buildTestManifest({ keypair: otherKp });
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    const r = verifyAuthorization({ authorization: auth, manifest: m });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("KEY_NOT_FOUND");
  });

  it("verify rejects an expired authorization", () => {
    const kp = generateKeyPair("founder-test-k");
    const m = buildTestManifest({ keypair: kp });
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      issued_at: "2020-01-01T00:00:00.000Z",
      expires_at: "2020-01-01T00:01:00.000Z",  // expired long ago
      previous_authorization_hash: null,
    });
    const r = verifyAuthorization({ authorization: auth, manifest: m, atTime: new Date("2026-09-13T00:00:00.000Z") });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("EXPIRED");
  });

  it("verify rejects a not-yet-valid authorization", () => {
    const kp = generateKeyPair("founder-test-l");
    const m = buildTestManifest({ keypair: kp });
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      issued_at: "2099-01-01T00:00:00.000Z",
      expires_at: "2099-01-02T00:00:00.000Z",
      previous_authorization_hash: null,
    });
    const r = verifyAuthorization({ authorization: auth, manifest: m, atTime: new Date("2026-09-13T00:00:00.000Z") });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("NOT_YET_VALID");
  });

  it("verify rejects an authorization signed by a revoked key", () => {
    const kp = generateKeyPair("founder-test-m");
    const m = buildTestManifest({ keypair: kp, revokedAt: "2026-01-01T00:00:00.000Z" });
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      issued_at: "2026-06-01T00:00:00.000Z",
      expires_at: "2026-06-02T00:00:00.000Z",
      previous_authorization_hash: null,
    });
    const r = verifyAuthorization({ authorization: auth, manifest: m, atTime: new Date("2026-06-01T12:00:00.000Z") });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("KEY_REVOKED");
  });

  it("verify rejects expires_at not strictly after issued_at", () => {
    const kp = generateKeyPair("founder-test-n");
    const m = buildTestManifest({ keypair: kp });
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      issued_at: "2026-06-01T00:00:00.000Z",
      expires_at: "2026-06-01T00:00:00.000Z", // equal, not strictly after
      previous_authorization_hash: null,
    });
    const r = verifyAuthorization({ authorization: auth, manifest: m, atTime: new Date("2026-06-01T00:00:00.000Z") });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason_code).toBe("EXPIRY_BEFORE_ISSUE");
  });

  // ── 4 · Action scope ────────────────────────────────────────────────────

  it("verifyAuthorizationForAction admits an action in authorised_actions", () => {
    const kp = generateKeyPair("founder-test-o");
    const m = buildTestManifest({ keypair: kp });
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo",
      founder_key: kp, authorised_actions: ["nex1.code_generate", "nex1.fs_write"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    const r = verifyAuthorizationForAction({ authorization: auth, manifest: m, requested_action: "nex1.code_generate" });
    expect(r.ok).toBe(true);
  });

  it("verifyAuthorizationForAction rejects an action outside authorised_actions", () => {
    const kp = generateKeyPair("founder-test-p");
    const m = buildTestManifest({ keypair: kp });
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo",
      founder_key: kp, authorised_actions: ["nex1.code_generate"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    const r = verifyAuthorizationForAction({ authorization: auth, manifest: m, requested_action: "nex1.system_shell" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect((r as { reason_code: string }).reason_code).toBe("ACTION_NOT_AUTHORISED");
  });

  // ── 5 · Persistence + replay protection ─────────────────────────────────

  it("saveAuthorization round-trips through GB storage", async () => {
    const kp = generateKeyPair("founder-test-q");
    const trace_id = nextTraceId();
    const auth = signAuthorization({
      trace_id, work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    const r = await saveAuthorization(auth);
    expect(r.ok).toBe(true);

    const loaded = await getLatestAuthorizationForTrace(trace_id);
    expect(loaded).not.toBeNull();
    expect(loaded!.authorization_id).toBe(auth.authorization_id);
    expect(loaded!.signature).toBe(auth.signature);
  });

  it("saveAuthorization rejects nonce replay across different traces", async () => {
    const kp = generateKeyPair("founder-test-r");
    const traceA = nextTraceId();
    const traceB = nextTraceId();
    const sharedNonce = "shared-replay-nonce-" + Date.now();

    const authA = signAuthorization({
      trace_id: traceA, work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      nonce: sharedNonce, previous_authorization_hash: null,
    });
    const authB = signAuthorization({
      trace_id: traceB, work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      nonce: sharedNonce, previous_authorization_hash: null,
    });

    const rA = await saveAuthorization(authA);
    expect(rA.ok).toBe(true);
    const rB = await saveAuthorization(authB);
    expect(rB.ok).toBe(false);
    if (rB.ok) return;
    expect(rB.reason).toBe("NONCE_REUSED");
  });

  it("saveAuthorization is idempotent on exact resubmission (same envelope)", async () => {
    const kp = generateKeyPair("founder-test-s");
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    const r1 = await saveAuthorization(auth);
    expect(r1.ok).toBe(true);
    const r2 = await saveAuthorization(auth);
    expect(r2.ok).toBe(true); // idempotent
  });

  it("isNonceUsed returns true after saveAuthorization", async () => {
    const kp = generateKeyPair("founder-test-t");
    const auth = signAuthorization({
      trace_id: nextTraceId(), work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    expect(await isNonceUsed(auth.nonce)).toBe(false);
    await saveAuthorization(auth);
    expect(await isNonceUsed(auth.nonce)).toBe(true);
  });

  // ── 6 · Chain of custody ────────────────────────────────────────────────

  it("computePreviousHashForTrace returns null for a fresh trace", async () => {
    const h = await computePreviousHashForTrace(nextTraceId());
    expect(h).toBeNull();
  });

  it("chain-of-custody links across two authorizations for the same trace", async () => {
    const kp = generateKeyPair("founder-test-u");
    const m = buildTestManifest({ keypair: kp });
    const trace_id = nextTraceId();

    const auth1 = signAuthorization({
      trace_id, work_order_id: "wo-01",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    await saveAuthorization(auth1);

    const prevHash = await computePreviousHashForTrace(trace_id);
    expect(prevHash).not.toBeNull();

    const auth2 = signAuthorization({
      trace_id, work_order_id: "wo-02",
      founder_key: kp, authorised_actions: ["b"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: prevHash,
    });
    await saveAuthorization(auth2);

    const chain = await listAuthorizationsForTrace(trace_id);
    expect(chain).toHaveLength(2);

    const verdict = await verifyAuthorizationChainForTrace(trace_id, m);
    expect(verdict.ok).toBe(true);
  });

  it("verifyAuthorizationChainForTrace detects a broken previous_authorization_hash", async () => {
    const kp = generateKeyPair("founder-test-v");
    const m = buildTestManifest({ keypair: kp });
    const trace_id = nextTraceId();

    const auth1 = signAuthorization({
      trace_id, work_order_id: "wo-01",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    await saveAuthorization(auth1);

    // Second auth points at a WRONG previous hash
    const auth2 = signAuthorization({
      trace_id, work_order_id: "wo-02",
      founder_key: kp, authorised_actions: ["b"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: "wrong-hash-that-does-not-match-auth1",
    });
    await saveAuthorization(auth2);

    const verdict = await verifyAuthorizationChainForTrace(trace_id, m);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toMatch(/previous_authorization_hash/);
  });

  it("verifyAuthorizationChainForTrace detects an in-storage tampered signature", async () => {
    const kp = generateKeyPair("founder-test-w");
    const m = buildTestManifest({ keypair: kp });
    const trace_id = nextTraceId();

    const auth = signAuthorization({
      trace_id, work_order_id: "wo",
      founder_key: kp, authorised_actions: ["a"],
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      previous_authorization_hash: null,
    });
    await saveAuthorization(auth);

    // Simulate tamper on disk: append a corrupted copy of the same auth
    // (same trace_id + same nonce so listAuthorizations picks it up, but
    // a different authorization_id so isNonceUsed's idempotency path
    // does not short-circuit the write). We write directly rather than
    // going through saveAuthorization so we can inject the bad row.
    const file = path.join(STORAGE_ROOT, "nex1_founder_authorizations.jsonl");
    const raw = await fs.readFile(file, "utf8");
    const original = JSON.parse(raw.trim().split("\n")[0]);
    const corrupted = { ...original, signature: "0".repeat(original.signature.length) };
    // Overwrite the file with just the corrupted record so the chain sees
    // only the bad copy on read
    await fs.writeFile(file, JSON.stringify(corrupted) + "\n", "utf8");

    const verdict = await verifyAuthorizationChainForTrace(trace_id, m);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.reason).toMatch(/crypto verification/);
  });
});
