// Writer — Supabase mocked with a tiny in-memory backend.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Supabase mock ──────────────────────────────────────────────

type Row = Record<string, unknown> & { id: string };
const store: Record<string, Row[]> = {};

vi.mock("@/lib/supabaseAdmin", () => {
  return {
    supabaseAdmin: {
      from(table: string) {
        if (!store[table]) store[table] = [];
        return {
          insert(row: Record<string, unknown>) {
            const id = "id-" + Math.random().toString(36).slice(2, 10);
            const persisted: Row = { ...row, id, created_at: new Date().toISOString() };
            store[table]!.push(persisted);
            return {
              select() {
                return {
                  single: async () => ({ data: { id: persisted.id }, error: null })
                };
              }
            };
          }
        };
      }
    }
  };
});

import { writeMemory } from "./writer";

beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });

describe("writeMemory", () => {
  it("writes a user memory row + returns an id", async () => {
    const res = await writeMemory({
      layer: "user", owner_user_id: "user-1",
      subject: "preference.day_rate_gbp", predicate: "=", value_json: 320,
      source_engine: "chat"
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.id).toMatch(/^id-/);
    expect(store["hammerex_nex_memory_user"]).toHaveLength(1);
    const row = store["hammerex_nex_memory_user"]![0]!;
    expect(row.owner_user_id).toBe("user-1");
    expect(row.subject).toBe("preference.day_rate_gbp");
    expect(row.visible_to).toBe("owner_only");
    expect(row.confidence).toBe("low");
  });

  it("writes a company memory row with default owner_only visibility", async () => {
    const res = await writeMemory({
      layer: "company", merchant_slug: "phil",
      subject: "pricing.kitchen.total_pence", predicate: "=",
      value_json: { total_pence: 500_000 },
      source_engine: "est"
    });
    expect(res.ok).toBe(true);
    expect(store["hammerex_nex_memory_company"]).toHaveLength(1);
    expect(store["hammerex_nex_memory_company"]![0]!.visible_to).toBe("owner_only");
  });

  it("writes a project memory row with project_participants visibility by default", async () => {
    const res = await writeMemory({
      layer: "project", merchant_slug: "phil", project_id: "p1",
      subject: "duration.days", predicate: "=", value_json: 12,
      source_engine: "pi"
    });
    expect(res.ok).toBe(true);
    expect(store["hammerex_nex_memory_project"]![0]!.visible_to).toBe("project_participants");
  });

  it("rejects V1 visibility values in V0", async () => {
    const res = await writeMemory({
      layer: "company", merchant_slug: "phil",
      subject: "s", predicate: "=", value_json: 1,
      source_engine: "test",
      visible_to: "trade_k5"
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain("not enabled in V0");
  });

  it("rejects missing owner fields", async () => {
    const res = await writeMemory({
      layer: "user", owner_user_id: "" as string,
      subject: "s", predicate: "=", value_json: 1, source_engine: "test"
    });
    expect(res.ok).toBe(false);
  });

  it("assigns a default decays_at for pricing subjects (~180 days)", async () => {
    await writeMemory({
      layer: "company", merchant_slug: "phil",
      subject: "pricing.kitchen.total_pence", predicate: "=",
      value_json: 500_000, source_engine: "est"
    });
    const row = store["hammerex_nex_memory_company"]![0]!;
    const decayIso = row.decays_at as string;
    const days = (new Date(decayIso).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(175);
    expect(days).toBeLessThan(185);
  });

  it("records source_engine + evidence_tables on every row", async () => {
    await writeMemory({
      layer: "company", merchant_slug: "phil",
      subject: "customer.c1.payment_days", predicate: "=", value_json: { days: 32 },
      source_engine: "cx",
      evidence_tables: ["hammerex_customer_payments"]
    });
    const row = store["hammerex_nex_memory_company"]![0]!;
    expect(row.source_engine).toBe("cx");
    expect(row.evidence_tables).toEqual(["hammerex_customer_payments"]);
  });
});
