// src/lib/nex/category-registry.db.test.ts
//
// Directory Factory · Phase 0 · 2026-08-23
// DB-layer parity + constraint tests. Skips cleanly if NEX_POSTGRES_URL
// is not set so dev machines without a local DB still run the rest of
// the vitest suite.
//
// Doctrine anchors:
//   project_nex_directory_factory_doctrine_2026_08_22 (Phase 0 gate)
//   docs/nex/directory-factory-phase-0-plan.md · Items 7 + 8

import { afterAll, describe, expect, it } from "vitest";
import { CATEGORY_REGISTRY } from "./category-registry";
import {
  closeRegistryDbPool,
  getRegistryDbPool,
  readCategoryRegistryRows,
  decideCategoryCandidate,
} from "./category-registry.db";
import { validateRegistryParity } from "./category-registry.validator";

const HAS_DB = Boolean(process.env.NEX_POSTGRES_URL);
const runIfDb = HAS_DB ? it : it.skip;

afterAll(async () => {
  await closeRegistryDbPool();
});

describe("category-registry · DB layer · Phase 0", () => {
  it("readCategoryRegistryRows returns null when NEX_POSTGRES_URL is unset (graceful skip)", async () => {
    if (HAS_DB) {
      // We can't easily un-set env for this one test · covered by
      // the code path itself. Skip cleanly.
      return;
    }
    const rows = await readCategoryRegistryRows();
    expect(rows).toBeNull();
  });

  runIfDb("readCategoryRegistryRows returns the seed rows", async () => {
    const rows = await readCategoryRegistryRows();
    expect(rows).not.toBeNull();
    // Expect at LEAST the 10 general + 3 trade thin = 13 rows.
    expect(rows!.length).toBeGreaterThanOrEqual(13);
    const ids = new Set(rows!.map((r) => r.id));
    for (const ts of CATEGORY_REGISTRY) {
      expect(ids.has(ts.id), `DB missing seeded row ${ts.id}`).toBe(true);
    }
    // Trade thin rows
    for (const tradeId of ["staircase-refacing", "staircase-manufacture", "kitchens"]) {
      expect(ids.has(tradeId), `DB missing trade thin row ${tradeId}`).toBe(true);
    }
  });

  runIfDb("validateRegistryParity returns ok=true (TS ↔ DB aligned)", async () => {
    const result = await validateRegistryParity();
    if (!result.ok) {
      // Build a helpful failure message
      const msg = JSON.stringify(result, null, 2);
      expect.fail(`Parity failed:\n${msg}`);
    }
    expect(result.ok).toBe(true);
    expect(result.missingInDb ?? []).toEqual([]);
    expect(result.extraInDb ?? []).toEqual([]);
    expect(result.mismatches ?? []).toEqual([]);
  });
});

describe("category-registry · DB constraints · Phase 0 defence-in-depth", () => {
  runIfDb("rejects a category_registry row with a bad country code (whitelist CHECK)", async () => {
    const pool = getRegistryDbPool()!;
    await expect(
      pool.query(
        `INSERT INTO nex.category_registry
         (id, parent_vertical, display_name_en, display_name_id, visual_glyph, route, countries)
         VALUES ('_test-badcountry','food','X','X','X','/_test/badcountry',ARRAY['ZZ'])`,
      ),
    ).rejects.toThrow();
  });

  runIfDb("rejects a category_registry row with a non-kebab id", async () => {
    const pool = getRegistryDbPool()!;
    await expect(
      pool.query(
        `INSERT INTO nex.category_registry
         (id, parent_vertical, display_name_en, display_name_id, visual_glyph, route, countries)
         VALUES ('BadCasing','food','X','X','X','/_test/badcase',ARRAY['ID'])`,
      ),
    ).rejects.toThrow();
  });

  runIfDb("rejects duplicate route", async () => {
    const pool = getRegistryDbPool()!;
    await expect(
      pool.query(
        `INSERT INTO nex.category_registry
         (id, parent_vertical, display_name_en, display_name_id, visual_glyph, route, countries)
         VALUES ('_test-duproute','food','X','X','X','/food',ARRAY['ID'])`,
      ),
    ).rejects.toThrow();
  });
});

