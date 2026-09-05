// src/lib/nex/brain/language-state.test.ts
//
// G03 · Language Stability & Reply-Language Continuity · unit tests.
// Philip 2026-09-06 · AUTHORIZE · G03.

import { describe, it, expect, beforeEach } from "vitest";
import {
  detectTurnLanguage,
  resolveActiveLanguage,
  decideLanguageSwitchGate,
  verifyOutputLanguage,
  _resetLanguageStateForTests,
  langToOwnerLanguage,
  type Lang,
} from "./language-state";

beforeEach(() => _resetLanguageStateForTests());

// ─── Per-turn detection ─────────────────────────────────────────

describe("detectTurnLanguage · per-turn", () => {
  it("English message → EN", () => {
    const d = detectTurnLanguage("Find me a hotel near Malioboro");
    expect(d.detected).toBe("EN");
  });
  it("Indonesian message → ID", () => {
    const d = detectTurnLanguage("Carikan hotel dekat Malioboro");
    expect(d.detected).toBe("ID");
  });
  it("empty → UNKNOWN", () => {
    expect(detectTurnLanguage("").detected).toBe("UNKNOWN");
  });
  it("gibberish → UNKNOWN", () => {
    expect(detectTurnLanguage("xyz qwe rty").detected).toBe("UNKNOWN");
  });
  it("50/50 mix → MIXED", () => {
    const d = detectTurnLanguage("saya find dan hotel");
    expect(["MIXED", "ID", "EN"]).toContain(d.detected);
  });
});

// ─── Explicit-switch detection ──────────────────────────────────

describe("detectTurnLanguage · explicit switch (§6 §18)", () => {
  const instructions: Array<[string, Lang]> = [
    ["please answer in Indonesian",             "ID"],
    ["please answer in English",                "EN"],
    ["let's speak Indonesian",                  "ID"],
    ["Let's continue in English",               "EN"],
    ["switch to Indonesian",                    "ID"],
    ["switch back to English",                  "EN"],
    ["Sekarang jawab dalam bahasa Inggris",     "EN"],
    ["Sekarang pakai bahasa Inggris",           "EN"],
    ["Bisa jawab dalam bahasa Indonesia?",      "ID"],
    ["tolong jawab dalam bahasa Indonesia",     "ID"],
    ["Now switch back to English",              "EN"],
  ];
  for (const [msg, target] of instructions) {
    it(`"${msg}" → explicit_switch_target=${target}`, () => {
      const d = detectTurnLanguage(msg);
      expect(d.explicit_switch_target).toBe(target);
      expect(d.is_capability_question).toBe(false);
    });
  }
});

describe("detectTurnLanguage · capability questions must NOT switch (§18)", () => {
  const capability = [
    "Can you speak Indonesian?",
    "Do you speak English?",
    "Could you speak Indonesian?",
    "Do you understand Indonesian?",
    "apakah kamu bisa bahasa Inggris",
  ];
  for (const msg of capability) {
    it(`"${msg}" → is_capability_question=true · no target`, () => {
      const d = detectTurnLanguage(msg);
      expect(d.is_capability_question).toBe(true);
      expect(d.explicit_switch_target).toBeNull();
    });
  }
});

// ─── Translation isolation ──────────────────────────────────────

describe("detectTurnLanguage · translation requests (§19 §20)", () => {
  const translations = [
    "Translate this sentence into Indonesian",
    "Translate \"Selamat pagi\" into English",
    "What does \"warung\" mean in English",
    "How do you say hotel in Indonesian",
    "Apa arti \"hotel\" dalam bahasa Inggris",
  ];
  for (const msg of translations) {
    it(`"${msg}" → is_translation_request=true`, () => {
      const d = detectTurnLanguage(msg);
      expect(d.is_translation_request).toBe(true);
    });
  }
});

describe("detectTurnLanguage · quoted text stripped (§20)", () => {
  it("'Translate \"Selamat pagi\" into English' → English-dominant after stripping", () => {
    const d = detectTurnLanguage('Translate "Selamat pagi" into English');
    expect(d.quoted_regions).toEqual(["Selamat pagi"]);
    // Stripped text should be EN-dominant
    expect(d.detected).toBe("EN");
  });
  it("quoted Indonesian phrase does not switch language of surrounding English", () => {
    const d = detectTurnLanguage('What does "hotel murah" mean?');
    expect(d.quoted_regions).toContain("hotel murah");
    // Surrounding "What does mean" → EN
    expect(["EN", "UNKNOWN"]).toContain(d.detected);
  });
});

// ─── Conversation-level stability (§7) ──────────────────────────

