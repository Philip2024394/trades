// src/lib/nex/marketing/package/__tests__/mock-pool.ts
//
// In-memory PoolClient mock for Stage 3 acceptance tests.
// Faithfully implements the SQL patterns the package modules depend on:
//   • SELECT · INSERT · UPDATE with WHERE predicates
//   • Conditional UPDATE returning 0 rows when predicate fails (capacity guard)
//   • UNIQUE constraint enforcement on marketing_package_attribution.idempotency_key
//   • JSONB → object round-trip

import type { PoolClient, QueryResult } from "pg";

type Store = {
  packages: Map<string, any>;
  attributions: Map<string, any>;        // attribution_id → row
  attributions_by_key: Map<string, any>; // idempotency_key → row
  audit: any[];
};

let pkg_seq = 1;
let attr_seq = 1;
let audit_seq = 1;

export interface MockHandle {
  store: Store;
  client: PoolClient;
  reconnect(): MockHandle;
}

export function makeMockPool(): MockHandle {
  const store: Store = {
    packages: new Map(),
    attributions: new Map(),
    attributions_by_key: new Map(),
    audit: [],
  };
  return {
    store,
    client: buildClient(store),
    reconnect() { return { ...this, client: buildClient(store) } as MockHandle; },
  };
}

// ─── Test insert helper ────────────────────────────────────────────
export function insertPackage(handle: MockHandle, partial: {
  member_id: string;
  package_type?: string;
  display_name?: string;
  purchased_capacity: number;
  status?: string;
  purchase_reference?: string;
  expires_at?: string;
  package_id?: string;
}): any {
  const id = partial.package_id ?? `pkg-${pkg_seq++}`;
  const now = new Date().toISOString();
  const row = {
    package_id: id,
    member_id: partial.member_id,
    package_type: partial.package_type ?? "starter-managed-sends",
    display_name: partial.display_name ?? null,
    purchased_capacity: partial.purchased_capacity,
    reserved_capacity: 0,
    consumed_capacity: 0,
    status: partial.status ?? "active",
    currency: null,
    purchase_reference: partial.purchase_reference ?? null,
    purchase_amount_minor: null,
    purchased_at: now,
    activated_at: partial.status === "active" ? now : null,
    expires_at: partial.expires_at ?? null,
    targeting: {},
    metadata: {},
    created_at: now,
    updated_at: now,
  };
  handle.store.packages.set(id, row);
  return row;
}

