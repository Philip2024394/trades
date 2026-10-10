// src/lib/nex/marketing/sender-pool/__tests__/mock-pool.ts
//
// In-memory PoolClient mock for Stage 2 acceptance tests.
// Faithfully implements the SQL semantics the sender-pool modules depend on:
//   • SELECT with WHERE clauses
//   • INSERT ... ON CONFLICT (unique) DO UPDATE ... WHERE ... RETURNING
//   • UPDATE ... WHERE ... RETURNING
//   • rowCount / rows
//
// The mock is INTENTIONALLY faithful — a test-double that behaves like Postgres
// for the specific SQL patterns used, so tests reason about real behaviour rather
// than mock behaviour.

import type { PoolClient, QueryResult } from "pg";
import type { SenderIdentity } from "../types";

type MockStore = {
  senders: Map<string, any>;                                // sender_id → row
  capacity_windows: Map<string, any>;                       // `${sender_id}|${kind}|${start_iso}` → row
  audit: any[];
};

export interface MockPoolHandle {
  store: MockStore;
  client: PoolClient;
  reconnect(): MockPoolHandle;                              // returns a NEW handle over the SAME store
}

let sender_seq = 1;
function nextSenderId(explicit?: string): string {
  return explicit ?? `sender-${sender_seq++}`;
}
let audit_seq = 1;

export function makeMockPool(): MockPoolHandle {
  const store: MockStore = { senders: new Map(), capacity_windows: new Map(), audit: [] };
  const handle: MockPoolHandle = {
    store,
    client: buildClient(store),
    reconnect() { return { store, client: buildClient(store), reconnect: this.reconnect } as MockPoolHandle; },
  };
  return handle;
}

export function resetMockPool(handle: MockPoolHandle): void {
  handle.store.senders.clear();
  handle.store.capacity_windows.clear();
  handle.store.audit.length = 0;
  sender_seq = 1;
  audit_seq = 1;
}

// ─── Insert helper for tests ────────────────────────────────────────
export function insertSender(handle: MockPoolHandle, partial: Partial<SenderIdentity> & { sender_id?: string } = {}): SenderIdentity {
  const id = nextSenderId((partial as any).sender_id);
  const now = new Date().toISOString();
  const email = (partial.email ?? `${id}@test.local`).toLowerCase();
  const row = {
    sender_id: id,
    member_id: partial.member_id ?? null,
    lane: partial.lane ?? "founder",
    email,
    display_name: partial.display_name ?? null,
    reply_to: partial.reply_to ?? null,
    sending_domain: partial.sending_domain ?? null,
    provider: partial.provider ?? "resend",
    provider_account_ref: partial.provider_account_ref ?? null,
    authentication_state: partial.authentication_state ?? "verified",
    verification_state: partial.verification_state ?? "domain_verified",
    authentication_expires_at: partial.authentication_expires_at ?? null,
    // Explicit null passes through (allow "unlimited" test cases) · undefined → default
    daily_capacity: "daily_capacity" in partial ? partial.daily_capacity : 100,
    hourly_capacity: "hourly_capacity" in partial ? partial.hourly_capacity : 10,
    capacity_source: partial.capacity_source ?? "test",
    capacity_verified_at: partial.capacity_verified_at ?? now,
    health_state: partial.health_state ?? "healthy",
    paused_reason: partial.paused_reason ?? null,
    last_send_at: partial.last_send_at ?? null,
    last_event_at: partial.last_event_at ?? null,
    last_failure_at: partial.last_failure_at ?? null,
    last_failure_reason: partial.last_failure_reason ?? null,
    bounce_rate: partial.bounce_rate ?? null,
    complaint_rate: partial.complaint_rate ?? null,
    authorised_at: partial.authorised_at ?? now,
    authorised_by: partial.authorised_by ?? "test",
    provenance: partial.provenance ?? {},
    created_at: now,
    updated_at: now,
  };
  handle.store.senders.set(id, row);
  return row as SenderIdentity;
}

