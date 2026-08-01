// Admin API · record a supplier response against an enquiry.
//
// POST /api/admin/nex/supplier-response
// Body: {
//   enquiry_id:       string      (NEX-ENQUIRY-…)
//   supplier_id:      string      (NEX-SUPPLIER-…)
//   response_type:    "accepted" | "declined" | "quoted" | "completed" | "no_response"
//   response_time_hours?: number  (optional · computed from delivered_at if absent)
//   decline_reason?:  string      (optional · internal only)
//   outcome?:         "quoted" | "booked" | "completed" | "cancelled"
//   admin_notes?:     string      (internal only · never surfaced to customer)
// }
//
// Auth: reuses the existing /admin/* session gate (isAdminAuthed).
// Provenance: source_of_signal is forced to 'admin_recorded_response' server-side.
// The client cannot set it. Philip 2026-08-02 rule: only real recorded events
// can influence matching · AI inference is explicitly banned by the schema.
//
// Side effects (idempotent-safe):
//   - inserts row into nex_supplier_responses
//   - updates the enquiry's responded_at + status='responded' on first response
//   - marks status='closed' if response_type is 'completed' or 'no_response'

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_RESPONSE_TYPES = new Set(["accepted","declined","quoted","completed","no_response"]);
const VALID_OUTCOMES       = new Set(["quoted","booked","completed","cancelled"]);

type Body = {
  enquiry_id?:          unknown;
  supplier_id?:         unknown;
  response_type?:       unknown;
  response_time_hours?: unknown;
  decline_reason?:      unknown;
  outcome?:             unknown;
  admin_notes?:         unknown;
};

export async function POST(req: NextRequest) {
  const authed = await isAdminAuthed();
  if (!authed) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try { body = (await req.json()) as Body; }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const enquiry_id    = typeof body.enquiry_id    === "string" ? body.enquiry_id.trim() : "";
  const supplier_id   = typeof body.supplier_id   === "string" ? body.supplier_id.trim() : "";
  const response_type = typeof body.response_type === "string" ? body.response_type.trim() : "";

  if (!enquiry_id)                          return NextResponse.json({ error: "enquiry_id_required" }, { status: 400 });
  if (!supplier_id)                         return NextResponse.json({ error: "supplier_id_required" }, { status: 400 });
  if (!VALID_RESPONSE_TYPES.has(response_type)) return NextResponse.json({ error: "invalid_response_type" }, { status: 400 });

  const outcome =
    typeof body.outcome === "string" && VALID_OUTCOMES.has(body.outcome.trim())
      ? body.outcome.trim() : null;

  const decline_reason =
    typeof body.decline_reason === "string" && body.decline_reason.trim().length > 0
      ? body.decline_reason.trim().slice(0, 500) : null;

  const admin_notes =
    typeof body.admin_notes === "string" && body.admin_notes.trim().length > 0
      ? body.admin_notes.trim().slice(0, 2000) : null;

  let response_time_hours: number | null = null;
  if (typeof body.response_time_hours === "number" && Number.isFinite(body.response_time_hours)) {
    response_time_hours = Math.max(0, body.response_time_hours);
  }

  // Verify the enquiry exists AND fetch delivered_at so we can auto-compute
  // response_time_hours if the caller didn't supply one.
  const { data: enquiryRow, error: enqErr } = await supabaseAdmin
    .from("nex_supplier_enquiries")
    .select("enquiry_id,delivered_at,status")
    .eq("enquiry_id", enquiry_id)
    .maybeSingle();
  if (enqErr)                       return NextResponse.json({ error: "enquiry_lookup_failed", detail: enqErr.message }, { status: 500 });
  if (!enquiryRow)                  return NextResponse.json({ error: "enquiry_not_found" }, { status: 404 });

  const now = new Date();
  if (response_time_hours === null && enquiryRow.delivered_at) {
    const deliveredMs = new Date(enquiryRow.delivered_at as string).getTime();
    response_time_hours = Math.max(0, (now.getTime() - deliveredMs) / 3_600_000);
  }

  // Insert the response · source_of_signal is FORCED server-side. Client can
  // never inject a fake provenance value. AI/model inference cannot write here.
  const { data: insertData, error: insertErr } = await supabaseAdmin
    .from("nex_supplier_responses")
    .insert({
      enquiry_id,
      supplier_id,
      response_type,
      response_time_hours,
      decline_reason,
      outcome,
      admin_notes,
      source_of_signal: "admin_recorded_response",
      recorded_by:      "admin",
    })
    .select("response_id,recorded_at")
    .single();
  if (insertErr) return NextResponse.json({ error: "insert_failed", detail: insertErr.message }, { status: 500 });

  // Update the enquiry lifecycle · first response sets responded_at,
  // completed/no_response closes the enquiry.
  const enquiryPatch: Record<string, unknown> = {};
  if (!enquiryRow.status || enquiryRow.status === "prepared" || enquiryRow.status === "delivered") {
    enquiryPatch.status = "responded";
    enquiryPatch.responded_at = now.toISOString();
  }
  if (response_type === "completed" || response_type === "no_response") {
    enquiryPatch.status = "closed";
  }
  if (Object.keys(enquiryPatch).length > 0) {
    const { error: updErr } = await supabaseAdmin
      .from("nex_supplier_enquiries")
      .update(enquiryPatch)
      .eq("enquiry_id", enquiry_id);
    if (updErr) {
      // Response row already written · surface the update issue as a warning
      // but return success. The metrics job can reconcile later.
      // eslint-disable-next-line no-console
      console.warn("[supplier-response] enquiry status patch failed:", updErr.message);
    }
  }

  return NextResponse.json({
    ok:           true,
    response_id:  insertData?.response_id,
    recorded_at:  insertData?.recorded_at,
    source_of_signal: "admin_recorded_response",
  });
}
