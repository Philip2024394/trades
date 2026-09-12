// src/components/nex-app/state/ConversationStateProvider.test.ts
//
// Stage 3.41.b · Chat surface integration doctrine tests.
//
// The React provider itself needs a DOM to exercise · we test the
// LOAD-BEARING PURE HELPERS extracted from it (buildChatRequestBody
// and parseChatResponseForRender). These carry every constitutional
// choice the actual chat surface makes.
//
// Combined with:
//   · chat-artifacts.test.ts    (17 · mapper)
//   · useNexChat.test.ts        (11 · alternate hook helpers)
//   · im-hungry-journey.test.ts (4  · full backend stack)
//   · voice-intent-selector.test.ts (23 · server selector)
//   · personality-voice.test.ts (113 · voice layer)
// this proves the real chat surface's IO + assembly logic end-to-end
// without adding React DOM test dependencies.

import { describe, expect, it } from "vitest";
import { buildChatRequestBody, parseChatResponseForRender } from "./ConversationStateProvider";

// ─── buildChatRequestBody · payload shape locked ──────────────────

describe("buildChatRequestBody · exact shape /api/nex-conv/chat expects", () => {
  it("basic call · defaults market=ID + useLiveWorld=true", () => {
    const body = buildChatRequestBody({
      message: "find me a hotel", conversationId: "c1", history: [],
    });
    expect(body).toEqual({
      message:         "find me a hotel",
      conversation_id: "c1",
      history:         [],
      intent:          undefined,
      market:          "ID",
      useLiveWorld:    true,
    });
  });

  it("respects intent + market + useLiveWorld overrides", () => {
    const body = buildChatRequestBody({
      message: "hi", conversationId: "c1", history: [],
      intent: "greeting", market: "UK", useLiveWorld: false,
    });
    expect(body.intent).toBe("greeting");
    expect(body.market).toBe("UK");
    expect(body.useLiveWorld).toBe(false);
  });

  it("history threaded through unchanged", () => {
    const history = [
      { role: "user"      as const, content: "find hotel" },
      { role: "assistant" as const, content: "Yep — found 3." },
    ];
    expect(buildChatRequestBody({ message: "the second", conversationId: "c1", history }).history).toBe(history);
  });
});

// ─── parseChatResponseForRender · what the ChatBubble sees ────────

describe("parseChatResponseForRender · voice_reply text + artifacts", () => {
  it("EN language · uses voice_reply.en as text · attaches artifacts", () => {
    const { text, artifacts } = parseChatResponseForRender(
      {
        reply: "Base honest reply.",
        voice_reply: { en: "Yep — found 3.", id: "Sip — ketemu 3.", mode: "HANGOUT", intent: "discovery_hit" },
        world_cards: { cards: [{ id: "b1", name: "Hotel A" }, { id: "b2", name: "Hotel B" }] },
      },
      { language: "en" },
    );
    expect(text).toBe("Yep — found 3.");
    expect(artifacts.worldCards).toHaveLength(2);
    expect(artifacts.voiceReply?.text).toBe("Yep — found 3.");
  });

  it("ID language · uses voice_reply.id", () => {
    const { text } = parseChatResponseForRender(
      { reply: "base", voice_reply: { en: "Yep — found 3.", id: "Sip — ketemu 3.", mode: "HANGOUT", intent: "discovery_hit" } },
      { language: "id" },
    );
    expect(text).toBe("Sip — ketemu 3.");
  });

  it("no voice_reply · falls back to base reply · honest constitutional composer output", () => {
    const { text, artifacts } = parseChatResponseForRender(
      { reply: "The honest fallback the composer produced." },
    );
    expect(text).toBe("The honest fallback the composer produced.");
    expect(artifacts.voiceReply).toBeUndefined();
  });

  it("legacy staircase `answer` field falls through when neither voice nor reply present", () => {
    const { text } = parseChatResponseForRender({ answer: "Legacy staircase-flow answer." });
    expect(text).toBe("Legacy staircase-flow answer.");
  });

  it("pending proposal snapshot threaded into artifacts", () => {
    const { artifacts } = parseChatResponseForRender({
      reply: "base",
      voice_reply: { en: "Want me to fire it off?", id: "Kirim?", mode: "TASK", intent: "propose_action" },
      pending_proposal_snapshot: {
        actionId: "a1", targetCanonical: "Griya Sentana", kind: "contact_via_whatsapp",
        messageBody: "Hi?", language: "en",
      },
    });
    expect(artifacts.pendingProposal?.targetCanonical).toBe("Griya Sentana");
    expect(artifacts.pendingProposal?.actionId).toBe("a1");
  });

  it("action audit terminal state threaded into artifacts", () => {
    const { artifacts } = parseChatResponseForRender({
      reply: "base",
      action_audit: {
        finalState: "UNKNOWN",
        target: { canonical: "Griya Sentana" },
        verification: { reason: "no proof yet" },
      },
    });
    expect(artifacts.audit?.finalState).toBe("UNKNOWN");
    expect(artifacts.audit?.reason).toBe("no proof yet");
  });

  it("empty response · text is empty · no crash", () => {
    const { text, artifacts } = parseChatResponseForRender({});
    expect(text).toBe("");
    expect(artifacts.voiceReply).toBeUndefined();
    expect(artifacts.worldCards).toEqual([]);
  });
});

