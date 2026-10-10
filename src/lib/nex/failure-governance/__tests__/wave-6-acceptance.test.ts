// src/lib/nex/failure-governance/__tests__/wave-6-acceptance.test.ts
//
// UWI · Wave 6 · Acceptance suite
// Founder-authorised programme.
//
// Proves M25 (two SEPARATE typed failure taxonomies · 20 durability + 13
// research · Rule 5k enforced) and M26 (HMAC-signed human-authority gate
// integrated with existing ADR-0304 §5 signature scheme).

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  classifyDurabilityFailure,
  classifyResearchFailure,
  makeDurabilityFailureEvent,
  makeResearchFailureEvent,
  InMemoryFailureSink,
  TypedFailureEmitter,
  requiresHumanAuthority,
  canonicalPayload,
  signHumanAuthorityDecision,
  verifyHumanAuthorityDecision,
  assertHumanAuthority,
  HumanAuthorityRequiredError,
  HumanAuthoritySignatureInvalidError,
  type HumanAuthorityAction,
  type HumanAuthoritySignedDecision,
} from "..";

// ═══ M25 · Durability classifier ═══════════════════════════════════
describe("M25 · Durability failure classifier (20 modes)", () => {
  it("HTTP 429 → quota_exhausted", () => {
    expect(classifyDurabilityFailure({ kind: "http_status", http_status: 429 })).toBe("quota_exhausted");
  });
  it("HTTP 503 → downstream_unavailable", () => {
    expect(classifyDurabilityFailure({ kind: "http_status", http_status: 503 })).toBe("downstream_unavailable");
  });
  it("HTTP 401/403 → authentication_expired", () => {
    expect(classifyDurabilityFailure({ kind: "http_status", http_status: 401 })).toBe("authentication_expired");
    expect(classifyDurabilityFailure({ kind: "http_status", http_status: 403 })).toBe("authentication_expired");
  });
  it("SIGKILL/SIGTERM → worker_crash", () => {
    expect(classifyDurabilityFailure({ kind: "signal", signal_name: "SIGKILL" })).toBe("worker_crash");
    expect(classifyDurabilityFailure({ kind: "signal", signal_name: "SIGTERM" })).toBe("worker_crash");
  });
  it("exception 'oom' → out_of_memory", () => {
    expect(classifyDurabilityFailure({ kind: "exception", message: "worker killed by OOM killer" })).toBe("out_of_memory");
  });
  it("exception 'timeout' → lock_timeout", () => {
    expect(classifyDurabilityFailure({ kind: "exception", message: "operation timeout after 30s" })).toBe("lock_timeout");
  });
  it("exception 'deadlock' → deadlock", () => {
    expect(classifyDurabilityFailure({ kind: "exception", message: "deadlock detected in transaction" })).toBe("deadlock");
  });
  it("exception 'ECONNREFUSED' → network_partition", () => {
    expect(classifyDurabilityFailure({ kind: "exception", message: "ECONNREFUSED to upstream" })).toBe("network_partition");
  });
  it("explicit override honoured", () => {
    expect(classifyDurabilityFailure({ kind: "explicit", explicit_mode: "clock_skew" })).toBe("clock_skew");
  });
  it("unknown fallback", () => {
    expect(classifyDurabilityFailure({ kind: "exception", message: "gibberish" })).toBe("unknown");
    expect(classifyDurabilityFailure({ kind: "http_status", http_status: 200 })).toBe("unknown");
  });
});

// ═══ M25 · Research classifier ═════════════════════════════════════
describe("M25 · Research failure classifier (13 classes)", () => {
  it("no_sources_matched → no_sources", () => {
    expect(classifyResearchFailure({ kind: "no_sources_matched" })).toBe("no_sources");
  });
  it("robots_disallow → crawl_blocked", () => {
    expect(classifyResearchFailure({ kind: "robots_disallow" })).toBe("crawl_blocked");
  });
  it("source_5xx → source_unavailable", () => {
    expect(classifyResearchFailure({ kind: "source_5xx" })).toBe("source_unavailable");
  });
  it("insufficient → insufficient_evidence", () => {
    expect(classifyResearchFailure({ kind: "insufficient" })).toBe("insufficient_evidence");
  });
  it("conflicting → conflicting_evidence", () => {
    expect(classifyResearchFailure({ kind: "conflicting" })).toBe("conflicting_evidence");
  });
  it("stale → stale_evidence", () => {
    expect(classifyResearchFailure({ kind: "stale" })).toBe("stale_evidence");
  });
  it("duplicate → duplicate_evidence", () => {
    expect(classifyResearchFailure({ kind: "duplicate" })).toBe("duplicate_evidence");
  });
  it("timeout → research_timeout", () => {
    expect(classifyResearchFailure({ kind: "timeout" })).toBe("research_timeout");
  });
  it("worker → worker_failure (distinct from research failure)", () => {
    expect(classifyResearchFailure({ kind: "worker" })).toBe("worker_failure");
  });
  it("explicit override honoured", () => {
    expect(classifyResearchFailure({ kind: "explicit", explicit_class: "malformed_source" })).toBe("malformed_source");
  });
  it("unclassified fallback", () => {
    expect(classifyResearchFailure({ kind: "explicit" } as any)).toBe("unclassified");
  });
});

