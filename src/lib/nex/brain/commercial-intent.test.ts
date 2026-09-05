// src/lib/nex/brain/commercial-intent.test.ts
// Business v1 · commercial-intent classifier tests

import { describe, it, expect } from "vitest";
import {
  classifyCommercialIntent,
  detectSendAction,
  detectDraftAction,
} from "./commercial-intent";

describe("classifyCommercialIntent · primary FIND_* objectives", () => {
  it("'find buyers in Japan' → FIND_BUYERS Japan", () => {
    const d = classifyCommercialIntent("find buyers in Japan");
    expect(d.objective).toBe("FIND_BUYERS");
    expect(d.target_market).toBe("Japan");
  });
  it("'find seafood importers in Japan' → FIND_IMPORTERS + product hint", () => {
    const d = classifyCommercialIntent("find seafood importers in Japan");
    expect(d.objective).toBe("FIND_IMPORTERS");
    expect(d.target_market).toBe("Japan");
    expect(d.target_product_hint).toBe("seafood");
  });
  it("'find distributors in South Korea' → FIND_DISTRIBUTORS multi-word market", () => {
    const d = classifyCommercialIntent("find distributors in South Korea");
    expect(d.objective).toBe("FIND_DISTRIBUTORS");
    expect(d.target_market?.toLowerCase()).toBe("south korea");
  });
  it("'find suppliers in Vietnam' → FIND_SUPPLIERS", () => {
    const d = classifyCommercialIntent("find suppliers in Vietnam");
    expect(d.objective).toBe("FIND_SUPPLIERS");
    expect(d.target_market).toBe("Vietnam");
  });
  it("'find retailers in Germany' → FIND_RETAILERS", () => {
    const d = classifyCommercialIntent("find retailers in Germany");
    expect(d.objective).toBe("FIND_RETAILERS");
    expect(d.target_market).toBe("Germany");
  });
  it("'find wholesalers in USA' → FIND_WHOLESALERS", () => {
    const d = classifyCommercialIntent("find wholesalers in USA");
    expect(d.objective).toBe("FIND_WHOLESALERS");
  });
  it("'find partners in Singapore' → FIND_PARTNERS", () => {
    const d = classifyCommercialIntent("find partners in Singapore");
    expect(d.objective).toBe("FIND_PARTNERS");
    expect(d.target_market).toBe("Singapore");
  });
});

describe("classifyCommercialIntent · Indonesian", () => {
  it("'cari pembeli di Jepang' → FIND_BUYERS (japan)", () => {
    const d = classifyCommercialIntent("cari pembeli di Jepang");
    expect(d.objective).toBe("FIND_BUYERS");
    // Jepang is Indonesian for Japan; not in our COUNTRY_TOKENS · target_market may be null
  });
  it("'cari importir seafood di Japan' → FIND_IMPORTERS + Japan", () => {
    const d = classifyCommercialIntent("cari importir seafood di Japan");
    expect(d.objective).toBe("FIND_IMPORTERS");
    expect(d.target_market).toBe("Japan");
  });
});

describe("classifyCommercialIntent · bare task fragments", () => {
  it("'buyers in Japan' (no search verb) → FIND_BUYERS Japan", () => {
    const d = classifyCommercialIntent("buyers in Japan");
    expect(d.objective).toBe("FIND_BUYERS");
    expect(d.target_market).toBe("Japan");
  });
});

describe("classifyCommercialIntent · negatives", () => {
  it("plain conversation 'hello' → NONE", () => {
    expect(classifyCommercialIntent("hello").objective).toBe("NONE");
  });
  it("no objective noun → NONE", () => {
    expect(classifyCommercialIntent("find me hotels").objective).toBe("NONE");
  });
});

// ═════════════ Send action (§10 §30 boundary) ═════════════

describe("detectSendAction · autonomy boundary", () => {
  it("'send it' → send_action detected", () => {
    const d = detectSendAction("send it");
    expect(d.is_send_action).toBe(true);
    expect(d.action).toBe("send_email");
  });
  it("'email them' → send_action detected", () => {
    const d = detectSendAction("email them");
    expect(d.is_send_action).toBe(true);
    expect(d.action).toBe("send_email");
  });
  it("'message them on WhatsApp' → send_message", () => {
    const d = detectSendAction("message them on WhatsApp");
    expect(d.is_send_action).toBe(true);
  });
  it("'send them a WhatsApp' → send_whatsapp", () => {
    const d = detectSendAction("send them a WhatsApp");
    expect(d.is_send_action).toBe(true);
  });
  it("'contact them' → send_action detected", () => {
    const d = detectSendAction("contact them");
    expect(d.is_send_action).toBe(true);
  });
  it("'do it automatically' → autonomous marker fires send-block", () => {
    const d = detectSendAction("do it automatically");
    expect(d.is_send_action).toBe(true);
  });

  it("DRAFT-then-SEND phrasing does NOT fire send (draft wins)", () => {
    // "draft an email and I'll send it later" — the send token appears
    // AFTER a draft token; we treat the request as drafting, not sending.
    const d = detectSendAction("draft an email and i will send it later");
    expect(d.is_send_action).toBe(false);
  });

  it("plain 'find buyers' → not a send action", () => {
    expect(detectSendAction("find buyers in Japan").is_send_action).toBe(false);
  });
});

// ═════════════ Draft action (§10 allowed) ═════════════

describe("detectDraftAction", () => {
  it("'draft an email' → draft_email", () => {
    const d = detectDraftAction("draft an email to the first one");
    expect(d.is_draft_action).toBe(true);
    expect(d.action).toBe("draft_email");
  });
  it("'prepare an introduction' → draft_introduction", () => {
    const d = detectDraftAction("prepare an introduction to the first one");
    expect(d.is_draft_action).toBe(true);
    expect(d.action).toBe("draft_introduction");
  });
  it("'write a message' → draft_message", () => {
    const d = detectDraftAction("write a message to them");
    expect(d.is_draft_action).toBe(true);
    expect(d.action).toBe("draft_message");
  });
  it("'find buyers' → NOT draft", () => {
    expect(detectDraftAction("find buyers in Japan").is_draft_action).toBe(false);
  });
});
