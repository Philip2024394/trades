// src/lib/nex/brain/entity-attribute-query.test.ts
// Universal Entity Attribute Question Gate · unit tests
// Philip 2026-09-06 · AUTHORIZE · UNIVERSAL ENTITY INTELLIGENCE

import { describe, it, expect } from "vitest";
import {
  classifyAttributeQuery,
  decideAttributeQueryGate,
} from "./entity-attribute-query";
import type { SessionState } from "./session";
import type { EntityCardMemo } from "./entity-result-cards";

function sessionWith(memo: EntityCardMemo[]): SessionState {
  return {
    session_id: "s", conversation_id: "c",
    entities: [],
    entityCardMemo: memo,
  } as unknown as SessionState;
}
function emptySession(): SessionState {
  return { session_id: "s", conversation_id: "c", entities: [] } as unknown as SessionState;
}
function hotelMemo(): EntityCardMemo[] {
  return [
    {
      position: 1, ref_id: "place:accommodation:h1", name: "Alpha Hotel",
      vertical: "accommodation",
      highlights: ["pool", "wifi", "parking", "phone"],
      unverified_highlights: [],
      attribute_states: { pool: "KNOWN_YES", wifi: "KNOWN_YES", parking: "KNOWN_YES", gym: "UNKNOWN", laundry: "UNKNOWN", phone: "KNOWN_YES" },
      attribute_evidence_tiers: { pool: "owner_verified", wifi: "owner_verified", parking: "owner_verified", phone: "owner_verified" },
    },
    {
      position: 2, ref_id: "place:accommodation:h2", name: "Bravo Hotel",
      vertical: "accommodation",
      highlights: ["wifi", "restaurant"],
      unverified_highlights: [],
      attribute_states: { pool: "UNKNOWN", wifi: "KNOWN_YES", parking: "UNKNOWN", restaurant: "KNOWN_YES", laundry: "KNOWN_YES", gym: "UNKNOWN" },
      attribute_evidence_tiers: { wifi: "owner_verified", restaurant: "owner_verified", laundry: "owner_verified" },
    },
    {
      position: 3, ref_id: "place:accommodation:h3", name: "Charlie Hotel",
      vertical: "accommodation",
      highlights: ["parking"],
      unverified_highlights: [],
      attribute_states: { pool: "UNKNOWN", wifi: "UNKNOWN", parking: "KNOWN_YES", laundry: "UNKNOWN", gym: "UNKNOWN" },
      attribute_evidence_tiers: { parking: "owner_verified" },
    },
  ];
}

/** UNVERIFIED variant · same set but directory-tier evidence. */
function hotelMemoUnverified(): EntityCardMemo[] {
  return hotelMemo().map((m) => ({
    ...m,
    highlights: [],
    unverified_highlights: m.highlights,
    attribute_states: Object.fromEntries(
      Object.entries(m.attribute_states).map(([k, v]) => [k, v === "KNOWN_YES" ? "UNVERIFIED" : v]),
    ) as Record<string, "KNOWN_YES" | "KNOWN_NO" | "UNKNOWN" | "UNVERIFIED" | "CONFLICTING" | "STALE">,
    attribute_evidence_tiers: Object.fromEntries(
      Object.entries(m.attribute_evidence_tiers).map(([k]) => [k, "directory" as const]),
    ),
  }));
}

// ═════════════ Classification ═════════════

describe("classifyAttributeQuery · HAS_ATTRIBUTE_SINGLE", () => {
  it("catches 'does the first one have a pool?'", () => {
    const d = classifyAttributeQuery("does the first one have a pool?", "accommodation");
    expect(d.kind).toBe("HAS_ATTRIBUTE_SINGLE");
    expect(d.reference).toBe("ORDINAL_FIRST");
    expect(d.matched_attribute_id).toBe("pool");
  });
  it("catches 'does that one have laundry?'", () => {
    const d = classifyAttributeQuery("does that one have laundry?", "accommodation");
    expect(d.kind).toBe("HAS_ATTRIBUTE_SINGLE");
    expect(d.reference).toBe("PRONOUN_THAT");
    expect(d.matched_attribute_id).toBe("laundry");
  });
  it("catches 'does the second one have wifi?'", () => {
    const d = classifyAttributeQuery("does the second one have wifi?", "accommodation");
    expect(d.reference).toBe("ORDINAL_SECOND");
    expect(d.matched_attribute_id).toBe("wifi");
  });
  it("Indonesian 'apakah yang pertama punya kolam?'", () => {
    const d = classifyAttributeQuery("apakah yang pertama punya kolam?", "accommodation");
    expect(d.kind).toBe("HAS_ATTRIBUTE_SINGLE");
    expect(d.reference).toBe("ORDINAL_FIRST");
    expect(d.matched_attribute_id).toBe("pool");
  });
});