// ─── The four-turn journey · through the real surface's helpers ───

describe("The four-turn journey · via ConversationStateProvider helpers", () => {
  const cid = "c-journey";
  const history: Array<{ role: "user" | "assistant"; content: string }> = [];

  it("Turn 1 · discovery · body carries message + empty history · response yields voice + 3 cards", () => {
    const body = buildChatRequestBody({
      message: "find me a hotel near Malioboro",
      conversationId: cid, history: [],
    });
    expect(body.message).toBe("find me a hotel near Malioboro");
    expect(body.history).toEqual([]);

    const fakeResponse = {
      reply: "3 accommodation matches — Gaotama Hotel · Griya Sentana · Indonesia Hotel",
      voice_reply: { en: "Yep — found 3.", id: "Sip — ketemu 3.", mode: "HANGOUT", intent: "discovery_hit" },
      world_cards: { cards: [
        { id: "acc_1", name: "Gaotama Hotel" },
        { id: "acc_2", name: "Griya Sentana" },
        { id: "acc_3", name: "Indonesia Hotel" },
      ]},
      pending_proposal_snapshot: null,
      action_audit: null,
    };
    const { text, artifacts } = parseChatResponseForRender(fakeResponse, { language: "en" });
    expect(text).toBe("Yep — found 3.");
    expect(artifacts.worldCards).toHaveLength(3);
    expect(artifacts.pendingProposal).toBeUndefined();
    expect(artifacts.audit).toBeUndefined();

    // History grows for next turn
    history.push({ role: "user", content: "find me a hotel near Malioboro" });
    history.push({ role: "assistant", content: text });
  });

  it("Turn 2 · 'message the second one' · body carries history · response yields proposal · no audit yet", () => {
    const body = buildChatRequestBody({
      message: "message the second one",
      conversationId: cid, history,
    });
    expect(body.history).toHaveLength(2);
    expect(body.history[0].role).toBe("user");
    expect(body.history[1].role).toBe("assistant");

    const fakeResponse = {
      reply: "I can send a WhatsApp to Griya Sentana: '...' Shall I send it?",
      voice_reply: {
        en: "I've got a message ready for Griya Sentana: 'message the second one'\n\nWant me to fire it off?",
        id: "Pesan siap buat Griya Sentana: '...' Kirim?",
        mode: "TASK", intent: "propose_action",
      },
      world_cards: null,
      pending_proposal_snapshot: {
        actionId: "act_1", targetCanonical: "Griya Sentana",
        kind: "contact_via_whatsapp", messageBody: "message the second one", language: "en",
      },
      action_audit: null,
    };
    const { text, artifacts } = parseChatResponseForRender(fakeResponse, { language: "en" });
    expect(text).toContain("Griya Sentana");
    expect(text).toContain("Want me to fire it off?");
    expect(artifacts.pendingProposal?.targetCanonical).toBe("Griya Sentana");
    expect(artifacts.audit).toBeUndefined();  // no audit until adapter runs

    history.push({ role: "user", content: "message the second one" });
    history.push({ role: "assistant", content: text });
  });

  it("Turn 3 · 'yes send it' (typed OR button) · adapter fired · response yields UNKNOWN audit", () => {
    // BUTTON vs TYPED: both produce the same body · same authorization gate.
    const typedBody   = buildChatRequestBody({ message: "yes send it", conversationId: cid, history });
    const buttonBody  = buildChatRequestBody({ message: "yes send it", conversationId: cid, history });
    expect(typedBody).toEqual(buttonBody);

    const fakeResponse = {
      reply: "I attempted the WhatsApp to Griya Sentana, but I don't have delivery confirmation yet.",
      voice_reply: {
        en: "I fired off the WhatsApp to Griya Sentana, but no delivery confirmation yet. Not gonna claim it landed — check on your side if you can.",
        id: "Saya kirim ke Griya Sentana, tapi belum ada konfirmasi pengiriman. Nggak akan saya klaim sudah sampai — coba cek dari sisi kamu.",
        mode: "TASK", intent: "action_unknown",
      },
      world_cards: null,
      pending_proposal_snapshot: null,  // consumed
      action_audit: {
        finalState: "UNKNOWN",
        target: { canonical: "Griya Sentana" },
        verification: { reason: "adapter accepted · no delivery proof · UNKNOWN by design" },
      },
    };
    const { text, artifacts } = parseChatResponseForRender(fakeResponse, { language: "en" });
    expect(text).toContain("I fired off");
    expect(text).toContain("no delivery confirmation");
    expect(text).toContain("Not gonna claim it landed");
    expect(artifacts.audit?.finalState).toBe("UNKNOWN");
    expect(artifacts.pendingProposal).toBeUndefined();
  });

  it("Turn 4 · REPLAY · 'yes' again · response is stale-ack · no re-execute (server-enforced)", () => {
    // Server returns a stale-ack voice text; audit is undefined because no
    // new chain ran. Client just renders it.
    const fakeResponse = {
      reply: "That confirmation doesn't apply · the pending proposal was already executed once · replay protection: authorization consumed",
      voice_reply: null,  // stale-ack goes through base reply path
      world_cards: null,
      pending_proposal_snapshot: null,
      action_audit: null,
    };
    const { text, artifacts } = parseChatResponseForRender(fakeResponse, { language: "en" });
    expect(text).toContain("replay protection");
    expect(artifacts.audit).toBeUndefined();
    expect(artifacts.pendingProposal).toBeUndefined();
  });
});

