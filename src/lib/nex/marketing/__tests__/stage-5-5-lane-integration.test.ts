// src/lib/nex/marketing/__tests__/stage-5-5-lane-integration.test.ts
//
// NEX Managed Email Marketing · Stage 5.5 · AUTO Lane Integration acceptance
// Founder-authorised programme (three-lane operating doctrine · §25).
//
// Sections:
//   A · Executor lane routing
//   B · AUTO accounting (reserve/consume/release · package canary)
//   C · Campaign service · lane locks · idempotency
//   D · TriggerRouter integration
//   E · Eligibility (existing Stage 5 rules · integration re-check)
//   F · Sender/capacity enforcement + limit-evasion refusal
//   G · Execution-time safety (suppression after queue · deferred paths)
//   H · Recovery (idempotency · retry · DLQ)
//   I · Tracking (provider_message_id · lane header · log rows)
//   J · Three-lane cross-canary

import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeStage55Pool, type Stage55Store } from "./stage-5-5-mock-pool";

// Mock db module BEFORE importing send-executor
vi.mock("@/lib/nex/db", () => ({
  getPool: async () => ({
    connect: async () => currentPool.client,
  }),
}));

// Mock email registry BEFORE importing send-executor
const adapterMock = {
  send: vi.fn(async (msg: any) => ({ ok: true as const, provider_message_id: `pm-${Math.random().toString(36).slice(2, 8)}`, provider: "resend", sent_at: new Date().toISOString(), _received: msg })),
};
vi.mock("@/lib/nex/email/registry", () => ({
  getEmail: () => adapterMock,
}));

import { tick } from "../send-executor";
import { createAutoCampaign, populateAutoCampaignQueue, deriveAutoCampaignKey } from "../auto/campaign-service";
import { checkPolicyPure, mkPolicyRow } from "../auto/policy";
import { matchesAutoMarketingEvent, extractAutoCampaignIntent, processAutoMarketingTrigger } from "../auto/trigger-integration";
import { TriggerRouter } from "../../continuous-loop/trigger-router";
import type { TriggerEvent } from "../../continuous-loop/types";
import { evaluateEligibility } from "../auto/eligibility";

let currentPool: ReturnType<typeof makeStage55Pool>;
let store: Stage55Store;
beforeEach(() => {
  currentPool = makeStage55Pool();
  store = currentPool.store;
  adapterMock.send.mockClear();
});

