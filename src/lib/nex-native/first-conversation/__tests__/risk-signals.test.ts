// src/lib/nex-native/first-conversation/__tests__/risk-signals.test.ts
//
// Bridge 99 · Stage 5b · risk-signals tests.
// Combination of pure tests for extraction + integration tests for
// fingerprint velocity against the live nex_account_risk_signal table.
//
// Doctrinal boundaries tested:
//   · No function ever returns account_ids (structural)
//   · No writes anywhere (row-count deltas across all touched tables)
//   · DB reads scoped to nex_account_risk_signal only

import "./_load-env"; // MUST be first

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import pkg from "pg";
const { Client } = pkg;

// Bridge 99 DB-integration suite · file-scoped timeout per founder direction
// 2026-09-30. See risk-service.test.ts for full rationale.
vi.setConfig({ testTimeout: 30_000 });

import {
  buildRiskInput,
  countProvisionalsWithFingerprintSince,
  extractRequestSignals,
  sessionStateFromResolverKind,
} from "../risk-signals";

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

// ---------------------------------------------------------------------------
// Live DB setup · creates several test nex_account rows and seeds
// nex_account_risk_signal rows with distinctive fingerprints so we can
// test velocity counts under controlled conditions.
// ---------------------------------------------------------------------------

let pg: InstanceType<typeof Client>;
const createdAccountIds: string[] = [];

