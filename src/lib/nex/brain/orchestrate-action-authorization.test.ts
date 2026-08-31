// src/lib/nex/brain/orchestrate-action-authorization.test.ts
//
// Stage 3.37 · orchestrateChatTurnLive · full conversation script
// (Philip 2026-08-31).
//
// Proves the acceptance criteria that require the orchestrator to
// thread session state across turns:
//   · turn 1 (action verb) → AWAIT_CONFIRMATION · adapter NEVER called
//   · turn 2 (yes)         → GRANTED · adapter called ONCE · UNKNOWN reply (stub adapter, honest)
//   · turn 3 (yes again)   → REPLAY GUARD · adapter NOT called again
//   · decline flow         → BLOCKED reply · adapter never called
//   · ambiguous flow       → reprompt · adapter never called
//   · missing evidence     → BLOCKED before proposal · adapter never called

import { describe, expect, it, vi, beforeEach } from "vitest";

const { searchMock } = vi.hoisted(() => ({ searchMock: vi.fn() }));

vi.mock("./world-adapters", async () => {
  const actual = await vi.importActual<typeof import("./world-adapters")>("./world-adapters");
  return { ...actual, searchWorld: searchMock };
});

// Hoisted adapter spy so we can inspect call counts across turns.
const { adapterCallCount } = vi.hoisted(() => ({ adapterCallCount: { value: 0 } }));

vi.mock("./adapters/whatsapp-stub", async () => {
  return {
    whatsappStubAdapter: {
      kind: "contact_via_whatsapp",
      execute: async () => {
        adapterCallCount.value += 1;
        return {
          kind: "accepted",
          pending: { correlationId: "corr_test", awaitingKind: "not_wired", reason: "test stub" },
        };
      },
    },
  };
});

import { orchestrateChatTurnLive } from "./orchestrate";
import { _resetSessionsForTests, getSession } from "./session";
import { findSuccessLanguageLeaks } from "./action-composer";
import type { WorldRecord } from "./world-adapters/types";

beforeEach(() => {
  searchMock.mockReset();
  _resetSessionsForTests();
  adapterCallCount.value = 0;
});

function fakeHotel(name: string, refId: string, whatsapp: string | undefined): WorldRecord {
  return {
    id: refId,
    name,
    vertical: "accommodation",
    market: "ID",
    category: "hotel",
    city: "Yogyakarta",
    area: "malioboro",
    whatsapp,
    rating: 4.3,
    reviewCount: 100,
    latitude: -7.79,
    longitude: 110.36,
    claimStatus: "listed",
    verified: false,
    provenance: { sourceKey: "nex.accommodation_business", sourceTier: "directory_live", readAt: "2026-08-31T00:00:00Z" },
  };
}

