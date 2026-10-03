// src/lib/nex-native/__tests__/vault-entry-service.test.ts
//
// Stage 3 · founder-sealed vault-build-plan-2026-10-03.
// Proves the key D1 invariants:
//   · move-conversation requires participation; move-friend requires accepted edge
//   · idempotent moves (upsert semantics)
//   · "outside vault" filters hide BOTH explicit convs AND conversations
//     with a vaulted friend
//   · "inside vault" lists deduplicate conv-with-vaulted-friend against
//     the whole-friend row
//
// Supabase admin is mocked via vi.mock. Peer/friend services are mocked
// at the module boundary so we drive the inputs deterministically.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── mock peer-conversation-service and friend-service ──────────────────
// Use vi.hoisted so the mock bodies exist before the hoisted vi.mock calls.
const { peerSvcMock, friendSvcMock } = vi.hoisted(() => ({
  peerSvcMock: {
    isPeerConversationParticipant: vi.fn(),
    listPeerConversationsForAccount: vi.fn(),
  },
  friendSvcMock: {
    listFriends: vi.fn(),
  },
}));

vi.mock("../peer-conversation-service", () => peerSvcMock);
vi.mock("../friend-service", () => friendSvcMock);

// ─── mock supabase-admin store ──────────────────────────────────────────
interface Row {
  id: string;
  account_id: string;
  entry_kind: "conversation" | "friend";
  ref_id: string;
  moved_at: string;
}

const store = {
  rows: [] as Row[],
};

let rowSeq = 0;
function nextId() {
  return `vault-row-${++rowSeq}`;
}

vi.mock("../supabase-admin", () => {
  interface SelectFilter {
    col: string;
    val: unknown;
  }
  const makeBuilder = () => {
    const state: {
      op: "select" | "insert" | "upsert" | "delete";
      payload: Partial<Row> | null;
      filters: SelectFilter[];
      _onConflict?: string;
    } = { op: "select", payload: null, filters: [] };

    const builder = {
      select: () => builder,
      insert: (p: Partial<Row>) => {
        state.op = "insert";
        state.payload = p;
        return builder;
      },
      upsert: (p: Partial<Row>, opts?: { onConflict?: string }) => {
        state.op = "upsert";
        state.payload = p;
        state._onConflict = opts?.onConflict;
        return builder;
      },
      delete: () => {
        state.op = "delete";
        return builder;
      },
      eq: (col: string, val: unknown) => {
        state.filters.push({ col, val });
        return builder;
      },
      order: () => builder,
      maybeSingle: async () => {
        const match = store.rows.find((r) =>
          state.filters.every((f) => (r as unknown as Record<string, unknown>)[f.col] === f.val),
        );
        return { data: match ?? null, error: null };
      },
      single: async () => {
        if (state.op === "insert" || state.op === "upsert") {
          const payload = state.payload!;
          const existing = store.rows.find(
            (r) =>
              r.account_id === payload.account_id &&
              r.entry_kind === payload.entry_kind &&
              r.ref_id === payload.ref_id,
          );
          if (existing) return { data: existing, error: null };
          const row: Row = {
            id: nextId(),
            account_id: payload.account_id!,
            entry_kind: payload.entry_kind!,
            ref_id: payload.ref_id!,
            moved_at: new Date().toISOString(),
          };
          store.rows.push(row);
          return { data: row, error: null };
        }
        return { data: null, error: null };
      },
      // Terminal awaits for queries that don't call .single()/.maybeSingle()
      then: (resolve: (v: { data: Row[]; error: null }) => void) => {
        if (state.op === "delete") {
          const before = store.rows.length;
          store.rows = store.rows.filter(
            (r) => !state.filters.every((f) =>
              (r as unknown as Record<string, unknown>)[f.col] === f.val,
            ),
          );
          void before;
          resolve({ data: [], error: null });
          return;
        }
        const matches = store.rows.filter((r) =>
          state.filters.every((f) =>
            (r as unknown as Record<string, unknown>)[f.col] === f.val,
          ),
        );
        resolve({ data: matches, error: null });
      },
    };
    return builder;
  };
  return {
    nexSupabaseAdmin: {
      from: () => makeBuilder(),
    },
  };
});

// ─── import after mocks are registered ──────────────────────────────────
import * as vault from "../vault-entry-service";

const VIEWER = "viewer-01";
const FRIEND_A = "friend-a";
const FRIEND_B = "friend-b";
const CONV_WITH_A = "conv-a";
const CONV_WITH_B = "conv-b";

