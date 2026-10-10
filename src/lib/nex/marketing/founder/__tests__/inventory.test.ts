// src/lib/nex/marketing/founder/__tests__/inventory.test.ts
//
// Email Storage inventory acceptance · Founder-authorised UI wave 2026-09-21.
// Verifies: aggregate-only response · no addresses · lane canaries · read-only.

import { describe, it, expect, beforeEach } from "vitest";
import type { PoolClient, QueryResult } from "pg";
import { loadEmailStorageInventory, _EMAIL_STORAGE_INVENTORY_BOUNDARY, FounderAccessError, type FounderAuthContext } from "..";

type Store = {
  contacts: Array<{
    contact_id: string; email: string; country: string; category_group: string | null;
    category_slug: string | null; language: string;
    opt_out: boolean; hard_bounced: boolean; complaint_count: number;
    source_tables: string[]; first_seen_at: string; last_seen_at: string;
  }>;
  member_package_touched: boolean;
  send_queue_written: boolean;
};

function makePool() {
  const store: Store = { contacts: [], member_package_touched: false, send_queue_written: false };

  const client: PoolClient = {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.trim().replace(/\s+/g, " ");

      // Canaries · inventory must never touch these
      if (/marketing_package/i.test(norm)) store.member_package_touched = true;
      if (/marketing_send_queue|marketing_operating_budget/i.test(norm)) store.send_queue_written = true;

      // Aggregate totals + suppression + last-seen
      if (/^SELECT COUNT\(\*\)::int AS total, COUNT\(DISTINCT LOWER\(email\)\)::int AS distinct_lower_email/i.test(norm)) {
        const total = store.contacts.length;
        const distinctSet = new Set(store.contacts.map(c => c.email.toLowerCase()));
        const notSup = store.contacts.filter(c => !c.opt_out && !c.hard_bounced && c.complaint_count === 0).length;
        const optOut = store.contacts.filter(c => c.opt_out).length;
        const hb = store.contacts.filter(c => c.hard_bounced).length;
        const complaint = store.contacts.filter(c => c.complaint_count > 0).length;
        const lastFirst = store.contacts.map(c => c.first_seen_at).sort().pop() ?? null;
        const lastLast = store.contacts.map(c => c.last_seen_at).sort().pop() ?? null;
        return r([{
          total, distinct_lower_email: distinctSet.size, not_suppressed: notSup,
          opt_out: optOut, hard_bounced: hb, complaint,
          last_first_seen_at: lastFirst, last_ingestion_at: lastLast,
        }]);
      }

      // Country distribution
      if (/^SELECT COALESCE\(NULLIF\(country, ''\), 'UNKNOWN'\) AS country, COUNT\(\*\)::int AS total/i.test(norm)) {
        const grouped: Record<string, { total: number; not_suppressed: number }> = {};
        for (const c of store.contacts) {
          const k = c.country || "UNKNOWN";
          grouped[k] = grouped[k] ?? { total: 0, not_suppressed: 0 };
          grouped[k].total += 1;
          if (!c.opt_out && !c.hard_bounced && c.complaint_count === 0) grouped[k].not_suppressed += 1;
        }
        return r(Object.entries(grouped).sort((a, b) => b[1].total - a[1].total).map(([country, v]) => ({ country, total: v.total, not_suppressed: v.not_suppressed })));
      }

      // Category distribution
      if (/^SELECT COALESCE\(category_group, 'unclassified'\) AS category_group/i.test(norm)) {
        const grouped: Record<string, { total: number; not_suppressed: number }> = {};
        for (const c of store.contacts) {
          const k = c.category_group ?? "unclassified";
          grouped[k] = grouped[k] ?? { total: 0, not_suppressed: 0 };
          grouped[k].total += 1;
          if (!c.opt_out && !c.hard_bounced && c.complaint_count === 0) grouped[k].not_suppressed += 1;
        }
        return r(Object.entries(grouped).sort((a, b) => b[1].total - a[1].total).map(([category_group, v]) => ({ category_group, total: v.total, not_suppressed: v.not_suppressed })));
      }

      // Source distribution
      if (/^SELECT unnest\(source_tables\) AS source_table/i.test(norm)) {
        const grouped: Record<string, number> = {};
        for (const c of store.contacts) for (const s of c.source_tables) grouped[s] = (grouped[s] ?? 0) + 1;
        return r(Object.entries(grouped).sort((a, b) => b[1] - a[1]).map(([source_table, n]) => ({ source_table, n })));
      }

      // Activity · new last 7 days
      if (/new_last_7_days/i.test(norm)) {
        const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
        const n = store.contacts.filter(c => Date.parse(c.first_seen_at) >= cutoff).length;
        return r([{ new_last_7_days: n }]);
      }

      throw new Error(`inventory mock: unhandled SQL: ${norm.slice(0, 140)}`);
    },
    release() {},
  } as unknown as PoolClient;

  return {
    client, store,
    seed(rows: Array<Partial<Store["contacts"][0]> & { email: string }>) {
      let n = 1;
      for (const r of rows) {
        store.contacts.push({
          contact_id: `c-${n++}`,
          email: r.email,
          country: r.country ?? "ID",
          category_group: r.category_group ?? "accommodation",
          category_slug: r.category_slug ?? "accommodation-general",
          language: r.language ?? "id",
          opt_out: r.opt_out ?? false,
          hard_bounced: r.hard_bounced ?? false,
          complaint_count: r.complaint_count ?? 0,
          source_tables: r.source_tables ?? ["nex_lab_accommodation.harvest_raw"],
          first_seen_at: r.first_seen_at ?? new Date().toISOString(),
          last_seen_at: r.last_seen_at ?? new Date().toISOString(),
        });
      }
    },
  };
}
function r(rows: any[]): QueryResult<any> { return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] }; }

