// src/lib/nex/friend-edge/friend-edge.test.ts
//
// NEX Y-P3 · Friend Edge state machine + authorization contract tests
// Philip 2026-09-07
//
// Uses an in-process fake for supabaseNexAdmin so we can test every
// state-machine + authorization invariant without requiring the
// migration to be applied. When the real Chromium proof runs against
// Project B, it re-verifies these invariants end-to-end against the
// live database + RLS.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------------------------------------------------------------------------
// In-process fake for supabaseNexAdmin
// ---------------------------------------------------------------------------
// A tiny query builder that supports the exact shape our domain uses.
// Only the .from(...).select/insert/update/eq/or/order/single/maybeSingle
// paths are implemented. Anything else falls through with an explanatory error.

type Row = Record<string, unknown>;
type Table = "nex_friend_invite" | "nex_friend_edge" | "hammerex_nex_users";

const state = {
  users:   [] as Row[],
  invites: [] as Row[],
  edges:   [] as Row[],
};

function nextId() { return crypto.randomUUID(); }

function fakeAdmin() {
  return {
    from(t: Table) {
      const store =
        t === "hammerex_nex_users" ? state.users :
        t === "nex_friend_invite"  ? state.invites :
        t === "nex_friend_edge"    ? state.edges  :
        null;
      if (!store) throw new Error(`fakeAdmin: unknown table ${t}`);

      const state1 = { filters: [] as Array<(r: Row) => boolean>, orderCol: null as string | null, orderAsc: true, orNode: null as string | null };
      const applyFilters = () => {
        let rows = store.slice();
        for (const f of state1.filters) rows = rows.filter(f);
        if (state1.orNode) {
          // .or("user_low.eq.<x>,user_high.eq.<x>") shape
          const clauses = state1.orNode.split(",").map((s) => s.trim());
          rows = rows.filter((r) =>
            clauses.some((c) => {
              const [col, op, val] = c.split(".");
              return op === "eq" && r[col] === val;
            })
          );
        }
        if (state1.orderCol) {
          rows = rows.slice().sort((a, b) => {
            const av = String(a[state1.orderCol!] ?? ""); const bv = String(b[state1.orderCol!] ?? "");
            return state1.orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
          });
        }
        return rows;
      };

      const chain: {
        select: (_cols?: string) => any;
        insert: (v: Row) => any;
        update: (patch: Row) => any;
        eq: (col: string, val: unknown) => any;
        or: (expr: string) => any;
        order: (col: string, opts?: { ascending?: boolean }) => any;
        maybeSingle: () => Promise<{ data: Row | null; error: null }>;
        single: () => Promise<{ data: Row | null; error: { message: string; code?: string } | null }>;
        then?: never;
      } = {
        select() { return chain; },
        insert(v: Row) {
          // We defer the actual insert until .single() so uniqueness checks
          // can be exercised. Store the payload here.
          (chain as any)._pendingInsert = v;
          return chain;
        },
        update(patch: Row) {
          (chain as any)._pendingUpdate = patch;
          return chain;
        },
        eq(col: string, val: unknown) {
          state1.filters.push((r) => r[col] === val);
          return chain;
        },
        or(expr: string) {
          state1.orNode = expr;
          return chain;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          state1.orderCol = col;
          state1.orderAsc = opts?.ascending !== false;
          // Order returns a promise-like when awaited without single/maybeSingle
          return {
            ...chain,
            then(resolve: (v: { data: Row[]; error: null }) => void) {
              resolve({ data: applyFilters(), error: null });
            },
          };
        },
        async maybeSingle() {
          const rows = applyFilters();
          return { data: rows[0] ?? null, error: null };
        },
        async single() {
          const pendingInsert = (chain as any)._pendingInsert as Row | undefined;
          const pendingUpdate = (chain as any)._pendingUpdate as Row | undefined;

          if (pendingInsert) {
            // Enforce partial-unique index: for nex_friend_invite there is
            // one PENDING row per (sender, recipient). For nex_friend_edge
            // one row per (user_low, user_high).
            if (t === "nex_friend_invite" && pendingInsert.status === "PENDING") {
              const dup = store.some((r) => r.status === "PENDING" && r.sender_user_id === pendingInsert.sender_user_id && r.recipient_user_id === pendingInsert.recipient_user_id);
              if (dup) return { data: null, error: { code: "23505", message: "duplicate key" } };
            }
            if (t === "nex_friend_edge") {
              const dup = store.some((r) => r.user_low === pendingInsert.user_low && r.user_high === pendingInsert.user_high);
              if (dup) return { data: null, error: { code: "23505", message: "duplicate key" } };
            }
            const now = new Date().toISOString();
            const row: Row = {
              id: nextId(),
              created_at: now,
              updated_at: now,
              ...pendingInsert,
              ...(t === "nex_friend_invite" && !("status" in pendingInsert) ? { status: "PENDING" } : {}),
              ...(t === "nex_friend_edge" && !("connected_at" in pendingInsert) ? { connected_at: now } : {}),
              ...(t === "nex_friend_invite" && !("responded_at" in pendingInsert) ? { responded_at: null } : {}),
              ...(t === "nex_friend_invite" && !("meeting_pref" in pendingInsert) ? { meeting_pref: null } : {}),
            };
            store.push(row);
            return { data: row, error: null };
          }

          if (pendingUpdate) {
            const rows = applyFilters();
            if (rows.length === 0) return { data: null, error: null };
            const row = rows[0];
            Object.assign(row, pendingUpdate, { updated_at: new Date().toISOString() });
            return { data: row, error: null };
          }

          const rows = applyFilters();
          return { data: rows[0] ?? null, error: null };
        },
      };
      return chain;
    },
  };
}