describe("category-registry · Walker candidate cannot bypass approval · Phase 0 invariants", () => {
  runIfDb("rejects a category_candidate row with business_count < 50 (D4 threshold)", async () => {
    const pool = getRegistryDbPool()!;
    await expect(
      pool.query(
        `INSERT INTO nex.category_candidate
         (proposed_category_id, proposed_name, display_name_en, suggested_parent_vertical,
          suggested_countries, business_count, cycle_count, confidence, proposed_by)
         VALUES ('_test-under-threshold','X','X','services',ARRAY['GB'],10,3,0.9,'walker')`,
      ),
    ).rejects.toThrow();
  });

  runIfDb("rejects a category_candidate row with cycle_count < 2 (D4 threshold)", async () => {
    const pool = getRegistryDbPool()!;
    await expect(
      pool.query(
        `INSERT INTO nex.category_candidate
         (proposed_category_id, proposed_name, display_name_en, suggested_parent_vertical,
          suggested_countries, business_count, cycle_count, confidence, proposed_by)
         VALUES ('_test-onecycle','X','X','services',ARRAY['GB'],75,1,0.9,'walker')`,
      ),
    ).rejects.toThrow();
  });

  runIfDb("rejects a category_candidate row with confidence > 1", async () => {
    const pool = getRegistryDbPool()!;
    await expect(
      pool.query(
        `INSERT INTO nex.category_candidate
         (proposed_category_id, proposed_name, display_name_en, suggested_parent_vertical,
          suggested_countries, business_count, cycle_count, confidence, proposed_by)
         VALUES ('_test-badconf','X','X','services',ARRAY['GB'],75,3,1.5,'walker')`,
      ),
    ).rejects.toThrow();
  });

  runIfDb("rejects admin_decision != 'pending' with null reviewed_at/by (consistency CHECK)", async () => {
    const pool = getRegistryDbPool()!;
    await expect(
      pool.query(
        `INSERT INTO nex.category_candidate
         (proposed_category_id, proposed_name, display_name_en, suggested_parent_vertical,
          suggested_countries, business_count, cycle_count, confidence, proposed_by,
          admin_decision)
         VALUES ('_test-baddecision','X','X','services',ARRAY['GB'],75,3,0.9,'walker','approved')`,
      ),
    ).rejects.toThrow();
  });

  runIfDb("category_candidate row without admin approval does NOT create a category_registry row (Phase 0 gate)", async () => {
    // The migration exposes NO trigger, function, or default that
    // converts a candidate into a registry row. Phase 0 has zero
    // activation code. This test locks that in by proving that
    // inserting a valid pending candidate does NOT alter registry
    // row count.
    const pool = getRegistryDbPool()!;
    const beforeCount = Number(
      (await pool.query<{ n: string }>(`SELECT count(*)::text as n FROM nex.category_registry`)).rows[0]!.n,
    );

    // Id must satisfy CHECK (proposed_category_id ~ '^[a-z][a-z0-9-]*$')
    // — leading letter, lowercase, kebab-case only.
    const uniqueId = `test-nomirror-${Date.now()}`;
    try {
      await pool.query(
        `INSERT INTO nex.category_candidate
         (proposed_category_id, proposed_name, display_name_en, suggested_parent_vertical,
          suggested_countries, business_count, cycle_count, confidence, proposed_by)
         VALUES ($1,'X','X','services',ARRAY['GB'],75,3,0.9,'walker')`,
        [uniqueId],
      );

      const afterCount = Number(
        (await pool.query<{ n: string }>(`SELECT count(*)::text as n FROM nex.category_registry`)).rows[0]!.n,
      );
      expect(afterCount).toBe(beforeCount);
    } finally {
      // Clean up · candidate is test-scoped
      await pool.query(
        `DELETE FROM nex.category_candidate WHERE proposed_category_id = $1`,
        [uniqueId],
      );
    }
  });
});

describe("category-registry · seed idempotence · Phase 0", () => {
  runIfDb("seed rows are stable across re-runs (ON CONFLICT DO NOTHING preserves timestamps)", async () => {
    const pool = getRegistryDbPool()!;
    const before = await pool.query<{ id: string; created_at: Date }>(
      `SELECT id, created_at FROM nex.category_registry WHERE id = 'food'`,
    );
    // Re-run the seed row
    await pool.query(
      `INSERT INTO nex.category_registry
       (id, parent_vertical, display_name_en, display_name_id, icon, visual_glyph, visual_family,
        route, active, brain_keywords, countries, business_table, category_filter)
       VALUES ('food','food','Food','Makanan','🍜','Utensils','food',
               '/food',true,'["food"]'::jsonb,ARRAY['ID'],'nex.food_business',NULL)
       ON CONFLICT (id) DO NOTHING`,
    );
    const after = await pool.query<{ id: string; created_at: Date }>(
      `SELECT id, created_at FROM nex.category_registry WHERE id = 'food'`,
    );
    expect(after.rows[0]!.created_at.getTime()).toBe(before.rows[0]!.created_at.getTime());
  });
});

