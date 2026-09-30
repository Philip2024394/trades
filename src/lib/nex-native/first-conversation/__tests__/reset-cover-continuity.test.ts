// src/lib/nex-native/first-conversation/__tests__/reset-cover-continuity.test.ts
//
// Bridge 99 · Stage 4e · reset endpoint core tests (deterministic + live DB).
//
// Key founder acceptance criterion:
//   Two sessions A and B for the same account. Call reset with A's
//   cookie. Assert A is revoked, B remains valid.

import "./_load-env"; // MUST be first

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pkg from "pg";
const { Client } = pkg;

import {
  resetCoverContinuityWith,
  type ResetCoverContinuityResult,
} from "../reset-cover-continuity";
import {
  writeNexSessionCookie,
  type NexCookieAdapter,
  type NexCookieWriteOptions,
  type NexCookieScope,
  type NexSessionCookieConfig,
} from "../session-cookie";
import {
  createSession,
  checkSessionValidity,
  revokeSession,
} from "../session-registry-service";
import {
  signSessionToken,
  type NexSessionCryptoConfig,
  type NexSessionPayload,
} from "../session-crypto";

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

const KEY_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const cryptoCfg: NexSessionCryptoConfig = {
  activeKey: KEY_A,
  acceptedKeys: [KEY_A],
};
const cookieCfg: NexSessionCookieConfig = {
  secure: true,
  path: "/",
};

// ---------------------------------------------------------------------------
// In-memory cookie adapter (records writes + clears)
// ---------------------------------------------------------------------------

interface WriteRec {
  name: string;
  value: string;
  options: NexCookieWriteOptions;
}
interface ClearRec {
  name: string;
  scope: NexCookieScope;
}
function makeFakeAdapter(): {
  adapter: NexCookieAdapter;
  writes: WriteRec[];
  clears: ClearRec[];
  seed(name: string, value: string): void;
  read(name: string): string | undefined;
} {
  const jar = new Map<string, string>();
  const writes: WriteRec[] = [];
  const clears: ClearRec[] = [];
  return {
    adapter: {
      read: (n) => jar.get(n),
      write: (n, v, o) => {
        jar.set(n, v);
        writes.push({ name: n, value: v, options: o });
      },
      clear: (n, scope) => {
        jar.delete(n);
        clears.push({ name: n, scope });
      },
    },
    writes,
    clears,
    seed: (n, v) => jar.set(n, v),
    read: (n) => jar.get(n),
  };
}

// ---------------------------------------------------------------------------
// Live DB setup
// ---------------------------------------------------------------------------

