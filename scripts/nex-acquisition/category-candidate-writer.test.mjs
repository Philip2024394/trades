// scripts/nex-acquisition/category-candidate-writer.test.mjs
//
// Directory Factory · Phase 1 · 2026-08-23
// Deterministic tests for the Walker CATEGORY_CANDIDATE writer.
//
// Two tiers:
//   · Pure-logic tests (always run) · toKebab/humanize/buildBrainKeywords/emptyResult.
//   · DB integration tests (run if NEX_POSTGRES_URL is set) · candidate
//     upsert · threshold enforcement · Walker-can't-activate proofs ·
//     Walker-can't-approve proofs · idempotence · Walker acquisition
//     invariant (rows unchanged in nex.food_business).
//
// Doctrine anchors:
//   project_nex_directory_factory_doctrine_2026_08_22
//   project_nex_walker_stays_pure_acquisition_2026_08_22

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import {
  proposeCategoryCandidates,
  toKebab,
  humanize,
  buildBrainKeywords,
} from "./category-candidate-writer.mjs";

const HAS_DB = Boolean(process.env.NEX_POSTGRES_URL);
const runIfDb = HAS_DB ? it : it.skip;

/** @type {pg.Pool | null} */
let pool = null;
function getPool() {
  if (!HAS_DB) return null;
  if (!pool) pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 4 });
  return pool;
}

// Test isolation strategy:
//   · Use country='GB' (whitelist member, but NEX has zero live GB
//     inventory — Truth Invariant validated) so test rows never mix
//     with real Yogyakarta data in queries filtered by country.
//   · Use nex.food_business public_listing_ref format `#FL-9999-XXXXX`
//     (year 9999 clearly marks test data; suffix uses the allowed
//     alphabet A-H · J · K · M · N · P-T · V-Z · 0-9).
//   · Each test run generates a unique 5-char suffix pool so parallel
//     runs don't collide.

const NS_SUFFIX = pickTestSuffix();
function pickTestSuffix() {
  const alpha = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 5; i++) out += alpha[Math.floor(Math.random() * alpha.length)];
  return out;
}

/** Deterministic 5-char alphabet suffix for a given index within one test. */
function suffixFor(i) {
  const alpha = "ABCDEFGHJKMNPQRSTVWXYZ0123456789";
  // Use the test-run suffix as a stable prefix, then vary the last 2 chars.
  const stem = NS_SUFFIX.slice(0, 3);
  const a = alpha[Math.floor(i / alpha.length) % alpha.length];
  const b = alpha[i % alpha.length];
  return `${stem}${a}${b}`;
}

/** Food public_listing_ref must match ^#FL-[0-9]{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$ */
function testFoodRef(i) {
  return `#FL-9999-${suffixFor(i)}`;
}

const TEST_COUNTRY = "GB";
const TEST_CITY    = "TestCity";

// Test category values MUST come from the food_business CHECK whitelist
// (migration 054): 'restaurant', 'coffee-cafe', 'ice-cream-dessert',
// 'fast-food'. None of these are in nex.category_registry (only 'food'
// is) — so they are LEGITIMATE Phase 1 candidate proposals.
const VALID_FOOD_CATEGORIES = ["restaurant", "coffee-cafe", "ice-cream-dessert", "fast-food"];