// ─── Client builder · SQL semantic implementation ──────────────────
function buildClient(store: MockStore): PoolClient {
  const client = {
    async query(sql: string, params?: unknown[]): Promise<QueryResult<any>> {
      const trimmed = sql.trim();
      const norm = trimmed.replace(/\s+/g, " ");

      // ─── SELECT * FROM nex.marketing_sender_identity WHERE ... ─
      if (/^SELECT \* FROM nex\.marketing_sender_identity WHERE lane='member' AND member_id=\$1/i.test(norm)) {
        const [member_id] = params!;
        const rows = [...store.senders.values()].filter(r => r.lane === "member" && r.member_id === member_id);
        return asResult(rows);
      }
      if (/^SELECT \* FROM nex\.marketing_sender_identity WHERE lane=\$1 AND member_id IS NULL/i.test(norm)) {
        const [lane] = params!;
        const rows = [...store.senders.values()].filter(r => r.lane === lane && r.member_id === null);
        return asResult(rows);
      }
      if (/^SELECT \* FROM nex\.marketing_sender_identity WHERE sender_id=\$1/i.test(norm)) {
        const [sid] = params!;
        const row = store.senders.get(sid as string);
        return asResult(row ? [row] : []);
      }

      // ─── SELECT capacity window ───────────────────────────────
      if (/^SELECT window_kind, send_count FROM nex\.marketing_sender_capacity_window WHERE sender_id = \$1/i.test(norm)) {
        const [sid, hour_start, day_start] = params!;
        const rows: any[] = [];
        const h_key = capacityKey(sid as string, "hour", hour_start as string);
        const d_key = capacityKey(sid as string, "day", day_start as string);
        const h = store.capacity_windows.get(h_key);
        const d = store.capacity_windows.get(d_key);
        if (h) rows.push({ window_kind: "hour", send_count: h.send_count });
        if (d) rows.push({ window_kind: "day", send_count: d.send_count });
        return asResult(rows);
      }

      // ─── INSERT capacity window · ON CONFLICT DO UPDATE WHERE ─
      if (/^INSERT INTO nex\.marketing_sender_capacity_window/i.test(norm)) {
        const [sid, window_start, cap_limit] = params!;
        const kind = /'hour'/.test(norm) ? "hour" : "day";
        const key = capacityKey(sid as string, kind as "hour" | "day", window_start as string);
        const existing = store.capacity_windows.get(key);
        const limit = cap_limit as number | null;
        if (!existing) {
          // First insert · always succeeds (values (…, 1))
          const row = { sender_id: sid, window_kind: kind, window_start, send_count: 1, updated_at: new Date().toISOString() };
          store.capacity_windows.set(key, row);
          return asResult([{ send_count: 1 }]);
        }
        // Conditional update: only if send_count < limit (or limit is null)
        if (limit === null || existing.send_count < limit) {
          existing.send_count += 1;
          existing.updated_at = new Date().toISOString();
          return asResult([{ send_count: existing.send_count }]);
        }
        // Refused: capacity exhausted
        return asResult([]);
      }

      // ─── UPDATE capacity window (refund path) ─────────────────
      if (/^UPDATE nex\.marketing_sender_capacity_window SET send_count = GREATEST\(0, send_count - 1\)/i.test(norm)) {
        const [sid, window_start] = params!;
        const kind = /'hour'/.test(norm) ? "hour" : "day";
        const key = capacityKey(sid as string, kind as "hour" | "day", window_start as string);
        const existing = store.capacity_windows.get(key);
        if (existing) {
          existing.send_count = Math.max(0, existing.send_count - 1);
          existing.updated_at = new Date().toISOString();
        }
        return asResult([]);
      }

      // ─── INSERT audit ────────────────────────────────────────
      if (/^INSERT INTO nex\.marketing_sender_audit/i.test(norm)) {
        const [sender_id, event_type, from_state, to_state, actor, detail] = params!;
        store.audit.push({
          audit_id: `audit-${audit_seq++}`,
          sender_id,
          event_type,
          from_state: from_state ? JSON.parse(from_state as string) : null,
          to_state: to_state ? JSON.parse(to_state as string) : null,
          actor,
          detail: detail ? JSON.parse(detail as string) : {},
          at_iso: new Date().toISOString(),
        });
        return asResult([]);
      }

      // ─── UPDATE sender identity paths ────────────────────────
      if (/^UPDATE nex\.marketing_sender_identity SET/i.test(norm)) {
        const sid = params![params!.length - 1] as string;
        const row = store.senders.get(sid);
        if (!row) return asResult([]);
        // Best-effort field extraction from SQL · sufficient for repository ops in tests
        if (/authentication_state=\$1/.test(norm)) row.authentication_state = params![0];
        if (/verification_state=\$1/.test(norm)) row.verification_state = params![0];
        if (/health_state=\$1, paused_reason=\$2/.test(norm)) {
          row.health_state = params![0];
          row.paused_reason = params![1];
        }
        if (/daily_capacity=\$1, hourly_capacity=\$2, capacity_source=\$3/.test(norm)) {
          row.daily_capacity = params![0];
          row.hourly_capacity = params![1];
          row.capacity_source = params![2];
          row.capacity_verified_at = new Date().toISOString();
        }
        if (/last_send_at=now\(\)/.test(norm)) {
          row.last_send_at = new Date().toISOString();
          row.last_event_at = new Date().toISOString();
        }
        row.updated_at = new Date().toISOString();
        return asResult([row]);
      }

      // ─── SELECT audit history ────────────────────────────────
      if (/^SELECT audit_id, sender_id, event_type/i.test(norm)) {
        const [sid, limit] = params!;
        const rows = store.audit
          .filter(a => a.sender_id === sid)
          .sort((a, b) => b.at_iso.localeCompare(a.at_iso))
          .slice(0, limit as number);
        return asResult(rows);
      }

      // Unhandled · surface loudly rather than silently pass
      throw new Error(`mock-pool: unhandled SQL: ${norm.slice(0, 120)}...`);
    },
    release() { /* no-op for tests */ },
  } as unknown as PoolClient;
  return client;
}

function capacityKey(sender_id: string, kind: "hour" | "day", start: string): string {
  return `${sender_id}|${kind}|${start}`;
}

function asResult(rows: any[]): QueryResult<any> {
  return {
    rows,
    rowCount: rows.length,
    command: "",
    oid: 0,
    fields: [],
  };
}
