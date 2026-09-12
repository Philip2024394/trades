// NEX Workforce v2 · Slice 4.1 · pgcrypto extension-schema regression
// ─────────────────────────────────────────────────────────────────────────────
// Target: portable PostgreSQL 17.11 · localhost:5439 · nex_workforce_slice1_test
// Governing doctrine: doctrine_nex_pgcrypto_extension_schema_2026_09_04.md
//                     project_nex_slice4_1_gate_sequence_2026_09_04.md
//
// This regression permanently prevents the class of defect surfaced by Gate 5A
// Real-Overpass Proving Cycle #3 (2026-09-04):
//
//   catastrophic in persist_all:
//     unclassified: error: function public.digest(text, unknown) does not exist
//
// It asserts:
//   E1. pgcrypto is installed in `extensions` (matches Supabase Project B)
//   E2. `public.digest` does NOT resolve (portable fixture matches production)
//   E3. `extensions.digest` DOES resolve
//   E4. persist_to_food_business function body calls extensions.digest(
//   E5. persist_to_food_business function body does NOT call public.digest(
//   E6. _crockford5 function body calls extensions.digest(
//   E7. _crockford5 function body does NOT call public.digest(
//   E8. evidence_id_consistency CHECK uses extensions.digest
//   E9. hardened search_path preserved on both functions (pg_catalog, pg_temp)
//   E10. SECURITY DEFINER preserved on persist_to_food_business
//   E11. Owner preserved: persist_to_food_business = nex_workforce_persister_food_business
//   E12. Executing _crockford5 succeeds (proves runtime resolution works)
//   E13. Executing persist_to_food_business path succeeds end-to-end via stage_candidates + persist_batch
//   E14. If a future writer reintroduces bare `digest(` or public.digest under
//        hardened search_path, this suite fails loudly.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import pg from "pg";

const CONN = { host: "127.0.0.1", port: 5439, user: "postgres", database: "nex_workforce_slice1_test" };

let pool;

beforeAll(async () => {
  pool = new pg.Pool({ ...CONN, max: 4 });
});

afterAll(async () => {
  if (pool) await pool.end();
});

describe("Slice 4.1 · E1-E3 · production-shape extension placement", () => {
  it("E1 · pgcrypto is installed in schema `extensions` (not public)", async () => {
    const r = await pool.query(`
      SELECT n.nspname
        FROM pg_extension e
        JOIN pg_namespace n ON n.oid = e.extnamespace
       WHERE e.extname = 'pgcrypto'
    `);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].nspname).toBe("extensions");
  });

  it("E2 · public.digest does NOT resolve (portable mirrors Supabase absence)", async () => {
    const r = await pool.query(`
      SELECT count(*)::int AS n
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = 'digest'
    `);
    expect(r.rows[0].n).toBe(0);
  });

  it("E3 · extensions.digest DOES resolve (both overloads)", async () => {
    const r = await pool.query(`
      SELECT pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'extensions' AND p.proname = 'digest'
       ORDER BY args
    `);
    expect(r.rows.length).toBe(2);
    expect(r.rows.map(x => x.args).sort()).toEqual(["bytea, text", "text, text"]);
  });
});

describe("Slice 4.1 · E4-E8 · persister-chain source uses extensions.digest", () => {
  it("E4 · persist_to_food_business body calls extensions.digest(", async () => {
    const r = await pool.query(`
      SELECT pg_get_functiondef(oid) ~ 'extensions\\.digest\\s*\\(' AS has_ext
        FROM pg_proc
       WHERE pronamespace = 'nex_workforce'::regnamespace
         AND proname = 'persist_to_food_business'
    `);
    expect(r.rows[0].has_ext).toBe(true);
  });

  it("E5 · persist_to_food_business body does NOT call public.digest(", async () => {
    const r = await pool.query(`
      SELECT pg_get_functiondef(oid) ~ 'public\\.digest\\s*\\(' AS has_pub
        FROM pg_proc
       WHERE pronamespace = 'nex_workforce'::regnamespace
         AND proname = 'persist_to_food_business'
    `);
    expect(r.rows[0].has_pub).toBe(false);
  });

  it("E6 · _crockford5 body calls extensions.digest(", async () => {
    const r = await pool.query(`
      SELECT pg_get_functiondef(oid) ~ 'extensions\\.digest\\s*\\(' AS has_ext
        FROM pg_proc
       WHERE pronamespace = 'nex_workforce'::regnamespace
         AND proname = '_crockford5'
    `);
    expect(r.rows[0].has_ext).toBe(true);
  });

  it("E7 · _crockford5 body does NOT call public.digest(", async () => {
    const r = await pool.query(`
      SELECT pg_get_functiondef(oid) ~ 'public\\.digest\\s*\\(' AS has_pub
        FROM pg_proc
       WHERE pronamespace = 'nex_workforce'::regnamespace
         AND proname = '_crockford5'
    `);
    expect(r.rows[0].has_pub).toBe(false);
  });

  it("E8 · evidence_id_consistency CHECK references extensions.digest", async () => {
    const r = await pool.query(`
      SELECT pg_get_constraintdef(oid) AS defn
        FROM pg_constraint
       WHERE conname = 'evidence_id_consistency'
         AND conrelid = 'nex_workforce.evidence_record'::regclass
    `);
    expect(r.rows[0].defn).toMatch(/extensions\.digest/);
    expect(r.rows[0].defn).not.toMatch(/public\.digest/);
  });
});

