// Resolver — permission-safe lookup across contact_id / party_id / search.

import { describe, it, expect, vi, beforeEach } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let loadContactSummaryMock: any;
let searchRows: Array<{ id: string; display_name: string; lifecycle_stage: string; last_activity_at: string | null }> = [];
let contactByPartyRows: Array<{ id: string }> = [];

vi.mock("@/lib/crm/loadContactTimeline", () => ({
  loadContactSummary: (...args: unknown[]) => loadContactSummaryMock(...args)
}));

vi.mock("@/lib/supabaseAdmin", () => {
  const buildBuilder = (rowsGetter: () => unknown) => {
    const builder: {
      _table: string; _limit: number;
      select: () => typeof builder;
      eq: () => typeof builder;
      ilike: () => typeof builder;
      order: () => typeof builder;
      limit: (n: number) => typeof builder;
      maybeSingle: () => Promise<{ data: unknown }>;
      then: (resolve: (v: { data: unknown }) => void) => Promise<void>;
    } = {
      _table: "", _limit: 100,
      select() { return builder; },
      eq()     { return builder; },
      ilike()  { return builder; },
      order()  { return builder; },
      limit(n) { builder._limit = n; return builder; },
      async maybeSingle() {
        const rows = rowsGetter() as Array<unknown>;
        return { data: rows[0] ?? null };
      },
      // Await-as-promise support for `const rows = await q` shape.
      async then(resolve) {
        const rows = rowsGetter() as Array<unknown>;
        resolve({ data: rows.slice(0, builder._limit) });
      }
    };
    return builder;
  };
  return {
    supabaseAdmin: {
      from(table: string) {
        if (table === "app_crm_contacts") {
          // Two paths use this table: party_id lookup (contactByPartyRows)
          // and search (searchRows). Distinguish by presence of `display_name` filter —
          // simpler: use a switch on which rows were set (party takes priority
          // when contactByPartyRows non-empty AND search rows empty).
          const b = buildBuilder(() => contactByPartyRows.length > 0 && searchRows.length === 0 ? contactByPartyRows : searchRows);
          b._table = table;
          return b;
        }
        return buildBuilder(() => []);
      }
    }
  };
});

import { resolveCustomer } from "./resolver";

beforeEach(() => {
  loadContactSummaryMock = vi.fn();
  searchRows = [];
  contactByPartyRows = [];
});

const okSummary = (id = "c1") => ({
  contact: { id, displayName: "Mrs Smith", email: null, whatsappE164: null, postcode: null, lifecycleStage: "active", source: null, tags: [], ownerDisplayName: null, notes: null, lastActivityAt: null, lastTouchAt: null, nextFollowUpAt: null, quietSince: null, partyId: "p1", createdAt: "2026-01-01T00:00:00Z" },
  timeline: [], openTasks: [], totals: { renders: 0, quotesSent: 0, quotesAccepted: 0, jobsSignedOff: 0, reviewsPosted: 0 }
});

describe("resolveCustomer — contact_id", () => {
  it("returns not_yours when loadContactSummary returns null (permission gate)", async () => {
    loadContactSummaryMock.mockResolvedValue(null);
    const r = await resolveCustomer("m1", { kind: "contact_id", id: "cX" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error();
    expect(r.reason).toBe("not_yours");
  });

  it("returns the summary when found", async () => {
    loadContactSummaryMock.mockResolvedValue(okSummary("cA"));
    const r = await resolveCustomer("m1", { kind: "contact_id", id: "cA" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error();
    expect(r.contactId).toBe("cA");
  });
});

describe("resolveCustomer — search", () => {
  it("not_found when empty result set", async () => {
    searchRows = [];
    const r = await resolveCustomer("m1", { kind: "search", query: "Smith" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error();
    expect(r.reason).toBe("not_found");
  });

  it("ambiguous when multiple matches", async () => {
    searchRows = [
      { id: "c1", display_name: "John Smith", lifecycle_stage: "active", last_activity_at: null },
      { id: "c2", display_name: "Jane Smith", lifecycle_stage: "won",    last_activity_at: null }
    ];
    const r = await resolveCustomer("m1", { kind: "search", query: "Smith" });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error();
    expect(r.reason).toBe("ambiguous");
    expect(r.matches?.length).toBe(2);
  });

  it("returns single match summary", async () => {
    searchRows = [{ id: "cSolo", display_name: "Mrs Smith", lifecycle_stage: "active", last_activity_at: null }];
    loadContactSummaryMock.mockResolvedValue(okSummary("cSolo"));
    const r = await resolveCustomer("m1", { kind: "search", query: "Smith" });
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error();
    expect(r.contactId).toBe("cSolo");
  });

  it("empty query returns not_found", async () => {
    const r = await resolveCustomer("m1", { kind: "search", query: "  " });
    expect(r.ok).toBe(false);
  });
});