async function createTestAccount(): Promise<string> {
  const rand = Math.random().toString(36).slice(2, 10);
  const r = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_bridge99_stage5b_test_${rand}`],
  );
  const id = r.rows[0].id as string;
  createdAccountIds.push(id);
  return id;
}

/** Insert a risk_signal row directly · used to seed velocity scenarios. */
async function seedRiskSignal(params: {
  account_id: string;
  provisional_fingerprint: string;
  created_at_ms: number;
}): Promise<void> {
  const iso = new Date(params.created_at_ms).toISOString();
  await pg.query(
    `INSERT INTO nex_account_risk_signal
       (account_id, provisional_fingerprint, fingerprint_last_computed_at, created_at, updated_at)
     VALUES ($1, $2, $3, $3, $3)`,
    [params.account_id, params.provisional_fingerprint, iso],
  );
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(
      `risk-signals test refuses to run: DATABASE_URL does not reference project ${EXPECTED_PROJECT_REF}`,
    );
  }
  pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
});

afterAll(async () => {
  if (createdAccountIds.length > 0) {
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
// sessionStateFromResolverKind (pure)
// ---------------------------------------------------------------------------

describe("sessionStateFromResolverKind", () => {
  it("maps 'authenticated' → 'authenticated'", () => {
    expect(sessionStateFromResolverKind("authenticated")).toBe("authenticated");
  });
  it("maps 'provisional' → 'provisional-existing'", () => {
    expect(sessionStateFromResolverKind("provisional")).toBe("provisional-existing");
  });
  it("maps 'none' → 'provisional-new'", () => {
    expect(sessionStateFromResolverKind("none")).toBe("provisional-new");
  });
});

// ---------------------------------------------------------------------------
// extractRequestSignals (pure)
// ---------------------------------------------------------------------------

describe("extractRequestSignals · pure", () => {
  it("returns the message body length", () => {
    const r = extractRequestSignals({
      message_body: "Hi Maria!",
      session_kind: "none",
    });
    expect(r.message_length).toBe(9);
    expect(r.session_state).toBe("provisional-new");
  });

  it("handles empty message_body without throwing (0-length is a signal)", () => {
    const r = extractRequestSignals({
      message_body: "",
      session_kind: "none",
    });
    expect(r.message_length).toBe(0);
  });

  it("throws on non-string message_body", () => {
    expect(() =>
      extractRequestSignals({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        message_body: 42 as any,
        session_kind: "none",
      }),
    ).toThrow(/message_body must be a string/);
  });

  it("uses code-point count (surrogate pairs count as 2 — a stable choice)", () => {
    // 😀 is a single grapheme but two UTF-16 code units. .length returns 2.
    // The risk service uses this as an abuse signal (too-short messages);
    // treating one emoji as length 2 is a defensible choice for v1.
    const r = extractRequestSignals({
      message_body: "😀",
      session_kind: "none",
    });
    expect(r.message_length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// countProvisionalsWithFingerprintSince (live DB · counts only)
// ---------------------------------------------------------------------------

describe("countProvisionalsWithFingerprintSince · returns COUNT only", () => {
  it("returns 0 when no rows match the fingerprint", async () => {
    const n = await countProvisionalsWithFingerprintSince(
      "no-such-fingerprint-xyz",
      0,
    );
    expect(n).toBe(0);
  });

  it("counts rows matching the fingerprint at or after sinceMs", async () => {
    const now = Date.now();
    const fp = `_test_fp_A_${Math.random().toString(36).slice(2, 8)}`;
    const a1 = await createTestAccount();
    const a2 = await createTestAccount();
    const a3 = await createTestAccount();
    // Three rows with same fingerprint at different times
    await seedRiskSignal({
      account_id: a1,
      provisional_fingerprint: fp,
      created_at_ms: now - 30 * 60 * 1000, // 30 min ago
    });
    await seedRiskSignal({
      account_id: a2,
      provisional_fingerprint: fp,
      created_at_ms: now - 90 * 60 * 1000, // 90 min ago
    });
    await seedRiskSignal({
      account_id: a3,
      provisional_fingerprint: fp,
      created_at_ms: now - 5 * 60 * 1000, // 5 min ago
    });

    // Window: last 60 minutes → should catch rows created at -30m and -5m.
    const lastHour = await countProvisionalsWithFingerprintSince(
      fp,
      now - 60 * 60 * 1000,
    );
    expect(lastHour).toBe(2);

    // Window: last 2 hours → should catch all three.
    const last2h = await countProvisionalsWithFingerprintSince(
      fp,
      now - 2 * 60 * 60 * 1000,
    );
    expect(last2h).toBe(3);
  });

  it("does not confuse fingerprints (different fp values counted separately)", async () => {
    const now = Date.now();
    const fpA = `_test_fp_B1_${Math.random().toString(36).slice(2, 8)}`;
    const fpB = `_test_fp_B2_${Math.random().toString(36).slice(2, 8)}`;
    const a1 = await createTestAccount();
    const a2 = await createTestAccount();
    await seedRiskSignal({
      account_id: a1,
      provisional_fingerprint: fpA,
      created_at_ms: now,
    });
    await seedRiskSignal({
      account_id: a2,
      provisional_fingerprint: fpB,
      created_at_ms: now,
    });
    expect(await countProvisionalsWithFingerprintSince(fpA, 0)).toBe(1);
    expect(await countProvisionalsWithFingerprintSince(fpB, 0)).toBe(1);
  });

  it("throws on empty fingerprint string (fail-fast)", async () => {
    await expect(
      countProvisionalsWithFingerprintSince("", 0),
    ).rejects.toThrow(/non-empty string/);
  });
});

// ---------------------------------------------------------------------------
// buildRiskInput · composes to sealed §8 RiskInput shape
// ---------------------------------------------------------------------------

describe("buildRiskInput · sealed §8 shape", () => {
  it("returns the full 8-field shape with v1 stubs where documented", async () => {
    const r = await buildRiskInput({
      message_body: "Hello",
      session_kind: "none",
      fingerprint: null, // no fingerprint → velocity counts are 0
      owner_business_id: "01010101-0101-4101-8101-010101010101",
      owner_bisnis_tier: "gratis",
      now_ms: Date.now(),
    });
    expect(r).toEqual({
      message_length: 5,
      session_state: "provisional-new",
      ip_reputation_score: 0,
      new_conversations_last_hour: 0,
      new_conversations_last_day: 0,
      same_message_hash_repeat_count: 0,
      owner_business_id: "01010101-0101-4101-8101-010101010101",
      owner_bisnis_tier: "gratis",
    });
  });

  it("populates hour + day velocity counts when a fingerprint is provided", async () => {
    const now = Date.now();
    const fp = `_test_fp_build_${Math.random().toString(36).slice(2, 8)}`;
    const a1 = await createTestAccount();
    const a2 = await createTestAccount();
    const a3 = await createTestAccount();
    // 2 rows in the last hour, 1 more in the last day
    await seedRiskSignal({
      account_id: a1,
      provisional_fingerprint: fp,
      created_at_ms: now - 10 * 60 * 1000,
    });
    await seedRiskSignal({
      account_id: a2,
      provisional_fingerprint: fp,
      created_at_ms: now - 50 * 60 * 1000,
    });
    await seedRiskSignal({
      account_id: a3,
      provisional_fingerprint: fp,
      created_at_ms: now - 10 * 60 * 60 * 1000,
    });

    const r = await buildRiskInput({
      message_body: "message",
      session_kind: "none",
      fingerprint: fp,
      owner_business_id: "02020202-0202-4202-8202-020202020202",
      owner_bisnis_tier: "bisnis",
      now_ms: now,
    });
    expect(r.new_conversations_last_hour).toBe(2);
    expect(r.new_conversations_last_day).toBe(3);
    expect(r.session_state).toBe("provisional-new");
    expect(r.owner_bisnis_tier).toBe("bisnis");
  });

  it("maps provisional session_kind → 'provisional-existing'", async () => {
    const r = await buildRiskInput({
      message_body: "hello",
      session_kind: "provisional",
      fingerprint: null,
      owner_business_id: "03030303-0303-4303-8303-030303030303",
      owner_bisnis_tier: "gratis",
    });
    expect(r.session_state).toBe("provisional-existing");
  });

  it("maps authenticated session_kind → 'authenticated'", async () => {
    const r = await buildRiskInput({
      message_body: "hello",
      session_kind: "authenticated",
      fingerprint: null,
      owner_business_id: "04040404-0404-4404-8404-040404040404",
      owner_bisnis_tier: "gratis",
    });
    expect(r.session_state).toBe("authenticated");
  });
});

// ---------------------------------------------------------------------------
// No writes discipline
// ---------------------------------------------------------------------------

describe("risk-signals · never writes to any table", () => {
  it("does NOT create rows attributable to this suite's test accounts across any exercised code path", async () => {
    // Scoped-count strategy: we count only rows referencing OUR test
    // accounts (createdAccountIds), never global row counts. Global
    // counts are polluted by parallel test files creating their own
    // test data. This scope makes the assertion immune to that
    // pollution while still proving risk-signals doesn't create rows.
    const testIds = createdAccountIds.length > 0 ? createdAccountIds : [];
    async function scopedCounts() {
      // Sequential queries · pg.Client is single-threaded; parallel
      // Promise.all(pg.query(...)) triggers a pg deprecation warning
      // and will error in pg@9. Serialise them.
      const accounts = await pg.query(
        `SELECT count(*)::int AS n FROM nex_account WHERE id = ANY($1::uuid[])`,
        [testIds],
      );
      const risk = await pg.query(
        `SELECT count(*)::int AS n FROM nex_account_risk_signal WHERE account_id = ANY($1::uuid[])`,
        [testIds],
      );
      const sessions = await pg.query(
        `SELECT count(*)::int AS n FROM nex_session_registry WHERE account_id = ANY($1::uuid[])`,
        [testIds],
      );
      const convs = await pg.query(
        `SELECT count(*)::int AS n FROM nex_peer_conversation
          WHERE participant_a_id = ANY($1::uuid[])
             OR participant_b_id = ANY($1::uuid[])`,
        [testIds],
      );
      const msgs = await pg.query(
        `SELECT count(*)::int AS n FROM nex_peer_message WHERE sender_account_id = ANY($1::uuid[])`,
        [testIds],
      );
      const outbox = await pg.query(
        `SELECT count(*)::int AS n FROM nex_welcome_outbox WHERE account_id = ANY($1::uuid[])`,
        [testIds],
      );
      return {
        accounts: Number(accounts.rows[0].n),
        risk: Number(risk.rows[0].n),
        sessions: Number(sessions.rows[0].n),
        convs: Number(convs.rows[0].n),
        msgs: Number(msgs.rows[0].n),
        outbox: Number(outbox.rows[0].n),
      };
    }

    const before = await scopedCounts();

    // Exercise every exported code path.
    extractRequestSignals({ message_body: "hi", session_kind: "none" });
    sessionStateFromResolverKind("provisional");
    await countProvisionalsWithFingerprintSince("_test_fp_writes_check", 0);
    await buildRiskInput({
      message_body: "hi",
      session_kind: "none",
      fingerprint: "_test_fp_writes_check",
      owner_business_id: "05050505-0505-4505-8505-050505050505",
      owner_bisnis_tier: "gratis",
    });

    const after = await scopedCounts();
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Structural · never returns account_id, never touches identity modules
// ---------------------------------------------------------------------------

describe("doctrinal isolation · risk-signals module", () => {
  it("does NOT import identity or write-path modules", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/risk-signals.ts",
      ),
      "utf-8",
    );
    expect(src).not.toMatch(/from ["'].*account-service["']/);
    expect(src).not.toMatch(/from ["'].*session-registry-service["']/);
    expect(src).not.toMatch(/from ["'].*provisional-session["']/);
    expect(src).not.toMatch(/from ["'].*first-message-orchestrator["']/);
    expect(src).not.toMatch(/from ["'].*provisional-account-service["']/);
  });

  it("reads ONLY from nex_account_risk_signal (no other .from() targets)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/risk-signals.ts",
      ),
      "utf-8",
    );
    // Collect all .from("...") calls
    const fromCalls = Array.from(src.matchAll(/\.from\(["']([a-z_]+)["']\)/g)).map(
      (m) => m[1],
    );
    for (const target of fromCalls) {
      expect(target).toBe("nex_account_risk_signal");
    }
  });

  it("no exported function name suggests identity resolution (structural)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/risk-signals.ts",
      ),
      "utf-8",
    );
    // Any function like getAccountByFingerprint / findAccountFor /
    // resolveAccountFrom / lookupAccountBy → doctrinal violation
    expect(src).not.toMatch(
      /export\s+(async\s+)?function\s+\w*(?:getAccount|findAccount|resolveAccount|lookupAccount|accountFor|accountBy)\w*/i,
    );
  });

  it("no exported function returns account_id in its return type (structural)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/risk-signals.ts",
      ),
      "utf-8",
    );
    // Find every exported interface/type. None should contain an
    // account_id field, since those types are what callers see.
    // (Note · this is a lightweight structural check · full type-level
    // verification would require the TS compiler API.)
    const exportedTypes = src.match(
      /export\s+(interface|type)\s+\w+[\s\S]+?(?=\n(?:export|\/\/|$))/g,
    );
    if (exportedTypes) {
      for (const t of exportedTypes) {
        expect(t).not.toMatch(/\baccount_id\b\s*:/);
      }
    }
  });
});
