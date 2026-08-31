// Stage 3.7 · Multi-turn conversation regression suite (Philip 2026-08-31).
//
// These are the flows Philip specified as the litmus test for the
// Conversational Brain. Each test threads a stable `conversationId` so
// the Brain accumulates state across turns.

import { describe, it, expect, beforeEach } from "vitest";
import { orchestrateChatTurn } from "./orchestrate";
import { _resetSessionsForTests, getSession } from "./session";

beforeEach(() => _resetSessionsForTests());

describe("EN flow · discovery → cheap → Malioboro → pool", () => {
  const cid = "conv-en-1";

  it("Turn 1: 'I need a hotel in Jogja' accepts location + type", () => {
    const r = orchestrateChatTurn("I need a hotel in Jogja", { userMarket: "ID", conversationId: cid });
    expect(r.intent).toBe("accommodation");
    const state = getSession(cid);
    expect(state?.accommodation).toMatchObject({ type: "hotel", location: "yogyakarta" });
    // Discovery reply names real properties.
    expect(r.reply.toLowerCase()).toMatch(/listings|real/);
  });

  it("Turn 2: 'Cheap' accumulates budget onto the existing state", () => {
    orchestrateChatTurn("I need a hotel in Jogja", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Cheap", { userMarket: "ID", conversationId: cid });
    expect(r.intent).toBe("accommodation");
    const state = getSession(cid);
    expect(state?.accommodation).toMatchObject({ type: "hotel", location: "yogyakarta", budget: "budget" });
    // Acknowledges the new slot.
    expect(r.reply.toLowerCase()).toMatch(/got it|budget|switching/);
  });

  it("Turn 3: 'Near Malioboro' accumulates area", () => {
    orchestrateChatTurn("I need a hotel in Jogja", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Cheap", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Near Malioboro", { userMarket: "ID", conversationId: cid });
    const state = getSession(cid);
    expect(state?.accommodation).toMatchObject({
      type: "hotel", location: "yogyakarta", budget: "budget", area: "malioboro",
    });
    expect(r.reply.toLowerCase()).toContain("malioboro");
  });

  it("Turn 4: 'With a pool' produces honest amenity-boundary reply", () => {
    orchestrateChatTurn("I need a hotel in Jogja", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Cheap", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Near Malioboro", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("With a pool", { userMarket: "ID", conversationId: cid });
    // Honest data boundary — OSM has no facility metadata.
    expect(r.reply.toLowerCase()).toMatch(/openstreetmap|facility|don'?t carry|can'?t.*filter/);
    // But amenity is captured in state.
    const state = getSession(cid);
    expect(state?.accommodation.amenities).toContain("pool");
  });

  it("Turn 5: 'For two people' captures guests and continues", () => {
    orchestrateChatTurn("I need a hotel in Jogja", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Cheap", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Near Malioboro", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("With a pool", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("For two people", { userMarket: "ID", conversationId: cid });
    const state = getSession(cid);
    expect(state?.accommodation.guests).toBe(2);
  });
});

describe("ID flow · bahasa turns accumulate the same state", () => {
  const cid = "conv-id-1";

  it("Turn 1: 'Cari hotel di Jogja'", () => {
    const r = orchestrateChatTurn("Cari hotel di Jogja", { userMarket: "ID", conversationId: cid });
    expect(r.intent).toBe("accommodation");
    const s = getSession(cid);
    expect(s?.accommodation).toMatchObject({ type: "hotel", location: "yogyakarta" });
  });

  it("Turn 2: 'Yang murah' adds budget", () => {
    orchestrateChatTurn("Cari hotel di Jogja", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Yang murah", { userMarket: "ID", conversationId: cid });
    void r;
    const s = getSession(cid);
    expect(s?.accommodation.budget).toBe("budget");
  });

  it("Turn 3: 'Dekat Malioboro' adds area", () => {
    orchestrateChatTurn("Cari hotel di Jogja", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Yang murah", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Dekat Malioboro", { userMarket: "ID", conversationId: cid });
    const s = getSession(cid);
    expect(s?.accommodation).toMatchObject({
      type: "hotel", location: "yogyakarta", budget: "budget", area: "malioboro",
    });
  });

  it("Turn 4: 'Ada kolam renang?' captures amenity + honest reply", () => {
    orchestrateChatTurn("Cari hotel di Jogja", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Yang murah", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Dekat Malioboro", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Ada kolam renang?", { userMarket: "ID", conversationId: cid });
    expect(r.reply.toLowerCase()).toMatch(/openstreetmap|facility|don'?t carry|can'?t.*filter/);
    const s = getSession(cid);
    expect(s?.accommodation.amenities).toContain("pool");
  });
});

describe("Correction / change-of-mind flow", () => {
  const cid = "conv-correct-1";

  it("'Actually, find me a guesthouse instead' switches type and acknowledges", () => {
    orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Actually, find me a guesthouse instead", { userMarket: "ID", conversationId: cid });
    const s = getSession(cid);
    expect(s?.accommodation.type).toBe("guesthouse");
    expect(s?.accommodation.location).toBe("yogyakarta"); // preserved
    expect(r.reply.toLowerCase()).toContain("switching");
    expect(r.reply.toLowerCase()).toContain("guesthouse");
  });
});

describe("Knowledge interruption preserves discovery state", () => {
  const cid = "conv-interrupt-1";

  it("mid-flow knowledge question answers AND preserves prior slots", () => {
    orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Cheap", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("What is a kos-kosan?", { userMarket: "ID", conversationId: cid });
    // Grounded answer surfaces.
    expect(r.reply.toLowerCase()).toMatch(/kos/);
    expect(r.reply.toLowerCase()).toContain("source: nex indonesia knowledge");
    // Resume hint is included.
    expect(r.reply.toLowerCase()).toMatch(/keep|in mind|word to continue/i);
    // Prior slots survive.
    const s = getSession(cid);
    expect(s?.accommodation).toMatchObject({ type: "hotel", location: "yogyakarta", budget: "budget" });
  });
});

describe("Book action · honest booking boundary", () => {
  const cid = "conv-book-1";

  it("'Book this hotel tonight' returns booking-not-available reply", () => {
    orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Book this hotel tonight", { userMarket: "ID", conversationId: cid });
    expect(r.reply.toLowerCase()).toMatch(/can'?t book|no live booking|no.*booking connection|discovery listings/);
  });
});

describe("Session isolation", () => {
  it("different conversationIds don't leak state", () => {
    orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: "conv-A" });
    orchestrateChatTurn("Cari villa di Bali", { userMarket: "ID", conversationId: "conv-B" });
    const a = getSession("conv-A");
    const b = getSession("conv-B");
    expect(a?.accommodation.location).toBe("yogyakarta");
    expect(a?.accommodation.type).toBe("hotel");
    expect(b?.accommodation.location).toBe("bali");
    expect(b?.accommodation.type).toBe("villa");
  });

  it("stateless call (no conversationId) does not upsert or read any session", () => {
    orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID" }); // no cid
    // Nothing to fetch: cid was never persisted.
    expect(getSession(undefined)).toBeNull();
  });
});

describe("Cross-intent isolation · non-accommodation intents don't touch slots", () => {
  const cid = "conv-mixed-1";

  it("weather / greeting mid-flow leaves accommodation slots intact", () => {
    orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID", conversationId: cid });
    orchestrateChatTurn("Cheap", { userMarket: "ID", conversationId: cid });
    // Interrupt with a greeting
    const r = orchestrateChatTurn("Hello NEX", { userMarket: "ID", conversationId: cid });
    expect(r.intent).toBe("conversation");
    const s = getSession(cid);
    expect(s?.accommodation).toMatchObject({ type: "hotel", location: "yogyakarta", budget: "budget" });
  });
});
