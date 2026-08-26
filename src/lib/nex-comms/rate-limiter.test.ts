// src/lib/nex-comms/rate-limiter.test.ts

import { describe, it, expect } from "vitest";
import { evaluateRate, DEFAULT_LIMITS } from "./rate-limiter";

const NOW = new Date("2026-08-23T14:00:00Z");

describe("Rate limiter · per-contact category limit", () => {
  it("recruitment 1/day limit reached → REFUSED", () => {
    const r = evaluateRate({
      now: NOW, contactId: "c", category: "recruitment",
      perContactSameDayCount: 1, perContactSameDayCountThisCategory: 1,
      perCampaignSameDayCount: 5, globalSameDayCount: 100,
      lastSendToContactThisCategoryAt: null,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("PER_CONTACT_CATEGORY_LIMIT");
  });

  it("first recruitment of the day → ALLOWED", () => {
    const r = evaluateRate({
      now: NOW, contactId: "c", category: "recruitment",
      perContactSameDayCount: 0, perContactSameDayCountThisCategory: 0,
      perCampaignSameDayCount: 0, globalSameDayCount: 0,
      lastSendToContactThisCategoryAt: null,
    });
    expect(r.status).toBe("ALLOWED");
  });
});

describe("Rate limiter · per-contact total limit", () => {
  it("perContactSameDayCount at total limit → REFUSED", () => {
    const r = evaluateRate({
      now: NOW, contactId: "c", category: "transactional",
      perContactSameDayCount: DEFAULT_LIMITS.perContactPerDayTotal,
      perContactSameDayCountThisCategory: 5,
      perCampaignSameDayCount: 0, globalSameDayCount: 0,
      lastSendToContactThisCategoryAt: null,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("PER_CONTACT_TOTAL_LIMIT");
  });
});

describe("Rate limiter · per-campaign + global limits", () => {
  it("per-campaign limit reached → REFUSED", () => {
    const r = evaluateRate({
      now: NOW, contactId: "c", category: "recruitment",
      perContactSameDayCount: 0, perContactSameDayCountThisCategory: 0,
      campaignId: "camp", perCampaignSameDayCount: 500, globalSameDayCount: 100,
      lastSendToContactThisCategoryAt: null,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("PER_CAMPAIGN_LIMIT");
  });

  it("global limit reached → REFUSED", () => {
    const r = evaluateRate({
      now: NOW, contactId: "c", category: "transactional",
      perContactSameDayCount: 0, perContactSameDayCountThisCategory: 0,
      perCampaignSameDayCount: 0, globalSameDayCount: 10000,
      lastSendToContactThisCategoryAt: null,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("GLOBAL_LIMIT");
  });
});

describe("Rate limiter · cooldown", () => {
  it("recruitment cooldown 7 days · sent 2 days ago → REFUSED", () => {
    const r = evaluateRate({
      now: NOW, contactId: "c", category: "recruitment",
      perContactSameDayCount: 0, perContactSameDayCountThisCategory: 0,
      perCampaignSameDayCount: 0, globalSameDayCount: 0,
      lastSendToContactThisCategoryAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000),
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("COOLDOWN_ACTIVE");
  });

  it("recruitment cooldown 7 days · sent 8 days ago → ALLOWED", () => {
    const r = evaluateRate({
      now: NOW, contactId: "c", category: "recruitment",
      perContactSameDayCount: 0, perContactSameDayCountThisCategory: 0,
      perCampaignSameDayCount: 0, globalSameDayCount: 0,
      lastSendToContactThisCategoryAt: new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000),
    });
    expect(r.status).toBe("ALLOWED");
  });
});
