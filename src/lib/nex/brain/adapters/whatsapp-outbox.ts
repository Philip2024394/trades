// src/lib/nex/brain/adapters/whatsapp-outbox.ts
//
// Stage 3.38 (in-memory) + Stage 3.39 (driver abstraction + Postgres).
//
// CONSTITUTIONAL:
//   · Every send attempt is recorded BEFORE the provider is called
//     · so a crashed process never loses the fact that we tried.
//   · A retry is FORBIDDEN unless (a) an outbox record exists, (b)
//     the provider supports idempotency keys, and (c) reconciliation
//     has established the record's canonical status. Until then,
//     `IdempotencyNotAvailableError` is thrown · never silently retry.
//   · Statuses:
//       PENDING     — recorded, provider not called yet
//       ACCEPTED    — provider returned accepted (delivery unknown)
//       CONFIRMED   — provider returned delivered OR webhook resolved
//       REJECTED    — provider explicitly refused
//       TIMED_OUT   — no provider response within budget · UNKNOWN
//       UNKNOWN     — provider threw non-network exception · state unclear
//
// Stage 3.39 driver selection (via `NEX_WHATSAPP_OUTBOX_DRIVER` env):
//   · "memory"   — in-memory Map (dev/test default · same as 3.38)
//   · "postgres" — durable Postgres table (production)
// Both drivers implement the same async API so the provider-adapter
// doesn't care which one is active.

// ─── Types (public) ────────────────────────────────────────────────

export type OutboxStatus =
  | "PENDING"
  | "ACCEPTED"
  | "CONFIRMED"
  | "REJECTED"
  | "TIMED_OUT"
  | "UNKNOWN";

export type OutboxEntry = {
  correlationId:       string;
  providerId:          string;
  targetCanonical:     string;
  toE164:              string;
  bodyHash:            string;
  status:              OutboxStatus;
  providerMessageId?:  string;
  createdAt:           string;
  resolvedAt?:         string;
  resolutionReason?:   string;
  attempts:            number;
};

export class IdempotencyNotAvailableError extends Error {
  constructor(correlationId: string, reason: string) {
    super(`Cannot retry correlationId=${correlationId}: ${reason}`);
    this.name = "IdempotencyNotAvailableError";
  }
}

// ─── Driver interface ──────────────────────────────────────────────

export interface WhatsAppOutboxDriver {
  readonly id: "memory" | "postgres";
  recordAttempt(input: {
    correlationId:   string;
    providerId:      string;
    targetCanonical: string;
    toE164:          string;
    bodyHash:        string;
    now:             () => string;
  }): Promise<OutboxEntry>;
  markOutcome(correlationId: string, next: {
    status:             OutboxStatus;
    providerMessageId?: string;
    resolutionReason?:  string;
    now:                () => string;
  }): Promise<OutboxEntry>;
  getEntry(correlationId: string): Promise<OutboxEntry | undefined>;
  /** Look up by provider message id (Meta wamid) · used by webhook reconciliation. */
  findByProviderMessageId(providerMessageId: string): Promise<OutboxEntry | undefined>;
}

// ─── Memory driver ─────────────────────────────────────────────────

const GLOBAL_KEY = "__nexWhatsappOutbox__" as const;

function bag(): Map<string, OutboxEntry> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!(GLOBAL_KEY in g)) g[GLOBAL_KEY] = new Map<string, OutboxEntry>();
  return g[GLOBAL_KEY] as Map<string, OutboxEntry>;
}

