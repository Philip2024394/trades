// src/lib/nex-native/first-conversation/__tests__/risk-service.test.ts
//
// Bridge 99 · Stage 5c · risk-service tests.
//
// Two test surfaces:
//   1. assessRisk() · pure decisions across every sealed §8 threshold.
//   2. recordProvisionalFingerprint / clearProvisionalFingerprintOnClaim
//      · DB writes scoped exclusively to nex_account_risk_signal.
//      No writes anywhere else · verified by row-count deltas across
//      six tables.
//
// Structural boundaries: no identity-resolver imports, no exported
// function name suggests fingerprint→account lookup, no `.from()` call
// targets any table other than nex_account_risk_signal.

import "./_load-env"; // MUST be first

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import pkg from "pg";
const { Client } = pkg;

// Bridge 99 DB-integration suite · file-scoped timeout per founder direction
// 2026-09-30. The Supabase pooler occasionally spikes to 500ms+ per query,
// which busts vitest's 5s default when a test does 4-10 round-trips. This
// bumps only this file · other repo tests retain the default.
vi.setConfig({ testTimeout: 30_000 });

import {
  assessRisk,
  clearProvisionalFingerprintOnClaim,
  NEX_RISK_THRESHOLDS,
  recordProvisionalFingerprint,
  type NexRiskDecision,
} from "../risk-service";
import type { RiskInput } from "../risk-signals";
import { countProvisionalsWithFingerprintSince } from "../risk-signals";

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

// ---------------------------------------------------------------------------
// Live DB setup · dedicated test accounts, cleanup after every test
// ---------------------------------------------------------------------------

let pg: InstanceType<typeof Client>;
const createdAccountIds: string[] = [];

