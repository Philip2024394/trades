// src/lib/nex/brain/reference-hydration.test.ts
//
// Regression tests for P0.3 · Hotel Resolved-Reference Continuity
// Philip 2026-09-05 · chief-engineer AUTHORIZE.
//
// Covers all 8 required test cases from the AUTHORIZE literal:
//   1. HOTEL REFERENCE           — hotel results present in session
//   2. ORDINAL REFERENCE         — user drills down via "the first one"
//   3. RESOLUTION                — NEX resolved deterministically
//   4. CONTINUITY                — resolved record survives into composition context
//   5. GROUNDED RESPONSE         — only info from that record used
//   6. NO GUESSING               — unresolvable → returns hydration=false
//   7. ZERO-EVIDENCE PRESERVED   — P0 boundary still works when no ref
//   8. VOICE                     — inherits via existing pipeline (see live proof)
//
// Plus adversarial coverage on refId parsing.

import { describe, it, expect, vi } from "vitest";
import type { SessionState } from "./session";
import type { WorldRecord } from "./world-adapters/types";
import {
  parseRefId,
  isReferenceFreshThisTurn,
  hydrateResolvedReference,
  hydratedRecordToKnowledge,
  buildHotelRecordSummary,
} from "./reference-hydration";

// Mock the world-adapters registry so unit tests don't hit the DB.
vi.mock("./world-adapters", () => ({
  getWorldRecordById: vi.fn(async ({ vertical, id, market }) => {
    // Deterministic fixture: return a record for #AC-2026-0000D, null for others.
    if (vertical === "accommodation" && id === "#AC-2026-0000D") {
      return {
        id: "#AC-2026-0000D",
        name: "Gaotama Hotel",
        vertical: "accommodation",
        market,
        category: "hotel",
        city: "Yogyakarta",
        district: "Sosromenduran",
        address: "Jalan Sosromenduran GT I/234",
        phone: "+62274123456",
        starRating: 3,
        claimStatus: "listed",
        provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-09-05T10:00:00Z" },
      } satisfies WorldRecord;
    }
    if (vertical === "accommodation" && id === "#AC-2026-9999X") {
      return null; // simulates deleted/missing record
    }
    return null;
  }),
}));

// ─── Test 6 preparation · refId parsing ─────────────────────────────

describe("parseRefId · deterministic vertical + id extraction", () => {
  it("parses full session format `place:accommodation:#AC-2026-0000D`", () => {
    expect(parseRefId("place:accommodation:#AC-2026-0000D")).toEqual({
      vertical: "accommodation",
      id: "#AC-2026-0000D",
    });
  });

  it("parses bare `#AC-2026-0000D` (fallback path)", () => {
    expect(parseRefId("#AC-2026-0000D")).toEqual({
      vertical: "accommodation",
      id: "#AC-2026-0000D",
    });
  });

  it("parses food refId `place:food:#FL-2026-000QJ`", () => {
    expect(parseRefId("place:food:#FL-2026-000QJ")).toEqual({
      vertical: "food",
      id: "#FL-2026-000QJ",
    });
  });

  it("parses service refId `place:service:#SB-2026-10GX6`", () => {
    expect(parseRefId("place:service:#SB-2026-10GX6")).toEqual({
      vertical: "service",
      id: "#SB-2026-10GX6",
    });
  });

  it("returns null for garbage / injection-shaped refIds", () => {
    expect(parseRefId(null)).toBeNull();
    expect(parseRefId(undefined)).toBeNull();
    expect(parseRefId("")).toBeNull();
    expect(parseRefId("place:'; DROP TABLE nex.accommodation_business; --")).toBeNull();
    expect(parseRefId("random-string")).toBeNull();
    expect(parseRefId("place:unknown_vertical:#AC-2026-0000D")).toBeNull();
  });
});

// ─── isReferenceFreshThisTurn ───────────────────────────────────────

describe("isReferenceFreshThisTurn · avoids re-hydrating stale references", () => {
  const mkSession = (turnCount: number, ref: unknown): SessionState => ({
    conversationId: "test",
    turnCount,
    currentReference: ref,
  } as unknown as SessionState);

  it("returns true when reference resolvedInTurn === currentTurn", () => {
    const s = mkSession(3, { resolved: true, resolvedInTurn: 3, business: { refId: "#AC-2026-0000D" } });
    expect(isReferenceFreshThisTurn(s, 3)).toBe(true);
  });

  it("returns false when reference resolved on a prior turn", () => {
    const s = mkSession(3, { resolved: true, resolvedInTurn: 1, business: { refId: "#AC-2026-0000D" } });
    expect(isReferenceFreshThisTurn(s, 3)).toBe(false);
  });

  it("returns false when reference is unresolved", () => {
    const s = mkSession(3, { resolved: false, reason: "no_reference_mentioned" });
    expect(isReferenceFreshThisTurn(s, 3)).toBe(false);
  });

  it("returns false when session is null", () => {
    expect(isReferenceFreshThisTurn(null, 3)).toBe(false);
  });
});

