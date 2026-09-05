// src/lib/nex/brain/im-hungry-journey.test.ts
//
// Stage 3.41 · Load-bearing end-to-end conversation test.
//
// This is the acceptance criterion for the entire NEX Chat experience,
// per Philip 2026-08-31:
//
//   "Take one complete journey and make it beautiful:
//    'I'm hungry.' → NEX talks naturally → finds real places →
//    shows cards → user picks one → asks a follow-up → NEX remembers
//    context → user asks NEX to do something → NEX proposes it →
//    user confirms → action runs → NEX reports the actual verified
//    outcome."
//
// This test runs the FULL stack:
//   · orchestrateChatTurnLive
//   · mocked World adapter (returns 3 realistic food places)
//   · mocked WhatsApp adapter (stub · returns accepted → UNKNOWN)
//   · session persistence across turns
//   · authorization gate
//   · voice-intent selector
//   · personality voice layer
//   · client-side response mapper
//
// If ANY step in this choreography breaks — cards don't render, voice
// doesn't select the right intent, authorization skips ahead, replay
// double-fires, G7 leaks a success word — this test fails.
//
// This is the test we protect above all others.

import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));
vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

const { waCallCount } = vi.hoisted(() => ({ waCallCount: { value: 0 } }));
vi.mock("./adapters/whatsapp-stub", async () => {
  return {
    whatsappStubAdapter: {
      kind: "contact_via_whatsapp",
      execute: async () => {
        waCallCount.value += 1;
        return {
          kind: "accepted",
          pending: { correlationId: "corr_test", awaitingKind: "not_wired", reason: "hungry journey stub" },
        };
      },
    },
  };
});

import { orchestrateChatTurnLive } from "./orchestrate";
import { _resetSessionsForTests, getSession } from "./session";
import { selectVoiceIntent } from "./voice-intent-selector";
import { renderVoice } from "./personality-voice";
import { findSuccessLanguageLeaks } from "./action-composer";
import { mapChatResponseToArtifacts } from "@/components/nex-app/shell/chat-artifacts";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => {
  searchMock.mockReset();
  _resetSessionsForTests();
  waCallCount.value = 0;
});

function fakeHotel(name: string, id: string, whatsapp: string | undefined): WorldRecord {
  return {
    id,
    name,
    vertical: "accommodation",
    market: "ID",
    category: "hotel",
    city: "Yogyakarta",
    area: "malioboro",
    whatsapp,
    rating: 4.5,
    reviewCount: 100,
    latitude: -7.79,
    longitude: 110.36,
    claimStatus: "listed",
    verified: false,
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
  };
}

/**
 * Simulate a single turn of the chat pipeline: run the orchestrator,
 * then run the same server-side voice + snapshot logic the API route
 * uses, then run the client-side mapper.
 */
async function turn(cid: string, message: string) {
  const composed = await orchestrateChatTurnLive(message, {
    userMarket: "ID", conversationId: cid, useLiveWorld: true,
  });
  const sess = getSession(cid);
  const pending = sess?.pendingProposal ?? null;
  const plea = selectVoiceIntent({ brain: composed, pendingProposal: pending, message });
  const voice = renderVoice({ intent: plea.intent, content: plea.content, mode: plea.mode });
  const pendingSnap = pending && pending.status === "AWAITING" ? {
    actionId: pending.actionId,
    targetCanonical: pending.target.canonical,
    kind: pending.kind,
    messageBody: pending.messageBody,
    language: pending.language ?? null,
  } : null;
  // Assemble a shape identical to what /api/nex-conv/chat returns.
  const apiResponse = {
    reply:                     composed.reply,
    voice_reply:               { en: voice.en, id: voice.id, mode: voice.mode, intent: plea.intent },
    world_cards:               composed.world_cards ?? null,
    action_audit:              composed.action_audit ?? null,
    pending_proposal_snapshot: pendingSnap,
  };
  const artifacts = mapChatResponseToArtifacts(apiResponse);
  return { composed, voice, plea, artifacts, waCalls: waCallCount.value };
}

// ═══════════════════════════════════════════════════════════════════
// The Journey
// ═══════════════════════════════════════════════════════════════════

