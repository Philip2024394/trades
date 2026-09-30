// src/lib/nex-native/first-conversation/__tests__/session-registry-service.test.ts
//
// Bridge 99 · Stage 4b · session-registry-service integration tests.
// Hits the live NEX Supabase project (ijvqdvsvwtwxzcqmoqit) via
// nexSupabaseAdmin (production path) for the service under test, and via
// raw pg for setup/teardown/verification/cleanup.
//
// Cleanup guarantees:
//   · beforeAll: create a dedicated test nex_account row with distinctive
//     display_name '_bridge99_stage4b_test_<random>'.
//   · beforeEach: DELETE all session rows for that account, restoring
//     the empty state before every test.
//   · afterAll: DELETE the test account · FK cascade removes any
//     remaining sessions.
//
// If the DATABASE_URL does not reference the expected project, tests
// abort before any writes.

// MUST be first · loads .env.local before supabase-admin evaluates
import "./_load-env";

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import pkg from "pg";
const { Client } = pkg;

import {
  createSession,
  getSessionById,
  checkSessionValidity,
  revokeSession,
  rollSessionIfNearExpiry,
  touchSessionLastSeen,
  NEX_SESSION_ROLLING_MS,
  NEX_SESSION_ABSOLUTE_MS,
  NEX_SESSION_REFRESH_WINDOW_MS,
} from "../session-registry-service";

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

function loadEnv(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

let pg: InstanceType<typeof Client>;
let testAccountId: string;

beforeAll(async () => {
  loadEnv();

  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(
      `session-registry-service test refuses to run: DATABASE_URL does not reference project ${EXPECTED_PROJECT_REF}`,
    );
  }

  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const rand = Math.random().toString(36).slice(2, 10);
  const displayName = `_bridge99_stage4b_test_${rand}`;
  const r = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [displayName],
  );
  testAccountId = r.rows[0].id;
});

afterAll(async () => {
  if (testAccountId) {
    // Cascade removes any surviving sessions.
    await pg.query(`DELETE FROM nex_account WHERE id = $1`, [testAccountId]);
  }
  await pg.end();
});

beforeEach(async () => {
  await pg.query(
    `DELETE FROM nex_session_registry WHERE account_id = $1`,
    [testAccountId],
  );
});

// ---------------------------------------------------------------------------
// createSession
// ---------------------------------------------------------------------------

describe("createSession", () => {
  it("creates a row and returns the assigned session_id + timestamps", async () => {
    const now = Date.now();
    const result = await createSession({ account_id: testAccountId, now_ms: now });
    expect(result.account_id).toBe(testAccountId);
    expect(result.session_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.issued_at_ms).toBe(now);
    expect(result.expires_at_ms).toBe(now + NEX_SESSION_ROLLING_MS);

    // DB row exists exactly as returned
    const dbRow = await pg.query(
      `SELECT session_id, account_id, EXTRACT(EPOCH FROM issued_at)*1000 AS issued_at_ms,
              EXTRACT(EPOCH FROM expires_at)*1000 AS expires_at_ms, revoked_at
         FROM nex_session_registry WHERE session_id = $1`,
      [result.session_id],
    );
    expect(dbRow.rows).toHaveLength(1);
    expect(dbRow.rows[0].account_id).toBe(testAccountId);
    expect(Number(dbRow.rows[0].issued_at_ms)).toBe(now);
    expect(Number(dbRow.rows[0].expires_at_ms)).toBe(now + NEX_SESSION_ROLLING_MS);
    expect(dbRow.rows[0].revoked_at).toBeNull();
  });

  it("produces distinct session_ids for the same account", async () => {
    const s1 = await createSession({ account_id: testAccountId });
    const s2 = await createSession({ account_id: testAccountId });
    expect(s1.session_id).not.toBe(s2.session_id);
  });
});

// ---------------------------------------------------------------------------
// getSessionById + checkSessionValidity
// ---------------------------------------------------------------------------

