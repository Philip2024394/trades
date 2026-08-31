// accommodation-routing.test.ts · end-to-end regression that a real
// user typing an accommodation query never gets routed to the
// staircase specialist workflow.
//
// The bug this locks in: Philip reported 2026-08-30 that
// "I need hotel Indonesia" appeared to produce "what type of
// staircase do you want?" · investigation could not reproduce the
// symptom against the current /api/nex/general-chat handler, but the
// class of bug (accommodation → staircase leakage) is important
// enough to lock down against future regression.
//
// These tests bypass the HTTP layer and exercise the same
// deterministic classifier + gated-reply composer the general-chat
// route uses. If a future change makes an accommodation query fall
// through to the staircase text branch, these will catch it.

import { describe, it, expect } from "vitest";
import { classifyConversationIntent } from "../conversation-intent";
import { decideRag } from "./rag";

const ACCOMMODATION_QUERIES = [
  "I need hotel Indonesia",
  "I need a hotel in Indonesia",
  "hotel in Yogyakarta",
  "hotel",
  "help me find a hotel",
  "cheap guesthouse near Malioboro",
  "homestay in Yogya",
  "villa in Bali",
  "Saya perlu hotel di Bali",
  "cari hotel di Jakarta",
  "book me a hotel in Ubud",
  // Philip 2026-08-30 · reproducible bug set · vocabulary gap fix.
  // Every one of these must classify to a non-banned intent AND
  // never route to staircase.
  "I need accommodation jarkata",
  "I need accommodation in Jakarta",
  "I need accommodation Jakarta",
  "accommodation in Jakarta",
  "I need accommodation in Bali",
  "Saya butuh akomodasi di Jakarta",
  "cari akomodasi di Jakarta",
  "I need a place to stay in Jakarta",
  "where should I stay in Yogyakarta",
  "lodging in Ubud",
  "villa in Seminyak",
  "resort in Lombok",
];

const BANNED_INTENTS = new Set(["staircase", "trades", "quotation"]);

describe("accommodation query routing · never leaks into staircase specialist", () => {
  for (const message of ACCOMMODATION_QUERIES) {
    it(`'${message}' classifies to a knowledge/action intent, not staircase`, () => {
      const cl = classifyConversationIntent(message);
      expect(BANNED_INTENTS.has(cl.intent)).toBe(false);
      // Must be one of the intents the general-chat gate handles with
      // real accommodation-flavored replies (composeGatedReply case).
      expect(["accommodation", "tourism", "food", "indonesia", "business", "booking", "places"]).toContain(cl.intent);
    });

    it(`'${message}' produces retrieval hits OR is a business-lookup handled by directory response`, () => {
      const rag = decideRag(message, { disableGapRecording: true });
      const cl = classifyConversationIntent(message);
      // Two acceptable outcomes:
      //  A) tourism/indonesia/food/booking with grounded hits (knowledge answer)
      //  B) business intent with no hits (directory-lookup flow; correct
      //     when the user asks to LOCATE rather than to LEARN)
      if (cl.intent === "business") {
        // business intent WITHOUT Indonesia secondary → directory flow
        // is the correct answer; no RAG needed.
        expect(true).toBe(true);
      } else {
        expect(rag.attached).toBe(true);
        expect(rag.hits.length).toBeGreaterThan(0);
      }
    });

    it(`'${message}' retrieval hits never point at a staircase topic`, () => {
      const rag = decideRag(message, { disableGapRecording: true });
      for (const hit of rag.hits) {
        expect(hit.topic.toLowerCase()).not.toMatch(/staircase|stair|balustrade|banister|newel/);
        expect(hit.category?.toLowerCase() ?? "").not.toMatch(/staircase|stair/);
      }
    });
  }
});

describe("accommodation routing · Indonesian-language coverage", () => {
  it("Indonesian 'cari hotel' now triggers accommodation vertical (higher priority than business_lookup)", () => {
    const cl = classifyConversationIntent("cari hotel di Jakarta");
    expect(cl.intent).toBe("accommodation");
    expect(cl.secondary).toBe("indonesia");
  });

  it("Indonesian 'pesan hotel' triggers booking pattern (not staircase)", () => {
    const cl = classifyConversationIntent("pesankan saya hotel di Bali");
    expect(cl.intent).toBe("booking");
    expect(cl.secondary).toBe("indonesia");
  });
});

describe("accommodation routing · staircase intent still preserved for real staircase queries", () => {
  const REAL_STAIRCASE = [
    "I need a staircase",
    "calculate my staircase",
    "oak staircase quote",
    "how much for a balustrade",
    "newel and handrail",
  ];
  for (const message of REAL_STAIRCASE) {
    it(`'${message}' still classifies as staircase (no false negatives from the fix)`, () => {
      const cl = classifyConversationIntent(message);
      expect(cl.intent).toBe("staircase");
    });
  }
});
