// scripts/nex-canonical/_accommodation-publication-dry-run.mjs
//
// NEX Directory · Accommodation Clearance Prep · F3 wave · 2026-10-10.
//
// READ-ONLY SIMULATION of the sealed publication gate for the
// accommodation source. Answers the operator's question:
//
//     "If I were to flip can_display=TRUE on
//      nex_accommodation_business_legacy right now, how many
//      canonicals would become visible in business_directory_v?"
//
// This script does NOT:
//   · UPDATE nex.source_registry
//   · UPDATE any business_canonical row
//   · INSERT / DELETE evidence or media rows
//   · Flip can_display on anything
//   · Promote any canonical to VERIFIED
//
// MECHANISM
//   The sealed `nex.business_directory_v` (migrations 175 + 181)
//   enforces (D-1) publishable lifecycle set, (D-2) chain-resolved
//   source.can_display=TRUE, and (D-5) attribution_template present
//   when attribution_required=TRUE.
//
//   To answer the "if flipped" question WITHOUT flipping, we run a
//   SELECT query that reproduces the exact D-1 / D-2 / D-5 predicates
//   but substitutes:
//     (a) source.can_display → TRUE for the accommodation source only
//     (b) source.attribution_template → the proposed template string
//         (osm_odbl_v1.display_short from migration 192's catalog)
//
//   Everything else (D-1 lifecycle gate, supersession guard, D-2
//   chain-walk for the EXISTS predicate, D-5 attribution-present
//   check) uses the real schema and the real row data. This is why
//   the number this script reports is the SAME number the sealed view
//   would return 60 seconds after a real `UPDATE ... SET can_display
//   = TRUE, attribution_template = '...'`.
//
// SIMULATED ATTRIBUTION TEMPLATE
//   We substitute `osm_odbl_v1.display_short` so the attribution-
//   present D-5 check does not false-fail the dry-run. The template
//   is intentionally pulled from the migration-192 catalog where it
//   lives as `simulated = TRUE` · so a reader can trace the exact
//   string back to the catalog and understand it is NOT yet legally
//   approved for production.
//
// USAGE
//   node --env-file=.env.local \
//     scripts/nex-canonical/_accommodation-publication-dry-run.mjs
//
// EXIT
//   0 · dry-run completed · report emitted
//   1 · identity check failed · aborted before any read
//   2 · attribution_template missing in migration-192 catalog
//   3 · dry-run failed (unexpected SQL error)

import pg from "pg";

const SOURCE_ID = "nex_accommodation_business_legacy";
const SIMULATED_TEMPLATE_ID = "osm_odbl_v1";

function log(msg) {
  // eslint-disable-next-line no-console
  console.log(`[publish-dry-run] ${msg}`);
}

function warn(msg) {
  // eslint-disable-next-line no-console
  console.warn(`[publish-dry-run] WARN · ${msg}`);
}

function fail(msg) {
  // eslint-disable-next-line no-console
  console.error(`[publish-dry-run] FAIL · ${msg}`);
}