describe("getSessionById + checkSessionValidity · create → resolve", () => {
  it("resolves a freshly created session as valid", async () => {
    const now = Date.now();
    const created = await createSession({ account_id: testAccountId, now_ms: now });
    const fetched = await getSessionById(created.session_id);
    expect(fetched).not.toBeNull();
    expect(fetched?.session_id).toBe(created.session_id);
    expect(fetched?.account_id).toBe(testAccountId);
    expect(fetched?.revoked_at_ms).toBeNull();
    expect(fetched?.revoked_reason).toBeNull();

    const validity = await checkSessionValidity(created.session_id, now + 1000);
    expect(validity.valid).toBe(true);
  });

  it("returns null for an unknown session id", async () => {
    const row = await getSessionById("99999999-9999-4999-8999-999999999999");
    expect(row).toBeNull();
  });

  it("returns not_found for an unknown session id", async () => {
    const r = await checkSessionValidity("99999999-9999-4999-8999-999999999999");
    expect(r).toEqual({ valid: false, reason: "not_found" });
  });

  it("returns expired when now >= expires_at", async () => {
    const created = await createSession({ account_id: testAccountId, now_ms: 0 });
    const r = await checkSessionValidity(
      created.session_id,
      NEX_SESSION_ROLLING_MS + 1,
    );
    expect(r).toEqual({ valid: false, reason: "expired" });
  });

  it("returns past_absolute_cap when now beyond issued_at + 90d even if expires_at somehow ahead", async () => {
    // Force a row with expires_at past the cap via raw pg (production path
    // would never write this), then verify defensive check fires.
    const created = await createSession({ account_id: testAccountId, now_ms: 0 });
    const past90d = NEX_SESSION_ABSOLUTE_MS + 5000;
    await pg.query(
      `UPDATE nex_session_registry SET expires_at = to_timestamp($1 / 1000.0)
         WHERE session_id = $2`,
      [past90d + 1000, created.session_id], // expires slightly after "now"
    );
    const r = await checkSessionValidity(created.session_id, past90d);
    expect(r).toEqual({ valid: false, reason: "past_absolute_cap" });
  });
});

// ---------------------------------------------------------------------------
// revokeSession
// ---------------------------------------------------------------------------

describe("revokeSession · session-specific, never account-wide", () => {
  it("revoking session A does NOT affect session B for the same account", async () => {
    const now = Date.now();
    const sessA = await createSession({ account_id: testAccountId, now_ms: now });
    const sessB = await createSession({ account_id: testAccountId, now_ms: now });

    await revokeSession(sessA.session_id, "user_reset_cover_continuity", now + 100);

    const validityA = await checkSessionValidity(sessA.session_id, now + 200);
    expect(validityA).toEqual({ valid: false, reason: "revoked" });

    const validityB = await checkSessionValidity(sessB.session_id, now + 200);
    expect(validityB.valid).toBe(true);

    // Cross-check via raw pg: only session A has revoked_at set
    const dbRow = await pg.query(
      `SELECT session_id, revoked_at, revoked_reason
         FROM nex_session_registry
        WHERE account_id = $1
        ORDER BY issued_at ASC`,
      [testAccountId],
    );
    expect(dbRow.rows).toHaveLength(2);
    const rowA = dbRow.rows.find((r) => r.session_id === sessA.session_id);
    const rowB = dbRow.rows.find((r) => r.session_id === sessB.session_id);
    expect(rowA?.revoked_at).not.toBeNull();
    expect(rowA?.revoked_reason).toBe("user_reset_cover_continuity");
    expect(rowB?.revoked_at).toBeNull();
    expect(rowB?.revoked_reason).toBeNull();
  });

  it("sets revoked_at and revoked_reason on the target row", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    await revokeSession(sess.session_id, "admin_revoke", now + 500);
    const fetched = await getSessionById(sess.session_id);
    expect(fetched?.revoked_at_ms).toBe(now + 500);
    expect(fetched?.revoked_reason).toBe("admin_revoke");
  });

  it("is idempotent · second revoke does not overwrite the first", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    await revokeSession(sess.session_id, "user_reset_cover_continuity", now + 100);
    // Second revoke with a different reason should be a no-op
    await revokeSession(sess.session_id, "admin_revoke", now + 900);
    const fetched = await getSessionById(sess.session_id);
    expect(fetched?.revoked_at_ms).toBe(now + 100);
    expect(fetched?.revoked_reason).toBe("user_reset_cover_continuity");
  });

  it("throws when the session does not exist", async () => {
    await expect(
      revokeSession(
        "88888888-8888-4888-8888-888888888888",
        "admin_revoke",
      ),
    ).rejects.toThrow(/not found/i);
  });

  it("checkSessionValidity returns 'revoked' regardless of expiry state", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    await revokeSession(sess.session_id, "signing_key_rotated", now + 100);
    // Even before expiry, revoked wins
    const r = await checkSessionValidity(sess.session_id, now + 200);
    expect(r).toEqual({ valid: false, reason: "revoked" });
  });
});