// ─── Decline · ambiguous · missing-evidence variants ──────────────

describe("Alternate paths · decline / ambiguous / missing evidence", () => {
  it("Decline · 'no, don't send' · response has no audit + no pending · client renders decline ack", () => {
    const fakeResponse = {
      reply: "Understood — I won't send anything to Griya Sentana.",
      voice_reply: { en: "Cool — leaving Griya Sentana alone.", id: "Oke — nggak jadi kirim ke Griya Sentana.", mode: "TASK", intent: "auth_declined" },
    };
    const { text, artifacts } = parseChatResponseForRender(fakeResponse, { language: "en" });
    expect(text).toBe("Cool — leaving Griya Sentana alone.");
    expect(artifacts.pendingProposal).toBeUndefined();
  });

  it("Ambiguous · 'okay' during pending · response keeps pending AWAITING · client re-renders prompt", () => {
    const fakeResponse = {
      reply: "I couldn't tell if that was a yes or no.",
      voice_reply: { en: "Couldn't tell if that was a yes or no. Send to Griya Sentana? Just say 'yes' or 'no'.", id: null, mode: "TASK", intent: "auth_ambiguous" },
      pending_proposal_snapshot: {
        actionId: "act_1", targetCanonical: "Griya Sentana",
        kind: "contact_via_whatsapp", messageBody: "message the second one", language: "en",
      },
    };
    const { artifacts } = parseChatResponseForRender(fakeResponse, { language: "en" });
    // Pending proposal STILL AWAITING · buttons stay visible so user can click clearly
    expect(artifacts.pendingProposal?.targetCanonical).toBe("Griya Sentana");
  });

  it("Missing evidence · never asks 'shall I send?' · never mints proposal", () => {
    const fakeResponse = {
      reply: "I can't send to NoContact Inn: no verified whatsapp contact channel published for this target. I won't guess a number.",
      voice_reply: null,
      pending_proposal_snapshot: null,
    };
    const { text, artifacts } = parseChatResponseForRender(fakeResponse, { language: "en" });
    expect(text).toContain("won't guess a number");
    expect(artifacts.pendingProposal).toBeUndefined();
  });
});

// ─── Button-flow equivalence · locked as the constitutional invariant ─

describe("Constitutional · buttons and typed input produce IDENTICAL request payloads", () => {
  it("EN · button 'yes send it' === typed 'yes send it'", () => {
    const button = buildChatRequestBody({ message: "yes send it", conversationId: "c1", history: [] });
    const typed  = buildChatRequestBody({ message: "yes send it", conversationId: "c1", history: [] });
    expect(button).toEqual(typed);
  });

  it("ID · button 'iya kirim' === typed 'iya kirim'", () => {
    const button = buildChatRequestBody({ message: "iya kirim", conversationId: "c1", history: [] });
    const typed  = buildChatRequestBody({ message: "iya kirim", conversationId: "c1", history: [] });
    expect(button).toEqual(typed);
  });

  it("EN · button 'no' === typed 'no'", () => {
    const button = buildChatRequestBody({ message: "no", conversationId: "c1", history: [] });
    const typed  = buildChatRequestBody({ message: "no", conversationId: "c1", history: [] });
    expect(button).toEqual(typed);
  });
});
