// src/lib/nex/brain/conversational-function.test.ts
//
// NEX · Conversational Function classifier + gate · unit tests.
// Philip 2026-09-06 · AUTHORIZE · Conversational Function Reclassification

import { describe, it, expect } from "vitest";
import {
  classifyConversationalFunction,
  decideConversationalFunctionGate,
  familyOf,
  type ConversationalFunction,
} from "./conversational-function";

const expectFn = (msg: string, fn: ConversationalFunction) => {
  it(`"${msg}" → ${fn}`, () => {
    expect(classifyConversationalFunction(msg).function).toBe(fn);
  });
};

// ─── CORE FAILURE CASE (audit-recorded) ─────────────────────────

describe("core failure case · exact demonstrated regression", () => {
  it('"do you want to know where i am" → PERSONAL_CONTEXT_OFFER', () => {
    const d = classifyConversationalFunction("do you want to know where i am");
    expect(d.function).toBe("PERSONAL_CONTEXT_OFFER");
    expect(d.confidence).toBe("high");
  });

  it("gate fires on the exact failure case", () => {
    const d = decideConversationalFunctionGate({ userMessage: "do you want to know where i am" });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      // Reply must invite the user to provide location, not fabricate one.
      expect(d.reply.toLowerCase()).toMatch(/where|location/);
      expect(d.reply.toLowerCase()).not.toContain("yogyakarta");
      expect(d.reply.toLowerCase()).not.toContain("jakarta");
      expect(d.reply.toLowerCase()).not.toContain("bali");
      expect(d.reply.toLowerCase()).not.toContain("found 3");
      expect(d.reply.slice(-1)).toMatch(/[.?!]/);
    }
  });
});

// ─── SOCIAL_UTTERANCE (English + Indonesian) ────────────────────

describe("SOCIAL_UTTERANCE · greetings and farewells (English + Indonesian)", () => {
  expectFn("hi", "SOCIAL_UTTERANCE");
  expectFn("hello", "SOCIAL_UTTERANCE");
  expectFn("hey", "SOCIAL_UTTERANCE");
  expectFn("hi there", "SOCIAL_UTTERANCE");
  expectFn("halo", "SOCIAL_UTTERANCE");
  expectFn("hai", "SOCIAL_UTTERANCE");
  expectFn("selamat pagi", "SOCIAL_UTTERANCE");
  expectFn("selamat malam", "SOCIAL_UTTERANCE");
  expectFn("goodbye", "SOCIAL_UTTERANCE");
  expectFn("bye", "SOCIAL_UTTERANCE");
  expectFn("dadah", "SOCIAL_UTTERANCE");

  it('"how are you" → SOCIAL_UTTERANCE', () => {
    expect(classifyConversationalFunction("how are you").function).toBe("SOCIAL_UTTERANCE");
  });
  it('"apa kabar" → SOCIAL_UTTERANCE', () => {
    expect(classifyConversationalFunction("apa kabar").function).toBe("SOCIAL_UTTERANCE");
  });
});

// ─── GRATITUDE (English + Indonesian) ───────────────────────────

describe("GRATITUDE (English + Indonesian)", () => {
  expectFn("thanks", "GRATITUDE");
  expectFn("thank you", "GRATITUDE");
  expectFn("thanks nex", "GRATITUDE");
  expectFn("thanks for your help!", "GRATITUDE");
  expectFn("terima kasih", "GRATITUDE");
  expectFn("terima kasih banyak", "GRATITUDE");
  expectFn("makasih", "GRATITUDE");
  expectFn("trims", "GRATITUDE");
});

// ─── PERSONAL_CONTEXT_OFFER (multiple shapes) ───────────────────

describe("PERSONAL_CONTEXT_OFFER · offer to share personal information", () => {
  expectFn("do you want to know where i am", "PERSONAL_CONTEXT_OFFER");
  expectFn("do you want to know something", "PERSONAL_CONTEXT_OFFER");
  expectFn("would you like to know my location", "PERSONAL_CONTEXT_OFFER");
  expectFn("should I tell you where I am", "PERSONAL_CONTEXT_OFFER");
  expectFn("can I tell you something", "PERSONAL_CONTEXT_OFFER");
  expectFn("let me tell you something", "PERSONAL_CONTEXT_OFFER");
  expectFn("kamu mau tahu di mana saya", "PERSONAL_CONTEXT_OFFER");
});

