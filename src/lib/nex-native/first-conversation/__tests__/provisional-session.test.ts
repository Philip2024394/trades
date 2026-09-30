// src/lib/nex-native/first-conversation/__tests__/provisional-session.test.ts
//
// Bridge 99 · Stage 4d · resolver tests.
// Uses the deterministic core (resolveNexAppOrProvisionalSessionWith) with:
//   · an in-memory NexCookieAdapter fake (from Stage 4c pattern)
//   · a real crypto config (Stage 4a keys)
//   · the LIVE session registry service against ijvqdvsvwtwxzcqmoqit (Stage 4b)
//   · a fake Supabase session object (constructed inline)
//   · raw pg for setup/teardown/cleanup + assertions on side effects
//
// Explicitly verifies:
//   · Priority 1: Supabase session wins over any cookie state.
//   · Priority 2: nex_session cookie backed by a valid registry row and
//     real nex_account row → { kind: 'provisional' }.
//   · Every skip branch returns { kind: 'none', reason: ... } with the
//     correct mapped reason.
//   · Resolver creates ZERO nex_account rows and ZERO nex_session_registry
//     rows during any resolution (proved by pg count deltas).

import "./_load-env"; // MUST be first

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pkg from "pg";
const { Client } = pkg;

import {
  resolveNexAppOrProvisionalSessionWith,
  type NexResolvedSession,
} from "../provisional-session";
import {
  writeNexSessionCookie,
  type NexCookieAdapter,
  type NexCookieWriteOptions,
} from "../session-cookie";
import { createSession, revokeSession } from "../session-registry-service";
import {
  signSessionToken,
  type NexSessionCryptoConfig,
  type NexSessionPayload,
} from "../session-crypto";
import type { NexAppSession } from "../../app/session";

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

const KEY_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const KEY_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const cryptoCfg: NexSessionCryptoConfig = {
  activeKey: KEY_A,
  acceptedKeys: [KEY_A],
};

// ---------------------------------------------------------------------------
// In-memory cookie adapter fake (same pattern as Stage 4c)
// ---------------------------------------------------------------------------

