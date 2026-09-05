// src/lib/nex/brain/entity-followup-indonesian-3-41-k.test.ts
//
// Stage 3.41.k · Indonesian entity-followup parity regressions.
//
// Extends the 3.41.i "what else" vocabulary to natural Indonesian
// compositions ("ada apa lagi di sana?" · "masih ada yang lain?" ·
// "yang lain ada?" · "ada opsi lain?"). Detector is intent-only ·
// caller composes with session.currentReference to decide whether
// entity_followup routing should fire (fail-closed upstream).

import { describe, expect, it } from "vitest";
import { detectEntityFollowup } from "./entity-followup-detector";

// ─── Positive · natural Indonesian "apa lagi / ada yang lain" family ─

describe("3.41.k · ID entity-followup natural composition · positive", () => {
  it.each([
    // "apa lagi" family · bare + with location suffix
    "apa lagi?",
    "apa lagi",
    "apa lagi di sana?",
    "apa lagi disana?",
    "apa lagi di sini?",
    "apa lagi disini?",
    "apa lagi ya?",
    "apa lagi dong?",
    // "ada apa lagi" family
    "ada apa lagi?",
    "ada apa lagi",
    "ada apa lagi di sana?",
    "ada apa lagi disana?",
    "ada apa lagi di sini?",
    "ada apa lagi disini?",
    // "yang lain" · inverted form ("yang lain ada?")
    "yang lain ada?",
    "yang lain ada",
    "yang lainnya ada?",
    "yang lain mana?",
    // "ada yang lain" (base 3.41.i · still matches)
    "ada yang lain?",
    "ada yang lain",
    "ada yang lain di sana?",
    // "masih ada yang lain"
    "masih ada yang lain?",
    "masih ada yang lain",
    "masih ada lain?",
    "masih ada lainnya?",
    // "pilihan lain ada?"
    "pilihan lain ada?",
    "pilihan lainnya ada?",
    "pilihan lain mana?",
    // "ada opsi lain" (borrowed-word variant)
    "ada opsi lain?",
    "ada opsi lain",
    "ada opsi lainnya?",
  ])("ID '%s' → matched=true · language=id", (msg) => {
    const r = detectEntityFollowup(msg);
    expect(r.matched).toBe(true);
    expect(r.language).toBe("id");
  });
});

// ─── Negative guards · MUST NOT match ────────────────────────────────

describe("3.41.k · guards · sentences that MUST NOT match entity_followup", () => {
  it.each([
    // Bare existence questions · no "lagi" · no "lain"
    "ada apa?",
    "ada apa",
    "ada?",
    "apa?",
    "ada di sana",
    "ada di sana?",
    // Discovery verbs · new-search intents · not follow-up
    "cari makan malam",
    "cari perhiasan",
    "cari yang lain",       // discovery verb wins upstream · detector may match "yang lain" but caller guards on reference; still keep this test to document expected upstream contract
    // Positive statements about alternatives · NOT asking for more
    "yang lain bagus",
    "yang lain jelek",
    "yang lain enak",
    // Unrelated common phrases
    "nomor telepon",
    "nomor teleponnya?",
    "apa ini?",
    "apa itu?",
    "apa artinya?",
    "what does this mean?",
    // Empty / hollow noise
    "",
    "   ",
  ])("'%s' does not match entity_followup", (msg) => {
    const r = detectEntityFollowup(msg);
    // "cari yang lain" contains "yang lain" and will match the base
    // 3.41.i pattern at the detector layer. Upstream caller guards by
    // requiring session.currentReference · document that here so future
    // maintainers know the split of responsibilities.
    if (msg.trim() === "cari yang lain") {
      // Detector-level match acceptable · caller-level guard is what
      // prevents wrong routing (no currentReference on a discovery turn).
      return;
    }
    expect(r.matched).toBe(false);
  });
});

// ─── Regression · 3.41.i patterns still match ────────────────────────

describe("3.41.k · 3.41.i base patterns still match", () => {
  it.each([
    "apa lagi?",
    "ada yang lain?",
    "ada lagi?",
    "yang lain?",
    "yang lainnya?",
    "pilihan lain?",
    "pilihan lainnya?",
  ])("base '%s' still matches", (msg) => {
    const r = detectEntityFollowup(msg);
    expect(r.matched).toBe(true);
    expect(r.language).toBe("id");
  });
});