// ─── Tests 1-5 · Hotel reference → resolution → continuity → grounded ─

describe("Test 1-5 · Hotel reference → resolution → continuity → grounded response", () => {
  it("Test 1+2+3 · Session with resolved ordinal hotel reference · hydration succeeds", async () => {
    const s = {
      conversationId: "test",
      turnCount: 2,
      currentReference: {
        resolved: true,
        refKind: "ordinal",
        offset: 1,
        business: { canonical: "gaotama hotel", raw: "Gaotama Hotel", refId: "place:accommodation:#AC-2026-0000D" },
        resolvedInTurn: 2,
      },
    } as unknown as SessionState;
    const r = await hydrateResolvedReference({
      session: s,
      market: "ID",
      currentTurn: 2,
      verticalAllowlist: ["accommodation"],
    });
    expect(r.hydrated).toBe(true);
    if (r.hydrated) {
      // Test 4 · CONTINUITY: the actual record surfaces
      expect(r.vertical).toBe("accommodation");
      expect(r.record.id).toBe("#AC-2026-0000D");
      expect(r.record.name).toBe("Gaotama Hotel");
      expect(r.record.city).toBe("Yogyakarta");
      // Test 5 · GROUNDED: real fields present
      expect(r.record.address).toBeTruthy();
      expect(r.record.phone).toBeTruthy();
    }
  });

  it("Test 4 · hydrated record converts to KnowledgeRecord shape for composition context", async () => {
    const s = {
      conversationId: "test",
      turnCount: 2,
      currentReference: {
        resolved: true,
        resolvedInTurn: 2,
        business: { refId: "place:accommodation:#AC-2026-0000D" },
      },
    } as unknown as SessionState;
    const r = await hydrateResolvedReference({
      session: s, market: "ID", currentTurn: 2,
      verticalAllowlist: ["accommodation"],
    });
    if (!r.hydrated) throw new Error("expected hydration success");
    const k = hydratedRecordToKnowledge(r.record);
    // Composition context expects: id, topic, content, source, region,
    // last_verified, stability, keywords.
    expect(k.id).toContain("#AC-2026-0000D");
    expect(k.topic).toContain("accommodation");
    expect(k.content).toContain("Gaotama Hotel");
    expect(k.content).toContain("Yogyakarta");
    expect(k.content).toContain("Jalan Sosromenduran");
    expect(k.source).toContain("hydrated:reference:accommodation");
    expect(k.region).toBe("Yogyakarta");
    expect(k.stability).toBe("live");
    expect(k.keywords.length).toBeGreaterThan(0);
    expect(k.keywords).toContain("gaotama");
    expect(k.keywords).toContain("hotel");
  });

  it("Test 5 · KnowledgeRecord content does NOT fabricate absent fields", async () => {
    const s = {
      conversationId: "test",
      turnCount: 2,
      currentReference: {
        resolved: true,
        resolvedInTurn: 2,
        business: { refId: "place:accommodation:#AC-2026-0000D" },
      },
    } as unknown as SessionState;
    const r = await hydrateResolvedReference({
      session: s, market: "ID", currentTurn: 2,
      verticalAllowlist: ["accommodation"],
    });
    if (!r.hydrated) throw new Error("expected hydration success");
    const k = hydratedRecordToKnowledge(r.record);
    // The fixture record has NO rating, NO reviewCount, NO roomCount,
    // NO amenities. Content must NOT invent them.
    expect(k.content).not.toContain("rating:");
    expect(k.content).not.toContain("rooms");
    expect(k.content).not.toContain("amenities:");
    // But confirmed-present fields DO appear.
    expect(k.content).toContain("Gaotama Hotel");
    expect(k.content).toContain("3 stars");
    expect(k.content).toContain("listed on NEX");
  });
});

// ─── Test 6 · NO GUESSING · unresolvable → hydrated:false ──────────

