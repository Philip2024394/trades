// src/lib/nex/brain/chat-translate.test.ts
//
// Stage 3.32 · Phase 25 · Chat-bubble translation (Philip 2026-08-31).
//
// Locks in the deterministic phrase-pack translator's contract:
//   · exact whole-message phrase matches translate to the canonical
//     equivalent, preserving initial capitalization + trailing punct
//   · word-level substitutions apply longest-first
//   · same-language input passes through with `reason: same_language`
//   · anything outside the pack returns verbatim with
//     `reason: no_pack_match` (honest signal · caller decides caveat)
//   · numbers, names, URLs never rewritten

import { describe, expect, it } from "vitest";
import { translateChatMessage, detectChatMessageLang } from "./chat-translate";

describe("translateChatMessage · exact whole-phrase matches", () => {
  it("Hello → Halo (capitalization preserved)", () => {
    const r = translateChatMessage({ text: "Hello", from: "en", to: "id" });
    expect(r.text).toBe("Halo");
    expect(r.translated).toBe(true);
    expect(r.reason).toBe("exact_phrase");
  });

  it("halo → hello (lowercase preserved)", () => {
    const r = translateChatMessage({ text: "halo", from: "id", to: "en" });
    expect(r.text).toBe("hello");
    expect(r.translated).toBe(true);
    expect(r.reason).toBe("exact_phrase");
  });

  it("Good morning → Selamat pagi", () => {
    const r = translateChatMessage({ text: "Good morning", from: "en", to: "id" });
    expect(r.text).toBe("Selamat pagi");
    expect(r.translated).toBe(true);
    expect(r.reason).toBe("exact_phrase");
  });

  it("Selamat pagi → Good morning", () => {
    const r = translateChatMessage({ text: "Selamat pagi", from: "id", to: "en" });
    expect(r.text).toBe("Good morning");
    expect(r.translated).toBe(true);
  });

  it("Terima kasih banyak → Thank you very much (longest match wins)", () => {
    const r = translateChatMessage({ text: "Terima kasih banyak", from: "id", to: "en" });
    expect(r.text).toBe("Thank you very much");
    expect(r.translated).toBe(true);
    expect(r.reason).toBe("exact_phrase");
  });

  it("preserves trailing punctuation on exact match", () => {
    const r = translateChatMessage({ text: "Hello!", from: "en", to: "id" });
    expect(r.text).toBe("Halo!");
    expect(r.translated).toBe(true);
  });

  it("preserves trailing question mark on exact match", () => {
    const r = translateChatMessage({ text: "How are you?", from: "en", to: "id" });
    expect(r.text).toBe("Apa kabar?");
    expect(r.translated).toBe(true);
  });
});

describe("translateChatMessage · word-level substitutions in longer sentences", () => {
  it("swaps 'thank you' inside a longer sentence", () => {
    const r = translateChatMessage({ text: "OK, thank you!", from: "en", to: "id" });
    // OK is in the pack (OK ⇄ Oke); "thank you" swaps to "terima kasih"
    expect(r.text.toLowerCase()).toContain("terima kasih");
    expect(r.translated).toBe(true);
    expect(r.reason).toBe("word_swaps");
  });

  it("swaps 'thanks' but leaves proper noun intact", () => {
    const r = translateChatMessage({ text: "Thanks, Griya Sentana!", from: "en", to: "id" });
    expect(r.text).toContain("Griya Sentana");
    expect(r.text.toLowerCase()).toContain("makasih");
    expect(r.translated).toBe(true);
  });

  it("longer phrase beats shorter overlapping phrase", () => {
    // "good morning" and "good" both exist. Longest-first ensures
    // "good morning" wins and we don't get "baik morning".
    const r = translateChatMessage({ text: "Good morning everyone", from: "en", to: "id" });
    expect(r.text.toLowerCase()).toContain("selamat pagi");
    expect(r.text.toLowerCase()).not.toContain("baik morning");
  });

  it("preserves numbers verbatim", () => {
    const r = translateChatMessage({ text: "Thank you, IDR 250,000", from: "en", to: "id" });
    expect(r.text).toContain("IDR 250,000");
    expect(r.text.toLowerCase()).toContain("terima kasih");
  });

  it("preserves URLs verbatim", () => {
    const r = translateChatMessage({ text: "Thanks, see https://nex.id", from: "en", to: "id" });
    expect(r.text).toContain("https://nex.id");
    expect(r.text.toLowerCase()).toContain("makasih");
  });
});

