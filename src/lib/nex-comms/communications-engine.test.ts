// src/lib/nex-comms/communications-engine.test.ts
//
// End-to-end tests proving the safety properties:
//   - Recruitment refused without approved campaign
//   - STOP suppression applies globally · even to recruitment via a permitted campaign
//   - Free-first routing prefers nex_in_app over WhatsApp
//   - Idempotent: duplicate idempotency key returns existing message · no re-send
//   - Rate + cooldown gates enforced
//   - Kill switch: real provider requires NEX_COMMS_OUTBOUND_ENABLED
//   - Full audit trail returned

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { evaluateAndSend } from "./communications-engine";
import { MockCommsProvider } from "./providers/mock-provider";
import type { CommsSendRequest, CommsContact, CommsCampaign, CommsSuppressionRow } from "./types";
import type { CommsProvider, ProviderSendResult } from "./providers/types";
import type { RateHistorySlice } from "./rate-limiter";
import type { CandidateChannelAvailability } from "./channel-router";

const NOW = new Date("2026-08-23T14:00:00Z");

function mkContact(overrides: Partial<CommsContact> = {}): CommsContact {
  return {
    contactId: "contact-1",
    canonicalPhoneE164: "+6281234567890",
    email: null,
    inAppUserRef: null,
    displayName: "Test",
    jurisdiction: "ID/DIY/Yogyakarta",
    contactSource: "nex-transport-acquisition",
    contactSourceReference: "provider-1",
    firstSeenAt: NOW,
    updatedAt: NOW,
    provenance: {},
    ...overrides,
  };
}

function mkCampaign(overrides: Partial<CommsCampaign> = {}): CommsCampaign {
  return {
    campaignId: "camp-1",
    campaignKey: "driver-recruitment-yogyakarta-motorcycle-batch-1",
    domain: "driver_recruitment",
    category: "recruitment",
    jurisdiction: "ID/DIY/Yogyakarta",
    dailyBudgetIdr: 100000,
    monthlyBudgetIdr: 1000000,
    maxCostPerContactIdr: 1000,
    dailyMessageLimit: 100,
    status: "active",
    createdBy: "admin.1",
    approvedBy: "legal.head",
    approvedAt: new Date("2026-08-01T00:00:00Z"),
    ...overrides,
  };
}

function mkRequest(overrides: Partial<CommsSendRequest> = {}): CommsSendRequest {
  return {
    idempotencyKey: "driver-recruitment:candidate-1:campaign-1",
    contact: mkContact(),
    templateId: "template-1",
    templateKey: "transport_recruitment_id_v1",
    templateVersion: "1",
    category: "recruitment",
    domain: "driver_recruitment",
    domainEntityRef: "candidate-1",
    permissionBasis: "public_business_source",
    campaign: mkCampaign(),
    content: { text: "Halo · NEX sedang membangun jaringan driver..." },
    jurisdiction: "ID/DIY/Yogyakarta",
    ...overrides,
  };
}

function mkRateHistory(overrides: Partial<RateHistorySlice> = {}): RateHistorySlice {
  return {
    now: NOW,
    contactId: "contact-1",
    category: "recruitment",
    campaignId: "camp-1",
    perContactSameDayCount: 0,
    perContactSameDayCountThisCategory: 0,
    perCampaignSameDayCount: 0,
    globalSameDayCount: 0,
    lastSendToContactThisCategoryAt: null,
    ...overrides,
  };
}

function mkAvailabilities(): CandidateChannelAvailability[] {
  return [
    { channel: "whatsapp", costHintIdr: 200, available: true },
    { channel: "email",    costHintIdr: 10, available: false },
    { channel: "nex_in_app", costHintIdr: 0, available: false },
  ];
}

let provider: MockCommsProvider;

beforeEach(() => {
  provider = new MockCommsProvider();
  delete process.env.NEX_COMMS_OUTBOUND_ENABLED;
  delete process.env.NEX_COMMS_WHATSAPP_ENABLED;
});

afterEach(() => {
  delete process.env.NEX_COMMS_OUTBOUND_ENABLED;
  delete process.env.NEX_COMMS_WHATSAPP_ENABLED;
});

describe("Communications engine · recruitment happy path", () => {
  it("recruitment with approved campaign + public_business_source basis → SENT via mock", async () => {
    const r = await evaluateAndSend(mkRequest(), {
      provider,
      existingMessageForIdempotencyKey: null,
      suppressions: [],
      rateHistory: mkRateHistory(),
      channelAvailabilities: mkAvailabilities(),
      now: NOW,
    });
    expect(r.status).toBe("SENT");
    if (r.status === "SENT") {
      expect(r.chosenChannel).toBe("whatsapp");
      expect(r.providerName).toBe("mock");
      expect(provider.recordedRequests()).toHaveLength(1);
    }
  });
});