// ─── SQL-faithful mock client ──────────────────────────────────────
function buildClient(store: Store): PoolClient {
  const client = {
    async query(sql: string, params: any[] = []): Promise<QueryResult<any>> {
      const norm = sql.trim().replace(/\s+/g, " ");

      // ─── Package SELECT by id ─────────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_package WHERE package_id=\$1/i.test(norm)) {
        const row = store.packages.get(params[0]);
        return asResult(row ? [row] : []);
      }
      // ─── Package SELECT by member ─────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_package WHERE member_id=\$1 ORDER BY created_at/i.test(norm)) {
        const rows = [...store.packages.values()].filter(r => r.member_id === params[0]);
        rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        return asResult(rows);
      }
      // ─── Package SELECT for duplicate-purchase check ──────────
      if (/^SELECT \* FROM nex\.marketing_package WHERE member_id = \$1 AND purchase_reference = \$2/i.test(norm)) {
        const rows = [...store.packages.values()].filter(r => r.member_id === params[0] && r.purchase_reference === params[1]);
        return asResult(rows.slice(0, 1));
      }
      // ─── Package INSERT (specific · not attribution) ──────────
      if (/^INSERT INTO nex\.marketing_package \(member_id/i.test(norm)) {
        const [member_id, package_type, display_name, purchased_capacity, currency, purchase_reference, purchase_amount_minor, purchased_at, expires_at, targeting_json, metadata_json] = params;
        const id = `pkg-${pkg_seq++}`;
        const now = new Date().toISOString();
        const row = {
          package_id: id,
          member_id,
          package_type,
          display_name,
          purchased_capacity,
          reserved_capacity: 0,
          consumed_capacity: 0,
          status: "available",
          currency,
          purchase_reference,
          purchase_amount_minor,
          purchased_at,
          activated_at: null,
          expires_at,
          targeting: JSON.parse(targeting_json as string),
          metadata: JSON.parse(metadata_json as string),
          created_at: now,
          updated_at: now,
        };
        store.packages.set(id, row);
        return asResult([row]);
      }
      // ─── Package UPDATE · conditional reserve (capacity guard) ─
      if (/^UPDATE nex\.marketing_package(?!_) SET reserved_capacity = reserved_capacity \+ \$1/i.test(norm)) {
        const [delta, package_id, member_id] = params;
        const row = store.packages.get(package_id);
        if (!row) return asResult([]);
        if (row.status !== "active") return asResult([]);
        if (row.member_id !== member_id) return asResult([]);
        if (row.reserved_capacity + row.consumed_capacity + delta > row.purchased_capacity) return asResult([]);
        row.reserved_capacity += delta;
        row.updated_at = new Date().toISOString();
        return asResult([{
          purchased_capacity: row.purchased_capacity,
          reserved_capacity: row.reserved_capacity,
          consumed_capacity: row.consumed_capacity,
        }]);
      }
      // ─── Package UPDATE · reserved → consumed ─────────────────
      if (/^UPDATE nex\.marketing_package(?!_) SET reserved_capacity = GREATEST\(0, reserved_capacity - \$1\), consumed_capacity = consumed_capacity \+ \$1/i.test(norm)) {
        const [delta, package_id] = params;
        const row = store.packages.get(package_id);
        if (!row) return asResult([]);
        row.reserved_capacity = Math.max(0, row.reserved_capacity - delta);
        row.consumed_capacity += delta;
        row.updated_at = new Date().toISOString();
        return asResult([{ reserved_capacity: row.reserved_capacity, consumed_capacity: row.consumed_capacity }]);
      }
      // ─── Package UPDATE · reserved decrement (release / rollback) ─
      if (/^UPDATE nex\.marketing_package(?!_) SET reserved_capacity = GREATEST\(0, reserved_capacity - \$1\)/i.test(norm)) {
        const [delta, package_id] = params;
        const row = store.packages.get(package_id);
        if (!row) return asResult([]);
        row.reserved_capacity = Math.max(0, row.reserved_capacity - delta);
        row.updated_at = new Date().toISOString();
        return asResult([{ reserved_capacity: row.reserved_capacity, consumed_capacity: row.consumed_capacity }]);
      }
      // ─── Package UPDATE · exhausted transition ────────────────
      if (/^UPDATE nex\.marketing_package(?!_) SET status = 'exhausted'/i.test(norm)) {
        const [package_id] = params;
        const row = store.packages.get(package_id);
        if (!row) return asResult([]);
        if (row.status !== "active") return asResult([]);
        row.status = "exhausted";
        row.updated_at = new Date().toISOString();
        return asResult([row]);
      }
      // ─── Package UPDATE · un-exhaust (release path) ───────────
      if (/^UPDATE nex\.marketing_package(?!_) SET status = 'active'/i.test(norm)) {
        const [package_id] = params;
        const row = store.packages.get(package_id);
        if (!row) return asResult([]);
        if (row.status !== "exhausted") return asResult([]);
        row.status = "active";
        row.updated_at = new Date().toISOString();
        return asResult([row]);
      }
      // ─── Package UPDATE · status transition ───────────────────
      if (/^UPDATE nex\.marketing_package(?!_) SET status=\$1/i.test(norm)) {
        const [to_status, setActivated, package_id] = params;
        const row = store.packages.get(package_id);
        if (!row) return asResult([]);
        row.status = to_status;
        if (setActivated && !row.activated_at) row.activated_at = new Date().toISOString();
        row.updated_at = new Date().toISOString();
        return asResult([row]);
      }
      // ─── Attribution SELECT by id ─────────────────────────────
      if (/^SELECT \* FROM nex\.marketing_package_attribution WHERE attribution_id=\$1/i.test(norm)) {
        const row = store.attributions.get(params[0]);
        return asResult(row ? [row] : []);
      }
      // ─── Attribution SELECT by idempotency_key ────────────────
      if (/^SELECT \* FROM nex\.marketing_package_attribution WHERE idempotency_key=\$1/i.test(norm)) {
        const row = store.attributions_by_key.get(params[0]);
        return asResult(row ? [row] : []);
      }
      // ─── Attribution SELECT by campaign ───────────────────────
      if (/^SELECT \* FROM nex\.marketing_package_attribution WHERE campaign_id=\$1/i.test(norm)) {
        const rows = [...store.attributions.values()].filter(r => r.campaign_id === params[0]);
        return asResult(rows);
      }
      // ─── Attribution INSERT (UNIQUE on idempotency_key) ────────
      if (/^INSERT INTO nex\.marketing_package_attribution/i.test(norm)) {
        const [idempotency_key, package_id, member_id, campaign_id, contact_id, queue_id, units, detail_json] = params;
        if (store.attributions_by_key.has(idempotency_key)) {
          // Simulate Postgres UNIQUE violation
          const err: any = new Error(`duplicate key value violates unique constraint "nex.marketing_package_attribution_idempotency_key_key"`);
          err.code = "23505";
          throw err;
        }
        const id = `attr-${attr_seq++}`;
        const now = new Date().toISOString();
        const row = {
          attribution_id: id,
          idempotency_key,
          package_id,
          member_id,
          campaign_id,
          contact_id,
          queue_id,
          state: "reserved",
          units,
          reserved_at: now,
          consumed_at: null,
          released_at: null,
          release_reason: null,
          detail: JSON.parse(detail_json as string),
        };
        store.attributions.set(id, row);
        store.attributions_by_key.set(idempotency_key, row);
        return asResult([row]);
      }
      // ─── Attribution UPDATE · consumed ────────────────────────
      if (/^UPDATE nex\.marketing_package_attribution SET state='consumed'/i.test(norm)) {
        const [detail_json, attribution_id] = params;
        const row = store.attributions.get(attribution_id);
        if (!row || row.state !== "reserved") return asResult([]);
        row.state = "consumed";
        row.consumed_at = new Date().toISOString();
        row.detail = { ...row.detail, ...JSON.parse(detail_json as string) };
        return asResult([row]);
      }
      // ─── Attribution UPDATE · released ────────────────────────
      if (/^UPDATE nex\.marketing_package_attribution SET state='released'/i.test(norm)) {
        const [reason, attribution_id] = params;
        const row = store.attributions.get(attribution_id);
        if (!row || row.state !== "reserved") return asResult([]);
        row.state = "released";
        row.released_at = new Date().toISOString();
        row.release_reason = reason;
        return asResult([row]);
      }
      // ─── Audit INSERT ─────────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_package_audit/i.test(norm)) {
        const [package_id, event_type, from_state, to_state, actor, detail] = params;
        store.audit.push({
          audit_id: `audit-${audit_seq++}`,
          package_id,
          event_type,
          from_state: from_state ? JSON.parse(from_state as string) : null,
          to_state: to_state ? JSON.parse(to_state as string) : null,
          actor,
          detail: detail ? JSON.parse(detail as string) : {},
          at_iso: new Date().toISOString(),
        });
        return asResult([]);
      }
      // ─── Audit SELECT ─────────────────────────────────────────
      if (/^SELECT audit_id, event_type, actor, at_iso, detail FROM nex\.marketing_package_audit/i.test(norm)) {
        const [package_id, limit] = params;
        const rows = store.audit
          .filter(a => a.package_id === package_id)
          .sort((a, b) => (a.at_iso < b.at_iso ? 1 : -1))
          .slice(0, limit as number);
        return asResult(rows);
      }

      throw new Error(`mock-pool (package): unhandled SQL: ${norm.slice(0, 140)}...`);
    },
    release() {},
  } as unknown as PoolClient;
  return client;
}

function asResult(rows: any[]): QueryResult<any> {
  return { rows, rowCount: rows.length, command: "", oid: 0, fields: [] };
}