let pg: InstanceType<typeof Client>;
let testAccountId: string;

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(
      `reset-cover-continuity test refuses to run: DATABASE_URL does not reference project ${EXPECTED_PROJECT_REF}`,
    );
  }
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const rand = Math.random().toString(36).slice(2, 10);
  const r = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_bridge99_stage4e_test_${rand}`],
  );
  testAccountId = r.rows[0].id;
});

afterAll(async () => {
  if (testAccountId) {
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
// Helpers
// ---------------------------------------------------------------------------

async function seedValidSession(now_ms: number = Date.now()): Promise<{
  adapter: ReturnType<typeof makeFakeAdapter>;
  session_id: string;
}> {
  const bundle = makeFakeAdapter();
  const created = await createSession({
    account_id: testAccountId,
    now_ms,
  });
  const payload: NexSessionPayload = {
    account_id: created.account_id,
    session_id: created.session_id,
    issued_at_ms: created.issued_at_ms,
    expires_at_ms: created.expires_at_ms,
  };
  writeNexSessionCookie(bundle.adapter, payload, cryptoCfg, cookieCfg, now_ms);
  return { adapter: bundle, session_id: created.session_id };
}

// ---------------------------------------------------------------------------
// KEY ACCEPTANCE · session-specific revocation
// ---------------------------------------------------------------------------

describe("resetCoverContinuityWith · founder acceptance · session-specific revocation", () => {
  it("revokes session A · leaves session B for the same account UNTOUCHED", async () => {
    const now = Date.now();

    // Session A · presented in the reset call
    const { adapter: adapterA, session_id: sessA } = await seedValidSession(now);

    // Session B · same account, DIFFERENT session_id, held elsewhere (e.g.
    // another device). No cookie needed for B in this test · we assert its
    // registry-side validity independently.
    const sessB = await createSession({
      account_id: testAccountId,
      now_ms: now,
    });

    // Sanity · both sessions valid before reset
    expect((await checkSessionValidity(sessA, now + 100)).valid).toBe(true);
    expect((await checkSessionValidity(sessB.session_id, now + 100)).valid).toBe(true);

    // Reset presenting session A's cookie
    const result = await resetCoverContinuityWith({
      cookieAdapter: adapterA.adapter,
      cookieCfg,
      cryptoCfg,
      now_ms: now + 200,
    });

    expect(result).toEqual({
      reset: true,
      session_id: sessA,
      account_id: testAccountId,
    });

    // Session A must be revoked
    const afterA = await checkSessionValidity(sessA, now + 300);
    expect(afterA).toEqual({ valid: false, reason: "revoked" });

    // Session B MUST still be valid
    const afterB = await checkSessionValidity(sessB.session_id, now + 300);
    expect(afterB.valid).toBe(true);

    // Cross-check via raw pg · only A has revoked_at set
    const rows = await pg.query(
      `SELECT session_id, revoked_at, revoked_reason
         FROM nex_session_registry
        WHERE account_id = $1
        ORDER BY issued_at ASC`,
      [testAccountId],
    );
    expect(rows.rows).toHaveLength(2);
    const rowA = rows.rows.find((r) => r.session_id === sessA);
    const rowB = rows.rows.find((r) => r.session_id === sessB.session_id);
    expect(rowA?.revoked_at).not.toBeNull();
    expect(rowA?.revoked_reason).toBe("user_reset_cover_continuity");
    expect(rowB?.revoked_at).toBeNull();
    expect(rowB?.revoked_reason).toBeNull();

    // Cookie A must be cleared
    expect(adapterA.read("nex_session")).toBeUndefined();
    expect(adapterA.clears).toHaveLength(1);
    expect(adapterA.clears[0].name).toBe("nex_session");
  });
});

// ---------------------------------------------------------------------------
// Successful reset details
// ---------------------------------------------------------------------------

describe("resetCoverContinuityWith · successful reset shape", () => {
  it("uses reason 'user_reset_cover_continuity' on the revoke", async () => {
    const now = Date.now();
    const { adapter, session_id } = await seedValidSession(now);
    await resetCoverContinuityWith({
      cookieAdapter: adapter.adapter,
      cookieCfg,
      cryptoCfg,
      now_ms: now + 100,
    });
    const row = await pg.query(
      `SELECT revoked_reason FROM nex_session_registry WHERE session_id = $1`,
      [session_id],
    );
    expect(row.rows[0].revoked_reason).toBe("user_reset_cover_continuity");
  });

  it("clears the cookie with the same scope (Domain/Path) it was configured with", async () => {
    const now = Date.now();
    const { adapter } = await seedValidSession(now);
    const cfgWithDomain: NexSessionCookieConfig = {
      secure: true,
      domain: ".nex.com",
      path: "/",
    };
    await resetCoverContinuityWith({
      cookieAdapter: adapter.adapter,
      cookieCfg: cfgWithDomain,
      cryptoCfg,
      now_ms: now + 100,
    });
    expect(adapter.clears).toHaveLength(1);
    expect(adapter.clears[0].scope).toEqual({
      domain: ".nex.com",
      path: "/",
    });
  });
});

// ---------------------------------------------------------------------------
// 'none' branches · never errors
// ---------------------------------------------------------------------------

describe("resetCoverContinuityWith · 'none' branches · non-throwing, cookie cleared", () => {
  it("no cookie → { reset: false, reason: 'no_session_to_reset' } and clears cookie defensively", async () => {
    const adapter = makeFakeAdapter();
    const result = await resetCoverContinuityWith({
      cookieAdapter: adapter.adapter,
      cookieCfg,
      cryptoCfg,
    });
    expect(result).toEqual({ reset: false, reason: "no_session_to_reset" });
    expect(adapter.clears).toHaveLength(1);
  });

  it("malformed cookie → { reset: false, reason: 'invalid_cookie_cleared' } and clears cookie", async () => {
    const adapter = makeFakeAdapter();
    adapter.seed("nex_session", "junk-not-a-token");
    const result = await resetCoverContinuityWith({
      cookieAdapter: adapter.adapter,
      cookieCfg,
      cryptoCfg,
    });
    expect(result).toEqual({ reset: false, reason: "invalid_cookie_cleared" });
    expect(adapter.clears).toHaveLength(1);
    expect(adapter.read("nex_session")).toBeUndefined();
  });

  it("expired cookie → { reset: false, reason: 'invalid_cookie_cleared' } and clears cookie", async () => {
    const now = 1_000_000;
    const created = await createSession({
      account_id: testAccountId,
      now_ms: now,
    });
    const shortPayload: NexSessionPayload = {
      account_id: created.account_id,
      session_id: created.session_id,
      issued_at_ms: now,
      expires_at_ms: now + 60_000,
    };
    const adapter = makeFakeAdapter();
    adapter.seed("nex_session", signSessionToken(shortPayload, cryptoCfg));
    const result = await resetCoverContinuityWith({
      cookieAdapter: adapter.adapter,
      cookieCfg,
      cryptoCfg,
      now_ms: now + 120_000, // past cookie expiry
    });
    expect(result).toEqual({ reset: false, reason: "invalid_cookie_cleared" });
    expect(adapter.clears).toHaveLength(1);
  });

  it("cookie valid but registry session already revoked → { reset: false } (no double-revoke error)", async () => {
    const now = Date.now();
    const { adapter, session_id } = await seedValidSession(now);
    // Pre-revoke the session via the service (not via reset)
    await revokeSession(session_id, "admin_revoke", now + 50);

    const result = await resetCoverContinuityWith({
      cookieAdapter: adapter.adapter,
      cookieCfg,
      cryptoCfg,
      now_ms: now + 100,
    });
    expect(result).toEqual({ reset: false, reason: "invalid_cookie_cleared" });
    expect(adapter.clears).toHaveLength(1);

    // Verify the original revoke reason is preserved (not overwritten)
    const row = await pg.query(
      `SELECT revoked_reason FROM nex_session_registry WHERE session_id = $1`,
      [session_id],
    );
    expect(row.rows[0].revoked_reason).toBe("admin_revoke");
  });

  it("cookie valid but registry has no such session → { reset: false, reason: 'invalid_cookie_cleared' }", async () => {
    const now = Date.now();
    const bogus: NexSessionPayload = {
      account_id: testAccountId,
      session_id: "99999999-9999-4999-8999-999999999999",
      issued_at_ms: now,
      expires_at_ms: now + 60_000,
    };
    const adapter = makeFakeAdapter();
    adapter.seed("nex_session", signSessionToken(bogus, cryptoCfg));
    const result = await resetCoverContinuityWith({
      cookieAdapter: adapter.adapter,
      cookieCfg,
      cryptoCfg,
      now_ms: now + 1000,
    });
    expect(result).toEqual({ reset: false, reason: "invalid_cookie_cleared" });
    expect(adapter.clears).toHaveLength(1);
  });

  it("does not throw across any 'none' branch (integration guarantee)", async () => {
    // Just proves the promise resolves for every case above.
    const scenarios = [
      makeFakeAdapter(), // no cookie
      (() => {
        const a = makeFakeAdapter();
        a.seed("nex_session", "junk");
        return a;
      })(),
    ];
    for (const a of scenarios) {
      await expect(
        resetCoverContinuityWith({
          cookieAdapter: a.adapter,
          cookieCfg,
          cryptoCfg,
        }),
      ).resolves.toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Doctrinal isolation
// ---------------------------------------------------------------------------

describe("resetCoverContinuityWith · doctrinal isolation", () => {
  it("does NOT touch nex_account, peer tables, welcome outbox, or risk signal", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/reset-cover-continuity.ts",
      ),
      "utf-8",
    );
    // No .from("<table>") for tables outside session_registry
    expect(src).not.toMatch(/\.from\(["']nex_account["']\)/);
    expect(src).not.toMatch(/\.from\(["']nex_peer_conversation["']\)/);
    expect(src).not.toMatch(/\.from\(["']nex_peer_message["']\)/);
    expect(src).not.toMatch(/\.from\(["']nex_welcome_outbox["']\)/);
    expect(src).not.toMatch(/\.from\(["']nex_account_risk_signal["']\)/);
    // No imports of write-path services or risk service
    expect(src).not.toMatch(/from ["'].*first-message-orchestrator["']/);
    expect(src).not.toMatch(/from ["'].*provisional-account-service["']/);
    expect(src).not.toMatch(/from ["'].*risk-service["']/);
    expect(src).not.toMatch(/from ["'].*provisional-fingerprint["']/);
  });

  it("only touches nex_session_registry (via revokeSession) across a genuine reset", async () => {
    // Count rows in each table before, run reset, count after.
    const now = Date.now();
    const { adapter } = await seedValidSession(now);

    const before = {
      accounts: Number(
        (await pg.query(`SELECT count(*)::int AS n FROM nex_account`)).rows[0].n,
      ),
      convs: Number(
        (await pg.query(`SELECT count(*)::int AS n FROM nex_peer_conversation`))
          .rows[0].n,
      ),
      msgs: Number(
        (await pg.query(`SELECT count(*)::int AS n FROM nex_peer_message`))
          .rows[0].n,
      ),
      outbox: Number(
        (await pg.query(`SELECT count(*)::int AS n FROM nex_welcome_outbox`))
          .rows[0].n,
      ),
      risk: Number(
        (await pg.query(`SELECT count(*)::int AS n FROM nex_account_risk_signal`))
          .rows[0].n,
      ),
    };

    await resetCoverContinuityWith({
      cookieAdapter: adapter.adapter,
      cookieCfg,
      cryptoCfg,
      now_ms: now + 100,
    });

    const after = {
      accounts: Number(
        (await pg.query(`SELECT count(*)::int AS n FROM nex_account`)).rows[0].n,
      ),
      convs: Number(
        (await pg.query(`SELECT count(*)::int AS n FROM nex_peer_conversation`))
          .rows[0].n,
      ),
      msgs: Number(
        (await pg.query(`SELECT count(*)::int AS n FROM nex_peer_message`))
          .rows[0].n,
      ),
      outbox: Number(
        (await pg.query(`SELECT count(*)::int AS n FROM nex_welcome_outbox`))
          .rows[0].n,
      ),
      risk: Number(
        (await pg.query(`SELECT count(*)::int AS n FROM nex_account_risk_signal`))
          .rows[0].n,
      ),
    };

    expect(after).toEqual(before);
  });
});
