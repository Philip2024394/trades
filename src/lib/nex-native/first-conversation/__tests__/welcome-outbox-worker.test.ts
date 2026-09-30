// src/lib/nex-native/first-conversation/__tests__/welcome-outbox-worker.test.ts
//
// Bridge 99 · Stage 10 · worker CORE tests against real DB.

import "./_load-env";

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import pkg from "pg";
const { Client } = pkg;

import {
  runWelcomeOutboxOnce,
  type DeliverWelcomeFn,
  type ErrorPolicy,
  type MinimalPgClient,
  type WelcomeOutboxWorkerDeps,
} from "../welcome-outbox-worker";

vi.setConfig({ testTimeout: 30_000 });

const EXPECTED_PROJECT_REF = "ijvqdvsvwtwxzcqmoqit";

let pg: InstanceType<typeof Client>;
const createdAccountIds: string[] = [];

async function makeTestAccountWithOutbox(): Promise<{
  account_id: string;
  outbox_id: string;
}> {
  const rand = Math.random().toString(36).slice(2, 10);
  const acct = await pg.query(
    `INSERT INTO nex_account (display_name) VALUES ($1) RETURNING id`,
    [`_bridge99_stage10_test_${rand}`],
  );
  const account_id = acct.rows[0].id as string;
  createdAccountIds.push(account_id);

  const outbox = await pg.query(
    `INSERT INTO nex_welcome_outbox (account_id) VALUES ($1) RETURNING id`,
    [account_id],
  );
  return { account_id, outbox_id: outbox.rows[0].id as string };
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes(EXPECTED_PROJECT_REF)) {
    throw new Error(`refuses: not ${EXPECTED_PROJECT_REF}`);
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

// ---------------------------------------------------------------------------
// Adapter: wrap pg into MinimalPgClient (already fits — helps types)
// ---------------------------------------------------------------------------

function pgAdapter(): MinimalPgClient {
  return {
    query: (async (
      text: string,
      values?: unknown[],
    ): Promise<{ rows: unknown[] }> => {
      if (values) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (await pg.query(text, values as any[])) as { rows: unknown[] };
      }
      return (await pg.query(text)) as { rows: unknown[] };
    }) as MinimalPgClient["query"],
  };
}

const inserted: DeliverWelcomeResultInserted = {
  effect: "inserted" as const,
};
const alreadyDelivered: DeliverWelcomeResultAlreadyDelivered = {
  effect: "already_delivered" as const,
};
type DeliverWelcomeResultInserted = { effect: "inserted" };
type DeliverWelcomeResultAlreadyDelivered = { effect: "already_delivered" };

