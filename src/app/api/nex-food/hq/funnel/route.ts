// GET /api/nex-food/hq/funnel
//
// Returns the current NEX Food acquisition-pipeline snapshot for the
// Marketing HQ dashboard. Aggregates across nex.food_business +
// food_outreach_attempt + food_outreach_suppression + food_claim_code +
// food_business_field_provenance.
//
// No auth here · this endpoint sits under /admin/(authed)/... routes on
// the page side. Public callers can inspect it but the numbers are
// non-sensitive aggregates.

import { NextResponse } from "next/server";
import { getFoodDbPool } from "@/lib/nex-food/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CLAIM_STAGES = ["discovered", "verifying", "listed", "invited", "claimed", "paying"];
const CATEGORIES = ["restaurant", "coffee-cafe", "ice-cream-dessert", "fast-food"];

export async function GET() {
  try {
    const pool = getFoodDbPool();

    // 1. Funnel counts · claim_status × category
    const funnelQ = await pool.query(`
      SELECT claim_status, category, COUNT(*)::int AS n
      FROM nex.food_business
      GROUP BY claim_status, category
    `);
    const funnelByStage: Record<string, Record<string, number>> = {};
    for (const stage of CLAIM_STAGES) {
      funnelByStage[stage] = { total: 0 };
      for (const cat of CATEGORIES) funnelByStage[stage]![cat] = 0;
    }
    for (const r of funnelQ.rows) {
      const stage = r.claim_status;
      const cat = r.category;
      if (funnelByStage[stage]) {
        funnelByStage[stage]![cat] = r.n;
        funnelByStage[stage]!.total = (funnelByStage[stage]!.total ?? 0) + r.n;
      }
    }

    // 2. Owner-status counts (independent axis from claim_status)
    const ownerQ = await pool.query(`
      SELECT owner_status, COUNT(*)::int AS n
      FROM nex.food_business
      GROUP BY owner_status
    `);
    const ownerStatusCounts: Record<string, number> = {
      unknown: 0, contacted: 0, responded: 0, verified: 0,
    };
    for (const r of ownerQ.rows) ownerStatusCounts[r.owner_status] = r.n;

    // 3. Per-city breakdown
    const cityQ = await pool.query(`
      SELECT city, COUNT(*)::int AS n
      FROM nex.food_business
      GROUP BY city
      ORDER BY n DESC
    `);

    // 4. Outreach attempts (last 30 days) by status
    const outreachQ = await pool.query(`
      SELECT status, COUNT(*)::int AS n
      FROM nex.food_outreach_attempt
      WHERE created_at > now() - interval '30 days'
      GROUP BY status
      ORDER BY n DESC
    `);

    // 5. Recent claims (last 30 days) · when claim_code was consumed
    const recentClaimsQ = await pool.query(`
      SELECT c.business_ref, c.consumed_at, b.business_name, b.category
      FROM nex.food_claim_code c
      JOIN nex.food_business b ON b.public_listing_ref = c.business_ref
      WHERE c.consumed_at IS NOT NULL AND c.consumed_at > now() - interval '30 days'
      ORDER BY c.consumed_at DESC
      LIMIT 20
    `);

    // 6. Provenance freshness · rows where every populated field is still source_import
    const provStaleQ = await pool.query(`
      SELECT COUNT(DISTINCT business_ref)::int AS n
      FROM nex.food_business_field_provenance
      WHERE trust_layer = 'source_import'
    `);
    const provAdvancedQ = await pool.query(`
      SELECT COUNT(DISTINCT business_ref)::int AS n
      FROM nex.food_business_field_provenance
      WHERE trust_layer IN ('admin_verified','owner_verified','nex_curated')
    `);

    // 7. Suppressions
    const suppressionQ = await pool.query(`
      SELECT COUNT(*)::int AS n FROM nex.food_outreach_suppression
    `);

    // 8. Snapshot volume (audit trail depth)
    const snapshotQ = await pool.query(`
      SELECT COUNT(*)::int AS n FROM nex.food_business_source_snapshot
    `);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totals: {
        businessesInDb: funnelQ.rows.reduce((s, r) => s + r.n, 0),
        snapshotsInAuditTrail: snapshotQ.rows[0].n,
        suppressions: suppressionQ.rows[0].n,
        outreachLast30d: outreachQ.rows.reduce((s, r) => s + r.n, 0),
      },
      funnel: {
        stages: CLAIM_STAGES,
        categories: CATEGORIES,
        byStage: funnelByStage,
      },
      ownerStatus: ownerStatusCounts,
      cities: cityQ.rows.map((r) => ({ city: r.city, count: r.n })),
      outreachLast30d: outreachQ.rows.map((r) => ({ status: r.status, count: r.n })),
      recentClaims: recentClaimsQ.rows.map((r) => ({
        publicListingRef: r.business_ref,
        businessName: r.business_name,
        category: r.category,
        claimedAt: r.consumed_at ? new Date(r.consumed_at).toISOString() : null,
      })),
      provenance: {
        rowsWithOnlySourceImport: provStaleQ.rows[0].n,
        rowsWithAdvancedTrust: provAdvancedQ.rows[0].n,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `funnel query failed: ${message}` }, { status: 500 });
  }
}
