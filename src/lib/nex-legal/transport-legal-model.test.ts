// src/lib/nex-legal/transport-legal-model.test.ts

import { describe, it, expect } from "vitest";
import {
  checkLegalGate,
  checkLegalGateForArrangement,
  type TransportLegalModelRow,
} from "./transport-legal-model";

function row(overrides: Partial<TransportLegalModelRow> = {}): TransportLegalModelRow {
  return {
    legalModelId: "lm-1",
    jurisdiction: "ID/DIY/Yogyakarta",
    effectiveFrom: new Date("2026-01-01T00:00:00Z"),
    effectiveTo: null,
    nexRole: "intermediary",
    driverRole: "independent driver operator",
    operatorLicenceRef: "op-1",
    insuranceRequirements: {},
    applicableRegulations: ["PM 118/2018", "PM 17/2019"],
    documentReference: "doc://legal/2026-08-approval-01",
    status: "approved",
    approvedBy: "legal.head",
    approvedAt: new Date("2026-08-01T00:00:00Z"),
    notes: null,
    ...overrides,
  };
}

const NOW = new Date("2026-08-23T00:00:00Z");

describe("Legal gate · missing row for jurisdiction → REFUSED", () => {
  it("no rows → NO_ROW_FOR_JURISDICTION", () => {
    const r = checkLegalGate("ID/DIY/Yogyakarta", NOW, []);
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("NO_ROW_FOR_JURISDICTION");
  });

  it("row exists but for different jurisdiction → NO_ROW_FOR_JURISDICTION", () => {
    const r = checkLegalGate("ID/DIY/Yogyakarta", NOW, [row({ jurisdiction: "ID/Central-Java/Magelang" })]);
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("NO_ROW_FOR_JURISDICTION");
  });
});

describe("Legal gate · status must be 'approved'", () => {
  it.each(["researching", "pending_approval", "suspended", "rejected"] as const)(
    "status=%s → STATUS_NOT_APPROVED",
    (status) => {
      const r = checkLegalGate("ID/DIY/Yogyakarta", NOW, [row({ status })]);
      expect(r.status).toBe("REFUSED");
      if (r.status === "REFUSED") {
        expect(r.reason).toBe("STATUS_NOT_APPROVED");
        expect(r.candidateStatus).toBe(status);
      }
    },
  );
});

describe("Legal gate · effective window must cover now", () => {
  it("effective_from in the future → NOT_YET_EFFECTIVE", () => {
    const r = checkLegalGate("ID/DIY/Yogyakarta", NOW, [
      row({ effectiveFrom: new Date("2027-01-01T00:00:00Z") }),
    ]);
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("NOT_YET_EFFECTIVE");
  });

  it("effective_to in the past → EXPIRED", () => {
    const r = checkLegalGate("ID/DIY/Yogyakarta", NOW, [
      row({ effectiveTo: new Date("2026-08-01T00:00:00Z") }),
    ]);
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("EXPIRED");
  });
});

describe("Legal gate · undetermined nex_role → REFUSED even when approved", () => {
  it("nex_role='undetermined' + status='approved' → NEX_ROLE_UNDETERMINED", () => {
    const r = checkLegalGate("ID/DIY/Yogyakarta", NOW, [row({ nexRole: "undetermined" })]);
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("NEX_ROLE_UNDETERMINED");
  });
});

describe("Legal gate · approval metadata required (attributable approval)", () => {
  it("missing approved_by → MISSING_APPROVAL_METADATA", () => {
    const r = checkLegalGate("ID/DIY/Yogyakarta", NOW, [row({ approvedBy: null })]);
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("MISSING_APPROVAL_METADATA");
  });

  it("missing approved_at → MISSING_APPROVAL_METADATA", () => {
    const r = checkLegalGate("ID/DIY/Yogyakarta", NOW, [row({ approvedAt: null })]);
    expect(r.status).toBe("REFUSED");
    if (r.status === "REFUSED") expect(r.reason).toBe("MISSING_APPROVAL_METADATA");
  });
});

describe("Legal gate · fully approved returns APPROVED with all metadata", () => {
  it("approved · effective · nex_role determinate · metadata present → APPROVED", () => {
    const r = checkLegalGate("ID/DIY/Yogyakarta", NOW, [row()]);
    expect(r.status).toBe("APPROVED");
    if (r.status === "APPROVED") {
      expect(r.legalModelId).toBe("lm-1");
      expect(r.nexRole).toBe("intermediary");
      expect(r.applicableRegulations).toEqual(["PM 118/2018", "PM 17/2019"]);
      expect(r.approvedBy).toBe("legal.head");
    }
  });
});

describe("Legal gate · arrangement-scoped check", () => {
  it("dispatch_authorised triggers the full gate (refused if no approval)", () => {
    const r = checkLegalGateForArrangement("dispatch_authorised", "ID/DIY/Yogyakarta", NOW, []);
    expect(r.status).toBe("REFUSED");
  });

  it("direct_contact does not require the Stage-B gate → NOT_APPLICABLE", () => {
    const r = checkLegalGateForArrangement("direct_contact", "ID/DIY/Yogyakarta", NOW, []);
    expect(r.status).toBe("NOT_APPLICABLE");
  });

  it("self_arranged does not require the Stage-B gate → NOT_APPLICABLE", () => {
    const r = checkLegalGateForArrangement("self_arranged", "ID/DIY/Yogyakarta", NOW, []);
    expect(r.status).toBe("NOT_APPLICABLE");
  });
});