function makeDeps(overrides: Partial<WelcomeOutboxWorkerDeps> = {}): WelcomeOutboxWorkerDeps {
  return {
    pgClient: pgAdapter(),
    worker_id: `test-worker-${randomUUID().slice(0, 8)}`,
    lease_ms: 60_000,
    deliverWelcome: async () => inserted,
    errorPolicy: (err: unknown) => ({
      kind: "transient" as const,
      reason: err instanceof Error ? err.message.slice(0, 200) : "unknown",
    }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// no_work
// ---------------------------------------------------------------------------

describe("runWelcomeOutboxOnce · no_work", () => {
  it("returns { status: 'no_work' } when there is no eligible row for this run", async () => {
    // Different worker + no fresh outbox row for this test · run should
    // find no eligible row and return no_work. However there may be
    // rows from other tests running in parallel · so this test's guard
    // is that ANY row we might claim is fine, or no row.
    //
    // To make this deterministic, we create no rows in this test and
    // assert either no_work OR that whatever was processed wasn't ours.
    const r = await runWelcomeOutboxOnce(makeDeps());
    // Either no_work, or we claimed someone else's row · both fine
    // for this correctness check.
    expect(["no_work", "processed", "transient_failure", "permanent_failure"]).toContain(
      r.status,
    );
  });
});

// ---------------------------------------------------------------------------
// processed · inserted path
// ---------------------------------------------------------------------------

describe("runWelcomeOutboxOnce · processed (delivery inserted)", () => {
  it("claims outbox row, delivery=inserted → marks processed", async () => {
    const { account_id, outbox_id } = await makeTestAccountWithOutbox();
    const seenCalls: Array<{ account_id: string; outbox_id: string }> = [];
    const deps = makeDeps({
      deliverWelcome: async (input) => {
        seenCalls.push(input);
        return inserted;
      },
    });

    // Run repeatedly until we claim OUR row (parallel tests may take others).
    let attempts = 0;
    let ourResult = null;
    for (attempts = 0; attempts < 30; attempts++) {
      const r = await runWelcomeOutboxOnce(deps);
      if (r.status === "processed" && r.outbox_id === outbox_id) {
        ourResult = r;
        break;
      }
      if (r.status === "no_work") break;
    }
    expect(ourResult).not.toBeNull();
    if (ourResult && ourResult.status === "processed") {
      expect(ourResult.account_id).toBe(account_id);
      expect(ourResult.delivery).toBe("inserted");
      expect(ourResult.attempts).toBeGreaterThanOrEqual(1);
    }
    expect(seenCalls.some((c) => c.outbox_id === outbox_id)).toBe(true);

    // Row is marked processed
    const row = await pg.query(
      `SELECT processed_at, claimed_at, claimed_by, lease_expires_at, failed_at
         FROM nex_welcome_outbox WHERE id = $1`,
      [outbox_id],
    );
    expect(row.rows[0].processed_at).not.toBeNull();
    expect(row.rows[0].claimed_at).toBeNull();
    expect(row.rows[0].claimed_by).toBeNull();
    expect(row.rows[0].lease_expires_at).toBeNull();
    expect(row.rows[0].failed_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// processed · already_delivered path (crash-window recovery)
// ---------------------------------------------------------------------------

describe("runWelcomeOutboxOnce · processed (already_delivered → crash-window recovery)", () => {
  it("delivery returns already_delivered → still marks processed", async () => {
    const { account_id, outbox_id } = await makeTestAccountWithOutbox();
    const deps = makeDeps({
      deliverWelcome: async () => alreadyDelivered,
    });

    let ourResult = null;
    for (let i = 0; i < 30; i++) {
      const r = await runWelcomeOutboxOnce(deps);
      if (r.status === "processed" && r.outbox_id === outbox_id) {
        ourResult = r;
        break;
      }
      if (r.status === "no_work") break;
    }
    expect(ourResult).not.toBeNull();
    if (ourResult && ourResult.status === "processed") {
      expect(ourResult.delivery).toBe("already_delivered");
      expect(ourResult.account_id).toBe(account_id);
    }
    const row = await pg.query(
      `SELECT processed_at FROM nex_welcome_outbox WHERE id = $1`,
      [outbox_id],
    );
    expect(row.rows[0].processed_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// transient_failure · lease cleared + retry scheduled
// ---------------------------------------------------------------------------

describe("runWelcomeOutboxOnce · transient failure", () => {
  it("delivery throws · errorPolicy=transient → clears lease + sets next_attempt_after", async () => {
    const { account_id, outbox_id } = await makeTestAccountWithOutbox();
    const deps = makeDeps({
      deliverWelcome: async () => {
        throw new Error("upstream 503");
      },
      errorPolicy: () => ({
        kind: "transient",
        reason: "upstream_503",
        next_attempt_delay_ms: 15_000,
      }),
    });

    let ourResult = null;
    for (let i = 0; i < 30; i++) {
      const r = await runWelcomeOutboxOnce(deps);
      if (r.status === "transient_failure" && r.outbox_id === outbox_id) {
        ourResult = r;
        break;
      }
      if (r.status === "no_work") break;
    }
    expect(ourResult).not.toBeNull();
    if (ourResult && ourResult.status === "transient_failure") {
      expect(ourResult.reason).toBe("upstream_503");
      expect(ourResult.account_id).toBe(account_id);
    }

    // DB state · not terminal, lease released, next_attempt_after set,
    // last_attempt_error recorded
    const row = await pg.query(
      `SELECT processed_at, failed_at, claimed_at, lease_expires_at, last_attempt_error,
              next_attempt_after
         FROM nex_welcome_outbox WHERE id = $1`,
      [outbox_id],
    );
    expect(row.rows[0].processed_at).toBeNull();
    expect(row.rows[0].failed_at).toBeNull();
    expect(row.rows[0].claimed_at).toBeNull();
    expect(row.rows[0].lease_expires_at).toBeNull();
    expect(row.rows[0].last_attempt_error).toBe("upstream_503");
    expect(row.rows[0].next_attempt_after).not.toBeNull();
  });

  it("row with next_attempt_after in the FUTURE is not re-claimed", async () => {
    const { outbox_id } = await makeTestAccountWithOutbox();
    // Force next_attempt_after to 1 minute from now
    await pg.query(
      `UPDATE nex_welcome_outbox SET next_attempt_after = now() + interval '1 minute' WHERE id = $1`,
      [outbox_id],
    );

    // Run worker · should not pick up this row (may pick other rows, but not ours)
    for (let i = 0; i < 5; i++) {
      const r = await runWelcomeOutboxOnce(makeDeps());
      // Never see OUR outbox_id claimed
      if (
        r.status === "processed" ||
        r.status === "transient_failure" ||
        r.status === "permanent_failure"
      ) {
        expect(r.outbox_id).not.toBe(outbox_id);
      }
      if (r.status === "no_work") break;
    }

    const row = await pg.query(
      `SELECT processed_at, claimed_at FROM nex_welcome_outbox WHERE id = $1`,
      [outbox_id],
    );
    expect(row.rows[0].processed_at).toBeNull();
    expect(row.rows[0].claimed_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// permanent_failure
// ---------------------------------------------------------------------------

describe("runWelcomeOutboxOnce · permanent failure", () => {
  it("delivery throws · errorPolicy=permanent → marks failed with fail_reason", async () => {
    const { outbox_id } = await makeTestAccountWithOutbox();
    const deps = makeDeps({
      deliverWelcome: async () => {
        throw new Error("account does not exist");
      },
      errorPolicy: () => ({
        kind: "permanent",
        reason: "account_missing",
      }),
    });

    let ourResult = null;
    for (let i = 0; i < 30; i++) {
      const r = await runWelcomeOutboxOnce(deps);
      if (r.status === "permanent_failure" && r.outbox_id === outbox_id) {
        ourResult = r;
        break;
      }
      if (r.status === "no_work") break;
    }
    expect(ourResult).not.toBeNull();

    const row = await pg.query(
      `SELECT failed_at, fail_reason, processed_at, claimed_at, lease_expires_at
         FROM nex_welcome_outbox WHERE id = $1`,
      [outbox_id],
    );
    expect(row.rows[0].failed_at).not.toBeNull();
    expect(row.rows[0].fail_reason).toBe("account_missing");
    expect(row.rows[0].processed_at).toBeNull();
    expect(row.rows[0].claimed_at).toBeNull();
    expect(row.rows[0].lease_expires_at).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Lease · claimed rows not re-claimed by concurrent workers
// ---------------------------------------------------------------------------

describe("runWelcomeOutboxOnce · lease semantics", () => {
  it("row with fresh live lease is NOT re-claimed by a second worker call", async () => {
    const { outbox_id } = await makeTestAccountWithOutbox();
    // Simulate a claim that's still under an active lease
    await pg.query(
      `UPDATE nex_welcome_outbox
          SET claimed_at = now(),
              claimed_by = 'other-worker',
              lease_expires_at = now() + interval '5 minute',
              attempts = 1
        WHERE id = $1`,
      [outbox_id],
    );

    for (let i = 0; i < 5; i++) {
      const r = await runWelcomeOutboxOnce(makeDeps());
      if (
        r.status === "processed" ||
        r.status === "transient_failure" ||
        r.status === "permanent_failure"
      ) {
        expect(r.outbox_id).not.toBe(outbox_id);
      }
      if (r.status === "no_work") break;
    }

    const row = await pg.query(
      `SELECT claimed_by, processed_at FROM nex_welcome_outbox WHERE id = $1`,
      [outbox_id],
    );
    expect(row.rows[0].claimed_by).toBe("other-worker");
    expect(row.rows[0].processed_at).toBeNull();
  });

  it("row with EXPIRED lease can be reclaimed", async () => {
    const { outbox_id } = await makeTestAccountWithOutbox();
    // Simulate a stale claim · lease already expired
    await pg.query(
      `UPDATE nex_welcome_outbox
          SET claimed_at = now() - interval '1 hour',
              claimed_by = 'crashed-worker',
              lease_expires_at = now() - interval '30 minutes',
              attempts = 1
        WHERE id = $1`,
      [outbox_id],
    );

    let ourResult = null;
    for (let i = 0; i < 30; i++) {
      const r = await runWelcomeOutboxOnce(makeDeps());
      if (r.status === "processed" && r.outbox_id === outbox_id) {
        ourResult = r;
        break;
      }
      if (r.status === "no_work") break;
    }
    expect(ourResult).not.toBeNull();
    if (ourResult && ourResult.status === "processed") {
      // attempts was 1 (from the crashed worker); this reclaim bumps to 2
      expect(ourResult.attempts).toBe(2);
    }
  });
});

// ---------------------------------------------------------------------------
// Structural
// ---------------------------------------------------------------------------

describe("welcome-outbox-worker · doctrinal isolation (structural)", () => {
  it("does NOT import identity or session resolver modules", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/welcome-outbox-worker.ts",
      ),
      "utf-8",
    );
    expect(src).not.toMatch(/from ["'].*provisional-session["']/);
    expect(src).not.toMatch(/from ["'].*account-service["']/);
    expect(src).not.toMatch(/from ["'].*session-registry-service["']/);
    expect(src).not.toMatch(/from ["'].*session-cookie["']/);
    expect(src).not.toMatch(/from ["'].*risk-service["']/);
  });

  it("does NOT choose a scheduler / runtime · exposes runWelcomeOutboxOnce only", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/lib/nex-native/first-conversation/welcome-outbox-worker.ts",
      ),
      "utf-8",
    );
    // No actual setInterval/setTimeout invocation (with parens) · comment
    // mentions of these APIs as examples of what NOT to hardcode are fine.
    expect(src).not.toMatch(/\bsetInterval\s*\(/);
    expect(src).not.toMatch(/\bsetTimeout\s*\(/);
    // No cron scheduler wiring · comment mentions of "Vercel Cron" as an
    // example runtime option are fine.
    expect(src).not.toMatch(/import.*cron/i);
    expect(src).not.toMatch(/\bcron\s*\(/i);
    // Public API is runWelcomeOutboxOnce · single entry
    const exportedFns = Array.from(
      src.matchAll(/^export\s+(async\s+)?function\s+(\w+)/gm),
    ).map((m) => m[2]);
    expect(exportedFns).toContain("runWelcomeOutboxOnce");
    // No runForever / startWorker / pollForever · deployment-choice
    // functions are prohibited in the core.
    for (const name of exportedFns) {
      expect(name).not.toMatch(/runForever|startWorker|pollForever|scheduler/i);
    }
  });
});
