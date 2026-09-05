// src/lib/nex/brain/social-emotional.test.ts
// Wave 3 · Capabilities C, D · unit tests
// Philip 2026-09-06 · AUTHORIZE · WAVE 3

import { describe, it, expect } from "vitest";
import {
  classifySocialEmotional,
  decideSocialEmotionalGate,
} from "./social-emotional";
import type { SessionState } from "./session";

function emptySession(): SessionState {
  return { session_id: "s", conversation_id: "c", entities: [] } as unknown as SessionState;
}
function sessionWithHotels(): SessionState {
  return {
    session_id: "s", conversation_id: "c",
    entities: [
      { kind: "business_name", raw: "Hotel A", canonical: "hotel a", refId: "place:accommodation:1", source: "nex_reply", firstSeenAtIso: "", lastSeenAtIso: "" },
    ],
  } as unknown as SessionState;
}
function sessionWithNexQuestion(q: string): SessionState {
  return {
    session_id: "s", conversation_id: "c", entities: [],
    lastNexQuestion: q,
  } as unknown as SessionState;
}

describe("classifySocialEmotional · EMOTIONAL_REACTION", () => {
  it("catches 'wow'", () => {
    const d = classifySocialEmotional("wow");
    expect(d.act).toBe("EMOTIONAL_REACTION");
    expect(d.emotion).toBe("SURPRISE");
  });
  it("catches 'nice'", () => {
    const d = classifySocialEmotional("nice");
    expect(d.act).toBe("EMOTIONAL_REACTION");
    expect(d.emotion).toBe("POSITIVE");
  });
  it("catches 'love it'", () => {
    const d = classifySocialEmotional("love it");
    expect(d.act).toBe("EMOTIONAL_REACTION");
    expect(d.emotion).toBe("POSITIVE");
  });
  it("catches 'damn'", () => {
    const d = classifySocialEmotional("damn");
    expect(d.act).toBe("EMOTIONAL_REACTION");
    expect(d.emotion).toBe("NEGATIVE");
  });
  it("catches 'haha'", () => {
    const d = classifySocialEmotional("haha");
    expect(d.act).toBe("EMOTIONAL_REACTION");
    expect(d.emotion).toBe("LAUGHTER");
  });
  it("catches Indonesian 'mantap'", () => {
    const d = classifySocialEmotional("mantap");
    expect(d.act).toBe("EMOTIONAL_REACTION");
    expect(d.emotion).toBe("POSITIVE");
  });
  it("catches Indonesian 'wah bagus'", () => {
    const d = classifySocialEmotional("wah bagus");
    expect(d.act).toBe("EMOTIONAL_REACTION");
  });
  it("catches Indonesian 'aduh'", () => {
    const d = classifySocialEmotional("aduh");
    expect(d.act).toBe("EMOTIONAL_REACTION");
    expect(d.emotion).toBe("NEGATIVE");
  });
});

describe("classifySocialEmotional · CONFUSION", () => {
  it("catches 'huh?'", () => {
    const d = classifySocialEmotional("huh?");
    expect(d.act).toBe("CONFUSION");
  });
  it("catches 'what do you mean?'", () => {
    const d = classifySocialEmotional("what do you mean?");
    expect(d.act).toBe("CONFUSION");
  });
  it("catches \"I'm confused\"", () => {
    const d = classifySocialEmotional("I'm confused");
    expect(d.act).toBe("CONFUSION");
  });
  it("catches Indonesian 'aku bingung'", () => {
    const d = classifySocialEmotional("aku bingung");
    expect(d.act).toBe("CONFUSION");
  });
  it("catches Indonesian 'nggak ngerti'", () => {
    const d = classifySocialEmotional("nggak ngerti");
    expect(d.act).toBe("CONFUSION");
  });
});

describe("classifySocialEmotional · SOCIAL_PLUS_TASK", () => {
  it("catches 'nice, now show me the second one'", () => {
    const d = classifySocialEmotional("nice, now show me the second one");
    expect(d.act).toBe("SOCIAL_PLUS_TASK");
    expect(d.task_fragment).toContain("show");
  });
  it("catches 'thanks — can you find restaurants too?'", () => {
    const d = classifySocialEmotional("thanks — can you find restaurants too?");
    expect(d.act).toBe("SOCIAL_PLUS_TASK");
    expect(d.task_fragment).toContain("find");
  });
  it("catches 'great, book the first one'", () => {
    const d = classifySocialEmotional("great, book the first one");
    expect(d.act).toBe("SOCIAL_PLUS_TASK");
  });
});

describe("classifySocialEmotional · NEGATIVE cases", () => {
  it("does NOT match 'find me hotels'", () => {
    const d = classifySocialEmotional("find me hotels");
    expect(d.act).toBe("NONE");
  });
  it("does NOT match 'where did you find them?'", () => {
    const d = classifySocialEmotional("where did you find them?");
    expect(d.act).toBe("NONE");
  });
  it("does NOT match plain 'yes'", () => {
    const d = classifySocialEmotional("yes");
    expect(d.act).toBe("NONE");
  });
  it("does NOT match long emotional-flavoured task sentences", () => {
    const d = classifySocialEmotional("I love a hotel that is close to Malioboro");
    // Contains 'love' but is a task shape · not shortcut here
    expect(d.act === "SOCIAL_PLUS_TASK" || d.act === "NONE").toBe(true);
  });
});

describe("decideSocialEmotionalGate · gating behaviour", () => {
  it("EMOTIONAL_REACTION suppresses composition", () => {
    const r = decideSocialEmotionalGate({
      userMessage: "wow", session: sessionWithHotels(), activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.suppressed_composition).toBe(true);
      expect(r.reply.toLowerCase()).not.toContain("found 3");
      expect(r.reply.toLowerCase()).not.toContain("hotel");
    }
  });

  it("CONFUSION references the last NEX question when available", () => {
    const r = decideSocialEmotionalGate({
      userMessage: "what do you mean?",
      session: sessionWithNexQuestion("Do you want budget or mid-range?"),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) expect(r.reply).toContain("budget or mid-range");
  });

  it("CONFUSION with an active result set explains the list", () => {
    const r = decideSocialEmotionalGate({
      userMessage: "huh?",
      session: sessionWithHotels(),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) {
      expect(r.reply.toLowerCase()).toMatch(/list|walk through|refine/);
    }
  });

  it("CONFUSION fresh conv (no anchor) → clarifying question", () => {
    const r = decideSocialEmotionalGate({
      userMessage: "I don't understand", session: emptySession(), activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) expect(r.reply.toLowerCase()).toMatch(/tell me a bit more|specific|clarify/);
  });

  it("SOCIAL_PLUS_TASK does NOT gate (existing pipeline handles both)", () => {
    const r = decideSocialEmotionalGate({
      userMessage: "nice, now show me the second one",
      session: sessionWithHotels(),
      activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(false);
    expect(r.detection.act).toBe("SOCIAL_PLUS_TASK");
    expect(r.detection.task_fragment).toContain("show");
  });

  it("Indonesian reply routing", () => {
    const r = decideSocialEmotionalGate({
      userMessage: "wah bagus", session: sessionWithHotels(), activeLanguage: "ID",
    });
    expect(r.shouldGate).toBe(true);
    if (r.shouldGate) expect(r.reply).toMatch(/[Ss]enang|[Bb]aik/);
  });

  it("does NOT gate 'find me hotels'", () => {
    const r = decideSocialEmotionalGate({
      userMessage: "find me hotels", session: emptySession(), activeLanguage: "EN",
    });
    expect(r.shouldGate).toBe(false);
  });
});
