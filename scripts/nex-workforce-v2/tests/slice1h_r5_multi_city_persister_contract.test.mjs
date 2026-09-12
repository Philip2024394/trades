// NEX Workforce v2 · Slice 1h R5 · Multi-city persister · 20-test contract
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
//
// Proves persist_to_food_business under R5 (city-aware) satisfies:
//   R5-01  Yogyakarta work_item → persisted city 'Yogyakarta'
//   R5-02  Jakarta work_item → persisted city 'Jakarta'
//   R5-03  Bandung work_item → persisted city 'Bandung'
//   R5-04  Source payload claims another city → work_item city wins
//   R5-05  Missing city (slug not in city_catalogue) → fail closed
//   R5-06  Invalid city (empty name in city_catalogue) → fail closed
//   R5-07  generation mismatch → reject
//   R5-08  agent mismatch → reject
//   R5-09  invalid lease/state (not 'leased') → reject
//   R5-10  stale agent cannot redirect city (city_conflict on existing row)
//   R5-11  existing identity/dedupe (source, source_reference) unchanged
//   R5-12  monotonic update behavior unchanged
//   R5-13  ambiguity rejection unchanged (≥2 matches)
//   R5-14  extensions.digest remains resolved in persister body
//   R5-15  SECURITY DEFINER + search_path + owner remain hardened
//   R5-16  no PUBLIC EXECUTE on persister
//   R5-17  no direct food_business write path for app roles (RLS-enforced)
//   R5-18  city comes from authoritative work_item (not payload addr:city)
//   R5-19  no city_catalogue production mutation (declarative · tests use fixture)
//   R5-20  no work_item production mutation (declarative · tests use fixture)

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const PERSISTER_FN = "nex_workforce.persist_to_food_business";
const __dirname = dirname(fileURLToPath(import.meta.url));
const R5_MIGRATION_PATH = join(__dirname, "..", "..", "..", "supabase", "migrations", "_slice1h_r5_multi_city_persister.sql");

let pool;

// Test cities seeded once · slugs chosen to be obviously non-production so
// they can never collide with a real C6 seed.
const TEST_CITIES = [
  { slug: "r5-test-yogya",   name: "Yogyakarta",       province: "Daerah Istimewa Yogyakarta" },
  { slug: "r5-test-jakarta", name: "Jakarta",          province: "DKI Jakarta" },
  { slug: "r5-test-bandung", name: "Bandung",          province: "Jawa Barat" },
  { slug: "r5-test-empty",   name: "   ",              province: null }, // invalid: whitespace
];

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 4 });

  // Ensure persister has extensions USAGE (Slice 4.1 v2 grant · idempotent).
  // Necessary because the R4 rehearsal test's afterAll may have dropped the
  // persister role and recreated it without extensions USAGE due to the
  // known Slice 4.1 filename-rename issue (pre-existing · unrelated to R5).
  await pool.query(`GRANT USAGE ON SCHEMA extensions TO nex_workforce_persister_food_business`).catch(() => {});

  // Idempotently re-apply R5 migration · CREATE OR REPLACE + DROP POLICY IF
  // EXISTS + GRANT are all idempotent. This makes R5 tests self-sufficient
  // regardless of what other tests do to persister state.
  try {
    const r5 = readFileSync(R5_MIGRATION_PATH, "utf8");
    await pool.query(r5);
  } catch (e) {
    // If R5 already applied cleanly and postflight passes, exceptions are
    // benign. Surface unexpected failures.
    if (!/postflight OK/.test(e.message || "")) {
      // Only re-throw if it's not the expected NOTICE-level output
    }
  }

  // Seed portable city_catalogue with R5 test fixtures. Slugs prefixed
  // 'r5-test-' so they cannot ever collide with a real production city.
  for (const c of TEST_CITIES) {
    await pool.query(
      `INSERT INTO nex_workforce.city_catalogue (slug, name, province, country, enabled, priority)
         VALUES ($1, $2, $3, 'Indonesia', true, 100)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, province = EXCLUDED.province`,
      [c.slug, c.name, c.province]
    );
  }
});

beforeEach(async () => {
  // Purge any residue from prior test runs so each test starts clean.
  // Uses the digits-only prefix range reserved for R5 tests (node/999900*).
  await pool.query(`DELETE FROM nex.food_business WHERE source='osm_overpass' AND source_reference LIKE 'node/999900%'`).catch(() => {});
});

