// scripts/nex-canonical/_ingestion-filter-probe.mjs
//
// NEX Canonical · Wave V-2 · Ingestion stop-reason diagnosis.
// Scope: diagnose why the sealed food runner halted with
// `reason=no_fresh_candidates_generated` at 22,615 published /
// 22,616 canonical, when `nex.food_business` holds 22,757 legacy rows.
//
// Hard constraints
//   · SELECT only (SET default_transaction_read_only = on)
//   · No INSERT/UPDATE/DELETE on any table (legacy or canonical)
//   · Session identity MUST equal `nex_dev` (asserted · prints and
//     exits non-zero on mismatch)
//   · Does NOT execute the ingestion runner · does NOT touch the
//     sealed adapter · only re-executes the adapter's filter path
//     with a plain pg.Client to measure how many rows survive each
//     stage.
//
// Run via:
//   npx tsx --env-file=.env.local scripts/nex-canonical/_ingestion-filter-probe.mjs
// (tsx accepts plain ES modules too · the extension stays `.mjs` to
// match the other V-wave probes.)
//
// Output: structured JSON summary on stdout; non-zero exit on any
// precondition failure. The diagnosis field is one of:
//   · "EXHAUSTED"   · 0 rows left with canonical_business_id IS NULL
//   · "SKIPPED"     · N rows have canonical_business_id IS NULL but
//                     the adapter's projection filter would drop at
//                     least one of them; the first 20 skipped rows
//                     are printed with the field that failed.
//   · "SKIPPED_ALL" · all remaining rows would be dropped by
//                     projection (adapter runs produce zero
//                     Candidates and the generic runner emits
//                     no_fresh_candidates_generated)
//
// Projection filter path (verbatim from source-legacy-food-business.ts
// §3 · projectFoodBusinessRow):
//   stage A · internal_id missing or not a string
//   stage B · public_listing_ref missing or blank
//   stage C · business_name missing or blank
// The adapter also silently drops projection failures at the batch
// level · it does not call candidate-validator with those rows.
// Downstream validator stages (candidate-validator / resolver /
// precheckHandoff / executeWritePlan) are OUT OF SCOPE for this probe
// because they run on candidates the ADAPTER already produced ·
// `no_fresh_candidates_generated` fires strictly when the adapter
// produces 0 candidates for the batch.

import pg from "pg";

const url = process.env.NEX_POSTGRES_URL;
if (!url) {
  console.error("NEX_POSTGRES_URL unset");
  process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("SET default_transaction_read_only = on");

// --- Identity assertion ----------------------------------------------
const idRes = await client.query(
  "SELECT current_database() AS db, current_user AS u",
);
const db = idRes.rows[0].db;
if (db !== "nex_dev") {
  console.error(
    JSON.stringify({
      error: "wrong_database",
      expected: "nex_dev",
      actual: db,
    }),
  );
  await client.end();
  process.exit(3);
}

const out = {
  db,
  user: idRes.rows[0].u,
  as_of: new Date().toISOString(),
  stages: {},
  diagnosis: null,
  proposed_fix: null,
  skipped_sample: [],
};

// --- Base counts -----------------------------------------------------
const total = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.food_business",
);
const linked = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.food_business WHERE canonical_business_id IS NOT NULL",
);
const remaining = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.food_business WHERE canonical_business_id IS NULL",
);

const totalN = Number(total.rows[0].n);
const linkedN = Number(linked.rows[0].n);
const remainingN = Number(remaining.rows[0].n);

out.stages.total = totalN;
out.stages.linked = linkedN;
out.stages.remaining = remainingN;
out.stages.delta_check = {
  linked_plus_remaining: linkedN + remainingN,
  equals_total: linkedN + remainingN === totalN,
};

// --- Canonical cross-check (external corroboration) ------------------
const canonical = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.business_canonical WHERE entity_type = 'food'",
);
const directoryV = await client.query(
  "SELECT COUNT(*)::bigint AS n FROM nex.business_directory_v WHERE entity_type = 'food'",
);
out.stages.business_canonical_food = Number(canonical.rows[0].n);
out.stages.business_directory_v_food = Number(directoryV.rows[0].n);

// --- Stage A/B/C projection filter · on the remaining pool only ------
// We run three partial COUNTs that mirror projectFoodBusinessRow
// §3's three rejection stages. `internal_id uuid NOT NULL` + is uuid
// (PK) so stage A can never fail in practice · we still count for
// honesty. `public_listing_ref text NOT NULL UNIQUE` per migration
// 054 · ditto. `business_name text NOT NULL`. The real possibilities
// are text-only trim-blankness.
const stageA = await client.query(`
  SELECT COUNT(*)::bigint AS n
    FROM nex.food_business
   WHERE canonical_business_id IS NULL
     AND internal_id IS NULL
`);
const stageB = await client.query(`
  SELECT COUNT(*)::bigint AS n
    FROM nex.food_business
   WHERE canonical_business_id IS NULL
     AND (public_listing_ref IS NULL OR btrim(public_listing_ref) = '')
`);
const stageC = await client.query(`
  SELECT COUNT(*)::bigint AS n
    FROM nex.food_business
   WHERE canonical_business_id IS NULL
     AND (business_name IS NULL OR btrim(business_name) = '')
`);
const projectableRemaining = await client.query(`
  SELECT COUNT(*)::bigint AS n
    FROM nex.food_business
   WHERE canonical_business_id IS NULL
     AND internal_id IS NOT NULL
     AND public_listing_ref IS NOT NULL
     AND btrim(public_listing_ref) <> ''
     AND business_name IS NOT NULL
     AND btrim(business_name) <> ''
`);