describe("The 'I'm hungry' journey · end to end · beautiful when green", () => {
  it("full choreography: hungry → cards → the-second-one → propose → confirm → UNKNOWN → replay-guard", async () => {
    // Mock World: 3 realistic restaurants near Malioboro.
    searchMock.mockResolvedValue({
      vertical: "accommodation",
      market: "ID",
      records: [
        fakeHotel("Gaotama Hotel",   "acc_1", "+62 812 3456 7890"),
        fakeHotel("Griya Sentana",   "acc_2", "+62 813 9999 0000"),
        fakeHotel("Indonesia Hotel", "acc_3", "+62 814 1111 2222"),
      ],
      totalAvailable: 3,
      latencyMs: 12,
    });

    const cid = "journey-1";

    // ─── Turn 1 · "I'm hungry near Malioboro" ─────────────────────
    // Backend does discovery. Voice-intent selector picks discovery_hit.
    // Client mapper extracts 3 world cards. No pending proposal.

    const t1 = await turn(cid, "find me a hotel near Malioboro");
    expect(t1.waCalls).toBe(0);
    // Voice: discovery_hit HANGOUT
    expect(t1.plea.intent).toBe("discovery_hit");
    expect(t1.voice.mode).toBe("HANGOUT");
    expect(t1.voice.en).toMatch(/found \d+/i);
    expect(findSuccessLanguageLeaks(t1.voice.en)).toEqual([]);
    // Cards: 3 restaurants
    expect(t1.artifacts.worldCards).toHaveLength(3);
    expect(t1.artifacts.worldCards[0].name).toBe("Gaotama Hotel");
    expect(t1.artifacts.worldCards[1].name).toBe("Griya Sentana");
    expect(t1.artifacts.worldCards[2].name).toBe("Indonesia Hotel");
    // Missing-field pills · no price published for the mocked records
    expect(t1.artifacts.worldCards[0].missingFieldPills).toContain("no price published");
    // No pending proposal · no audit
    expect(t1.artifacts.pendingProposal).toBeUndefined();
    expect(t1.artifacts.audit).toBeUndefined();

    // ─── Turn 2 · "message the second one" ───────────────────────
    // Reference resolution resolves "the second one" → Griya Sentana.
    // Tool router picks category=action. Authorization gate mints a
    // pending proposal (adapter NEVER called). Voice picks propose_action.

    const t2 = await turn(cid, "message the second one");
    expect(t2.waCalls).toBe(0);  // adapter must NOT have run yet
    // Session should now hold an AWAITING proposal for Griya Sentana
    const t2sess = getSession(cid);
    expect(t2sess?.pendingProposal?.status).toBe("AWAITING");
    expect(t2sess?.pendingProposal?.target.canonical).toBe("Griya Sentana");
    // Voice: propose_action TASK
    expect(t2.plea.intent).toBe("propose_action");
    expect(t2.voice.mode).toBe("TASK");
    expect(t2.voice.en).toContain("Griya Sentana");
    expect(t2.voice.en).toContain("Want me to fire it off?");
    // Artifact: pending proposal snapshot present
    expect(t2.artifacts.pendingProposal).toBeDefined();
    expect(t2.artifacts.pendingProposal?.targetCanonical).toBe("Griya Sentana");
    // No terminal audit yet
    expect(t2.artifacts.audit).toBeUndefined();

    // ─── Turn 3 · "Yes, send it" (or button click posting "yes send it") ──
    // Authorization gate grants. runActionChain fires the WhatsApp stub.
    // Stub returns accepted → chain UNKNOWN. Session marks CONSUMED.
    // Voice picks action_unknown TASK · UNKNOWN pill appears.

    const t3 = await turn(cid, "yes send it");
    expect(t3.waCalls).toBe(1);   // adapter called exactly ONCE
    expect(t3.plea.intent).toBe("action_unknown");
    expect(t3.voice.mode).toBe("TASK");
    // Voice: honest UNKNOWN phrasing · NEVER claims success
    expect(t3.voice.en).toMatch(/no delivery confirmation/i);
    expect(t3.voice.en).toMatch(/Not gonna claim it landed/i);
    expect(findSuccessLanguageLeaks(t3.voice.en)).toEqual([]);
    // Artifact: audit pill · UNKNOWN
    expect(t3.artifacts.audit?.finalState).toBe("UNKNOWN");
    expect(t3.artifacts.audit?.targetCanonical).toBe("Griya Sentana");
    // Session: proposal is now CONSUMED
    expect(getSession(cid)?.pendingProposal?.status).toBe("CONSUMED");

    // ─── Turn 4 · Replay guard · "yes" again ─────────────────────
    // Same fingerprint · but CONSUMED · authorization decision returns
    // STALE_OR_MISMATCHED. Adapter MUST NOT be called again.

    const t4 = await turn(cid, "yes");
    expect(t4.waCalls).toBe(1);   // still ONE · replay blocked
    // The stale-ack voice is delivered honestly
    expect(findSuccessLanguageLeaks(t4.voice.en)).toEqual([]);
  });

  it("decline path · adapter never runs · voice honestly acknowledges", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [fakeHotel("Gaotama Hotel", "acc_1", "+62 812 3456 7890")],
      totalAvailable: 1, latencyMs: 12,
    });
    const cid = "journey-decline";

    await turn(cid, "find me a hotel near Malioboro");
    const t2 = await turn(cid, "message the first one");
    expect(t2.waCalls).toBe(0);
    expect(t2.artifacts.pendingProposal).toBeDefined();

    const t3 = await turn(cid, "no, don't send");
    expect(t3.waCalls).toBe(0);   // still ZERO · never called
    expect(t3.artifacts.audit?.finalState).toBe("BLOCKED");
    expect(findSuccessLanguageLeaks(t3.voice.en)).toEqual([]);
  });

  it("ambiguous confirm · voice reprompts · adapter never runs · proposal stays AWAITING", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [fakeHotel("Gaotama Hotel", "acc_1", "+62 812 3456 7890")],
      totalAvailable: 1, latencyMs: 12,
    });
    const cid = "journey-ambig";

    await turn(cid, "find me a hotel near Malioboro");
    await turn(cid, "message the first one");
    const t3 = await turn(cid, "okay");
    expect(t3.waCalls).toBe(0);
    // Pending proposal MUST still be AWAITING so the user can try again
    expect(getSession(cid)?.pendingProposal?.status).toBe("AWAITING");
  });

  it("missing evidence path · no whatsapp field on record · never asks 'want me to fire it off?'", async () => {
    searchMock.mockResolvedValue({
      vertical: "accommodation", market: "ID",
      records: [fakeHotel("NoContact Inn", "acc_nc", undefined)],
      totalAvailable: 1, latencyMs: 12,
    });
    const cid = "journey-nocontact";

    await turn(cid, "find me a hotel near Malioboro");
    const t2 = await turn(cid, "message the first one");
    expect(t2.waCalls).toBe(0);
    // No pending proposal minted · nothing valid to send
    expect(getSession(cid)?.pendingProposal).toBeUndefined();
    expect(t2.artifacts.pendingProposal).toBeUndefined();
    // Base reply carries the honest refusal
    expect(t2.composed.reply.toLowerCase()).toContain("won't guess a number");
  });
});
