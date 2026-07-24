// Reader — Supabase mocked with a chainable query builder.
//
// The reader uses .from(t).select(...).order(...).eq(...).like(...)
// .gte(...).limit(...). The mock captures every filter and applies them
// on the terminal .then() (await).

import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;
const rows: Record<string, Row[]> = {};

function seed(table: string, seedRows: Row[]) {
  rows[table] = seedRows;
}

vi.mock("@/lib/supabaseAdmin", () => {
  return {
    supabaseAdmin: {
      from(table: string) {
        const state: {
          eq:      Array<[string, unknown]>;
          like:    Array<[string, string]>;
          gte:     Array<[string, unknown]>;
          order?:  { col: string; asc: boolean };
          limit?:  number;
        } = { eq: [], like: [], gte: [] };
        const promise = () => {
          let data = (rows[table] ?? []).slice();
          for (const [col, val] of state.eq)   data = data.filter((r) => r[col] === val);
          for (const [col, val] of state.like) data = data.filter((r) => String(r[col] ?? "").startsWith(val.replace("%", "")));
          for (const [col, val] of state.gte)  data = data.filter((r) => (r[col] as number | string) >= (val as number | string));
          if (state.order) {
            const { col, asc } = state.order;
            data.sort((a, b) => (String(a[col] ?? "") < String(b[col] ?? "") ? -1 : 1) * (asc ? 1 : -1));
          }
          if (state.limit !== undefined) data = data.slice(0, state.limit);
          return Promise.resolve({ data, error: null });
        };
        const builder: {
          select: (...args: unknown[]) => typeof builder;
          eq:     (col: string, val: unknown) => typeof builder;
          like:   (col: string, val: string) => typeof builder;
          gte:    (col: string, val: unknown) => typeof builder;
          order:  (col: string, opts: { ascending: boolean }) => typeof builder;
          limit:  (n: number) => typeof builder;
          then:   (fn: (v: { data: Row[]; error: null }) => unknown) => Promise<unknown>;
        } = {
          select: () => builder,
          eq(col, val)   { state.eq.push([col, val]);   return builder; },
          like(col, val) { state.like.push([col, val]); return builder; },
          gte(col, val)  { state.gte.push([col, val]);  return builder; },
          order(col, opts) { state.order = { col, asc: opts.ascending }; return builder; },
          limit(n) { state.limit = n; return builder; },
          then(fn) { return promise().then(fn); }
        };
        return builder;
      }
    }
  };
});

import { retrieveMemory } from "./reader";

beforeEach(() => { for (const k of Object.keys(rows)) delete rows[k]; });

const commonRow = {
  predicate: "=", value_json: {}, unit: null,
  window_start: null, window_end: null, sample_size: 1,
  confidence: "medium", is_official: false, is_verified: false,
  visible_to: "owner_only", source_engine: "test", evidence_tables: [],
  decays_at: null, correction_of: null
};

describe("retrieveMemory · company layer", () => {
  it("filters rows by merchant_slug + subject", async () => {
    seed("hammerex_nex_memory_company", [
      { id: "1", ...commonRow, merchant_slug: "phil", subject: "pricing.kitchen.total_pence", observed_at: "2026-07-20T10:00:00Z", computed_at: "x", created_at: "x" },
      { id: "2", ...commonRow, merchant_slug: "sam",  subject: "pricing.kitchen.total_pence", observed_at: "2026-07-21T10:00:00Z", computed_at: "x", created_at: "x" }
    ]);
    const res = await retrieveMemory({
      layer: "company",
      viewer: { kind: "merchant", merchant_slug: "phil" },
      subject: "pricing.kitchen.total_pence"
    });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.id).toBe("1");
  });

  it("filters by subject_like prefix", async () => {
    seed("hammerex_nex_memory_company", [
      { id: "1", ...commonRow, merchant_slug: "phil", subject: "pricing.kitchen.total_pence", observed_at: "2026-07-20T10:00:00Z", computed_at: "x", created_at: "x" },
      { id: "2", ...commonRow, merchant_slug: "phil", subject: "pricing.bathroom.total_pence", observed_at: "2026-07-19T10:00:00Z", computed_at: "x", created_at: "x" },
      { id: "3", ...commonRow, merchant_slug: "phil", subject: "customer.c1.payment_days", observed_at: "2026-07-18T10:00:00Z", computed_at: "x", created_at: "x" }
    ]);
    const res = await retrieveMemory({
      layer: "company",
      viewer: { kind: "merchant", merchant_slug: "phil" },
      subject_like: "pricing."
    });
    expect(res.rows).toHaveLength(2);
    expect(res.rows.every((r) => r.subject.startsWith("pricing."))).toBe(true);
  });

  it("respects the default 'always return 3' limit", async () => {
    const seedRows = Array.from({ length: 8 }, (_, i) => ({
      id: `id-${i}`, ...commonRow, merchant_slug: "phil",
      subject: "pricing.kitchen.total_pence",
      observed_at: `2026-07-${20 - i}T10:00:00Z`, computed_at: "x", created_at: "x"
    }));
    seed("hammerex_nex_memory_company", seedRows);
    const res = await retrieveMemory({
      layer: "company",
      viewer: { kind: "merchant", merchant_slug: "phil" },
      subject: "pricing.kitchen.total_pence"
    });
    expect(res.rows.length).toBe(3);
  });

  it("resolves correction chains: newer correction supersedes older row", async () => {
    seed("hammerex_nex_memory_company", [
      { id: "old", ...commonRow, merchant_slug: "phil", subject: "pricing.kitchen.total_pence", observed_at: "2026-07-10T10:00:00Z", computed_at: "x", created_at: "x" },
      { id: "new", ...commonRow, merchant_slug: "phil", subject: "pricing.kitchen.total_pence", observed_at: "2026-07-20T10:00:00Z", computed_at: "x", created_at: "x", correction_of: "old" }
    ]);
    const res = await retrieveMemory({
      layer: "company",
      viewer: { kind: "merchant", merchant_slug: "phil" },
      subject: "pricing.kitchen.total_pence"
    });
    // "old" should be dropped by the correction chain.
    expect(res.rows.map((r) => r.id)).not.toContain("old");
    expect(res.rows.map((r) => r.id)).toContain("new");
    expect(res.superseded).toBe(1);
  });

  it("rejects wrong viewer scope for the layer", async () => {
    const res = await retrieveMemory({
      layer: "company",
      viewer: { kind: "user", user_id: "u1" }
    });
    expect(res.rows).toHaveLength(0);
    expect(res.evidence.source).toContain("viewer mismatch");
  });
});

describe("retrieveMemory · project layer", () => {
  it("filters by project_id", async () => {
    seed("hammerex_nex_memory_project", [
      { id: "a", ...commonRow, merchant_slug: "phil", project_id: "p1", subject: "duration.days", observed_at: "2026-07-20T10:00:00Z", computed_at: "x", created_at: "x" },
      { id: "b", ...commonRow, merchant_slug: "phil", project_id: "p2", subject: "duration.days", observed_at: "2026-07-21T10:00:00Z", computed_at: "x", created_at: "x" }
    ]);
    const res = await retrieveMemory({
      layer: "project",
      viewer: { kind: "project", merchant_slug: "phil", project_id: "p1" },
      subject: "duration.days"
    });
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]!.id).toBe("a");
  });
});