// ─── PERSONAL_CONTEXT_STATEMENT (multiple shapes) ───────────────

describe("PERSONAL_CONTEXT_STATEMENT · declaring location", () => {
  expectFn("i'm in Bandung", "PERSONAL_CONTEXT_STATEMENT");
  expectFn("i'm at Malioboro", "PERSONAL_CONTEXT_STATEMENT");
  expectFn("i live in Jakarta", "PERSONAL_CONTEXT_STATEMENT");
  expectFn("i am in Yogyakarta", "PERSONAL_CONTEXT_STATEMENT");
  expectFn("i'm from Surabaya", "PERSONAL_CONTEXT_STATEMENT");
  expectFn("saya di Jakarta", "PERSONAL_CONTEXT_STATEMENT");
  expectFn("saya berada di Bandung", "PERSONAL_CONTEXT_STATEMENT");
  // Interposed discourse adverb (natural conversational shape)
  expectFn("i'm actually in Bandung", "PERSONAL_CONTEXT_STATEMENT");
  expectFn("i'm currently in Jakarta", "PERSONAL_CONTEXT_STATEMENT");
  expectFn("i'm really at Malioboro", "PERSONAL_CONTEXT_STATEMENT");
  expectFn("saya sekarang di Bandung", "PERSONAL_CONTEXT_STATEMENT");
});

// ─── META_CONVERSATION ─────────────────────────────────────────

describe("META_CONVERSATION · asking to ask, holds, etc.", () => {
  expectFn("can I ask you something", "META_CONVERSATION");
  expectFn("may I ask a question", "META_CONVERSATION");
  expectFn("wait", "META_CONVERSATION");
  expectFn("hold on", "META_CONVERSATION");
  expectFn("are you there", "META_CONVERSATION");
  expectFn("still there", "META_CONVERSATION");
  expectFn("boleh saya tanya sesuatu", "META_CONVERSATION");
  expectFn("boleh tanya", "META_CONVERSATION");
  expectFn("sebentar", "META_CONVERSATION");
  expectFn("tunggu", "META_CONVERSATION");
});

// ─── TASK_REQUEST · must NOT be misclassified ───────────────────

describe("TASK_REQUEST · imperative-shape searches must remain TASK_REQUEST", () => {
  expectFn("find me a hotel", "TASK_REQUEST");
  expectFn("find hotels near Malioboro", "TASK_REQUEST");
  expectFn("show me restaurants", "TASK_REQUEST");
  expectFn("book it", "TASK_REQUEST");
  expectFn("recommend a good stay", "TASK_REQUEST");
  expectFn("any hotels nex", "TASK_REQUEST");
  expectFn("cari hotel murah", "TASK_REQUEST");
});

// ─── INFORMATION_QUESTION · genuine info questions ──────────────

describe("INFORMATION_QUESTION · what/when/why/how/who/which questions", () => {
  expectFn("what is Yogyakarta?", "INFORMATION_QUESTION");
  expectFn("when is peak season?", "INFORMATION_QUESTION");
  expectFn("why do people visit Bali?", "INFORMATION_QUESTION");
  expectFn("how much does a hotel cost?", "INFORMATION_QUESTION");
});

// ─── RESULT_FOLLOW_UP · delegated to existing gate ──────────────

describe("RESULT_FOLLOW_UP · provenance-shape delegated · gate should NOT fire", () => {
  it('"where you find them" → RESULT_FOLLOW_UP', () => {
    expect(classifyConversationalFunction("where you find them").function).toBe("RESULT_FOLLOW_UP");
  });
  it("gate does NOT fire on result-followup shapes", () => {
    const d = decideConversationalFunctionGate({ userMessage: "where you find them" });
    expect(d.shouldGate).toBe(false);
  });
});

// ─── CONFIRMATION · very short y/n · gate does NOT fire ─────────

