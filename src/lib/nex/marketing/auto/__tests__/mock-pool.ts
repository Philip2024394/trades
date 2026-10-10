// src/lib/nex/marketing/auto/__tests__/mock-pool.ts
//
// SQL-faithful in-memory mock for Stage 5 AUTO-lane acceptance tests.

import type { PoolClient, QueryResult } from "pg";

type Store = {
  budgets: Map<string, any>;
  budget_attributions: Map<string, any>;
  budget_attributions_by_key: Map<string, any>;
  budget_audit: any[];
  // For lane-isolation tests · verify member_package is NEVER touched
  member_packages: Map<string, any>;
  member_package_touched: boolean;   // canary flag · flips true if any query mentions member_package
};

let seq = 1;

export function makeMockPool() {
  const store: Store = {
    budgets: new Map(),
    budget_attributions: new Map(),
    budget_attributions_by_key: new Map(),
    budget_audit: [],
    member_packages: new Map(),
    member_package_touched: false,
  };
  return { store, client: buildClient(store) as PoolClient };
}

export function insertBudget(handle: ReturnType<typeof makeMockPool>, partial: { name: string; purchased_capacity: number; status?: string; budget_id?: string; hourly_capacity?: number | null; daily_capacity?: number | null }) {
  const id = partial.budget_id ?? `budget-${seq++}`;
  const now = new Date().toISOString();
  const row = {
    budget_id: id,
    name: partial.name,
    display_name: null,
    purpose: null,
    hourly_capacity: partial.hourly_capacity ?? null,
    daily_capacity: partial.daily_capacity ?? null,
    monthly_capacity: null,
    purchased_capacity: partial.purchased_capacity,
    reserved_capacity: 0,
    consumed_capacity: 0,
    status: partial.status ?? "active",
    paused_reason: null,
    created_at: now,
    updated_at: now,
  };
  handle.store.budgets.set(id, row);
  return row;
}

/** Seeds a fake member package · used to verify AUTO lane NEVER touches it. */
export function seedMemberPackageCanary(handle: ReturnType<typeof makeMockPool>, package_id: string) {
  handle.store.member_packages.set(package_id, { package_id, purchased_capacity: 100, reserved_capacity: 0, consumed_capacity: 0 });
}

