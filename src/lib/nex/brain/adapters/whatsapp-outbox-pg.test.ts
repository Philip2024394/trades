// src/lib/nex/brain/adapters/whatsapp-outbox-pg.test.ts
//
// Stage 3.39 · Postgres outbox driver · fake-client unit tests.
//
// These tests exercise the DRIVER shape against an injectable fake
// withClient, so we don't need a live Postgres. Integration tests
// against a real DB are gated on NEX_POSTGRES_URL in a separate
// landing.

import { describe, expect, it } from "vitest";
import { makePostgresOutboxDriver, IdempotencyNotAvailableError } from "./whatsapp-outbox";

const NOW = () => "2026-08-31T10:00:00.000Z";

type FakeRow = Record<string, unknown>;
function fakeClient(handlers: {
  onQuery: (sql: string, params: unknown[]) => { rows: FakeRow[]; rowCount: number | null } | Error;
}) {
  return async <T>(fn: (c: { query: (sql: string, params?: unknown[]) => Promise<{ rows: FakeRow[]; rowCount: number | null }> }) => Promise<T>): Promise<T | null> => {
    const c = {
      query: async (sql: string, params: unknown[] = []) => {
        const out = handlers.onQuery(sql, params);
        if (out instanceof Error) throw out;
        return out;
      },
    };
    return fn(c);
  };
}

function nullWithClient<T>(
  _fn: (c: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> }) => Promise<T>,
): Promise<T | null> {
  return Promise.resolve(null);
}

const sampleRow: FakeRow = {
  correlation_id:      "c1",
  provider_id:         "meta_cloud",
  target_canonical:    "Gaotama Hotel",
  to_e164:             "6281234567890",
  body_hash:           "abcdef",
  status:              "PENDING",
  provider_message_id: null,
  created_at:          "2026-08-31T10:00:00.000Z",
  resolved_at:         null,
  resolution_reason:   null,
  attempts:            1,
};

describe("postgres outbox driver · recordAttempt", () => {
  it("INSERT returning row → maps to OutboxEntry", async () => {
    let capturedSql = "";
    let capturedParams: unknown[] = [];
    const driver = makePostgresOutboxDriver(fakeClient({
      onQuery: (sql, params) => {
        capturedSql = sql;
        capturedParams = params;
        return { rows: [sampleRow], rowCount: 1 };
      },
    }));
    const entry = await driver.recordAttempt({
      correlationId: "c1", providerId: "meta_cloud",
      targetCanonical: "Gaotama Hotel", toE164: "6281234567890",
      bodyHash: "abcdef", now: NOW,
    });
    expect(entry.status).toBe("PENDING");
    expect(entry.correlationId).toBe("c1");
    expect(capturedSql).toContain("INSERT INTO public.hammerex_nex_whatsapp_outbox");
    expect(capturedParams[0]).toBe("c1");
  });

  it("unique_violation (SQLSTATE 23505) → IdempotencyNotAvailableError", async () => {
    const err = Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
    const driver = makePostgresOutboxDriver(fakeClient({
      onQuery: () => err,
    }));
    await expect(driver.recordAttempt({
      correlationId: "c1", providerId: "meta_cloud",
      targetCanonical: "X", toE164: "+62", bodyHash: "abc", now: NOW,
    })).rejects.toThrow(IdempotencyNotAvailableError);
  });

  it("no DB URL configured (withClient returns null) → loud throw · never silent degrade", async () => {
    const driver = makePostgresOutboxDriver(nullWithClient);
    await expect(driver.recordAttempt({
      correlationId: "c1", providerId: "meta_cloud",
      targetCanonical: "X", toE164: "+62", bodyHash: "abc", now: NOW,
    })).rejects.toThrow(/withClient returned null/);
  });
});

describe("postgres outbox driver · markOutcome", () => {
  it("normal update returns updated row", async () => {
    const driver = makePostgresOutboxDriver(fakeClient({
      onQuery: () => ({
        rows: [{ ...sampleRow, status: "ACCEPTED", provider_message_id: "wamid.1", resolved_at: NOW() }],
        rowCount: 1,
      }),
    }));
    const e = await driver.markOutcome("c1", { status: "ACCEPTED", providerMessageId: "wamid.1", now: NOW });
    expect(e.status).toBe("ACCEPTED");
    expect(e.providerMessageId).toBe("wamid.1");
  });

  it("CONFIRMED regression BLOCKED at SQL layer · UPDATE returns 0 rows, re-fetch returns current CONFIRMED", async () => {
    let call = 0;
    const driver = makePostgresOutboxDriver(fakeClient({
      onQuery: (sql) => {
        call += 1;
        if (call === 1) {
          expect(sql).toMatch(/UPDATE public\.hammerex_nex_whatsapp_outbox/);
          // WHERE NOT (status = 'CONFIRMED' AND $2 <> 'CONFIRMED') matched nothing
          return { rows: [], rowCount: 0 };
        }
        // Re-fetch returns the row still CONFIRMED
        expect(sql).toMatch(/SELECT \* FROM public\.hammerex_nex_whatsapp_outbox/);
        return { rows: [{ ...sampleRow, status: "CONFIRMED", provider_message_id: "wamid.1" }], rowCount: 1 };
      },
    }));
    const e = await driver.markOutcome("c1", { status: "ACCEPTED", now: NOW });
    expect(e.status).toBe("CONFIRMED"); // regression blocked
  });

  it("no rows found on either update or re-fetch → throws (programmer error)", async () => {
    const driver = makePostgresOutboxDriver(fakeClient({
      onQuery: () => ({ rows: [], rowCount: 0 }),
    }));
    await expect(driver.markOutcome("c-none", { status: "ACCEPTED", now: NOW })).rejects.toThrow(/no outbox entry/);
  });
});

describe("postgres outbox driver · findByProviderMessageId", () => {
  it("returns the row when wamid matches", async () => {
    const driver = makePostgresOutboxDriver(fakeClient({
      onQuery: (sql, params) => {
        expect(sql).toContain("WHERE provider_message_id = $1");
        expect(params[0]).toBe("wamid.xyz");
        return { rows: [{ ...sampleRow, provider_message_id: "wamid.xyz", status: "ACCEPTED" }], rowCount: 1 };
      },
    }));
    const e = await driver.findByProviderMessageId("wamid.xyz");
    expect(e?.providerMessageId).toBe("wamid.xyz");
    expect(e?.status).toBe("ACCEPTED");
  });

  it("returns undefined when no row matches", async () => {
    const driver = makePostgresOutboxDriver(fakeClient({
      onQuery: () => ({ rows: [], rowCount: 0 }),
    }));
    expect(await driver.findByProviderMessageId("wamid.none")).toBeUndefined();
  });

  it("no DB URL → returns undefined (soft, so webhook can honestly report 'not found')", async () => {
    const driver = makePostgresOutboxDriver(nullWithClient);
    expect(await driver.findByProviderMessageId("wamid.x")).toBeUndefined();
  });
});