const founderAuth = (): FounderAuthContext => ({ authenticated: true, actor: "founder", source: "localhost" });
const noAuth = (): FounderAuthContext => ({ authenticated: false, actor: "", source: "unauthenticated" });

let pool: ReturnType<typeof makePool>;
beforeEach(() => { pool = makePool(); });

describe("Email Storage inventory · Founder UI wave", () => {
  it("(A1) unauthenticated is refused", async () => {
    await expect(loadEmailStorageInventory(pool.client, noAuth())).rejects.toThrow(FounderAccessError);
  });

  it("(A2) empty store returns zeros with clean shape", async () => {
    const inv = await loadEmailStorageInventory(pool.client, founderAuth());
    expect(inv.total).toBe(0);
    expect(inv.not_suppressed).toBe(0);
    expect(inv.countries).toEqual([]);
    expect(inv.categories).toEqual([]);
    expect(inv.sources).toEqual([]);
    expect(inv.contact_proof_available).toBe(false);
  });

  it("(B1) returns aggregate country + category + source distribution", async () => {
    pool.seed([
      { email: "a@x", country: "ID", category_group: "accommodation" },
      { email: "b@x", country: "ID", category_group: "accommodation" },
      { email: "c@x", country: "ID", category_group: "food" },
      { email: "d@x", country: "GB", category_group: "accommodation", source_tables: ["nex_lab_business.harvest_raw"] },
    ]);
    const inv = await loadEmailStorageInventory(pool.client, founderAuth());
    expect(inv.total).toBe(4);
    expect(inv.not_suppressed).toBe(4);
    expect(inv.countries.map(c => c.iso).sort()).toEqual(["GB", "ID"]);
    expect(inv.countries.find(c => c.iso === "ID")?.total).toBe(3);
    expect(inv.countries.find(c => c.iso === "GB")?.name).toBe("United Kingdom");
    expect(inv.categories.find(c => c.key === "accommodation")?.total).toBe(3);
    expect(inv.categories.find(c => c.key === "food")?.total).toBe(1);
    expect(inv.sources.length).toBe(2);
  });

  it("(C1) suppression buckets counted separately", async () => {
    pool.seed([
      { email: "a@x", opt_out: true },
      { email: "b@x", hard_bounced: true },
      { email: "c@x", complaint_count: 2 },
      { email: "d@x" },
    ]);
    const inv = await loadEmailStorageInventory(pool.client, founderAuth());
    expect(inv.total).toBe(4);
    expect(inv.not_suppressed).toBe(1);
    expect(inv.suppressed.opt_out).toBe(1);
    expect(inv.suppressed.hard_bounced).toBe(1);
    expect(inv.suppressed.complaint).toBe(1);
    expect(inv.suppressed.total).toBe(3);
  });

  it("(D1) NO email addresses appear anywhere in the inventory response (§13 boundary)", async () => {
    pool.seed([
      { email: "totally-recognisable-address@x.test" },
      { email: "another-recognisable@y.test" },
    ]);
    const inv = await loadEmailStorageInventory(pool.client, founderAuth());
    const serialised = JSON.stringify(inv);
    expect(serialised).not.toContain("totally-recognisable-address");
    expect(serialised).not.toContain("another-recognisable");
    expect(serialised).not.toContain("@x.test");
    expect(serialised).not.toContain("@y.test");
  });

  it("(D2) module exports NO address-listing function", async () => {
    const mod = await import("..");
    expect((mod as any).listEmailAddresses).toBeUndefined();
    expect((mod as any).getContactAddresses).toBeUndefined();
    expect((mod as any).exportInventory).toBeUndefined();
    expect((mod as any).downloadContacts).toBeUndefined();
    expect(_EMAIL_STORAGE_INVENTORY_BOUNDARY).toBe("counts_and_aggregates_only_no_addresses");
  });

  it("(E1) three-lane isolation · inventory never touches package/queue/budget SQL", async () => {
    pool.seed([{ email: "a@x" }]);
    await loadEmailStorageInventory(pool.client, founderAuth());
    expect(pool.store.member_package_touched).toBe(false);
    expect(pool.store.send_queue_written).toBe(false);
  });

  it("(F1) activity.new_last_7_days is populated", async () => {
    pool.seed([{ email: "recent@x", first_seen_at: new Date().toISOString() }]);
    const inv = await loadEmailStorageInventory(pool.client, founderAuth());
    expect(inv.activity.new_last_7_days).toBe(1);
  });

  it("(G1) contact_proof_available is always false in this wave (§10)", async () => {
    pool.seed([{ email: "a@x" }]);
    const inv = await loadEmailStorageInventory(pool.client, founderAuth());
    expect(inv.contact_proof_available).toBe(false);
  });
});
