// src/lib/nex/marketing/deliverability/__tests__/event-recorder.test.ts
//
// NEX Deliverability · Bounce Event Recorder acceptance
// Founder-authorised programme · Session-7 · Part 11c+11d · 2026-09-21.

import { describe, it, expect } from "vitest";
import type { PoolClient, QueryResult } from "pg";
import {
  recordClassifiedEvent, computeEventFingerprint, eventTypeFor, bounceTypeFor,
  _RECORDER_NEVER_FABRICATES, _RECORDER_NEVER_REVERSES_SUPPRESSION, _RECORDER_IDEMPOTENT_BY_FINGERPRINT,
  type ClassifiedEvent,
} from "..";

// ─── SQL-faithful in-memory mock (bounce_log + marketing_contact + marketing_opt_out) ─
function makeMock() {
  const store: any = {
    bounce_log: [] as any[],
    contacts: new Map<string, any>(),   // key: lowercase email
    opt_out: new Map<string, any>(),
    send_log: [] as any[],
    campaigns: new Map<string, any>(),
    reputation: new Map<string, any>(),
    reputation_recomputed_for: new Set<string>(),
  };
  let seq = 1;
  const client: PoolClient = {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.trim().replace(/\s+/g, " ");
      // INSERT bounce_log with ON CONFLICT
      if (/^INSERT INTO nex\.marketing_bounce_log/i.test(norm)) {
        const [received_at, esp, esp_message_id, email, event_type, bounce_type,
               bounce_subtype, raw_payload, event_fingerprint,
               classifier_reason, classifier_matched_signal, classifier_kind] = params;
        // Idempotency check
        if (store.bounce_log.some((r: any) => r.event_fingerprint === event_fingerprint)) {
          return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        }
        const event_id = `evt-${seq++}`;
        store.bounce_log.push({
          event_id, received_at, esp, esp_message_id, email,
          event_type, bounce_type, bounce_subtype, raw_payload,
          event_fingerprint, classifier_reason, classifier_matched_signal, classifier_kind,
          recipient_updated_at: null,
        });
        return { rows: [{ event_id, xmax_is_zero: true }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // SELECT existing bounce_log by fingerprint
      if (/^SELECT event_id FROM nex\.marketing_bounce_log WHERE event_fingerprint = \$1/i.test(norm)) {
        const row = store.bounce_log.find((r: any) => r.event_fingerprint === params[0]);
        return { rows: row ? [{ event_id: row.event_id }] : [], rowCount: row ? 1 : 0, command: "", oid: 0, fields: [] };
      }
      // UPDATE bounce_log SET recipient_updated_at
      if (/^UPDATE nex\.marketing_bounce_log SET recipient_updated_at = now\(\) WHERE event_id = \$1/i.test(norm)) {
        const row = store.bounce_log.find((r: any) => r.event_id === params[0]);
        if (row) row.recipient_updated_at = new Date().toISOString();
        return { rows: [], rowCount: row ? 1 : 0, command: "", oid: 0, fields: [] };
      }
      // UPDATE marketing_contact (hard_bounce cascade)
      if (/^UPDATE nex\.marketing_contact SET hard_bounced = TRUE/i.test(norm)) {
        const email_lower = params[0];
        const c = store.contacts.get(email_lower);
        if (c) {
          c.hard_bounced = true; c.opt_out = true;
          c.opt_out_at = c.opt_out_at ?? new Date().toISOString();
          c.opt_out_reason = c.opt_out_reason ?? "hard_bounce";
          return { rows: [], rowCount: 1, command: "", oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
      }
      // UPDATE marketing_contact (complaint cascade)
      if (/^UPDATE nex\.marketing_contact SET complaint_count = complaint_count \+ 1/i.test(norm)) {
        const email_lower = params[0];
        const c = store.contacts.get(email_lower);
        if (c) {
          c.complaint_count = (c.complaint_count ?? 0) + 1;
          c.opt_out = true;
          c.opt_out_at = c.opt_out_at ?? new Date().toISOString();
          c.opt_out_reason = c.opt_out_reason ?? "complaint";
          return { rows: [], rowCount: 1, command: "", oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
      }
      // UPDATE marketing_contact (unsubscribe cascade)
      if (/^UPDATE nex\.marketing_contact SET opt_out = TRUE, opt_out_at/i.test(norm)) {
        const email_lower = params[0];
        const c = store.contacts.get(email_lower);
        if (c) {
          c.opt_out = true;
          c.opt_out_at = c.opt_out_at ?? new Date().toISOString();
          c.opt_out_reason = c.opt_out_reason ?? "unsubscribe";
          return { rows: [], rowCount: 1, command: "", oid: 0, fields: [] };
        }
        return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
      }
      // INSERT marketing_opt_out
      if (/^INSERT INTO nex\.marketing_opt_out/i.test(norm)) {
        const [email, reason, channel, metadata_json] = params;
        if (!store.opt_out.has(email)) {
          store.opt_out.set(email, { email, reason, channel, metadata: JSON.parse(metadata_json), first_recorded_at: new Date().toISOString() });
        }
        return { rows: [], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // findSenderForMessage
      if (/^SELECT COALESCE\(c\.metadata->>'sender_id', NULL\) AS sender_id/i.test(norm)) {
        const message_id = params[0];
        const sl = store.send_log.find((r: any) => r.esp_message_id === message_id);
        if (!sl) return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
        const camp = store.campaigns.get(sl.campaign_id);
        return { rows: [{ sender_id: camp?.metadata?.sender_id ?? null }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      // recomputeSenderReputation SQL patterns (from Session-5) · return empty
      if (/^SELECT sender_id, email FROM nex\.marketing_sender_identity WHERE sender_id = \$1/i.test(norm)) {
        // We fake the sender's presence so recomputeSenderReputation proceeds
        store.reputation_recomputed_for.add(params[0]);
        return { rows: [{ sender_id: params[0], email: "s@test" }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      if (/COUNT\(\*\) FILTER \(WHERE status = 'accepted'\)/i.test(norm)) {
        return { rows: [{ sends: 0, bounces: 0, complaints: 0, unsubs: 0 }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      if (/COUNT\(\*\) FILTER \(WHERE bl\.event_type = 'bounce'\)/i.test(norm)) {
        return { rows: [{ b: 0, c: 0, u: 0 }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      if (/PERCENTILE_DISC/i.test(norm)) {
        return { rows: [{ p50: null, p95: null }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      if (/^INSERT INTO nex\.marketing_sender_reputation/i.test(norm)) {
        return { rows: [{ sender_id: params[0], sends_24h: 0, sends_7d: 0, bounces_24h: 0, bounces_7d: 0, complaints_24h: 0, complaints_7d: 0, unsubs_24h: 0, unsubs_7d: 0, bounce_rate_24h: null, bounce_rate_7d: null, complaint_rate_24h: null, complaint_rate_7d: null, delivery_latency_p50_ms: null, delivery_latency_p95_ms: null, reputation_state: "unknown", reputation_reason: null, computed_at: new Date().toISOString(), window_end_at: new Date().toISOString() }], rowCount: 1, command: "", oid: 0, fields: [] };
      }
      throw new Error(`event-recorder mock: unhandled SQL: ${norm.slice(0, 150)}`);
    },
    release() {},
  } as unknown as PoolClient;

  return {
    client, store,
    seedContact(email: string, opts: any = {}) {
      store.contacts.set(email.toLowerCase(), {
        email, opt_out: false, hard_bounced: false, complaint_count: 0,
        opt_out_at: null, opt_out_reason: null, ...opts,
      });
    },
    seedSendLog(esp_message_id: string, campaign_id: string, sender_id: string) {
      store.send_log.push({ esp_message_id, campaign_id });
      store.campaigns.set(campaign_id, { campaign_id, metadata: { sender_id } });
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────
const now = () => new Date().toISOString();

function evt(overrides: Partial<ClassifiedEvent> = {}): ClassifiedEvent {
  return {
    kind: "hard_bounce",
    provider: "resend",
    reason: "test",
    matched_signal: "test",
    recipient_email: "a@example.com",
    provider_message_id: "msg-1",
    smtp_code: null,
    diagnostic_snippet: null,
    received_at: now(),
    raw_type: "email.bounced",
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// A · event_type mapping
// ═══════════════════════════════════════════════════════════════════
describe("Event recorder · (A) event_type mapping", () => {
  it("(A1) maps classifier kinds → existing Stage-1 event_type vocabulary", () => {
    expect(eventTypeFor("hard_bounce")).toBe("bounce");
    expect(eventTypeFor("soft_bounce")).toBe("bounce");
    expect(eventTypeFor("complaint")).toBe("complaint");
    expect(eventTypeFor("unsubscribe")).toBe("unsubscribe");
    expect(eventTypeFor("delivery")).toBe("delivery");
    expect(eventTypeFor("open")).toBe("open");
    expect(eventTypeFor("click")).toBe("click");
    expect(eventTypeFor("block")).toBe("block");
    expect(eventTypeFor("unknown")).toBe("unknown");
  });
  it("(A2) bounce_type refinement · hard/soft only for bounces · null otherwise", () => {
    expect(bounceTypeFor("hard_bounce")).toBe("hard");
    expect(bounceTypeFor("soft_bounce")).toBe("soft");
    expect(bounceTypeFor("complaint")).toBeNull();
    expect(bounceTypeFor("delivery")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════
// B · Fingerprint (idempotency key)
// ═══════════════════════════════════════════════════════════════════
describe("Event recorder · (B) fingerprint", () => {
  it("(B1) same event twice within the same minute → same fingerprint", () => {
    const e = evt({ received_at: "2026-09-21T12:34:56Z" });
    const f1 = computeEventFingerprint(e, "resend");
    const f2 = computeEventFingerprint({ ...e, received_at: "2026-09-21T12:34:59Z" }, "resend");
    expect(f1).toBe(f2);
  });
  it("(B2) different minutes → different fingerprints (legitimate providers re-fire over time)", () => {
    const f1 = computeEventFingerprint(evt({ received_at: "2026-09-21T12:34:00Z" }), "resend");
    const f2 = computeEventFingerprint(evt({ received_at: "2026-09-21T12:35:00Z" }), "resend");
    expect(f1).not.toBe(f2);
  });
  it("(B3) different kinds → different fingerprints", () => {
    const f1 = computeEventFingerprint(evt({ kind: "hard_bounce" }), "resend");
    const f2 = computeEventFingerprint(evt({ kind: "soft_bounce" }), "resend");
    expect(f1).not.toBe(f2);
  });
  it("(B4) different message_ids → different fingerprints", () => {
    const f1 = computeEventFingerprint(evt({ provider_message_id: "msg-1" }), "resend");
    const f2 = computeEventFingerprint(evt({ provider_message_id: "msg-2" }), "resend");
    expect(f1).not.toBe(f2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// C · Recording · basic paths
// ═══════════════════════════════════════════════════════════════════
describe("Event recorder · (C) recording", () => {
  it("(C1) hard_bounce written · contact suppressed · opt_out row created", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com");
    const r = await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "hard_bounce" }),
      auto_recompute_reputation: false,
    });
    expect(r.kind).toBe("recorded");
    if (r.kind === "recorded") {
      expect(r.recipient_updated).toBe(true);
      expect(mock.store.contacts.get("a@example.com").hard_bounced).toBe(true);
      expect(mock.store.contacts.get("a@example.com").opt_out).toBe(true);
      expect(mock.store.opt_out.has("a@example.com")).toBe(true);
      expect(mock.store.opt_out.get("a@example.com").reason).toBe("hard_bounce");
    }
  });

  it("(C2) complaint · complaint_count incremented · opt_out=true", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com", { complaint_count: 0 });
    const r = await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "complaint" }),
      auto_recompute_reputation: false,
    });
    expect(r.kind).toBe("recorded");
    expect(mock.store.contacts.get("a@example.com").complaint_count).toBe(1);
    expect(mock.store.contacts.get("a@example.com").opt_out).toBe(true);
    expect(mock.store.opt_out.get("a@example.com").reason).toBe("complaint");
  });

  it("(C3) unsubscribe · opt_out=true · marketing_opt_out row", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com");
    const r = await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "unsubscribe" }),
      auto_recompute_reputation: false,
    });
    expect(r.kind).toBe("recorded");
    expect(mock.store.contacts.get("a@example.com").opt_out).toBe(true);
    expect(mock.store.contacts.get("a@example.com").opt_out_reason).toBe("unsubscribe");
  });

  it("(C4) soft_bounce · NO contact suppression cascade (retryable)", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com");
    const r = await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "soft_bounce" }),
      auto_recompute_reputation: false,
    });
    expect(r.kind).toBe("recorded");
    if (r.kind === "recorded") expect(r.recipient_updated).toBe(false);
    expect(mock.store.contacts.get("a@example.com").opt_out).toBe(false);
    expect(mock.store.contacts.get("a@example.com").hard_bounced).toBe(false);
  });

  it("(C5) delivery · recorded but NO cascade", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com");
    const r = await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "delivery" }),
      auto_recompute_reputation: false,
    });
    expect(r.kind).toBe("recorded");
    expect(mock.store.bounce_log).toHaveLength(1);
    expect(mock.store.contacts.get("a@example.com").opt_out).toBe(false);
  });

  it("(C6) open / click · recorded but zero contact impact", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com");
    await recordClassifiedEvent(mock.client, { event: evt({ kind: "open" }), auto_recompute_reputation: false });
    await recordClassifiedEvent(mock.client, { event: evt({ kind: "click", received_at: new Date(Date.now() + 60_001).toISOString() }), auto_recompute_reputation: false });
    expect(mock.store.bounce_log).toHaveLength(2);
    expect(mock.store.contacts.get("a@example.com").opt_out).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// D · Idempotency
// ═══════════════════════════════════════════════════════════════════
describe("Event recorder · (D) idempotency", () => {
  it("(D1) same event fired twice within the same minute · second returns already_recorded · no double cascade", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com");
    const e = evt({ kind: "complaint", received_at: "2026-09-21T12:34:56Z" });
    const r1 = await recordClassifiedEvent(mock.client, { event: e, auto_recompute_reputation: false });
    const r2 = await recordClassifiedEvent(mock.client, { event: e, auto_recompute_reputation: false });
    expect(r1.kind).toBe("recorded");
    expect(r2.kind).toBe("already_recorded");
    if (r2.kind === "already_recorded") {
      expect(r2.event_id).toBe((r1 as any).event_id);
    }
    // complaint_count incremented exactly once
    expect(mock.store.contacts.get("a@example.com").complaint_count).toBe(1);
    expect(mock.store.bounce_log).toHaveLength(1);
  });

  it("(D2) same event different minute · both written · double cascade for complaint", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com");
    const r1 = await recordClassifiedEvent(mock.client, { event: evt({ kind: "complaint", received_at: "2026-09-21T12:34:00Z" }), auto_recompute_reputation: false });
    const r2 = await recordClassifiedEvent(mock.client, { event: evt({ kind: "complaint", received_at: "2026-09-21T12:35:00Z" }), auto_recompute_reputation: false });
    expect(r1.kind).toBe("recorded");
    expect(r2.kind).toBe("recorded");
    expect(mock.store.contacts.get("a@example.com").complaint_count).toBe(2);
    expect(mock.store.bounce_log).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// E · Insufficient evidence
// ═══════════════════════════════════════════════════════════════════
describe("Event recorder · (E) insufficient evidence", () => {
  it("(E1) kind=unknown → insufficient_evidence · never fabricated", async () => {
    const mock = makeMock();
    const r = await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "unknown", reason: "provider_not_recognised" }),
      auto_recompute_reputation: false,
    });
    expect(r.kind).toBe("insufficient_evidence");
    if (r.kind === "insufficient_evidence") expect(r.reason).toBe("kind_unknown");
    expect(mock.store.bounce_log).toHaveLength(0);
  });
  it("(E2) no recipient AND no message_id → insufficient_evidence", async () => {
    const mock = makeMock();
    const r = await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "delivery", recipient_email: null, provider_message_id: null }),
      auto_recompute_reputation: false,
    });
    expect(r.kind).toBe("insufficient_evidence");
    if (r.kind === "insufficient_evidence") expect(r.reason).toBe("no_recipient_and_no_message_id");
  });
});

// ═══════════════════════════════════════════════════════════════════
// F · Reputation recomputation
// ═══════════════════════════════════════════════════════════════════
describe("Event recorder · (F) reputation recomputation", () => {
  it("(F1) hard_bounce with message_id AND known sender → recomputes reputation", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com");
    mock.seedSendLog("msg-1", "campaign-1", "sender-1");
    const r = await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "hard_bounce", provider_message_id: "msg-1" }),
      auto_recompute_reputation: true,
    });
    expect(r.kind).toBe("recorded");
    if (r.kind === "recorded") {
      expect(r.reputation_recomputed).toBe(true);
      expect(r.sender_id).toBe("sender-1");
    }
    expect(mock.store.reputation_recomputed_for.has("sender-1")).toBe(true);
  });
  it("(F2) auto_recompute_reputation=false → skipped even with sender known", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com");
    mock.seedSendLog("msg-1", "campaign-1", "sender-1");
    const r = await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "hard_bounce", provider_message_id: "msg-1" }),
      auto_recompute_reputation: false,
    });
    if (r.kind === "recorded") {
      expect(r.reputation_recomputed).toBe(false);
    }
  });
  it("(F3) no send_log correlation → recomputation skipped · sender_id null", async () => {
    const mock = makeMock();
    mock.seedContact("a@example.com");
    const r = await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "hard_bounce", provider_message_id: "msg-unknown" }),
      auto_recompute_reputation: true,
    });
    if (r.kind === "recorded") {
      expect(r.reputation_recomputed).toBe(false);
      expect(r.sender_id).toBeNull();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// G · Governance canaries
// ═══════════════════════════════════════════════════════════════════
describe("Event recorder · (G) governance canaries", () => {
  it("(G1) boundary markers exported", () => {
    expect(_RECORDER_NEVER_FABRICATES).toBe("records_only_provided_ClassifiedEvent_never_synthesised");
    expect(_RECORDER_NEVER_REVERSES_SUPPRESSION).toBe("hard_bounce_and_complaint_and_unsubscribe_cascade_is_one_way");
    expect(_RECORDER_IDEMPOTENT_BY_FINGERPRINT).toBe("same_fingerprint_writes_once_returns_already_recorded_on_duplicate");
  });
  it("(G2) module exports NO reverse-suppression / unsuppress / clear-hardbounce function", async () => {
    const mod = await import("..");
    expect((mod as any).reverseSuppression).toBeUndefined();
    expect((mod as any).unsuppressContact).toBeUndefined();
    expect((mod as any).clearHardBounce).toBeUndefined();
    expect((mod as any).markContactSendable).toBeUndefined();
    expect((mod as any).removeFromOptOutList).toBeUndefined();
    expect((mod as any).synthesiseEvent).toBeUndefined();
  });
  it("(G3) hard_bounce on already-suppressed contact preserves original opt_out_at (never overwrites)", async () => {
    const mock = makeMock();
    const first_opt_out_at = "2026-01-01T00:00:00Z";
    mock.seedContact("a@example.com", { opt_out: true, opt_out_at: first_opt_out_at, opt_out_reason: "manual" });
    await recordClassifiedEvent(mock.client, {
      event: evt({ kind: "hard_bounce" }),
      auto_recompute_reputation: false,
    });
    // COALESCE preserves the original values · never overwritten by a later cascade
    expect(mock.store.contacts.get("a@example.com").opt_out_at).toBe(first_opt_out_at);
    expect(mock.store.contacts.get("a@example.com").opt_out_reason).toBe("manual");
    // But hard_bounced flag is still set
    expect(mock.store.contacts.get("a@example.com").hard_bounced).toBe(true);
  });
});