// ---------------------------------------------------------------------------
// rollSessionIfNearExpiry · 30-day rolling / 90-day absolute cap
// ---------------------------------------------------------------------------

describe("rollSessionIfNearExpiry · sealed §7 lifetime rules", () => {
  it("extends expires_at when now is inside the refresh window", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    // Fresh session's expires_at is now + 30d; refresh window is last 7d.
    // Advance to 25d in: 5d remaining, inside refresh window.
    const nowLater = now + 25 * 24 * 60 * 60 * 1000;
    const r = await rollSessionIfNearExpiry({
      session_id: sess.session_id,
      now_ms: nowLater,
    });
    expect(r.extended).toBe(true);
    if (r.extended) {
      expect(r.previous_expires_at_ms).toBe(now + NEX_SESSION_ROLLING_MS);
      expect(r.new_expires_at_ms).toBe(nowLater + NEX_SESSION_ROLLING_MS);
      expect(r.absolute_cap_ms).toBe(now + NEX_SESSION_ABSOLUTE_MS);
    }
  });

  it("does NOT extend when now is outside the refresh window", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    // 10d in · 20d remaining · outside 7d refresh window.
    const nowLater = now + 10 * 24 * 60 * 60 * 1000;
    const r = await rollSessionIfNearExpiry({
      session_id: sess.session_id,
      now_ms: nowLater,
    });
    expect(r.extended).toBe(false);
    if (!r.extended) expect(r.reason).toBe("outside_refresh_window");
  });

  it("caps extension at issued_at + 90d absolute", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    // Simulate a session that has already been rolled several times and now
    // has expires_at at day 88 (2d remaining, inside 7d refresh window,
    // only 2d headroom to the absolute cap at day 90).
    const day88 = now + 88 * 24 * 60 * 60 * 1000;
    await pg.query(
      `UPDATE nex_session_registry
          SET expires_at = to_timestamp($1 / 1000.0)
        WHERE session_id = $2`,
      [day88, sess.session_id],
    );

    // Now attempt to roll at day 85 (3d before the simulated expires_at,
    // inside the 7d refresh window). Proposed new expiry = day 85 + 30d =
    // day 115, but absolute cap = day 90 → new expires_at must be capped.
    const day85 = now + 85 * 24 * 60 * 60 * 1000;
    const r = await rollSessionIfNearExpiry({
      session_id: sess.session_id,
      now_ms: day85,
    });
    expect(r.extended).toBe(true);
    if (r.extended) {
      const absoluteCap = now + NEX_SESSION_ABSOLUTE_MS;
      expect(r.new_expires_at_ms).toBe(absoluteCap);
      expect(r.new_expires_at_ms).toBeLessThan(
        day85 + NEX_SESSION_ROLLING_MS,
      );
    }
  });

  it("returns 'at_absolute_cap' when the session is already sitting at the cap", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    // Set expires_at exactly at the absolute cap.
    const absoluteCap = now + NEX_SESSION_ABSOLUTE_MS;
    await pg.query(
      `UPDATE nex_session_registry
          SET expires_at = to_timestamp($1 / 1000.0)
        WHERE session_id = $2`,
      [absoluteCap, sess.session_id],
    );
    // Attempt to roll at day 85 (5d remaining · inside refresh window).
    const day85 = now + 85 * 24 * 60 * 60 * 1000;
    const r = await rollSessionIfNearExpiry({
      session_id: sess.session_id,
      now_ms: day85,
    });
    expect(r.extended).toBe(false);
    if (!r.extended) {
      expect(r.reason).toBe("at_absolute_cap");
      expect(r.absolute_cap_ms).toBe(absoluteCap);
    }
  });

  it("does NOT extend a revoked session", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    await revokeSession(sess.session_id, "user_reset_cover_continuity", now + 100);
    const r = await rollSessionIfNearExpiry({
      session_id: sess.session_id,
      now_ms: now + 25 * 24 * 60 * 60 * 1000,
    });
    expect(r.extended).toBe(false);
    if (!r.extended) expect(r.reason).toBe("revoked");
  });

  it("does NOT extend an expired session", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    const r = await rollSessionIfNearExpiry({
      session_id: sess.session_id,
      now_ms: now + NEX_SESSION_ROLLING_MS + 1000,
    });
    expect(r.extended).toBe(false);
    if (!r.extended) expect(r.reason).toBe("expired");
  });

  it("returns not_found for unknown session id", async () => {
    const r = await rollSessionIfNearExpiry({
      session_id: "77777777-7777-4777-8777-777777777777",
    });
    expect(r.extended).toBe(false);
    if (!r.extended) expect(r.reason).toBe("not_found");
  });
});