describe("CONFIRMATION · y/n shortforms · classified but not gated", () => {
  expectFn("yes", "CONFIRMATION");
  expectFn("no", "CONFIRMATION");
  expectFn("y", "CONFIRMATION");
  expectFn("n", "CONFIRMATION");
  expectFn("iya", "CONFIRMATION");
  expectFn("ok", "CONFIRMATION");

  it("gate does NOT fire on confirmations (existing handler)", () => {
    const d = decideConversationalFunctionGate({ userMessage: "yes" });
    expect(d.shouldGate).toBe(false);
  });
});

// ─── TOPIC_SHIFT · abandonment-detector already handles ─────────

describe("TOPIC_SHIFT · handled by abandonment-detector · gate does NOT fire", () => {
  expectFn("actually forget hotels", "TOPIC_SHIFT");
  it("gate does NOT fire on topic-shift", () => {
    const d = decideConversationalFunctionGate({ userMessage: "actually forget hotels" });
    expect(d.shouldGate).toBe(false);
  });
});

// ─── CORRECTION · existing behaviour handles ────────────────────

describe("CORRECTION · L4 · gate NOW fires (was skipped prior slice)", () => {
  expectFn("sorry I meant restaurants", "CORRECTION");
  it("gate fires on correction (L4 update: prevents stale-task re-emit)", () => {
    const d = decideConversationalFunctionGate({ userMessage: "sorry I meant restaurants" });
    expect(d.shouldGate).toBe(true);
    expect(d.detection.function).toBe("CORRECTION");
  });
});

// ─── GATE FIRE MATRIX · exactly the 5 gated functions ───────────

describe("L4 · gate fires on exactly the 8 authorized functions", () => {
  const gated: Array<[string, ConversationalFunction]> = [
    ["hi", "SOCIAL_UTTERANCE"],
    ["thanks", "GRATITUDE"],
    ["do you want to know where i am", "PERSONAL_CONTEXT_OFFER"],
    ["i'm in Bandung", "PERSONAL_CONTEXT_STATEMENT"],
    ["can I ask you something", "META_CONVERSATION"],
    // L4 additions:
    ["there are hotels here", "ASSERTION"],
    ["I love this place", "EMOTIONAL_EXPRESSION"],
    ["no I meant restaurants", "CORRECTION"],
  ];
  for (const [msg, fn] of gated) {
    it(`"${msg}" → gate fires (${fn})`, () => {
      const d = decideConversationalFunctionGate({ userMessage: msg });
      expect(d.shouldGate).toBe(true);
      expect(d.detection.function).toBe(fn);
    });
  }

  const notGated = [
    "find me a hotel",                  // TASK_REQUEST
    "what is Yogyakarta?",              // INFORMATION_QUESTION
    "where you find them",              // RESULT_FOLLOW_UP
    "yes",                              // CONFIRMATION
    "actually forget it",               // TOPIC_SHIFT (handled by abandonment-detector)
    "tell me more about the first one", // let downstream resolve
  ];
  for (const msg of notGated) {
    it(`"${msg}" → gate does NOT fire`, () => {
      const d = decideConversationalFunctionGate({ userMessage: msg });
      expect(d.shouldGate).toBe(false);
    });
  }
});

// ─── REPLY-SHAPE DISCIPLINE · voice-safe, no fabrication ────────

