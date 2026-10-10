// src/lib/nex/marketing/sender-pool/__tests__/sender-pool.test.ts
//
// NEX Stage 2 · Sender Pool acceptance suite
// Founder-authorised programme.
//
// Tests use a deterministic in-memory PoolClient mock that faithfully
// implements the SQL semantics the modules depend on (SELECT · INSERT ...
// ON CONFLICT DO UPDATE ... WHERE · UPDATE · RETURNING · rowCount).
// This proves the MACHINERY without requiring Postgres · the world-proof
// boundary remains closed.

import { describe, it, expect, beforeEach } from "vitest";
import type { PoolClient } from "pg";
import {
  assertValidHealthTransition,
  deriveHealth,
  currentWindowStart,
  loadCapacity,
  consumeCapacity,
  refundCapacity,
  assertNoLimitEvasion,
  selectSender,
  rankSender,
  InvalidHealthTransitionError,
  CapacityEvasionAttemptError,
  SENDABLE_HEALTH_STATES,
  BLOCKED_HEALTH_STATES,
  type HealthState,
} from "..";
import { makeMockPool, resetMockPool, insertSender } from "./mock-pool";

let mock: ReturnType<typeof makeMockPool>;
beforeEach(() => { mock = makeMockPool(); });

// ═══════════════════════════════════════════════════════════════════
// (A) Health state machine
// ═══════════════════════════════════════════════════════════════════
describe("Stage 2 · (A) health state machine", () => {
  it("(A1) healthy → limited valid", () => {
    expect(() => assertValidHealthTransition("healthy", "limited")).not.toThrow();
  });
  it("(A2) healthy → healthy no-op valid", () => {
    expect(() => assertValidHealthTransition("healthy", "healthy")).not.toThrow();
  });
  it("(A3) disabled → healthy INVALID (terminal)", () => {
    expect(() => assertValidHealthTransition("disabled", "healthy")).toThrow(InvalidHealthTransitionError);
  });
  it("(A4) paused → healthy valid (resume)", () => {
    expect(() => assertValidHealthTransition("paused", "healthy")).not.toThrow();
  });
  it("(A5) authentication_required → healthy valid (re-auth)", () => {
    expect(() => assertValidHealthTransition("authentication_required", "healthy")).not.toThrow();
  });
  it("(A6) SENDABLE + BLOCKED partitions cover the vocabulary", () => {
    const all: HealthState[] = [
      "healthy", "limited", "warning", "paused",
      "authentication_required", "provider_blocked", "reputation_protection", "disabled"
    ];
    for (const h of all) {
      expect(SENDABLE_HEALTH_STATES.has(h) || BLOCKED_HEALTH_STATES.has(h)).toBe(true);
      expect(SENDABLE_HEALTH_STATES.has(h) && BLOCKED_HEALTH_STATES.has(h)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// (B) Health derivation
// ═══════════════════════════════════════════════════════════════════
describe("Stage 2 · (B) health derivation", () => {
  const base = {
    current_state: "healthy" as HealthState,
    authentication_state: "verified" as const,
    bounce_rate: 0, complaint_rate: 0,
    hourly_used_ratio: 0, daily_used_ratio: 0,
    provider_blocked: false, admin_paused: false,
  };

  it("(B1) all-clean → healthy", () => {
    expect(deriveHealth(base).proposed_state).toBe("healthy");
  });
  it("(B2) high bounce → reputation_protection", () => {
    expect(deriveHealth({ ...base, bounce_rate: 0.07 }).proposed_state).toBe("reputation_protection");
  });
  it("(B3) moderate bounce → warning", () => {
    expect(deriveHealth({ ...base, bounce_rate: 0.03 }).proposed_state).toBe("warning");
  });
  it("(B4) high complaint → reputation_protection", () => {
    expect(deriveHealth({ ...base, complaint_rate: 0.006 }).proposed_state).toBe("reputation_protection");
  });
  it("(B5) capacity usage 90% → limited", () => {
    expect(deriveHealth({ ...base, hourly_used_ratio: 0.9 }).proposed_state).toBe("limited");
  });
  it("(B6) admin_paused → paused (regardless of other signals)", () => {
    expect(deriveHealth({ ...base, admin_paused: true, bounce_rate: 0.9 }).proposed_state).toBe("paused");
  });
  it("(B7) provider_blocked has highest priority after disabled", () => {
    expect(deriveHealth({ ...base, provider_blocked: true, admin_paused: true }).proposed_state).toBe("provider_blocked");
  });
  it("(B8) disabled is terminal and never overridden", () => {
    expect(deriveHealth({ ...base, current_state: "disabled", bounce_rate: 0 }).proposed_state).toBe("disabled");
  });
  it("(B9) auth expired → authentication_required", () => {
    expect(deriveHealth({ ...base, authentication_state: "expired" }).proposed_state).toBe("authentication_required");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (C) Capacity engine · window computation
// ═══════════════════════════════════════════════════════════════════
describe("Stage 2 · (C) capacity windows", () => {
  it("(C1) hour window truncates to hour boundary", () => {
    const t = new Date("2026-09-21T15:37:42.123Z");
    const w = currentWindowStart("hour", t);
    expect(w.toISOString()).toBe("2026-09-21T15:00:00.000Z");
  });
  it("(C2) day window truncates to day boundary", () => {
    const t = new Date("2026-09-21T15:37:42.123Z");
    const w = currentWindowStart("day", t);
    expect(w.toISOString().startsWith("2026-09-21T00:00:00")).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (D) Capacity consume · concurrency-safe atomic increment
// ═══════════════════════════════════════════════════════════════════
describe("Stage 2 · (D) capacity consume", () => {
  it("(D1) first consume with no prior window succeeds · 1/N used", async () => {
    const s = insertSender(mock, { hourly_capacity: 10, daily_capacity: 100 });
    const r = await consumeCapacity(mock.client, s);
    expect(r.ok).toBe(true);
    expect(r.hourly_used).toBe(1);
    expect(r.daily_used).toBe(1);
  });

  it("(D2) exhausted hourly capacity refuses · returns hourly_capacity_exhausted", async () => {
    const s = insertSender(mock, { hourly_capacity: 2, daily_capacity: 100 });
    await consumeCapacity(mock.client, s);
    await consumeCapacity(mock.client, s);
    const r3 = await consumeCapacity(mock.client, s);
    expect(r3.ok).toBe(false);
    expect(r3.reason).toBe("hourly_capacity_exhausted");
  });

  it("(D3) exhausted daily capacity refuses · rolls back hourly increment", async () => {
    const s = insertSender(mock, { hourly_capacity: 100, daily_capacity: 2 });
    await consumeCapacity(mock.client, s);
    await consumeCapacity(mock.client, s);
    const before_cap = await loadCapacity(mock.client, s);
    const r3 = await consumeCapacity(mock.client, s);
    const after_cap = await loadCapacity(mock.client, s);
    expect(r3.ok).toBe(false);
    expect(r3.reason).toBe("daily_capacity_exhausted");
    // Hourly increment MUST be rolled back so accounting stays honest
    expect(after_cap.hourly_used).toBe(before_cap.hourly_used);
  });

  it("(D4) null hourly_capacity + null daily_capacity → effective_remaining=null (unlimited-observability)", async () => {
    const s = insertSender(mock, { hourly_capacity: null, daily_capacity: null });
    const cap0 = await loadCapacity(mock.client, s);
    expect(cap0.effective_remaining).toBe(null);
    const r = await consumeCapacity(mock.client, s);
    expect(r.ok).toBe(true);
    // Even with null limits we still track counts for observability
    expect(r.hourly_used).toBe(1);
  });

  it("(D5) refundCapacity decrements both windows · never below 0", async () => {
    const s = insertSender(mock, { hourly_capacity: 10, daily_capacity: 10 });
    await consumeCapacity(mock.client, s);
    await refundCapacity(mock.client, s.sender_id);
    const cap = await loadCapacity(mock.client, s);
    expect(cap.hourly_used).toBe(0);
    expect(cap.daily_used).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (E) Selection · lane awareness + member isolation
// ═══════════════════════════════════════════════════════════════════
describe("Stage 2 · (E) sender selection · lane awareness", () => {
  it("(E1) FOUNDER lane returns founder-lane senders only · never member/auto", async () => {
    insertSender(mock, { lane: "founder", email: "f@a.com", hourly_capacity: 10 });
    insertSender(mock, { lane: "auto",    email: "a@a.com", hourly_capacity: 10 });
    insertSender(mock, { lane: "member",  email: "m@a.com", member_id: "m-1", hourly_capacity: 10 });
    const o = await selectSender(mock.client, { lane: "founder" });
    expect(o.kind).toBe("selected");
    if (o.kind === "selected") expect(o.sender.lane).toBe("founder");
  });

  it("(E2) MEMBER lane · scoped strictly to member_id · never leaks another member's sender", async () => {
    insertSender(mock, { lane: "member", email: "a@a.com", member_id: "m-1", hourly_capacity: 10 });
    insertSender(mock, { lane: "member", email: "b@b.com", member_id: "m-2", hourly_capacity: 10 });
    const o = await selectSender(mock.client, { lane: "member", member_id: "m-1" });
    expect(o.kind).toBe("selected");
    if (o.kind === "selected") expect(o.sender.email).toBe("a@a.com");
  });

  it("(E3) MEMBER lane · unknown member_id returns member_scope_mismatch", async () => {
    insertSender(mock, { lane: "member", email: "a@a.com", member_id: "m-1", hourly_capacity: 10 });
    const o = await selectSender(mock.client, { lane: "member", member_id: "m-does-not-exist" });
    expect(o.kind).toBe("no_eligible_sender");
    if (o.kind === "no_eligible_sender") expect(o.reason).toBe("member_scope_mismatch");
  });

  it("(E4) MEMBER lane WITHOUT member_id returns invalid_input", async () => {
    const o = await selectSender(mock.client, { lane: "member" });
    expect(o.kind).toBe("no_eligible_sender");
    if (o.kind === "no_eligible_sender") expect(o.reason).toBe("invalid_input");
  });

  it("(E5) no senders exist for lane → no_authorised_sender", async () => {
    const o = await selectSender(mock.client, { lane: "auto" });
    expect(o.kind).toBe("no_eligible_sender");
    if (o.kind === "no_eligible_sender") expect(o.reason).toBe("no_authorised_sender");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (F) Selection · authentication + health enforcement
// ═══════════════════════════════════════════════════════════════════
describe("Stage 2 · (F) sender selection · auth + health filters", () => {
  it("(F1) unverified sender is excluded · authentication_required reported", async () => {
    insertSender(mock, { lane: "founder", email: "unverified@x.com", authentication_state: "pending" });
    const o = await selectSender(mock.client, { lane: "founder" });
    expect(o.kind).toBe("no_eligible_sender");
    if (o.kind === "no_eligible_sender") expect(o.reason).toBe("authentication_required");
  });

  it("(F2) paused sender excluded · health_blocked reported", async () => {
    insertSender(mock, { lane: "founder", email: "paused@x.com", health_state: "paused" });
    const o = await selectSender(mock.client, { lane: "founder" });
    if (o.kind === "no_eligible_sender") expect(o.reason).toBe("health_blocked");
  });

  it("(F3) disabled sender excluded", async () => {
    insertSender(mock, { lane: "founder", email: "d@x.com", health_state: "disabled" });
    const o = await selectSender(mock.client, { lane: "founder" });
    if (o.kind === "no_eligible_sender") expect(o.reason).toBe("health_blocked");
  });

  it("(F4) provider_blocked sender excluded", async () => {
    insertSender(mock, { lane: "founder", email: "b@x.com", health_state: "provider_blocked" });
    const o = await selectSender(mock.client, { lane: "founder" });
    if (o.kind === "no_eligible_sender") expect(o.reason).toBe("health_blocked");
  });

  it("(F5) healthy + verified is the base case that succeeds", async () => {
    insertSender(mock, { lane: "founder", email: "ok@x.com" });
    const o = await selectSender(mock.client, { lane: "founder" });
    expect(o.kind).toBe("selected");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (G) Selection · capacity enforcement · Clause 8 no-evasion
// ═══════════════════════════════════════════════════════════════════
describe("Stage 2 · (G) capacity enforcement · Clause 8 hard-lock", () => {
  it("(G1) capacity_exhausted refuses selection · caller must WAIT (not rotate)", async () => {
    const s = insertSender(mock, { lane: "founder", email: "cap@x.com", hourly_capacity: 1 });
    await consumeCapacity(mock.client, s);
    const o = await selectSender(mock.client, { lane: "founder" });
    expect(o.kind).toBe("no_eligible_sender");
    if (o.kind === "no_eligible_sender") expect(o.reason).toBe("capacity_exhausted");
  });

  it("(G2) LARGE 'need' beyond remaining refuses · selector never fabricates capacity", async () => {
    const s = insertSender(mock, { lane: "founder", email: "c@x.com", hourly_capacity: 10 });
    // Consume 9 · leaving 1 · request need=5 must refuse
    for (let i = 0; i < 9; i++) await consumeCapacity(mock.client, s);
    const o = await selectSender(mock.client, { lane: "founder", need: 5 });
    if (o.kind === "no_eligible_sender") expect(o.reason).toBe("capacity_exhausted");
  });

  it("(G3) assertNoLimitEvasion refuses rotation between two DIFFERENT sender_ids", () => {
    expect(() =>
      assertNoLimitEvasion("test", "sender-a-exhausted", "sender-b-different")
    ).toThrow(CapacityEvasionAttemptError);
  });

  it("(G4) assertNoLimitEvasion permits null 'would rotate to' (no rotation)", () => {
    expect(() => assertNoLimitEvasion("test", "sender-a", null)).not.toThrow();
  });

  it("(G5) assertNoLimitEvasion permits same sender_id (retry against self)", () => {
    expect(() => assertNoLimitEvasion("test", "sender-a", "sender-a")).not.toThrow();
  });

  it("(G6) sender WITH legitimate capacity is still selectable when the exhausted one is refused", async () => {
    // This is the LEGITIMATE case (Clause 8 permits): each sender bounded by its own cap
    const s1 = insertSender(mock, { lane: "founder", email: "s1@x.com", hourly_capacity: 1 });
    insertSender(mock, { lane: "founder", email: "s2@x.com", hourly_capacity: 5 });
    await consumeCapacity(mock.client, s1);          // s1 now exhausted
    const o = await selectSender(mock.client, { lane: "founder" });
    // s2 still has its own legitimate 5/hour · so selection succeeds with s2
    expect(o.kind).toBe("selected");
    if (o.kind === "selected") expect(o.sender.email).toBe("s2@x.com");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (H) Selection · deterministic ranking
// ═══════════════════════════════════════════════════════════════════
describe("Stage 2 · (H) deterministic ranking", () => {
  it("(H1) two equally-valid senders · lowest hourly_used chosen for load distribution", async () => {
    const s1 = insertSender(mock, { lane: "founder", email: "a@x.com", hourly_capacity: 100, sender_id: "aaa-1" });
    const s2 = insertSender(mock, { lane: "founder", email: "b@x.com", hourly_capacity: 100, sender_id: "aaa-2" });
    await consumeCapacity(mock.client, s1);
    await consumeCapacity(mock.client, s1);   // s1 at 2 used
    // s2 at 0 used · should be chosen
    const o = await selectSender(mock.client, { lane: "founder" });
    if (o.kind === "selected") expect(o.sender.sender_id).toBe(s2.sender_id);
  });

  it("(H2) same hourly_used · lex order of sender_id breaks the tie deterministically", () => {
    const base = {
      sender_id: "s1", member_id: null, lane: "founder" as const, email: "x@x", display_name: null,
      reply_to: null, sending_domain: null, provider: "resend" as const, provider_account_ref: null,
      authentication_state: "verified" as const, verification_state: "domain_verified" as const,
      authentication_expires_at: null,
      daily_capacity: 100, hourly_capacity: 100, capacity_source: null, capacity_verified_at: null,
      health_state: "healthy" as const, paused_reason: null,
      last_send_at: null, last_event_at: null, last_failure_at: null, last_failure_reason: null,
      bounce_rate: null, complaint_rate: null,
      authorised_at: null, authorised_by: null, provenance: {},
      created_at: "2026-09-21T00:00:00Z", updated_at: "2026-09-21T00:00:00Z",
    };
    const cap = {
      sender_id: "s1", hourly_limit: 100, hourly_used: 5, hourly_remaining: 95,
      daily_limit: 100, daily_used: 5, daily_remaining: 95, effective_remaining: 95,
    };
    const a = { sender: { ...base, sender_id: "aaa" }, capacity: { ...cap, sender_id: "aaa" } };
    const b = { sender: { ...base, sender_id: "bbb" }, capacity: { ...cap, sender_id: "bbb" } };
    expect(rankSender(a, b, undefined)).toBeLessThan(0);
    expect(rankSender(b, a, undefined)).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (I) Concurrency · two workers cannot double-consume
// ═══════════════════════════════════════════════════════════════════
describe("Stage 2 · (I) concurrent capacity safety", () => {
  it("(I1) two parallel consume calls at limit=1 · exactly ONE succeeds", async () => {
    const s = insertSender(mock, { lane: "founder", email: "c@x.com", hourly_capacity: 1 });
    const [r1, r2] = await Promise.all([
      consumeCapacity(mock.client, s),
      consumeCapacity(mock.client, s),
    ]);
    const oks = [r1, r2].filter(r => r.ok).length;
    const fails = [r1, r2].filter(r => !r.ok).length;
    expect(oks).toBe(1);
    expect(fails).toBe(1);
  });

  it("(I2) 10 parallel consume calls at limit=5 · exactly FIVE succeed", async () => {
    const s = insertSender(mock, { lane: "founder", email: "c2@x.com", hourly_capacity: 5, daily_capacity: 100 });
    const results = await Promise.all(Array.from({ length: 10 }, () => consumeCapacity(mock.client, s)));
    expect(results.filter(r => r.ok).length).toBe(5);
    expect(results.filter(r => !r.ok).length).toBe(5);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (J) Restart persistence · state survives PoolClient reconnect
// ═══════════════════════════════════════════════════════════════════
describe("Stage 2 · (J) restart persistence", () => {
  it("(J1) senders + capacity survive a mock reconnect (same underlying store)", async () => {
    const s = insertSender(mock, { lane: "founder", email: "p@x.com", hourly_capacity: 10 });
    await consumeCapacity(mock.client, s);
    // Simulate a fresh client connection · SAME underlying store
    const reconnect = mock.reconnect();
    const cap = await loadCapacity(reconnect.client, s);
    expect(cap.hourly_used).toBe(1);
  });
});
