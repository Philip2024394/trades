// src/lib/nex-comms/permission.test.ts

import { describe, it, expect } from "vitest";
import { checkPermission } from "./permission";
import type { CommsCampaign } from "./types";

const APPROVED_CAMPAIGN: CommsCampaign = {
  campaignId: "c1",
  campaignKey: "test-recruitment",
  domain: "driver_recruitment",
  category: "recruitment",
  jurisdiction: "ID/DIY/Yogyakarta",
  dailyBudgetIdr: 100000,
  monthlyBudgetIdr: 1000000,
  maxCostPerContactIdr: 500,
  dailyMessageLimit: 100,
  status: "active",
  createdBy: "admin.1",
  approvedBy: "legal.head",
  approvedAt: new Date("2026-08-01T00:00:00Z"),
};

describe("Permission · basis 'none' always refused", () => {
  it("refuses with BASIS_NONE", () => {
    const r = checkPermission({ category: "transactional", basis: "none" });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("BASIS_NONE");
  });
});

describe("Permission · marketing requires explicit_opt_in", () => {
  it("marketing + public_business_source → REFUSED (contacts are not consent)", () => {
    const r = checkPermission({ category: "marketing", basis: "public_business_source" });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("BASIS_INCOMPATIBLE_WITH_CATEGORY");
  });

  it("marketing + contract_performance → REFUSED (contract is not consent for marketing)", () => {
    const r = checkPermission({ category: "marketing", basis: "contract_performance" });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("BASIS_INCOMPATIBLE_WITH_CATEGORY");
  });

  it("marketing + explicit_opt_in + approved campaign → ALLOWED", () => {
    const r = checkPermission({
      category: "marketing", basis: "explicit_opt_in",
      campaign: { ...APPROVED_CAMPAIGN, category: "marketing" },
    });
    expect(r.status).toBe("ALLOWED");
  });
});

describe("Permission · recruitment requires public_business_source or explicit_opt_in + approved campaign", () => {
  it("recruitment + public_business_source without campaign → REFUSED", () => {
    const r = checkPermission({ category: "recruitment", basis: "public_business_source" });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("CAMPAIGN_MISSING_FOR_RECRUITMENT_OR_MARKETING");
  });

  it("recruitment + campaign not approved → REFUSED CAMPAIGN_NOT_APPROVED", () => {
    const r = checkPermission({
      category: "recruitment", basis: "public_business_source",
      campaign: { ...APPROVED_CAMPAIGN, status: "draft", approvedAt: null },
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("CAMPAIGN_NOT_APPROVED");
  });

  it("recruitment + public_business_source + approved campaign → ALLOWED", () => {
    const r = checkPermission({
      category: "recruitment", basis: "public_business_source",
      campaign: APPROVED_CAMPAIGN,
    });
    expect(r.status).toBe("ALLOWED");
  });

  it("recruitment + contract_performance → REFUSED (wrong basis)", () => {
    const r = checkPermission({
      category: "recruitment", basis: "contract_performance",
      campaign: APPROVED_CAMPAIGN,
    });
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("BASIS_INCOMPATIBLE_WITH_CATEGORY");
  });
});

describe("Permission · transactional / booking / transport permit contract_performance without campaign", () => {
  it("transactional + contract_performance → ALLOWED", () => {
    const r = checkPermission({ category: "transactional", basis: "contract_performance" });
    expect(r.status).toBe("ALLOWED");
  });

  it("booking + transactional_response → ALLOWED", () => {
    const r = checkPermission({ category: "booking", basis: "transactional_response" });
    expect(r.status).toBe("ALLOWED");
  });

  it("transport + contract_performance → ALLOWED", () => {
    const r = checkPermission({ category: "transport", basis: "contract_performance" });
    expect(r.status).toBe("ALLOWED");
  });
});

describe("Permission · business_enquiry accepts public_business_source without campaign", () => {
  it("business_enquiry + public_business_source → ALLOWED", () => {
    const r = checkPermission({ category: "business_enquiry", basis: "public_business_source" });
    expect(r.status).toBe("ALLOWED");
  });
});
