// src/lib/nex/connection-audit/connection-audit.test.ts

import { describe, it, expect } from "vitest";
import { auditAllCaps, summarizeAudit } from "./audit";

describe("auditAllCaps", () => {
  it("returns one row per registered CAP", () => {
    const rows = auditAllCaps();
    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((r) => r.capabilityId);
    expect(ids).toContain("CAP-091");
    expect(ids).toContain("CAP-092");
    expect(ids).toContain("CAP-093");
    expect(ids).toContain("CAP-094");
    expect(ids).toContain("CAP-095");
    expect(ids).toContain("CAP-096");
    expect(ids).toContain("CAP-097");
  });

  it("each row has exactly 22 slots labelled", () => {
    const rows = auditAllCaps();
    for (const r of rows) {
      const count = Object.keys(r.slots).length;
      expect(count).toBe(22);
    }
  });

  it("count consistency · connected + not_connected + not_applicable = 22", () => {
    const rows = auditAllCaps();
    for (const r of rows) {
      expect(r.connected_count + r.not_connected_count + r.not_applicable_count).toBe(22);
    }
  });

  it("CAP-091 Workstation has security_agent connected", () => {
    const rows = auditAllCaps();
    const cap091 = rows.find((r) => r.capabilityId === "CAP-091")!;
    expect(cap091.slots.security_agent).toBe("connected");
    expect(cap091.slots.preview).toBe("connected");
    expect(cap091.slots.versioning).toBe("connected");
  });

  it("CAP-096 Email Marketing HQ marks storage + apis + events connected", () => {
    const rows = auditAllCaps();
    const cap096 = rows.find((r) => r.capabilityId === "CAP-096")!;
    expect(cap096.slots.apis).toBe("connected");
    expect(cap096.slots.storage).toBe("connected");
    expect(cap096.slots.events).toBe("connected");
  });

  it("slots not in applicable matrix are marked not_applicable", () => {
    const rows = auditAllCaps();
    for (const r of rows) {
      // github isn't wired for any of these caps yet
      expect(r.slots.github).toBe("not_applicable");
    }
  });
});

describe("summarizeAudit", () => {
  it("computes total + fully_connected + has_gaps", () => {
    const rows = auditAllCaps();
    const s = summarizeAudit(rows);
    expect(s.total).toBe(rows.length);
    expect(s.fully_connected + s.has_gaps).toBe(rows.length);
  });
});