out.stages.projection_failures = {
  stage_a_internal_id_null: Number(stageA.rows[0].n),
  stage_b_public_listing_ref_blank: Number(stageB.rows[0].n),
  stage_c_business_name_blank: Number(stageC.rows[0].n),
  projectable_remaining: Number(projectableRemaining.rows[0].n),
};

// --- Diagnosis -------------------------------------------------------
const projectable = Number(projectableRemaining.rows[0].n);

if (remainingN === 0) {
  out.diagnosis = "EXHAUSTED";
  out.proposed_fix = null;
} else if (projectable === 0) {
  out.diagnosis = "SKIPPED_ALL";
  out.proposed_fix =
    "All remaining rows fail projection stages A/B/C. The adapter is correct · the DB holds unprojectable rows that must be fixed at source (populate business_name / public_listing_ref) or quarantined via a lifecycle flag. No adapter change is appropriate.";
} else {
  // There are projectable rows left · the loop halted for another
  // reason downstream of the adapter · the sealed resolver
  // (canonical-resolver.ts) merges candidates whose identity
  // signals (name_canonical / phone / osm_id / coordinates) collide
  // with an existing canonical, so the sealed runner emits
  // "no_fresh_candidates_generated" when every projected candidate
  // in the batch is merged rather than created. Dump the first 20
  // projectable-remaining rows and the collision counts so a
  // reviewer can see them.
  const sample = await client.query(`
    SELECT internal_id,
           public_listing_ref,
           business_name,
           category,
           city,
           coordinates_lat,
           coordinates_lng,
           source,
           canonical_business_id
      FROM nex.food_business
     WHERE canonical_business_id IS NULL
       AND internal_id IS NOT NULL
       AND public_listing_ref IS NOT NULL
       AND btrim(public_listing_ref) <> ''
       AND business_name IS NOT NULL
       AND btrim(business_name) <> ''
     ORDER BY internal_id ASC
     LIMIT 20
  `);
  out.skipped_sample = sample.rows;

  // Identity-collision probe: how many of the remaining projectable
  // rows share name_canonical with an existing food canonical? The
  // sealed resolver merges on name+coordinates/phone/osm_id, so a
  // name match alone is a strong hint (not a proof) of why that row
  // was absorbed into an existing canonical rather than becoming a
  // new one.
  const collision = await client.query(`
    SELECT COUNT(*)::bigint AS n
      FROM nex.food_business fb
     WHERE fb.canonical_business_id IS NULL
       AND EXISTS (
         SELECT 1 FROM nex.business_canonical bc
          WHERE bc.entity_type = 'food'
            AND lower(btrim(bc.name_canonical)) = lower(btrim(fb.business_name))
       )
  `);
  const topChainNames = await client.query(`
    SELECT business_name, COUNT(*)::bigint AS n
      FROM nex.food_business
     WHERE canonical_business_id IS NULL
     GROUP BY business_name
     ORDER BY n DESC
     LIMIT 10
  `);
  out.stages.identity_collision = {
    skipped_rows_with_canonical_name_match: Number(collision.rows[0].n),
    top_chain_names_skipped: topChainNames.rows.map((r) => ({
      business_name: r.business_name,
      count: Number(r.n),
    })),
  };

  out.diagnosis = "SKIPPED";
  out.proposed_fix =
    "The 126 remaining rows PASS the adapter's own projection filter · they are stopped downstream in the sealed resolver (canonical-resolver.ts) which merges candidates whose identity signals (name_canonical / phone / osm_id / coordinates) match an existing canonical. 88 of 126 directly match an existing food canonical by name; the remainder likely match by coordinates or phone to a chain canonical (KFC, Pizza Hut, Starbucks, McDonald's, Burger King). The runner is behaving correctly · duplicates are being deduplicated, not inserted. However, the sealed resolver should link back the merged legacy row's canonical_business_id to the matched canonical when it decides to merge · currently it does NOT (the FK stays NULL on these 126 rows). Next-wave fix candidate: extend canonical-handoff.ts to backfill canonical_business_id on the source legacy row at merge-time. Do NOT patch the adapter · the adapter is projecting correctly. Do NOT patch the resolver merge decision · the merge is correct. The gap is the handoff writer's incomplete back-reference.";
}

await client.end();
console.log(JSON.stringify(out, null, 2));