beforeEach(() => {
  store.rows = [];
  rowSeq = 0;
  peerSvcMock.isPeerConversationParticipant.mockReset();
  peerSvcMock.listPeerConversationsForAccount.mockReset();
  friendSvcMock.listFriends.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────
describe("moveConversationToVault", () => {
  it("inserts a row when the viewer is a participant", async () => {
    peerSvcMock.isPeerConversationParticipant.mockResolvedValue(true);
    const row = await vault.moveConversationToVault(VIEWER, CONV_WITH_A);
    expect(row.account_id).toBe(VIEWER);
    expect(row.entry_kind).toBe("conversation");
    expect(row.ref_id).toBe(CONV_WITH_A);
    expect(store.rows).toHaveLength(1);
  });

  it("is idempotent · second call returns the existing row", async () => {
    peerSvcMock.isPeerConversationParticipant.mockResolvedValue(true);
    const r1 = await vault.moveConversationToVault(VIEWER, CONV_WITH_A);
    const r2 = await vault.moveConversationToVault(VIEWER, CONV_WITH_A);
    expect(r1.id).toBe(r2.id);
    expect(store.rows).toHaveLength(1);
  });

  it("rejects when the viewer is not a participant", async () => {
    peerSvcMock.isPeerConversationParticipant.mockResolvedValue(false);
    await expect(
      vault.moveConversationToVault(VIEWER, CONV_WITH_A),
    ).rejects.toThrow(/not a participant/);
    expect(store.rows).toHaveLength(0);
  });
});

describe("moveFriendToVault", () => {
  it("inserts a row when an accepted friendship exists", async () => {
    friendSvcMock.listFriends.mockResolvedValue([FRIEND_A, FRIEND_B]);
    const row = await vault.moveFriendToVault(VIEWER, FRIEND_A);
    expect(row.entry_kind).toBe("friend");
    expect(row.ref_id).toBe(FRIEND_A);
    expect(store.rows).toHaveLength(1);
  });

  it("rejects when there is no accepted friendship", async () => {
    friendSvcMock.listFriends.mockResolvedValue([]);
    await expect(
      vault.moveFriendToVault(VIEWER, FRIEND_A),
    ).rejects.toThrow(/no accepted friendship/);
  });

  it("rejects self-vault", async () => {
    friendSvcMock.listFriends.mockResolvedValue([VIEWER]);
    await expect(
      vault.moveFriendToVault(VIEWER, VIEWER),
    ).rejects.toThrow(/cannot move self/);
  });

  it("is idempotent", async () => {
    friendSvcMock.listFriends.mockResolvedValue([FRIEND_A]);
    const r1 = await vault.moveFriendToVault(VIEWER, FRIEND_A);
    const r2 = await vault.moveFriendToVault(VIEWER, FRIEND_A);
    expect(r1.id).toBe(r2.id);
    expect(store.rows).toHaveLength(1);
  });
});

describe("remove operations", () => {
  it("removeConversationFromVault deletes the viewer's row only", async () => {
    peerSvcMock.isPeerConversationParticipant.mockResolvedValue(true);
    await vault.moveConversationToVault(VIEWER, CONV_WITH_A);
    expect(store.rows).toHaveLength(1);
    await vault.removeConversationFromVault(VIEWER, CONV_WITH_A);
    expect(store.rows).toHaveLength(0);
  });

  it("removeFriendFromVault deletes the viewer's row only", async () => {
    friendSvcMock.listFriends.mockResolvedValue([FRIEND_A]);
    await vault.moveFriendToVault(VIEWER, FRIEND_A);
    expect(store.rows).toHaveLength(1);
    await vault.removeFriendFromVault(VIEWER, FRIEND_A);
    expect(store.rows).toHaveLength(0);
  });

  it("remove scoped to viewer · unauth remove is a no-op not a cross-account delete", async () => {
    peerSvcMock.isPeerConversationParticipant.mockResolvedValue(true);
    await vault.moveConversationToVault(VIEWER, CONV_WITH_A);
    // Simulate a different viewer attempting a remove.
    await vault.removeConversationFromVault("other-viewer", CONV_WITH_A);
    expect(store.rows).toHaveLength(1);
  });
});

describe("listMainInboxConversationsForAccount · outside-vault filter", () => {
  function conv(id: string, peerId: string) {
    return {
      id,
      participant_a_id: VIEWER < peerId ? VIEWER : peerId,
      participant_b_id: VIEWER < peerId ? peerId : VIEWER,
      created_at: "2026-01-01T00:00:00Z",
      last_message_at: "2026-01-02T00:00:00Z",
    };
  }

  it("hides conversations with an explicit conversation-vault entry", async () => {
    peerSvcMock.listPeerConversationsForAccount.mockResolvedValue([
      conv(CONV_WITH_A, FRIEND_A),
      conv(CONV_WITH_B, FRIEND_B),
    ]);
    peerSvcMock.isPeerConversationParticipant.mockResolvedValue(true);
    await vault.moveConversationToVault(VIEWER, CONV_WITH_A);
    const inbox = await vault.listMainInboxConversationsForAccount(VIEWER);
    expect(inbox.map((c) => c.id)).toEqual([CONV_WITH_B]);
  });

  it("hides every conversation with a whole-friend-vault entry", async () => {
    peerSvcMock.listPeerConversationsForAccount.mockResolvedValue([
      conv(CONV_WITH_A, FRIEND_A),
      conv(CONV_WITH_B, FRIEND_B),
    ]);
    friendSvcMock.listFriends.mockResolvedValue([FRIEND_A, FRIEND_B]);
    await vault.moveFriendToVault(VIEWER, FRIEND_A);
    const inbox = await vault.listMainInboxConversationsForAccount(VIEWER);
    expect(inbox.map((c) => c.id)).toEqual([CONV_WITH_B]);
  });
});

describe("listMainContactsFriendIdsForAccount · outside-vault friend filter", () => {
  it("hides vaulted friend ids from the contacts list", async () => {
    friendSvcMock.listFriends.mockResolvedValue([FRIEND_A, FRIEND_B]);
    await vault.moveFriendToVault(VIEWER, FRIEND_A);
    const visible = await vault.listMainContactsFriendIdsForAccount(VIEWER);
    expect(visible).toEqual([FRIEND_B]);
  });
});

describe("listVaultedConversationsForAccount · inside-vault list", () => {
  function conv(id: string, peerId: string) {
    return {
      id,
      participant_a_id: VIEWER < peerId ? VIEWER : peerId,
      participant_b_id: VIEWER < peerId ? peerId : VIEWER,
      created_at: "2026-01-01T00:00:00Z",
      last_message_at: "2026-01-02T00:00:00Z",
    };
  }

  it("includes explicit per-conversation vault entries", async () => {
    peerSvcMock.listPeerConversationsForAccount.mockResolvedValue([
      conv(CONV_WITH_A, FRIEND_A),
      conv(CONV_WITH_B, FRIEND_B),
    ]);
    peerSvcMock.isPeerConversationParticipant.mockResolvedValue(true);
    await vault.moveConversationToVault(VIEWER, CONV_WITH_A);
    const inside = await vault.listVaultedConversationsForAccount(VIEWER);
    expect(inside.map((v) => v.conversation.id)).toEqual([CONV_WITH_A]);
  });

  it("includes every conversation with a whole-friend-vault entry", async () => {
    peerSvcMock.listPeerConversationsForAccount.mockResolvedValue([
      conv(CONV_WITH_A, FRIEND_A),
      conv(CONV_WITH_B, FRIEND_B),
    ]);
    friendSvcMock.listFriends.mockResolvedValue([FRIEND_A]);
    await vault.moveFriendToVault(VIEWER, FRIEND_A);
    const inside = await vault.listVaultedConversationsForAccount(VIEWER);
    expect(inside.map((v) => v.conversation.id)).toEqual([CONV_WITH_A]);
  });

  it("does not double-count a conv that is BOTH explicitly vaulted AND whose peer is a vaulted friend", async () => {
    peerSvcMock.listPeerConversationsForAccount.mockResolvedValue([
      conv(CONV_WITH_A, FRIEND_A),
    ]);
    peerSvcMock.isPeerConversationParticipant.mockResolvedValue(true);
    friendSvcMock.listFriends.mockResolvedValue([FRIEND_A]);
    await vault.moveConversationToVault(VIEWER, CONV_WITH_A);
    await vault.moveFriendToVault(VIEWER, FRIEND_A);
    const inside = await vault.listVaultedConversationsForAccount(VIEWER);
    expect(inside).toHaveLength(1);
    expect(inside[0]!.conversation.id).toBe(CONV_WITH_A);
  });
});