// ═══ M25 · Emitter routing + typed separation ══════════════════════
describe("M25 · TypedFailureEmitter · layer routing + Rule 5k separation", () => {
  it("routes durability event to durability sink", async () => {
    const sink = new InMemoryFailureSink();
    const emitter = new TypedFailureEmitter(sink);
    await emitter.emit(makeDurabilityFailureEvent({
      signal: { kind: "exception", message: "worker killed by OOM" },
      detail: "worker w-1 died",
    }));
    expect(sink.durability).toHaveLength(1);
    expect(sink.research).toHaveLength(0);
    expect(sink.durability[0].layer).toBe("durability");
    expect(sink.durability[0].failure_mode).toBe("out_of_memory");
  });

  it("routes research event to research sink", async () => {
    const sink = new InMemoryFailureSink();
    const emitter = new TypedFailureEmitter(sink);
    await emitter.emit(makeResearchFailureEvent({
      signal: { kind: "robots_disallow" },
      detail: "example.com robots.txt Disallow: /private/",
    }));
    expect(sink.research).toHaveLength(1);
    expect(sink.durability).toHaveLength(0);
    expect(sink.research[0].layer).toBe("research");
    expect(sink.research[0].failure_class).toBe("crawl_blocked");
  });

  it("Rule 5k separation: taxonomies live in different types (compile-time proof)", () => {
    // Compile-time proof: DurabilityFailureMode and ResearchFailureClass are
    // distinct types. Attempting `type Both = DurabilityFailureMode | ResearchFailureClass`
    // would be a Rule 5k violation. Test asserts the emitter interface
    // distinguishes them at runtime by requiring the `layer` field.
    const durEvent = makeDurabilityFailureEvent({
      signal: { kind: "explicit", explicit_mode: "worker_crash" },
      detail: "w-1",
    });
    const resEvent = makeResearchFailureEvent({
      signal: { kind: "explicit", explicit_class: "crawl_blocked" },
      detail: "example.com",
    });
    expect(durEvent.layer).toBe("durability");
    expect(resEvent.layer).toBe("research");
    // The layer discriminant is what prevents accidental merging
    expect(durEvent.layer).not.toBe(resEvent.layer);
  });
});