describe("Slice 4.1 · E9-E11 · security posture preserved after fix", () => {
  it("E9 · hardened search_path preserved on both functions", async () => {
    const r = await pool.query(`
      SELECT proname, proconfig
        FROM pg_proc
       WHERE pronamespace = 'nex_workforce'::regnamespace
         AND proname IN ('persist_to_food_business','_crockford5')
       ORDER BY proname
    `);
    expect(r.rows.length).toBe(2);
    for (const row of r.rows) {
      expect(row.proconfig).toBeDefined();
      expect(row.proconfig).not.toBeNull();
      const sp = row.proconfig.find(x => x.startsWith("search_path="));
      expect(sp, `${row.proname} missing search_path`).toBeDefined();
      expect(sp).toMatch(/pg_catalog/);
      expect(sp).toMatch(/pg_temp/);
      expect(sp, `${row.proname} must not widen search_path to public`).not.toMatch(/\bpublic\b/);
    }
  });

  it("E10 · SECURITY DEFINER preserved on persist_to_food_business", async () => {
    const r = await pool.query(`
      SELECT prosecdef
        FROM pg_proc
       WHERE pronamespace = 'nex_workforce'::regnamespace
         AND proname = 'persist_to_food_business'
    `);
    expect(r.rows[0].prosecdef).toBe(true);
  });

  it("E11 · persist_to_food_business owner is nex_workforce_persister_food_business", async () => {
    const r = await pool.query(`
      SELECT r.rolname
        FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
       WHERE p.pronamespace = 'nex_workforce'::regnamespace
         AND p.proname = 'persist_to_food_business'
    `);
    expect(r.rows[0].rolname).toBe("nex_workforce_persister_food_business");
  });
});

