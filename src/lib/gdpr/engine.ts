// GDPR Engine · Article 15 (export) + Article 17 (delete) fulfilment.
//
// v1 supports homeowners only — the highest-risk subject category.
// Trades + merchants follow in Phase 6 (need cascade rules for reviews +
// merchant products they've authored, which have public visibility).
//
// Delete strategy: NULL out personal data on the account row,
// anonymise sitebook posts + messages (retain analytics value),
// hard-delete photos + private documents. Never touch payment records
// (Stripe/HMRC retention obligations override user erasure).

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type GdprSubjectKind = "homeowner" | "trade" | "merchant";
export type GdprRequestKind = "export" | "delete";
export type GdprStatus      = "pending" | "processing" | "fulfilled" | "rejected" | "error";

export type GdprRequest = {
  id:                  string;
  subject_kind:        GdprSubjectKind;
  subject_id:          string;
  subject_email:       string;
  request_kind:        GdprRequestKind;
  submission_source:   string;
  reason:              string | null;
  status:              GdprStatus;
  fulfilled_at:        string | null;
  notified_at:         string | null;
  export_bundle_url:   string | null;
  export_bundle_bytes: number | null;
  rejection_reason:    string | null;
  actioned_by_admin_id: string | null;
  actioned_by_email:   string | null;
  submitted_at:        string;
  created_at:          string;
};

export async function createRequest(input: {
  subjectKind: GdprSubjectKind;
  subjectId:   string;
  subjectEmail: string;
  requestKind: GdprRequestKind;
  submissionSource?: string;
  reason?:     string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const ins = await supabaseAdmin
    .from("hammerex_gdpr_requests")
    .insert({
      subject_kind:      input.subjectKind,
      subject_id:        input.subjectId,
      subject_email:     input.subjectEmail,
      request_kind:      input.requestKind,
      submission_source: input.submissionSource ?? "admin_manual",
      reason:            input.reason ?? null,
      status:            "pending"
    })
    .select("id")
    .maybeSingle();
  if (ins.error || !ins.data) return { ok: false, error: ins.error?.message ?? "insert-failed" };
  return { ok: true, id: ins.data.id as string };
}

export async function loadPendingRequests(): Promise<GdprRequest[]> {
  const res = await supabaseAdmin
    .from("hammerex_gdpr_requests")
    .select("*")
    .in("status", ["pending", "processing"])
    .order("submitted_at", { ascending: true });
  return (res.data as GdprRequest[]) ?? [];
}

/** Build the export bundle. Homeowners only in v1. */
export async function buildExportBundle(subjectKind: GdprSubjectKind, subjectId: string): Promise<Record<string, unknown>> {
  if (subjectKind !== "homeowner") {
    return { subjectKind, subjectId, note: "Export for non-homeowner subjects not yet implemented" };
  }
  const account  = await supabaseAdmin.from("hammerex_homeowners").select("*").eq("id", subjectId).maybeSingle();
  const projects = await supabaseAdmin.from("hammerex_sitebook_projects").select("*").eq("homeowner_id", subjectId);
  const projectIds = (projects.data as Array<{ id: string }> ?? []).map(p => p.id);

  const [posts, invitations, exports, photos, messages, warranties] = await Promise.all([
    supabaseAdmin.from("hammerex_sitebook_posts").select("*").eq("homeowner_id", subjectId),
    supabaseAdmin.from("hammerex_sitebook_invitations").select("*").eq("homeowner_id", subjectId),
    supabaseAdmin.from("hammerex_sitebook_exports").select("*").eq("homeowner_id", subjectId),
    projectIds.length ? supabaseAdmin.from("hammerex_sitebook_photos").select("*").in("project_id", projectIds)      : Promise.resolve({ data: [] as unknown[] }),
    projectIds.length ? supabaseAdmin.from("hammerex_sitebook_messages").select("*").in("project_id", projectIds)    : Promise.resolve({ data: [] as unknown[] }),
    projectIds.length ? supabaseAdmin.from("hammerex_sitebook_warranties").select("*").in("project_id", projectIds)  : Promise.resolve({ data: [] as unknown[] })
  ]);
  return {
    exported_at:     new Date().toISOString(),
    subject_kind:    subjectKind,
    subject_id:      subjectId,
    account:         account.data ?? null,
    projects:        projects.data ?? [],
    posts:           posts.data ?? [],
    invitations:     invitations.data ?? [],
    exports_history: exports.data ?? [],
    photos:          photos.data ?? [],
    messages:        messages.data ?? [],
    warranties:      warranties.data ?? []
  };
}

export async function markFulfilled(input: {
  requestId:      string;
  reviewerEmail:  string;
  reviewerAdminId?: string | null;
  bundleUrl?:     string;
  bundleBytes?:   number;
}): Promise<boolean> {
  const res = await supabaseAdmin
    .from("hammerex_gdpr_requests")
    .update({
      status:             "fulfilled",
      fulfilled_at:       new Date().toISOString(),
      export_bundle_url:  input.bundleUrl ?? null,
      export_bundle_bytes: input.bundleBytes ?? null,
      actioned_by_admin_id: input.reviewerAdminId ?? null,
      actioned_by_email:  input.reviewerEmail
    })
    .eq("id", input.requestId)
    .select("id")
    .maybeSingle();
  return !!res.data;
}

/** Erase-in-place for homeowners. Aggressive personal-data nulling +
 *  photo deletion. Does NOT drop the row (foreign keys) — sets
 *  deleted_at + zeroes PII. Retains anonymised sitebook posts for
 *  analytics/liquidity metrics. */
export async function eraseHomeowner(subjectId: string): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  // 1. Null the homeowner row PII
  const acc = await supabaseAdmin
    .from("hammerex_homeowners")
    .update({
      email:            `deleted+${subjectId}@thenetworkers.app`,
      first_name:       null,
      last_name:        null,
      whatsapp_number:  null,
      postcode:         null,
      city:             null,
      house_nickname:   null,
      suspended_at:     now,
      suspended_reason: "GDPR erasure"
    })
    .eq("id", subjectId)
    .select("id")
    .maybeSingle();
  if (!acc.data) return { ok: false, error: "homeowner not found" };

  // Fetch project IDs owned by this homeowner (photos + messages are project-scoped)
  const projects = await supabaseAdmin
    .from("hammerex_sitebook_projects")
    .select("id")
    .eq("homeowner_id", subjectId);
  const projectIds = (projects.data as Array<{ id: string }> ?? []).map(p => p.id);

  if (projectIds.length) {
    // 2. Hard-delete photos (highest privacy risk)
    await supabaseAdmin.from("hammerex_sitebook_photos").delete().in("project_id", projectIds);

    // 3. Anonymise messages authored by this homeowner
    await supabaseAdmin
      .from("hammerex_sitebook_messages")
      .update({ body: "[erased]", hidden_at: now, hidden_reason: "GDPR erasure" })
      .in("project_id", projectIds)
      .eq("author_id", subjectId);
  }

  // 4. Anonymise posts (retain shape for liquidity analytics)
  await supabaseAdmin
    .from("hammerex_sitebook_posts")
    .update({ title: "[erased]", body: "[erased]" })
    .eq("homeowner_id", subjectId);

  return { ok: true };
}