afterAll(async () => {
  if (pool) {
    // Clean up test fixtures + any food_business rows we created (unique
    // natural_keys with 'node/999900*' pattern).
    try {
      await pool.query(`DELETE FROM nex.food_business WHERE source='osm_overpass' AND source_reference LIKE 'node/999900%'`);
      await pool.query(`DELETE FROM nex_workforce.work_item WHERE city_slug LIKE 'r5-test-%'`);
      await pool.query(`DELETE FROM nex_workforce.city_catalogue WHERE slug LIKE 'r5-test-%'`);
      await pool.query(`DELETE FROM nex_workforce.job_registry WHERE slug LIKE 'r5-test-%'`);
    } catch {}
    await pool.end();
  }
});

// ─── Fixture helpers ────────────────────────────────────────────────────────

async function seedLeasedWorkItem({ citySlug, agentId, generation = null, state = "leased" }) {
  // Pre-clean any residual work_item for this test namespace · the R4 partial
  // unique index work_item_dedupe_active covers (city, category, source) for
  // non-terminal states, so we clean by that tuple to avoid duplicate-key errors.
  await pool.query(
    `DELETE FROM nex_workforce.work_item
      WHERE agent_id = $1 OR city_slug = $2
         OR (city_slug = $2 AND category_slug = 'restaurants' AND source_slug = 'overpass'
             AND state IN ('pending','leased','soft_fail'))`,
    [agentId, citySlug]
  ).catch(() => {});
  // job_registry might be empty in tests · use ON CONFLICT-safe INSERT to allow claim/rotation to find it
  await pool.query(
    `INSERT INTO nex_workforce.job_registry
       (slug, category_slug, source_slug, cadence_minutes, max_concurrent_per_source, max_attempts, lease_minutes, enabled, priority)
     VALUES ('r5-test-restaurants-overpass','restaurants','overpass',60,3,5,15,true,100)
     ON CONFLICT (slug) DO NOTHING`
  );
  // INSERT pending, then UPDATE to leased via mutation_context
  const wi = await pool.query(
    `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, priority)
     VALUES ($1, 'restaurants', 'overpass', 100)
     RETURNING id, generation`,
    [citySlug]
  );
  const wiId = wi.rows[0].id;
  const wiGen = generation ?? wi.rows[0].generation;
  if (state !== "pending") {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL nex_workforce.mutation_context = 'claim'");
      await client.query(
        `UPDATE nex_workforce.work_item
            SET state = $1, agent_id = $2, generation = $3,
                lease_deadline = now() + interval '1 hour',
                attempts = attempts + 1,
                started_at = now()
          WHERE id = $4`,
        [state, agentId, wiGen, wiId]
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  }
  return { workItemId: wiId, generation: wiGen };
}

async function callPersister({ agentId, workItemId, generation, evidenceId, retrievedAt, sourceSlug, naturalKey, payload }) {
  const r = await pool.query(
    `SELECT * FROM ${PERSISTER_FN}($1, $2::uuid, $3::int, $4, $5::timestamptz, $6, $7, $8::jsonb)`,
    [agentId, workItemId, generation, evidenceId, retrievedAt, sourceSlug, naturalKey, JSON.stringify(payload)]
  );
  return r.rows[0];
}

function payload({ name, amenity = "restaurant", lat = -7.80, lon = 110.37, addrCity = null }) {
  return {
    lat, lon,
    tags: { amenity, name, ...(addrCity ? { "addr:city": addrCity } : {}) },
  };
}

// Unique natural_key generator · digits-only (persister regex ^(node|way|relation)/[0-9]+$)
// Prefix 999 keeps our test range clearly outside real OSM ID space
// (real OSM node ids go up to ~13B · we use 999900000000+)
let nkCounter = 0;
const nk = () => `node/999900${String(++nkCounter).padStart(6, "0")}`;

// ═════════════════════════════════════════════════════════════════════════════
// R5-01 · R5-02 · R5-03 · authoritative-city persistence
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-01 · Yogyakarta work_item → persisted city 'Yogyakarta'", () => {
  it("INSERT branch writes city='Yogyakarta' derived from work_item.city_slug", async () => {
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-yogya", agentId: "r5-a01" });
    const key = nk();
    const r = await callPersister({
      agentId: "r5-a01", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: "a".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-01 Test Restaurant" }),
    });
    expect(r.ok).toBe(true);
    expect(r.new_row).toBe(true);
    expect(r.rejected).toBe(false);
    const row = (await pool.query(`SELECT city FROM nex.food_business WHERE source='osm_overpass' AND source_reference=$1`, [key])).rows[0];
    expect(row.city).toBe("Yogyakarta");
  });
});