async function createTestAccount(): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 10);
  const r = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_bridge99_stage5c_test_${rand}`],
  );
  const id = r.rows[0].id as string;
  createdAccountIds.push(id);
  return id;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(
      `risk-service test refuses to run: DATABASE_URL does not reference project ${EXPECTED_PROJECT_REF}`,
    );
  }
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
});

afterAll(async () => {
  if (createdAccountIds.length > 0) {
    // Cascade removes any surviving nex_account_risk_signal rows.
    await pg.query(
      `DELETE FROM nex_account WHERE id = ANY($1::uuid[])`,
      [createdAccountIds],
    );
  }
  await pg.end();
});

beforeEach(async () => {
  if (createdAccountIds.length > 0) {
    await pg.query(
      `DELETE FROM nex_account_risk_signal WHERE account_id = ANY($1::uuid[])`,
      [createdAccountIds],
    );
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseInput(overrides: Partial<RiskInput> = {}): RiskInput {
  return {
    message_length: 20,
    session_state: "provisional-new",
    ip_reputation_score: 0,
    new_conversations_last_hour: 0,
    new_conversations_last_day: 0,
    same_message_hash_repeat_count: 0,
    owner_business_id: "00000000-0000-4000-8000-000000000000",
    owner_bisnis_tier: "gratis",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// assessRisk · sealed §8 threshold matrix
// ---------------------------------------------------------------------------

describe("assessRisk · pass path (baseline)", () => {
  it("returns { level: 'pass' } when no threshold trips", () => {
    expect(assessRisk(baseInput())).toEqual({ level: "pass" });
  });
});

describe("assessRisk · block · message_too_short", () => {
  it("message_length < MIN_MESSAGE_LENGTH → block message_too_short", () => {
    const r = assessRisk(baseInput({ message_length: 0 }));
    expect(r).toEqual({ level: "block", reason: "message_too_short" });
    const r2 = assessRisk(baseInput({ message_length: 2 }));
    expect(r2).toEqual({ level: "block", reason: "message_too_short" });
  });

  it("boundary · message_length === MIN_MESSAGE_LENGTH (3) does NOT block", () => {
    expect(
      assessRisk(baseInput({ message_length: NEX_RISK_THRESHOLDS.MIN_MESSAGE_LENGTH })),
    ).toEqual({ level: "pass" });
  });
});

describe("assessRisk · block · duplicate_message", () => {
  it("same_message_hash_repeat_count >= MAX → block duplicate_message", () => {
    const r = assessRisk(baseInput({ same_message_hash_repeat_count: 3 }));
    expect(r).toEqual({ level: "block", reason: "duplicate_message" });
    const r2 = assessRisk(baseInput({ same_message_hash_repeat_count: 100 }));
    expect(r2).toEqual({ level: "block", reason: "duplicate_message" });
  });

  it("boundary · same_message_hash_repeat_count === MAX - 1 does NOT block", () => {
    expect(
      assessRisk(
        baseInput({
          same_message_hash_repeat_count:
            NEX_RISK_THRESHOLDS.MAX_SAME_MESSAGE_HASH_REPEATS - 1,
        }),
      ),
    ).toEqual({ level: "pass" });
  });
});

describe("assessRisk · block · ip_reputation", () => {
  it("ip_reputation_score > IP_REP_BLOCK → block ip_reputation", () => {
    const r = assessRisk(baseInput({ ip_reputation_score: 0.96 }));
    expect(r).toEqual({ level: "block", reason: "ip_reputation" });
  });

  it("boundary · ip_reputation_score === IP_REP_BLOCK does NOT block (strictly greater)", () => {
    expect(
      assessRisk(baseInput({ ip_reputation_score: NEX_RISK_THRESHOLDS.IP_REP_BLOCK })),
    ).not.toMatchObject({ level: "block", reason: "ip_reputation" });
  });
});

describe("assessRisk · challenge · phone_otp (heavy hourly velocity, any session)", () => {
  it("new_conversations_last_hour > ANY_HOURLY_CHALLENGE (any session) → phone_otp", () => {
    const r1 = assessRisk(
      baseInput({
        new_conversations_last_hour: 16,
        session_state: "provisional-new",
      }),
    );
    expect(r1).toEqual({ level: "challenge", challenge_kind: "phone_otp" });

    const r2 = assessRisk(
      baseInput({
        new_conversations_last_hour: 20,
        session_state: "authenticated",
      }),
    );
    expect(r2).toEqual({ level: "challenge", challenge_kind: "phone_otp" });

    const r3 = assessRisk(
      baseInput({
        new_conversations_last_hour: 100,
        session_state: "provisional-existing",
      }),
    );
    expect(r3).toEqual({ level: "challenge", challenge_kind: "phone_otp" });
  });

  it("boundary · ANY_HOURLY_CHALLENGE (15) exactly does NOT trigger phone_otp (strictly greater)", () => {
    const r = assessRisk(
      baseInput({
        new_conversations_last_hour: NEX_RISK_THRESHOLDS.ANY_HOURLY_CHALLENGE,
        session_state: "authenticated",
      }),
    );
    expect(r).toEqual({ level: "pass" });
  });
});

describe("assessRisk · challenge · turnstile · provisional-new hourly velocity", () => {
  it("new_conversations_last_hour > PROV_NEW_HOURLY_CHALLENGE AND session_state = provisional-new → turnstile", () => {
    const r = assessRisk(
      baseInput({
        new_conversations_last_hour: 6,
        session_state: "provisional-new",
      }),
    );
    expect(r).toEqual({ level: "challenge", challenge_kind: "turnstile" });
  });

  it("same velocity but session_state = authenticated → pass (session_state discriminates)", () => {
    const r = assessRisk(
      baseInput({
        new_conversations_last_hour: 6,
        session_state: "authenticated",
      }),
    );
    expect(r).toEqual({ level: "pass" });
  });

  it("same velocity but session_state = provisional-existing → pass", () => {
    const r = assessRisk(
      baseInput({
        new_conversations_last_hour: 6,
        session_state: "provisional-existing",
      }),
    );
    expect(r).toEqual({ level: "pass" });
  });

  it("boundary · PROV_NEW_HOURLY_CHALLENGE (5) exactly does NOT trigger turnstile", () => {
    const r = assessRisk(
      baseInput({
        new_conversations_last_hour: NEX_RISK_THRESHOLDS.PROV_NEW_HOURLY_CHALLENGE,
        session_state: "provisional-new",
      }),
    );
    expect(r).toEqual({ level: "pass" });
  });
});

describe("assessRisk · challenge · turnstile · ip reputation", () => {
  it("ip_reputation_score > IP_REP_CHALLENGE AND <= IP_REP_BLOCK → turnstile", () => {
    const r = assessRisk(baseInput({ ip_reputation_score: 0.75 }));
    expect(r).toEqual({ level: "challenge", challenge_kind: "turnstile" });
  });

  it("boundary · IP_REP_CHALLENGE (0.7) exactly does NOT trigger challenge (strictly greater)", () => {
    expect(
      assessRisk(baseInput({ ip_reputation_score: NEX_RISK_THRESHOLDS.IP_REP_CHALLENGE })),
    ).toEqual({ level: "pass" });
  });
});

describe("assessRisk · priority · blocks over challenges, phone_otp over turnstile", () => {
  it("message_too_short + heavy hourly velocity → block wins", () => {
    const r = assessRisk(
      baseInput({
        message_length: 0,
        new_conversations_last_hour: 100,
        session_state: "provisional-new",
      }),
    );
    expect(r).toEqual({ level: "block", reason: "message_too_short" });
  });

  it("duplicate_message + ip_reputation challenge → block wins", () => {
    const r = assessRisk(
      baseInput({
        same_message_hash_repeat_count: 3,
        ip_reputation_score: 0.8,
      }),
    );
    expect(r).toEqual({ level: "block", reason: "duplicate_message" });
  });

  it("ip_reputation block wins over any challenge trigger", () => {
    const r = assessRisk(
      baseInput({
        ip_reputation_score: 0.99,
        new_conversations_last_hour: 100,
      }),
    );
    expect(r).toEqual({ level: "block", reason: "ip_reputation" });
  });

  it("phone_otp (heavy hourly) wins over turnstile (moderate hourly + provisional-new)", () => {
    const r = assessRisk(
      baseInput({
        new_conversations_last_hour: 20,
        session_state: "provisional-new",
      }),
    );
    expect(r).toEqual({ level: "challenge", challenge_kind: "phone_otp" });
  });

  it("phone_otp wins over ip-rep turnstile when both trigger", () => {
    const r = assessRisk(
      baseInput({
        new_conversations_last_hour: 20,
        ip_reputation_score: 0.8,
      }),
    );
    expect(r).toEqual({ level: "challenge", challenge_kind: "phone_otp" });
  });
});

describe("assessRisk · determinism", () => {
  it("same input produces same output across many invocations", () => {
    const input = baseInput({
      message_length: 42,
      ip_reputation_score: 0.5,
      new_conversations_last_hour: 3,
    });
    const first = assessRisk(input);
    for (let i = 0; i < 100; i++) {
      expect(assessRisk(input)).toEqual(first);
    }
  });

  it("input object is not mutated", () => {
    const input = baseInput();
    const snapshot = JSON.stringify(input);
    assessRisk(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

// ---------------------------------------------------------------------------
// recordProvisionalFingerprint · DB write · scoped to risk-signal table
// ---------------------------------------------------------------------------

describe("recordProvisionalFingerprint · writes only to nex_account_risk_signal", () => {
  it("inserts a row with the supplied account_id + fingerprint", async () => {
    const account_id = await createTestAccount();
    const now = Date.now();
    await recordProvisionalFingerprint(account_id, "_test_fp_A", now);

    const r = await pg.query(
      `SELECT account_id, provisional_fingerprint,
              EXTRACT(EPOCH FROM fingerprint_last_computed_at)*1000 AS computed_ms,
              EXTRACT(EPOCH FROM updated_at)*1000 AS updated_ms
         FROM nex_account_risk_signal
        WHERE account_id = $1`,
      [account_id],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].account_id).toBe(account_id);
    expect(r.rows[0].provisional_fingerprint).toBe("_test_fp_A");
    expect(Number(r.rows[0].computed_ms)).toBe(now);
    expect(Number(r.rows[0].updated_ms)).toBe(now);
  });

  it("upserts · a second call updates the same row (no duplicate)", async () => {
    const account_id = await createTestAccount();
    await recordProvisionalFingerprint(account_id, "_test_fp_first", 1000);
    await recordProvisionalFingerprint(account_id, "_test_fp_second", 2000);

    const r = await pg.query(
      `SELECT provisional_fingerprint,
              EXTRACT(EPOCH FROM updated_at)*1000 AS updated_ms
         FROM nex_account_risk_signal WHERE account_id = $1`,
      [account_id],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].provisional_fingerprint).toBe("_test_fp_second");
    expect(Number(r.rows[0].updated_ms)).toBe(2000);
  });

  it("the recorded fingerprint is countable via risk-signals.countProvisionalsWithFingerprintSince", async () => {
    const a1 = await createTestAccount();
    const a2 = await createTestAccount();
    const fp = `_test_fp_countable_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    await recordProvisionalFingerprint(a1, fp, now);
    await recordProvisionalFingerprint(a2, fp, now);
    const n = await countProvisionalsWithFingerprintSince(fp, now - 60_000);
    expect(n).toBe(2);
  });

  it("throws on empty account_id", async () => {
    await expect(recordProvisionalFingerprint("", "fp")).rejects.toThrow(
      /account_id/,
    );
  });

  it("throws on empty fingerprint", async () => {
    const id = await createTestAccount();
    await expect(recordProvisionalFingerprint(id, "")).rejects.toThrow(
      /fingerprint/,
    );
  });

  it("does NOT create rows in any other table (scoped to this suite's accounts)", async () => {
    // Scope counts to THIS test's account so parallel test files
    // creating rows for their own accounts don't pollute the assertion.
    const account_id = await createTestAccount();
    async function scopedCounts() {
      // Sequential queries · pg.Client is single-threaded (see risk-signals
      // test note). Serialise to avoid the deprecation warning.
      const convs = await pg.query(
        `SELECT count(*)::int AS n FROM nex_peer_conversation
          WHERE participant_a_id = $1 OR participant_b_id = $1`,
        [account_id],
      );
      const msgs = await pg.query(
        `SELECT count(*)::int AS n FROM nex_peer_message WHERE sender_account_id = $1`,
        [account_id],
      );
      const sessions = await pg.query(
        `SELECT count(*)::int AS n FROM nex_session_registry WHERE account_id = $1`,
        [account_id],
      );
      const outbox = await pg.query(
        `SELECT count(*)::int AS n FROM nex_welcome_outbox WHERE account_id = $1`,
        [account_id],
      );
      return {
        convs: Number(convs.rows[0].n),
        msgs: Number(msgs.rows[0].n),
        sessions: Number(sessions.rows[0].n),
        outbox: Number(outbox.rows[0].n),
      };
    }
    const before = await scopedCounts();
    await recordProvisionalFingerprint(account_id, "_test_fp_other_tables", Date.now());
    const after = await scopedCounts();
    expect(after).toEqual(before);
  });

  it("does NOT modify the nex_account row (proves it uses caller's id, doesn't resolve)", async () => {
    const account_id = await createTestAccount();
    const before = await pg.query(
      `SELECT display_name, created_at FROM nex_account WHERE id = $1`,
      [account_id],
    );
    await recordProvisionalFingerprint(account_id, "_test_fp_no_account_mod", Date.now());
    const after = await pg.query(
      `SELECT display_name, created_at FROM nex_account WHERE id = $1`,
      [account_id],
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});

// ---------------------------------------------------------------------------
// clearProvisionalFingerprintOnClaim
// ---------------------------------------------------------------------------

describe("clearProvisionalFingerprintOnClaim · sealed §7A · cleared on claim", () => {
  it("nulls out provisional_fingerprint + fingerprint_last_computed_at", async () => {
    const account_id = await createTestAccount();
    await recordProvisionalFingerprint(account_id, "_test_fp_will_clear", 1000);
    await clearProvisionalFingerprintOnClaim(account_id, 2000);
    const r = await pg.query(
      `SELECT provisional_fingerprint, fingerprint_last_computed_at,
              EXTRACT(EPOCH FROM updated_at)*1000 AS updated_ms
         FROM nex_account_risk_signal WHERE account_id = $1`,
      [account_id],
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].provisional_fingerprint).toBeNull();
    expect(r.rows[0].fingerprint_last_computed_at).toBeNull();
    expect(Number(r.rows[0].updated_ms)).toBe(2000);
  });

  it("is idempotent · second call is a no-op (does not throw)", async () => {
    const account_id = await createTestAccount();
    await recordProvisionalFingerprint(account_id, "_test_fp_idempo", 1000);
    await clearProvisionalFingerprintOnClaim(account_id, 2000);
    await expect(
      clearProvisionalFingerprintOnClaim(account_id, 3000),
    ).resolves.toBeUndefined();
    // Fingerprint still null
    const r = await pg.query(
      `SELECT provisional_fingerprint FROM nex_account_risk_signal WHERE account_id = $1`,
      [account_id],
    );
    expect(r.rows[0].provisional_fingerprint).toBeNull();
  });

  it("safely no-ops on unknown account_id (no row exists)", async () => {
    // Any UUID that doesn't correspond to a real account · this proves
    // the function doesn't create rows and doesn't error on missing.
    await expect(
      clearProvisionalFingerprintOnClaim("99999999-9999-4999-8999-999999999999"),
    ).resolves.toBeUndefined();
  });

  it("throws on empty account_id", async () => {
    await expect(clearProvisionalFingerprintOnClaim("")).rejects.toThrow(
      /account_id/,
    );
  });

  it("clears ONLY the supplied account's risk row · leaves other accounts' fingerprints intact", async () => {
    // Founder-required check · proves clear does not accidentally do a
    // fingerprint-wide sweep or affect any other account.
    const aTarget = await createTestAccount();
    const aOther = await createTestAccount();
    const now = Date.now();
    // Deliberately give both accounts the SAME fingerprint (as a synthetic
    // shared-NAT scenario would). Clear for aTarget MUST NOT touch aOther.
    await recordProvisionalFingerprint(aTarget, "_test_fp_shared", now);
    await recordProvisionalFingerprint(aOther, "_test_fp_shared", now);

    await clearProvisionalFingerprintOnClaim(aTarget, now + 100);

    const r = await pg.query(
      `SELECT account_id, provisional_fingerprint
         FROM nex_account_risk_signal
        WHERE account_id = ANY($1::uuid[])
        ORDER BY account_id`,
      [[aTarget, aOther]],
    );
    const rows = r.rows as Array<{ account_id: string; provisional_fingerprint: string | null }>;
    const target = rows.find((x) => x.account_id === aTarget);
    const other = rows.find((x) => x.account_id === aOther);
    expect(target?.provisional_fingerprint).toBeNull();
    expect(other?.provisional_fingerprint).toBe("_test_fp_shared");
  });
});

