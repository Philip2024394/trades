// src/lib/nex-comms/suppression.test.ts
//
// Bright-line tests: STOP is global · TIDAK is marketing-only · JANGAN HUBUNGI
// is recruitment · no domain override possible.

import { describe, it, expect } from "vitest";
import {
  classifyStopSignal,
  evaluateSuppression,
  suppressionFromStopSignal,
} from "./suppression";
import type { CommsSuppressionRow } from "./types";

const NOW = new Date("2026-08-23T14:20:00Z");
const CONTACT = "contact-1";

function row(overrides: Partial<CommsSuppressionRow>): CommsSuppressionRow {
  return {
    suppressionId: "s1",
    contactId: CONTACT,
    scope: "all",
    category: null,
    source: "recipient_stop_word",
    rawSignal: "STOP",
    createdAt: new Date("2026-08-01T00:00:00Z"),
    effectiveFrom: new Date("2026-08-01T00:00:00Z"),
    effectiveTo: null,
    auditNote: null,
    ...overrides,
  };
}

describe("Suppression · STOP is global (all categories)", () => {
  it("STOP → scope='all' · matches recruitment", () => {
    const r = evaluateSuppression({
      contactId: CONTACT, category: "recruitment", now: NOW,
      suppressions: [row({ scope: "all" })],
    });
    expect(r.suppressed).toBe(true);
    expect(r.matchedScope).toBe("all");
  });

  it("STOP → matches transactional", () => {
    const r = evaluateSuppression({
      contactId: CONTACT, category: "transactional", now: NOW,
      suppressions: [row({ scope: "all" })],
    });
    expect(r.suppressed).toBe(true);
  });

  it("STOP → matches marketing", () => {
    const r = evaluateSuppression({
      contactId: CONTACT, category: "marketing", now: NOW,
      suppressions: [row({ scope: "all" })],
    });
    expect(r.suppressed).toBe(true);
  });
});

describe("Suppression · TIDAK / STOP MARKETING → marketing_only", () => {
  it("marketing_only matches marketing", () => {
    const r = evaluateSuppression({
      contactId: CONTACT, category: "marketing", now: NOW,
      suppressions: [row({ scope: "marketing_only" })],
    });
    expect(r.suppressed).toBe(true);
  });

  it("marketing_only does NOT match transactional", () => {
    const r = evaluateSuppression({
      contactId: CONTACT, category: "transactional", now: NOW,
      suppressions: [row({ scope: "marketing_only" })],
    });
    expect(r.suppressed).toBe(false);
  });

  it("marketing_only does NOT match recruitment", () => {
    const r = evaluateSuppression({
      contactId: CONTACT, category: "recruitment", now: NOW,
      suppressions: [row({ scope: "marketing_only" })],
    });
    expect(r.suppressed).toBe(false);
  });
});

describe("Suppression · recruitment_only", () => {
  it("recruitment_only matches recruitment · not marketing", () => {
    expect(
      evaluateSuppression({
        contactId: CONTACT, category: "recruitment", now: NOW,
        suppressions: [row({ scope: "recruitment_only" })],
      }).suppressed,
    ).toBe(true);
    expect(
      evaluateSuppression({
        contactId: CONTACT, category: "marketing", now: NOW,
        suppressions: [row({ scope: "recruitment_only" })],
      }).suppressed,
    ).toBe(false);
  });
});

describe("Suppression · category_specific", () => {
  it("matches only its declared category", () => {
    const s = row({ scope: "category_specific", category: "booking" });
    expect(evaluateSuppression({ contactId: CONTACT, category: "booking", now: NOW, suppressions: [s] }).suppressed).toBe(true);
    expect(evaluateSuppression({ contactId: CONTACT, category: "transactional", now: NOW, suppressions: [s] }).suppressed).toBe(false);
  });
});

describe("Suppression · effective window respected", () => {
  it("not-yet-effective suppression does not apply", () => {
    const s = row({ effectiveFrom: new Date("2027-01-01T00:00:00Z") });
    const r = evaluateSuppression({ contactId: CONTACT, category: "marketing", now: NOW, suppressions: [s] });
    expect(r.suppressed).toBe(false);
  });

  it("expired suppression does not apply", () => {
    const s = row({ effectiveTo: new Date("2026-07-01T00:00:00Z") });
    const r = evaluateSuppression({ contactId: CONTACT, category: "marketing", now: NOW, suppressions: [s] });
    expect(r.suppressed).toBe(false);
  });
});

describe("Suppression · defensive contact filtering", () => {
  it("suppression belonging to another contact is ignored", () => {
    const s = row({ contactId: "other-contact" });
    const r = evaluateSuppression({ contactId: CONTACT, category: "marketing", now: NOW, suppressions: [s] });
    expect(r.suppressed).toBe(false);
  });
});

describe("Stop signal classifier · Indonesian + English variants", () => {
  it("bare STOP → scope=all", () => {
    const c = classifyStopSignal("STOP");
    expect(c.detected).toBe(true);
    expect(c.scope).toBe("all");
    expect(c.matchedWord).toBe("STOP");
  });

  it("bare TIDAK → scope=marketing_only", () => {
    const c = classifyStopSignal("Tidak");
    expect(c.scope).toBe("marketing_only");
  });

  it("BERHENTI → scope=all", () => {
    const c = classifyStopSignal("berhenti");
    expect(c.scope).toBe("all");
  });

  it("JANGAN HUBUNGI → scope=recruitment_only", () => {
    const c = classifyStopSignal("jangan hubungi saya");
    expect(c.scope).toBe("recruitment_only");
  });

  it("STOP RECRUITMENT → scope=recruitment_only", () => {
    const c = classifyStopSignal("Stop recruitment please");
    expect(c.scope).toBe("recruitment_only");
  });

  it("non-stop text → not detected", () => {
    expect(classifyStopSignal("Hello, tell me more about the driver programme").detected).toBe(false);
  });

  it("empty body → not detected", () => {
    expect(classifyStopSignal("").detected).toBe(false);
    expect(classifyStopSignal("   ").detected).toBe(false);
  });
});

describe("suppressionFromStopSignal · composes an audit row", () => {
  it("returns null for non-stop input", () => {
    expect(suppressionFromStopSignal(CONTACT, classifyStopSignal("hi"))).toBeNull();
  });

  it("STOP → suppression row scope=all · source=recipient_stop_word", () => {
    const row = suppressionFromStopSignal(CONTACT, classifyStopSignal("STOP"), NOW);
    expect(row).not.toBeNull();
    if (row) {
      expect(row.scope).toBe("all");
      expect(row.source).toBe("recipient_stop_word");
      expect(row.rawSignal).toBe("STOP");
      expect(row.effectiveTo).toBeNull();
    }
  });
});