export const memoryOutboxDriver: WhatsAppOutboxDriver = {
  id: "memory",
  async recordAttempt(input) {
    const m = bag();
    const existing = m.get(input.correlationId);
    if (existing) {
      throw new IdempotencyNotAvailableError(
        input.correlationId,
        `outbox already has a record for this correlationId (status=${existing.status}) · retry requires reconciliation before it is safe to send again`,
      );
    }
    const entry: OutboxEntry = {
      correlationId:   input.correlationId,
      providerId:      input.providerId,
      targetCanonical: input.targetCanonical,
      toE164:          input.toE164,
      bodyHash:        input.bodyHash,
      status:          "PENDING",
      createdAt:       input.now(),
      attempts:        1,
    };
    m.set(input.correlationId, entry);
    return entry;
  },
  async markOutcome(correlationId, next) {
    const m = bag();
    const cur = m.get(correlationId);
    if (!cur) {
      throw new Error(`markOutcome: no outbox entry for correlationId=${correlationId}`);
    }
    // CONFIRMED never regresses · locked here so a late-arriving
    // "sent" event can't overwrite an earlier delivery confirmation.
    if (cur.status === "CONFIRMED" && next.status !== "CONFIRMED") {
      return cur;
    }
    const nextEntry: OutboxEntry = {
      ...cur,
      status:             next.status,
      providerMessageId:  next.providerMessageId ?? cur.providerMessageId,
      resolvedAt:         next.now(),
      resolutionReason:   next.resolutionReason ?? cur.resolutionReason,
    };
    m.set(correlationId, nextEntry);
    return nextEntry;
  },
  async getEntry(correlationId) {
    return bag().get(correlationId);
  },
  async findByProviderMessageId(providerMessageId) {
    for (const e of bag().values()) {
      if (e.providerMessageId === providerMessageId) return e;
    }
    return undefined;
  },
};

// ─── Postgres driver (Stage 3.39) ──────────────────────────────────

function rowToEntry(row: Record<string, unknown>): OutboxEntry {
  return {
    correlationId:      String(row.correlation_id),
    providerId:         String(row.provider_id),
    targetCanonical:    String(row.target_canonical),
    toE164:             String(row.to_e164),
    bodyHash:           String(row.body_hash),
    status:             String(row.status) as OutboxStatus,
    providerMessageId:  (row.provider_message_id as string | null) ?? undefined,
    createdAt:          (row.created_at as Date | string).toString(),
    resolvedAt:         row.resolved_at ? (row.resolved_at as Date | string).toString() : undefined,
    resolutionReason:   (row.resolution_reason as string | null) ?? undefined,
    attempts:           Number(row.attempts),
  };
}

/**
 * Build the Postgres driver. `withClient` is injectable so the driver
 * can be unit-tested against a fake client without hitting the real DB.
 */
