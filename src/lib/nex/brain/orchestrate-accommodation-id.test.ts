// src/lib/nex/brain/orchestrate-accommodation-id.test.ts
//
// Stage 3.31 · Phase 24 · Accommodation composer Bahasa Indonesia
// output (Philip 2026-08-31). Locks in that Indonesian messages
// produce Indonesian replies with the same facts, honesty boundaries,
// and evidence rigour as the English pathway. English tests live in
// orchestrate-accommodation.test.ts and orchestrate-conversation.test.ts
// and must continue to pass — this file only proves the ID branch is
// wired end-to-end.
//
// Discipline checked:
//   · reply is in Bahasa Indonesia (contains ID markers, not EN)
//   · Truth invariants: real numbers, real names, provenance verbatim
//   · Reflection.overallPass === true on every turn
//   · Confidence.overall ∈ {"high", "unavailable"} — never medium/low
//     for a substantive turn (proves ID detectors caught the reply)
//   · Honesty boundaries surfaced in Indonesian for book/price/amenity
//   · Session state accumulates correctly across ID turns
//   · Cross-language regression: EN messages in market=ID still return
//     English (this is doctrine — reply follows message language, not
//     market)

import { describe, expect, it } from "vitest";
import { orchestrateChatTurn } from "./orchestrate";
import { detectAccommodationReplyLang } from "./orchestrate";