async function withTempWalkerState(fn) {
  const p = getPool();
  if (!p) throw new Error("No DB");
  const cycleRuns = [];
  const busRefs = [];
  let counter = 0;
  const workerIdMarker = `test-p1-${NS_SUFFIX}`;
  try {
    await fn({
      p,
      workerIdMarker,
      /** Register a synthetic worker_cycle_run row · returns its uuid. */
      async newCycle() {
        const res = await p.query(
          `INSERT INTO nex.worker_cycle_run
             (worker_id, worker_type, worker_config, status)
           VALUES ($1,'acquisition','food:Yogyakarta:test','completed')
           RETURNING id`,
          [workerIdMarker],
        );
        cycleRuns.push(res.rows[0].id);
        return res.rows[0].id;
      },
      /** Insert a synthetic food_business + provenance tied to cycleRunId.
       *  category MUST be one of VALID_FOOD_CATEGORIES. */
      async addBusiness({ category, cycleRunId, country = TEST_COUNTRY }) {
        if (!VALID_FOOD_CATEGORIES.includes(category)) {
          throw new Error(`Test bug: category '${category}' violates nex.food_business.category CHECK whitelist`);
        }
        const ref = testFoodRef(counter++);
        await p.query(
          `INSERT INTO nex.food_business
             (public_listing_ref, business_name, category, city, country,
              source, source_reference, dedupe_hash, claim_status, owner_status)
           VALUES ($1,$2,$3,$4,$5,'test',$6,$7,'discovered','unknown')`,
          [ref, `Test ${ref}`, category, TEST_CITY, country, ref, ref],
        );
        await p.query(
          `INSERT INTO nex.food_business_field_provenance
             (business_ref, field_name, trust_layer, written_by, source_reference, cycle_run_id)
           VALUES ($1,'category','source_import','test',$2,$3)`,
          [ref, ref, cycleRunId],
        );
        busRefs.push(ref);
        return ref;
      },
    });
  } finally {
    // Cleanup · reverse order to satisfy FKs.
    if (busRefs.length > 0) {
      await p.query(`DELETE FROM nex.food_business_field_provenance WHERE business_ref = ANY($1)`, [busRefs]);
      await p.query(`DELETE FROM nex.food_business WHERE public_listing_ref = ANY($1)`, [busRefs]);
    }
    // Clear any candidates our test may have written (marker prefix).
    await p.query(
      `DELETE FROM nex.category_candidate WHERE proposed_by LIKE $1`,
      [`${workerIdMarker}%`],
    );
    if (cycleRuns.length > 0) {
      await p.query(`DELETE FROM nex.worker_cycle_run WHERE id = ANY($1)`, [cycleRuns]);
    }
  }
}

// Defensive cross-session cleanup: any candidate whose proposed_by starts
// with 'test-p1-' is a leftover from a prior test run. Clear before + after
// so tests run against a deterministic pristine table.
beforeAll(async () => {
  if (!HAS_DB) return;
  const p = getPool();
  await p.query(`DELETE FROM nex.category_candidate WHERE proposed_by LIKE 'test-p1-%'`);
});

afterAll(async () => {
  if (HAS_DB && pool) {
    await pool.query(`DELETE FROM nex.category_candidate WHERE proposed_by LIKE 'test-p1-%'`);
    await pool.end();
    pool = null;
  }
});

// ═══════════════════════════════════════════════════════════════════════
// Pure-logic tests (no DB required)
// ═══════════════════════════════════════════════════════════════════════

describe("pure helpers · Phase 1 · always run", () => {
  it("toKebab normalises typical classifier outputs", () => {
    expect(toKebab("restaurant")).toBe("restaurant");
    expect(toKebab("coffee-cafe")).toBe("coffee-cafe");
    expect(toKebab("Ice Cream Dessert")).toBe("ice-cream-dessert");
    expect(toKebab("hair_salon")).toBe("hair-salon");
    expect(toKebab("  Spa & Massage  ")).toBe("spa-massage");
  });

  it("toKebab returns '' for values that would fail the DB CHECK", () => {
    expect(toKebab("")).toBe("");
    expect(toKebab(null)).toBe("");
    expect(toKebab(123)).toBe("");
    expect(toKebab("---")).toBe("");
    expect(toKebab("123-abc")).toBe("");  // starts with digit — CHECK requires letter
  });

  it("humanize produces human-friendly labels", () => {
    expect(humanize("restaurant")).toBe("Restaurant");
    expect(humanize("coffee-cafe")).toBe("Coffee Cafe");
    expect(humanize("ice-cream-dessert")).toBe("Ice Cream Dessert");
    expect(humanize("hair_salon")).toBe("Hair Salon");
  });

  it("buildBrainKeywords seeds from the id + its tokens", () => {
    expect(buildBrainKeywords("coffee-cafe")).toEqual(["coffee-cafe", "coffee", "cafe"]);
    expect(buildBrainKeywords("restaurant")).toEqual(["restaurant"]);
    expect(buildBrainKeywords("hair_salon")).toEqual(["hair_salon", "hair", "salon"]);
  });
});