vi.mock("@/lib/supabaseNexAdmin", () => ({
  get supabaseNexAdmin() { return fakeAdmin(); },
}));

// ---------------------------------------------------------------------------
// Now import the module under test
// ---------------------------------------------------------------------------

import {
  createInvite,
  respondToInvite,
  revokeInvite,
  listIncomingInvites,
  listOutgoingInvites,
  listFriends,
  isFriend,
  canonicalPair,
} from "./friend-edge";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
const C = "33333333-3333-3333-3333-333333333333";

function seedActiveUser(id: string) {
  state.users.push({ supabase_user_id: id, status: "active" });
}

beforeEach(() => {
  state.users.length = 0;
  state.invites.length = 0;
  state.edges.length = 0;
  seedActiveUser(A);
  seedActiveUser(B);
  seedActiveUser(C);
});

// ---------------------------------------------------------------------------
// canonicalPair
// ---------------------------------------------------------------------------

describe("canonicalPair", () => {
  it("orders lexicographically regardless of input order", () => {
    expect(canonicalPair(A, B)).toEqual({ low: A, high: B });
    expect(canonicalPair(B, A)).toEqual({ low: A, high: B });
  });
});

// ---------------------------------------------------------------------------
// createInvite
// ---------------------------------------------------------------------------

describe("createInvite", () => {
  it("A → B succeeds with a PENDING invite", async () => {
    const r = await createInvite({ actor_user_id: A, recipient_user_id: B, meeting_pref: "coffee" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.sender_user_id).toBe(A);
      expect(r.value.recipient_user_id).toBe(B);
      expect(r.value.status).toBe("PENDING");
      expect(r.value.meeting_pref).toBe("coffee");
    }
  });

  it("rejects self-invite", async () => {
    const r = await createInvite({ actor_user_id: A, recipient_user_id: A });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it("rejects non-registered recipient", async () => {
    const r = await createInvite({ actor_user_id: A, recipient_user_id: "44444444-4444-4444-4444-444444444444" });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(404); expect(r.error).toMatch(/recipient_not_a_registered/); }
  });

  it("rejects duplicate PENDING invite from same sender to same recipient (409)", async () => {
    const first = await createInvite({ actor_user_id: A, recipient_user_id: B });
    expect(first.ok).toBe(true);
    const dup = await createInvite({ actor_user_id: A, recipient_user_id: B });
    expect(dup.ok).toBe(false);
    if (!dup.ok) { expect(dup.status).toBe(409); expect(dup.error).toMatch(/invite_already_pending/); }
  });

  it("rejects invite when friendship already exists (already_friends)", async () => {
    // Accept a friendship first
    const inv = await createInvite({ actor_user_id: A, recipient_user_id: B });
    expect(inv.ok).toBe(true);
    if (inv.ok) {
      const resp = await respondToInvite({ actor_user_id: B, invite_id: inv.value.id, decision: "ACCEPT" });
      expect(resp.ok).toBe(true);
    }
    const second = await createInvite({ actor_user_id: A, recipient_user_id: B });
    expect(second.ok).toBe(false);
    if (!second.ok) { expect(second.status).toBe(409); expect(second.error).toBe("already_friends"); }
  });

  it("rejects non-uuid actor/recipient", async () => {
    const r1 = await createInvite({ actor_user_id: "not-a-uuid", recipient_user_id: B });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.status).toBe(400);
    const r2 = await createInvite({ actor_user_id: A, recipient_user_id: "still-not-a-uuid" });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// respondToInvite
// ---------------------------------------------------------------------------

describe("respondToInvite", () => {
  async function seedInvite() {
    const r = await createInvite({ actor_user_id: A, recipient_user_id: B, meeting_pref: "walk" });
    if (!r.ok) throw new Error("seedInvite failed");
    return r.value;
  }

  it("recipient can ACCEPT · creates canonical friend edge", async () => {
    const inv = await seedInvite();
    const r = await respondToInvite({ actor_user_id: B, invite_id: inv.id, decision: "ACCEPT" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.invite.status).toBe("ACCEPTED");
      expect(r.value.edge).not.toBeNull();
      expect(r.value.edge!.user_low).toBe(A);   // A < B lexicographically
      expect(r.value.edge!.user_high).toBe(B);
      expect(r.value.edge!.meeting_pref).toBe("walk");
      expect(r.value.edge!.origin_invite_id).toBe(inv.id);
    }
  });

  it("recipient can DECLINE · NO friend edge created", async () => {
    const inv = await seedInvite();
    const r = await respondToInvite({ actor_user_id: B, invite_id: inv.id, decision: "DECLINE" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.invite.status).toBe("DECLINED");
      expect(r.value.edge).toBeNull();
    }
    expect(await isFriend(A, B)).toBe(false);
  });

  it("SENDER cannot accept their own invite (403)", async () => {
    const inv = await seedInvite();
    const r = await respondToInvite({ actor_user_id: A, invite_id: inv.id, decision: "ACCEPT" });
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.status).toBe(403); expect(r.error).toBe("only_the_recipient_may_respond"); }
  });

  it("UNRELATED user cannot respond (403)", async () => {
    const inv = await seedInvite();
    const r = await respondToInvite({ actor_user_id: C, invite_id: inv.id, decision: "ACCEPT" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("re-accepting an ACCEPTED invite fails 409", async () => {
    const inv = await seedInvite();
    const first = await respondToInvite({ actor_user_id: B, invite_id: inv.id, decision: "ACCEPT" });
    expect(first.ok).toBe(true);
    const second = await respondToInvite({ actor_user_id: B, invite_id: inv.id, decision: "ACCEPT" });
    expect(second.ok).toBe(false);
    if (!second.ok) { expect(second.status).toBe(409); expect(second.error).toMatch(/status_is/); }
  });

  it("declining then accepting the SAME invite fails 409 (immutable resolution)", async () => {
    const inv = await seedInvite();
    const declined = await respondToInvite({ actor_user_id: B, invite_id: inv.id, decision: "DECLINE" });
    expect(declined.ok).toBe(true);
    const flip = await respondToInvite({ actor_user_id: B, invite_id: inv.id, decision: "ACCEPT" });
    expect(flip.ok).toBe(false);
    if (!flip.ok) expect(flip.status).toBe(409);
  });

  it("unknown invite id → 404", async () => {
    const r = await respondToInvite({ actor_user_id: B, invite_id: "99999999-9999-9999-9999-999999999999", decision: "ACCEPT" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// revokeInvite
// ---------------------------------------------------------------------------

describe("revokeInvite", () => {
  it("sender can revoke a PENDING invite", async () => {
    const inv = (await createInvite({ actor_user_id: A, recipient_user_id: B })) as any;
    const r = await revokeInvite({ actor_user_id: A, invite_id: inv.value.id });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.status).toBe("REVOKED");
  });
  it("recipient cannot revoke (403)", async () => {
    const inv = (await createInvite({ actor_user_id: A, recipient_user_id: B })) as any;
    const r = await revokeInvite({ actor_user_id: B, invite_id: inv.value.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
  it("cannot revoke a non-PENDING invite", async () => {
    const inv = (await createInvite({ actor_user_id: A, recipient_user_id: B })) as any;
    await respondToInvite({ actor_user_id: B, invite_id: inv.value.id, decision: "ACCEPT" });
    const r = await revokeInvite({ actor_user_id: A, invite_id: inv.value.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

describe("read helpers", () => {
  it("listIncomingInvites scopes to caller", async () => {
    await createInvite({ actor_user_id: A, recipient_user_id: B });
    await createInvite({ actor_user_id: C, recipient_user_id: B });
    await createInvite({ actor_user_id: A, recipient_user_id: C }); // NOT for B
    const r = await listIncomingInvites(B);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.length).toBe(2);
      for (const inv of r.value) expect(inv.recipient_user_id).toBe(B);
    }
  });

  it("listOutgoingInvites scopes to caller", async () => {
    await createInvite({ actor_user_id: A, recipient_user_id: B });
    await createInvite({ actor_user_id: A, recipient_user_id: C });
    await createInvite({ actor_user_id: C, recipient_user_id: B }); // NOT from A
    const r = await listOutgoingInvites(A);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.length).toBe(2);
      for (const inv of r.value) expect(inv.sender_user_id).toBe(A);
    }
  });

  it("listFriends returns edges scoped to caller from either side", async () => {
    const inv = (await createInvite({ actor_user_id: A, recipient_user_id: B })) as any;
    await respondToInvite({ actor_user_id: B, invite_id: inv.value.id, decision: "ACCEPT" });
    const forA = await listFriends(A);
    const forB = await listFriends(B);
    const forC = await listFriends(C);
    expect(forA.ok && forA.value.length).toBe(1);
    expect(forB.ok && forB.value.length).toBe(1);
    expect(forC.ok && forC.value.length).toBe(0);
  });

  it("isFriend true after ACCEPT, false after DECLINE, false for strangers", async () => {
    expect(await isFriend(A, B)).toBe(false);
    const inv = (await createInvite({ actor_user_id: A, recipient_user_id: B })) as any;
    await respondToInvite({ actor_user_id: B, invite_id: inv.value.id, decision: "ACCEPT" });
    expect(await isFriend(A, B)).toBe(true);
    expect(await isFriend(B, A)).toBe(true);  // symmetric
    expect(await isFriend(A, C)).toBe(false);
    expect(await isFriend(A, A)).toBe(false); // self is not a friend
  });
});
