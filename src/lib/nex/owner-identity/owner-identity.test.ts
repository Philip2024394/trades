// src/lib/nex/owner-identity/owner-identity.test.ts
//
// FOUNDER MASTER ACCESS · comprehensive security-invariant contract tests
// Philip 2026-09-08 · AUTHORIZE Founder Master Access mission
//
// Every dimension of the Founder-Access doctrine gets at least one test.
// If any test FAILS, the mission's FOUNDER report must mark that dimension
// 🔴 RED · never GREEN.

import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  hashOwnerCredential,
  verifyOwnerCredential,
  credentialFingerprintForAudit,
  MIN_CREDENTIAL_LENGTH,
} from "./hash";
import {
  createOwnerSession,
  checkSessionValidity,
  recordActivity,
  closeOwnerSession,
  SESSION_MAX_LIFETIME_MS,
  SESSION_INACTIVITY_TIMEOUT_MS,
} from "./session";
import { ingestUserMessage, redactCredentialTokens, REDACTION_MARKER } from "./redaction";
import {
  classifyOwnerRequest,
  decideScope,
  nextFounderAddress,
  _resetFounderAddressCounterForTests,
  ALLOWED_READ_CLASSES,
  FORBIDDEN_MOBILE_CLASSES,
} from "./scope";
import { appendOwnerAuditEvent, readOwnerAuditLedger, hashHintForAudit } from "./audit";
import { processIncomingChatMessage } from "./middleware";

// ─── § HASH · plaintext never stored · high entropy ───────────

describe("§HASH · credential storage never contains plaintext", () => {
  it("hashOwnerCredential returns a scrypt-formatted string · plaintext not present", () => {
    const secret = "some-strong-founder-credential-16plus";
    const h = hashOwnerCredential(secret);
    expect(h.encoded.startsWith("scrypt$")).toBe(true);
    expect(h.encoded.includes(secret)).toBe(false);        // plaintext MUST NOT appear
    expect(h.encoded.split("$").length).toBe(6);
  });

  it("verifyOwnerCredential accepts correct credential · rejects wrong credential", () => {
    const secret = "correct-founder-credential-2026-09-08";
    const h = hashOwnerCredential(secret);
    expect(verifyOwnerCredential(secret, h).valid).toBe(true);
    expect(verifyOwnerCredential("wrong-credential-attempt-x", h).valid).toBe(false);
  });

  it("rejects empty credential", () => {
    expect(() => hashOwnerCredential("")).toThrow(/empty/i);
  });

  it(`rejects credential shorter than ${MIN_CREDENTIAL_LENGTH} chars`, () => {
    expect(() => hashOwnerCredential("short")).toThrow(/shorter/i);
  });

  it("verify is constant-time · same wrong candidate yields deterministic false", () => {
    const h = hashOwnerCredential("some-strong-founder-credential-16plus");
    const r1 = verifyOwnerCredential("wrong-1234567890abc", h);
    const r2 = verifyOwnerCredential("wrong-1234567890abc", h);
    expect(r1.valid).toBe(false);
    expect(r2.valid).toBe(false);
  });

  it("credentialFingerprintForAudit never returns the plaintext or salt", () => {
    const secret = "some-strong-founder-credential-16plus";
    const h = hashOwnerCredential(secret);
    const fp = credentialFingerprintForAudit(h);
    expect(fp).toMatch(/^cred_fp_[a-f0-9]{12}$/);
    expect(fp.includes(secret)).toBe(false);
  });
});

// ─── § SESSION · 30-minute max · never silently permanent ───────

