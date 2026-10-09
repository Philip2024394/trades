// scripts/nex-canonical/migration-175-live.test.ts
//
// Live behavioral tests for the sealed publication view
// `nex.business_directory_v` (migration 175 · DP-1).
//
// Scope
//   · Opens a real pg Client against NEX_POSTGRES_URL and exercises
//     the view against isolated fixture rows inserted inside a
//     transaction that is ROLLBACK'd at the end of each test. The
//     seven authorised real rows AND the sealed synthetic proof
//     row are NEVER mutated · the transaction guarantees that.
//   · Skips cleanly when NEX_POSTGRES_URL is not set so this file
//     does not break the pure-unit regression on machines without
//     the local canonical Postgres.
//
// What is NOT in scope
//   · No lifecycle promotion of the 7 real rows.
//   · No change to can_display on any production source.
//   · No DROP / TRUNCATE / UPDATE on any existing row.
//
// Test fixture isolation strategy
//   Every test runs inside `BEGIN; … ROLLBACK;`. Fixture inserts
//   target distinct uuids and distinct source_ids (`test_sr_*`) so
//   they never conflict with real rows or seeded sources. The
//   ROLLBACK unwinds everything the test wrote. No test may leak
//   state across its own BEGIN/ROLLBACK boundary.

import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { Client } from "pg";
import { createHash, randomUUID } from "node:crypto";

const NEX_URL = process.env.NEX_POSTGRES_URL ?? "";
const SKIP_SUITE = NEX_URL.length === 0;

// Build a sealed-shape evidence row's required 64-char hex columns
// (candidate_integrity_hash / decision_record_id / review_package_id)
// deterministically from a seed string. Not real cryptography · the
// DB CHECK constraint only enforces the hex regex, not the content.
function hex64(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

// ═════════════════════════════════════════════════════════════════════
// §0 · Live-DB shared client · one connection, many BEGIN/ROLLBACKs
// ═════════════════════════════════════════════════════════════════════

let client: Client | null = null;

beforeAll(async () => {
  if (SKIP_SUITE) return;
  client = new Client({ connectionString: NEX_URL });
  await client.connect();
});

afterAll(async () => {
  if (client) {
    try {
      await client.end();
    } catch {
      /* best-effort close */
    }
  }
});

async function inTx<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  if (!client) throw new Error("live client not initialised");
  await client.query("BEGIN");
  try {
    const r = await fn(client);
    await client.query("ROLLBACK");
    return r;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* best-effort rollback */
    }
    throw err;
  }
}

// ═════════════════════════════════════════════════════════════════════
// §1 · Fixture builders · all inserts return the new id
// ═════════════════════════════════════════════════════════════════════

/** Create (or reuse) a source_registry row with explicit can_display.
 *  Uses ON CONFLICT DO NOTHING but the test insert runs inside a
 *  BEGIN/ROLLBACK so no production source_registry row is ever
 *  mutated. The chosen source_id prefix guarantees no overlap. */
async function insertFixtureSource(
  c: Client,
  slug: string,
  can_display: boolean,
  /** attribution_template · defaults to a non-blank test fixture
   *  string so the sealed migration-180 CHECK (ck_sr_attribution_
   *  template_present) accepts any (can_display=TRUE, attribution_
   *  required=TRUE, template=<non-blank>) row. Passing null is only
   *  safe when can_display=FALSE. */
  attribution_template: string | null = "test fixture attribution",
): Promise<string> {
  await c.query(
    `INSERT INTO nex.source_registry (
       source_id, source_type, display_name, can_display,
       attribution_template
     ) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source_id) DO NOTHING`,
    [slug, "directory_import", `Test fixture · ${slug}`, can_display, attribution_template],
  );
  return slug;
}

interface InsertFixtureCanonicalArgs {
  readonly name_canonical: string;
  readonly lifecycle_state: string;
  readonly superseded_by_business_id?: string | null;
}

async function insertFixtureCanonical(
  c: Client,
  args: InsertFixtureCanonicalArgs,
): Promise<string> {
  const r = await c.query<{ canonical_business_id: string }>(
    `INSERT INTO nex.business_canonical (
       entity_type, country, lifecycle_state,
       name_canonical, aliases,
       superseded_by_business_id
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING canonical_business_id`,
    [
      "food",
      "ZZ", // ISO 3166-1 alpha-2 private-use range · never a real country
      args.lifecycle_state,
      args.name_canonical,
      [], // aliases
      args.superseded_by_business_id ?? null,
    ],
  );
  return r.rows[0].canonical_business_id;
}