describe("classifyAttributeQuery · WHICH_HAS_ATTRIBUTE", () => {
  it("catches 'which one has laundry?'", () => {
    const d = classifyAttributeQuery("which one has laundry?", "accommodation");
    expect(d.kind).toBe("WHICH_HAS_ATTRIBUTE");
    expect(d.matched_attribute_id).toBe("laundry");
  });
  it("catches 'which has parking?'", () => {
    const d = classifyAttributeQuery("which has parking?", "accommodation");
    expect(d.kind).toBe("WHICH_HAS_ATTRIBUTE");
    expect(d.matched_attribute_id).toBe("parking");
  });
});

describe("classifyAttributeQuery · DO_ANY_HAVE_ATTRIBUTE", () => {
  it("catches 'do any have breakfast?'", () => {
    const d = classifyAttributeQuery("do any have breakfast?", "accommodation");
    expect(d.kind).toBe("DO_ANY_HAVE_ATTRIBUTE");
    expect(d.matched_attribute_id).toBe("breakfast");
  });
  it("catches 'are there any with a pool?'", () => {
    const d = classifyAttributeQuery("are there any with a pool?", "accommodation");
    expect(d.kind).toBe("DO_ANY_HAVE_ATTRIBUTE");
    expect(d.matched_attribute_id).toBe("pool");
  });
});

describe("classifyAttributeQuery · LIST_ATTRIBUTES_OF", () => {
  it("catches 'tell me more about the second one'", () => {
    const d = classifyAttributeQuery("tell me more about the second one", "accommodation");
    expect(d.kind).toBe("LIST_ATTRIBUTES_OF");
    expect(d.reference).toBe("ORDINAL_SECOND");
  });
  it("catches 'what does the first one have?'", () => {
    const d = classifyAttributeQuery("what does the first one have?", "accommodation");
    expect(d.kind).toBe("LIST_ATTRIBUTES_OF");
    expect(d.reference).toBe("ORDINAL_FIRST");
  });
});

describe("classifyAttributeQuery · NEGATIVE cases", () => {
  it("does NOT match 'find me hotels'", () => {
    const d = classifyAttributeQuery("find me hotels", "accommodation");
    expect(d.kind).toBe("NONE");
  });
  it("does NOT match 'where did you find them?'", () => {
    const d = classifyAttributeQuery("where did you find them?", "accommodation");
    expect(d.kind).toBe("NONE");
  });
  it("empty vertical → NONE", () => {
    const d = classifyAttributeQuery("does the first have a pool?", null);
    expect(d.kind).toBe("NONE");
  });
});

// ═════════════ Gate decisions ═════════════