describe("gate reply is voice-safe · never fabricates a location", () => {
  it("PERSONAL_CONTEXT_OFFER reply invites location · never asserts one", () => {
    const d = decideConversationalFunctionGate({ userMessage: "do you want to know where i am" });
    if (!d.shouldGate) throw new Error("expected gate");
    // Assert absence of ANY city/country name that might be fabricated
    const fabricationRisk = [
      "yogyakarta", "jakarta", "bali", "bandung", "surabaya", "medan",
      "malioboro", "tokyo", "singapore", "kuala lumpur",
    ];
    for (const city of fabricationRisk) {
      expect(d.reply.toLowerCase()).not.toContain(city);
    }
  });

  it("PERSONAL_CONTEXT_STATEMENT reply acknowledges but does NOT reuse hotel-list template", () => {
    const d = decideConversationalFunctionGate({ userMessage: "i'm in Bandung" });
    if (!d.shouldGate) throw new Error("expected gate");
    expect(d.reply.toLowerCase()).not.toContain("521 real listings");
    expect(d.reply.toLowerCase()).not.toContain("found 3");
    expect(d.reply.slice(-1)).toMatch(/[.?!]/);
  });

  it("SOCIAL_UTTERANCE reply is short · no template markers", () => {
    const d = decideConversationalFunctionGate({ userMessage: "hi" });
    if (!d.shouldGate) throw new Error("expected gate");
    expect(d.reply).not.toMatch(/[{}]|\$\{/);
    expect(d.reply.length).toBeLessThan(120);
  });

  it("Indonesian gratitude reply is Indonesian", () => {
    const d = decideConversationalFunctionGate({ userMessage: "terima kasih" });
    if (!d.shouldGate) throw new Error("expected gate");
    expect(d.language).toBe("id");
    expect(d.reply.toLowerCase()).toContain("sama");
  });

  it("English gratitude reply is English", () => {
    const d = decideConversationalFunctionGate({ userMessage: "thanks" });
    if (!d.shouldGate) throw new Error("expected gate");
    expect(d.language).toBe("en");
    expect(d.reply.toLowerCase()).toContain("welcome");
  });
});

// ─── ADVERSARIAL · task-tokens present but function is social ───

describe("adversarial · social/personal function with task tokens present", () => {
  it('"do you want to know where i am" AFTER hotel search → still PERSONAL_CONTEXT_OFFER', () => {
    // Classifier is pure · doesn't depend on prior context · so context
    // cannot corrupt the classification. This is exactly what the
    // AUTHORIZE requires: current-turn meaning > stale context.
    const d = classifyConversationalFunction("do you want to know where i am");
    expect(d.function).toBe("PERSONAL_CONTEXT_OFFER");
  });

  it("stray 'hotel' inside a personal-context statement does not override the classification", () => {
    // "i'm in a hotel in Jakarta" — starts with I + preposition + place
    // → PERSONAL_CONTEXT_STATEMENT, not TASK_REQUEST.
    const d = classifyConversationalFunction("i'm in a hotel in Jakarta");
    expect(d.function).toBe("PERSONAL_CONTEXT_STATEMENT");
  });
});

// ─── L4 · ASSERTION detection (G14 protection) ──────────────────

describe("L4 · ASSERTION · existential declaratives", () => {
  expectFn("there are hotels here", "ASSERTION");
  expectFn("there is a hotel", "ASSERTION");
  expectFn("there are some nice places around here", "ASSERTION");
  expectFn("di sini ada hotel", "ASSERTION");
  expectFn("ada hotel di sini", "ASSERTION");
  expectFn("di sini ada restoran", "ASSERTION");

  it("gate fires on ASSERTION with G14-safe reply · no hotel-list reuse", () => {
    const d = decideConversationalFunctionGate({ userMessage: "there are hotels here" });
    expect(d.shouldGate).toBe(true);
    expect(d.detection.function).toBe("ASSERTION");
    if (d.shouldGate) {
      expect(d.reply.toLowerCase()).not.toContain("521 real listings");
      expect(d.reply.toLowerCase()).not.toContain("found 3");
      expect(d.reply.toLowerCase()).not.toContain("gaotama");
    }
  });
});

// ─── L4 · EMOTIONAL_EXPRESSION (G07 protection) ─────────────────

describe("L4 · EMOTIONAL_EXPRESSION · first-person emotion + evaluative", () => {
  expectFn("I love this place", "EMOTIONAL_EXPRESSION");
  expectFn("i love this", "EMOTIONAL_EXPRESSION");
  expectFn("i hate this", "EMOTIONAL_EXPRESSION");
  expectFn("i like it", "EMOTIONAL_EXPRESSION");
  expectFn("this is amazing", "EMOTIONAL_EXPRESSION");
  expectFn("that is awful", "EMOTIONAL_EXPRESSION");
  expectFn("this is great", "EMOTIONAL_EXPRESSION");
  expectFn("saya suka tempat ini", "EMOTIONAL_EXPRESSION");
  expectFn("ini keren", "EMOTIONAL_EXPRESSION");
  expectFn("itu bagus", "EMOTIONAL_EXPRESSION");

  it("gate fires on EMOTIONAL_EXPRESSION · G07-safe reply · no hotel-list reuse", () => {
    const d = decideConversationalFunctionGate({ userMessage: "I love this place" });
    expect(d.shouldGate).toBe(true);
    expect(d.detection.function).toBe("EMOTIONAL_EXPRESSION");
    if (d.shouldGate) {
      expect(d.reply.toLowerCase()).not.toContain("521 real listings");
      expect(d.reply.toLowerCase()).not.toContain("found 3");
      expect(d.reply.toLowerCase()).not.toContain("gaotama");
    }
  });
});

// ─── L4 · CORRECTION gating (English + Indonesian) ──────────────

describe("L4 · CORRECTION · gated · prevents stale-task re-emit", () => {
  expectFn("no, I meant restaurants", "CORRECTION");
  expectFn("sorry I meant restaurants", "CORRECTION");
  expectFn("sebenarnya maksud saya restoran", "CORRECTION");
  expectFn("maksud saya restoran", "CORRECTION");
  expectFn("maksudnya restoran", "CORRECTION");

  it("gate fires on CORRECTION · reply invites re-issuing the task", () => {
    const d = decideConversationalFunctionGate({ userMessage: "no, I meant restaurants" });
    expect(d.shouldGate).toBe(true);
    expect(d.detection.function).toBe("CORRECTION");
    if (d.shouldGate) {
      expect(d.reply.toLowerCase()).toMatch(/looking for|what|tell me/);
      expect(d.reply.toLowerCase()).not.toContain("521 real listings");
    }
  });

  it("Indonesian CORRECTION gates with Indonesian reply", () => {
    const d = decideConversationalFunctionGate({ userMessage: "sebenarnya maksud saya restoran" });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.language).toBe("id");
      expect(d.reply.toLowerCase()).toMatch(/mohon maaf|apa yang/);
    }
  });
});

