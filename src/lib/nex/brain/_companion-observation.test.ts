// src/lib/nex/brain/_companion-observation.test.ts
//
// COMPANION OBSERVATION · run only · zero code changes · Philip 2026-08-31.
// Drives four realistic conversations through the actual
// orchestrateChatTurnLive pipeline (same code the /nex-app/talk
// surface hits) and prints rich per-turn metadata for review.
// Delete after review · underscore-prefixed.

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

// ─── Realistic fake data · Yogyakarta / Malioboro flavour ─────

function fakeRestaurant(name: string, id: string, rating: number | undefined, whatsapp: string): WorldRecord {
  return {
    id, name,
    vertical: "food", market: "ID", category: "restaurant",
    city: "Yogyakarta", area: "malioboro",
    whatsapp, rating, reviewCount: rating ? 120 : undefined,
    latitude: -7.79, longitude: 110.36,
    claimStatus: "listed", verified: false,
    provenance: { sourceKey: "nex.food_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
  };
}
function fakeJewellery(name: string, id: string, whatsapp: string): WorldRecord {
  return {
    id, name,
    vertical: "commerce", market: "ID", category: "jewellery",
    city: "Yogyakarta", whatsapp,
    provenance: { sourceKey: "nex.mp_product", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
function fakePhone(name: string, id: string, whatsapp: string): WorldRecord {
  return {
    id, name,
    vertical: "commerce", market: "ID", category: "electronics",
    city: "Yogyakarta", whatsapp,
    provenance: { sourceKey: "nex.mp_product", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}
function fakeAccommodation(name: string, id: string, whatsapp: string): WorldRecord {
  return {
    id, name,
    vertical: "accommodation", market: "ID", category: "hotel",
    city: "Yogyakarta", area: "malioboro",
    whatsapp, rating: 4.4, reviewCount: 100,
    latitude: -7.79, longitude: 110.36,
    claimStatus: "listed", verified: false,
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
  };
}

function wireRealisticWorld() {
  searchMock.mockImplementation(async (input: { vertical: string }) => {
    if (input.vertical === "food") {
      return {
        vertical: "food", market: "ID",
        records: [
          fakeRestaurant("Gudeg Yu Djum",         "food_1", 4.6, "+62 812 3456 7890"),
          fakeRestaurant("Gudeg Wijilan",         "food_2", 4.4, "+62 813 9999 0000"),
          fakeRestaurant("Sate Klathak Pak Pong", "food_3", undefined, "+62 814 1111 2222"),
        ],
        totalAvailable: 3, latencyMs: 10,
      };
    }
    if (input.vertical === "commerce") {
      const category = "jewellery"; // adapter picks based on message · simplified for mock
      // Look at last-called input to distinguish jewellery vs phone
      // (not easily · here we return jewellery by default, phone if category hint present)
      return {
        vertical: "commerce", market: "ID",
        records: [
          fakeJewellery("Silver Butterfly Ring · Yogya Craft", "prod_j1", "+62 815 1111 2222"),
          fakeJewellery("Emas Kuning 24K Cincin Batu Zamrud",  "prod_j2", "+62 815 3333 4444"),
          fakeJewellery("Perak Antik Kalung Motif Batik",      "prod_j3", "+62 815 5555 6666"),
        ],
        totalAvailable: 3, latencyMs: 10,
      };
    }
    if (input.vertical === "accommodation") {
      return {
        vertical: "accommodation", market: "ID",
        records: [
          fakeAccommodation("Gaotama Hotel",   "acc_1", "+62 812 3456 7890"),
          fakeAccommodation("Griya Sentana",   "acc_2", "+62 813 9999 0000"),
          fakeAccommodation("Indonesia Hotel", "acc_3", "+62 814 1111 2222"),
        ],
        totalAvailable: 3, latencyMs: 10,
      };
    }
    return { vertical: input.vertical as never, market: "ID", records: [], totalAvailable: 0, latencyMs: 5 };
  });
}

// ─── Language detection for display ───────────────────────────

function isIndonesian(msg: string): boolean {
  return /\b(aku|kamu|kami|mau|ingin|dengan|dan|tapi|tidak|bukan|ada|bisa|tolong|apa|siapa|mana|berapa|kenapa|bagaimana|dimana|untuk|dari|di|ke|yang|itu|ini|adalah|sedang|mencari|cari|tangga|kayu|harga|beli|jual|silakan|terima kasih|malam|makan|deket|nomor|bagus|sana|jangan|mahal|banget|toko|hai|halo|bosen|pacar|perhiasan|mungkin|sebenernya|beliin|hubungi)\b/i.test(msg);
}

// ─── Per-turn driver + capture ────────────────────────────────

async function turn(cid: string, message: string, prevNexText: string | null) {
  const beforeAdapter = waCallCount.value;
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
  const langId = isIndonesian(message);
  const visibleText = langId ? voice.id : voice.en;
  const searchCallVertical = searchMock.mock.calls.length > searchCallsBefore
    ? (searchMock.mock.calls[searchMock.mock.calls.length - 1][0] as { vertical?: string }).vertical
    : undefined;
  const cards = (composed.world_cards as { cards?: unknown[] } | undefined)?.cards ?? [];
  const repeated = prevNexText !== null && prevNexText === visibleText;
  // Heuristic: did NEX name any prior-turn concept? · very rough
  const heardPrevious = prevNexText !== null && (
    visibleText.toLowerCase().includes("that") ||
    visibleText.toLowerCase().includes("them") ||
    (currentReferenceName ? visibleText.toLowerCase().includes(currentReferenceName.toLowerCase()) : false)
  );
  // Fabrication heuristic: any numeric price mentioned in voice text that
  // wasn't in the message (very loose · flags for review, not verdict)
  const priceMentionInVoice = /\b(rp|idr)\s*\d/i.test(visibleText) || /\b\d+[k]\b/i.test(visibleText);
  const priceMentionInUser  = /\b(rp|idr)\s*\d/i.test(message)     || /\b\d+[k]\b/i.test(message);
  const fabrication = priceMentionInVoice && !priceMentionInUser;
  return {
    userText: message,
    nexText: visibleText,
    detectedIntent: composed.intent,
    vertical: composed.world_query?.vertical ?? "-",
    currentGoal: sess?.goal?.kind ?? "-",
    currentGoalStatus: sess?.goal?.status ?? "-",
    currentReference: currentReferenceName ?? "-",
    presentedCount: cards.length,
    previousContextPreserved: !!currentReferenceName,
    worldQueried: searchCallVertical !== undefined,
    worldVertical: searchCallVertical ?? "-",
    actionProposed: pending?.status === "AWAITING",
    adapterCalled: waCallCount.value > beforeAdapter,
    voiceMode: voice.mode,
    voiceIntent: plea.intent,
    repeated,
    heardPrevious,
    fabricated: fabrication,
    languageShown: langId ? "id" : "en",
  };
}

// ─── Formatter ────────────────────────────────────────────────

function formatTurn(i: number, r: Awaited<ReturnType<typeof turn>>): string {
  return [
    `──────── T${i + 1} ────────`,
    `USER · ${r.userText}`,
    `NEX  · ${r.nexText}`,
    ``,
    `  detected_intent        : ${r.detectedIntent}`,
    `  vertical               : ${r.vertical}`,
    `  goal                   : ${r.currentGoal} · ${r.currentGoalStatus}`,
    `  current_reference      : ${r.currentReference}`,
    `  presented_entity_count : ${r.presentedCount}`,
    `  context_preserved      : ${r.previousContextPreserved}`,
    `  world_queried          : ${r.worldQueried ? `yes (${r.worldVertical})` : "no"}`,
    `  action_proposed        : ${r.actionProposed ? "yes" : "no"}`,
    `  adapter_called         : ${r.adapterCalled ? "yes" : "no"}`,
    `  voice_mode             : ${r.voiceMode} · intent=${r.voiceIntent}`,
    `  language_shown         : ${r.languageShown}`,
    `  repeated_previous_reply: ${r.repeated}`,
    `  heard_previous_signal  : ${r.heardPrevious}`,
    `  fabrication_flag       : ${r.fabricated}`,
    ``,
  ].join("\n");
}

async function runConversation(label: string, cid: string, messages: string[]): Promise<string> {
  const lines: string[] = [];
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════");
  lines.push(`  ${label}`);
  lines.push("═══════════════════════════════════════════════════════════════");
  let prevNexText: string | null = null;
  for (let i = 0; i < messages.length; i++) {
    const r = await turn(cid, messages[i], prevNexText);
    lines.push(formatTurn(i, r));
    prevNexText = r.nexText;
  }
  return lines.join("\n");
}

// ─── The four (five) conversations ───────────────────────────

const CONVERSATION_A = [
  "hey nex",
  "i'm bored tonight",
  "something with my girlfriend",
  "maybe dinner",
  "somewhere around malioboro",
  "that second one looks good",
  "what's good about it?",
  "what else do they have?",
  "actually forget dinner",
  "i want to get her something",
  "maybe jewellery",
  "something not too expensive",
  "that one looks nice",
  "can you message the shop?",
];

const CONVERSATION_B = [
  "hey",
  "what should i do today?",
  "maybe somewhere nice",
  "actually i'm hungry",
  "something local",
  "near malioboro",
  "that looks good",
  "what else is around there?",
  "forget food",
  "i need to buy a new phone",
  "nothing too expensive",
];

const CONVERSATION_C = [
  "nex i'm annoyed with my girlfriend",
  "i think i should take her somewhere",
  "maybe somewhere quiet",
  "dinner could work",
  "show me some options",
  "the first one",
  "tell me more",
  "okay",
  "can you message them?",
];

const CONVERSATION_D_INDONESIAN = [
  "hai nex",
  "aku bosen malam ini",
  "mau pergi sama pacarku",
  "mungkin makan malam",
  "yang deket malioboro",
  "yang nomor dua bagus",
  "ada apa lagi di sana?",
  "sebenernya aku mau beliin dia sesuatu",
  "cariin perhiasan",
  "jangan yang mahal banget",
  "yang itu bagus",
  "bisa hubungi tokonya?",
];

const CONVERSATION_D_MIXED = [
  "lagi bosen nih, enaknya ngapain?",
  "maybe dinner aja",
  "yang deket sini",
  "yang nomor dua kayaknya bagus",
];

// ─── Test that runs everything and prints one big report ─────

describe("COMPANION OBSERVATION · four conversations · zero fixes", () => {
  it("runs A + B + C + D + D-mixed and prints the whole transcript", async () => {
    wireRealisticWorld();
    const blocks: string[] = [];
    blocks.push(await runConversation("CONVERSATION A · FRIEND / DATE (EN)", "conv-a", CONVERSATION_A));
    // Reset session state between conversations · they're independent conversations
    _resetSessionsForTests();
    waCallCount.value = 0;
    blocks.push(await runConversation("CONVERSATION B · WANDERING (EN)", "conv-b", CONVERSATION_B));
    _resetSessionsForTests();
    waCallCount.value = 0;
    blocks.push(await runConversation("CONVERSATION C · RELATIONSHIP → REAL WORLD (EN)", "conv-c", CONVERSATION_C));
    _resetSessionsForTests();
    waCallCount.value = 0;
    blocks.push(await runConversation("CONVERSATION D · INDONESIAN", "conv-d", CONVERSATION_D_INDONESIAN));
    _resetSessionsForTests();
    waCallCount.value = 0;
    blocks.push(await runConversation("CONVERSATION D-mixed · CODE-SWITCHING", "conv-d-mixed", CONVERSATION_D_MIXED));
    // eslint-disable-next-line no-console
    console.log(blocks.join("\n"));
  });
});
