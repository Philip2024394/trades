// src/lib/nex-calling/gate.test.ts
//
// NEX Calling · Business Gate Regression Tests · Philip 2026-08-27.
//
// Every test uses a real transaction that ROLLS BACK · zero DB persistence.
// Zero risk to production data. Follows the same discipline as the Phase 1a
// identity-resolver tests.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";
import { decideCall } from "./gate";

const POOL = new pg.Pool({
  connectionString: process.env.NEX_POSTGRES_URL
    ?? "postgresql://postgres:Admin1phil@localhost:5433/nex_dev",
  max: 3,
});

beforeAll(async () => {
  // Ensure the table exists (migration must have run).
  const r = await POOL.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables
      WHERE table_schema='nex' AND table_name='business_calling_config'`,
  );
  if (r.rows[0].n === 0) {
    throw new Error("nex.business_calling_config missing · run migration 116");
  }
});

afterAll(async () => { await POOL.end(); });

async function inTx<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await POOL.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("ROLLBACK");
    return out;
  } finally { c.release(); }
}

describe("nex-calling · business gate", () => {
  it("denies when no config row exists", async () => {
    await inTx(async (c) => {
      const d = await decideCall(c, {
        businessTable: "nex.food_business",
        businessRef: "#FL-UNCONFIGURED",
        callerIdentity: "user-abc",
        mediaType: "voice",
      });
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe("no_config");
    });
  });

  it("denies when consent not yet given", async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO nex.business_calling_config
          (business_table, business_ref, voice_enabled, video_enabled)
         VALUES ('nex.food_business', '#FL-TEST-NOCONSENT', true, true)`,
      );
      const d = await decideCall(c, {
        businessTable: "nex.food_business",
        businessRef: "#FL-TEST-NOCONSENT",
        callerIdentity: "user-abc",
        mediaType: "voice",
      });
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe("no_consent");
    });
  });

  it("denies when the requested media type is disabled", async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO nex.business_calling_config
          (business_table, business_ref, voice_enabled, video_enabled, consent_at, consent_by)
         VALUES ('nex.food_business', '#FL-TEST-VOICEOFF', false, true, now(), 'admin')`,
      );
      const d = await decideCall(c, {
        businessTable: "nex.food_business",
        businessRef: "#FL-TEST-VOICEOFF",
        callerIdentity: "user-abc",
        mediaType: "voice",
      });
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe("not_enabled");
    });
  });

  it("denies blocked callers even with consent + enablement", async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO nex.business_calling_config
          (business_table, business_ref, voice_enabled, video_enabled, consent_at, consent_by, blocked_callers)
         VALUES ('nex.food_business', '#FL-TEST-BLOCK', true, true, now(), 'admin', ARRAY['user-blocked'])`,
      );
      const d = await decideCall(c, {
        businessTable: "nex.food_business",
        businessRef: "#FL-TEST-BLOCK",
        callerIdentity: "user-blocked",
        mediaType: "voice",
      });
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe("caller_blocked");
    });
  });

  it("allows when everything green (no hours restriction)", async () => {
    await inTx(async (c) => {
      await c.query(
        `INSERT INTO nex.business_calling_config
          (business_table, business_ref, voice_enabled, video_enabled, consent_at, consent_by)
         VALUES ('nex.food_business', '#FL-TEST-GREEN', true, true, now(), 'admin')`,
      );
      const d = await decideCall(c, {
        businessTable: "nex.food_business",
        businessRef: "#FL-TEST-GREEN",
        callerIdentity: "user-abc",
        mediaType: "video",
      });
      expect(d.allow).toBe(true);
      if (d.allow) expect(d.mediaType).toBe("video");
    });
  });

  it("rejects unknown business_table (default deny)", async () => {
    await inTx(async (c) => {
      const d = await decideCall(c, {
        businessTable: "nex.some_unknown_table",
        businessRef: "#XX-000",
        callerIdentity: "user-abc",
        mediaType: "voice",
      });
      expect(d.allow).toBe(false);
      if (!d.allow) expect(d.reason).toBe("no_config");
    });
  });
});