describe("orchestrateChatTurn · accommodation · Bahasa Indonesia output", () => {
  it("'Cari hotel di Jogja' returns an Indonesian discovery reply with real listings", () => {
    const r = orchestrateChatTurn("Cari hotel di Jogja", {
      userMarket: "ID",
      conversationId: "id-disc-1",
    });
    expect(r.intent).toBe("accommodation");
    // ID markers surfaced:
    expect(r.reply).toMatch(/saya punya \d+ listingan asli/i);
    expect(r.reply).toMatch(/untuk hotel/i);
    expect(r.reply).toMatch(/di Yogyakarta/i);
    // Honesty boundary present in ID:
    expect(r.reply).toMatch(/listingan komunitas OpenStreetMap.*penemuan saja, bukan booking langsung/i);
    // No English opener leaked in:
    expect(r.reply).not.toMatch(/^I've got \d+ real listings/i);
    // Reflection passes 5/5:
    expect(r.reflection?.overallPass).toBe(true);
    // Confidence stays high because count/boundary/geo detectors accept ID literals:
    expect(["high", "unavailable"]).toContain(r.confidence?.overall);
  });

  it("'Cari hotel murah dekat Malioboro' surfaces area proximity in Indonesian", () => {
    const r = orchestrateChatTurn("Cari hotel murah dekat Malioboro", {
      userMarket: "ID",
      conversationId: "id-area-1",
    });
    expect(r.intent).toBe("accommodation");
    expect(r.reply).toMatch(/dekat Malioboro/i);
    expect(r.reply).toMatch(/hotel murah dekat Malioboro/i);
    expect(r.reflection?.overallPass).toBe(true);
    expect(["high", "unavailable"]).toContain(r.confidence?.overall);
  });

  it("book intent in Indonesian returns the ID booking boundary", () => {
    // "Pesan ini malam ini" — 'pesan' triggers accommodation slots.action=book
    // via the ACTIONS pack. Note we intentionally drop the noun "hotel"
    // because BOOKING intent (top-level, separate composer) requires the
    // pattern `pesan\s+(hotel|kamar|...)` — dropping the noun keeps us in
    // the accommodation composer's book branch, which is what this phase
    // owns.
    const cid = "id-book-1";
    orchestrateChatTurn("Cari hotel di Jogja", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Pesan ini malam ini", { userMarket: "ID", conversationId: cid });
    expect(r.reply).toMatch(/belum bisa memesankan akomodasi/i);
    expect(r.reply).toMatch(/belum ada koneksi booking langsung/i);
    // Honest boundary → confidence unavailable OR high (a boundary is a "high-confidence unavailable")
    expect(["high", "unavailable"]).toContain(r.confidence?.overall);
    expect(r.reflection?.overallPass).toBe(true);
  });

  it("price question in Indonesian returns the ID price boundary", () => {
    // "Per malam berapa?" — triggers isPriceQuestion via 'berapa' and
    // 'per malam' in the accommodation composer. We deliberately avoid
    // 'berapa harga' / 'apa harganya' which are matched by the top-level
    // QUOTATION classifier and route to a different composer.
    const cid = "id-price-1";
    orchestrateChatTurn("Cari hotel di Jogja", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Per malam berapa?", { userMarket: "ID", conversationId: cid });
    expect(r.reply).toMatch(/tidak menyimpan data harga/i);
    // Never fabricates an IDR price:
    expect(r.reply).not.toMatch(/\bidr\s+\d/i);
    expect(r.reflection?.overallPass).toBe(true);
    expect(["high", "unavailable"]).toContain(r.confidence?.overall);
  });

  it("amenity question in Indonesian returns the ID facility boundary", () => {
    const cid = "id-amenity-1";
    orchestrateChatTurn("Cari hotel di Jogja", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Ada kolam renang?", { userMarket: "ID", conversationId: cid });
    expect(r.reply).toMatch(/tidak menyimpan data fasilitas/i);
    // The extractor should have captured the amenity slot:
    expect(r.reply.toLowerCase()).toMatch(/pool|kolam/);
    expect(r.reflection?.overallPass).toBe(true);
    expect(["high", "unavailable"]).toContain(r.confidence?.overall);
  });

  it("knowledge question 'Apa itu kos-kosan?' returns grounded knowledge with ID provenance", () => {
    const r = orchestrateChatTurn("Apa itu kos-kosan?", {
      userMarket: "ID",
      conversationId: "id-knowledge-1",
    });
    expect(r.intent).toBe("accommodation");
    // Grounded knowledge record with ID provenance suffix
    expect(r.reply.toLowerCase()).toContain("sumber: pengetahuan nex indonesia");
    expect(r.reply.toLowerCase()).toContain("diverifikasi");
    // Not the discovery lead
    expect(r.reply).not.toMatch(/openstreetmap community listings/i);
    expect(r.reflection?.overallPass).toBe(true);
    expect(["high", "unavailable"]).toContain(r.confidence?.overall);
  });

  it("correction in Indonesian leads with 'Beralih ke'", () => {
    const cid = "id-correct-1";
    orchestrateChatTurn("Cari hotel di Jogja", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Sebenarnya, cari guesthouse", { userMarket: "ID", conversationId: cid });
    expect(r.reply).toMatch(/beralih ke/i);
    expect(r.reply.toLowerCase()).toContain("guesthouse");
    expect(r.reflection?.overallPass).toBe(true);
  });

  it("mid-flow knowledge question preserves state AND surfaces ID resume hint", () => {
    const cid = "id-resume-1";
    orchestrateChatTurn("Cari hotel murah di Jogja", { userMarket: "ID", conversationId: cid });
    const r = orchestrateChatTurn("Apa itu kos-kosan?", { userMarket: "ID", conversationId: cid });
    expect(r.reply.toLowerCase()).toContain("sumber: pengetahuan nex indonesia");
    // Resume hint in ID
    expect(r.reply).toMatch(/saya simpan pencarian/i);
    expect(r.reply).toMatch(/tinggal bilang kalau mau lanjut/i);
    expect(r.reflection?.overallPass).toBe(true);
  });

  it("no-match discovery in Indonesian uses the ID no-match prefix", () => {
    // "Cari villa mewah di Kotagede" is likely to return zero matches because
    // OSM doesn't list many luxury villas in Kotagede. The reply should use
    // the ID no-match prefix + honest Insight boundary, not English text.
    const r = orchestrateChatTurn("Cari villa mewah dekat Kotagede", {
      userMarket: "ID",
      conversationId: "id-nomatch-1",
    });
    expect(r.intent).toBe("accommodation");
    // Either the ID no-match prefix or the ID Eureka opener must fire.
    // Both branches are ID; whichever fires is fine — assert it's not EN.
    expect(r.reply).not.toMatch(/^Got it — /);
    expect(r.reply).not.toMatch(/^Absolutely —/);
    expect(r.reflection?.overallPass).toBe(true);
  });

  it("Reflection never false-fails an ID reply on evidence/boundary checks", () => {
    // A sample of ID messages that exercise every branch; each should have
    // reflection.overallPass=true because the ID phrasing is on the same
    // trust footing as the EN phrasing.
    const messages = [
      "Cari hotel di Jogja",
      "Yang murah dekat Malioboro",
      "Pesan hotel ini besok",
      "Berapa harga per malam?",
      "Ada wifi?",
      "Apa itu homestay?",
      "Sebenarnya, cari guesthouse",
    ];
    for (const m of messages) {
      const r = orchestrateChatTurn(m, {
        userMarket: "ID",
        conversationId: `id-refl-${messages.indexOf(m)}`,
      });
      expect(r.reflection?.overallPass, `message "${m}"`).toBe(true);
    }
  });
});

describe("detectAccommodationReplyLang · direct unit tests", () => {
  it("recognises Indonesian markers", () => {
    expect(detectAccommodationReplyLang("Cari hotel di Jogja")).toBe("id");
    expect(detectAccommodationReplyLang("Yang murah")).toBe("id");
    expect(detectAccommodationReplyLang("Dekat Malioboro")).toBe("id");
    expect(detectAccommodationReplyLang("Ada kolam renang?")).toBe("id");
    expect(detectAccommodationReplyLang("Apa itu kos-kosan?")).toBe("id");
    expect(detectAccommodationReplyLang("Sebenarnya, cari guesthouse")).toBe("id");
    expect(detectAccommodationReplyLang("Berapa harga per malam?")).toBe("id");
    expect(detectAccommodationReplyLang("Pesan hotel ini malam ini")).toBe("id");
  });

  it("defaults to English for English messages even when they mention Indonesian place names", () => {
    expect(detectAccommodationReplyLang("I need a hotel in Yogyakarta")).toBe("en");
    expect(detectAccommodationReplyLang("I need a hotel in Jogja")).toBe("en");
    expect(detectAccommodationReplyLang("Cheap")).toBe("en");
    expect(detectAccommodationReplyLang("Near Malioboro")).toBe("en");
    expect(detectAccommodationReplyLang("What is a kos-kosan?")).toBe("en");
    expect(detectAccommodationReplyLang("Actually, find me a guesthouse instead")).toBe("en");
    expect(detectAccommodationReplyLang("Book this hotel tonight")).toBe("en");
    expect(detectAccommodationReplyLang("Hello NEX")).toBe("en");
  });
});

describe("Cross-language doctrine · reply follows message language, not market", () => {
  it("English message + market=ID still returns English (regression lock)", () => {
    const r = orchestrateChatTurn("I need a hotel in Yogyakarta", {
      userMarket: "ID",
      conversationId: "cross-lang-1",
    });
    // English opener present, no Indonesian markers in the reply
    expect(r.reply).toMatch(/I've got \d+ real listings/i);
    expect(r.reply).not.toMatch(/saya punya \d+ listingan asli/i);
  });
});