// ---------------------------------------------------------------------------
// No writes outside nex_account_risk_signal (comprehensive count delta)
// ---------------------------------------------------------------------------

describe("risk-service · writes ONLY to nex_account_risk_signal (comprehensive)", () => {
  it("all other tables scoped to this account unchanged across record + clear", async () => {
    // Scope counts to THIS test's account so parallel test files don't
    // pollute the assertion. Immune to concurrent activity on the pooler.
    const account_id = await createTestAccount();
    async function scopedCounts() {
      // Sequential queries per pg.Client single-thread contract.
      const nex_account_row = await pg.query(
        `SELECT count(*)::int AS n FROM nex_account WHERE id = $1`,
        [account_id],
      );
      const convs = await pg.query(
        `SELECT count(*)::int AS n FROM nex_peer_conversation
          WHERE participant_a_id = $1 OR participant_b_id = $1`,
        [account_id],
      );
      const msgs = await pg.query(
        `SELECT count(*)::int AS n FROM nex_peer_message WHERE sender_account_id = $1`,
        [account_id],
      );
      const sessions = await pg.query(
        `SELECT count(*)::int AS n FROM nex_session_registry WHERE account_id = $1`,
        [account_id],
      );
      const outbox = await pg.query(
        `SELECT count(*)::int AS n FROM nex_welcome_outbox WHERE account_id = $1`,
        [account_id],
      );
      return {
        nex_account: Number(nex_account_row.rows[0].n),
        convs: Number(convs.rows[0].n),
        msgs: Number(msgs.rows[0].n),
        sessions: Number(sessions.rows[0].n),
        outbox: Number(outbox.rows[0].n),
      };
    }
    const before = await scopedCounts();
    await recordProvisionalFingerprint(account_id, "_test_fp_final", Date.now());
    await clearProvisionalFingerprintOnClaim(account_id, Date.now());
    const after = await scopedCounts();
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Structural doctrinal isolation
// ---------------------------------------------------------------------------

describe("doctrinal isolation · risk-service module", () => {
  it("does NOT import identity or write-path modules", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/risk-service.ts",
      ),
      "utf-8",
    );
    expect(src).not.toMatch(/from ["'].*account-service["']/);
    expect(src).not.toMatch(/from ["'].*session-registry-service["']/);
    expect(src).not.toMatch(/from ["'].*provisional-session["']/);
    expect(src).not.toMatch(/from ["'].*first-message-orchestrator["']/);
    expect(src).not.toMatch(/from ["'].*provisional-account-service["']/);
    expect(src).not.toMatch(/from ["'].*peer-conversation-service["']/);
    expect(src).not.toMatch(/from ["'].*peer-message-service["']/);
  });

  it("every .from(...) call targets nex_account_risk_signal exclusively", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/risk-service.ts",
      ),
      "utf-8",
    );
    const fromCalls = Array.from(src.matchAll(/\.from\(["']([a-z_]+)["']\)/g)).map(
      (m) => m[1],
    );
    expect(fromCalls.length).toBeGreaterThan(0);
    for (const target of fromCalls) {
      expect(target).toBe("nex_account_risk_signal");
    }
  });

  it("no exported function name suggests fingerprint → account lookup", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/risk-service.ts",
      ),
      "utf-8",
    );
    expect(src).not.toMatch(
      /export\s+(async\s+)?function\s+\w*(?:getAccount|findAccount|resolveAccount|lookupAccount|accountFor|accountBy|accountFromFingerprint)\w*/i,
    );
  });

  it("assessRisk performs no I/O (structural: no await inside function body)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/risk-service.ts",
      ),
      "utf-8",
    );
    // Extract the assessRisk function body
    const match = src.match(
      /export function assessRisk\([\s\S]*?\): NexRiskDecision \{([\s\S]*?)\n\}/,
    );
    expect(match).not.toBeNull();
    const body = match![1];
    expect(body).not.toMatch(/\bawait\b/);
    expect(body).not.toMatch(/\bfetch\(/);
    expect(body).not.toMatch(/nexSupabaseAdmin/);
  });
});

// ---------------------------------------------------------------------------
// Fingerprint is never returned as identity (belt-and-braces)
// ---------------------------------------------------------------------------

describe("assessRisk decision types · no account_id leakage", () => {
  it("NexRiskDecision shape can NEVER contain an account_id", () => {
    // Cast a wide variety of decisions through the type and verify
    // none surface an account_id-shaped field.
    const decisions: NexRiskDecision[] = [
      { level: "pass" },
      { level: "challenge", challenge_kind: "turnstile" },
      { level: "challenge", challenge_kind: "phone_otp" },
      { level: "challenge", challenge_kind: "face" },
      { level: "block", reason: "message_too_short" },
      { level: "block", reason: "duplicate_message" },
      { level: "block", reason: "ip_reputation" },
    ];
    for (const d of decisions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((d as any).account_id).toBeUndefined();
    }
  });
});