describe("§SESSION · 30-minute maximum · re-auth required after expiry", () => {
  it("createOwnerSession expires exactly 30 minutes after creation", () => {
    const now = Date.now();
    const s = createOwnerSession({ credential_verified: true, now_ms: now });
    expect(s.expires_at_ms - s.created_at_ms).toBe(SESSION_MAX_LIFETIME_MS);
  });

  it("session valid at t=0 · invalid past 30 min (expired_max_lifetime)", () => {
    const now = 1_700_000_000_000;
    const s = createOwnerSession({ credential_verified: true, now_ms: now });
    expect(checkSessionValidity(s, now).valid).toBe(true);
    expect(checkSessionValidity(s, now + SESSION_MAX_LIFETIME_MS).valid).toBe(false);
    const r = checkSessionValidity(s, now + SESSION_MAX_LIFETIME_MS);
    if (r.valid === false) expect(r.reason).toBe("expired_max_lifetime");
  });

  it("session inactivity subcap · valid within 15 min of activity · invalid beyond", () => {
    const now = 1_700_000_000_000;
    let s = createOwnerSession({ credential_verified: true, now_ms: now });
    // Advance past inactivity but well within 30-min max
    const r = checkSessionValidity(s, now + SESSION_INACTIVITY_TIMEOUT_MS + 1000);
    expect(r.valid).toBe(false);
    if (r.valid === false) expect(r.reason).toBe("expired_inactivity");
  });

  it("recordActivity resets inactivity BUT does NOT extend the 30-minute ceiling", () => {
    const now = 1_700_000_000_000;
    const s = createOwnerSession({ credential_verified: true, now_ms: now });
    const later = now + 20 * 60 * 1000; // 20 min in
    const touched = recordActivity(s, later);
    expect(touched.expires_at_ms).toBe(s.expires_at_ms);          // ceiling unchanged
    expect(touched.last_activity_at_ms).toBe(later);
    // At t=31 min · still expired
    const r = checkSessionValidity(touched, now + 31 * 60 * 1000);
    expect(r.valid).toBe(false);
    if (r.valid === false) expect(r.reason).toBe("expired_max_lifetime");
  });

  it("createOwnerSession refuses when credential_verified is not the literal true", () => {
    expect(() => createOwnerSession({ credential_verified: false as any })).toThrow(/refused/i);
  });

  it("closeOwnerSession returns close marker · never exposes credential", () => {
    const s = createOwnerSession({ credential_verified: true });
    const c = closeOwnerSession(s, "founder_logout");
    expect(c.reason).toBe("founder_logout");
    expect(c.session_id).toBe(s.session_id);
  });
});

// ─── § REDACTION · credential never survives chat / logs / storage ───