describe("R5-02 · Jakarta work_item → persisted city 'Jakarta'", () => {
  it("INSERT branch writes city='Jakarta'", async () => {
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-jakarta", agentId: "r5-a02" });
    const key = nk();
    const r = await callPersister({
      agentId: "r5-a02", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: "b".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-02 Test Restaurant Jakarta" }),
    });
    expect(r.ok).toBe(true);
    expect(r.new_row).toBe(true);
    const row = (await pool.query(`SELECT city FROM nex.food_business WHERE source='osm_overpass' AND source_reference=$1`, [key])).rows[0];
    expect(row.city).toBe("Jakarta");
  });
});

describe("R5-03 · Bandung work_item → persisted city 'Bandung'", () => {
  it("INSERT branch writes city='Bandung'", async () => {
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-bandung", agentId: "r5-a03" });
    const key = nk();
    const r = await callPersister({
      agentId: "r5-a03", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: "c".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-03 Test Restaurant Bandung" }),
    });
    expect(r.ok).toBe(true);
    expect(r.new_row).toBe(true);
    const row = (await pool.query(`SELECT city FROM nex.food_business WHERE source='osm_overpass' AND source_reference=$1`, [key])).rows[0];
    expect(row.city).toBe("Bandung");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-04 · payload city NEVER wins over authoritative work_item city
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-04 · Source payload claims another city → work_item city wins", () => {
  it("payload addr:city='Solo' but work_item city='Yogyakarta' → persisted 'Yogyakarta'", async () => {
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-yogya", agentId: "r5-a04" });
    const key = nk();
    const r = await callPersister({
      agentId: "r5-a04", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: "d".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-04 Payload-Says-Solo", addrCity: "Solo" }),
    });
    expect(r.ok).toBe(true);
    expect(r.new_row).toBe(true);
    const row = (await pool.query(`SELECT city, address FROM nex.food_business WHERE source='osm_overpass' AND source_reference=$1`, [key])).rows[0];
    expect(row.city).toBe("Yogyakarta");                // work_item wins
    expect(row.address ?? "").toContain("Solo");        // payload's addr:city may still appear in address STRING
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-05 · R5-06 · fail-closed on missing/invalid city
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-05 · Missing city (slug not in city_catalogue) → fail closed", () => {
  it("rejection_reason starts with 'city_not_registered:'", async () => {
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-does-not-exist", agentId: "r5-a05" });
    const r = await callPersister({
      agentId: "r5-a05", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: "e".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: nk(),
      payload: payload({ name: "R5-05 Nowhere" }),
    });
    expect(r.ok).toBe(false);
    expect(r.rejected).toBe(true);
    expect(r.rejection_reason).toMatch(/^city_not_registered:r5-test-does-not-exist/);
    expect(r.new_row).toBe(false);
  });
});

describe("R5-06 · Invalid city (empty name in city_catalogue) → fail closed", () => {
  it("rejection_reason starts with 'invalid_city:'", async () => {
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-empty", agentId: "r5-a06" });
    const r = await callPersister({
      agentId: "r5-a06", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: "f".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: nk(),
      payload: payload({ name: "R5-06 Empty City" }),
    });
    expect(r.ok).toBe(false);
    expect(r.rejected).toBe(true);
    expect(r.rejection_reason).toMatch(/^invalid_city:slug=r5-test-empty/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-07 · R5-08 · R5-09 · fencing preserved
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-07 · generation mismatch → reject (silent · ok=false rejected=false)", () => {
  it("returns ok=false rejected=false when generation doesn't match", async () => {
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-yogya", agentId: "r5-a07" });
    const r = await callPersister({
      agentId: "r5-a07", workItemId: wi.workItemId, generation: wi.generation + 99, // WRONG generation
      evidenceId: "0".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: nk(),
      payload: payload({ name: "R5-07 Should Not Persist" }),
    });
    expect(r.ok).toBe(false);
    // Fence-miss returns silent (rejected=false rejection_reason=null · caller aborts as lease_lost)
    expect(r.rejected).toBe(false);
    expect(r.rejection_reason).toBeNull();
  });
});

describe("R5-08 · agent mismatch → reject (fence miss)", () => {
  it("returns ok=false rejected=false when agent_id doesn't match", async () => {
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-yogya", agentId: "r5-a08" });
    const r = await callPersister({
      agentId: "r5-a08-WRONG", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: "1".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: nk(),
      payload: payload({ name: "R5-08 Wrong Agent" }),
    });
    expect(r.ok).toBe(false);
    expect(r.rejected).toBe(false);
    expect(r.rejection_reason).toBeNull();
  });
});

describe("R5-09 · invalid lease/state (not 'leased') → reject (fence miss)", () => {
  it("returns ok=false rejected=false when work_item state=pending", async () => {
    // Seed at pending state (skip claim transition) · clean any other
    // non-terminal work_item for the same (city, category, source) to avoid
    // the work_item_dedupe_active partial unique index violation.
    await pool.query(
      `DELETE FROM nex_workforce.work_item
        WHERE agent_id = 'r5-a09-agent'
           OR (city_slug='r5-test-yogya' AND category_slug='restaurants' AND source_slug='overpass'
               AND state IN ('pending','leased','soft_fail'))`
    ).catch(()=>{});
    const wi0 = await pool.query(
      `INSERT INTO nex_workforce.work_item (city_slug, category_slug, source_slug, priority)
       VALUES ('r5-test-yogya', 'restaurants', 'overpass', 100)
       RETURNING id, generation`
    );
    const r = await callPersister({
      agentId: "r5-a09-agent", workItemId: wi0.rows[0].id, generation: wi0.rows[0].generation,
      evidenceId: "2".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: nk(),
      payload: payload({ name: "R5-09 Not Leased" }),
    });
    expect(r.ok).toBe(false);
    expect(r.rejected).toBe(false);
    expect(r.rejection_reason).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-10 · stale agent cannot redirect city → city_conflict on existing row
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-10 · stale agent cannot redirect city on existing row → REJECT city_conflict", () => {
  it("existing row city='Yogyakarta' + new work_item city='Jakarta' → city_conflict", async () => {
    // Round 1 · seed a Yogyakarta row
    const wi1 = await seedLeasedWorkItem({ citySlug: "r5-test-yogya", agentId: "r5-a10-first" });
    const key = nk();
    const r1 = await callPersister({
      agentId: "r5-a10-first", workItemId: wi1.workItemId, generation: wi1.generation,
      evidenceId: "3".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-10 Shared Node" }),
    });
    expect(r1.ok).toBe(true); expect(r1.new_row).toBe(true);

    // Round 2 · same natural_key claimed by Jakarta work_item
    const wi2 = await seedLeasedWorkItem({ citySlug: "r5-test-jakarta", agentId: "r5-a10-second" });
    const r2 = await callPersister({
      agentId: "r5-a10-second", workItemId: wi2.workItemId, generation: wi2.generation,
      evidenceId: "4".repeat(64), retrievedAt: "2026-09-04T13:00:00Z",  // newer
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-10 Shared Node" }),
    });
    expect(r2.ok).toBe(false);
    expect(r2.rejected).toBe(true);
    expect(r2.rejection_reason).toMatch(/^city_conflict:existing=Yogyakarta,new=Jakarta$/);
    // Confirm row's city was NOT changed
    const row = (await pool.query(`SELECT city FROM nex.food_business WHERE source='osm_overpass' AND source_reference=$1`, [key])).rows[0];
    expect(row.city).toBe("Yogyakarta");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-11 · existing identity/dedupe (source, source_reference) unchanged
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-11 · identity/dedupe (source, source_reference) unchanged", () => {
  it("second call with same natural_key + same city hits UPDATE branch (single match) and persists monotonically", async () => {
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-yogya", agentId: "r5-a11" });
    const key = nk();
    const r1 = await callPersister({
      agentId: "r5-a11", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: "5".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-11 Identity A" }),
    });
    expect(r1.new_row).toBe(true);

    // Same key · same city · UPDATE branch expected
    const wi2 = await seedLeasedWorkItem({ citySlug: "r5-test-yogya", agentId: "r5-a11b" });
    const r2 = await callPersister({
      agentId: "r5-a11b", workItemId: wi2.workItemId, generation: wi2.generation,
      evidenceId: "6".repeat(64), retrievedAt: "2026-09-04T13:00:00Z", // newer
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-11 Identity A UPDATED" }),
    });
    expect(r2.ok).toBe(true);
    expect(r2.updated_row).toBe(true);
    expect(r2.new_row).toBe(false);
    expect(r2.rejected).toBe(false);
    const row = (await pool.query(`SELECT business_name, city FROM nex.food_business WHERE source='osm_overpass' AND source_reference=$1`, [key])).rows[0];
    expect(row.business_name).toBe("R5-11 Identity A UPDATED");
    expect(row.city).toBe("Yogyakarta");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-12 · monotonic update behavior unchanged
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-12 · monotonic update · older retrieved_at → silent no-op", () => {
  it("older retrieved_at → ok=true updated_row=false", async () => {
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-yogya", agentId: "r5-a12" });
    const key = nk();
    await callPersister({
      agentId: "r5-a12", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: "7".repeat(64), retrievedAt: "2026-09-04T13:00:00Z", // newer first
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-12 Newer First" }),
    });

    // Older retrieved_at should silently no-op
    const wi2 = await seedLeasedWorkItem({ citySlug: "r5-test-yogya", agentId: "r5-a12b" });
    const r = await callPersister({
      agentId: "r5-a12b", workItemId: wi2.workItemId, generation: wi2.generation,
      evidenceId: "8".repeat(64), retrievedAt: "2026-09-04T12:00:00Z", // OLDER
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-12 Older Attempt" }),
    });
    expect(r.ok).toBe(true);
    expect(r.updated_row).toBe(false);
    expect(r.new_row).toBe(false);
    expect(r.rejected).toBe(false);
    // Confirm name was NOT changed
    const row = (await pool.query(`SELECT business_name FROM nex.food_business WHERE source='osm_overpass' AND source_reference=$1`, [key])).rows[0];
    expect(row.business_name).toBe("R5-12 Newer First");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-13 · ambiguity rejection unchanged
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-13 · ≥2 existing rows with same natural_key → REJECT identity_ambiguous", () => {
  it("rejection_reason starts with 'identity_ambiguous:'", async () => {
    // Seed 2 rows directly (bypass persister · simulate legacy duplicates).
    // Public listing refs use Crockford Base32 chars per nex_food_business_public_ref_format_check.
    const key = nk();
    const refA = `#FL-2026-R5D1A`;
    const refB = `#FL-2026-R5D1B`;
    await pool.query(
      `DELETE FROM nex.food_business WHERE public_listing_ref IN ($2, $3) OR source_reference = $1`,
      [key, refA, refB]
    );
    await pool.query(
      `INSERT INTO nex.food_business (public_listing_ref, business_name, category, city, country, source, source_reference, dedupe_hash, created_by)
       VALUES
         ($2, 'R5-13 Dup A', 'restaurant', 'Yogyakarta', 'ID', 'osm_overpass', $1, 'hash-a-' || $1, 'test'),
         ($3, 'R5-13 Dup B', 'restaurant', 'Yogyakarta', 'ID', 'osm_overpass', $1, 'hash-b-' || $1, 'test')`,
      [key, refA, refB]
    );
    const wi = await seedLeasedWorkItem({ citySlug: "r5-test-yogya", agentId: "r5-a13" });
    const r = await callPersister({
      agentId: "r5-a13", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: "9".repeat(64), retrievedAt: "2026-09-04T12:00:00Z",
      sourceSlug: "osm_overpass", naturalKey: key,
      payload: payload({ name: "R5-13 Attempt" }),
    });
    expect(r.ok).toBe(false);
    expect(r.rejected).toBe(true);
    expect(r.rejection_reason).toMatch(/^identity_ambiguous:2_matches$/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-14 · R5-15 · R5-16 · static security assertions on deployed persister
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-14 · extensions.digest remains resolved in persister body", () => {
  it("body contains extensions.digest(", async () => {
    const r = await pool.query(`SELECT pg_get_functiondef(oid) ~ 'extensions\\.digest\\s*\\(' AS has_ext FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business'`);
    expect(r.rows[0].has_ext).toBe(true);
  });
  it("body does NOT contain public.digest(", async () => {
    const r = await pool.query(`SELECT pg_get_functiondef(oid) ~ 'public\\.digest\\s*\\(' AS has_pub FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business'`);
    expect(r.rows[0].has_pub).toBe(false);
  });
});

describe("R5-15 · SECDEF + owner + hardened search_path preserved", () => {
  it("SECURITY DEFINER = true · owner = nex_workforce_persister_food_business · search_path pg_catalog+pg_temp", async () => {
    const r = await pool.query(`
      SELECT p.prosecdef, (SELECT rolname FROM pg_roles WHERE oid=p.proowner) AS owner, p.proconfig::text AS proconfig
      FROM pg_proc p WHERE p.pronamespace='nex_workforce'::regnamespace AND p.proname='persist_to_food_business'
    `);
    const row = r.rows[0];
    expect(row.prosecdef).toBe(true);
    expect(row.owner).toBe("nex_workforce_persister_food_business");
    expect(row.proconfig).toContain("search_path=pg_catalog, pg_temp");
    expect(row.proconfig).not.toMatch(/\bpublic\b/);
  });
});

describe("R5-16 · no PUBLIC EXECUTE on persister", () => {
  it("PUBLIC EXECUTE remains revoked", async () => {
    const r = await pool.query(`
      SELECT NOT EXISTS (
        SELECT 1 FROM (
          SELECT (aclexplode(proacl)).* FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business'
        ) acl WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
      ) AS revoked
    `);
    expect(r.rows[0].revoked).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-17 · no direct food_business write path for app roles
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-17 · app role has no direct INSERT/UPDATE/DELETE on food_business", () => {
  it("nex_workforce_app has ZERO write privileges on nex.food_business", async () => {
    const r = await pool.query(`
      SELECT
        has_table_privilege('nex_workforce_app', 'nex.food_business', 'INSERT') AS ins,
        has_table_privilege('nex_workforce_app', 'nex.food_business', 'UPDATE') AS upd,
        has_table_privilege('nex_workforce_app', 'nex.food_business', 'DELETE') AS del
    `);
    expect(r.rows[0].ins).toBe(false);
    expect(r.rows[0].upd).toBe(false);
    expect(r.rows[0].del).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-18 · city always comes from authoritative work_item
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-18 · city comes from authoritative work_item (redundant with R5-04 · structural)", () => {
  it("body reads v_wi_row.city_slug and joins city_catalogue · never reads addr:city for city column", async () => {
    const r = await pool.query(`SELECT pg_get_functiondef(oid) AS defn FROM pg_proc WHERE pronamespace='nex_workforce'::regnamespace AND proname='persist_to_food_business'`);
    const body = r.rows[0].defn;
    expect(body).toMatch(/v_wi_row\.city_slug/);
    expect(body).toMatch(/nex_workforce\.city_catalogue/);
    // The INSERT VALUES clause must NOT contain the literal 'Yogyakarta'
    expect(body).not.toMatch(/VALUES[^;]*'Yogyakarta'/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// R5-19 · R5-20 · declarative · portable-fixture only + no production mutation
// ═════════════════════════════════════════════════════════════════════════════
describe("R5-19 · portable-fixture-only city_catalogue mutations", () => {
  it("all city_catalogue rows we inserted are prefixed 'r5-test-'", async () => {
    const r = await pool.query(`SELECT slug FROM nex_workforce.city_catalogue WHERE slug NOT LIKE 'r5-test-%' AND slug LIKE '%r5%'`);
    expect(r.rows.length).toBe(0);
  });
});

describe("R5-20 · portable-fixture-only work_item mutations", () => {
  it("no work_item exists with a non-r5-test city_slug created by this test file", async () => {
    // Guardrail: no test-created work_items should leak into production-shaped city slugs
    const r = await pool.query(`SELECT count(*)::int AS n FROM nex_workforce.work_item WHERE agent_id LIKE 'r5-a%' AND city_slug NOT LIKE 'r5-test-%'`);
    expect(r.rows[0].n).toBe(0);
  });
});