async function main() {
  const url = process.env.NEX_POSTGRES_URL;
  if (!url) {
    fail("NEX_POSTGRES_URL is not set");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  // Session identity gate.
  const idRes = await client.query(
    "SELECT current_database() AS db, current_user AS usr",
  );
  const db = idRes.rows[0].db;
  const usr = idRes.rows[0].usr;
  log(`session identity · db=${db} · user=${usr}`);
  if (db !== "nex_dev") {
    fail(`expected db='nex_dev' got='${db}' · aborting`);
    await client.end();
    process.exit(1);
  }

  // Belt-and-braces · force the transaction read-only. The sealed
  // publication gate is a VIEW and the script issues no UPDATEs, but
  // this is a defence-in-depth hedge in case anything downstream
  // ever tries to write.
  await client.query("BEGIN");
  await client.query("SET LOCAL default_transaction_read_only = on");

  try {
    // ================================================================
    // STEP 1 · verify the migration-192 catalog has the simulated
    // template that this dry-run will cite.
    // ================================================================
    const tplRes = await client.query(
      `SELECT template_id, display_short, simulated
         FROM nex.attribution_template
        WHERE template_id = $1`,
      [SIMULATED_TEMPLATE_ID],
    );
    if (tplRes.rows.length === 0) {
      fail(
        `attribution_template '${SIMULATED_TEMPLATE_ID}' MISSING in catalog · apply migration 192 first`,
      );
      await client.query("ROLLBACK");
      await client.end();
      process.exit(2);
    }
    const tpl = tplRes.rows[0];
    log(
      `catalog has template_id='${tpl.template_id}' · display_short='${tpl.display_short}' · simulated=${tpl.simulated}`,
    );
    if (tpl.simulated === false) {
      log(
        `NOTE · template simulated=false (operator has promoted this template)`,
      );
    }

    // ================================================================
    // STEP 2 · snapshot the current (REAL) publication state.
    // ================================================================
    const realVCount = await client.query(
      `SELECT COUNT(*)::int AS n FROM nex.business_directory_v`,
    );
    log(
      `REAL · business_directory_v row count (before any hypothetical flip): ${realVCount.rows[0].n}`,
    );

    const regRes = await client.query(
      `SELECT source_id, can_display, attribution_required, attribution_template
         FROM nex.source_registry
        WHERE source_id = $1`,
      [SOURCE_ID],
    );
    if (regRes.rows.length === 0) {
      fail(`source_registry row '${SOURCE_ID}' MISSING · apply migration 185 first`);
      await client.query("ROLLBACK");
      await client.end();
      process.exit(2);
    }
    const reg = regRes.rows[0];
    log(
      `REAL · source '${SOURCE_ID}' · can_display=${reg.can_display} · attribution_required=${reg.attribution_required} · attribution_template=${reg.attribution_template === null ? "NULL" : `'${reg.attribution_template}'`}`,
    );

    // ================================================================
    // STEP 3 · the sealed view hypothetical · how many canonicals
    // WOULD appear in business_directory_v if the accommodation source
    // had can_display=TRUE AND attribution_template = <proposed>?
    //
    // The query below reproduces the sealed D-1, supersession, D-2
    // chain-resolved can_display, and D-5 attribution-present
    // predicates EXACTLY as in migration 181 · but substitutes the
    // can_display + attribution_template columns of this one source
    // row with the hypothetical values via COALESCE on a UNION ALL
    // overlay.
    //
    // Mechanically: we build a CTE `sim_registry` that returns the
    // row from source_registry with can_display forced TRUE and
    // attribution_template forced to the catalog's display_short
    // ONLY for source_id = SOURCE_ID. All other rows pass through
    // unchanged. The sealed view predicates are then re-authored to
    // JOIN against sim_registry instead of nex.source_registry.
    // Zero mutation.
    // ================================================================
    const simQuery = `
      WITH sim_registry AS (
        SELECT
          sr.source_id,
          sr.source_type,
          CASE WHEN sr.source_id = $1 THEN TRUE ELSE sr.can_display END AS can_display,
          sr.can_derive,
          sr.can_redistribute,
          sr.attribution_required,
          CASE
            WHEN sr.source_id = $1 THEN $2
            ELSE sr.attribution_template
          END AS attribution_template,
          sr.derived_from_source_id
        FROM nex.source_registry sr
      )
      SELECT
        bc.canonical_business_id,
        bc.name_canonical,
        bc.entity_type,
        bc.city,
        bc.lifecycle_state
      FROM nex.business_canonical bc
      WHERE
        -- D-1 · publishable lifecycle set L1 (sealed migration 175)
        bc.lifecycle_state IN ('VERIFIED', 'OWNER_CLAIMED', 'OWNER_VERIFIED')
        -- Supersession guard
        AND bc.superseded_by_business_id IS NULL
        -- D-2 · chain-resolved can_display=TRUE on some evidence
        AND EXISTS (
          SELECT 1
          FROM nex.business_evidence be
          JOIN sim_registry sr_direct
            ON sr_direct.source_id = be.source_id
          JOIN sim_registry sr_origin
            ON sr_origin.source_id = COALESCE(
                 sr_direct.derived_from_source_id,
                 be.source_id
               )
          WHERE be.canonical_business_id = bc.canonical_business_id
            AND sr_origin.can_display = TRUE
        )
        -- D-5 · attribution-template present when required (one-hop)
        AND NOT EXISTS (
          SELECT 1
          FROM nex.business_evidence be
          JOIN sim_registry sr_direct
            ON sr_direct.source_id = be.source_id
          JOIN sim_registry sr_origin
            ON sr_origin.source_id = COALESCE(
                 sr_direct.derived_from_source_id,
                 be.source_id
               )
          WHERE be.canonical_business_id = bc.canonical_business_id
            AND sr_origin.attribution_required = TRUE
            AND (
              sr_origin.attribution_template IS NULL
              OR length(trim(sr_origin.attribution_template)) = 0
            )
        )
        -- Scope to accommodation entity types (hotel, guesthouse,
        -- hostel, resort, villa, etc.). The sealed adapter does not
        -- carry a fixed entity_type list; we probe the current
        -- business_canonical for any entity_type that evidences the
        -- accommodation source. Rows cited from accommodation only
        -- are counted.
        AND EXISTS (
          SELECT 1
          FROM nex.business_evidence be2
          WHERE be2.canonical_business_id = bc.canonical_business_id
            AND be2.source_id = $1
        );
    `;
    const simRes = await client.query(simQuery, [
      SOURCE_ID,
      tpl.display_short,
    ]);
    const totalEligible = simRes.rows.length;
    log(
      `SIM · eligible accommodation canonicals IF can_display were flipped NOW: ${totalEligible}`,
    );

    if (totalEligible === 0) {
      log(
        `SIM · zero eligible rows · expected during F3 wave since F3 only runs discovery-only ingestion (candidates stay in pending-review queue, do not become canonicals). The ingestion → review → promotion pipeline populates business_canonical downstream, not F3.`,
      );
    } else {
      // Breakdowns.
      const byLifecycle = new Map();
      const byCity = new Map();
      for (const row of simRes.rows) {
        byLifecycle.set(
          row.lifecycle_state,
          (byLifecycle.get(row.lifecycle_state) ?? 0) + 1,
        );
        const city = row.city ?? "(null)";
        byCity.set(city, (byCity.get(city) ?? 0) + 1);
      }
      log(`SIM · breakdown by lifecycle_state:`);
      for (const [k, v] of [...byLifecycle.entries()].sort((a, b) => b[1] - a[1])) {
        log(`SIM ·   ${k}: ${v}`);
      }
      log(`SIM · breakdown by city (top 10):`);
      const cityTop10 = [...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      for (const [k, v] of cityTop10) {
        log(`SIM ·   ${k}: ${v}`);
      }
      log(`SIM · sample names (first 10):`);
      for (const row of simRes.rows.slice(0, 10)) {
        log(`SIM ·   ${row.canonical_business_id} · ${row.name_canonical} · ${row.city ?? "(null)"}`);
      }
    }

    // ================================================================
    // STEP 4 · attribution validation · do any evidence rows citing
    // this source reference a template_id that is NOT present in the
    // migration-192 catalog? (For a FAIL marker · operator must fix
    // before activation.)
    // ================================================================
    // Current schema does NOT carry a template_id FK from business_
    // evidence into the catalog. The migration-192 catalog is a
    // staging surface; the sealed source_registry.attribution_template
    // is the enforced string. A FAIL marker here means: the proposed
    // template for the source is not present in the catalog.
    const sourceHasEvidence = await client.query(
      `SELECT COUNT(*)::int AS n FROM nex.business_evidence WHERE source_id = $1`,
      [SOURCE_ID],
    );
    const evidenceCount = sourceHasEvidence.rows[0].n;
    log(
      `evidence rows citing '${SOURCE_ID}' (any lifecycle): ${evidenceCount}`,
    );
    if (evidenceCount > 0 && !tpl) {
      fail(
        `${evidenceCount} evidence row(s) cite '${SOURCE_ID}' but no attribution_template is in the migration-192 catalog · operator must fix before activation`,
      );
      await client.query("ROLLBACK");
      await client.end();
      process.exit(2);
    }
    if (evidenceCount === 0) {
      warn(
        `zero evidence rows cite '${SOURCE_ID}' yet · F3 ingestion emits candidates to pending-review but promotion to business_canonical + business_evidence requires founder approval. The eligible-count projection scales once candidates are promoted.`,
      );
    }

    // ================================================================
    // STEP 5 · 9,230-row ceiling · the legacy table has 9,230 rows.
    // If every row were promoted + VERIFIED + the source were flipped,
    // the hypothetical eligible count would asymptote to 9,230. This
    // is the ceiling the operator should expect over time.
    // ================================================================
    const legacyCount = await client.query(
      `SELECT COUNT(*)::int AS n FROM nex.accommodation_business WHERE country = 'ID'`,
    );
    log(
      `legacy table · nex.accommodation_business · country='ID' · row count: ${legacyCount.rows[0].n} (publication ceiling IF every row is promoted + source flipped)`,
    );

    // ================================================================
    // STEP 6 · summary report
    // ================================================================
    log("");
    log("=== dry-run summary ===");
    log(
      JSON.stringify(
        {
          source_id: SOURCE_ID,
          simulated_template_id: tpl.template_id,
          simulated_display_short: tpl.display_short,
          template_simulated_flag: tpl.simulated,
          business_directory_v_count_real: realVCount.rows[0].n,
          eligible_accommodation_IF_flipped_now: totalEligible,
          legacy_table_ceiling: legacyCount.rows[0].n,
          evidence_rows_citing_source_now: evidenceCount,
          attribution_template_in_catalog: true,
          would_flip_can_display: false,
          would_write_to_source_registry: false,
          would_promote_any_canonical: false,
        },
        null,
        2,
      ),
    );

    // Commit the empty transaction (nothing written). Explicit so the
    // read-only session releases cleanly.
    await client.query("COMMIT");
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    fail(err instanceof Error ? err.message : String(err));
    await client.end();
    process.exit(3);
  }

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(
    `[publish-dry-run] UNEXPECTED · ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