describe("full conversation · action authorization dance", () => {
  it("Turn 1 (find hotels) · Turn 2 (message the first) → AWAIT · adapter not called · Turn 3 (yes) → adapter called ONCE · Turn 4 (yes again) → replay guard", async () => {
    searchMock.mockResolvedValue({
      records: [
        fakeHotel("Gaotama Hotel", "biz_gaotama", "+62 812 3456 7890"),
        fakeHotel("Griya Sentana", "biz_griya", "+62 813 9999 0000"),
        fakeHotel("Indonesia Hotel", "biz_ind", "+62 814 1111 2222"),
      ],
      totalAvailable: 3,
    });

    const cid = "conv-action-1";

    // Turn 1 · discovery
    const t1 = await orchestrateChatTurnLive(
      "I need a hotel near Malioboro",
      { userMarket: "ID", conversationId: cid, useLiveWorld: true },
    );
    expect(adapterCallCount.value).toBe(0);
    expect(t1.reply.length).toBeGreaterThan(0);

    // Turn 2 · action verb + ordinal reference · MUST propose, not execute
    const t2 = await orchestrateChatTurnLive(
      "message the first one and ask about tonight",
      { userMarket: "ID", conversationId: cid, useLiveWorld: true },
    );
    expect(adapterCallCount.value).toBe(0);        // <-- CRITICAL: no adapter call before auth
    expect(t2.reply).toMatch(/Shall I send it\?/); // proposal prompt
    // Never a success word in the proposal prompt
    expect(findSuccessLanguageLeaks(t2.reply)).toEqual([]);
    const session2 = getSession(cid);
    expect(session2?.pendingProposal?.status).toBe("AWAITING");
    expect(session2?.pendingProposal?.kind).toBe("contact_via_whatsapp");
    expect(session2?.pendingProposal?.target.canonical).toBe("Gaotama Hotel");

    // Turn 3 · user says "yes" · GRANTED · adapter called ONCE · UNKNOWN reply
    const t3 = await orchestrateChatTurnLive(
      "yes send it",
      { userMarket: "ID", conversationId: cid, useLiveWorld: true },
    );
    expect(adapterCallCount.value).toBe(1);
    expect(t3.action_audit?.finalState).toBe("UNKNOWN");
    // Reply must be the HONEST UNKNOWN phrasing · never claims success
    expect(findSuccessLanguageLeaks(t3.reply)).toEqual([]);
    expect(t3.reply.toLowerCase()).toContain("don't have delivery confirmation");
    const session3 = getSession(cid);
    expect(session3?.pendingProposal?.status).toBe("CONSUMED");

    // Turn 4 · REPLAY GUARD · user says "yes" again · adapter must NOT fire
    const t4 = await orchestrateChatTurnLive(
      "yes",
      { userMarket: "ID", conversationId: cid, useLiveWorld: true },
    );
    expect(adapterCallCount.value).toBe(1);   // still ONE — no re-execution
    // Reply must NOT claim success and must be honest about the state
    expect(findSuccessLanguageLeaks(t4.reply)).toEqual([]);
  });

  it("decline flow · 'no' → BLOCKED · adapter never called", async () => {
    searchMock.mockResolvedValue({
      records: [fakeHotel("Gaotama Hotel", "biz_gaotama", "+62 812 3456 7890")],
      totalAvailable: 1,
    });
    const cid = "conv-action-decline";

    await orchestrateChatTurnLive("hotels near Malioboro", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const t2 = await orchestrateChatTurnLive(
      "message the first one",
      { userMarket: "ID", conversationId: cid, useLiveWorld: true },
    );
    expect(adapterCallCount.value).toBe(0);
    expect(t2.reply).toMatch(/Shall I send it\?/);

    const t3 = await orchestrateChatTurnLive(
      "no, don't send",
      { userMarket: "ID", conversationId: cid, useLiveWorld: true },
    );
    expect(adapterCallCount.value).toBe(0);
    expect(t3.reply.toLowerCase()).toContain("won't send anything");
    expect(findSuccessLanguageLeaks(t3.reply)).toEqual([]);
  });

  it("ambiguous confirmation · 'okay' → reprompt · adapter never called", async () => {
    searchMock.mockResolvedValue({
      records: [fakeHotel("Gaotama Hotel", "biz_gaotama", "+62 812 3456 7890")],
      totalAvailable: 1,
    });
    const cid = "conv-action-ambig";

    await orchestrateChatTurnLive("hotels near Malioboro", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    await orchestrateChatTurnLive("message the first one", { userMarket: "ID", conversationId: cid, useLiveWorld: true });

    const t3 = await orchestrateChatTurnLive("okay", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    expect(adapterCallCount.value).toBe(0);
    expect(t3.reply.toLowerCase()).toMatch(/couldn't tell|clear "yes" or "no"/);
    // Pending proposal remains for the next turn
    expect(getSession(cid)?.pendingProposal?.status).toBe("AWAITING");
  });

  it("missing contact evidence · adapter never called · never asks 'shall I send?'", async () => {
    searchMock.mockResolvedValue({
      records: [fakeHotel("NoContact Inn", "biz_nc", undefined)],  // no whatsapp
      totalAvailable: 1,
    });
    const cid = "conv-action-nocontact";

    await orchestrateChatTurnLive("hotels near Malioboro", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const t2 = await orchestrateChatTurnLive(
      "message the first one",
      { userMarket: "ID", conversationId: cid, useLiveWorld: true },
    );
    expect(adapterCallCount.value).toBe(0);
    expect(t2.reply.toLowerCase()).toContain("won't guess a number");
    // MUST NOT include a confirmation prompt · nothing valid to send
    expect(t2.reply).not.toMatch(/Shall I send it\?/);
    // No pending proposal created
    expect(getSession(cid)?.pendingProposal).toBeUndefined();
  });

  it("Indonesian confirmation · 'iya kirim' → GRANTED · adapter called · UNKNOWN reply in ID", async () => {
    searchMock.mockResolvedValue({
      records: [fakeHotel("Gaotama Hotel", "biz_gaotama", "+62 812 3456 7890")],
      totalAvailable: 1,
    });
    const cid = "conv-action-id";

    await orchestrateChatTurnLive("hotel dekat malioboro", { userMarket: "ID", conversationId: cid, useLiveWorld: true });
    const t2 = await orchestrateChatTurnLive(
      "hubungi yang pertama",
      { userMarket: "ID", conversationId: cid, useLiveWorld: true },
    );
    expect(adapterCallCount.value).toBe(0);
    // ID proposal prompt
    expect(t2.reply).toMatch(/Kirim\?/);

    const t3 = await orchestrateChatTurnLive(
      "iya kirim",
      { userMarket: "ID", conversationId: cid, useLiveWorld: true },
    );
    expect(adapterCallCount.value).toBe(1);
    expect(t3.action_audit?.finalState).toBe("UNKNOWN");
    // ID reply must never claim success
    expect(findSuccessLanguageLeaks(t3.reply)).toEqual([]);
    expect(t3.reply).toContain("belum ada konfirmasi");
  });
});
