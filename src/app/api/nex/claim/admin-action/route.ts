// POST /api/nex/claim/admin-action
//
// M6.2 · admin approve / reject / cancel action for claim_requests.
// (Philip 2026-08-15 · Path Y admin-only launch flow.)
//
// Body: { claim_request_id, action: 'approve'|'reject'|'cancel', admin_note?, reviewed_by? }
//
// Behaviour by action:
//   approve → claim_requests.status = 'approved'
//             directory_seeds.lifecycle_status = 'claimed'
//             directory_seeds.directory_state  = 'claimed'
//             directory_seeds.claimed         = true
//             directory_seeds.verified stays FALSE (reserved for commercial event)
//   reject  → claim_requests.status = 'rejected'
//             directory_seeds.lifecycle_status back to 'unclaimed'
//             (never touches directory_state)
//   cancel  → claim_requests.status = 'cancelled'
//             directory_seeds.lifecycle_status back to 'unclaimed'
//             (used when the claimant themselves withdraws)
//
// Rules preserved:
//   · Never sets verified = true (that's a commercial-event trigger not here)
//   · Never sets directory_state = paid_member (Stripe · M6.3 · not built)
//   · Never touches any other listing than the one attached to this request
//   · Full audit trail: reviewed_at + reviewed_by + admin_note captured
//
// This endpoint is admin-only. In dev/local it currently accepts any request
// (the /nex-app/nex-brain surface is already admin-gated elsewhere). Wire up
// real isAdminAuthed() as part of M6.5.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabaseNexAdmin } from "@/lib/supabaseNexAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "approve" | "reject" | "cancel";
type Body = {
  claim_request_id: string;
  action: Action;
  admin_note?: string;
  reviewed_by?: string;
};

export async function POST(req: NextRequest) {
  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  if (!body?.claim_request_id) return NextResponse.json({ ok: false, error: "claim_request_id required" }, { status: 400 });
  if (!["approve", "reject", "cancel"].includes(body.action)) return NextResponse.json({ ok: false, error: "action must be approve|reject|cancel" }, { status: 400 });

  // Load the claim request
  const claim = await supabaseNexAdmin
    .from("claim_requests")
    .select("id, listing_id, company_name_snapshot, status")
    .eq("id", body.claim_request_id)
    .maybeSingle();
  if (claim.error) return NextResponse.json({ ok: false, error: claim.error.message }, { status: 500 });
  if (!claim.data) return NextResponse.json({ ok: false, error: "claim_request_not_found" }, { status: 404 });
  if (claim.data.status !== "pending") return NextResponse.json({ ok: false, error: `claim already ${claim.data.status}` }, { status: 409 });

  const newStatus = body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : "cancelled";

  // 1. Update the claim_requests row · audit trail
  const claimUpd = await supabaseNexAdmin
    .from("claim_requests")
    .update({
      status: newStatus,
      reviewed_at: new Date().toISOString(),
      reviewed_by: body.reviewed_by ?? "admin",
      admin_note: body.admin_note ?? null,
    })
    .eq("id", body.claim_request_id);
  if (claimUpd.error) return NextResponse.json({ ok: false, error: claimUpd.error.message }, { status: 500 });

  // 2. Update the linked directory_seeds row based on action
  if (!claim.data.listing_id) {
    return NextResponse.json({ ok: true, warning: "claim_request had no listing_id · directory_seeds not touched", new_status: newStatus });
  }

  let seedUpdate: Record<string, unknown>;
  if (body.action === "approve") {
    // APPROVE · claim goes through
    seedUpdate = {
      lifecycle_status: "claimed",
      directory_state: "claimed",
      claimed: true,
      // verified stays whatever it already was · never auto-set here
    };
  } else {
    // REJECT or CANCEL · roll back to unclaimed
    seedUpdate = {
      lifecycle_status: "unclaimed",
      // directory_state stays whatever it was (should be 'listed' since we blocked
      // claim requests on already-claimed listings in /request)
    };
  }

  const seedUpd = await supabaseNexAdmin
    .from("directory_seeds")
    .update(seedUpdate)
    .eq("id", claim.data.listing_id);
  if (seedUpd.error) return NextResponse.json({ ok: false, error: seedUpd.error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    claim_request_id: body.claim_request_id,
    listing_id: claim.data.listing_id,
    business_name: claim.data.company_name_snapshot,
    new_status: newStatus,
    action: body.action,
  });
}
