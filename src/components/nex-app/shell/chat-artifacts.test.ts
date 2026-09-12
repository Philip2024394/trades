// src/components/nex-app/shell/chat-artifacts.test.ts
//
// Stage 3.41 · Client-side response mapper doctrine tests.

import { describe, expect, it } from "vitest";
import { mapChatResponseToArtifacts, extractVoiceReplyID } from "./chat-artifacts";

describe("mapChatResponseToArtifacts · voice_reply extraction", () => {
  it("full voice_reply → parsed EN text + mode + intent", () => {
    const r = mapChatResponseToArtifacts({
      voice_reply: { en: "Yep — found 3.", id: "Sip — ketemu 3.", mode: "HANGOUT", intent: "discovery_hit" },
    });
    expect(r.voiceReply).toEqual({ text: "Yep — found 3.", mode: "HANGOUT", intent: "discovery_hit" });
  });

  it("missing voice_reply → undefined (never crashes)", () => {
    expect(mapChatResponseToArtifacts({}).voiceReply).toBeUndefined();
    expect(mapChatResponseToArtifacts({ voice_reply: null }).voiceReply).toBeUndefined();
    expect(mapChatResponseToArtifacts({ voice_reply: { en: null } }).voiceReply).toBeUndefined();
  });

  it("invalid mode → treated as missing", () => {
    expect(mapChatResponseToArtifacts({ voice_reply: { en: "x", mode: "PARTY", intent: "greeting" } }).voiceReply).toBeUndefined();
  });

  it("extractVoiceReplyID · picks the ID rendering", () => {
    const v = extractVoiceReplyID({ en: "Yep", id: "Sip", mode: "HANGOUT", intent: "discovery_hit" });
    expect(v?.text).toBe("Sip");
  });
});

describe("mapChatResponseToArtifacts · world_cards extraction", () => {
  it("records[] shape → mapped to cards with missing-field pills", () => {
    const r = mapChatResponseToArtifacts({
      world_cards: {
        records: [
          { name: "Gaotama Hotel", id: "biz_g", category: "hotel", rating: 4.4, reviewCount: 128 },
          { name: "Griya Sentana", id: "biz_gs", category: "hotel" }, // no rating · no price
        ],
      },
    });
    expect(r.worldCards).toHaveLength(2);
    expect(r.worldCards[0].name).toBe("Gaotama Hotel");
    expect(r.worldCards[0].rating).toBe(4.4);
    expect(r.worldCards[0].missingFieldPills).toContain("no price published");
    expect(r.worldCards[1].missingFieldPills).toContain("no price published");
    expect(r.worldCards[1].missingFieldPills).toContain("no rating published");
  });

  it("hits[] shape (alternate) → also mapped", () => {
    const r = mapChatResponseToArtifacts({ world_cards: { hits: [{ name: "A" }] } });
    expect(r.worldCards).toHaveLength(1);
    expect(r.worldCards[0].name).toBe("A");
  });

  it("card without a name → dropped (never render an unnamed card)", () => {
    const r = mapChatResponseToArtifacts({ world_cards: { records: [{ id: "x" }, { name: "OK" }] } });
    expect(r.worldCards).toHaveLength(1);
    expect(r.worldCards[0].name).toBe("OK");
  });

  it("empty world_cards → empty array", () => {
    expect(mapChatResponseToArtifacts({}).worldCards).toEqual([]);
    expect(mapChatResponseToArtifacts({ world_cards: null }).worldCards).toEqual([]);
    expect(mapChatResponseToArtifacts({ world_cards: {} }).worldCards).toEqual([]);
  });

  it("price rendered when numeric > 0, distance rendered with area", () => {
    const r = mapChatResponseToArtifacts({
      world_cards: { records: [{ name: "X", price: 250000, distanceKm: 0.14, distanceArea: "Malioboro" }] },
    });
    expect(r.worldCards[0].priceLine).toBe("from Rp 250.000");
    expect(r.worldCards[0].distanceLine).toBe("0.14km from Malioboro");
    expect(r.worldCards[0].missingFieldPills).not.toContain("no price published");
  });
});

describe("mapChatResponseToArtifacts · pending_proposal_snapshot", () => {
  it("full snapshot → parsed", () => {
    const r = mapChatResponseToArtifacts({
      pending_proposal_snapshot: {
        actionId:        "act_1",
        targetCanonical: "Gaotama Hotel",
        kind:            "contact_via_whatsapp",
        messageBody:     "Hello?",
        language:        "id",
      },
    });
    expect(r.pendingProposal?.actionId).toBe("act_1");
    expect(r.pendingProposal?.language).toBe("id");
  });

  it("missing fields → undefined (never renders a broken prompt)", () => {
    expect(mapChatResponseToArtifacts({ pending_proposal_snapshot: { actionId: "x" } }).pendingProposal).toBeUndefined();
    expect(mapChatResponseToArtifacts({ pending_proposal_snapshot: null }).pendingProposal).toBeUndefined();
  });

  it("language defaults to en when unspecified", () => {
    const r = mapChatResponseToArtifacts({
      pending_proposal_snapshot: { actionId: "a", targetCanonical: "X", kind: "contact_via_whatsapp" },
    });
    expect(r.pendingProposal?.language).toBe("en");
  });
});

describe("mapChatResponseToArtifacts · action_audit extraction", () => {
  it("VERIFIED audit → parsed with target", () => {
    const r = mapChatResponseToArtifacts({
      action_audit: {
        finalState: "VERIFIED",
        target: { canonical: "Gaotama Hotel" },
        verification: { reason: "delivered" },
      },
    });
    expect(r.audit?.finalState).toBe("VERIFIED");
    expect(r.audit?.targetCanonical).toBe("Gaotama Hotel");
  });

  it("UNKNOWN audit → parsed with reason", () => {
    const r = mapChatResponseToArtifacts({
      action_audit: {
        finalState: "UNKNOWN",
        target: { canonical: "X" },
        verification: { reason: "no proof yet" },
      },
    });
    expect(r.audit?.finalState).toBe("UNKNOWN");
    expect(r.audit?.reason).toBe("no proof yet");
  });

  it("BLOCKED audit falls back to blockedReason when verification.reason absent", () => {
    const r = mapChatResponseToArtifacts({
      action_audit: {
        finalState: "BLOCKED",
        target: { canonical: "X" },
        blockedReason: "auth required",
      },
    });
    expect(r.audit?.finalState).toBe("BLOCKED");
    expect(r.audit?.reason).toBe("auth required");
  });

  it("invalid finalState → undefined (never renders a bogus pill)", () => {
    expect(mapChatResponseToArtifacts({ action_audit: { finalState: "EXPLODED" } }).audit).toBeUndefined();
  });
});

describe("mapChatResponseToArtifacts · end-to-end response", () => {
  it("full realistic response is unpacked cleanly", () => {
    const r = mapChatResponseToArtifacts({
      voice_reply: { en: "I've got 3 near Malioboro.", id: "Ada 3 dekat Malioboro.", mode: "HANGOUT", intent: "discovery_hit" },
      world_cards: {
        records: [
          { name: "Gaotama Hotel", id: "biz_g", rating: 4.4, price: 300000, distanceKm: 0.14, distanceArea: "Malioboro" },
          { name: "Griya Sentana", id: "biz_gs" },
        ],
      },
      pending_proposal_snapshot: null,
      action_audit: null,
    });
    expect(r.voiceReply?.text).toBe("I've got 3 near Malioboro.");
    expect(r.worldCards).toHaveLength(2);
    expect(r.pendingProposal).toBeUndefined();
    expect(r.audit).toBeUndefined();
  });
});
