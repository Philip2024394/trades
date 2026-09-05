// src/lib/nex/brain/capability-display-intelligence.test.ts
//
// Capability & Display Intelligence · unit tests
// Philip 2026-09-06 · AUTHORIZE · ACCOMMODATION PROVENANCE, BOOKING
// SEMANTICS & FOLLOW-UP CONVERSATION FIX

import { describe, it, expect } from "vitest";
import {
  classifyCapabilityDisplayAct,
  decideCapabilityDisplayGate,
  lookupCapability,
  CAPABILITY_REGISTRY,
} from "./capability-display-intelligence";
import type { SessionState } from "./session";

// ─── Session helper ─────────────────────────────────────────────
function sessionWithHotelEntities(names: string[]): SessionState {
  return {
    session_id: "s",
    conversation_id: "c",
    entities: names.map((n, i) => ({
      kind: "business_name",
      canonical: n.toLowerCase(),
      raw: n,
      refId: `place:accommodation:${i}`,
      source: "nex_reply",
      firstSeenAtIso: new Date().toISOString(),
      lastSeenAtIso: new Date().toISOString(),
    })) as unknown as SessionState["entities"],
  } as unknown as SessionState;
}
function emptySession(): SessionState {
  return { session_id: "s", conversation_id: "c", entities: [] } as unknown as SessionState;
}

// ═════════════ Classification ═════════════

describe("classifyCapabilityDisplayAct · CAPABILITY_QUESTION", () => {
  it("catches 'can I book?'", () => {
    const d = classifyCapabilityDisplayAct("can I book?");
    expect(d.act).toBe("CAPABILITY_QUESTION");
    expect(d.capability_kind).toBe("BOOKING");
  });
  it("catches 'could I reserve one?'", () => {
    const d = classifyCapabilityDisplayAct("could I reserve one?");
    expect(d.act).toBe("CAPABILITY_QUESTION");
    expect(d.capability_kind).toBe("BOOKING");
  });
  it("catches 'how do I book?'", () => {
    const d = classifyCapabilityDisplayAct("how do I book?");
    expect(d.act).toBe("CAPABILITY_QUESTION");
    expect(d.capability_kind).toBe("BOOKING");
  });
  it("catches adjectival 'is it bookable?'", () => {
    const d = classifyCapabilityDisplayAct("is it bookable?");
    expect(d.act).toBe("CAPABILITY_QUESTION");
    expect(d.capability_kind).toBe("BOOKING");
  });
  it("catches Indonesian 'bisakah saya pesan?'", () => {
    const d = classifyCapabilityDisplayAct("bisakah saya pesan?");
    expect(d.act).toBe("CAPABILITY_QUESTION");
    expect(d.capability_kind).toBe("BOOKING");
  });
  it("catches 'can I contact them?'", () => {
    const d = classifyCapabilityDisplayAct("can I contact them?");
    expect(d.act).toBe("CAPABILITY_QUESTION");
    expect(d.capability_kind).toBe("CONTACT");
  });
});

describe("classifyCapabilityDisplayAct · CAPABILITY_CLARIFICATION", () => {
  it("catches 'what do you mean I can't book?'", () => {
    const d = classifyCapabilityDisplayAct("what do you mean I can't book?");
    expect(d.act).toBe("CAPABILITY_CLARIFICATION");
    expect(d.capability_kind).toBe("BOOKING");
  });
  it("catches loose 'what you mean i cant book'", () => {
    const d = classifyCapabilityDisplayAct("what you mean i cant book");
    expect(d.act).toBe("CAPABILITY_CLARIFICATION");
    expect(d.capability_kind).toBe("BOOKING");
  });
  it("catches 'why can't I book?'", () => {
    const d = classifyCapabilityDisplayAct("why cant I book?");
    expect(d.act).toBe("CAPABILITY_CLARIFICATION");
    expect(d.capability_kind).toBe("BOOKING");
  });
  it("catches Indonesian 'apa maksudnya tidak bisa pesan?'", () => {
    const d = classifyCapabilityDisplayAct("apa maksudnya tidak bisa pesan?");
    expect(d.act).toBe("CAPABILITY_CLARIFICATION");
  });
});

describe("classifyCapabilityDisplayAct · RESULT_DISPLAY_REQUEST", () => {
  it("catches 'show me them'", () => {
    const d = classifyCapabilityDisplayAct("show me them");
    expect(d.act).toBe("RESULT_DISPLAY_REQUEST");
  });
  it("catches 'ok show me the hotels'", () => {
    const d = classifyCapabilityDisplayAct("ok show me the hotels");
    expect(d.act).toBe("RESULT_DISPLAY_REQUEST");
  });
  it("catches 'ok so lets see them'", () => {
    const d = classifyCapabilityDisplayAct("ok so lets see them");
    expect(d.act).toBe("RESULT_DISPLAY_REQUEST");
  });
  it("catches 'let's see them'", () => {
    const d = classifyCapabilityDisplayAct("let's see them");
    expect(d.act).toBe("RESULT_DISPLAY_REQUEST");
  });
  it("catches 'give me the list'", () => {
    const d = classifyCapabilityDisplayAct("give me the list");
    expect(d.act).toBe("RESULT_DISPLAY_REQUEST");
  });
  it("catches Indonesian 'tunjukkan hotelnya'", () => {
    const d = classifyCapabilityDisplayAct("tunjukkan hotelnya");
    expect(d.act).toBe("RESULT_DISPLAY_REQUEST");
  });
});