// ─── L4 · Family taxonomy ───────────────────────────────────────

describe("L4 · dialogue-act family hierarchy", () => {
  const cases: Array<[ConversationalFunction, "SOCIAL" | "INFORMATION_EXCHANGE" | "TASK" | "OTHER"]> = [
    ["SOCIAL_UTTERANCE",           "SOCIAL"],
    ["GRATITUDE",                  "SOCIAL"],
    ["ACKNOWLEDGEMENT",            "SOCIAL"],
    ["EMOTIONAL_EXPRESSION",       "SOCIAL"],
    ["INFORMATION_QUESTION",       "INFORMATION_EXCHANGE"],
    ["ASSERTION",                  "INFORMATION_EXCHANGE"],
    ["PERSONAL_CONTEXT_OFFER",     "INFORMATION_EXCHANGE"],
    ["PERSONAL_CONTEXT_STATEMENT", "INFORMATION_EXCHANGE"],
    ["META_CONVERSATION",          "INFORMATION_EXCHANGE"],
    ["TASK_REQUEST",               "TASK"],
    ["RESULT_FOLLOW_UP",           "TASK"],
    ["CORRECTION",                 "TASK"],
    ["CLARIFICATION",              "TASK"],
    ["TOPIC_SHIFT",                "TASK"],
    ["CONFIRMATION",               "TASK"],
    ["UNCLASSIFIED",               "OTHER"],
    ["AMBIGUOUS_DIALOGUE_ACT",     "OTHER"],
  ];
  for (const [fn, fam] of cases) {
    it(`${fn} → family ${fam}`, () => {
      expect(familyOf(fn)).toBe(fam);
    });
  }
});

// ─── L4 · Frame-transition semantics ────────────────────────────

describe("L4 · frame_transition surfaced on gate decision", () => {
  it("NEW_ACT for the 5 previously-gated + 3 L4-added functions", () => {
    const gatedInputs = [
      ["hi", "SOCIAL_UTTERANCE"],
      ["thanks", "GRATITUDE"],
      ["do you want to know where i am", "PERSONAL_CONTEXT_OFFER"],
      ["i'm in Bandung", "PERSONAL_CONTEXT_STATEMENT"],
      ["can i ask you something", "META_CONVERSATION"],
      ["there are hotels here", "ASSERTION"],
      ["I love this place", "EMOTIONAL_EXPRESSION"],
      ["no I meant restaurants", "CORRECTION"],
    ] as const;
    for (const [msg] of gatedInputs) {
      const d = decideConversationalFunctionGate({ userMessage: msg });
      expect(d.frame_transition, `frame_transition for "${msg}"`).toBe("NEW_ACT");
    }
  });

  it("CONTINUATION for legitimate result-followup", () => {
    const d = decideConversationalFunctionGate({ userMessage: "where you find them" });
    expect(d.frame_transition).toBe("CONTINUATION");
  });

  it("NEW_ACT for a fresh task-request or info-question (not gated but still new)", () => {
    const d1 = decideConversationalFunctionGate({ userMessage: "find me hotels" });
    expect(d1.frame_transition).toBe("NEW_ACT");
    const d2 = decideConversationalFunctionGate({ userMessage: "what is Yogyakarta?" });
    expect(d2.frame_transition).toBe("NEW_ACT");
  });
});

