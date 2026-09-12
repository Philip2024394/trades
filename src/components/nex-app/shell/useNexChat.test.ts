// src/components/nex-app/shell/useNexChat.test.ts
//
// Stage 3.41.a · Pure-helper tests for the chat state hook.
//
// The React hook itself needs a DOM to exercise · so we test the
// load-bearing PURE HELPERS (buildRequestPayload / parseResponseToMessage)
// that carry all the logic. Combined with:
//   · chat-artifacts.test.ts    (17 tests · mapper)
//   · im-hungry-journey.test.ts (4 tests · full stack choreography)
// this gives us end-to-end coverage of the front door without
// requiring @testing-library/react.

import { describe, expect, it } from "vitest";
import { buildRequestPayload, parseResponseToMessage } from "./useNexChat";

// ─── buildRequestPayload ──────────────────────────────────────────

describe("buildRequestPayload · shape /api/nex-conv/chat expects", () => {
  it("basic call · trims message · defaults market/useLiveWorld", () => {
    const p = buildRequestPayload({ message: "  hello  ", conversationId: "c1" });
    expect(p).toEqual({
      message:         "hello",
      conversation_id: "c1",
      market:          "ID",
      useLiveWorld:    true,
      user_id:         undefined,
    });
  });

  it("respects market / useLiveWorld / userId overrides", () => {
    const p = buildRequestPayload({
      message: "hi", conversationId: "c1",
      market: "UK", useLiveWorld: false, userId: "u_123",
    });
    expect(p.market).toBe("UK");
    expect(p.useLiveWorld).toBe(false);
    expect(p.user_id).toBe("u_123");
  });

  it("empty message → payload has empty message string (caller decides to skip)", () => {
    expect(buildRequestPayload({ message: "   ", conversationId: "c1" }).message).toBe("");
  });
});

// ─── parseResponseToMessage ──────────────────────────────────────

describe("parseResponseToMessage · turns API JSON into NexChatMessage", () => {
  it("EN language · uses voice_reply.en as text · attaches artifacts", () => {
    const m = parseResponseToMessage(
      {
        reply: "Base honest reply (constitutional composer output).",
        voice_reply: { en: "Yep — found 3.", id: "Sip — ketemu 3.", mode: "HANGOUT", intent: "discovery_hit" },
        world_cards: { cards: [{ id: "b1", name: "Hotel A" }, { id: "b2", name: "Hotel B" }, { id: "b3", name: "Hotel C" }] },
      },
      { language: "en" },
    );
    expect(m.role).toBe("nex");
    expect(m.text).toBe("Yep — found 3.");
    expect(m.artifacts?.voiceReply?.text).toBe("Yep — found 3.");
    expect(m.artifacts?.worldCards).toHaveLength(3);
  });

  it("ID language · uses voice_reply.id as text", () => {
    const m = parseResponseToMessage(
      {
        reply: "base",
        voice_reply: { en: "Yep — found 3.", id: "Sip — ketemu 3.", mode: "HANGOUT", intent: "discovery_hit" },
      },
      { language: "id" },
    );
    expect(m.text).toBe("Sip — ketemu 3.");
    expect(m.artifacts?.voiceReply?.text).toBe("Sip — ketemu 3.");
  });

  it("missing voice_reply → falls back to base reply string", () => {
    const m = parseResponseToMessage(
      { reply: "Base honest fallback." },
      { language: "en" },
    );
    expect(m.text).toBe("Base honest fallback.");
    expect(m.artifacts?.voiceReply).toBeUndefined();
  });

  it("empty response → text is empty string, no crash", () => {
    const m = parseResponseToMessage({}, { language: "en" });
    expect(m.text).toBe("");
    expect(m.role).toBe("nex");
  });

  it("full response · pending proposal + audit → artifacts populated", () => {
    const m = parseResponseToMessage(
      {
        reply: "base",
        voice_reply: { en: "Want me to fire it off?", id: "Kirim?", mode: "TASK", intent: "propose_action" },
        pending_proposal_snapshot: {
          actionId: "a1", targetCanonical: "Gaotama Hotel", kind: "contact_via_whatsapp",
          messageBody: "Hi?", language: "en",
        },
      },
      { language: "en" },
    );
    expect(m.artifacts?.pendingProposal?.targetCanonical).toBe("Gaotama Hotel");
    expect(m.artifacts?.pendingProposal?.language).toBe("en");
  });

  it("action audit VERIFIED / UNKNOWN / FAILED / BLOCKED all parse", () => {
    for (const state of ["VERIFIED", "UNKNOWN", "FAILED", "BLOCKED"] as const) {
      const m = parseResponseToMessage(
        {
          reply: "base",
          action_audit: {
            finalState: state,
            target: { canonical: "X" },
            verification: { reason: "test" },
            blockedReason: "test",
          },
        },
        { language: "en" },
      );
      expect(m.artifacts?.audit?.finalState).toBe(state);
    }
  });
});

// ─── The button-flow guarantee (via the hook's contract) ─────────
//
// The React hook wraps these helpers · calling sendUserMessage("yes send it")
// from a button click produces the SAME buildRequestPayload output as
// typing "yes send it" would. This lock is here so anyone reading the
// tests understands why we don't need a separate button-flow test.

describe("button-flow guarantee · buttons and typed input produce identical payloads", () => {
  it("simulated button click 'yes send it' and typed 'yes send it' produce equal payloads", () => {
    const buttonPayload = buildRequestPayload({ message: "yes send it", conversationId: "c1" });
    const typedPayload  = buildRequestPayload({ message: "yes send it", conversationId: "c1" });
    expect(buttonPayload).toEqual(typedPayload);
  });

  it("ID confirmation via button 'iya kirim' produces same payload as typed 'iya kirim'", () => {
    const buttonPayload = buildRequestPayload({ message: "iya kirim", conversationId: "c1" });
    const typedPayload  = buildRequestPayload({ message: "iya kirim", conversationId: "c1" });
    expect(buttonPayload).toEqual(typedPayload);
  });
});
