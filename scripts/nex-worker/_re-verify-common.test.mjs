// Re-Verify common library · unit tests · Philip 2026-08-27.
//
// Focused proofs · uses vitest mocks to verify the funnel counters,
// candidate SQL shape, and enrichment call chain without hitting the DB
// or fetching real websites.

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock businessWebsiteSource so we don't actually fetch websites ────────
vi.mock("../nex-acquisition/sources/business-website.mjs", () => ({
  businessWebsiteSource: () => ({
    name: "business_website",
    enrich: vi.fn(async ({ record }) => {
      if (!record.website) return null;
      if (record.website.includes("empty")) return null;
      if (record.website.includes("throw")) throw new Error("simulated fetch fail");
      return record.website.includes("image")
        ? { phone: "+62-1", image_url: "https://x.com/img.jpg", image_source_method: "og:image", _sourceReference: record.website }
        : { phone: "+62-1", _sourceReference: record.website };
    }),
  }),
}));

import { runReVerifyCycle, readCandidates, RE_VERIFY_BATCH_CAP } from "./_re-verify-common.mjs";

// Helper · minimal mock pool that captures queries + returns programmable rows.
function mockPool({ candidatesRow = [], insertOk = true } = {}) {
  const calls = [];
  return {
    calls,
    query: vi.fn(async (sql, params) => {
      calls.push({ sql, params });
      // Read-candidates SELECT
      if (/FROM nex\.\w+_business/i.test(sql) && /WHERE website/i.test(sql)) {
        return { rows: candidatesRow, rowCount: candidatesRow.length };
      }
      // cycle_run INSERT
      if (/INSERT INTO nex\.worker_cycle_run/i.test(sql)) {
        return insertOk ? { rowCount: 1 } : Promise.reject(new Error("insert failed"));
      }
      // Enrichment writeback (COALESCE UPDATE via applyEnrichmentToExisting)
      if (/UPDATE nex\.\w+_business/i.test(sql)) {
        return { rowCount: 1, rows: [{ internal_id: "mock-id" }] };
      }
      // Image INSERT
      if (/INSERT INTO nex\.business_image/i.test(sql)) {
        return { rowCount: 1, rows: [{ id: "mock-img" }] };
      }
      return { rows: [], rowCount: 0 };
    }),
  };
}

// Minimal vertical config that applies enrichment · returns aggregate rowCount.
function mockConfig() {
  return {
    persistence: {
      applyEnrichmentToExisting: vi.fn(async (pool, existing, gain, ctx) => {
        // Simulate the vertical's real behaviour: text UPDATE + optional image write.
        let n = 0;
        await pool.query("UPDATE nex.food_business SET phone = COALESCE(phone, $1) WHERE public_listing_ref = $2", [gain.phone, existing.public_listing_ref]);
        n += 1;
        if (gain.image_url) {
          await pool.query("INSERT INTO nex.business_image (...) VALUES (...) ON CONFLICT DO NOTHING", []);
          n += 1;
        }
        return n;
      }),
    },
  };
}

describe("readCandidates · SQL shape", () => {
  it("selects the right columns and filters by owner_status + freshness", async () => {
    const pool = mockPool({ candidatesRow: [{ public_listing_ref: "#A", website: "https://a.com" }] });
    await readCandidates(pool, "nex.food_business", 10);
    const { sql, params } = pool.calls[0];
    expect(sql).toMatch(/public_listing_ref/);
    expect(sql).toMatch(/hero_image_url/);
    expect(sql).toMatch(/last_verified_at/);
    expect(sql).toMatch(/website IS NOT NULL/);
    expect(sql).toMatch(/owner_status != 'verified'/);
    expect(sql).toMatch(/hero_image_url IS NULL/);
    expect(sql).toMatch(/last_verified_at < now\(\) - interval '30 days'/);
    expect(sql).toMatch(/LIMIT \$1/);
    expect(params).toEqual([10]);
  });

  it("respects the RE_VERIFY_BATCH_CAP default", () => {
    expect(RE_VERIFY_BATCH_CAP).toBe(10);
  });
});

