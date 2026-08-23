// scripts/nex-factory/score-candidate.test.mjs
//
// Directory Factory · Calibration Harness · scorer + recorder tests.
// Skips DB-integration tests cleanly if NEX_POSTGRES_URL is not set.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { scoreCandidate, loadRegistrySnapshot, THRESHOLDS, SCORER_VERSION } from "./score-candidate.mjs";
import { recordCandidateScores } from "./record-candidate-scores.mjs";

const HAS_DB = Boolean(process.env.NEX_POSTGRES_URL);
const runIfDb = HAS_DB ? it : it.skip;

let pool = null;
function getPool() {
  if (!HAS_DB) return null;
  if (!pool) pool = new pg.Pool({ connectionString: process.env.NEX_POSTGRES_URL, max: 4 });
  return pool;
}
afterAll(async () => { if (pool) { await pool.end(); pool = null; } });

// ── Deterministic tag values ─────────────────────────────────────
const TAG = "test-calib";

beforeAll(async () => {
  if (!HAS_DB) return;
  const p = getPool();
  // Purge anything left from prior test runs by our marker.
  await p.query(`DELETE FROM nex.category_candidate_score WHERE computed_by LIKE $1`, [`test:${TAG}%`]);
  await p.query(`DELETE FROM nex.category_candidate WHERE proposed_by LIKE $1`, [`test:${TAG}%`]);
});

// ═══════════════════════════════════════════════════════════════════════
// Pure-logic tests · always run
// ═══════════════════════════════════════════════════════════════════════

describe("scoreCandidate · thresholds published for calibration report", () => {
  it("THRESHOLDS constants match doctrine placeholder values", () => {
    expect(THRESHOLDS.HIGH_QUALITY).toBe(0.85);
    expect(THRESHOLDS.HIGH_SAFETY).toBe(0.90);
    expect(THRESHOLDS.MEDIUM_QUALITY).toBe(0.50);
    expect(THRESHOLDS.MEDIUM_SAFETY).toBe(0.50);
  });

  it("SCORER_VERSION starts era1-v1", () => {
    expect(SCORER_VERSION).toBe("era1-v1");
  });
});

describe("scoreCandidate · hard-block safety multipliers reduce safety to 0", () => {
  runIfDb("keyword_collision hard-blocks (safety=0)", async () => {
    const p = getPool();
    const registry = await loadRegistrySnapshot(p);
    const result = await scoreCandidate({
      pool: p,
      candidate: {
        id: "00000000-0000-0000-0000-000000000000",
        proposed_category_id: "test-collision",
        suggested_parent_vertical: "food",
        suggested_countries: ["ID"],
        // "food" is in the active Registry keywords list, guaranteed collision.
        brain_keywords: ["food"],
        business_count: 500,
        cycle_count: 5,
        image_candidates: [],
        duplicate_of_registry_id: null,
        superseded_by_candidate_id: null,
      },
      registryIds:      registry.registryIds,
      registryRoutes:   registry.registryRoutes,
      registryKeywords: registry.registryKeywords,
    });
    expect(result.safety_score).toBe(0);
    expect(result.provisional_tier).toBe("LOW");
    expect(result.primary_hazard).toBe("keyword-collision");
  });

  runIfDb("route_collision hard-blocks (safety=0)", async () => {
    const p = getPool();
    const registry = await loadRegistrySnapshot(p);
    // 'hotel' is a shipped Registry id → route collision.
    const result = await scoreCandidate({
      pool: p,
      candidate: {
        id: "00000000-0000-0000-0000-000000000001",
        proposed_category_id: "hotel",
        suggested_parent_vertical: "food",  // vertical mismatch is fine · collision is on id
        suggested_countries: ["ID"],
        brain_keywords: ["not-in-registry-xyzzy"],
        business_count: 500,
        cycle_count: 5,
        image_candidates: [],
        duplicate_of_registry_id: null,
        superseded_by_candidate_id: null,
      },
      registryIds:      registry.registryIds,
      registryRoutes:   registry.registryRoutes,
      registryKeywords: registry.registryKeywords,
    });
    expect(result.safety_score).toBe(0);
    expect(result.primary_hazard).toBe("route-collision");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Recorder boundary tests · Registry + Candidate untouched
// ═══════════════════════════════════════════════════════════════════════

describe("recordCandidateScores · never modifies Registry or candidate rows", () => {
  runIfDb("no INSERT/UPDATE/DELETE on category_registry", async () => {
    const p = getPool();
    const before = Number((await p.query(`SELECT count(*)::text AS n FROM nex.category_registry`)).rows[0].n);
    await recordCandidateScores(p, { computedBy: `test:${TAG}:reg-unchanged` });
    const after = Number((await p.query(`SELECT count(*)::text AS n FROM nex.category_registry`)).rows[0].n);
    expect(after).toBe(before);
  });

  runIfDb("no admin_decision changes on candidates", async () => {
    const p = getPool();
    const beforeDecisions = await p.query(
      `SELECT id, admin_decision FROM nex.category_candidate ORDER BY id`,
    );
    await recordCandidateScores(p, { computedBy: `test:${TAG}:decisions-unchanged` });
    const afterDecisions = await p.query(
      `SELECT id, admin_decision FROM nex.category_candidate ORDER BY id`,
    );
    expect(afterDecisions.rows).toEqual(beforeDecisions.rows);
  });
});

describe("source-audit · scorer + recorder never emit category_registry mutation SQL", () => {
  it("score-candidate.mjs never emits INSERT/UPDATE/DELETE on category_registry", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "scripts/nex-factory/score-candidate.mjs"),
      "utf8",
    );
    expect(src).not.toMatch(/INSERT\s+INTO\s+nex\.category_registry/i);
    expect(src).not.toMatch(/UPDATE\s+nex\.category_registry/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+nex\.category_registry/i);
  });

  it("record-candidate-scores.mjs never emits INSERT/UPDATE/DELETE on category_registry or category_candidate", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const src = await fs.readFile(
      path.join(process.cwd(), "scripts/nex-factory/record-candidate-scores.mjs"),
      "utf8",
    );
    expect(src).not.toMatch(/INSERT\s+INTO\s+nex\.category_registry/i);
    expect(src).not.toMatch(/UPDATE\s+nex\.category_registry/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+nex\.category_registry/i);
    expect(src).not.toMatch(/UPDATE\s+nex\.category_candidate\b/i);
    expect(src).not.toMatch(/DELETE\s+FROM\s+nex\.category_candidate\b/i);
    // Only allowed write path is INSERT INTO nex.category_candidate_score.
    expect(src).toMatch(/INSERT\s+INTO\s+nex\.category_candidate_score/i);
  });
});