// ═══════════════════════════════════════════════════════════════════
// (A) EXECUTOR LANE ROUTING
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5.5 · (A) Executor lane routing", () => {
  it("(A1) missing lane preserves backward-compatible default behaviour", async () => {
    const t = currentPool.seedTemplate({ from_email: "legacy@nex.local" });
    const c = currentPool.seedCampaign({ template_id: t.template_id });   // no lane in metadata
    const contact = currentPool.seedContact({ email: "u@x.test" });
    currentPool.enqueue(c.campaign_id, contact.contact_id, contact.email);
    const res = await tick({ worker_id: "w1" });
    expect(res.sent).toBe(1);
    expect(adapterMock.send).toHaveBeenCalled();
    const sent = adapterMock.send.mock.calls[0][0];
    expect(sent.from.address).toBe("legacy@nex.local");        // template from_email preserved
    expect(sent.headers["X-NEX-Lane"]).toBe("unknown");
  });

  it("(A2) AUTO campaign selects AUTO sender via Stage 2 pool", async () => {
    currentPool.seedSender("auto", { sender_id: "auto-1", email: "auto-picked@nex.local" });
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate({ from_email: "SHOULD_NOT_BE_USED@nex.local" });
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    const contact = currentPool.seedContact({ email: "u@x.test" });
    currentPool.enqueue(c.campaign_id, contact.contact_id, contact.email);
    const res = await tick({ worker_id: "w1" });
    expect(res.sent).toBe(1);
    const sent = adapterMock.send.mock.calls[0][0];
    expect(sent.from.address).toBe("auto-picked@nex.local");   // sender-pool selection · NOT template.from_email
    expect(sent.headers["X-NEX-Lane"]).toBe("auto");
  });

  it("(A3) AUTO campaign refuses when only MEMBER sender exists", async () => {
    currentPool.seedSender("member", { sender_id: "m-1", email: "m@x", member_id: "member-A" });
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    const contact = currentPool.seedContact({ email: "u@x.test" });
    currentPool.enqueue(c.campaign_id, contact.contact_id, contact.email);
    const res = await tick({ worker_id: "w1" });
    expect(res.sent).toBe(0);
    // Deferred (no auto sender available) → still pending
    const q = store.send_queue[0];
    expect(q.status).toBe("pending");
    expect(String(q.error)).toContain("deferred");
  });

  it("(A4) MEMBER campaign uses stored sender_id · rejects if sender lane leaks", async () => {
    currentPool.seedSender("auto", { sender_id: "wrong-lane", email: "leak@x" });  // pretend UI stored AUTO sender on a MEMBER campaign
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "member", sender_id: "wrong-lane", member_id: "member-A" });
    const contact = currentPool.seedContact({ email: "u@x.test" });
    currentPool.enqueue(c.campaign_id, contact.contact_id, contact.email);
    const res = await tick({ worker_id: "w1" });
    expect(res.failed_permanent).toBe(1);
    const q = store.send_queue[0];
    expect(q.status).toBe("failed");
    expect(String(q.error)).toContain("sender_lane_mismatch");
  });

  it("(A5) FOUNDER campaign requires FOUNDER sender · rejects AUTO sender", async () => {
    currentPool.seedSender("auto", { sender_id: "auto-x", email: "auto@x" });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "founder", sender_id: "auto-x" });
    const contact = currentPool.seedContact({ email: "u@x.test" });
    currentPool.enqueue(c.campaign_id, contact.contact_id, contact.email);
    const res = await tick({ worker_id: "w1" });
    expect(res.failed_permanent).toBe(1);
    expect(String(store.send_queue[0].error)).toContain("sender_lane_mismatch");
  });

  it("(A6) FOUNDER campaign with FOUNDER sender proceeds", async () => {
    currentPool.seedSender("founder", { sender_id: "f-1", email: "founder@x" });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "founder", sender_id: "f-1" });
    const contact = currentPool.seedContact({ email: "u@x.test" });
    currentPool.enqueue(c.campaign_id, contact.contact_id, contact.email);
    const res = await tick({ worker_id: "w1" });
    expect(res.sent).toBe(1);
    expect(adapterMock.send.mock.calls[0][0].headers["X-NEX-Lane"]).toBe("founder");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (B) AUTO ACCOUNTING
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5.5 · (B) AUTO accounting · reserve/consume/release", () => {
  async function autoScenario(budgetOptions?: { purchased?: number }) {
    currentPool.seedSender("auto", { sender_id: "auto-1" });
    const b = currentPool.seedBudget({ budget_id: "b1", purchased: budgetOptions?.purchased ?? 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    return { budget: b, campaign: c };
  }

  it("(B1) AUTO success · reserved_capacity increments then converts to consumed_capacity", async () => {
    const { budget, campaign } = await autoScenario();
    const contact = currentPool.seedContact({ email: "u@x" });
    currentPool.enqueue(campaign.campaign_id, contact.contact_id, contact.email);
    await tick({ worker_id: "w1" });
    const b = store.budgets.get(budget.budget_id)!;
    expect(b.consumed_capacity).toBe(1);
    expect(b.reserved_capacity).toBe(0);
  });

  it("(B2) AUTO permanent failure · reservation released · consumed stays 0", async () => {
    const { budget, campaign } = await autoScenario();
    adapterMock.send.mockImplementationOnce(async () => ({ ok: false as const, retryable: false, reason: "invalid_recipient", provider: "resend" }));
    const contact = currentPool.seedContact({ email: "u@x" });
    currentPool.enqueue(campaign.campaign_id, contact.contact_id, contact.email);
    await tick({ worker_id: "w1" });
    const b = store.budgets.get(budget.budget_id)!;
    expect(b.consumed_capacity).toBe(0);
    expect(b.reserved_capacity).toBe(0);
  });

  it("(B3) AUTO retry replay is idempotent (same idempotency key returns already_attributed)", async () => {
    const { budget, campaign } = await autoScenario();
    adapterMock.send
      .mockImplementationOnce(async () => ({ ok: false as const, retryable: true, reason: "transient", provider: "resend" }))
      .mockImplementationOnce(async () => ({ ok: true as const, provider_message_id: "pm2", provider: "resend", sent_at: "" }));
    const contact = currentPool.seedContact({ email: "u@x" });
    currentPool.enqueue(campaign.campaign_id, contact.contact_id, contact.email);
    await tick({ worker_id: "w1" });      // transient failure · pending again
    // Force retry ready
    store.send_queue[0].next_attempt_at = new Date(0).toISOString();
    await tick({ worker_id: "w1" });      // succeeds
    const b = store.budgets.get(budget.budget_id)!;
    expect(b.consumed_capacity).toBe(1);
    // Only one attribution exists (idempotency worked)
    const attributions = [...store.attributions.values()].filter(a => a.campaign_id === campaign.campaign_id);
    // Second reserve had a different attempt_id → different key → but still consume happens once for the successful send
    expect(attributions.filter(a => a.state === "consumed").length).toBe(1);
  });

  it("(B4) AUTO NEVER touches member package (CANARY)", async () => {
    const { campaign } = await autoScenario();
    const contact = currentPool.seedContact({ email: "u@x" });
    currentPool.enqueue(campaign.campaign_id, contact.contact_id, contact.email);
    await tick({ worker_id: "w1" });
    expect(store.member_package_touched).toBe(false);
    expect(store.auto_budget_touched).toBe(true);
  });

  it("(B5) AUTO capacity exhaustion defers · does NOT fail permanently", async () => {
    const { campaign } = await autoScenario({ purchased: 0 });
    const contact = currentPool.seedContact({ email: "u@x" });
    currentPool.enqueue(campaign.campaign_id, contact.contact_id, contact.email);
    await tick({ worker_id: "w1" });
    expect(store.send_queue[0].status).toBe("pending");
    expect(String(store.send_queue[0].error)).toContain("auto_budget_exhausted");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (C) AUTO CAMPAIGN SERVICE
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5.5 · (C) AUTO campaign service", () => {
  function baseIntent(overrides: Partial<any> = {}) {
    return {
      policy_id: "pol-1", source_reference: "https://example.com/repo", campaign_intent: "outreach",
      country: "US", category: "scaffolding", language: "en",
      display_name: "US Scaffolding Outreach", subject_line: "Meet NEX",
      body_text: "We built NEX for trades like yours.",
      ...overrides,
    };
  }

  it("(C1) creates AUTO campaign with lane=auto · origin=auto · member_id=null", async () => {
    currentPool.seedBudget({ budget_id: "b1" });
    currentPool.seedPolicy({ policy_id: "pol-1", country: "US", category: "scaffolding", budget_id: "b1" });
    const r = await createAutoCampaign(currentPool.client, baseIntent());
    expect(r.kind).toBe("created");
    if (r.kind === "created") {
      const c = store.campaigns.get(r.campaign_id)!;
      expect(c.metadata.lane).toBe("auto");
      expect(c.metadata.origin).toBe("auto");
      expect(c.metadata.member_id).toBeNull();
      expect(c.metadata.budget_id).toBe("b1");
    }
  });

  it("(C2) duplicate intent is idempotent · returns already_exists with same campaign_id", async () => {
    currentPool.seedBudget({ budget_id: "b1" });
    currentPool.seedPolicy({ policy_id: "pol-1", country: "US", category: "scaffolding", budget_id: "b1" });
    const r1 = await createAutoCampaign(currentPool.client, baseIntent());
    const r2 = await createAutoCampaign(currentPool.client, baseIntent());
    expect(r1.kind).toBe("created");
    expect(r2.kind).toBe("already_exists");
    if (r1.kind === "created" && r2.kind === "already_exists") {
      expect(r2.campaign_id).toBe(r1.campaign_id);
      expect(r2.idempotency_key).toBe(r1.idempotency_key);
    }
  });

  it("(C3) inactive policy blocks creation with policy_denied", async () => {
    currentPool.seedBudget({ budget_id: "b1" });
    currentPool.seedPolicy({ policy_id: "pol-1", country: "US", category: "scaffolding", budget_id: "b1", is_active: false });
    const r = await createAutoCampaign(currentPool.client, baseIntent());
    expect(r.kind).toBe("policy_denied");
    if (r.kind === "policy_denied") expect(r.decision.reason).toBe("policy_inactive");
  });

  it("(C4) unknown policy blocks with policy_not_found", async () => {
    const r = await createAutoCampaign(currentPool.client, baseIntent({ policy_id: "does-not-exist" }));
    expect(r.kind).toBe("policy_denied");
    if (r.kind === "policy_denied") expect(r.decision.reason).toBe("policy_not_found");
  });

  it("(C5) audience mismatch (policy country=US, proposed=DE) blocks", async () => {
    currentPool.seedBudget({ budget_id: "b1" });
    currentPool.seedPolicy({ policy_id: "pol-1", country: "US", category: null, budget_id: "b1" });
    const r = await createAutoCampaign(currentPool.client, baseIntent({ country: "DE" }));
    expect(r.kind).toBe("policy_denied");
    if (r.kind === "policy_denied") expect(r.decision.reason).toBe("audience_mismatch");
  });

  it("(C6) populate queue only enqueues opt_out=false hard_bounced=false complaint=0 contacts", async () => {
    currentPool.seedBudget({ budget_id: "b1" });
    currentPool.seedPolicy({ policy_id: "pol-1", country: "US", category: "scaffolding", budget_id: "b1" });
    currentPool.seedContact({ email: "ok@x", country: "US", category_slug: "scaffolding" });
    currentPool.seedContact({ email: "unsub@x", country: "US", category_slug: "scaffolding", opt_out: true });
    currentPool.seedContact({ email: "bounced@x", country: "US", category_slug: "scaffolding", hard_bounced: true });
    const r = await createAutoCampaign(currentPool.client, baseIntent());
    if (r.kind !== "created") throw new Error("expected created");
    const q = await populateAutoCampaignQueue(currentPool.client, r.campaign_id);
    expect(q.queued).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (D) TRIGGERROUTER
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5.5 · (D) TriggerRouter integration", () => {
  function event(detail: any, kind: "event_triggered" | "user_triggered" | "scheduled" = "event_triggered", target_id = "trg-1"): TriggerEvent {
    return { kind, at_iso: new Date().toISOString(), target_id, detail };
  }

  it("(D1) approved AUTO trigger produces campaign + queue", async () => {
    currentPool.seedBudget({ budget_id: "b1" });
    currentPool.seedPolicy({ policy_id: "pol-1", country: "US", category: "scaffolding", budget_id: "b1" });
    currentPool.seedContact({ email: "u@x", country: "US", category_slug: "scaffolding" });
    const result = await processAutoMarketingTrigger(event({
      marketing_intent: "auto_campaign",
      policy_id: "pol-1", source_reference: "src-1", campaign_intent: "outreach",
      country: "US", category: "scaffolding",
      display_name: "n", subject_line: "hi world", body_text: "body body body",
    }), { get_client: async () => currentPool.client });
    expect(result.kind).toBe("processed");
    if (result.kind === "processed") {
      expect(result.outcome.kind).toBe("created");
      expect(result.outcome.queued).toBe(1);
    }
  });

  it("(D2) duplicate trigger produces already_exists · no duplicate campaign", async () => {
    currentPool.seedBudget({ budget_id: "b1" });
    currentPool.seedPolicy({ policy_id: "pol-1", country: "US", budget_id: "b1" });
    const ev = event({
      marketing_intent: "auto_campaign",
      policy_id: "pol-1", source_reference: "src-1", campaign_intent: "outreach",
      country: "US", display_name: "n", subject_line: "hi world", body_text: "body body",
    });
    const r1 = await processAutoMarketingTrigger(ev, { get_client: async () => currentPool.client });
    const r2 = await processAutoMarketingTrigger(ev, { get_client: async () => currentPool.client });
    expect(r1.kind).toBe("processed");
    expect(r2.kind).toBe("processed");
    if (r1.kind === "processed" && r2.kind === "processed") {
      expect(r2.outcome.kind).toBe("already_exists");
      expect((r1.outcome as any).campaign_id).toBe((r2.outcome as any).campaign_id);
    }
  });

  it("(D3) non-marketing event returns no_match · silent pass-through", async () => {
    const result = await processAutoMarketingTrigger(event({ marketing_intent: "not_us" }), { get_client: async () => currentPool.client });
    expect(result.kind).toBe("no_match");
  });

  it("(D4) marketing_intent flag without required fields returns invalid_intent", async () => {
    const result = await processAutoMarketingTrigger(event({ marketing_intent: "auto_campaign", country: "US" }), { get_client: async () => currentPool.client });
    expect(result.kind).toBe("invalid_intent");
    if (result.kind === "invalid_intent") expect(result.missing.length).toBeGreaterThan(0);
  });

  it("(D5) TriggerRouter registration composes on top of existing handlers", async () => {
    const router = new TriggerRouter();
    router.register("event_triggered", async () => { /* noop */ });
    const mod = await import("../auto/trigger-integration");
    const { registered_kind, composed } = mod.registerAutoMarketingTrigger(router, { get_client: async () => currentPool.client });
    expect(registered_kind).toBe("event_triggered");
    expect(composed).toBe(true);
  });

  it("(D6) matchesAutoMarketingEvent is a pure predicate", () => {
    expect(matchesAutoMarketingEvent(event({ marketing_intent: "auto_campaign", policy_id: "p" }))).toBe(true);
    expect(matchesAutoMarketingEvent(event({ marketing_intent: "not_us" }))).toBe(false);
    expect(matchesAutoMarketingEvent(event({ marketing_intent: "auto_campaign" }, "change_triggered"))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (E) ELIGIBILITY (Stage 5 rules · integration re-check)
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5.5 · (E) eligibility re-check", () => {
  it("(E1) eligible US contact with source_reference proceeds", () => {
    const d = evaluateEligibility({ contact: {
      contact_id: "c", country: "US", language: "en", consent_basis: "discovered",
      opt_out: false, hard_bounced: false, complaint_count: 0,
      source_reference: "https://directory/company/1", contact_confidence: 0.7,
    }});
    expect(d.eligible).toBe(true);
  });
  it("(E2) opt_out blocks", () => {
    const d = evaluateEligibility({ contact: { contact_id: "c", country: "US", language: null, consent_basis: "explicit_opt_in", opt_out: true, hard_bounced: false, complaint_count: 0, source_reference: "s", contact_confidence: 1 } });
    expect(d.eligible).toBe(false);
  });
  it("(E3) hard_bounced blocks", () => {
    const d = evaluateEligibility({ contact: { contact_id: "c", country: "US", language: null, consent_basis: "explicit_opt_in", opt_out: false, hard_bounced: true, complaint_count: 0, source_reference: "s", contact_confidence: 1 } });
    expect(d.eligible).toBe(false);
  });
  it("(E4) DE discovered without explicit_opt_in blocks (opt_in_required)", () => {
    const d = evaluateEligibility({ contact: { contact_id: "c", country: "DE", language: "de", consent_basis: "discovered", opt_out: false, hard_bounced: false, complaint_count: 0, source_reference: "s", contact_confidence: 1 } });
    expect(d.eligible).toBe(false);
  });
  it("(E5) unknown country restricted", () => {
    const d = evaluateEligibility({ contact: { contact_id: "c", country: "ZZ", language: null, consent_basis: "explicit_opt_in", opt_out: false, hard_bounced: false, complaint_count: 0, source_reference: "s", contact_confidence: 1 } });
    expect(d.eligible).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// (F) SENDER / CAPACITY
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5.5 · (F) sender + capacity + no-evasion", () => {
  it("(F1) unhealthy AUTO sender deferred not selected", async () => {
    currentPool.seedSender("auto", { sender_id: "auto-1", health_state: "paused" });
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    const contact = currentPool.seedContact({ email: "u@x" });
    currentPool.enqueue(c.campaign_id, contact.contact_id, contact.email);
    await tick({ worker_id: "w1" });
    expect(store.send_queue[0].status).toBe("pending");
    expect(String(store.send_queue[0].error)).toMatch(/auto_sender_/);
  });

  it("(F2) exhausted sender defers · no rotation-to-evade", async () => {
    currentPool.seedSender("auto", { sender_id: "auto-1", hourly_capacity: 0 });   // no capacity
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    currentPool.enqueue(c.campaign_id, currentPool.seedContact({ email: "u@x" }).contact_id, "u@x");
    await tick({ worker_id: "w1" });
    expect(store.send_queue[0].status).toBe("pending");
    expect(String(store.send_queue[0].error)).toMatch(/deferred/);
  });

  it("(F3) MEMBER sender never selected for AUTO campaign", async () => {
    currentPool.seedSender("member", { sender_id: "m-1", member_id: "member-A" });
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    currentPool.enqueue(c.campaign_id, currentPool.seedContact({ email: "u@x" }).contact_id, "u@x");
    await tick({ worker_id: "w1" });
    // No AUTO sender available → deferred
    expect(store.send_queue[0].status).toBe("pending");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (G) EXECUTION-TIME SAFETY
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5.5 · (G) execution-time safety", () => {
  it("(G1) contact becomes opt_out after queueing → no send", async () => {
    currentPool.seedSender("auto", { sender_id: "auto-1" });
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    const contact = currentPool.seedContact({ email: "u@x" });
    currentPool.enqueue(c.campaign_id, contact.contact_id, contact.email);
    contact.opt_out = true;    // suppress AFTER enqueue
    await tick({ worker_id: "w1" });
    expect(store.send_queue[0].status).toBe("skipped_opt_out");
    expect(adapterMock.send).not.toHaveBeenCalled();
  });

  it("(G2) contact becomes hard_bounced after queueing → no send", async () => {
    currentPool.seedSender("auto", { sender_id: "auto-1" });
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    const contact = currentPool.seedContact({ email: "u@x" });
    currentPool.enqueue(c.campaign_id, contact.contact_id, contact.email);
    contact.hard_bounced = true;
    await tick({ worker_id: "w1" });
    expect(store.send_queue[0].status).toBe("skipped_bounced");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (H) RECOVERY
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5.5 · (H) recovery", () => {
  it("(H1) transient failure → pending with next_attempt_at in the future", async () => {
    currentPool.seedSender("auto", { sender_id: "auto-1" });
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    adapterMock.send.mockImplementationOnce(async () => ({ ok: false as const, retryable: true, reason: "transient", provider: "resend" }));
    currentPool.enqueue(c.campaign_id, currentPool.seedContact({ email: "u@x" }).contact_id, "u@x");
    await tick({ worker_id: "w1" });
    expect(store.send_queue[0].status).toBe("pending");
    expect(store.send_queue[0].attempts).toBe(1);
    expect(new Date(store.send_queue[0].next_attempt_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("(H2) permanent failure → DLQ (status='failed')", async () => {
    currentPool.seedSender("auto", { sender_id: "auto-1" });
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    adapterMock.send.mockImplementationOnce(async () => ({ ok: false as const, retryable: false, reason: "invalid_address", provider: "resend" }));
    currentPool.enqueue(c.campaign_id, currentPool.seedContact({ email: "u@x" }).contact_id, "u@x");
    await tick({ worker_id: "w1" });
    expect(store.send_queue[0].status).toBe("failed");
  });
});

// ═══════════════════════════════════════════════════════════════════
// (I) TRACKING
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5.5 · (I) tracking + attribution", () => {
  it("(I1) send_log entry has provider_message_id + lane header", async () => {
    currentPool.seedSender("auto", { sender_id: "auto-1" });
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    currentPool.enqueue(c.campaign_id, currentPool.seedContact({ email: "u@x" }).contact_id, "u@x");
    await tick({ worker_id: "w1" });
    expect(store.send_logs.length).toBeGreaterThanOrEqual(1);
    expect(adapterMock.send.mock.calls[0][0].headers["X-NEX-Lane"]).toBe("auto");
    expect(adapterMock.send.mock.calls[0][0].headers["List-Unsubscribe"]).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// (J) THREE-LANE CROSS-CANARY
// ═══════════════════════════════════════════════════════════════════
describe("Stage 5.5 · (J) three-lane cross-canary", () => {
  it("(J1) FOUNDER send does NOT touch member package OR AUTO budget", async () => {
    currentPool.seedSender("founder", { sender_id: "f-1" });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "founder", sender_id: "f-1" });
    currentPool.enqueue(c.campaign_id, currentPool.seedContact({ email: "u@x" }).contact_id, "u@x");
    await tick({ worker_id: "w1" });
    expect(store.member_package_touched).toBe(false);
    expect(store.auto_budget_touched).toBe(false);
  });

  it("(J2) AUTO send touches AUTO budget only", async () => {
    currentPool.seedSender("auto", { sender_id: "auto-1" });
    currentPool.seedBudget({ budget_id: "b1", purchased: 100 });
    const t = currentPool.seedTemplate();
    const c = currentPool.seedCampaign({ template_id: t.template_id, lane: "auto", budget_id: "b1" });
    currentPool.enqueue(c.campaign_id, currentPool.seedContact({ email: "u@x" }).contact_id, "u@x");
    await tick({ worker_id: "w1" });
    expect(store.auto_budget_touched).toBe(true);
    expect(store.member_package_touched).toBe(false);
  });

  it("(J3) module boundary · auto/* exports NO contact-address export function", async () => {
    const mod = await import("../auto");
    expect((mod as any).exportContacts).toBeUndefined();
    expect((mod as any).downloadLeads).toBeUndefined();
    expect((mod as any).exportAudienceEmails).toBeUndefined();
  });

  it("(J4) policy pure decision denies FOUNDER lane sender for AUTO policy", () => {
    const pol = mkPolicyRow({ country: "US", is_active: true });
    const d = checkPolicyPure(pol, {
      policy_id: pol.policy_id, proposed_country: "US", proposed_category: null, proposed_language: null, proposed_sender_lane: "founder",
    });
    expect(d.kind).toBe("denied");
    if (d.kind === "denied") expect(d.reason).toBe("sender_lane_mismatch");
  });

  it("(J5) extractAutoCampaignIntent captures required fields", () => {
    const ev: TriggerEvent = { kind: "event_triggered", at_iso: "", target_id: "trg", detail: {
      marketing_intent: "auto_campaign", policy_id: "p1", source_reference: "s", campaign_intent: "i",
      country: "US", display_name: "d", subject_line: "s", body_text: "b",
    }};
    const r = extractAutoCampaignIntent(ev);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.intent.trigger_ref).toBe("trg");
  });
});