async function insertFixtureEvidence(
  c: Client,
  canonical_business_id: string,
  source_id: string,
  seedTag: string,
): Promise<string> {
  const r = await c.query<{ evidence_id: string }>(
    `INSERT INTO nex.business_evidence (
       schema_version, canonical_business_id,
       candidate_id, candidate_integrity_hash,
       decision_record_id, review_package_id,
       legacy_source_table, legacy_source_ref, legacy_source_internal_id,
       resolver_verdict_kind, resolver_target_id, resolver_score,
       observation_generator, observation_run_id,
       observation_generated_at, observation_decision_timestamp,
       observation_founder_id, source_id
     ) VALUES (
       $1, $2,
       $3, $4,
       $5, $6,
       $7, $8, $9,
       $10, $11, $12,
       $13, $14,
       $15, $16,
       $17, $18
     )
     RETURNING evidence_id`,
    [
      "evidence-v1",
      canonical_business_id,
      `cand-fx-${seedTag}`,
      hex64(`cand-fx-${seedTag}`),
      hex64(`decision-${seedTag}`),
      hex64(`package-${seedTag}`),
      "nex.food_business",
      `ref-fx-${seedTag}`,
      null,
      "NO_MATCH",
      null,
      0.5,
      "fixture",
      `run-fx-${seedTag}`,
      new Date().toISOString(),
      new Date().toISOString(),
      "test-founder",
      source_id,
    ],
  );
  return r.rows[0].evidence_id;
}

// Helper: assert the view contains these canonical_business_ids and
// does NOT contain those canonical_business_ids. Scopes the SELECT by
// id so unrelated DB state is ignored.
async function assertViewVisibility(
  c: Client,
  shouldBeVisible: readonly string[],
  shouldBeHidden: readonly string[],
): Promise<void> {
  const all = [...shouldBeVisible, ...shouldBeHidden];
  if (all.length === 0) return;
  const r = await c.query<{ canonical_business_id: string }>(
    `SELECT canonical_business_id FROM nex.business_directory_v
     WHERE canonical_business_id = ANY($1::uuid[])`,
    [all],
  );
  const observed = new Set(r.rows.map((row) => row.canonical_business_id));
  for (const id of shouldBeVisible) {
    expect(
      observed.has(id),
      `expected canonical_business_id ${id} to be VISIBLE in business_directory_v but it was NOT`,
    ).toBe(true);
  }
  for (const id of shouldBeHidden) {
    expect(
      observed.has(id),
      `expected canonical_business_id ${id} to be HIDDEN in business_directory_v but it was VISIBLE`,
    ).toBe(false);
  }
}