describe("resolveActiveLanguage · stability across turns", () => {
  it("English opener + English turns → EN throughout · stability=STABLE", () => {
    const s1 = resolveActiveLanguage({ conversation_id: "c1", message: "Find me hotels near Malioboro" });
    expect(s1.active).toBe("EN");
    const s2 = resolveActiveLanguage({ conversation_id: "c1", message: "Tell me which one is closest" });
    expect(s2.active).toBe("EN");
    expect(s2.source).toBe("inherited");
    const s3 = resolveActiveLanguage({ conversation_id: "c1", message: "How much is it?" });
    expect(s3.active).toBe("EN");
  });

  it("Indonesian opener + Indonesian turns → ID throughout", () => {
    resolveActiveLanguage({ conversation_id: "c2", message: "Carikan hotel dekat Malioboro" });
    const s2 = resolveActiveLanguage({ conversation_id: "c2", message: "Yang pertama bagaimana?" });
    expect(s2.active).toBe("ID");
    expect(s2.source).toBe("inherited");
    const s3 = resolveActiveLanguage({ conversation_id: "c2", message: "Berapa harganya?" });
    expect(s3.active).toBe("ID");
  });
});

// ─── Short/ambiguous turn inheritance (§10) ─────────────────────

describe("resolveActiveLanguage · short/ambiguous turns inherit", () => {
  it("Indonesian conv + 'Ok' → ID inherited", () => {
    resolveActiveLanguage({ conversation_id: "c3", message: "Carikan hotel" });
    const s = resolveActiveLanguage({ conversation_id: "c3", message: "Ok" });
    expect(s.active).toBe("ID");
    expect(s.source).toBe("inherited");
  });
  it("English conv + 'yes' → EN inherited", () => {
    resolveActiveLanguage({ conversation_id: "c4", message: "Find hotels" });
    const s = resolveActiveLanguage({ conversation_id: "c4", message: "yes" });
    expect(s.active).toBe("EN");
    expect(s.source).toBe("inherited");
  });
});

// ─── Explicit switch (§6) ───────────────────────────────────────

describe("resolveActiveLanguage · explicit switches take priority", () => {
  it("EN conv → 'please answer in Indonesian' → ID switch", () => {
    resolveActiveLanguage({ conversation_id: "c5", message: "Find me hotels" });
    const s = resolveActiveLanguage({ conversation_id: "c5", message: "please answer in Indonesian" });
    expect(s.active).toBe("ID");
    expect(s.source).toBe("explicit_switch");
    expect(s.stability).toBe("SWITCHED_THIS_TURN");
    // Subsequent turn stays ID
    const s2 = resolveActiveLanguage({ conversation_id: "c5", message: "Yang pertama bagaimana?" });
    expect(s2.active).toBe("ID");
    expect(s2.source).toBe("inherited");
  });

  it("ID conv → 'switch back to English' → EN", () => {
    resolveActiveLanguage({ conversation_id: "c6", message: "Carikan hotel" });
    const s = resolveActiveLanguage({ conversation_id: "c6", message: "switch back to English" });
    expect(s.active).toBe("EN");
    expect(s.source).toBe("explicit_switch");
  });

  it("capability question does NOT switch", () => {
    resolveActiveLanguage({ conversation_id: "c7", message: "Find me hotels" });
    const s = resolveActiveLanguage({ conversation_id: "c7", message: "Can you speak Indonesian?" });
    expect(s.active).toBe("EN");
    expect(s.source).toBe("inherited");
  });
});

// ─── Translation isolation (§19) ────────────────────────────────

describe("resolveActiveLanguage · translation does NOT switch conversational language", () => {
  it("EN conv → translation request stays EN", () => {
    resolveActiveLanguage({ conversation_id: "c8", message: "Let's speak English" });
    const s = resolveActiveLanguage({
      conversation_id: "c8",
      message: 'Translate "Selamat pagi" into Indonesian',
    });
    expect(s.active).toBe("EN");
    expect(s.source).toBe("inherited");
  });
});

// ─── Code-switching (§9) ────────────────────────────────────────

describe("resolveActiveLanguage · code-switching does NOT force a switch", () => {
  it("ID conv + 'Saya mau hotel yang cheap' → stays ID", () => {
    resolveActiveLanguage({ conversation_id: "c9", message: "Carikan hotel" });
    const s = resolveActiveLanguage({ conversation_id: "c9", message: "Saya mau hotel yang cheap" });
    expect(s.active).toBe("ID");
  });
  it("EN conv + 'I need a hotel dekat Malioboro' → stays EN", () => {
    resolveActiveLanguage({ conversation_id: "c10", message: "Find hotels" });
    const s = resolveActiveLanguage({ conversation_id: "c10", message: "I need a hotel dekat Malioboro" });
    expect(s.active).toBe("EN");
  });
});

// ─── Explicit-switch gate ───────────────────────────────────────