describe("classifyCapabilityDisplayAct · NEGATIVE cases", () => {
  it("does NOT match 'find me hotels'", () => {
    const d = classifyCapabilityDisplayAct("find me hotels");
    expect(d.act).toBe("NONE");
  });
  it("does NOT match 'where did you find them?'", () => {
    const d = classifyCapabilityDisplayAct("where did you find them?");
    expect(d.act).toBe("NONE");
  });
  it("does NOT match plain 'what do you mean?'", () => {
    const d = classifyCapabilityDisplayAct("what do you mean?");
    expect(d.act).toBe("NONE");
  });
  it("does NOT match 'ok'", () => {
    const d = classifyCapabilityDisplayAct("ok");
    expect(d.act).toBe("NONE");
  });
  it("does NOT match 'yes'", () => {
    const d = classifyCapabilityDisplayAct("yes");
    expect(d.act).toBe("NONE");
  });
});

// ═════════════ Registry ═════════════

describe("CAPABILITY_REGISTRY", () => {
  it("has accommodation.BOOKING = UNKNOWN by default", () => {
    expect(lookupCapability("accommodation", "BOOKING")).toBe("UNKNOWN");
  });
  it("has commerce.PURCHASE = UNKNOWN by default", () => {
    expect(lookupCapability("commerce", "PURCHASE")).toBe("UNKNOWN");
  });
  it("returns UNAVAILABLE when a capability is not applicable to the vertical", () => {
    expect(lookupCapability("commerce", "BOOKING")).toBe("UNAVAILABLE");
  });
  it("returns UNKNOWN for unknown verticals", () => {
    expect(lookupCapability("nonexistent", "BOOKING")).toBe("UNKNOWN");
  });
});

// ═════════════ Gate decisions ═════════════

describe("decideCapabilityDisplayGate · RESULT_DISPLAY_REQUEST", () => {
  it("re-emits result set when entities present", () => {
    const r = decideCapabilityDisplayGate({
      userMessage: "ok so lets see them",
      session: sessionWithHotelEntities(["Griya Sentana", "Hotel Malioboro", "1O1 Yogyakarta"]),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reply).toContain("Griya Sentana");
      expect(r.reply).toContain("hotels");
      expect(r.display_entity_count).toBe(3);
      expect(r.inferred_vertical).toBe("accommodation");
    }
  });
  it("honest no-result reply when session is empty", () => {
    const r = decideCapabilityDisplayGate({
      userMessage: "show me them",
      session: emptySession(),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reply.toLowerCase()).toMatch(/haven't shown|no results/i);
      expect(r.display_entity_count).toBe(0);
    }
  });
});

describe("decideCapabilityDisplayGate · CAPABILITY_QUESTION", () => {
  it("honest UNKNOWN answer for booking on accommodation", () => {
    const r = decideCapabilityDisplayGate({
      userMessage: "can I book?",
      session: sessionWithHotelEntities(["Hotel A"]),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.capability_state).toBe("UNKNOWN");
      expect(r.reply).toMatch(/don't have verified/i);
      expect(r.reply.toLowerCase()).not.toContain("live booking");
    }
  });
});

describe("decideCapabilityDisplayGate · CAPABILITY_CLARIFICATION", () => {
  it("distinguishes source from capability", () => {
    const r = decideCapabilityDisplayGate({
      userMessage: "what you mean i cant book",
      session: sessionWithHotelEntities(["Hotel A"]),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reply).toMatch(/don't mean the listings themselves/i);
      expect(r.reply.toLowerCase()).not.toContain("openstreetmap");
      expect(r.reply.toLowerCase()).not.toContain("nex.accommodation_business");
    }
  });
  it("Indonesian variant", () => {
    const r = decideCapabilityDisplayGate({
      userMessage: "apa maksudnya tidak bisa pesan?",
      session: sessionWithHotelEntities(["Hotel A"]),
      activeLanguage: "ID",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) expect(r.reply).toMatch(/tidak.*bisa dipesan|akses.*terverifikasi/i);
  });
});

describe("decideCapabilityDisplayGate · pass-through", () => {
  it("does NOT gate 'find me hotels'", () => {
    const r = decideCapabilityDisplayGate({
      userMessage: "find me hotels",
      session: emptySession(),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(false);
  });
  it("does NOT gate provenance question", () => {
    const r = decideCapabilityDisplayGate({
      userMessage: "where did you find them?",
      session: sessionWithHotelEntities(["Hotel A"]),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(false);
  });
});