export function makePostgresOutboxDriver(
  withClient: <T>(fn: (c: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> }) => Promise<T>) => Promise<T | null>,
): WhatsAppOutboxDriver {
  return {
    id: "postgres",
    async recordAttempt(input) {
      const out = await withClient(async (c) => {
        try {
          const r = await c.query(
            `INSERT INTO public.hammerex_nex_whatsapp_outbox
               (correlation_id, provider_id, target_canonical, to_e164, body_hash, status, created_at, attempts)
             VALUES ($1, $2, $3, $4, $5, 'PENDING', $6::timestamptz, 1)
             RETURNING *`,
            [input.correlationId, input.providerId, input.targetCanonical, input.toE164, input.bodyHash, input.now()],
          );
          return rowToEntry(r.rows[0]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          // Postgres unique_violation SQLSTATE 23505 · fallback to
          // substring match so we still catch it if the client wraps
          // the error object.
          const isUnique = (err as { code?: string })?.code === "23505"
            || /unique|duplicate key/i.test(msg);
          if (isUnique) {
            throw new IdempotencyNotAvailableError(
              input.correlationId,
              `outbox already has a record for this correlationId · retry requires reconciliation before it is safe to send again`,
            );
          }
          throw err;
        }
      });
      if (out == null) {
        // No DB URL · programmer misconfiguration when postgres driver
        // is explicitly selected. Loud throw · never silently degrade.
        throw new Error("postgres outbox driver: NEX_POSTGRES_URL not set · cannot record attempt · check config");
      }
      return out;
    },
    async markOutcome(correlationId, next) {
      const out = await withClient(async (c) => {
        // CONFIRMED never regresses · WHERE clause blocks it at the DB.
        // We UPDATE unless the row is already CONFIRMED and the new
        // status isn't CONFIRMED. If nothing updates, we re-fetch and
        // return current state (idempotent late-webhook handling).
        const r = await c.query(
          `UPDATE public.hammerex_nex_whatsapp_outbox
             SET status              = $2,
                 provider_message_id = COALESCE($3, provider_message_id),
                 resolution_reason   = COALESCE($4, resolution_reason),
                 resolved_at         = $5::timestamptz
             WHERE correlation_id = $1
               AND NOT (status = 'CONFIRMED' AND $2 <> 'CONFIRMED')
             RETURNING *`,
          [correlationId, next.status, next.providerMessageId ?? null, next.resolutionReason ?? null, next.now()],
        );
        if (r.rowCount === 0) {
          // Either no row for this correlationId, or CONFIRMED regression blocked.
          const cur = await c.query(
            `SELECT * FROM public.hammerex_nex_whatsapp_outbox WHERE correlation_id = $1`,
            [correlationId],
          );
          if (cur.rowCount === 0) {
            throw new Error(`markOutcome: no outbox entry for correlationId=${correlationId}`);
          }
          return rowToEntry(cur.rows[0]);
        }
        return rowToEntry(r.rows[0]);
      });
      if (out == null) throw new Error("postgres outbox driver: NEX_POSTGRES_URL not set");
      return out;
    },
    async getEntry(correlationId) {
      const out = await withClient(async (c) => {
        const r = await c.query(
          `SELECT * FROM public.hammerex_nex_whatsapp_outbox WHERE correlation_id = $1`,
          [correlationId],
        );
        return r.rowCount === 0 ? undefined : rowToEntry(r.rows[0]);
      });
      if (out === null) return undefined; // no DB URL → treat as not-found · caller decides
      return out;
    },
    async findByProviderMessageId(providerMessageId) {
      const out = await withClient(async (c) => {
        const r = await c.query(
          `SELECT * FROM public.hammerex_nex_whatsapp_outbox WHERE provider_message_id = $1 LIMIT 1`,
          [providerMessageId],
        );
        return r.rowCount === 0 ? undefined : rowToEntry(r.rows[0]);
      });
      if (out === null) return undefined;
      return out;
    },
  };
}

// ─── Driver selection ──────────────────────────────────────────────

let __activeDriver: WhatsAppOutboxDriver | undefined;

/**
 * Return the currently active outbox driver. Defaults to memory ·
 * tests explicitly override via `_setOutboxDriverForTests`. Production
 * code should call `configureOutboxDriverFromEnv()` at boot.
 */
export function getOutboxDriver(): WhatsAppOutboxDriver {
  if (__activeDriver) return __activeDriver;
  return memoryOutboxDriver;
}

export function _setOutboxDriverForTests(driver: WhatsAppOutboxDriver | undefined): void {
  __activeDriver = driver;
}

// ─── Facade functions · same names as pre-3.39 · now async ─────────

export function recordAttempt(input: {
  correlationId:   string;
  providerId:      string;
  targetCanonical: string;
  toE164:          string;
  bodyHash:        string;
  now:             () => string;
}): Promise<OutboxEntry> {
  return getOutboxDriver().recordAttempt(input);
}

export function markOutcome(
  correlationId: string,
  next: { status: OutboxStatus; providerMessageId?: string; resolutionReason?: string; now: () => string },
): Promise<OutboxEntry> {
  return getOutboxDriver().markOutcome(correlationId, next);
}

export function getOutboxEntry(correlationId: string): Promise<OutboxEntry | undefined> {
  return getOutboxDriver().getEntry(correlationId);
}

export function findOutboxByProviderMessageId(providerMessageId: string): Promise<OutboxEntry | undefined> {
  return getOutboxDriver().findByProviderMessageId(providerMessageId);
}

// ─── Test helpers ──────────────────────────────────────────────────

export function _resetOutboxForTests(): void {
  bag().clear();
  __activeDriver = undefined;
}

export function outboxSizeForTests(): number {
  return bag().size;
}
