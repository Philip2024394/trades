// src/lib/nex/brain/interest/interest-gate.test.ts

import { describe, expect, it } from "vitest";
import { decideInterestGate } from "./interest-gate";
import type { SessionState } from "../session";
import type { WorldRecord } from "../world-adapters/types";

function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    conversationId: "cid",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    turnCount: 3,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeRecord(overrides: Record<string, unknown> = {}): WorldRecord {
  return {
    id: "#AC-2026-0000A",
    name: "Gaotama Hotel",
    vertical: "accommodation",
    market: "ID",
    category: "hotel",
    latitude: 0, longitude: 0,
    claimStatus: "listed",
    verified: false,
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-09-01T00:00:00Z" } as any,
  } as WorldRecord;
}

// ─── No interest signal → never gates ───────────────────────────

describe("interest-gate · no signal", () => {
  it("'find me hotels' → shouldGate:false", async () => {
    const d = await decideInterestGate({
      message: "find me hotels",
      session: makeSession(),
      activeLanguage: "EN",
      fetchRecord: async () => null,
    });
    expect(d.shouldGate).toBe(false);
  });
});

// ─── Negation · G12 preserved ──────────────────────────────────

describe("interest-gate · negation (G12 preserved)", () => {
  it("'I'm not interested' → NEGATED · no send activation", async () => {
    const d = await decideInterestGate({
      message: "I'm not interested",
      session: makeSession(),
      activeLanguage: "EN",
      fetchRecord: async () => null,
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) expect(d.kind).toBe("INTEREST_NEGATED");
  });
  it("Indonesian 'saya tidak tertarik' → NEGATED", async () => {
    const d = await decideInterestGate({
      message: "saya tidak tertarik",
      session: makeSession(),
      activeLanguage: "ID",
      fetchRecord: async () => null,
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) expect(d.kind).toBe("INTEREST_NEGATED");
  });
});

// ─── No entity context ─────────────────────────────────────────

describe("interest-gate · no entity context", () => {
  it("fresh session · 'I'm interested' → INTEREST_NO_ENTITY_CONTEXT", async () => {
    const d = await decideInterestGate({
      message: "I'm interested",
      session: makeSession(),
      activeLanguage: "EN",
      fetchRecord: async () => null,
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.kind).toBe("INTEREST_NO_ENTITY_CONTEXT");
      expect(d.reply.toLowerCase()).toMatch(/no listing here yet|nothing.*to reach out about/);
    }
  });
});

// ─── Ambiguous entity ─────────────────────────────────────────

describe("interest-gate · ambiguous entity → asks", () => {
  it("2 candidates in memo · no viewed entity → AMBIGUOUS", async () => {
    const d = await decideInterestGate({
      message: "I'm interested",
      session: makeSession({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        entityCardMemo: [
          { position: 1, ref_id: "place:accommodation:#A", name: "Gaotama Hotel", vertical: "accommodation", highlights: [], unverified_highlights: [], attribute_states: {}, attribute_evidence_tiers: {} },
          { position: 2, ref_id: "place:accommodation:#B", name: "Selaras Inn",   vertical: "accommodation", highlights: [], unverified_highlights: [], attribute_states: {}, attribute_evidence_tiers: {} },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
      }),
      activeLanguage: "EN",
      fetchRecord: async () => null,
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.kind).toBe("INTEREST_AMBIGUOUS_ENTITY");
      expect(d.reply).toContain("Gaotama Hotel");
      expect(d.reply).toContain("Selaras Inn");
    }
  });
});

// ─── Honest no-contact (viewed entity) ────────────────────────

describe("interest-gate · honest no verified contact", () => {
  it("viewed entity exists but no verified contact → HONEST_NO_CONTACT", async () => {
    const d = await decideInterestGate({
      message: "I'm interested",
      session: makeSession({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewedEntity: {
          ref_id: "place:accommodation:#A",
          vertical: "accommodation",
          name: "Gaotama Hotel",
          viewedInTurn: 3,
          viewedAtIso: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      }),
      activeLanguage: "EN",
      fetchRecord: async () => makeRecord({}), // no phone/wa/website
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.kind).toBe("INTEREST_HONEST_NO_CONTACT");
      expect(d.reply).toContain("Gaotama Hotel");
      expect(d.reply.toLowerCase()).toMatch(/no verified contact|won't invent/);
    }
  });
});

// ─── Positive activation with verified contact ─────────────────

describe("interest-gate · positive activation (verified contact)", () => {
  it("claimed + verified + phone → INTEREST_ACTIVATED_VERIFIED · open_url present", async () => {
    const d = await decideInterestGate({
      message: "I'm interested",
      session: makeSession({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewedEntity: {
          ref_id: "place:accommodation:#A",
          vertical: "accommodation",
          name: "Gaotama Hotel",
          viewedInTurn: 3,
          viewedAtIso: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      }),
      activeLanguage: "EN",
      fetchRecord: async () => makeRecord({
        claimStatus: "claimed",
        verified: true,
        phone: "+62 812 3456 7890",
      }),
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.kind).toBe("INTEREST_ACTIVATED_VERIFIED");
      expect(d.entity_name).toBe("Gaotama Hotel");
      expect(d.open_url).toContain("/nex-app/entity/");
      expect(d.contactability?.state).toBe("VERIFIED_CONTACT");
      expect(d.reply.toLowerCase()).toMatch(/draft message|review it before you send/);
    }
  });
  it("Indonesian positive activation", async () => {
    const d = await decideInterestGate({
      message: "saya tertarik",
      session: makeSession({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewedEntity: {
          ref_id: "place:accommodation:#A",
          vertical: "accommodation",
          name: "Warung Bu Ageng",
          viewedInTurn: 3,
          viewedAtIso: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      }),
      activeLanguage: "ID",
      fetchRecord: async () => makeRecord({
        claimStatus: "claimed",
        verified: true,
        whatsapp: "+62 813 0000 0000",
        vertical: "food" as never,
      }),
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.kind).toBe("INTEREST_ACTIVATED_VERIFIED");
      expect(d.reply).toContain("Warung Bu Ageng");
      expect(d.reply.toLowerCase()).toMatch(/draf pesan|tinjau/);
    }
  });
});

// ─── Immutable rule §31 — no synthetic contact activates send ─

describe("interest-gate · §31 no-fabrication guarantee", () => {
  it("all UNKNOWN channels · never activates send", async () => {
    const d = await decideInterestGate({
      message: "I'm interested",
      session: makeSession({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewedEntity: {
          ref_id: "place:accommodation:#A",
          vertical: "accommodation",
          name: "Placeholder Hotel",
          viewedInTurn: 3,
          viewedAtIso: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      }),
      activeLanguage: "EN",
      fetchRecord: async () => makeRecord({}),
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.kind).toBe("INTEREST_HONEST_NO_CONTACT");
      expect(d.contactability?.interest_send_enabled).toBe(false);
    }
  });
  it("phone present but NOT claimed · never activates send", async () => {
    const d = await decideInterestGate({
      message: "I'm interested",
      session: makeSession({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewedEntity: {
          ref_id: "place:accommodation:#A",
          vertical: "accommodation",
          name: "Some Hotel",
          viewedInTurn: 3,
          viewedAtIso: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      }),
      activeLanguage: "EN",
      // Phone present but claimStatus="listed" · owner not verified
      fetchRecord: async () => makeRecord({ phone: "+62 812 3456 7890" }),
    });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.kind).toBe("INTEREST_HONEST_NO_CONTACT");
      expect(d.contactability?.state).toBe("NO_VERIFIED_CONTACT");
    }
  });
});