// ---------------------------------------------------------------------------
// touchSessionLastSeen · observability only, does NOT roll expiry
// ---------------------------------------------------------------------------

describe("touchSessionLastSeen · §7B rule: cookie re-presentation is not activity", () => {
  it("updates last_seen_at but does NOT extend expires_at", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    const before = await getSessionById(sess.session_id);
    expect(before?.last_seen_at_ms).toBe(now);
    expect(before?.expires_at_ms).toBe(now + NEX_SESSION_ROLLING_MS);

    await touchSessionLastSeen(sess.session_id, now + 60_000);

    const after = await getSessionById(sess.session_id);
    expect(after?.last_seen_at_ms).toBe(now + 60_000);
    // Critically, expires_at unchanged
    expect(after?.expires_at_ms).toBe(now + NEX_SESSION_ROLLING_MS);
  });

  it("silently no-ops on a revoked session (does not throw)", async () => {
    const now = Date.now();
    const sess = await createSession({ account_id: testAccountId, now_ms: now });
    await revokeSession(sess.session_id, "user_reset_cover_continuity", now + 100);
    await expect(
      touchSessionLastSeen(sess.session_id, now + 500),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Account-deletion cascade
// ---------------------------------------------------------------------------

describe("account deletion cascade", () => {
  it("DELETE nex_account removes all its session rows via FK CASCADE", { timeout: 30_000 }, async () => {
    // Create a throwaway account distinct from the shared testAccountId
    // so this test does not disturb subsequent tests' account.
    const r = await pg.query(
      `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
      [`_bridge99_stage4b_cascade_${Math.random().toString(36).slice(2, 8)}`],
    );
    const throwawayId = r.rows[0].id as string;

    try {
      const s1 = await createSession({ account_id: throwawayId });
      const s2 = await createSession({ account_id: throwawayId });

      // Sanity: both rows exist
      const before = await pg.query(
        `SELECT session_id FROM nex_session_registry WHERE account_id = $1`,
        [throwawayId],
      );
      expect(before.rows).toHaveLength(2);

      // DELETE the account
      await pg.query(`DELETE FROM nex_account WHERE id = $1`, [throwawayId]);

      // Both sessions must be gone
      const after = await pg.query(
        `SELECT session_id FROM nex_session_registry
          WHERE session_id IN ($1, $2)`,
        [s1.session_id, s2.session_id],
      );
      expect(after.rows).toHaveLength(0);
    } finally {
      // Belt-and-braces cleanup if the DELETE above didn't happen
      await pg.query(`DELETE FROM nex_account WHERE id = $1`, [throwawayId]);
    }
  });
});