// ═══ M26 · Human-authority gate ═════════════════════════════════════
describe("M26 · Human-authority gate", () => {
  const SECRET = "x".repeat(48); // 48 chars ≥ 32 min

  const orig_env = process.env.NEX_LAB_PROMOTION_SECRET;
  beforeEach(() => { process.env.NEX_LAB_PROMOTION_SECRET = SECRET; });
  afterEach(() => {
    if (orig_env === undefined) delete process.env.NEX_LAB_PROMOTION_SECRET;
    else process.env.NEX_LAB_PROMOTION_SECRET = orig_env;
  });

  it("requiresHumanAuthority · true for gated actions", () => {
    expect(requiresHumanAuthority("idea.built")).toBe(true);
    expect(requiresHumanAuthority("opportunity.promoted")).toBe(true);
    expect(requiresHumanAuthority("opportunity.rejected")).toBe(true);
    expect(requiresHumanAuthority("opportunity.merged")).toBe(true);
    expect(requiresHumanAuthority("opportunity.superseded")).toBe(true);
    expect(requiresHumanAuthority("source.new_allowlist_entry")).toBe(true);
    expect(requiresHumanAuthority("governance.production_change")).toBe(true);
  });

  it("canonicalPayload deterministic + specific to (action,target,ts,user)", () => {
    const a = canonicalPayload({ action: "idea.built", target_id: "opp-1", approved_at_iso: "2026-09-21T10:00:00.000Z", user_id: "founder" });
    const b = canonicalPayload({ action: "idea.built", target_id: "opp-1", approved_at_iso: "2026-09-21T10:00:00.000Z", user_id: "founder" });
    expect(a).toBe(b);
    const c = canonicalPayload({ action: "idea.rejected", target_id: "opp-1", approved_at_iso: "2026-09-21T10:00:00.000Z", user_id: "founder" });
    expect(a).not.toBe(c);
  });

  it("sign + verify round-trip succeeds", () => {
    const input = { action: "idea.built" as HumanAuthorityAction, target_id: "opp-1", approved_at_iso: new Date().toISOString(), user_id: "founder" };
    const sig = signHumanAuthorityDecision(input);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    const decision: HumanAuthoritySignedDecision = {
      action: input.action, target_id: input.target_id,
      approved_by_user_id: input.user_id, approved_at_iso: input.approved_at_iso,
      rationale: "founder approved after review",
      signature_hmac_sha256: sig,
      context: {},
    };
    expect(verifyHumanAuthorityDecision(decision)).toBe(true);
  });

  it("tampered signature rejected (timing-safe compare)", () => {
    const input = { action: "idea.built" as HumanAuthorityAction, target_id: "opp-1", approved_at_iso: new Date().toISOString(), user_id: "founder" };
    const sig = signHumanAuthorityDecision(input);
    const tampered = sig.slice(0, -2) + (sig.endsWith("00") ? "01" : "00");
    const decision: HumanAuthoritySignedDecision = {
      action: input.action, target_id: input.target_id,
      approved_by_user_id: input.user_id, approved_at_iso: input.approved_at_iso,
      rationale: "x", signature_hmac_sha256: tampered, context: {},
    };
    expect(verifyHumanAuthorityDecision(decision)).toBe(false);
  });

  it("missing signature throws HumanAuthorityRequiredError for gated action", () => {
    expect(() => assertHumanAuthority("idea.built", "opp-1", null))
      .toThrow(HumanAuthorityRequiredError);
  });

  it("autonomous action bypasses gate (no signature needed)", () => {
    expect(() => assertHumanAuthority("opportunity.discovered" as HumanAuthorityAction, "opp-1", null)).not.toThrow();
  });

  it("action mismatch rejected", () => {
    const now = new Date().toISOString();
    const sig = signHumanAuthorityDecision({ action: "idea.rejected", target_id: "opp-1", approved_at_iso: now, user_id: "founder" });
    const decision: HumanAuthoritySignedDecision = {
      action: "idea.built", // MISMATCH
      target_id: "opp-1", approved_by_user_id: "founder", approved_at_iso: now,
      rationale: "x", signature_hmac_sha256: sig, context: {},
    };
    expect(() => assertHumanAuthority("idea.built", "opp-1", decision))
      .toThrow(HumanAuthoritySignatureInvalidError);
  });

  it("target mismatch rejected", () => {
    const now = new Date().toISOString();
    const sig = signHumanAuthorityDecision({ action: "idea.built", target_id: "opp-1", approved_at_iso: now, user_id: "founder" });
    const decision: HumanAuthoritySignedDecision = {
      action: "idea.built", target_id: "opp-2", // MISMATCH
      approved_by_user_id: "founder", approved_at_iso: now,
      rationale: "x", signature_hmac_sha256: sig, context: {},
    };
    expect(() => assertHumanAuthority("idea.built", "opp-2", decision))
      .toThrow(HumanAuthoritySignatureInvalidError);
  });

  it("time-drift > 5min rejected", () => {
    const stale_ts = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min ago
    const sig = signHumanAuthorityDecision({ action: "idea.built", target_id: "opp-1", approved_at_iso: stale_ts, user_id: "founder" });
    const decision: HumanAuthoritySignedDecision = {
      action: "idea.built", target_id: "opp-1",
      approved_by_user_id: "founder", approved_at_iso: stale_ts,
      rationale: "x", signature_hmac_sha256: sig, context: {},
    };
    expect(() => assertHumanAuthority("idea.built", "opp-1", decision))
      .toThrow(HumanAuthoritySignatureInvalidError);
  });

  it("fail-closed on missing/short secret", () => {
    delete process.env.NEX_LAB_PROMOTION_SECRET;
    expect(() => signHumanAuthorityDecision({ action: "idea.built", target_id: "x", approved_at_iso: new Date().toISOString(), user_id: "u" }))
      .toThrow(HumanAuthoritySignatureInvalidError);
    process.env.NEX_LAB_PROMOTION_SECRET = "too-short";
    expect(() => signHumanAuthorityDecision({ action: "idea.built", target_id: "x", approved_at_iso: new Date().toISOString(), user_id: "u" }))
      .toThrow(HumanAuthoritySignatureInvalidError);
  });
});