describe("proposeCategoryCandidates · guards · always run (no DB touch)", () => {
  it("rejects an unsupported vertical without touching the DB", async () => {
    const spy = { calls: 0 };
    const fakePool = { query: () => { spy.calls += 1; throw new Error("should not be called"); } };
    const r = await proposeCategoryCandidates(fakePool, {
      cycleRunId: "00000000-0000-0000-0000-000000000000",
      vertical: "not-a-vertical",
      country: "ID",
      workerId: "test",
    });
    expect(r.proposed).toEqual([]);
    expect(r.updated).toEqual([]);
    expect(r.skipped[0].reason).toMatch(/unsupported-vertical/);
    expect(spy.calls).toBe(0);
  });

  it("rejects a malformed country without touching the DB", async () => {
    const spy = { calls: 0 };
    const fakePool = { query: () => { spy.calls += 1; throw new Error("should not be called"); } };
    const r = await proposeCategoryCandidates(fakePool, {
      cycleRunId: "00000000-0000-0000-0000-000000000000",
      vertical: "food",
      country: "id",   // lowercase — invalid
      workerId: "test",
    });
    expect(r.skipped[0].reason).toMatch(/bad-country/);
    expect(spy.calls).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// DB integration tests · run if NEX_POSTGRES_URL is set
// ═══════════════════════════════════════════════════════════════════════

describe("proposeCategoryCandidates · DB integration · Phase 1 invariants", () => {
  runIfDb("valid discovery over threshold creates a pending candidate", async () => {
    await withTempWalkerState(async ({ p, newCycle, addBusiness, workerIdMarker }) => {
      const cycleA = await newCycle();
      const cycleB = await newCycle();

      // 25 businesses in cycle A, 25 in cycle B — both count toward the same category.
      for (let i = 0; i < 25; i++) await addBusiness({ category: "restaurant", cycleRunId: cycleA});
      for (let i = 0; i < 25; i++) await addBusiness({ category: "restaurant", cycleRunId: cycleB});

      const r = await proposeCategoryCandidates(p, {
        cycleRunId: cycleB, vertical: "food", country: TEST_COUNTRY, city: TEST_CITY,
        workerId: workerIdMarker + "-valid",
      });

      // First run may INSERT (proposed) or UPDATE (if a stale test row exists).
      // Either way, the writer emitted a signal for 'restaurant' this cycle.
      const emitted =
        r.proposed.find((x) => x.id === "restaurant")
        ?? r.updated.find((x) => x.id === "restaurant");
      expect(emitted, `writer did not emit restaurant · full result=${JSON.stringify(r)}`).toBeDefined();
      expect(emitted.businessCount).toBe(50);
      expect(emitted.cycleCount).toBe(2);

      // Bulletproof lookup: match by proposed_cycle_run_id (unique per test cycle).
      const dbRow = await p.query(
        `SELECT admin_decision, proposed_cycle_run_id, business_count, cycle_count, evidence, suggested_countries
           FROM nex.category_candidate
          WHERE proposed_category_id = 'restaurant' AND proposed_cycle_run_id = $1 LIMIT 1`,
        [cycleB],
      );
      expect(dbRow.rows.length, "candidate row not found").toBe(1);
      expect(dbRow.rows[0].admin_decision).toBe("pending");
      expect(dbRow.rows[0].proposed_cycle_run_id).toBe(cycleB);
      expect(dbRow.rows[0].business_count).toBe(50);
      expect(dbRow.rows[0].cycle_count).toBe(2);
      expect(dbRow.rows[0].suggested_countries).toEqual([TEST_COUNTRY]);
      expect(dbRow.rows[0].evidence.source).toBe("walker-classifier-primary");
    });
  });

  runIfDb("below business threshold does NOT create a candidate", async () => {
    await withTempWalkerState(async ({ p, newCycle, addBusiness, workerIdMarker }) => {
      const cycleA = await newCycle();
      const cycleB = await newCycle();
      for (let i = 0; i < 20; i++) await addBusiness({ category: "coffee-cafe", cycleRunId: cycleA});
      for (let i = 0; i < 20; i++) await addBusiness({ category: "coffee-cafe", cycleRunId: cycleB});

      const r = await proposeCategoryCandidates(p, {
        cycleRunId: cycleB, vertical: "food", country: TEST_COUNTRY,
        workerId: workerIdMarker + "-belowbiz",
      });

      expect(r.proposed.find((x) => x.id === "coffee-cafe")).toBeUndefined();
      const skip = r.skipped.find((s) => s.id === "coffee-cafe");
      expect(skip?.reason).toBe("below-business-threshold");

      // No candidate row for THIS test's cycle should exist.
      const dbRow = await p.query(
        `SELECT count(*)::int AS n FROM nex.category_candidate
          WHERE proposed_category_id = 'coffee-cafe' AND proposed_cycle_run_id = $1`,
        [cycleB],
      );
      expect(dbRow.rows[0].n).toBe(0);
    });
  });

  runIfDb("only one cycle observed does NOT create a candidate", async () => {
    await withTempWalkerState(async ({ p, newCycle, addBusiness, workerIdMarker }) => {
      const cycleA = await newCycle();
      for (let i = 0; i < 60; i++) await addBusiness({ category: "ice-cream-dessert", cycleRunId: cycleA});

      const r = await proposeCategoryCandidates(p, {
        cycleRunId: cycleA, vertical: "food", country: TEST_COUNTRY,
        workerId: workerIdMarker + "-onecycle",
      });

      expect(r.proposed.find((x) => x.id === "ice-cream-dessert")).toBeUndefined();
      const skip = r.skipped.find((s) => s.id === "ice-cream-dessert");
      expect(skip?.reason).toBe("below-cycle-threshold");
    });
  });

  runIfDb("candidates that match an existing Registry id are skipped", async () => {
    // Plant a temp Registry entry with id='restaurant' so the writer's
    // "already-in-registry" branch fires. The food_business.category
    // CHECK only permits restaurant/coffee-cafe/ice-cream-dessert/fast-food,
    // so we can't insert a business whose category is an existing Registry
    // id like 'food' or 'hotel'. Plant a whitelisted category.
    const p = getPool();
    await p.query(`DELETE FROM nex.category_registry WHERE id = 'restaurant'`);
    try {
      await p.query(
        `INSERT INTO nex.category_registry
           (id, parent_vertical, display_name_en, display_name_id,
            visual_glyph, route, active, brain_keywords, countries)
         VALUES ('restaurant','food','TestRegistrySlot','TestRegistrySlot',
                 'Utensils','/test-registry-slot',false,'[]'::jsonb,ARRAY[$1])`,
        [TEST_COUNTRY],
      );

      await withTempWalkerState(async ({ p, newCycle, addBusiness, workerIdMarker }) => {
        const cycleA = await newCycle();
        const cycleB = await newCycle();
        for (let i = 0; i < 25; i++) await addBusiness({ category: "restaurant", cycleRunId: cycleA });
        for (let i = 0; i < 25; i++) await addBusiness({ category: "restaurant", cycleRunId: cycleB });

        const r = await proposeCategoryCandidates(p, {
          cycleRunId: cycleB, vertical: "food", country: TEST_COUNTRY,
          workerId: workerIdMarker + "-registryhit",
        });

        const skip = r.skipped.find((s) => s.id === "restaurant");
        expect(skip?.reason).toBe("already-in-registry");
      });
    } finally {
      await p.query(`DELETE FROM nex.category_registry WHERE id = 'restaurant'`);
    }
  });

  runIfDb("re-running Walker on the same category UPDATES (does not duplicate) the pending row", async () => {
    await withTempWalkerState(async ({ p, newCycle, addBusiness, workerIdMarker }) => {
      const cycleA = await newCycle();
      const cycleB = await newCycle();
      for (let i = 0; i < 25; i++) await addBusiness({ category: "fast-food", cycleRunId: cycleA});
      for (let i = 0; i < 25; i++) await addBusiness({ category: "fast-food", cycleRunId: cycleB});

      const r1 = await proposeCategoryCandidates(p, {
        cycleRunId: cycleB, vertical: "food", country: TEST_COUNTRY,
        workerId: workerIdMarker + "-idem",
      });
      const first = r1.proposed.find((x) => x.id === "fast-food")
                  ?? r1.updated.find((x) => x.id === "fast-food");
      expect(first, `first-run signal missing · ${JSON.stringify(r1)}`).toBeDefined();

      // Add more evidence in a NEW cycle, re-run.
      const cycleC = await newCycle();
      for (let i = 0; i < 10; i++) await addBusiness({ category: "fast-food", cycleRunId: cycleC });

      const r2 = await proposeCategoryCandidates(p, {
        cycleRunId: cycleC, vertical: "food", country: TEST_COUNTRY,
        workerId: workerIdMarker + "-idem",
      });
      // 2nd run MUST update the same row · never create a new one.
      const upd = r2.updated.find((x) => x.id === "fast-food");
      expect(upd, `expected updated (not proposed) on 2nd run · ${JSON.stringify(r2)}`).toBeDefined();
      expect(upd.businessCount).toBe(60);
      expect(upd.cycleCount).toBe(3);

      // Only ONE candidate row exists for this session's fast-food.
      const dbRows = await p.query(
        `SELECT count(*)::int AS n FROM nex.category_candidate
          WHERE proposed_category_id = 'fast-food' AND proposed_by LIKE $1`,
        [`${workerIdMarker}%`],
      );
      expect(dbRows.rows[0].n).toBe(1);
    });
  });

  runIfDb("candidate row records mandatory provenance (cycle_run_id + evidence)", async () => {
    await withTempWalkerState(async ({ p, newCycle, addBusiness, workerIdMarker }) => {
      const cycleA = await newCycle();
      const cycleB = await newCycle();
      for (let i = 0; i < 25; i++) await addBusiness({ category: "restaurant", cycleRunId: cycleA});
      for (let i = 0; i < 25; i++) await addBusiness({ category: "restaurant", cycleRunId: cycleB});
      await proposeCategoryCandidates(p, {
        cycleRunId: cycleB, vertical: "food", country: TEST_COUNTRY, city: TEST_CITY,
        workerId: workerIdMarker + "-prov",
      });

      const row = (await p.query(
        `SELECT proposed_cycle_run_id, evidence, discovered_businesses, proposed_by
           FROM nex.category_candidate
          WHERE proposed_category_id = 'restaurant' AND proposed_cycle_run_id = $1`,
        [cycleB],
      )).rows[0];
      expect(row).toBeDefined();
      expect(row.proposed_cycle_run_id).toBe(cycleB);
      expect(row.evidence.classifier_primary).toBe("restaurant");
      expect(row.evidence.pattern_key).toBe("primary=restaurant");
      expect(row.evidence.thresholds.business_count_observed).toBe(50);
      expect(row.evidence.thresholds.cycle_count_observed).toBe(2);
      expect(row.discovered_businesses.length).toBeGreaterThan(0);
      expect(row.discovered_businesses[0]).toHaveProperty("business_ref");
      expect(row.proposed_by).toBe(workerIdMarker + "-prov");
    });
  });
});

describe("proposeCategoryCandidates · Walker cannot bypass approval (SQL access surface)", () => {
  it("writer source never contains category_registry INSERT/UPDATE/DELETE", async () => {
    // Read the writer's own source and prove it never touches Registry.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "scripts/nex-acquisition/category-candidate-writer.mjs"),
      "utf8",
    );
    expect(src).not.toMatch(/INSERT\s+INTO\s+nex\.category_registry/i);
    expect(src).not.toMatch(/UPDATE\s+nex\.category_registry/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+nex\.category_registry/i);
  });

  it("writer source never sets admin_decision to a non-default value", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "scripts/nex-acquisition/category-candidate-writer.mjs"),
      "utf8",
    );
    // The writer must never SET admin_decision at all — the column
    // default is 'pending' which is the only value Walker may produce.
    // The bare `admin_decision =` (assignment) check is sufficient — a
    // broader `/'approved'/i` check would false-positive on documentation
    // comments that reference the doctrine state names.
    expect(src).not.toMatch(/admin_decision\s*=/i);
    // Prove no INSERT statement lists admin_decision in its column set.
    expect(src).not.toMatch(/INSERT\s+INTO\s+nex\.category_candidate[\s\S]{0,400}admin_decision/i);
  });

  it("writer source never touches admin_reviewed_at / admin_reviewed_by / admin_notes", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "scripts/nex-acquisition/category-candidate-writer.mjs"),
      "utf8",
    );
    expect(src).not.toMatch(/admin_reviewed_at\s*=/i);
    expect(src).not.toMatch(/admin_reviewed_by\s*=/i);
    expect(src).not.toMatch(/admin_notes\s*=/i);
  });
});

