// src/lib/nex/brain/_observation-cross-vertical.test.ts
//
// OBSERVATION ONLY · zero code changes · Philip 2026-08-31.
// Runs the exact 9-turn subject-switching conversation through the
// real orchestrateChatTurnLive pipeline. Reports what actually
// happens at each turn. Delete after review.

import { describe, it, vi, beforeEach } from "vitest";

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
          pending: { correlationId: "corr", awaitingKind: "not_wired", reason: "observation stub" },
        };
      },
    },
  };
});

import { orchestrateChatTurnLive } from "./orchestrate";
import { _resetSessionsForTests, getSession } from "./session";
import { selectVoiceIntent } from "./voice-intent-selector";
import { renderVoice } from "./personality-voice";
import { detectEntityFollowup } from "./entity-followup-detector";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => { searchMock.mockReset(); _resetSessionsForTests(); waCallCount.value = 0; });

function fakeRestaurant(name: string, id: string, whatsapp?: string): WorldRecord {
  return {
    id, name,
    vertical: "food", market: "ID", category: "restaurant",
    city: "Yogyakarta", area: "malioboro",
    whatsapp, rating: 4.5, reviewCount: 100,
    latitude: -7.79, longitude: 110.36,
    claimStatus: "listed", verified: false,
    provenance: { sourceKey: "nex.food_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
  };
}

function fakeJewelleryProduct(name: string, id: string, price: number, whatsapp?: string): WorldRecord {
  return {
    id, name,
    vertical: "commerce", market: "ID", category: "jewellery",
    city: "Yogyakarta",
    whatsapp,
    price, // note: WorldRecord may or may not surface price in the presenter · this is realistic mock data
    provenance: { sourceKey: "nex.mp_product", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

// Smart mock: return records based on which vertical the search asks for.
function wireVerticalMock() {
  searchMock.mockImplementation(async (input: { vertical: string }) => {
    if (input.vertical === "food") {
      return {
        vertical: "food", market: "ID",
        records: [
          fakeRestaurant("Gudeg Yu Djum",           "food_1", "+62 812 3456 7890"),
          fakeRestaurant("Gudeg Wijilan",           "food_2", "+62 813 9999 0000"),
          fakeRestaurant("Sate Klathak Pak Pong",   "food_3", "+62 814 1111 2222"),
        ],
        totalAvailable: 3, latencyMs: 10,
      };
    }
    if (input.vertical === "commerce") {
      return {
        vertical: "commerce", market: "ID",
        records: [
          fakeJewelleryProduct("Silver Butterfly Ring · Yogya Craft", "prod_1", 350_000, "+62 815 1111 2222"),
          fakeJewelleryProduct("Emas Kuning 24K Cincin Batu Zamrud", "prod_2", 4_500_000, "+62 815 3333 4444"),
          fakeJewelleryProduct("Perak Antik Kalung Motif Batik",     "prod_3", 275_000, "+62 815 5555 6666"),
        ],
        totalAvailable: 3, latencyMs: 10,
      };
    }
    return { vertical: input.vertical as never, market: "ID", records: [], totalAvailable: 0, latencyMs: 5 };
  });
}

async function turn(cid: string, message: string) {
  const beforeCalls = waCallCount.value;
  const searchCallsBefore = searchMock.mock.calls.length;
  const composed = await orchestrateChatTurnLive(message, {
    userMarket: "ID", conversationId: cid, useLiveWorld: true,
  });
  const sess = getSession(cid);
  const pending = sess?.pendingProposal ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refSummary = sess?.currentReference as any;
  const referenceJustResolved =
    !!refSummary?.resolved
    && refSummary.resolvedInTurn !== undefined
    && sess?.turnCount !== undefined
    && refSummary.resolvedInTurn === sess.turnCount;
  const currentReferenceName = refSummary?.business?.canonical ?? refSummary?.business?.raw;
  const followup = detectEntityFollowup(message);
  const entityFollowupIntent = !!(followup.matched && currentReferenceName);
  const plea = selectVoiceIntent({
    brain: composed, pendingProposal: pending, message,
    referenceJustResolved, entityFollowupIntent, currentReferenceName,
  });
  const voice = renderVoice({ intent: plea.intent, content: plea.content, mode: plea.mode });
  const searchCallVertical = searchMock.mock.calls.length > searchCallsBefore
    ? (searchMock.mock.calls[searchMock.mock.calls.length - 1][0] as { vertical?: string }).vertical
    : undefined;
  return {
    text: voice.en,
    mode: voice.mode,
    intent: plea.intent,
    detectedIntent: composed.intent,
    verbIntent: composed.world_query?.verbIntent,
    vertical: composed.world_query?.vertical,
    currentReference: currentReferenceName ?? null,
    referencePreserved: !!currentReferenceName,
    worldWasQueried: searchCallVertical !== undefined,
    worldQueriedVertical: searchCallVertical,
    hasCards: !!(composed.world_cards as { cards?: unknown[] } | undefined)?.cards?.length,
    cardCount: ((composed.world_cards as { cards?: unknown[] } | undefined)?.cards ?? []).length,
    hasProposal: pending?.status === "AWAITING",
    audit: composed.action_audit?.finalState,
    adapterInvokedThisTurn: waCallCount.value > beforeCalls,
    fallback: composed.intent_reason ?? null,
  };
}

describe("OBSERVATION · cross-vertical subject-switching · run only", () => {
  it("prints the 9-turn transcript with all observability", async () => {
    wireVerticalMock();
    const cid = "obs-cross-vertical";

    const conversation = [
      "I'm bored tonight",
      "Something with my girlfriend",
      "Maybe dinner",
      "Somewhere around Malioboro",
      "That second one looks good",
      "What else do they have?",
      "Actually forget that. Find me some jewellery.",
      "Something not too expensive",
      "Can you message the shop?",
    ];

    const rows: string[] = [];
    rows.push("");
    rows.push("═══════════════════════════════════════════════════════════════");
    rows.push("  OBSERVATION · cross-vertical subject-switching · 2026-08-31");
    rows.push("═══════════════════════════════════════════════════════════════");
    rows.push("");

    for (let i = 0; i < conversation.length; i++) {
      const msg = conversation[i];
      const r = await turn(cid, msg);
      rows.push(`──────── T${i + 1} ────────`);
      rows.push(`USER · ${msg}`);
      rows.push(`NEX  · ${r.text}`);
      rows.push("");
      rows.push(`  detected_intent      : ${r.detectedIntent ?? "-"}`);
      rows.push(`  verb_intent          : ${r.verbIntent ?? "-"}`);
      rows.push(`  vertical             : ${r.vertical ?? "-"}`);
      rows.push(`  voice_intent         : ${r.intent}`);
      rows.push(`  voice_mode           : ${r.mode}`);
      rows.push(`  world_queried        : ${r.worldWasQueried ? `yes (${r.worldQueriedVertical})` : "no"}`);
      rows.push(`  card_count           : ${r.cardCount}`);
      rows.push(`  current_reference    : ${r.currentReference ?? "-"}`);
      rows.push(`  reference_preserved  : ${r.referencePreserved}`);
      rows.push(`  pending_proposal     : ${r.hasProposal ? "AWAITING" : "-"}`);
      rows.push(`  audit_final_state    : ${r.audit ?? "-"}`);
      rows.push(`  adapter_invoked      : ${r.adapterInvokedThisTurn ? "yes" : "no"}`);
      rows.push("");
    }

    rows.push("═══════════════════════════════════════════════════════════════");
    // eslint-disable-next-line no-console
    console.log(rows.join("\n"));
  });
});