describe("translateChatMessage · honest boundaries", () => {
  it("same-language passes through untouched", () => {
    const r = translateChatMessage({ text: "Selamat pagi", from: "id", to: "id" });
    expect(r.text).toBe("Selamat pagi");
    expect(r.translated).toBe(false);
    expect(r.reason).toBe("same_language");
  });

  it("empty message returns no_pack_match honestly", () => {
    const r = translateChatMessage({ text: "", from: "en", to: "id" });
    expect(r.text).toBe("");
    expect(r.translated).toBe(false);
    expect(r.reason).toBe("no_pack_match");
  });

  it("out-of-pack proper noun sentence returns verbatim + no_pack_match", () => {
    const r = translateChatMessage({
      text: "Griya Sentana Jalan Prawirotaman 42",
      from: "en",
      to: "id",
    });
    // No pack entries hit · verbatim.
    expect(r.text).toBe("Griya Sentana Jalan Prawirotaman 42");
    expect(r.translated).toBe(false);
    expect(r.reason).toBe("no_pack_match");
  });

  it("gibberish returns verbatim + no_pack_match", () => {
    const r = translateChatMessage({ text: "xzqvpk", from: "en", to: "id" });
    expect(r.text).toBe("xzqvpk");
    expect(r.translated).toBe(false);
    expect(r.reason).toBe("no_pack_match");
  });
});

describe("translateChatMessage · round-trip stability for whole-phrase pack entries", () => {
  it("EN → ID → EN preserves canonical form", () => {
    const cases = [
      "Hello",
      "Good morning",
      "Thank you",
      "How are you?",
      "Yes",
      "No",
    ];
    for (const c of cases) {
      const idOut = translateChatMessage({ text: c, from: "en", to: "id" });
      const back = translateChatMessage({ text: idOut.text, from: "id", to: "en" });
      expect(back.text.toLowerCase(), `roundtrip "${c}"`).toBe(c.toLowerCase());
    }
  });
});

describe("detectChatMessageLang · direct unit tests", () => {
  it("recognises Indonesian chat markers", () => {
    expect(detectChatMessageLang("Halo, apa kabar?")).toBe("id");
    expect(detectChatMessageLang("Selamat pagi")).toBe("id");
    expect(detectChatMessageLang("Terima kasih banyak")).toBe("id");
    expect(detectChatMessageLang("Kamu dimana sekarang?")).toBe("id");
    expect(detectChatMessageLang("Saya sudah di jalan")).toBe("id");
    expect(detectChatMessageLang("Berapa harganya?")).toBe("id");
    expect(detectChatMessageLang("Tunggu sebentar")).toBe("id");
  });

  it("defaults to English for English chat messages", () => {
    expect(detectChatMessageLang("Hello, how are you?")).toBe("en");
    expect(detectChatMessageLang("Thank you very much")).toBe("en");
    expect(detectChatMessageLang("I am on my way")).toBe("en");
    expect(detectChatMessageLang("Where are you now?")).toBe("en");
    expect(detectChatMessageLang("Good morning")).toBe("en");
  });

  it("English messages containing Indonesian PLACE names still classify EN", () => {
    // Doctrine parallel to the accommodation composer: place names are
    // NOT language markers. Users routinely mention "Yogyakarta" or
    // "Malioboro" in English chat.
    expect(detectChatMessageLang("Meet me in Yogyakarta at 3pm")).toBe("en");
    expect(detectChatMessageLang("The hotel is on Malioboro street")).toBe("en");
  });
});