// ─── L4 · Continuation protection · must NOT be misclassified ───

describe("L4 · continuation protection", () => {
  it('"tell me more about the first one" → NOT gated (ordinal continuation)', () => {
    const d = decideConversationalFunctionGate({ userMessage: "tell me more about the first one" });
    expect(d.shouldGate).toBe(false);
  });
  it('"which one is closest?" → NOT gated (result question)', () => {
    const d = decideConversationalFunctionGate({ userMessage: "which one is closest?" });
    expect(d.shouldGate).toBe(false);
  });
  it('"where you find them" → NOT gated (delegated to result-followup)', () => {
    const d = decideConversationalFunctionGate({ userMessage: "where you find them" });
    expect(d.shouldGate).toBe(false);
    expect(d.detection.function).toBe("RESULT_FOLLOW_UP");
  });
});

// ─── L4 · Indonesian representative-cases (AUTHORIZE §17) ────────

describe("L4 · Indonesian representative cases (AUTHORIZE §17)", () => {
  const cases: Array<[string, ConversationalFunction]> = [
    ["kamu mau tahu saya di mana?",                  "PERSONAL_CONTEXT_OFFER"],
    ["terima kasih",                                 "GRATITUDE"],
    ["apa kabar?",                                   "SOCIAL_UTTERANCE"],
    ["sebenarnya maksud saya restoran",              "CORRECTION"],
    ["di sini ada hotel",                            "ASSERTION"],
  ];
  for (const [msg, fn] of cases) {
    it(`"${msg}" → ${fn}`, () => {
      expect(classifyConversationalFunction(msg).function).toBe(fn);
    });
  }
});

// ─── G12 · NEGATED_REQUEST integration ──────────────────────────

