// POST /api/nex-food/admin/promote-to-directory
//
// Admin-only. Promotes a discovered business into the public Food Directory
// by moving claim_status='discovered' → 'listed'. This is the "PROMOTE TO
// DIRECTORY" action Philip specified.
//
// Doctrine anchors:
//   · project_nex_food_flywheel_over_scraping_2026_08_21
//     (Discovery ≠ Commercial · admin promotion is the controlled transition)
//   · Philip 2026-08-21 verbatim: "Walker should not directly publish businesses
//     to the public directory. That would break the discipline Claude has
//     already built."
//
// Rules enforced:
//   · Only claim_status='discovered' → 'listed' (never claim_status manipulation
//     of other states · owner claim (Layer 3) handles the discovered→claimed path)
//   · owner_verified provenance rows NEVER touched (admin promotion is NOT owner
//     verification · fields stay at their existing trust layer)
//   · Every promotion writes to nex.audit_log with before/after state + actor
//   · Idempotent (calling twice on same ref = no-op after first)
//   · No fabrication (no field values set by promotion · only claim_status)

import { NextResponse } from "next/server";
import { getFoodDbPool } from "@/lib/nex-food/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function bad(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}

interface PromoteBody {
  publicListingRef?: string;
  actor?: string;   // optional · defaults to 'admin:promote-to-directory'
  notes?: string;   // optional · reason from admin
}

const REF_PATTERN = /^#FL-\d{4}-[A-HJ-KM-NP-TV-Z0-9]{5}$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as PromoteBody | null;
  if (!body) return bad(400, "Malformed JSON body");
  const ref = body.publicListingRef?.trim();
  if (!ref) return bad(400, "publicListingRef required");
  if (!REF_PATTERN.test(ref)) return bad(400, "invalid publicListingRef format");
  const actor = body.actor?.trim() || "admin:promote-to-directory";

  const pool = getFoodDbPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Load current row for pre-check + audit before_state
    const before = await client.query(
      `SELECT public_listing_ref, business_name, claim_status, owner_status,
              whatsapp_number, phone, website, source, source_reference
       FROM nex.food_business
       WHERE public_listing_ref = $1
       FOR UPDATE`,
      [ref]
    );
    if (before.rowCount === 0) {
      await client.query("ROLLBACK");
      return bad(404, `no business at ${ref}`);
    }
    const b = before.rows[0];

    // Idempotent: if already listed/invited/claimed/paying, no-op
    if (b.claim_status !== "discovered") {
      await client.query("ROLLBACK");
      return NextResponse.json({
        ok: true,
        publicListingRef: ref,
        alreadyPromoted: true,
        currentClaimStatus: b.claim_status,
      });
    }

    // Perform promotion · only claim_status changes · owner_status untouched ·
    // no field values set (no fabrication)
    const after = await client.query(
      `UPDATE nex.food_business
       SET claim_status = 'listed'
       WHERE public_listing_ref = $1
       RETURNING claim_status, owner_status`,
      [ref]
    );

    // Audit trail · append to existing nex.audit_log
    await client.query(
      `INSERT INTO nex.audit_log
         (entity_type, entity_id, action, actor, before_state, after_state, notes)
       VALUES ('food_business', $1, 'promote_to_directory', $2, $3::jsonb, $4::jsonb, $5)`,
      [
        ref,
        actor,
        JSON.stringify({
          claim_status: b.claim_status,
          owner_status: b.owner_status,
          has_whatsapp: Boolean(b.whatsapp_number),
          has_phone: Boolean(b.phone),
          source: b.source,
        }),
        JSON.stringify({
          claim_status: after.rows[0].claim_status,
          owner_status: after.rows[0].owner_status,
        }),
        body.notes ?? null,
      ]
    );

    await client.query("COMMIT");
    return NextResponse.json({
      ok: true,
      publicListingRef: ref,
      businessName: b.business_name,
      previousClaimStatus: b.claim_status,
      newClaimStatus: after.rows[0].claim_status,
      ownerStatusPreserved: after.rows[0].owner_status,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/nex-food/admin/promote-to-directory] internal error:", err);
    return bad(500, `promote failed: ${message}`);
  } finally {
    client.release();
  }
}