function makeFakeAdapter(): {
  adapter: NexCookieAdapter;
  seed(name: string, value: string): void;
} {
  const jar = new Map<string, string>();
  return {
    adapter: {
      read: (n) => jar.get(n),
      write: (n, v, _o: NexCookieWriteOptions) => jar.set(n, v),
      clear: (n) => jar.delete(n),
    },
    seed: (n, v) => jar.set(n, v),
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
      `provisional-session test refuses to run: DATABASE_URL does not reference project ${EXPECTED_PROJECT_REF}`,
    );
  }
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const rand = Math.random().toString(36).slice(2, 10);
  const r = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_bridge99_stage4d_test_${rand}`],
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

function makeFakeSupabaseSession(): NexAppSession {
  return {
    supabaseUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "test@example.com",
    account: {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      display_name: "Test Supabase Account",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

/** Set up a valid nex_session cookie backed by a real registry row. */
async function seedValidProvisionalSession(now_ms: number = Date.now()): Promise<{
  adapter: NexCookieAdapter;
  session_id: string;
}> {
  const { adapter } = makeFakeAdapter();
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
  writeNexSessionCookie(
    adapter,
    payload,
    cryptoCfg,
    { secure: true, path: "/" },
    now_ms,
  );
  return { adapter, session_id: created.session_id };
}

async function countAccountRows(): Promise<number> {
  const r = await pg.query(
    `SELECT count(*)::int AS n FROM nex_account WHERE display_name LIKE $1`,
    ["_bridge99_stage4d_test_%"],
  );
  return r.rows[0].n as number;
}

async function countSessionRowsForAccount(accountId: string): Promise<number> {
  const r = await pg.query(
    `SELECT count(*)::int AS n FROM nex_session_registry WHERE account_id = $1`,
    [accountId],
  );
  return r.rows[0].n as number;
}

// ---------------------------------------------------------------------------
// Priority 1 · Supabase auth wins
// ---------------------------------------------------------------------------

describe("resolver · priority 1 · Supabase session wins", () => {
  it("returns 'authenticated' when Supabase session is present · no cookie", async () => {
    const { adapter } = makeFakeAdapter();
    const supa = makeFakeSupabaseSession();
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: supa,
    });
    expect(r.kind).toBe("authenticated");
    if (r.kind === "authenticated") expect(r.supabase).toBe(supa);
  });

  it("returns 'authenticated' even when a valid nex_session cookie is ALSO present", async () => {
    // Seed a valid provisional cookie, THEN pass a Supabase session.
    const { adapter } = await seedValidProvisionalSession();
    const supa = makeFakeSupabaseSession();
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: supa,
    });
    expect(r.kind).toBe("authenticated");
    if (r.kind === "authenticated") expect(r.supabase).toBe(supa);
  });

  it("returns 'authenticated' even when the nex_session cookie is malformed / revoked / expired", async () => {
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", "garbage.value");
    const supa = makeFakeSupabaseSession();
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: supa,
    });
    expect(r.kind).toBe("authenticated");
  });
});

// ---------------------------------------------------------------------------
// Priority 2 · valid nex_session
// ---------------------------------------------------------------------------

describe("resolver · priority 2 · valid nex_session cookie", () => {
  it("returns 'provisional' with account + session_row for a fresh valid session", async () => {
    const now = Date.now();
    const { adapter, session_id } = await seedValidProvisionalSession(now);
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: null,
      now_ms: now + 1000,
    });
    expect(r.kind).toBe("provisional");
    if (r.kind === "provisional") {
      expect(r.account.id).toBe(testAccountId);
      expect(r.session_row.session_id).toBe(session_id);
      expect(r.session_row.revoked_at_ms).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Priority 3 · 'none' with correct reason mapping
// ---------------------------------------------------------------------------

describe("resolver · 'none' branches · cookie-side failures", () => {
  it("cookie_missing when no cookie is set", async () => {
    const { adapter } = makeFakeAdapter();
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: null,
    });
    expect(r).toEqual({ kind: "none", reason: "cookie_missing" });
  });

  it("cookie_malformed when cookie value is garbage", async () => {
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", "not-a-token");
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: null,
    });
    expect(r).toEqual({ kind: "none", reason: "cookie_malformed" });
  });

  it("cookie_bad_signature when cookie was signed with an unknown key", async () => {
    const otherCfg: NexSessionCryptoConfig = {
      activeKey: KEY_B,
      acceptedKeys: [KEY_B],
    };
    // Seed a session and cookie signed with KEY_B (not in our verify cryptoCfg)
    const now = Date.now();
    const created = await createSession({
      account_id: testAccountId,
      now_ms: now,
    });
    const badToken = signSessionToken(
      {
        account_id: created.account_id,
        session_id: created.session_id,
        issued_at_ms: created.issued_at_ms,
        expires_at_ms: created.expires_at_ms,
      },
      otherCfg,
    );
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", badToken);
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: null,
      now_ms: now + 1000,
    });
    expect(r).toEqual({ kind: "none", reason: "cookie_bad_signature" });
  });

  it("cookie_expired when now >= payload.expires_at_ms", async () => {
    const now = 1_000_000;
    const created = await createSession({
      account_id: testAccountId,
      now_ms: now,
    });
    const shortCookiePayload: NexSessionPayload = {
      account_id: created.account_id,
      session_id: created.session_id,
      issued_at_ms: now,
      expires_at_ms: now + 60_000,
    };
    const token = signSessionToken(shortCookiePayload, cryptoCfg);
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", token);
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: null,
      now_ms: now + 120_000,
    });
    expect(r).toEqual({ kind: "none", reason: "cookie_expired" });
  });
});

describe("resolver · 'none' branches · registry-side failures", () => {
  it("session_not_found when cookie payload references an unknown session_id", async () => {
    const now = Date.now();
    const bogusPayload: NexSessionPayload = {
      account_id: testAccountId,
      session_id: "99999999-9999-4999-8999-999999999999",
      issued_at_ms: now,
      expires_at_ms: now + 60_000,
    };
    const token = signSessionToken(bogusPayload, cryptoCfg);
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", token);
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: null,
      now_ms: now + 1000,
    });
    expect(r).toEqual({ kind: "none", reason: "session_not_found" });
  });

  it("session_revoked when registry row has revoked_at set", async () => {
    const now = Date.now();
    const { adapter, session_id } = await seedValidProvisionalSession(now);
    await revokeSession(session_id, "user_reset_cover_continuity", now + 100);
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: null,
      now_ms: now + 1000,
    });
    expect(r).toEqual({ kind: "none", reason: "session_revoked" });
  });

  it("session_expired when registry expires_at has passed even if cookie payload appears fresh", async () => {
    // Craft a cookie payload with a fresh expires_at_ms, but the DB row's
    // expires_at is in the past. Proves the resolver uses the DB as source
    // of truth, not the cookie's optimistic payload.
    const now = Date.now();
    const created = await createSession({
      account_id: testAccountId,
      now_ms: now,
    });
    // Manually shrink the DB expires_at to just after "now" so it expires
    // before our resolver's simulated now_ms.
    await pg.query(
      `UPDATE nex_session_registry
          SET expires_at = to_timestamp($1 / 1000.0)
        WHERE session_id = $2`,
      [now + 100, created.session_id],
    );
    // Sign a cookie that CLAIMS a far-future expiry.
    const payload: NexSessionPayload = {
      account_id: created.account_id,
      session_id: created.session_id,
      issued_at_ms: created.issued_at_ms,
      expires_at_ms: created.expires_at_ms, // 30d out
    };
    const token = signSessionToken(payload, cryptoCfg);
    const { adapter, seed } = makeFakeAdapter();
    seed("nex_session", token);
    const r = await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapter,
      cryptoCfg,
      supabaseSession: null,
      now_ms: now + 5000, // past DB expiry, before cookie expiry
    });
    expect(r).toEqual({ kind: "none", reason: "session_expired" });
  });
});

// ---------------------------------------------------------------------------
// No writes discipline
// ---------------------------------------------------------------------------

describe("resolver · never writes to nex_account or nex_session_registry", () => {
  it("does NOT create any nex_account rows across every branch", async () => {
    const before = await countAccountRows();

    // Exercise every branch
    const cases: Array<() => Promise<NexResolvedSession>> = [
      // Priority 1 · authenticated
      () =>
        resolveNexAppOrProvisionalSessionWith({
          cookieAdapter: makeFakeAdapter().adapter,
          cryptoCfg,
          supabaseSession: makeFakeSupabaseSession(),
        }),
      // Priority 2 · provisional
      async () => {
        const { adapter } = await seedValidProvisionalSession();
        return resolveNexAppOrProvisionalSessionWith({
          cookieAdapter: adapter,
          cryptoCfg,
          supabaseSession: null,
        });
      },
      // cookie_missing
      () =>
        resolveNexAppOrProvisionalSessionWith({
          cookieAdapter: makeFakeAdapter().adapter,
          cryptoCfg,
          supabaseSession: null,
        }),
      // cookie_malformed
      () => {
        const { adapter, seed } = makeFakeAdapter();
        seed("nex_session", "not-a-token");
        return resolveNexAppOrProvisionalSessionWith({
          cookieAdapter: adapter,
          cryptoCfg,
          supabaseSession: null,
        });
      },
      // session_not_found
      () => {
        const bogus = signSessionToken(
          {
            account_id: testAccountId,
            session_id: "88888888-8888-4888-8888-888888888888",
            issued_at_ms: Date.now(),
            expires_at_ms: Date.now() + 60_000,
          },
          cryptoCfg,
        );
        const { adapter, seed } = makeFakeAdapter();
        seed("nex_session", bogus);
        return resolveNexAppOrProvisionalSessionWith({
          cookieAdapter: adapter,
          cryptoCfg,
          supabaseSession: null,
        });
      },
    ];

    for (const c of cases) {
      await c();
    }

    const after = await countAccountRows();
    // Only test accounts created before the test (test setup) + the ones
    // seededValidProvisionalSession uses (the shared testAccountId).
    // seed does not create new nex_account rows; createSession only writes
    // to nex_session_registry. So account count is unchanged.
    expect(after).toBe(before);
  });

  it("does NOT create session rows on any failure branch (cookie_missing, cookie_malformed, session_not_found, session_revoked)", async () => {
    // Setup: pre-existing session so we can revoke it
    const now = Date.now();
    const { adapter: adapterA, session_id } = await seedValidProvisionalSession(now);
    await revokeSession(session_id, "admin_revoke", now + 100);

    const before = await countSessionRowsForAccount(testAccountId);

    // cookie_missing
    await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: makeFakeAdapter().adapter,
      cryptoCfg,
      supabaseSession: null,
      now_ms: now + 200,
    });
    // cookie_malformed
    {
      const { adapter, seed } = makeFakeAdapter();
      seed("nex_session", "junk");
      await resolveNexAppOrProvisionalSessionWith({
        cookieAdapter: adapter,
        cryptoCfg,
        supabaseSession: null,
        now_ms: now + 200,
      });
    }
    // session_not_found
    {
      const bogus = signSessionToken(
        {
          account_id: testAccountId,
          session_id: "77777777-7777-4777-8777-777777777777",
          issued_at_ms: now,
          expires_at_ms: now + 60_000,
        },
        cryptoCfg,
      );
      const { adapter, seed } = makeFakeAdapter();
      seed("nex_session", bogus);
      await resolveNexAppOrProvisionalSessionWith({
        cookieAdapter: adapter,
        cryptoCfg,
        supabaseSession: null,
        now_ms: now + 200,
      });
    }
    // session_revoked (using adapterA which holds the revoked-session cookie)
    await resolveNexAppOrProvisionalSessionWith({
      cookieAdapter: adapterA,
      cryptoCfg,
      supabaseSession: null,
      now_ms: now + 200,
    });

    const after = await countSessionRowsForAccount(testAccountId);
    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Structural · fingerprint / risk-service NEVER imported
// ---------------------------------------------------------------------------

describe("resolver · doctrinal isolation", () => {
  it("does NOT import risk-service (structural check)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/provisional-session.ts",
      ),
      "utf-8",
    );
    expect(src).not.toMatch(/from ["'].*risk-service["']/);
    expect(src).not.toMatch(/from ["'].*provisional-fingerprint["']/);
    expect(src).not.toMatch(/nex_account_risk_signal/);
  });

  it("does NOT import first-message-orchestrator or provisional-account-service (no writes)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/provisional-session.ts",
      ),
      "utf-8",
    );
    // Structural isolation: verify no imports from the write-path
    // services. These would establish an account-creation ability the
    // resolver must not have.
    expect(src).not.toMatch(/from ["'].*first-message-orchestrator["']/);
    expect(src).not.toMatch(/from ["'].*provisional-account-service["']/);
    // Verify no Supabase table-write helpers reach the outbox / message /
    // conversation tables from this module. The check looks for actual
    // query-builder calls (.from("<table>")) rather than substring
    // presence, so docstring mentions of the table names are permitted.
    expect(src).not.toMatch(/\.from\(["']nex_welcome_outbox["']\)/);
    expect(src).not.toMatch(/\.from\(["']nex_peer_message["']\)/);
    expect(src).not.toMatch(/\.from\(["']nex_peer_conversation["']\)/);
    expect(src).not.toMatch(/\.from\(["']nex_account_risk_signal["']\)/);
  });
});
