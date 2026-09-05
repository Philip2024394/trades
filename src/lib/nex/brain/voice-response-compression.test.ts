// src/lib/nex/brain/voice-response-compression.test.ts
// Wave 3 · Capabilities E, F · unit tests
// Philip 2026-09-06 · AUTHORIZE · WAVE 3

import { describe, it, expect } from "vitest";
import { compressForVoice } from "./voice-response-compression";

describe("compressForVoice · preservation invariants (§9)", () => {
  it("preserves 'don't have verified' uncertainty", () => {
    const original = "I don't have verified booking access for these listings through NEX yet, so I don't want to say I can when I can't confirm it.";
    const r = compressForVoice(original);
    expect(r.compressed).toContain("don't have verified");
    expect(r.compressed).toContain("can't confirm");
    expect(r.meaning_preserved).toBe(true);
  });

  it("preserves evidence boundary", () => {
    const original = "I haven't shown you any results yet in this conversation. Want me to find some?";
    const r = compressForVoice(original);
    expect(r.compressed.toLowerCase()).toContain("haven't shown");
    expect(r.meaning_preserved).toBe(true);
  });

  it("preserves the SOURCE ≠ CAPABILITY provenance reply", () => {
    const original = "I found them through NEX's accommodation directory for the area. Some of the underlying listing information was contributed via OpenStreetMap.";
    const r = compressForVoice(original);
    expect(r.compressed.toLowerCase()).toContain("openstreetmap");
    expect(r.compressed.toLowerCase()).toContain("accommodation");
  });

  it("preserves capability distinction language", () => {
    const original = "I don't mean the listings themselves can't be booked. I mean NEX doesn't have verified booking access for these yet.";
    const r = compressForVoice(original);
    expect(r.compressed.toLowerCase()).toContain("book");
    expect(r.compressed).toContain("verified");
  });

  it("preserves Indonesian evidence boundaries", () => {
    const original = "Saya belum menampilkan hasil apa pun di percakapan ini. Ingin saya cari sesuatu untuk Anda?";
    const r = compressForVoice(original);
    expect(r.compressed).toContain("belum menampilkan");
  });
});

describe("compressForVoice · safe reductions", () => {
  it("strips redundant intros like 'Alright,'", () => {
    const original = "Alright, here are 5 hotels I found: Griya Sentana, Hotel Trim Tiga, Asia Afrika, One More, Two More.";
    const r = compressForVoice(original);
    expect(r.compressed.startsWith("Alright")).toBe(false);
  });

  it("removes markdown artefacts", () => {
    const original = "**Sure** — here are the results\n\n- Hotel A\n- Hotel B";
    const r = compressForVoice(original);
    expect(r.compressed).not.toContain("**");
  });

  it("deduplicates identical sentences", () => {
    const original = "Here are the hotels. Here are the hotels.";
    const r = compressForVoice(original);
    expect(r.metrics.removed_markers).toContain("duplicate_sentence");
  });

  it("truncates lists longer than 5 items", () => {
    const original = "Try these: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel.";
    const r = compressForVoice(original);
    // Long list should be truncated with "and N more"
    expect(r.compressed.toLowerCase()).toMatch(/and \d+ more/);
  });
});

describe("compressForVoice · never removes semantic content", () => {
  it("never drops a sentence containing a preservation marker", () => {
    const original = "I don't have verified booking access. Would you like me to search?";
    const r = compressForVoice(original);
    expect(r.compressed).toContain("don't have verified");
  });

  it("reverts to the original if a change would drop a preservation marker", () => {
    // Craft a case where a hypothetical rule would drop uncertainty
    const original = "Not verified. Not verified. Great.";
    const r = compressForVoice(original);
    // dedup may keep only 1 · but "Not verified" must remain at least once
    expect(r.compressed).toContain("Not verified");
    expect(r.meaning_preserved).toBe(true);
  });

  it("is a no-op on empty input", () => {
    const r = compressForVoice("");
    expect(r.compressed).toBe("");
    expect(r.meaning_preserved).toBe(true);
  });

  it("is a no-op on short honest replies (no redundancy to strip)", () => {
    const original = "I don't have verified booking access.";
    const r = compressForVoice(original);
    expect(r.compressed).toBe(original);
  });
});

describe("compressForVoice · metrics", () => {
  it("reports non-negative reduction when changes happen", () => {
    const original = "Alright, here are five hotels: Alpha, Bravo, Charlie, Delta, Echo, Foxtrot, Golf, Hotel, India, Juliet.";
    const r = compressForVoice(original);
    expect(r.metrics.reduction_pct).toBeGreaterThanOrEqual(0);
    expect(r.metrics.compressed_length).toBeLessThanOrEqual(r.metrics.original_length);
  });

  it("reports 0% reduction and identical compressed text when meaning would be lost", () => {
    const original = "I don't have verified booking access.";
    const r = compressForVoice(original);
    expect(r.metrics.reduction_pct).toBe(0);
  });
});