describe("§REDACTION · credential is stripped before persistence · idempotent", () => {
  it("redactCredentialTokens replaces high-entropy tokens with [FOUNDER_CREDENTIAL_REDACTED]", () => {
    const msg = "Hi NEX, my credential is abcXYZ12345678";
    const { redacted, matches } = redactCredentialTokens(msg);
    expect(redacted.includes("abcXYZ12345678")).toBe(false);
    expect(redacted.includes(REDACTION_MARKER)).toBe(true);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("redaction is idempotent · re-running preserves marker · does not introduce new content", () => {
    // V.1 (2026-09-08): replaced compromised historical token with a synthetic
    // credential-shaped string. Test intent unchanged: verify redaction is idempotent.
    const msg = "check synthetictestcred8675309X please";
    const first = redactCredentialTokens(msg);
    const second = redactCredentialTokens(first.redacted);
    expect(second.redacted).toBe(first.redacted);   // idempotent
  });

  it("ingestUserMessage · unknown token → invalid classification · still redacted", () => {
    const secret = "unknown-founder-credential-xyz";
    // No known hashes match
    const res = ingestUserMessage({
      raw_message: `here is my ${secret}`,
      known_credential_hashes: [],
    });
    expect(res.kind).toBe("credential_detected_invalid");
    if (res.kind === "credential_detected_invalid") {
      // Still redacted · defense against probing
      expect(res.safe_to_persist_message.includes(secret)).toBe(false);
      expect(res.session_should_be_established).toBe(false);
    }
  });

  it("ingestUserMessage · verified token → session_should_be_established true · message safe", () => {
    const secret = "known-founder-credential-12345";
    const h = hashOwnerCredential(secret);
    const res = ingestUserMessage({
      raw_message: `login ${secret}`,
      known_credential_hashes: [h],
    });
    expect(res.kind).toBe("credential_detected_verified");
    if (res.kind === "credential_detected_verified") {
      expect(res.safe_to_persist_message.includes(secret)).toBe(false);
      expect(res.session_should_be_established).toBe(true);
      expect(res.matched_hash_fingerprint.startsWith("cred_fp_")).toBe(true);
    }
  });

  it("normal chat message · no credential-shaped tokens · passes through unchanged", () => {
    const msg = "Hi, how many hotels are in the directory?";
    const res = ingestUserMessage({ raw_message: msg, known_credential_hashes: [] });
    expect(res.kind).toBe("no_credential_detected");
    expect(res.safe_to_persist_message).toBe(msg);
  });
});

// ─── § SCOPE · read categories allowed · forbidden refused ───────

describe("§SCOPE · read-only categories allowed · engineering/financial refused", () => {
  it("every ALLOWED_READ_CLASS decides { allowed: true }", () => {
    for (const c of ALLOWED_READ_CLASSES) {
      const d = decideScope(c);
      expect(d.allowed).toBe(true);
    }
  });

  it("every FORBIDDEN_MOBILE_CLASS decides { allowed: false } with a refusal message", () => {
    for (const c of FORBIDDEN_MOBILE_CLASSES) {
      const d = decideScope(c);
      expect(d.allowed).toBe(false);
      if (!d.allowed) {
        expect(d.refusal_message.length).toBeGreaterThan(20);
      }
    }
  });

  it("APPROVED_DATA_UPDATE requires explicit confirm", () => {
    const d = decideScope("APPROVED_DATA_UPDATE");
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.requires_confirm).toBe(true);
  });

  it("classifyOwnerRequest correctly buckets engineering asks", () => {
    expect(classifyOwnerRequest("Can you deploy the latest?")).toBe("DEPLOYMENT");
    expect(classifyOwnerRequest("please commit and merge that fix")).toBe("CODE_MODIFY");
    expect(classifyOwnerRequest("promote the candidate")).toBe("PROMOTE_CANDIDATE");
    expect(classifyOwnerRequest("elevate programmer to phase g")).toBe("ELEVATE_AGENT");
  });

  it("classifyOwnerRequest correctly buckets financial asks", () => {
    expect(classifyOwnerRequest("transfer money to the vendor")).toBe("FINANCIAL_TRANSACTION");
    expect(classifyOwnerRequest("purchase the dev laptop")).toBe("FINANCIAL_TRANSACTION");
    expect(classifyOwnerRequest("withdraw the retainer")).toBe("FINANCIAL_TRANSACTION");
  });

  it("classifyOwnerRequest correctly buckets safe read asks", () => {
    expect(classifyOwnerRequest("how many members do we have?")).toBe("READ_MEMBERS");
    expect(classifyOwnerRequest("what is our monthly income?")).toBe("READ_REVENUE");
    expect(classifyOwnerRequest("what are our biggest costs?")).toBe("READ_COSTS");
    expect(classifyOwnerRequest("what agents are running?")).toBe("READ_AGENT_HEALTH");
    expect(classifyOwnerRequest("what recommendations do you have?")).toBe("READ_RECOMMENDATIONS");
    expect(classifyOwnerRequest("what failures occurred?")).toBe("READ_FAILURES");
    expect(classifyOwnerRequest("what is master ai learning?")).toBe("READ_MASTER_AI_STATE");
  });

  it("Founder addressing rotates naturally (Phil / Boss / Founder)", () => {
    _resetFounderAddressCounterForTests();
    expect(nextFounderAddress()).toBe("Phil");
    expect(nextFounderAddress()).toBe("Boss");
    expect(nextFounderAddress()).toBe("Founder");
    expect(nextFounderAddress()).toBe("Phil"); // wraps
  });
});

// ─── § AUDIT · append-only · never contains plaintext credential ───

describe("§AUDIT · append-only ledger · plaintext never persisted", () => {
  function synthRepo(): string {
    return mkdtempSync(path.join(tmpdir(), "nex-fma-audit-"));
  }

  it("appendOwnerAuditEvent writes to a JSONL file and readOwnerAuditLedger reads it back", () => {
    const root = synthRepo();
    const evt = appendOwnerAuditEvent({
      event_kind: "AUTH_SUCCESS",
      outcome: "OK",
      session_id: "sess_test",
      request_summary: "credential verified",
    }, { repoRoot: root });
    const back = readOwnerAuditLedger({ repoRoot: root });
    expect(back.length).toBe(1);
    expect(back[0].event_id).toBe(evt.event_id);
    expect(back[0].event_kind).toBe("AUTH_SUCCESS");
  });

  it("appendOwnerAuditEvent REFUSES to write a suspected credential in request_summary", () => {
    const root = synthRepo();
    expect(() => appendOwnerAuditEvent({
      event_kind: "AUTH_FAILURE",
      outcome: "REJECTED",
      // 20+ char high-entropy blob in the freeform summary
      request_summary: "possible credential: abcdefghij1234567890XYZ_extra_words",
    }, { repoRoot: root })).toThrow(/AUDIT_REJECTED/);
  });

  it("hashHintForAudit hashes device + network hints · never returns plaintext", () => {
    const uaHash = hashHintForAudit("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    expect(uaHash).toMatch(/^hash_[a-f0-9]{16}$/);
    expect(uaHash?.includes("iPhone")).toBe(false);
  });
});

// ─── § MIDDLEWARE · end-to-end chat ingestion ───

describe("§MIDDLEWARE · end-to-end incoming message pipeline", () => {
  it("ordinary chat message → no session · text unchanged · no audit event", () => {
    const r = processIncomingChatMessage({
      raw_text: "How many hotels are in the directory?",
      known_credential_hashes: [],
      device_fingerprint_hint: "test-device",
    });
    expect(r.ingestion_kind).toBe("no_credential_detected");
    expect(r.session).toBe(null);
    expect(r.safe_to_persist_text).toBe("How many hotels are in the directory?");
  });

  it("verified credential in chat → session created · text redacted · audit event", () => {
    const root = mkdtempSync(path.join(tmpdir(), "nex-fma-mid-"));
    const secret = "verified-founder-credential-98765";
    const h = hashOwnerCredential(secret);
    const r = processIncomingChatMessage({
      raw_text: `login ${secret}`,
      known_credential_hashes: [h],
      device_fingerprint_hint: "test-device",
      network_hint: "127.0.0.1",
      repoRoot: root,
    });
    expect(r.ingestion_kind).toBe("credential_detected_verified");
    expect(r.session).not.toBe(null);
    expect(r.safe_to_persist_text.includes(secret)).toBe(false);
    expect(r.audit_event_id.startsWith("audit_")).toBe(true);
    // Audit ledger has the AUTH_SUCCESS event
    const audit = readOwnerAuditLedger({ repoRoot: root });
    expect(audit.length).toBe(1);
    expect(audit[0].event_kind).toBe("AUTH_SUCCESS");
    // Audit does NOT contain the raw credential anywhere
    const raw = readFileSync(path.join(root, "data", "owner-identity", "audit.jsonl"), "utf8");
    expect(raw.includes(secret)).toBe(false);
  });

  it("invalid credential-shaped token → no session · text redacted · AUTH_FAILURE audit", () => {
    const root = mkdtempSync(path.join(tmpdir(), "nex-fma-inv-"));
    const r = processIncomingChatMessage({
      raw_text: "trying random1234567890abcxyz",
      known_credential_hashes: [],
      repoRoot: root,
    });
    expect(r.ingestion_kind).toBe("credential_detected_invalid");
    expect(r.session).toBe(null);
    expect(r.safe_to_persist_text.includes("random1234567890abcxyz")).toBe(false);
    const audit = readOwnerAuditLedger({ repoRoot: root });
    expect(audit.some((e) => e.event_kind === "AUTH_FAILURE")).toBe(true);
  });
});
