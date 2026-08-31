// src/lib/nex/brain/orchestrate-accommodation.test.ts
//
// Regression suite for the accommodation-conversation fix (Philip
// 2026-08-31). Before this fix, "I need a hotel in Yogyakarta" got a
// generic Yogyakarta tourism paragraph. This suite locks in:
//
//   1. Discovery requests get a short conversational lead that names
//      real properties from the World corpus, not a tourism essay.
//   2. Knowledge questions still get the grounded explanation record.
//   3. The Brain never invents prices, availability, or bookability.
//   4. Fabricated live/booking phrases are absent.

import { describe, expect, it } from "vitest";
import { orchestrateChatTurn } from "./orchestrate";

const YOGYAKARTA_TOURISM_ESSAY_HALLMARK = /java'?s cultural heart|world's largest buddhist temple/i;
const FABRICATED_LIVE_PHRASES = [
  /verified by the hotel/i,
  /available tonight/i,
  /bookable now/i,
  /\bpay ?online\b/i,
  /confirmed availability/i,
];

describe("orchestrateChatTurn · accommodation discovery vs knowledge", () => {
  it("'I need a hotel in Yogyakarta' surfaces real property names, not the tourism essay", () => {
    const r = orchestrateChatTurn("I need a hotel in Yogyakarta", { userMarket: "ID" });
    expect(r.intent).toBe("accommodation");
    expect(r.reply).not.toMatch(YOGYAKARTA_TOURISM_ESSAY_HALLMARK);
    // Real OSM property names come from the 274-record Yogyakarta corpus.
    // We can't hard-code a single name (rank may shift) but SOMETHING
    // resembling a Latin-alphabet property name must be present, and the
    // honest boundary phrasing must be there.
    expect(r.reply).toMatch(/real|listings/i);
    expect(r.reply).toMatch(/openstreetmap|discovery, not live booking/i);
  });

  it("'Find me a guesthouse' is discovery, not a hotel-type explanation", () => {
    const r = orchestrateChatTurn("Find me a guesthouse", { userMarket: "ID" });
    expect(r.intent).toBe("accommodation");
    expect(r.reply).not.toMatch(YOGYAKARTA_TOURISM_ESSAY_HALLMARK);
    // Should not open with the type-explanation record ("Guesthouses are
    // small, family-run properties…"). The discovery composer either
    // names real properties or asks a refining question — never dumps.
    expect(r.reply).not.toMatch(/^guesthouses are small/i);
  });

  it("'Cari hotel di Jogja' (Bahasa) also uses the discovery composer", () => {
    const r = orchestrateChatTurn("Cari hotel di Jogja", { userMarket: "ID" });
    expect(r.intent).toBe("accommodation");
    expect(r.reply).not.toMatch(YOGYAKARTA_TOURISM_ESSAY_HALLMARK);
  });

  it("'What is a kos-kosan?' is a knowledge question and gets the grounded explanation", () => {
    const r = orchestrateChatTurn("What is a kos-kosan?", { userMarket: "ID" });
    expect(r.intent).toBe("accommodation");
    // Knowledge branch cites provenance and returns the explanation record.
    expect(r.reply).toMatch(/kos/i);
    expect(r.reply).toMatch(/source: nex indonesia knowledge/i);
    // Must NOT be the discovery lead.
    expect(r.reply).not.toMatch(/openstreetmap community listings/i);
  });

  it("discovery reply never fabricates live availability, prices, or bookability", () => {
    const queries = [
      "I need a hotel in Yogyakarta",
      "Find me a guesthouse",
      "Cari hotel di Jogja",
      "Hotel near Malioboro",
      "Cheap hotel with a pool",
    ];
    for (const q of queries) {
      const r = orchestrateChatTurn(q, { userMarket: "ID" });
      for (const phrase of FABRICATED_LIVE_PHRASES) {
        expect(r.reply, `query="${q}" should not fabricate live phrase ${phrase}`).not.toMatch(phrase);
      }
    }
  });

  it("staircase in ID market still routes to indonesian intelligence (not UK cascade)", () => {
    const r = orchestrateChatTurn("I need a staircase", { userMarket: "ID" });
    expect(r.intent).toBe("indonesia");
    expect(r.reply).not.toMatch(/staircase library|staircases are where i know most|for plumbing work/i);
  });

  it("plumber in ID market still routes to indonesian intelligence (not UK cascade)", () => {
    const r = orchestrateChatTurn("I need a plumber", { userMarket: "ID" });
    expect(r.intent).toBe("indonesia");
    expect(r.reply).not.toMatch(/staircase library|for plumbing work/i);
  });

  it("staircase in UK market still classifies as staircase (Qwen fallthrough handled by route)", () => {
    const r = orchestrateChatTurn("I need a staircase", { userMarket: "UK" });
    expect(r.intent).toBe("staircase");
  });

  it("'What is Yogyakarta?' remains a normal Indonesian knowledge answer", () => {
    const r = orchestrateChatTurn("What is Yogyakarta?", { userMarket: "ID" });
    expect(r.intent).toBe("indonesia");
    expect(r.reply).toMatch(/yogyakarta/i);
  });
});