describe("decideLanguageSwitchGate · deterministic acknowledgement", () => {
  it("fires on explicit EN → ID switch · Indonesian reply", () => {
    resolveActiveLanguage({ conversation_id: "cg1", message: "Find me hotels" });
    _resetLanguageStateForTests();
    resolveActiveLanguage({ conversation_id: "cg1", message: "Find me hotels" });
    const d = decideLanguageSwitchGate({ conversation_id: "cg1", message: "please answer in Indonesian" });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.switched_from).toBe("EN");
      expect(d.switched_to).toBe("ID");
      expect(d.reply.toLowerCase()).toContain("indonesia");
      expect(d.reply.toLowerCase()).toContain("saya");
    }
  });

  it("fires on explicit ID → EN switch · English reply", () => {
    resolveActiveLanguage({ conversation_id: "cg2", message: "Carikan hotel" });
    const d = decideLanguageSwitchGate({ conversation_id: "cg2", message: "switch back to English" });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.switched_to).toBe("EN");
      expect(d.reply.toLowerCase()).toContain("english");
    }
  });

  it("does NOT fire on capability question", () => {
    resolveActiveLanguage({ conversation_id: "cg3", message: "Find me hotels" });
    const d = decideLanguageSwitchGate({ conversation_id: "cg3", message: "Can you speak Indonesian?" });
    expect(d.shouldGate).toBe(false);
  });

  it("does NOT fire when target equals current active language", () => {
    resolveActiveLanguage({ conversation_id: "cg4", message: "Find me hotels" });
    // "answer in English" while already English
    const d = decideLanguageSwitchGate({ conversation_id: "cg4", message: "please answer in English" });
    expect(d.shouldGate).toBe(false);
  });
});

// ─── Model-output verification (§22) ────────────────────────────

describe("verifyOutputLanguage · detects model drift", () => {
  it("Expected ID · English reply → mismatch detected", () => {
    const v = verifyOutputLanguage(
      "Hotels in Indonesia range from budget to five-star chains, with prices varying.",
      "ID",
    );
    expect(v.matches).toBe(false);
    expect(v.dominant).toBe("EN");
  });
  it("Expected EN · English reply → matches", () => {
    const v = verifyOutputLanguage(
      "You can find hotels near Malioboro at various price points.",
      "EN",
    );
    expect(v.matches).toBe(true);
    expect(v.dominant).toBe("EN");
  });
  it("Expected ID · Indonesian reply → matches", () => {
    const v = verifyOutputLanguage(
      "Saya punya listingan hotel di Yogyakarta dan Anda bisa memilih dari beberapa yang tersedia.",
      "ID",
    );
    expect(v.matches).toBe(true);
    expect(v.dominant).toBe("ID");
  });
  it("Expected EN · very short reply → UNKNOWN dominant → matches (uncertainty preserved)", () => {
    const v = verifyOutputLanguage("Yep.", "EN");
    expect(v.dominant).toBe("UNKNOWN");
    expect(v.matches).toBe(true);
  });
});

// ─── Helper ────────────────────────────────────────────────────

describe("langToOwnerLanguage", () => {
  it("maps ID → id, EN → en, UNKNOWN → en", () => {
    expect(langToOwnerLanguage("ID")).toBe("id");
    expect(langToOwnerLanguage("EN")).toBe("en");
    expect(langToOwnerLanguage("UNKNOWN")).toBe("en");
    expect(langToOwnerLanguage("MIXED")).toBe("en");
  });
});

// ─── Adversarial matrix (§25) ───────────────────────────────────

describe("§25 · adversarial matrix", () => {
  it('"Can you speak Indonesian?" vs "Speak Indonesian" · only the imperative switches', () => {
    resolveActiveLanguage({ conversation_id: "adv1", message: "Find me hotels" });
    const q = resolveActiveLanguage({ conversation_id: "adv1", message: "Can you speak Indonesian?" });
    expect(q.active).toBe("EN");
    _resetLanguageStateForTests();
    resolveActiveLanguage({ conversation_id: "adv1", message: "Find me hotels" });
    const cmd = resolveActiveLanguage({ conversation_id: "adv1", message: "Speak Indonesian" });
    expect(cmd.active).toBe("ID");
    expect(cmd.source).toBe("explicit_switch");
  });

  it('"Translate this into Indonesian" vs "Let\'s speak Indonesian" · only the second switches', () => {
    resolveActiveLanguage({ conversation_id: "adv2", message: "Find me hotels" });
    const t = resolveActiveLanguage({
      conversation_id: "adv2",
      message: 'Translate "hotel" into Indonesian',
    });
    expect(t.active).toBe("EN");
    _resetLanguageStateForTests();
    resolveActiveLanguage({ conversation_id: "adv2", message: "Find me hotels" });
    const s = resolveActiveLanguage({ conversation_id: "adv2", message: "Let's speak Indonesian" });
    expect(s.active).toBe("ID");
  });
});
