// POST /api/nex/claim/request
//
// M6.2 · admin-only claim flow (Philip 2026-08-15 · Path Y).
//
// Owner submits form → row inserted into `claim_requests` audit table +
// listing lifecycle_status flipped to "claim_requested". Admin reviews the
// request in /nex-app/nex-brain/claim-review and clicks Approve / Reject,
// which invokes /api/nex/claim/admin-action.
//
// Rules preserved:
//   · Never touches directory_state = "claimed" (that's the admin-action endpoint)
//   · Never sets verified = true (reserved for claimed+ AND commercial event)
//   · Never charges anything (Stripe not yet built)
//   · Full audit trail in claim_requests table
//
// If the claim_requests table doesn't exist yet (migration 052 not applied),
// the request still succeeds and flips lifecycle_status, but the audit row
// won't be created. Admin queue then falls back to lifecycle_status='claim_requested'
// rows in directory_seeds.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  listing_id: string;    // slug OR uuid
  owner_email: string;
  owner_name?: string;
  owner_phone?: string;
  owner_role?: string;    // NEW · M6.2 · e.g. "Owner", "Director", "Marketing Manager"
  note?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  if (!body?.listing_id || !body?.owner_email || !body.owner_email.includes("@")) {
    return NextResponse.json({ ok: false, error: "listing_id + valid owner_email required" }, { status: 400 });
  }

  // Resolve listing by slug OR uuid
  const bySlug = await supabaseNexAdmin.from("directory_seeds").select("id, slug, business_name, lifecycle_status, directory_state").eq("slug", body.listing_id).maybeSingle();
  const listing = bySlug.data ?? (await supabaseNexAdmin.from("directory_seeds").select("id, slug, business_name, lifecycle_status, directory_state").eq("id", body.listing_id).maybeSingle()).data;
  if (!listing) return NextResponse.json({ ok: false, error: "listing_not_found" }, { status: 404 });

  // Guard · don't accept claim requests for already-claimed / member listings
  if (listing.directory_state === "claimed" || listing.directory_state === "paid_member") {
    return NextResponse.json({ ok: false, error: "listing_already_claimed" }, { status: 409 });
  }

  // Write claim_requests audit row (best-effort · falls back gracefully if table missing)
  let claimRequestId: string | null = null;
  const claimInsert = await supabaseNexAdmin
    .from("claim_requests")
    .insert({
      listing_id: listing.id,
      company_name_snapshot: listing.business_name,
      claimant_name: body.owner_name ?? null,
      claimant_email: body.owner_email,
      claimant_role: body.owner_role ?? null,
      reason: body.note ?? null,
      status: "pending",
    })
    .select("id")
    .maybeSingle();

  if (claimInsert.error) {
    // Table might not exist yet (migration 052 not applied) or another schema issue.
    // Log loudly · do NOT block the claim · fall back to server-log audit.
    console.warn("[claim.request] claim_requests insert failed · falling back to server-log:", claimInsert.error.message);
    console.info("[claim.request:fallback]", {
      listing_id: listing.id, slug: listing.slug, business_name: listing.business_name,
      owner_email: body.owner_email, owner_name: body.owner_name ?? null,
      owner_phone: body.owner_phone ?? null, owner_role: body.owner_role ?? null,
      note: body.note ?? null, at: new Date().toISOString(),
    });
  } else {
    claimRequestId = claimInsert.data?.id ?? null;
  }

  // Move lifecycle forward but never past claim_requested — the admin-action
  // endpoint owns the transitions to claimed. Payment (paid_member) is Stripe's
  // job when M6.3 lands.
  const update = await supabaseNexAdmin
    .from("directory_seeds")
    .update({ lifecycle_status: "claim_requested" })
    .eq("id", listing.id);
  if (update.error) return NextResponse.json({ ok: false, error: update.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    listing_id: listing.id,
    slug: listing.slug,
    lifecycle_status: "claim_requested",
    claim_request_id: claimRequestId,
  });
}
