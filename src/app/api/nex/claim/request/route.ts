// POST /api/nex/claim/request
//
// Lightweight interim claim endpoint. Records that the business owner has
// requested to claim their listing so an admin can verify + attach later.
//
// This is NOT the full self-service claim workflow — that requires owner
// email verification + merchant account creation + attach-to-existing-seed
// per ADR-0023. Until that ships, this endpoint just flips
// `lifecycle_status` from "unclaimed" → "claim_requested" and stores the
// requester's contact so a NEX admin can follow up manually.
//
// Never flips `directory_state = "claimed"` — that is a separate commercial
// event only the full verification flow can trigger (per Philip's rule that
// promotion is a commercial event never a derivation).

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
  const bySlug = await supabaseNexAdmin.from("directory_seeds").select("id, slug, business_name, lifecycle_status").eq("slug", body.listing_id).maybeSingle();
  const listing = bySlug.data ?? (await supabaseNexAdmin.from("directory_seeds").select("id, slug, business_name, lifecycle_status").eq("id", body.listing_id).maybeSingle()).data;
  if (!listing) return NextResponse.json({ ok: false, error: "listing_not_found" }, { status: 404 });

  // Move lifecycle forward but never past claim_requested — the shared verification
  // flow owns the transitions to claim_pending / claimed / paid_member.
  const update = await supabaseNexAdmin
    .from("directory_seeds")
    .update({ lifecycle_status: "claim_requested" })
    .eq("id", listing.id);
  if (update.error) return NextResponse.json({ ok: false, error: update.error.message }, { status: 500 });

  // In future: append to a `claim_requests` audit table with owner_email/name/phone/note.
  // For now, log server-side so an admin can grep it out until the audit table exists.
  console.info("[claim.request]", {
    listing_id: listing.id, slug: listing.slug, business_name: listing.business_name,
    owner_email: body.owner_email, owner_name: body.owner_name ?? null,
    owner_phone: body.owner_phone ?? null, note: body.note ?? null,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, listing_id: listing.id, slug: listing.slug, lifecycle_status: "claim_requested" });
}