describe("Slice 4.1 · E12-E13 · runtime resolution proof", () => {
  it("E12 · _crockford5('node/12345') resolves and returns 5-char Crockford Base32", async () => {
    const r = await pool.query(`SELECT nex_workforce._crockford5('node/12345') AS out`);
    expect(r.rows[0].out).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}$/);
  });

  it("E13 · stage_candidates + persist_batch end-to-end with real extensions.digest", async () => {
    // Reset workforce state
    await pool.query("TRUNCATE nex_workforce.persist_audit");
    await pool.query("TRUNCATE nex_workforce.candidate_staging");
    await pool.query("TRUNCATE nex_workforce.evidence_record CASCADE");
    await pool.query("TRUNCATE nex_workforce.work_item_dead_letter, nex_workforce.work_item, nex_workforce.agent_heartbeat RESTART IDENTITY CASCADE");
    await pool.query("DELETE FROM nex.food_business WHERE source = 'osm_overpass' AND source_reference LIKE 'node/9999999%'");

    // Seed one pending work_item · then transition to leased through the
    // state-transition trigger by setting nex_workforce.mutation_context=claim.
    const client = await pool.connect();
    let wi;
    try {
      await client.query("BEGIN");
      const wi0 = await client.query(`
        INSERT INTO nex_workforce.work_item (
          city_slug, category_slug, source_slug, priority
        ) VALUES (
          'e13-city', 'restaurants', 'osm_overpass', 100
        )
        RETURNING id, generation
      `);
      await client.query("SET LOCAL nex_workforce.mutation_context = 'claim'");
      await client.query(`
        UPDATE nex_workforce.work_item
           SET state = 'leased',
               agent_id = 'e13-agent',
               lease_deadline = now() + interval '1 hour',
               attempts = attempts + 1,
               started_at = now()
         WHERE id = $1
      `, [wi0.rows[0].id]);
      await client.query("COMMIT");
      wi = { rows: [{ id: wi0.rows[0].id, generation: wi0.rows[0].generation }] };
    } finally {
      client.release();
    }
    const workItemId = wi.rows[0].id;
    const generation = wi.rows[0].generation;
    const naturalKey = "node/99999991";

    // Compute canonical evidence_id via extensions.digest (matches CHECK)
    const evId = (await pool.query(`
      SELECT encode(extensions.digest($1::text || '::' || $2::text || '::' || 'qh-e13' || '::' || 'rh-e13', 'sha256'), 'hex') AS ev
    `, [workItemId, generation])).rows[0].ev;

    // Stage one candidate
    const staged = await pool.query(`
      SELECT nex_workforce.stage_candidates(
        'e13-agent', $1::uuid, $2::int, $3::text,
        jsonb_build_object(
          'source_slug','osm_overpass',
          'city_slug','e13-city',
          'category_slug','restaurants',
          'query_hash','qh-e13',
          'response_sha256','rh-e13',
          'retrieved_at', now()::text,
          'http_status', 200,
          'byte_length', 1024,
          'candidate_count', 1
        ),
        jsonb_build_array(
          jsonb_build_object(
            'candidate_index', 0,
            'natural_key', $4::text,
            'payload_json', jsonb_build_object(
              'lat', -7.80, 'lon', 110.37,
              'tags', jsonb_build_object('amenity','restaurant','name','E13 Test Restaurant')
            ),
            'payload_bytes', 200
          )
        )
      ) AS ok
    `, [workItemId, generation, evId, naturalKey]);
    expect(staged.rows[0].ok).toBe(true);

    // Persist batch · must succeed WITHOUT any digest resolution error
    const batch = await pool.query(`
      SELECT * FROM nex_workforce.persist_batch(
        'e13-agent', $1::uuid, $2::int,
        'nex_workforce.persist_to_food_business(text,uuid,integer,text,timestamptz,text,text,jsonb)'::regprocedure,
        100
      )
    `, [workItemId, generation]);
    expect(batch.rows[0].fence_ok).toBe(true);
    expect(batch.rows[0].persisted_count).toBe(1);
    expect(batch.rows[0].rejected_count).toBe(0);
    expect(batch.rows[0].remaining_count).toBe(0);

    // Confirm actual food_business row exists via our natural_key
    const fb = await pool.query(`
      SELECT source, source_reference, source_evidence_id, dedupe_hash
        FROM nex.food_business
       WHERE source = 'osm_overpass' AND source_reference = $1
    `, [naturalKey]);
    expect(fb.rows.length).toBe(1);
    expect(fb.rows[0].source_evidence_id).toBe(evId);
    // dedupe_hash was computed via extensions.digest inside the persister
    expect(fb.rows[0].dedupe_hash).toMatch(/^[a-f0-9]{64}$/);

    // Clean up so downstream test-order is stable
    await pool.query(`DELETE FROM nex.food_business WHERE source = 'osm_overpass' AND source_reference = $1`, [naturalKey]);
  });
});

describe("Slice 4.1 · E14 · negative proof · unqualified digest would fail", () => {
  it("E14 · a hypothetical function calling bare digest() under hardened search_path fails loudly", async () => {
    // Create a temporary probe function that mirrors the persister's hardened
    // search_path and calls BARE digest · this is what the old (defective)
    // shape would have looked like on portable if pgcrypto were relocated.
    await pool.query(`
      CREATE OR REPLACE FUNCTION nex_workforce.__slice4_1_probe_bare_digest()
      RETURNS text
      LANGUAGE plpgsql
      SET search_path = pg_catalog, pg_temp
      AS $body$
      BEGIN
        RETURN encode(digest('anything', 'sha256'), 'hex');
      END;
      $body$
    `);
    let err = null;
    try {
      await pool.query(`SELECT nex_workforce.__slice4_1_probe_bare_digest()`);
    } catch (e) {
      err = e;
    } finally {
      await pool.query(`DROP FUNCTION IF EXISTS nex_workforce.__slice4_1_probe_bare_digest()`);
    }
    expect(err).not.toBeNull();
    expect(err.message).toMatch(/digest/);
    // Message should mention that digest doesn't exist / isn't resolvable
    expect(err.message.toLowerCase()).toMatch(/does not exist|function.*digest/);
  });

  it("E14b · a hypothetical function calling public.digest() under hardened search_path fails loudly on this portable-shape fixture", async () => {
    await pool.query(`
      CREATE OR REPLACE FUNCTION nex_workforce.__slice4_1_probe_public_digest()
      RETURNS text
      LANGUAGE plpgsql
      SET search_path = pg_catalog, pg_temp
      AS $body$
      BEGIN
        RETURN encode(public.digest('anything', 'sha256'), 'hex');
      END;
      $body$
    `);
    let err = null;
    try {
      await pool.query(`SELECT nex_workforce.__slice4_1_probe_public_digest()`);
    } catch (e) {
      err = e;
    } finally {
      await pool.query(`DROP FUNCTION IF EXISTS nex_workforce.__slice4_1_probe_public_digest()`);
    }
    expect(err).not.toBeNull();
    expect(err.message).toMatch(/public\.digest|does not exist/);
  });
});