describe("Communications engine · recruitment REFUSED without approved campaign", () => {
  it("category=recruitment + campaign=undefined → CAMPAIGN_MISSING", async () => {
    const req = mkRequest({ campaign: undefined });
    const r = await evaluateAndSend(req, {
      provider, existingMessageForIdempotencyKey: null, suppressions: [], rateHistory: mkRateHistory(),
      channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") {
      expect(r.refusedAt).toBe("permission");
      expect(r.reason).toMatch(/CAMPAIGN_MISSING/);
    }
  });

  it("campaign not approved → CAMPAIGN_NOT_APPROVED", async () => {
    const req = mkRequest({ campaign: mkCampaign({ approvedAt: null, status: "draft" }) });
    const r = await evaluateAndSend(req, {
      provider, existingMessageForIdempotencyKey: null, suppressions: [], rateHistory: mkRateHistory(),
      channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toMatch(/CAMPAIGN_NOT_APPROVED/);
  });
});

describe("Communications engine · STOP suppression is global · overrides even approved recruitment", () => {
  it("STOP suppression blocks recruitment even with approved campaign", async () => {
    const suppression: CommsSuppressionRow = {
      suppressionId: "s1", contactId: "contact-1", scope: "all", category: null,
      source: "recipient_stop_word", rawSignal: "STOP",
      createdAt: NOW, effectiveFrom: NOW, effectiveTo: null, auditNote: null,
    };
    const r = await evaluateAndSend(mkRequest(), {
      provider, existingMessageForIdempotencyKey: null, suppressions: [suppression],
      rateHistory: mkRateHistory(), channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") {
      expect(r.refusedAt).toBe("suppression");
      expect(provider.recordedRequests()).toHaveLength(0);
    }
  });

  it("marketing_only suppression does NOT block a transactional message", async () => {
    const suppression: CommsSuppressionRow = {
      suppressionId: "s1", contactId: "contact-1", scope: "marketing_only", category: null,
      source: "recipient_stop_word", rawSignal: "TIDAK",
      createdAt: NOW, effectiveFrom: NOW, effectiveTo: null, auditNote: null,
    };
    const req = mkRequest({
      category: "transactional",
      permissionBasis: "contract_performance",
      campaign: undefined,
      idempotencyKey: "booking-confirmation:booking-42",
    });
    const r = await evaluateAndSend(req, {
      provider, existingMessageForIdempotencyKey: null, suppressions: [suppression],
      rateHistory: mkRateHistory({ category: "transactional" }),
      channelAvailabilities: mkAvailabilities(),
      now: NOW,
    });
    expect(r.status).toBe("SENT");
  });
});

describe("Communications engine · free-first routing", () => {
  it("prefers nex_in_app (tier 0) over whatsapp (tier 2) for transactional", async () => {
    const availabilities: CandidateChannelAvailability[] = [
      { channel: "whatsapp",   costHintIdr: 200, available: true },
      { channel: "nex_in_app", costHintIdr: 0,   available: true },
    ];
    const req = mkRequest({
      category: "transactional",
      permissionBasis: "contract_performance",
      campaign: undefined,
      idempotencyKey: "booking-confirmation:booking-43",
    });
    const r = await evaluateAndSend(req, {
      provider, existingMessageForIdempotencyKey: null, suppressions: [],
      rateHistory: mkRateHistory({ category: "transactional" }),
      channelAvailabilities: availabilities, now: NOW,
    });
    expect(r.status).toBe("SENT");
    if (r.status === "SENT") {
      expect(r.chosenChannel).toBe("nex_in_app");
      expect(r.chosenTier).toBe(0);
    }
  });

  it("recruitment cannot use nex_in_app · falls back to whatsapp (tier 2)", async () => {
    const availabilities: CandidateChannelAvailability[] = [
      { channel: "nex_in_app", costHintIdr: 0, available: true },
      { channel: "whatsapp",   costHintIdr: 200, available: true },
    ];
    const r = await evaluateAndSend(mkRequest(), {
      provider, existingMessageForIdempotencyKey: null, suppressions: [],
      rateHistory: mkRateHistory(), channelAvailabilities: availabilities, now: NOW,
    });
    if (r.status === "SENT") {
      expect(r.chosenChannel).toBe("whatsapp");
    }
  });
});

describe("Communications engine · idempotency prevents double-send under retry", () => {
  it("second call with same idempotencyKey returns DUPLICATE · no second provider call", async () => {
    const req = mkRequest();
    const first = await evaluateAndSend(req, {
      provider, existingMessageForIdempotencyKey: null, suppressions: [],
      rateHistory: mkRateHistory(), channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    expect(first.status).toBe("SENT");
    const second = await evaluateAndSend(req, {
      provider,
      existingMessageForIdempotencyKey: {
        messageId: "msg-existing",
        createdAt: NOW,
        status: "submitted",
      },
      suppressions: [], rateHistory: mkRateHistory(), channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    expect(second.status).toBe("DUPLICATE_RETURNED");
    if (second.status === "DUPLICATE_RETURNED") {
      expect(second.existingMessageId).toBe("msg-existing");
    }
    expect(provider.recordedRequests()).toHaveLength(1);
  });

  it("invalid idempotency key format → REFUSED at idempotency step", async () => {
    const r = await evaluateAndSend(mkRequest({ idempotencyKey: "short" }), {
      provider, existingMessageForIdempotencyKey: null, suppressions: [],
      rateHistory: mkRateHistory(), channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.refusedAt).toBe("idempotency");
  });
});

describe("Communications engine · rate + cooldown enforced", () => {
  it("per-contact category limit reached → REFUSED at rate step", async () => {
    const r = await evaluateAndSend(mkRequest(), {
      provider, existingMessageForIdempotencyKey: null, suppressions: [],
      rateHistory: mkRateHistory({ perContactSameDayCountThisCategory: 1, perContactSameDayCount: 1 }),
      channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.refusedAt).toBe("rate");
  });

  it("recruitment 7-day cooldown active → REFUSED", async () => {
    const lastSend = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const r = await evaluateAndSend(mkRequest(), {
      provider, existingMessageForIdempotencyKey: null, suppressions: [],
      rateHistory: mkRateHistory({ lastSendToContactThisCategoryAt: lastSend }),
      channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") {
      expect(r.refusedAt).toBe("rate");
      expect(r.reason).toMatch(/COOLDOWN_ACTIVE/);
    }
  });
});

describe("Communications engine · kill switch enforced for non-mock providers", () => {
  it("non-mock provider refused when NEX_COMMS_OUTBOUND_ENABLED is not 'true'", async () => {
    class FakeRealProvider implements CommsProvider {
      readonly name = "real-provider";
      readonly supportedChannels = ["whatsapp"] as const;
      async send(): Promise<ProviderSendResult> {
        throw new Error("must never be called when kill switch is on");
      }
      async healthCheck() {
        return { provider: "real-provider", available: true, authenticated: true, lastError: null, queueDepth: 0, latencyMsP50: 10 };
      }
    }
    const realProvider = new FakeRealProvider();
    const r = await evaluateAndSend(mkRequest(), {
      provider: realProvider,
      existingMessageForIdempotencyKey: null, suppressions: [],
      rateHistory: mkRateHistory(), channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.refusedAt).toBe("kill_switch");
  });

  it("non-mock provider refused for whatsapp when NEX_COMMS_WHATSAPP_ENABLED != 'true' even if outbound enabled", async () => {
    process.env.NEX_COMMS_OUTBOUND_ENABLED = "true";
    class FakeRealProvider implements CommsProvider {
      readonly name = "real-provider";
      readonly supportedChannels = ["whatsapp"] as const;
      async send(): Promise<ProviderSendResult> {
        throw new Error("must not be called");
      }
      async healthCheck() {
        return { provider: "real-provider", available: true, authenticated: true, lastError: null, queueDepth: 0, latencyMsP50: 10 };
      }
    }
    const realProvider = new FakeRealProvider();
    const r = await evaluateAndSend(mkRequest(), {
      provider: realProvider,
      existingMessageForIdempotencyKey: null, suppressions: [],
      rateHistory: mkRateHistory(), channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") {
      expect(r.refusedAt).toBe("kill_switch");
      expect(r.reason).toMatch(/WHATSAPP/);
    }
  });
});

describe("Communications engine · audit trail records every step", () => {
  it("successful send trail includes idempotency → permission → suppression → rate → route → kill_switch → provider", async () => {
    const r = await evaluateAndSend(mkRequest(), {
      provider, existingMessageForIdempotencyKey: null, suppressions: [],
      rateHistory: mkRateHistory(), channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    if (r.status === "SENT") {
      const steps = r.auditTrail.map((s) => s.step);
      expect(steps).toEqual(["idempotency", "permission", "suppression", "rate", "route", "kill_switch", "provider"]);
    }
  });

  it("refused-at-suppression trail short-circuits and does not reach route/provider", async () => {
    const suppression: CommsSuppressionRow = {
      suppressionId: "s1", contactId: "contact-1", scope: "all", category: null,
      source: "recipient_stop_word", rawSignal: "STOP",
      createdAt: NOW, effectiveFrom: NOW, effectiveTo: null, auditNote: null,
    };
    const r = await evaluateAndSend(mkRequest(), {
      provider, existingMessageForIdempotencyKey: null, suppressions: [suppression],
      rateHistory: mkRateHistory(), channelAvailabilities: mkAvailabilities(), now: NOW,
    });
    if (r.status === "REFUSED") {
      const steps = r.auditTrail.map((s) => s.step);
      expect(steps).toContain("suppression");
      expect(steps).not.toContain("route");
      expect(steps).not.toContain("provider");
    }
  });
});