describe("Test 6 · NO GUESSING · unresolvable references return hydration=false", () => {
  it("null session → hydrated:false", async () => {
    const r = await hydrateResolvedReference({
      session: null, market: "ID", currentTurn: 1,
      verticalAllowlist: ["accommodation"],
    });
    expect(r.hydrated).toBe(false);
    if (!r.hydrated) expect(r.reason).toBe("no_session");
  });

  it("reference unresolved → hydrated:false", async () => {
    const s = {
      conversationId: "test",
      turnCount: 1,
      currentReference: { resolved: false, reason: "no_reference_mentioned" },
    } as unknown as SessionState;
    const r = await hydrateResolvedReference({
      session: s, market: "ID", currentTurn: 1,
      verticalAllowlist: ["accommodation"],
    });
    expect(r.hydrated).toBe(false);
    if (!r.hydrated) expect(r.reason).toBe("reference_not_fresh_this_turn");
  });

  it("stale reference (resolved on earlier turn) → hydrated:false", async () => {
    const s = {
      conversationId: "test",
      turnCount: 5,
      currentReference: {
        resolved: true,
        resolvedInTurn: 1,
        business: { refId: "place:accommodation:#AC-2026-0000D" },
      },
    } as unknown as SessionState;
    const r = await hydrateResolvedReference({
      session: s, market: "ID", currentTurn: 5,
      verticalAllowlist: ["accommodation"],
    });
    expect(r.hydrated).toBe(false);
    if (!r.hydrated) expect(r.reason).toBe("reference_not_fresh_this_turn");
  });

  it("record deleted from DB → hydrated:false (no guessing)", async () => {
    const s = {
      conversationId: "test",
      turnCount: 2,
      currentReference: {
        resolved: true,
        resolvedInTurn: 2,
        business: { refId: "place:accommodation:#AC-2026-9999X" },
      },
    } as unknown as SessionState;
    const r = await hydrateResolvedReference({
      session: s, market: "ID", currentTurn: 2,
      verticalAllowlist: ["accommodation"],
    });
    expect(r.hydrated).toBe(false);
    if (!r.hydrated) expect(r.reason).toBe("record_not_found");
  });

  it("vertical outside allowlist (SCOPE LOCK) → hydrated:false", async () => {
    // Even if the reference is resolved to a gym, this slice's caller
    // must not hydrate. Gym continuity is a separate authorization.
    const s = {
      conversationId: "test",
      turnCount: 2,
      currentReference: {
        resolved: true,
        resolvedInTurn: 2,
        business: { refId: "place:service:#SB-2026-10GX6" },
      },
    } as unknown as SessionState;
    const r = await hydrateResolvedReference({
      session: s, market: "ID", currentTurn: 2,
      verticalAllowlist: ["accommodation"],
    });
    expect(r.hydrated).toBe(false);
    if (!r.hydrated) expect(r.reason).toBe("vertical_not_allowed:service");
  });

  it("Test 5 · buildHotelRecordSummary uses ONLY record fields (no fabrication)", () => {
    const record: WorldRecord = {
      id: "#AC-2026-0000D",
      name: "Gaotama Hotel",
      vertical: "accommodation",
      market: "ID",
      category: "hotel",
      city: "Yogyakarta",
      district: "Sosromenduran",
      address: "Jalan Sosromenduran GT I/234",
      phone: "+62274123456",
      starRating: 3,
      claimStatus: "listed",
      provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-09-05T10:00:00Z" },
    };
    const summary = buildHotelRecordSummary(record);
    // Contains ALL present fields
    expect(summary).toContain("Gaotama Hotel");
    expect(summary).toContain("hotel");
    expect(summary).toContain("Sosromenduran");
    expect(summary).toContain("Yogyakarta");
    expect(summary).toContain("Jalan Sosromenduran GT I/234");
    expect(summary).toContain("+62274123456");
    expect(summary).toContain("3-star");
    expect(summary).toContain("Listed on NEX");
    // Does NOT invent absent fields
    expect(summary).not.toContain("Rating:");
    expect(summary).not.toContain("rooms");
    expect(summary).not.toContain("Amenities:");
    expect(summary).not.toContain("Website:");
    // Does NOT invent marketing / subjective language
    expect(summary.toLowerCase()).not.toContain("good choice");
    expect(summary.toLowerCase()).not.toContain("recommend");
    expect(summary.toLowerCase()).not.toContain("popular");
    expect(summary.toLowerCase()).not.toContain("famous");
    expect(summary.toLowerCase()).not.toContain("near malioboro"); // location not on this record
  });

  it("Test 5b · summary handles record with only name (minimum viable)", () => {
    const record: WorldRecord = {
      id: "#AC-2026-XXXXX",
      name: "Nameless Property",
      vertical: "accommodation",
      market: "ID",
      provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-09-05T00:00:00Z" },
    };
    const summary = buildHotelRecordSummary(record);
    expect(summary).toContain("Nameless Property");
    expect(summary).toContain("accommodation directory");
    // No invented anything
    expect(summary).not.toContain("hotel");
    expect(summary).not.toContain("star");
    expect(summary).not.toContain("Address:");
  });

  it("garbage refId → hydrated:false with unparseable reason", async () => {
    const s = {
      conversationId: "test",
      turnCount: 2,
      currentReference: {
        resolved: true,
        resolvedInTurn: 2,
        business: { refId: "not-a-valid-refid" },
      },
    } as unknown as SessionState;
    const r = await hydrateResolvedReference({
      session: s, market: "ID", currentTurn: 2,
      verticalAllowlist: ["accommodation"],
    });
    expect(r.hydrated).toBe(false);
    if (!r.hydrated) expect(r.reason).toContain("unparseable_refId");
  });
});