describe("decideAttributeQueryGate · HAS_ATTRIBUTE_SINGLE", () => {
  it("Alpha KNOWN_YES pool → confident affirmative", () => {
    const r = decideAttributeQueryGate({
      userMessage: "does the first one have a pool?",
      session: sessionWith(hotelMemo()),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.matched_state).toBe("KNOWN_YES");
      expect(r.reply).toContain("Alpha");
      expect(r.reply.toLowerCase()).toContain("yes");
    }
  });
  it("Bravo UNKNOWN pool → honest UNKNOWN (never KNOWN_NO)", () => {
    const r = decideAttributeQueryGate({
      userMessage: "does the second one have a pool?",
      session: sessionWith(hotelMemo()),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.matched_state).toBe("UNKNOWN");
      expect(r.reply.toLowerCase()).toContain("don't have verified");
      expect(r.reply.toLowerCase()).not.toMatch(/\bno\b/);
    }
  });
  it("Indonesian query", () => {
    const r = decideAttributeQueryGate({
      userMessage: "apakah yang pertama punya kolam?",
      session: sessionWith(hotelMemo()),
      activeLanguage: "ID",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) expect(r.reply).toContain("Ya");
  });
});

describe("decideAttributeQueryGate · WHICH_HAS_ATTRIBUTE", () => {
  it("laundry → only Bravo (KNOWN_YES) · caveats the rest as no-information", () => {
    const r = decideAttributeQueryGate({
      userMessage: "which one has laundry?",
      session: sessionWith(hotelMemo()),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reply).toContain("Bravo");
      expect(r.reply).not.toContain("Alpha");
      expect(r.reply).not.toContain("Charlie");
      expect(r.reply.toLowerCase()).toMatch(/don't have information|don't know/);
    }
  });
  it("gym → none KNOWN_YES · honest reply", () => {
    const r = decideAttributeQueryGate({
      userMessage: "which one has a gym?",
      session: sessionWith(hotelMemo()),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reply.toLowerCase()).toMatch(/don't have verified|search for ones/);
    }
  });
});

describe("decideAttributeQueryGate · DO_ANY_HAVE_ATTRIBUTE", () => {
  it("parking → Alpha + Charlie", () => {
    const r = decideAttributeQueryGate({
      userMessage: "do any have parking?",
      session: sessionWith(hotelMemo()),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reply).toContain("Alpha");
      expect(r.reply).toContain("Charlie");
    }
  });
});

describe("decideAttributeQueryGate · LIST_ATTRIBUTES_OF", () => {
  it("lists highlights for the first hotel", () => {
    const r = decideAttributeQueryGate({
      userMessage: "tell me more about the first one",
      session: sessionWith(hotelMemo()),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reply).toContain("Alpha");
      expect(r.reply.toLowerCase()).toMatch(/pool|wi-fi|parking/);
    }
  });
});

describe("decideAttributeQueryGate · fresh conversation", () => {
  it("no card memo → honest boundary", () => {
    const r = decideAttributeQueryGate({
      userMessage: "does the first one have a pool?",
      session: emptySession(),
      activeLanguage: "EN",
    });
    // With no vertical detectable, classifier returns NONE first.
    // In fresh conv the gate doesn't fire.
    expect(r.shouldGate).toBe(false);
  });
});

describe("decideAttributeQueryGate · pass-through", () => {
  it("plain search → no gate", () => {
    const r = decideAttributeQueryGate({
      userMessage: "find me hotels",
      session: emptySession(),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(false);
  });
  it("provenance question → no gate", () => {
    const r = decideAttributeQueryGate({
      userMessage: "where did you find them?",
      session: sessionWith(hotelMemo()),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(false);
  });
});

// ═════════════ New 6-state reply routing ═════════════

describe("decideAttributeQueryGate · UNVERIFIED reply", () => {
  it("pool query on unverified Alpha → directory hedge, not confident YES", () => {
    const r = decideAttributeQueryGate({
      userMessage: "does the first one have a pool?",
      session: sessionWith(hotelMemoUnverified()),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.matched_state).toBe("UNVERIFIED");
      expect(r.reply.toLowerCase()).toContain("listed as having");
      expect(r.reply.toLowerCase()).toContain("hasn't been confirmed");
      expect(r.reply.toLowerCase()).not.toMatch(/^yes/i);
    }
  });
  it("which-has surfaces UNVERIFIED separately from KNOWN_YES", () => {
    const mixed: EntityCardMemo[] = [
      { ...hotelMemo()[0] }, // Alpha KNOWN_YES pool
      hotelMemoUnverified()[1], // Bravo UNVERIFIED wifi (pool unknown)
    ];
    // Give Bravo a pool = UNVERIFIED
    mixed[1] = { ...mixed[1], attribute_states: { ...mixed[1].attribute_states, pool: "UNVERIFIED" } };
    const r = decideAttributeQueryGate({
      userMessage: "which one has a pool?",
      session: sessionWith(mixed),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reply).toContain("Alpha");
      expect(r.reply.toLowerCase()).toContain("verified");
      expect(r.reply).toContain("Bravo");
      expect(r.reply.toLowerCase()).toMatch(/hasn't been (owner-)?confirmed|the owner hasn't confirmed|directory/);
    }
  });
});

describe("decideAttributeQueryGate · STALE reply", () => {
  it("pool query when state=STALE → freshness hedge", () => {
    const staleMemo = hotelMemo().map((m) => ({
      ...m,
      attribute_states: { ...m.attribute_states, pool: "STALE" as const },
    }));
    const r = decideAttributeQueryGate({
      userMessage: "does the first one have a pool?",
      session: sessionWith(staleMemo),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.matched_state).toBe("STALE");
      expect(r.reply.toLowerCase()).toMatch(/hasn't been refreshed|can't confirm its current status/);
    }
  });
});

describe("decideAttributeQueryGate · CONFLICTING reply", () => {
  it("pool query when state=CONFLICTING → check-directly hedge", () => {
    const conflictingMemo = hotelMemo().map((m) => ({
      ...m,
      attribute_states: { ...m.attribute_states, pool: "CONFLICTING" as const },
    }));
    const r = decideAttributeQueryGate({
      userMessage: "does the first one have a pool?",
      session: sessionWith(conflictingMemo),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.matched_state).toBe("CONFLICTING");
      expect(r.reply.toLowerCase()).toContain("conflicting");
    }
  });
});

describe("decideAttributeQueryGate · out-of-contract keyword", () => {
  it("'does the first one have a helicopter pad?' → UNKNOWN (never FALSE)", () => {
    const r = decideAttributeQueryGate({
      userMessage: "does the first one have a helicopter pad?",
      session: sessionWith(hotelMemo()),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.matched_state).toBe("UNKNOWN");
      expect(r.reply.toLowerCase()).toContain("don't have verified");
      // Must NEVER convert to "no" or "does not have"
      expect(r.reply.toLowerCase()).not.toMatch(/\bno\b|does not have|doesn't have/);
    }
  });
  it("Indonesian out-of-contract query stays honest UNKNOWN", () => {
    const r = decideAttributeQueryGate({
      userMessage: "apakah yang pertama punya paket wedding?",
      session: sessionWith(hotelMemo()),
      activeLanguage: "ID",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.matched_state).toBe("UNKNOWN");
      expect(r.reply.toLowerCase()).toMatch(/belum.*terverifikasi|terverifikasi/);
    }
  });
});
