// NEX Workforce v2 · Slice A3 · Accommodation Canonical Model Contract Test
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.x · localhost:5439 · nex_workforce_slice1_test
//
// Proves the A3 canonical-model layer:
//   B1  source_type + source_subtype preservation through the persister
//   B2  name_source_language + name_original_text preservation
//   B3  Room type entity · FK integrity · UNIQUE (property, source, source_ref)
//   B4  Attribute overlay · vocabulary FK enforcement · value_type discriminator
//   B5  Exactly-one-value-slot invariant per attribute row
//   B6  Ternary TRUE/FALSE/UNKNOWN status support
//   B7  Controlled-array values (e.g. kos gender_policy)
//   B8  Language metadata preservation on attribute rows
//   B9  Persister role has scoped grants on new tables (structural isolation)
//   B10 A2 persister behavior unchanged for existing tests (backward-compat)
//   B11 Category enum is NOT widened (still 8 canonical types)
//   B12 Attribute writes cite source_evidence_id → future A5 attachment
//   B13 room_type_id FK from attribute overlay works (room-level attributes)
//   B14 Vocabulary seeded (>=40 rows) with expected canonical categories

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROD_SHAPE_SQL   = join(__dirname, "support", "production_shape_accommodation_business.sql");
const A2_MIGRATION_SQL = join(__dirname, "..", "..", "..", "supabase", "migrations", "_slice_a2_accommodation_business_persister.sql");
const A3_MIGRATION_SQL = join(__dirname, "..", "..", "..", "supabase", "migrations", "_slice_a3_accommodation_canonical_model.sql");

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const evidenceIdFor = (wi, gen, qh, rh) => sha256(`${wi}::${gen}::${qh}::${rh}`);

let pool;

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 10 });

  const r = await pool.query("SELECT current_database() AS db, current_setting('port') AS port");
  if (r.rows[0].db !== "nex_workforce_slice1_test") throw new Error(`wrong DB: ${r.rows[0].db}`);
  if (r.rows[0].port !== "5439")                    throw new Error(`wrong port: ${r.rows[0].port}`);

  await pool.query(`DO $body$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_brain_app')  THEN CREATE ROLE nex_brain_app  NOLOGIN NOBYPASSRLS; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='nex_social_app') THEN CREATE ROLE nex_social_app NOLOGIN NOBYPASSRLS; END IF;
  END $body$`);

  // Defensive cleanup for stale schema from prior test-file runs.
  // DROP A3 tables so the current migration recreates them with the
  // latest CHECK-constraint definitions (CREATE TABLE IF NOT EXISTS
  // would silently keep the old shape otherwise).
  await pool.query(`DROP TABLE IF EXISTS nex.accommodation_attribute CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS nex.accommodation_attribute_vocabulary CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS nex.accommodation_room_type CASCADE`);
  // Also drop A2/persister so the A3 migration's CREATE OR REPLACE is a full re-install
  await pool.query(`DROP FUNCTION IF EXISTS nex_workforce.persist_to_accommodation_business(text, uuid, integer, text, timestamptz, text, text, jsonb) CASCADE`);
  await pool.query(`DO $body$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='nex' AND table_name='accommodation_business') THEN
      EXECUTE 'TRUNCATE nex.accommodation_business_field_provenance, nex.accommodation_business CASCADE';
    END IF;
  END $body$`);

  // Apply the extended fixture (now with 080/087/088/106 shape) + A2 + A3
  await pool.query(readFileSync(PROD_SHAPE_SQL, "utf8"));
  await pool.query(readFileSync(A2_MIGRATION_SQL, "utf8"));
  await pool.query(readFileSync(A3_MIGRATION_SQL, "utf8"));
});

afterAll(async () => {
  if (pool) await pool.end();
});