// ═════════════════════════════════════════════════════════════════════
// §2 · Static state assertions · the current real DB (no fixtures)
// ═════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP_SUITE)(
  "migration 175 · live state (synthetic + 7 real)",
  () => {
    test("the sealed synthetic proof row is NOT returned by the view", async () => {
      const r = await client!.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM nex.business_directory_v
         WHERE name_canonical LIKE 'SYNTHETIC NEX FIRST LIVE WRITE PROOF%'`,
        [],
      );
      expect(r.rows[0].n).toBe("0");
    });

    test("none of the 7 real canonical rows are returned by the view", async () => {
      // The 7 real rows live in country=ID with lifecycle_state=DISCOVERED
      // and their only cited source (nex_food_business_legacy) has
      // can_display=FALSE. Both predicates must exclude them.
      const r = await client!.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM nex.business_directory_v bdv
         JOIN nex.business_canonical bc
           ON bc.canonical_business_id = bdv.canonical_business_id
         WHERE bc.country = 'ID' AND bc.entity_type = 'food'`,
        [],
      );
      // The view's own predicates subsume these filters; this is a
      // belt-and-braces check that no ID food row surfaces.
      expect(r.rows[0].n).toBe("0");
    });

    test("the view currently returns ZERO rows (no row cleared for publication yet)", async () => {
      const r = await client!.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM nex.business_directory_v`,
        [],
      );
      expect(r.rows[0].n).toBe("0");
    });
  },
);

// ═════════════════════════════════════════════════════════════════════
// §3 · Lifecycle gate · D-1 L1
// ═════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP_SUITE)(
  "migration 175 · D-1 lifecycle gate (L1)",
  () => {
    const LIFECYCLES = [
      "DISCOVERED",
      "ENRICHED",
      "VERIFIED",
      "OWNER_CLAIMED",
      "OWNER_VERIFIED",
      "DORMANT",
      "SUPERSEDED",
    ] as const;

    for (const state of LIFECYCLES) {
      const expectedVisible = ["VERIFIED", "OWNER_CLAIMED", "OWNER_VERIFIED"].includes(
        state,
      );
      test(`${state} + displayable evidence → ${expectedVisible ? "VISIBLE" : "HIDDEN"}`, async () => {
        await inTx(async (c) => {
          const srcTrue = await insertFixtureSource(c, "test_sr_display_true_v1", true);
          const bcId = await insertFixtureCanonical(c, {
            name_canonical: `fx-${state}`,
            lifecycle_state: state,
            // SUPERSEDED rows normally point superseded_by to another
            // row; set it to another fixture to satisfy the lifecycle
            // + FK semantics without upsetting the view's
            // superseded_by_business_id IS NULL guard.
            superseded_by_business_id:
              state === "SUPERSEDED"
                ? await insertFixtureCanonical(c, {
                    name_canonical: `fx-${state}-successor`,
                    lifecycle_state: "VERIFIED",
                  })
                : null,
          });
          await insertFixtureEvidence(c, bcId, srcTrue, `${state}-ev`);
          if (expectedVisible) {
            await assertViewVisibility(c, [bcId], []);
          } else {
            await assertViewVisibility(c, [], [bcId]);
          }
        });
      });
    }
  },
);

// ═════════════════════════════════════════════════════════════════════
// §4 · Source-permission gate · D-2 permission-OR
// ═════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP_SUITE)(
  "migration 175 · D-2 source permission (OR aggregation)",
  () => {
    test("VERIFIED + only can_display=FALSE evidence → HIDDEN", async () => {
      await inTx(async (c) => {
        const srcFalse = await insertFixtureSource(c, "test_sr_display_false_v1", false);
        const bcId = await insertFixtureCanonical(c, {
          name_canonical: "fx-verified-false-only",
          lifecycle_state: "VERIFIED",
        });
        await insertFixtureEvidence(c, bcId, srcFalse, "false-only");
        await assertViewVisibility(c, [], [bcId]);
      });
    });

    test("VERIFIED + only can_display=TRUE evidence → VISIBLE", async () => {
      await inTx(async (c) => {
        const srcTrue = await insertFixtureSource(c, "test_sr_display_true_v1", true);
        const bcId = await insertFixtureCanonical(c, {
          name_canonical: "fx-verified-true-only",
          lifecycle_state: "VERIFIED",
        });
        await insertFixtureEvidence(c, bcId, srcTrue, "true-only");
        await assertViewVisibility(c, [bcId], []);
      });
    });

    test("VERIFIED + MIX of can_display true & false evidence → VISIBLE (OR aggregation)", async () => {
      await inTx(async (c) => {
        const srcTrue = await insertFixtureSource(c, "test_sr_display_true_v1", true);
        const srcFalse = await insertFixtureSource(c, "test_sr_display_false_v1", false);
        const bcId = await insertFixtureCanonical(c, {
          name_canonical: "fx-verified-mixed",
          lifecycle_state: "VERIFIED",
        });
        await insertFixtureEvidence(c, bcId, srcFalse, "mixed-false");
        await insertFixtureEvidence(c, bcId, srcTrue, "mixed-true");
        await assertViewVisibility(c, [bcId], []);
      });
    });

    test("VERIFIED + NO evidence at all → HIDDEN (EXISTS gate requires ≥1)", async () => {
      await inTx(async (c) => {
        const bcId = await insertFixtureCanonical(c, {
          name_canonical: "fx-verified-no-evidence",
          lifecycle_state: "VERIFIED",
        });
        await assertViewVisibility(c, [], [bcId]);
      });
    });
  },
);

// ═════════════════════════════════════════════════════════════════════
// §5 · OWNER_CLAIMED / OWNER_VERIFIED happy paths (named by auth spec)
// ═════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP_SUITE)(
  "migration 175 · OWNER_* publishable states",
  () => {
    test("OWNER_CLAIMED + displayable evidence → VISIBLE", async () => {
      await inTx(async (c) => {
        const srcTrue = await insertFixtureSource(c, "test_sr_display_true_v1", true);
        const bcId = await insertFixtureCanonical(c, {
          name_canonical: "fx-owner-claimed",
          lifecycle_state: "OWNER_CLAIMED",
        });
        await insertFixtureEvidence(c, bcId, srcTrue, "owner-claimed");
        await assertViewVisibility(c, [bcId], []);
      });
    });

    test("OWNER_VERIFIED + displayable evidence → VISIBLE", async () => {
      await inTx(async (c) => {
        const srcTrue = await insertFixtureSource(c, "test_sr_display_true_v1", true);
        const bcId = await insertFixtureCanonical(c, {
          name_canonical: "fx-owner-verified",
          lifecycle_state: "OWNER_VERIFIED",
        });
        await insertFixtureEvidence(c, bcId, srcTrue, "owner-verified");
        await assertViewVisibility(c, [bcId], []);
      });
    });
  },
);

// ═════════════════════════════════════════════════════════════════════
// §6 · Supersession guard
// ═════════════════════════════════════════════════════════════════════

describe.skipIf(SKIP_SUITE)(
  "migration 175 · supersession guard",
  () => {
    test("VERIFIED + displayable evidence BUT superseded_by set → HIDDEN", async () => {
      await inTx(async (c) => {
        const srcTrue = await insertFixtureSource(c, "test_sr_display_true_v1", true);
        const successor = await insertFixtureCanonical(c, {
          name_canonical: "fx-successor",
          lifecycle_state: "VERIFIED",
        });
        const bcId = await insertFixtureCanonical(c, {
          name_canonical: "fx-superseded-tombstone",
          lifecycle_state: "VERIFIED",
          superseded_by_business_id: successor,
        });
        await insertFixtureEvidence(c, bcId, srcTrue, "superseded-tomb");
        await insertFixtureEvidence(c, successor, srcTrue, "superseded-succ");
        // The successor should still be visible; the tombstone must be hidden.
        await assertViewVisibility(c, [successor], [bcId]);
      });
    });
  },
);