function buildClient(store: Store): PoolClient {
  return {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.trim().replace(/\s+/g, " ");

      // ─── CANARY: any mention of marketing_package (non-attribution) trips the isolation flag ─
      if (/nex\.marketing_package(?!_)/i.test(norm) || /nex\.marketing_package_attribution/i.test(norm)) {
        store.member_package_touched = true;
      }

      // ─── Budget INSERT ────────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_operating_budget \(name/i.test(norm)) {
        const [name, display_name, purpose, purchased, hourly, daily, monthly] = params;
        const id = `budget-${seq++}`;
        const now = new Date().toISOString();
        const row = {
          budget_id: id, name, display_name, purpose,
          hourly_capacity: hourly, daily_capacity: daily, monthly_capacity: monthly,
          purchased_capacity: purchased, reserved_capacity: 0, consumed_capacity: 0,
          status: "active", paused_reason: null, created_at: now, updated_at: now,
        };
        store.budgets.set(id, row);
        return asResult([row]);
      }

      // ─── Budget SELECT ────────────────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_operating_budget WHERE budget_id=\$1/i.test(norm)) {
        const row = store.budgets.get(params[0]);
        return asResult(row ? [row] : []);
      }
      if (/^SELECT \* FROM nex\.marketing_operating_budget WHERE name=\$1/i.test(norm)) {
        const row = [...store.budgets.values()].find(b => b.name === params[0]);
        return asResult(row ? [row] : []);
      }

      // ─── Attribution SELECT by key ────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_operating_budget_attribution WHERE idempotency_key=\$1/i.test(norm)) {
        const row = store.budget_attributions_by_key.get(params[0]);
        return asResult(row ? [row] : []);
      }

      // ─── Attribution SELECT by id ─────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_operating_budget_attribution WHERE attribution_id=\$1/i.test(norm)) {
        const row = store.budget_attributions.get(params[0]);
        return asResult(row ? [row] : []);
      }

      // ─── Budget conditional reserve ───────────────────────────
      if (/^UPDATE nex\.marketing_operating_budget SET reserved_capacity = reserved_capacity \+ \$1/i.test(norm)) {
        const [delta, budget_id] = params;
        const row = store.budgets.get(budget_id);
        if (!row) return asResult([]);
        if (row.status !== "active") return asResult([]);
        if (row.reserved_capacity + row.consumed_capacity + delta > row.purchased_capacity) return asResult([]);
        row.reserved_capacity += delta;
        row.updated_at = new Date().toISOString();
        return asResult([{ purchased_capacity: row.purchased_capacity, reserved_capacity: row.reserved_capacity, consumed_capacity: row.consumed_capacity }]);
      }

      // ─── Budget release/consume decrement of reserved ─────────
      if (/^UPDATE nex\.marketing_operating_budget SET reserved_capacity = GREATEST\(0, reserved_capacity - \$1\), consumed_capacity = consumed_capacity \+ \$1/i.test(norm)) {
        const [delta, budget_id] = params;
        const row = store.budgets.get(budget_id);
        if (!row) return asResult([]);
        row.reserved_capacity = Math.max(0, row.reserved_capacity - delta);
        row.consumed_capacity += delta;
        return asResult([row]);
      }
      if (/^UPDATE nex\.marketing_operating_budget SET reserved_capacity = GREATEST\(0, reserved_capacity - \$1\)/i.test(norm)) {
        const [delta, budget_id] = params;
        const row = store.budgets.get(budget_id);
        if (!row) return asResult([]);
        row.reserved_capacity = Math.max(0, row.reserved_capacity - delta);
        return asResult([row]);
      }

      // ─── Attribution INSERT ───────────────────────────────────
      if (/^INSERT INTO nex\.marketing_operating_budget_attribution/i.test(norm)) {
        const [idempotency_key, budget_id, campaign_id, contact_id, queue_id, units] = params;
        if (store.budget_attributions_by_key.has(idempotency_key)) {
          const err: any = new Error("duplicate key");
          err.code = "23505";
          throw err;
        }
        const id = `attr-${seq++}`;
        const now = new Date().toISOString();
        const row = {
          attribution_id: id, idempotency_key, budget_id, campaign_id, contact_id, queue_id,
          state: "reserved", units, reserved_at: now, consumed_at: null, released_at: null, release_reason: null,
        };
        store.budget_attributions.set(id, row);
        store.budget_attributions_by_key.set(idempotency_key, row);
        return asResult([row]);
      }

      // ─── Attribution UPDATE · consume ─────────────────────────
      if (/^UPDATE nex\.marketing_operating_budget_attribution SET state = 'consumed'/i.test(norm)) {
        const [attribution_id] = params;
        const row = store.budget_attributions.get(attribution_id);
        if (!row || row.state !== "reserved") return asResult([]);
        row.state = "consumed";
        row.consumed_at = new Date().toISOString();
        return asResult([row]);
      }

      // ─── Attribution UPDATE · release ─────────────────────────
      if (/^UPDATE nex\.marketing_operating_budget_attribution SET state = 'released'/i.test(norm)) {
        const [reason, attribution_id] = params;
        const row = store.budget_attributions.get(attribution_id);
        if (!row || row.state !== "reserved") return asResult([]);
        row.state = "released";
        row.released_at = new Date().toISOString();
        row.release_reason = reason;
        return asResult([row]);
      }

      // ─── Audit INSERT ─────────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_operating_budget_audit/i.test(norm)) {
        const [budget_id, event_type, from_state, to_state, actor] = params;
        store.budget_audit.push({
          audit_id: `audit-${seq++}`, budget_id, event_type,
          from_state: from_state ? JSON.parse(from_state as string) : null,
          to_state: to_state ? JSON.parse(to_state as string) : null,
          actor, at_iso: new Date().toISOString(),
        });
        return asResult([]);
      }

      throw new Error(`auto mock-pool: unhandled SQL: ${norm.slice(0, 140)}...`);
    },
    release() {},
  } as unknown as PoolClient;
}

function asResult(rows: any[]): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] };
}