// ═══════════════════════════════════════════════════════════════════════
// PHASE 2 · decideCategoryCandidate mutator tests
// ═══════════════════════════════════════════════════════════════════════
// Boundaries proven here:
//   · Mutator NEVER writes to nex.category_registry (source-audit test).
//   · Mutator validates decision enum, reviewer, target ids.
//   · WHERE guard prevents decision on already-decided rows.
//   · admin_reviewed_at/by/notes/duplicate_of/superseded_by fields set atomically.
//   · Approving a candidate does NOT create a category_registry row (Phase 3 gate).

describe("decideCategoryCandidate · pure validation · always run", () => {
  it("rejects an invalid decision value", async () => {
    const r = await decideCategoryCandidate(
      "00000000-0000-0000-0000-000000000000",
      "pending" as any,
      "reviewer@x",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid-decision");
  });

  it("rejects empty reviewer", async () => {
    const r = await decideCategoryCandidate(
      "00000000-0000-0000-0000-000000000000",
      "approved",
      "   ",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("reviewer-required");
  });

  it("rejects duplicate without target registry id", async () => {
    const r = await decideCategoryCandidate(
      "00000000-0000-0000-0000-000000000000",
      "duplicate",
      "reviewer@x",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("duplicate-target-required");
  });

  it("rejects superseded without target candidate id", async () => {
    const r = await decideCategoryCandidate(
      "00000000-0000-0000-0000-000000000000",
      "superseded",
      "reviewer@x",
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("superseded-target-required");
  });

  it("rejects excessively long notes", async () => {
    const r = await decideCategoryCandidate(
      "00000000-0000-0000-0000-000000000000",
      "approved",
      "reviewer@x",
      { notes: "x".repeat(4001) },
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("notes-too-long");
  });
});

describe("decideCategoryCandidate · DB integration · Phase 2 invariants", () => {
  const runIfDbLocal = HAS_DB ? it : it.skip;

  async function makePendingCandidate(pool: any, idSuffix: string): Promise<string> {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO nex.category_candidate
         (proposed_category_id, proposed_name, display_name_en, suggested_parent_vertical,
          brain_keywords, suggested_countries, business_count, cycle_count, confidence,
          evidence, discovered_businesses, proposed_by)
       VALUES ($1,'X','X','services','[]'::jsonb,ARRAY['GB'],75,3,0.9,
               '{}'::jsonb,'[]'::jsonb,'test-p1-phase2')
       RETURNING id`,
      [`test-phase2-${idSuffix}-${Date.now()}`],
    );
    return res.rows[0].id;
  }

  runIfDbLocal("approve writes admin_decision + reviewed_at + reviewed_by + notes", async () => {
    const pool = getRegistryDbPool()!;
    const cid = await makePendingCandidate(pool, "approve");
    try {
      const r = await decideCategoryCandidate(cid, "approved", "philip@nex", {
        notes: "clean pattern · approve",
      });
      expect(r.ok).toBe(true);
      expect(r.candidate?.admin_decision).toBe("approved");
      expect(r.candidate?.admin_reviewed_by).toBe("philip@nex");
      expect(r.candidate?.admin_reviewed_at).not.toBeNull();
      expect(r.candidate?.admin_notes).toBe("clean pattern · approve");
    } finally {
      await pool.query(`DELETE FROM nex.category_candidate WHERE id = $1`, [cid]);
    }
  });

  runIfDbLocal("reject writes admin_decision='rejected'", async () => {
    const pool = getRegistryDbPool()!;
    const cid = await makePendingCandidate(pool, "reject");
    try {
      const r = await decideCategoryCandidate(cid, "rejected", "philip@nex", {
        notes: "not a distinct category",
      });
      expect(r.ok).toBe(true);
      expect(r.candidate?.admin_decision).toBe("rejected");
    } finally {
      await pool.query(`DELETE FROM nex.category_candidate WHERE id = $1`, [cid]);
    }
  });

  runIfDbLocal("duplicate writes duplicate_of_registry_id", async () => {
    const pool = getRegistryDbPool()!;
    const cid = await makePendingCandidate(pool, "dup");
    try {
      const r = await decideCategoryCandidate(cid, "duplicate", "philip@nex", {
        duplicateOfRegistryId: "hotel",
      });
      expect(r.ok).toBe(true);
      expect(r.candidate?.admin_decision).toBe("duplicate");
      expect(r.candidate?.duplicate_of_registry_id).toBe("hotel");
    } finally {
      await pool.query(`DELETE FROM nex.category_candidate WHERE id = $1`, [cid]);
    }
  });

  runIfDbLocal("cannot re-decide an already-decided candidate", async () => {
    const pool = getRegistryDbPool()!;
    const cid = await makePendingCandidate(pool, "twice");
    try {
      const r1 = await decideCategoryCandidate(cid, "approved", "philip@nex");
      expect(r1.ok).toBe(true);
      const r2 = await decideCategoryCandidate(cid, "rejected", "someone-else");
      expect(r2.ok).toBe(false);
      expect(r2.reason).toBe("candidate-not-found-or-already-decided");
      // Original decision must be preserved.
      const row = (await pool.query(
        `SELECT admin_decision, admin_reviewed_by FROM nex.category_candidate WHERE id = $1`,
        [cid],
      )).rows[0];
      expect(row.admin_decision).toBe("approved");
      expect(row.admin_reviewed_by).toBe("philip@nex");
    } finally {
      await pool.query(`DELETE FROM nex.category_candidate WHERE id = $1`, [cid]);
    }
  });

  runIfDbLocal("approving does NOT create a category_registry row", async () => {
    const pool = getRegistryDbPool()!;
    const cid = await makePendingCandidate(pool, "noreg");
    const beforeRegCount = Number(
      (await pool.query<{ n: string }>(`SELECT count(*)::text as n FROM nex.category_registry`)).rows[0]!.n,
    );
    try {
      const r = await decideCategoryCandidate(cid, "approved", "philip@nex");
      expect(r.ok).toBe(true);
      const afterRegCount = Number(
        (await pool.query<{ n: string }>(`SELECT count(*)::text as n FROM nex.category_registry`)).rows[0]!.n,
      );
      expect(afterRegCount).toBe(beforeRegCount);
    } finally {
      await pool.query(`DELETE FROM nex.category_candidate WHERE id = $1`, [cid]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// MIGRATION 086 · calibration annotation survives candidate deletion
// ═══════════════════════════════════════════════════════════════════════
// Regression proving NEX's learning history is NOT destroyed by
// candidate cleanup. FK is ON DELETE SET NULL + snapshot column
// preserves candidate identity forever. Philip 2026-08-23:
//   "NEX's learning history must survive cleanup of the thing it
//    learned from."

describe("Migration 086 · annotation survives candidate deletion", () => {
  const runIfDbLocal = HAS_DB ? it : it.skip;

  runIfDbLocal("annotation persists after candidate deletion · candidate_id becomes NULL · snapshot retained", async () => {
    const pool = getRegistryDbPool()!;

    // 1. Create a candidate + one annotation with a full snapshot.
    const cand = await pool.query<{ id: string }>(
      `INSERT INTO nex.category_candidate
         (proposed_category_id, proposed_name, display_name_en, suggested_parent_vertical,
          brain_keywords, suggested_countries, business_count, cycle_count, confidence,
          evidence, discovered_businesses, proposed_by)
       VALUES ($1,'RegTest','RegTest','services','["reg-test-kw"]'::jsonb,ARRAY['GB'],
               75, 3, 0.9, '{}'::jsonb, '[]'::jsonb, 'test-p1-mig086')
       RETURNING id`,
      [`test-mig086-${Date.now()}`],
    );
    const candidateId = cand.rows[0].id;

    const snapshotBefore = {
      proposed_category_id: "reg-test-mig086",
      proposed_name: "RegTest",
      display_name_en: "RegTest",
      suggested_parent_vertical: "services",
      suggested_countries: ["GB"],
      brain_keywords: ["reg-test-kw"],
      business_count: 75,
      cycle_count: 3,
      proposed_by: "test-p1-mig086",
      candidate_created_at: new Date().toISOString(),
      snapshot_taken_at: new Date().toISOString(),
    };

    const annoRes = await pool.query<{ id: string }>(
      `INSERT INTO nex.category_candidate_calibration_annotation
         (candidate_id, annotator, verdict, reason, candidate_snapshot)
       VALUES ($1, 'test-mig086@nex', 'LOW', 'regression test · snapshot must survive delete', $2)
       RETURNING id`,
      [candidateId, JSON.stringify(snapshotBefore)],
    );
    const annotationId = annoRes.rows[0].id;

    // 2. Confirm annotation exists AND links to the candidate.
    const preDelete = await pool.query(
      `SELECT id, candidate_id, verdict, candidate_snapshot
         FROM nex.category_candidate_calibration_annotation
        WHERE id = $1`,
      [annotationId],
    );
    expect(preDelete.rows[0].candidate_id).toBe(candidateId);
    expect(preDelete.rows[0].verdict).toBe("LOW");
    expect(preDelete.rows[0].candidate_snapshot.proposed_category_id).toBe("reg-test-mig086");

    // 3. Delete the candidate · this used to CASCADE the annotation
    //    (migration 085 · destroyed learning history) · migration 086
    //    changed to SET NULL so the annotation survives.
    await pool.query(`DELETE FROM nex.category_candidate WHERE id = $1`, [candidateId]);

    // 4. Assert · annotation still exists · candidate_id is NULL ·
    //    snapshot preserved with full context.
    const postDelete = await pool.query(
      `SELECT id, candidate_id, annotator, verdict, reason, candidate_snapshot
         FROM nex.category_candidate_calibration_annotation
        WHERE id = $1`,
      [annotationId],
    );
    expect(postDelete.rows.length, "annotation should survive candidate deletion").toBe(1);
    expect(postDelete.rows[0].candidate_id, "candidate_id must be NULL after cascade replacement").toBeNull();
    expect(postDelete.rows[0].annotator).toBe("test-mig086@nex");
    expect(postDelete.rows[0].verdict).toBe("LOW");

    const snap = postDelete.rows[0].candidate_snapshot;
    expect(snap.proposed_category_id, "snapshot preserves the proposed id").toBe("reg-test-mig086");
    expect(snap.proposed_name).toBe("RegTest");
    expect(snap.suggested_parent_vertical).toBe("services");
    expect(snap.business_count).toBe(75);
    expect(snap.cycle_count).toBe(3);
    expect(snap.proposed_by).toBe("test-p1-mig086");

    // 5. Cleanup · remove the surviving annotation now that the
    //    regression is proven.
    await pool.query(
      `DELETE FROM nex.category_candidate_calibration_annotation WHERE id = $1`,
      [annotationId],
    );
  });

  runIfDbLocal("FK definition is ON DELETE SET NULL (not CASCADE)", async () => {
    const pool = getRegistryDbPool()!;
    const res = await pool.query<{ delete_rule: string }>(
      `SELECT rc.delete_rule
         FROM information_schema.referential_constraints rc
         JOIN information_schema.table_constraints tc
           ON tc.constraint_name = rc.constraint_name
        WHERE tc.table_schema = 'nex'
          AND tc.table_name   = 'category_candidate_calibration_annotation'
          AND tc.constraint_name = 'category_candidate_calibration_annotation_candidate_id_fkey'`,
    );
    expect(res.rows[0].delete_rule, "annotation FK must be SET NULL to preserve learning history").toBe("SET NULL");
  });

  runIfDbLocal("candidate_snapshot column exists with jsonb type + NOT NULL", async () => {
    const pool = getRegistryDbPool()!;
    const res = await pool.query(
      `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'nex'
          AND table_name = 'category_candidate_calibration_annotation'
          AND column_name = 'candidate_snapshot'`,
    );
    expect(res.rows.length).toBe(1);
    expect(res.rows[0].data_type).toBe("jsonb");
    expect(res.rows[0].is_nullable).toBe("NO");
  });
});

describe("Phase 2 · source audit · decide route + mutator never touch Registry", () => {
  it("category-registry.db.ts decideCategoryCandidate never emits category_registry SQL", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/lib/nex/category-registry.db.ts"),
      "utf8",
    );
    // Isolate the decideCategoryCandidate function body — the file also
    // contains readCategoryRegistryRows which reads category_registry
    // (that's fine · reads are permitted). We need writes to be absent
    // inside the mutator.
    const start = src.indexOf("export async function decideCategoryCandidate");
    expect(start, "decideCategoryCandidate not found").toBeGreaterThan(-1);
    const end = src.indexOf("\n}\n", start);
    const body = src.slice(start, end);
    expect(body).not.toMatch(/INSERT\s+INTO\s+nex\.category_registry/i);
    expect(body).not.toMatch(/UPDATE\s+nex\.category_registry/i);
    expect(body).not.toMatch(/DELETE\s+FROM\s+nex\.category_registry/i);
  });

  it("HQ decide route never emits category_registry SQL", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/app/api/nex-head-quarters/directory-factory/decide/route.ts"),
      "utf8",
    );
    // Check for SQL patterns that mutate category_registry · comments are
    // permitted to reference the table for doctrine documentation.
    expect(src).not.toMatch(/INSERT\s+INTO\s+nex\.category_registry/i);
    expect(src).not.toMatch(/UPDATE\s+nex\.category_registry/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+nex\.category_registry/i);
  });

  it("Directory Factory page never emits category_registry SQL", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "src/app/nex-head-quarters/directory-factory/page.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/INSERT\s+INTO/i);
    expect(src).not.toMatch(/UPDATE\s+nex\./i);
    expect(src).not.toMatch(/DELETE\s+FROM/i);
  });
});