describe("G12 · NEGATED_REQUEST · dialogue-act integration", () => {
  const negatedInputs: Array<[string, "NEGATED_REQUEST"]> = [
    ["I don't want a hotel",             "NEGATED_REQUEST"],
    ["I don't need a hotel",             "NEGATED_REQUEST"],
    ["I'm not looking for a hotel",      "NEGATED_REQUEST"],
    ["don't find me hotels",             "NEGATED_REQUEST"],
    ["no hotels",                        "NEGATED_REQUEST"],
    ["not a hotel -- a restaurant",      "NEGATED_REQUEST"],
    ["saya tidak mau hotel",             "NEGATED_REQUEST"],
    ["jangan cari hotel",                "NEGATED_REQUEST"],
    ["bukan hotel",                      "NEGATED_REQUEST"],
  ];
  for (const [msg, fn] of negatedInputs) {
    it(`"${msg}" → ${fn}`, () => {
      const d = classifyConversationalFunction(msg);
      expect(d.function).toBe(fn);
    });
  }

  it("gate fires on NEGATED_REQUEST with natural non-fabricating reply", () => {
    const d = decideConversationalFunctionGate({ userMessage: "I don't want a hotel" });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.reply.toLowerCase()).not.toContain("521 real listings");
      expect(d.reply.toLowerCase()).not.toContain("found 3");
      expect(d.reply.toLowerCase()).not.toContain("gaotama");
    }
  });

  it("contrastive gate surfaces the affirmed alternative", () => {
    const d = decideConversationalFunctionGate({ userMessage: "not a hotel -- a restaurant" });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.reply.toLowerCase()).toContain("restaurant");
    }
  });

  it("Indonesian NEGATED_REQUEST gates with Indonesian reply", () => {
    const d = decideConversationalFunctionGate({ userMessage: "saya tidak mau hotel" });
    expect(d.shouldGate).toBe(true);
    if (d.shouldGate) {
      expect(d.language).toBe("id");
      expect(d.reply.toLowerCase()).toMatch(/batalkan|gantinya|cocok/);
    }
  });

  // Scope-trap tests · these must NOT be NEGATED_REQUEST (they may
  // still fire other gates like GRATITUDE for "no thanks" — that's fine,
  // the requirement is only that they aren't misclassified as a search
  // rejection).
  const notNegated: Array<[string, string]> = [
    ["I want a hotel that's not expensive",         "AFFIRMATIVE / ATTRIBUTE · entity affirmed"],
    ["I don't want the first one",                  "NEGATED / RESULT · task still active"],
    ["don't you have any hotels?",                  "NEGATED / QUESTION · rhetorical"],
    ["no thanks",                                    "NEGATED / SOCIAL · not a rejection"],
    ["I don't know",                                 "NEGATED / SOCIAL"],
    ["which hotels don't have parking?",             "NEGATED / QUESTION"],
  ];
  for (const [msg, note] of notNegated) {
    it(`SCOPE TRAP · "${msg}" (${note}) → not NEGATED_REQUEST`, () => {
      const d = decideConversationalFunctionGate({ userMessage: msg });
      expect(d.detection.function).not.toBe("NEGATED_REQUEST");
    });
  }

  // The scope traps that must NOT fire ANY gate (require full downstream reasoning)
  const mustNotGate: Array<[string, string]> = [
    ["I want a hotel that's not expensive",  "attribute-negation · hotel search must proceed"],
    ["I don't want the first one",            "result-context · task still active"],
    ["don't you have any hotels?",            "rhetorical question"],
    ["which hotels don't have parking?",      "attribute question"],
  ];
  for (const [msg, note] of mustNotGate) {
    it(`SCOPE TRAP · "${msg}" (${note}) → gate does NOT fire`, () => {
      const d = decideConversationalFunctionGate({ userMessage: msg });
      expect(d.shouldGate).toBe(false);
    });
  }

  it("polarity is surfaced on every FunctionDetection", () => {
    const d = classifyConversationalFunction("I want a hotel");
    expect(d.polarity).toBeDefined();
    expect(d.polarity.polarity).toBe("AFFIRMATIVE");
  });

  it("frame_transition for NEGATED_REQUEST is NEW_ACT", () => {
    const d = decideConversationalFunctionGate({ userMessage: "I don't want a hotel" });
    expect(d.frame_transition).toBe("NEW_ACT");
  });
});

// ─── L4 preservation after G12 additions ────────────────────────

describe("L4 preservation · dialogue-act classes still correct after G12", () => {
  it("'find me a hotel' still classifies as TASK_REQUEST (not NEGATED_REQUEST)", () => {
    expect(classifyConversationalFunction("find me a hotel").function).toBe("TASK_REQUEST");
  });
  it("'no, I meant restaurants' still classifies as CORRECTION (not NEGATED_REQUEST)", () => {
    // 'no' is a negation trigger but the scope-resolver falls to NONE
    // (unresolvable), which does NOT gate. Then existing CORRECTION
    // detection via 'meant' fires.
    expect(classifyConversationalFunction("no, I meant restaurants").function).toBe("CORRECTION");
  });
  it("'there are hotels here' still classifies as ASSERTION (not NEGATED_REQUEST)", () => {
    expect(classifyConversationalFunction("there are hotels here").function).toBe("ASSERTION");
  });
});

// ─── DEGENERATE INPUTS ──────────────────────────────────────────

describe("degenerate inputs", () => {
  it("empty message → UNCLASSIFIED", () => {
    const d = classifyConversationalFunction("");
    expect(d.function).toBe("UNCLASSIFIED");
  });
  it("only whitespace → UNCLASSIFIED", () => {
    expect(classifyConversationalFunction("   ").function).toBe("UNCLASSIFIED");
  });
  it("unclassified sequence → gate does NOT fire", () => {
    const d = decideConversationalFunctionGate({ userMessage: "" });
    expect(d.shouldGate).toBe(false);
  });
});