beforeEach(async () => {
  await pool.query("TRUNCATE nex.accommodation_attribute, nex.accommodation_room_type CASCADE");
  await pool.query("TRUNCATE nex.accommodation_business_field_provenance, nex.accommodation_business CASCADE");
  await pool.query("TRUNCATE nex_workforce.evidence_record CASCADE");
  await pool.query("TRUNCATE nex_workforce.work_item_dead_letter, nex_workforce.work_item RESTART IDENTITY CASCADE");
  await pool.query("DELETE FROM nex_workforce.job_registry");
  await pool.query("DELETE FROM nex_workforce.city_catalogue");

  await pool.query(`INSERT INTO nex_workforce.city_catalogue (slug, name, enabled, priority, bbox_json) VALUES
    ('yogya',    'Yogyakarta', true, 100, '{"sw":{"lat":-7.9,"lon":110.3},"ne":{"lat":-7.6,"lon":110.5}}'::jsonb),
    ('bali',     'Denpasar',   true, 100, '{"sw":{"lat":-8.8,"lon":115.1},"ne":{"lat":-8.5,"lon":115.3}}'::jsonb),
    ('jakarta',  'Jakarta',    true, 100, '{"sw":{"lat":-6.4,"lon":106.7},"ne":{"lat":-6.1,"lon":107.0}}'::jsonb)`);
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function makeLeasedWorkItem({ agentId = "test-agent-1", citySlug = "yogya" } = {}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(`
      INSERT INTO nex_workforce.work_item
        (city_slug, category_slug, source_slug, state, generation)
      VALUES ($1, 'accommodation', 'overpass', 'pending', 1)
      RETURNING id, generation`, [citySlug]);
    const workItemId = ins.rows[0].id;
    const generation = ins.rows[0].generation;
    await client.query(`SET LOCAL nex_workforce.mutation_context = 'claim'`);
    await client.query(`
      UPDATE nex_workforce.work_item
         SET state = 'leased', agent_id = $2, lease_deadline = now() + interval '1 hour'
       WHERE id = $1`, [workItemId, agentId]);
    await client.query("COMMIT");
    return { workItemId, generation, agentId, citySlug };
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

async function seedEvidence({ workItemId, generation, retrievedAt, qh = "q", rh = "r" }) {
  const evId = evidenceIdFor(workItemId, generation, qh, rh);
  await pool.query(`
    INSERT INTO nex_workforce.evidence_record
      (evidence_id, work_item_id, generation, source_slug, city_slug, category_slug,
       query_hash, response_sha256, retrieved_at, http_status, byte_length, candidate_count)
    VALUES ($1, $2, $3, 'overpass', 'yogya', 'accommodation', $4, $5, $6, 200, 100, 1)
    ON CONFLICT (evidence_id) DO NOTHING
  `, [evId, workItemId, generation, qh, rh, retrievedAt]);
  return evId;
}

async function callPersister({ agentId, workItemId, generation, evidenceId, retrievedAt,
                                sourceSlug = "overpass", naturalKey, payload }) {
  return (await pool.query(
    `SELECT ok, target_pk, new_row, updated_row, rejected, rejection_reason
     FROM nex_workforce.persist_to_accommodation_business($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [agentId, workItemId, generation, evidenceId, retrievedAt, sourceSlug, naturalKey, JSON.stringify(payload)]
  )).rows[0];
}

function makeOsmPayload({ name = "Test Hotel", tourism = "hotel", hotelSub = null, guestSub = null,
                          nameId = null, nameEn = null,
                          lat = -7.795, lon = 110.365 } = {}) {
  const tags = { name };
  if (tourism)  tags.tourism = tourism;
  if (hotelSub) tags.hotel = hotelSub;
  if (guestSub) tags.guest_house = guestSub;
  if (nameId)   tags["name:id"] = nameId;
  if (nameEn)   tags["name:en"] = nameEn;
  return { type: "node", id: 1, lat, lon, tags };
}

async function fetchByNatural(naturalKey) {
  return (await pool.query(
    "SELECT * FROM nex.accommodation_business WHERE source='osm_overpass' AND source_reference=$1",
    [naturalKey]
  )).rows;
}

async function makeSeedProperty({ citySlug = "yogya", tourism = "hotel", hotelSub = null, guestSub = null,
                                   nameId = null, nameEn = null, name = "Seed Hotel", nk }) {
  const wi = await makeLeasedWorkItem({ citySlug });
  const ts = new Date("2026-09-07T10:00:00Z");
  const evId = await seedEvidence({ workItemId: wi.workItemId, generation: wi.generation, retrievedAt: ts });
  const payload = makeOsmPayload({ name, tourism, hotelSub, guestSub, nameId, nameEn });
  const r = await callPersister({ agentId: wi.agentId, workItemId: wi.workItemId, generation: wi.generation,
                                   evidenceId: evId, retrievedAt: ts, naturalKey: nk, payload });
  if (!r.ok) throw new Error(`seed failed: ${JSON.stringify(r)}`);
  const row = (await fetchByNatural(nk))[0];
  return { row, wi, evId, retrievedAt: ts };
}

// ═════════════════════════════════════════════════════════════════════════════
// B1 · SOURCE-TYPE + SOURCE-SUBTYPE PRESERVATION
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B1 · source_type + source_subtype preservation through persister", () => {
  it("tourism=chalet → canonical_category=villa · source_type=chalet · source_subtype=NULL", async () => {
    const { row } = await makeSeedProperty({ tourism: "chalet", nk: "node/9101", name: "Chalet Preserved" });
    expect(row.category).toBe("villa");
    expect(row.source_type).toBe("chalet");
    expect(row.source_subtype).toBeNull();
  });

  it("tourism=motel → canonical=hotel · source_type=motel preserved", async () => {
    const { row } = await makeSeedProperty({ tourism: "motel", nk: "node/9102", name: "Motel Preserved" });
    expect(row.category).toBe("hotel");
    expect(row.source_type).toBe("motel");
  });

  it("tourism=hotel + hotel=villa → canonical=villa · source_type=hotel · source_subtype=villa", async () => {
    const { row } = await makeSeedProperty({ tourism: "hotel", hotelSub: "villa", nk: "node/9103" });
    expect(row.category).toBe("villa");
    expect(row.source_type).toBe("hotel");
    expect(row.source_subtype).toBe("villa");
  });

  it("tourism=guest_house + guest_house=homestay → canonical=homestay · source_subtype=homestay", async () => {
    const { row } = await makeSeedProperty({ tourism: "guest_house", guestSub: "homestay", nk: "node/9104" });
    expect(row.category).toBe("homestay");
    expect(row.source_type).toBe("guest_house");
    expect(row.source_subtype).toBe("homestay");
  });

  it("field_provenance rows written for source_type + source_subtype", async () => {
    const { row } = await makeSeedProperty({ tourism: "hotel", hotelSub: "resort", nk: "node/9105" });
    const provFields = (await pool.query(
      `SELECT field_name FROM nex.accommodation_business_field_provenance WHERE business_ref=$1`,
      [row.public_listing_ref]
    )).rows.map(r => r.field_name);
    expect(provFields).toContain("source_type");
    expect(provFields).toContain("source_subtype");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B2 · NAME LANGUAGE + ORIGINAL-TEXT PRESERVATION
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B2 · name_source_language + name_original_text preservation", () => {
  it("no language-tagged variants → name_source_language=NULL, name_original_text=name", async () => {
    const { row } = await makeSeedProperty({ name: "Nameless Language", nk: "node/9201" });
    expect(row.name_source_language).toBeNull();
    expect(row.name_original_text).toBe("Nameless Language");
  });

  it("name matches name:id → name_source_language='id'", async () => {
    const { row } = await makeSeedProperty({ name: "Penginapan Sederhana", nameId: "Penginapan Sederhana", nk: "node/9202" });
    expect(row.name_source_language).toBe("id");
    expect(row.name_original_text).toBe("Penginapan Sederhana");
  });

  it("name matches name:en → name_source_language='en'", async () => {
    const { row } = await makeSeedProperty({ name: "Simple Guesthouse", nameEn: "Simple Guesthouse", nk: "node/9203" });
    expect(row.name_source_language).toBe("en");
  });

  it("both name:id and name:en present but neither matches primary name → language=NULL (never guessed)", async () => {
    const { row } = await makeSeedProperty({
      name: "Griya Sri", nameId: "Griya Sri Bahasa", nameEn: "Sri House English", nk: "node/9204"
    });
    expect(row.name_source_language).toBeNull();
    expect(row.name_original_text).toBe("Griya Sri");
  });

  it("field_provenance row written when name_source_language IS resolved", async () => {
    const { row } = await makeSeedProperty({ name: "Villa Damai", nameId: "Villa Damai", nk: "node/9205" });
    const fields = (await pool.query(
      `SELECT field_name FROM nex.accommodation_business_field_provenance WHERE business_ref=$1`,
      [row.public_listing_ref]
    )).rows.map(r => r.field_name);
    expect(fields).toContain("name_source_language");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B3 · ROOM TYPE ENTITY
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B3 · Room Type entity", () => {
  it("INSERT room type + FK to property_ref works", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9301", name: "Hotel with Rooms" });
    await pool.query(`
      INSERT INTO nex.accommodation_room_type
        (property_ref, source, source_reference, canonical_name, normalized_slug, source_name, source_language)
      VALUES ($1, 'osm_overpass', 'deluxe-king', 'Deluxe King Room', 'deluxe-king', 'Deluxe King Room', 'en')`,
      [row.public_listing_ref]);
    const rt = (await pool.query(`SELECT * FROM nex.accommodation_room_type WHERE property_ref=$1`, [row.public_listing_ref])).rows;
    expect(rt).toHaveLength(1);
    expect(rt[0].canonical_name).toBe("Deluxe King Room");
    expect(rt[0].normalized_slug).toBe("deluxe-king");
  });

  it("UNIQUE (property_ref, source, source_reference) blocks duplicate room types", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9302" });
    await pool.query(`
      INSERT INTO nex.accommodation_room_type
        (property_ref, source, source_reference, canonical_name, normalized_slug)
      VALUES ($1, 'osm_overpass', 'standard', 'Standard Room', 'standard')`, [row.public_listing_ref]);
    await expect(pool.query(`
      INSERT INTO nex.accommodation_room_type
        (property_ref, source, source_reference, canonical_name, normalized_slug)
      VALUES ($1, 'osm_overpass', 'standard', 'DIFFERENT NAME', 'standard-2')`, [row.public_listing_ref])
    ).rejects.toThrow(/duplicate key/i);
  });

  it("multiple distinct room types for same property allowed", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9303" });
    await pool.query(`INSERT INTO nex.accommodation_room_type (property_ref, source, source_reference, canonical_name, normalized_slug) VALUES ($1, 'osm_overpass', 'standard', 'Standard', 'standard'), ($1, 'osm_overpass', 'deluxe', 'Deluxe', 'deluxe'), ($1, 'osm_overpass', 'suite', 'Suite', 'suite')`, [row.public_listing_ref]);
    const rt = await pool.query(`SELECT count(*)::int AS n FROM nex.accommodation_room_type WHERE property_ref=$1`, [row.public_listing_ref]);
    expect(rt.rows[0].n).toBe(3);
  });

  it("normalized_slug CHECK enforces lowercase-slug format", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9304" });
    await expect(pool.query(`
      INSERT INTO nex.accommodation_room_type
        (property_ref, source, source_reference, canonical_name, normalized_slug)
      VALUES ($1, 'osm_overpass', 'bad', 'Bad Slug', 'Has UPPERCASE')`, [row.public_listing_ref])
    ).rejects.toThrow(/check|constraint/i);
  });

  it("occupancy CHECK constraints reject negative values", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9305" });
    await expect(pool.query(`
      INSERT INTO nex.accommodation_room_type
        (property_ref, source, source_reference, canonical_name, normalized_slug, occupancy_adults)
      VALUES ($1, 'osm_overpass', 'bad-occ', 'Bad', 'bad', -3)`, [row.public_listing_ref])
    ).rejects.toThrow(/check|constraint/i);
  });

  it("property delete CASCADEs to room types", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9306" });
    await pool.query(`INSERT INTO nex.accommodation_room_type (property_ref, source, source_reference, canonical_name, normalized_slug) VALUES ($1, 'osm_overpass', 'x', 'X', 'x')`, [row.public_listing_ref]);
    await pool.query(`DELETE FROM nex.accommodation_business WHERE public_listing_ref=$1`, [row.public_listing_ref]);
    const rt = await pool.query(`SELECT count(*)::int AS n FROM nex.accommodation_room_type WHERE property_ref=$1`, [row.public_listing_ref]);
    expect(rt.rows[0].n).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B4 · ATTRIBUTE OVERLAY · VOCABULARY FK ENFORCEMENT
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B4 · Attribute vocabulary FK", () => {
  it("unknown attribute_name → FK violation", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9401" });
    await expect(pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_text, source, observed_at)
      VALUES ($1, 'made_up_attribute_that_does_not_exist', 'TEXT', 'garbage', 'osm_overpass', now())`,
      [row.public_listing_ref])
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it("wrong value_type for known attribute → composite FK violation", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9402" });
    // 'wifi' is registered as TERNARY. Try to insert as TEXT.
    await expect(pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_text, source, observed_at)
      VALUES ($1, 'wifi', 'TEXT', 'yes', 'osm_overpass', now())`, [row.public_listing_ref])
    ).rejects.toThrow(/foreign key|violates/i);
  });

  it("correct (attribute_name, value_type) pair → INSERT accepted", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9403" });
    await pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_ternary, source, observed_at)
      VALUES ($1, 'wifi', 'TERNARY', 'TRUE', 'osm_overpass', now())`, [row.public_listing_ref]);
    const attrs = (await pool.query(`SELECT * FROM nex.accommodation_attribute WHERE property_ref=$1`, [row.public_listing_ref])).rows;
    expect(attrs).toHaveLength(1);
    expect(attrs[0].value_ternary).toBe("TRUE");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B5 · EXACTLY-ONE-VALUE-SLOT INVARIANT
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B5 · exactly-one-value-slot invariant", () => {
  it("TEXT with value_text populated → OK", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9501" });
    await pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_text, source, observed_at)
      VALUES ($1, 'check_in_time', 'TEXT', '14:00', 'osm_overpass', now())`, [row.public_listing_ref]);
    const attrs = (await pool.query(`SELECT * FROM nex.accommodation_attribute WHERE property_ref=$1`, [row.public_listing_ref])).rows;
    expect(attrs[0].value_text).toBe("14:00");
  });

  it("TEXT with value_number ALSO populated → CHECK violation", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9502" });
    await expect(pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_text, value_number, source, observed_at)
      VALUES ($1, 'check_in_time', 'TEXT', '14:00', 999, 'osm_overpass', now())`, [row.public_listing_ref])
    ).rejects.toThrow(/check|constraint/i);
  });

  it("NUMBER with value_text populated instead → CHECK violation", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9503" });
    await expect(pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_text, source, observed_at)
      VALUES ($1, 'floors_count', 'NUMBER', '5', 'osm_overpass', now())`, [row.public_listing_ref])
    ).rejects.toThrow(/check|constraint/i);
  });

  it("all value slots NULL → CHECK violation", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9504" });
    await expect(pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, source, observed_at)
      VALUES ($1, 'wifi', 'TERNARY', 'osm_overpass', now())`, [row.public_listing_ref])
    ).rejects.toThrow(/check|constraint/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B6 · TERNARY STATUS
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B6 · TRUE/FALSE/UNKNOWN ternary", () => {
  it("value_ternary='UNKNOWN' → accepted (this is the whole point)", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9601" });
    await pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_ternary, source, observed_at)
      VALUES ($1, 'wifi', 'TERNARY', 'UNKNOWN', 'osm_overpass', now())`, [row.public_listing_ref]);
    const a = (await pool.query(`SELECT value_ternary FROM nex.accommodation_attribute WHERE property_ref=$1`, [row.public_listing_ref])).rows[0];
    expect(a.value_ternary).toBe("UNKNOWN");
  });

  it("value_ternary='YES' → CHECK violation (only TRUE/FALSE/UNKNOWN allowed)", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9602" });
    await expect(pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_ternary, source, observed_at)
      VALUES ($1, 'wifi', 'TERNARY', 'YES', 'osm_overpass', now())`, [row.public_listing_ref])
    ).rejects.toThrow(/check|constraint/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B7 · CONTROLLED ARRAY VALUES
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B7 · controlled_array attribute (kos gender_policy)", () => {
  it("gender_policy=['female_only'] → OK", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9701" });
    await pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_array, source, observed_at)
      VALUES ($1, 'gender_policy', 'CONTROLLED_ARRAY', ARRAY['female_only'], 'osm_overpass', now())`, [row.public_listing_ref]);
    const a = (await pool.query(`SELECT value_array FROM nex.accommodation_attribute WHERE property_ref=$1`, [row.public_listing_ref])).rows[0];
    expect(a.value_array).toEqual(["female_only"]);
  });

  it("vocabulary allows only defined values (application-layer check · we surface allowed set)", async () => {
    const vocab = (await pool.query(
      `SELECT controlled_array_values FROM nex.accommodation_attribute_vocabulary WHERE attribute_name='gender_policy'`
    )).rows[0];
    expect(vocab.controlled_array_values).toEqual(expect.arrayContaining(["any","male_only","female_only","unknown"]));
  });

  it("CONTROLLED_ARRAY row with empty value_array → CHECK violation (array must be non-empty)", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9702" });
    await expect(pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_array, source, observed_at)
      VALUES ($1, 'pets_policy', 'CONTROLLED_ARRAY', ARRAY[]::text[], 'osm_overpass', now())`, [row.public_listing_ref])
    ).rejects.toThrow(/check|constraint/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B8 · LANGUAGE METADATA ON ATTRIBUTES
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B8 · attribute language metadata preservation", () => {
  it("raw_value + source_language stored alongside canonical value", async () => {
    const { row } = await makeSeedProperty({ nk: "node/9801" });
    await pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_text,
         raw_value, source_language, normalized_value,
         source, observed_at)
      VALUES ($1, 'house_rules', 'TEXT',
              'No visitors after 22:00',
              'Tidak ada tamu setelah pukul 22:00',
              'id',
              'No visitors after 22:00',
              'osm_overpass', now())`, [row.public_listing_ref]);
    const a = (await pool.query(`SELECT * FROM nex.accommodation_attribute WHERE property_ref=$1`, [row.public_listing_ref])).rows[0];
    expect(a.raw_value).toBe("Tidak ada tamu setelah pukul 22:00");
    expect(a.source_language).toBe("id");
    expect(a.normalized_value).toBe("No visitors after 22:00");
    expect(a.value_text).toBe("No visitors after 22:00");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B9 · PERSISTER ROLE STRUCTURAL ISOLATION
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B9 · persister role grants on new tables", () => {
  it("persister role has INSERT/UPDATE on accommodation_room_type", async () => {
    const perms = await pool.query(`
      SELECT privilege_type FROM information_schema.table_privileges
       WHERE table_schema='nex' AND table_name='accommodation_room_type'
         AND grantee='nex_workforce_persister_accommodation_business'`);
    const set = new Set(perms.rows.map(r => r.privilege_type));
    expect(set.has("SELECT")).toBe(true);
    expect(set.has("INSERT")).toBe(true);
    expect(set.has("UPDATE")).toBe(true);
  });

  it("persister role has INSERT/UPDATE on accommodation_attribute", async () => {
    const perms = await pool.query(`
      SELECT privilege_type FROM information_schema.table_privileges
       WHERE table_schema='nex' AND table_name='accommodation_attribute'
         AND grantee='nex_workforce_persister_accommodation_business'`);
    const set = new Set(perms.rows.map(r => r.privilege_type));
    expect(set.has("INSERT")).toBe(true);
    expect(set.has("UPDATE")).toBe(true);
  });

  it("persister role has only SELECT on accommodation_attribute_vocabulary (read-only)", async () => {
    const perms = await pool.query(`
      SELECT privilege_type FROM information_schema.table_privileges
       WHERE table_schema='nex' AND table_name='accommodation_attribute_vocabulary'
         AND grantee='nex_workforce_persister_accommodation_business'`);
    const set = new Set(perms.rows.map(r => r.privilege_type));
    expect(set.has("SELECT")).toBe(true);
    expect(set.has("INSERT")).toBe(false);
    expect(set.has("UPDATE")).toBe(false);
    expect(set.has("DELETE")).toBe(false);
  });

  it("persister role still has ZERO permissions on nex_workforce.mock_target (fail-closed preserved from A2)", async () => {
    const perms = await pool.query(`
      SELECT privilege_type FROM information_schema.table_privileges
       WHERE table_schema='nex_workforce' AND table_name='mock_target'
         AND grantee='nex_workforce_persister_accommodation_business'`);
    expect(perms.rows).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B10 · A2 PERSISTER BEHAVIOR UNCHANGED (backward-compat)
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B10 · A2 persister backward-compatibility", () => {
  it("A2's happy-path insert still works (identical row shape + new columns populated)", async () => {
    const { row } = await makeSeedProperty({ tourism: "hotel", nk: "node/91001", name: "Backward Compat Hotel" });
    expect(row.category).toBe("hotel");
    expect(row.business_name).toBe("Backward Compat Hotel");
    expect(row.city).toBe("Yogyakarta");
    expect(row.source_evidence_id).toBeTruthy();     // A2 column still populated
    expect(row.source_retrieved_at).toBeTruthy();    // A2 column still populated
    expect(row.source_type).toBe("hotel");           // A3 addition
    expect(row.name_original_text).toBe("Backward Compat Hotel");  // A3 addition
  });

  it("A2's fence check still rejects wrong agent_id", async () => {
    const wi = await makeLeasedWorkItem();
    const ts = new Date("2026-09-07T10:00:00Z");
    const evId = await seedEvidence({ workItemId: wi.workItemId, generation: wi.generation, retrievedAt: ts });
    const r = await callPersister({
      agentId: "wrong-agent", workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/91002",
      payload: makeOsmPayload({ name: "Fence Test" }),
    });
    expect(r.ok).toBe(false);
    expect(r.rejected).toBe(false);
  });

  it("A2's category-rejection still fires for tourism=library", async () => {
    const wi = await makeLeasedWorkItem();
    const ts = new Date("2026-09-07T10:00:00Z");
    const evId = await seedEvidence({ workItemId: wi.workItemId, generation: wi.generation, retrievedAt: ts });
    const r = await callPersister({
      agentId: wi.agentId, workItemId: wi.workItemId, generation: wi.generation,
      evidenceId: evId, retrievedAt: ts, naturalKey: "node/91003",
      payload: makeOsmPayload({ name: "Library", tourism: "library" }),
    });
    expect(r.rejected).toBe(true);
    expect(r.rejection_reason).toContain("unknown_category:tourism=library");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B11 · CATEGORY ENUM NOT WIDENED
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B11 · category enum unchanged (middle-path resolution)", () => {
  it("CHECK constraint still accepts exactly the 8 canonical categories", async () => {
    const r = await pool.query(`
      SELECT pg_get_constraintdef(c.oid) AS ck
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname='nex' AND t.relname='accommodation_business'
         AND c.conname='accommodation_business_category_check'`);
    const ck = r.rows[0]?.ck ?? "";
    for (const cat of ["hotel","villa","guesthouse","homestay","resort","hostel","apartment","kos"]) {
      expect(ck).toContain(`'${cat}'::text`);
    }
    // Verify no unauthorized widening (use quoted+cast pattern to avoid
    // substring collisions like 'house' matching 'guesthouse'):
    for (const cat of ["motel","chalet","co_living","serviced_apartment","house","room_rental"]) {
      expect(ck).not.toContain(`'${cat}'::text`);
    }
  });

  it("attempt to INSERT category='motel' is REJECTED at DB level (proves middle path)", async () => {
    await expect(pool.query(`
      INSERT INTO nex.accommodation_business
        (public_listing_ref, business_name, category, city, source, source_reference, dedupe_hash)
      VALUES ('#AC-2026-BADCT', 'Bad Category', 'motel', 'Yogyakarta', 'test', 'test/1', 'x')`)
    ).rejects.toThrow(/check|constraint/i);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B12 · EVIDENCE ATTACHMENT SEAM (A5 compatibility)
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B12 · attribute rows cite source_evidence_id (A5 seam)", () => {
  it("attribute row with source_evidence_id JOINs evidence_record", async () => {
    const { row, evId } = await makeSeedProperty({ nk: "node/92001" });
    await pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, attribute_name, value_type, value_ternary,
         source, source_evidence_id, observed_at)
      VALUES ($1, 'wifi', 'TERNARY', 'TRUE', 'osm_overpass', $2, now())`, [row.public_listing_ref, evId]);
    const j = await pool.query(`
      SELECT a.attribute_name, a.value_ternary, er.evidence_id
        FROM nex.accommodation_attribute a
        JOIN nex_workforce.evidence_record er ON er.evidence_id = a.source_evidence_id
       WHERE a.property_ref=$1`, [row.public_listing_ref]);
    expect(j.rows).toHaveLength(1);
    expect(j.rows[0].evidence_id).toBe(evId);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B13 · ROOM-LEVEL ATTRIBUTES
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B13 · room-type attribute attachment", () => {
  it("attribute row can reference room_type_id (bedrooms per room-type)", async () => {
    const { row } = await makeSeedProperty({ nk: "node/93001" });
    const rt = (await pool.query(`
      INSERT INTO nex.accommodation_room_type
        (property_ref, source, source_reference, canonical_name, normalized_slug)
      VALUES ($1, 'osm_overpass', 'family', 'Family Room', 'family')
      RETURNING room_type_id`, [row.public_listing_ref])).rows[0];

    await pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, room_type_id, attribute_name, value_type, value_number, source, observed_at)
      VALUES ($1, $2, 'bedrooms_count', 'NUMBER', 3, 'osm_overpass', now())`, [row.public_listing_ref, rt.room_type_id]);

    const a = (await pool.query(`
      SELECT a.value_number, rt.canonical_name
        FROM nex.accommodation_attribute a
        JOIN nex.accommodation_room_type rt ON rt.room_type_id = a.room_type_id
       WHERE a.property_ref=$1`, [row.public_listing_ref])).rows;
    expect(a).toHaveLength(1);
    expect(Number(a[0].value_number)).toBe(3);
    expect(a[0].canonical_name).toBe("Family Room");
  });

  it("deleting the room type CASCADEs to its attributes", async () => {
    const { row } = await makeSeedProperty({ nk: "node/93002" });
    const rt = (await pool.query(`
      INSERT INTO nex.accommodation_room_type
        (property_ref, source, source_reference, canonical_name, normalized_slug)
      VALUES ($1, 'osm_overpass', 'suite', 'Suite', 'suite')
      RETURNING room_type_id`, [row.public_listing_ref])).rows[0];
    await pool.query(`
      INSERT INTO nex.accommodation_attribute
        (property_ref, room_type_id, attribute_name, value_type, value_ternary, source, observed_at)
      VALUES ($1, $2, 'balcony', 'TERNARY', 'TRUE', 'osm_overpass', now())`, [row.public_listing_ref, rt.room_type_id]);
    await pool.query(`DELETE FROM nex.accommodation_room_type WHERE room_type_id=$1`, [rt.room_type_id]);
    const a = await pool.query(`SELECT count(*)::int AS n FROM nex.accommodation_attribute WHERE property_ref=$1`, [row.public_listing_ref]);
    expect(a.rows[0].n).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B14 · VOCABULARY SEEDED
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B14 · vocabulary seeded", () => {
  it("vocabulary contains at least 40 attribute names", async () => {
    const r = await pool.query(`SELECT count(*)::int AS n FROM nex.accommodation_attribute_vocabulary`);
    expect(r.rows[0].n).toBeGreaterThanOrEqual(40);
  });

  it("common core wildcard entries present (wifi, air_conditioning, parking)", async () => {
    const names = (await pool.query(`SELECT attribute_name FROM nex.accommodation_attribute_vocabulary`)).rows.map(r => r.attribute_name);
    for (const n of ["wifi","air_conditioning","parking","elevator","check_in_time"]) expect(names).toContain(n);
  });

  it("type-specific entries present per category (villa, kos, hostel, apartment)", async () => {
    const names = (await pool.query(`SELECT attribute_name FROM nex.accommodation_attribute_vocabulary`)).rows.map(r => r.attribute_name);
    for (const n of ["private_pool","monthly_price_min","deposit_amount","gender_policy",
                     "dorm_capacity","unit_count","bedrooms_count","furnished"]) {
      expect(names).toContain(n);
    }
  });

  it("all vocabulary rows have valid value_type", async () => {
    const r = await pool.query(`
      SELECT value_type FROM nex.accommodation_attribute_vocabulary
       WHERE value_type NOT IN ('TEXT','NUMBER','BOOLEAN','TERNARY','CONTROLLED_ARRAY')`);
    expect(r.rows).toHaveLength(0);
  });

  it("all CONTROLLED_ARRAY entries have non-empty controlled_array_values", async () => {
    const r = await pool.query(`
      SELECT attribute_name FROM nex.accommodation_attribute_vocabulary
       WHERE value_type='CONTROLLED_ARRAY'
         AND (controlled_array_values IS NULL OR array_length(controlled_array_values,1) < 1)`);
    expect(r.rows).toHaveLength(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B15 · A2 · REGRESSION · FOOD PERSISTER UNAFFECTED
// ═════════════════════════════════════════════════════════════════════════════

describe("Slice A3 · B15 · food persister unaffected", () => {
  it("nex_workforce.persist_to_food_business function still exists and is owned by its own role", async () => {
    const r = await pool.query(`
      SELECT r.rolname AS owner
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        JOIN pg_roles r ON r.oid=p.proowner
       WHERE n.nspname='nex_workforce' AND p.proname='persist_to_food_business'`);
    expect(r.rows[0]?.owner).toBe("nex_workforce_persister_food_business");
  });
});
