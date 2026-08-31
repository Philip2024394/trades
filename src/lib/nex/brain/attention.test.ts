// Stage 3.28 · Phase 21 · Attention unit tests.

import { describe, it, expect } from "vitest";
import { computeAttention } from "./attention";
import type { RecognisedEntity } from "./entities";
import type { Goal } from "./goal-tracking";

const AT = "2026-08-31T00:00:00.000Z";
const NOW = Date.now();

function biz(name: string, offset: number, source: RecognisedEntity["source"] = "nex_reply"): RecognisedEntity {
  return {
    id: `business_name:${name.toLowerCase().replace(/\s+/g, "-")}`,
    kind: "business_name",
    canonical: name.toLowerCase(),
    raw: name,
    source,
    atIso: AT,
    presentedOffset: offset,
  };
}

function goal(status: Goal["status"] = "active"): Goal {
  return { id: "g1", kind: "accommodation", status, createdAt: NOW, updatedAt: NOW, turnsSinceProgress: 0, summary: "hotels in Yogyakarta" };
}

describe("computeAttention · empty state", () => {
  it("no slots + no goal + no entities → empty ranked", () => {
    const r = computeAttention({});
    expect(r.ranked).toEqual([]);
    expect(r.top).toBeUndefined();
    expect(r.summary).toContain("no attention subjects");
  });
});

describe("computeAttention · slot ranking", () => {
  it("only populated slot dimensions are ranked", () => {
    const r = computeAttention({ slots: { location: "yogyakarta", type: "hotel" } });
    const slotSubjects = r.ranked.filter((i) => i.kind === "slot").map((i) => i.subject);
    expect(slotSubjects).toContain("slot:location");
    expect(slotSubjects).toContain("slot:type");
    expect(slotSubjects).not.toContain("slot:budget");
  });

  it("introduced-this-turn slot ranks higher than untouched slot", () => {
    const r = computeAttention({
      slots: { location: "yogyakarta", type: "hotel", budget: "budget" },
      slotsIntroducedThisTurn: ["budget"],
    });
    const budget = r.ranked.find((i) => i.subject === "slot:budget");
    const location = r.ranked.find((i) => i.subject === "slot:location");
    expect(budget?.score).toBeGreaterThan(location?.score ?? 0);
    expect(budget?.reason).toContain("introduced this turn");
  });

  it("corrected slot gets extra boost on top of introduction", () => {
    const r = computeAttention({
      slots: { type: "guesthouse" },
      slotsIntroducedThisTurn: ["type"],
      correctionThisTurn: true,
    });
    const type = r.ranked.find((i) => i.subject === "slot:type");
    expect(type?.reason).toContain("corrected this turn");
  });
});

describe("computeAttention · entity ranking", () => {
  it("presented business entities ranked", () => {
    const r = computeAttention({
      entities: [biz("Griya Sentana", 1), biz("Hotel Trim Tiga", 2)],
    });
    const entitySubjects = r.ranked.filter((i) => i.kind === "entity").map((i) => i.displayName);
    expect(entitySubjects).toContain("Griya Sentana");
    expect(entitySubjects).toContain("Hotel Trim Tiga");
  });

  it("resolved reference wins over unresolved presented entities", () => {
    const r = computeAttention({
      entities: [biz("Griya Sentana", 1), biz("Hotel Trim Tiga", 2)],
      resolvedReferenceCanonical: "hotel trim tiga",
    });
    const trim = r.ranked.find((i) => i.subject === "entity:hotel trim tiga");
    const griya = r.ranked.find((i) => i.subject === "entity:griya sentana");
    expect(trim?.score).toBeGreaterThan(griya?.score ?? 0);
    expect(trim?.reason).toContain("resolved reference this turn");
  });

  it("user-message entities get their own boost", () => {
    const r = computeAttention({
      entities: [biz("Sony", 1, "user_message")],
    });
    const sony = r.ranked.find((i) => i.displayName === "Sony");
    expect(sony?.reason).toContain("mentioned in user message");
  });

  it("non-business_name entities are ignored (out of scope v1)", () => {
    const e: RecognisedEntity = { id: "place:yogyakarta", kind: "place", canonical: "yogyakarta", raw: "Yogyakarta", source: "user_message", atIso: AT };
    const r = computeAttention({ entities: [e] });
    expect(r.ranked.filter((i) => i.kind === "entity")).toEqual([]);
  });
});

describe("computeAttention · goal scoring by status", () => {
  it("active goal outranks paused goal", () => {
    const rActive = computeAttention({ goal: goal("active") });
    const rPaused = computeAttention({ goal: goal("paused") });
    const activeGoal = rActive.ranked.find((i) => i.kind === "goal");
    const pausedGoal = rPaused.ranked.find((i) => i.kind === "goal");
    expect(activeGoal?.score).toBeGreaterThan(pausedGoal?.score ?? 0);
  });

  it("completed goal scores much lower than active", () => {
    const r = computeAttention({ goal: goal("completed") });
    const g = r.ranked.find((i) => i.kind === "goal");
    expect(g?.score).toBeLessThan(0.5);
  });
});

describe("computeAttention · sort + topK", () => {
  it("ranked is sorted by score descending", () => {
    const r = computeAttention({
      slots: { location: "yogyakarta", type: "hotel", budget: "budget" },
      slotsIntroducedThisTurn: ["type"],
      entities: [biz("Griya Sentana", 1)],
      goal: goal("active"),
    });
    for (let i = 0; i < r.ranked.length - 1; i++) {
      expect(r.ranked[i].score).toBeGreaterThanOrEqual(r.ranked[i + 1].score);
    }
  });

  it("respects topK (default 5)", () => {
    const r = computeAttention({
      slots: { location: "y", type: "h", budget: "b", area: "m", date: "tonight", guests: 2, action: "discover" },
      entities: [biz("A", 1), biz("B", 2), biz("C", 3)],
      goal: goal("active"),
    });
    expect(r.ranked.length).toBeLessThanOrEqual(5);
  });

  it("custom topK", () => {
    const r = computeAttention({
      slots: { location: "y", type: "h" },
      goal: goal("active"),
      topK: 2,
    });
    expect(r.ranked.length).toBe(2);
  });
});

describe("computeAttention · top field + summary", () => {
  it("top is the highest-scored item", () => {
    const r = computeAttention({
      slots: { type: "hotel" },
      slotsIntroducedThisTurn: ["type"],
      correctionThisTurn: true,
      goal: goal("paused"),  // lower score than the corrected slot
    });
    // slot:type with intro+correction: 1.0+0.6+0.4 = 2.0 · goal paused: 0.8 · slot:type wins
    expect(r.top?.subject).toBe("slot:type");
  });

  it("summary line describes top", () => {
    const r = computeAttention({ goal: goal("active") });
    expect(r.summary).toContain("top=goal:accommodation");
  });
});