describe("runReVerifyCycle · funnel counters", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("reports 0 candidates cleanly when the read returns empty", async () => {
    const pool = mockPool({ candidatesRow: [] });
    const config = mockConfig();
    const result = await runReVerifyCycle({
      pool, config,
      tableName: "nex.food_business",
      workerType: "re_verify_food",
      workerConfig: "re_verify:food",
    });
    expect(result.counters.candidates_read).toBe(0);
    expect(result.counters.fetch_attempted).toBe(0);
    expect(result.counters.errors).toBe(0);
    expect(config.persistence.applyEnrichmentToExisting).not.toHaveBeenCalled();
  });

  it("attempts fetch for each candidate + counts image extractions", async () => {
    const pool = mockPool({
      candidatesRow: [
        { public_listing_ref: "#A", website: "https://has-image.com" },
        { public_listing_ref: "#B", website: "https://plain-site.com" },
        { public_listing_ref: "#C", website: "https://empty.com" }, // returns null
      ],
    });
    const config = mockConfig();
    const result = await runReVerifyCycle({
      pool, config,
      tableName: "nex.food_business",
      workerType: "re_verify_food",
      workerConfig: "re_verify:food",
    });
    expect(result.counters.candidates_read).toBe(3);
    expect(result.counters.fetch_attempted).toBe(3);
    expect(result.counters.fetch_succeeded).toBe(2);  // A + B
    expect(result.counters.gain_returned).toBe(2);
    expect(result.counters.image_extracted).toBe(1);  // only A
    expect(result.counters.image_written).toBe(1);
    expect(result.counters.text_writes).toBe(2);
    expect(result.counters.errors).toBe(0);
  });

  it("captures per-candidate errors without aborting the batch", async () => {
    const pool = mockPool({
      candidatesRow: [
        { public_listing_ref: "#A", website: "https://has-image.com" },
        { public_listing_ref: "#B", website: "https://throw-me.com" },
        { public_listing_ref: "#C", website: "https://plain-site.com" },
      ],
    });
    const config = mockConfig();
    const result = await runReVerifyCycle({
      pool, config,
      tableName: "nex.food_business",
      workerType: "re_verify_food",
      workerConfig: "re_verify:food",
    });
    expect(result.counters.candidates_read).toBe(3);
    expect(result.counters.fetch_attempted).toBe(3);
    expect(result.counters.fetch_succeeded).toBe(2);  // A + C
    expect(result.counters.errors).toBe(1);           // B threw
    expect(result.counters.image_written).toBe(1);    // A wrote image
    expect(result.counters.text_writes).toBe(2);      // A + C wrote text
  });

  it("writes a cycle_run row with re_verify worker_type + funnel summary", async () => {
    const pool = mockPool({
      candidatesRow: [{ public_listing_ref: "#A", website: "https://has-image.com" }],
    });
    const config = mockConfig();
    await runReVerifyCycle({
      pool, config,
      tableName: "nex.food_business",
      workerType: "re_verify_food",
      workerConfig: "re_verify:food",
    });
    const cycleRunInsert = pool.calls.find((c) => /INSERT INTO nex\.worker_cycle_run/i.test(c.sql));
    expect(cycleRunInsert).toBeTruthy();
    // params: id, worker_id, worker_type, worker_config, started, dur, status,
    //         proc, new, rej, errs, summary_json
    expect(cycleRunInsert.params[2]).toBe("re_verify_food");
    expect(cycleRunInsert.params[3]).toBe("re_verify:food");
    expect(cycleRunInsert.params[6]).toBe("completed");
    expect(cycleRunInsert.params[8]).toBe(0);        // records_new stays 0 · re-verify never counts as discovery
    const summary = JSON.parse(cycleRunInsert.params[11]);
    expect(summary.mode).toBe("re_verify");
    expect(summary.candidates_read).toBe(1);
    expect(summary.image_written).toBe(1);
  });

  it("re-verify NEVER writes records_new · protects rotation saturation counter", async () => {
    const pool = mockPool({
      candidatesRow: [
        { public_listing_ref: "#A", website: "https://has-image.com" },
        { public_listing_ref: "#B", website: "https://plain-site.com" },
      ],
    });
    const config = mockConfig();
    await runReVerifyCycle({
      pool, config,
      tableName: "nex.food_business",
      workerType: "re_verify_food",
      workerConfig: "re_verify:food",
    });
    const cycleRunInsert = pool.calls.find((c) => /INSERT INTO nex\.worker_cycle_run/i.test(c.sql));
    // records_new is param index 8 (0-indexed)
    expect(cycleRunInsert.params[8]).toBe(0);
  });
});