describe("proposeCategoryCandidates · existing Walker acquisition unchanged", () => {
  runIfDb("running the writer does not INSERT/UPDATE/DELETE any nex.food_business row", async () => {
    await withTempWalkerState(async ({ p, newCycle, addBusiness, workerIdMarker }) => {
      const cycleA = await newCycle();
      const cycleB = await newCycle();
      for (let i = 0; i < 25; i++) await addBusiness({ category: "coffee-cafe", cycleRunId: cycleA});
      for (let i = 0; i < 25; i++) await addBusiness({ category: "coffee-cafe", cycleRunId: cycleB});

      const beforeCount = Number((await p.query(`SELECT count(*)::text as n FROM nex.food_business`)).rows[0].n);
      const beforeUpdated = (await p.query(`SELECT COALESCE(max(last_verified_at), '1970-01-01'::timestamptz) as u FROM nex.food_business`)).rows[0].u;

      await proposeCategoryCandidates(p, {
        cycleRunId: cycleB, vertical: "food", country: TEST_COUNTRY,
        workerId: workerIdMarker + "-noacqchange",
      });

      const afterCount = Number((await p.query(`SELECT count(*)::text as n FROM nex.food_business`)).rows[0].n);
      const afterUpdated = (await p.query(`SELECT COALESCE(max(last_verified_at), '1970-01-01'::timestamptz) as u FROM nex.food_business`)).rows[0].u;

      expect(afterCount).toBe(beforeCount);
      expect(afterUpdated?.getTime?.()).toBe(beforeUpdated?.getTime?.());
    });
  });

  runIfDb("running the writer does not INSERT/UPDATE/DELETE any nex.category_registry row", async () => {
    await withTempWalkerState(async ({ p, newCycle, addBusiness, workerIdMarker }) => {
      const cycleA = await newCycle();
      const cycleB = await newCycle();
      for (let i = 0; i < 25; i++) await addBusiness({ category: "ice-cream-dessert", cycleRunId: cycleA});
      for (let i = 0; i < 25; i++) await addBusiness({ category: "ice-cream-dessert", cycleRunId: cycleB});

      const beforeRegistryCount = Number((await p.query(`SELECT count(*)::text as n FROM nex.category_registry`)).rows[0].n);
      await proposeCategoryCandidates(p, {
        cycleRunId: cycleB, vertical: "food", country: TEST_COUNTRY,
        workerId: workerIdMarker + "-noregchange",
      });
      const afterRegistryCount = Number((await p.query(`SELECT count(*)::text as n FROM nex.category_registry`)).rows[0].n);

      expect(afterRegistryCount).toBe(beforeRegistryCount);
    });
  });
});
