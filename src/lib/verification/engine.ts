// Verification Engine · polymorphic credential verification.
//
// Every product's credential-verification need calls this. In v1 all
// approvals are manual admin review. Phase 6+ adds API adapters
// (Gas Safe register, Companies House confirmation, etc.).

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SubjectKind    = "trade" | "merchant" | "homeowner" | "driver" | "dating_profile";
export type CredentialKind = "gas_safe" | "niceic" | "companies_house" | "vat" | "id" | "address" | "age" | "licence";
export type VerificationStatus = "pending" | "verified" | "rejected" | "expired";

export type Verification = {
  id:                  string;
  subject_kind:        SubjectKind;
  subject_id:          string;
  subject_slug:        string | null;
  subject_display:     string | null;
  credential_kind:     CredentialKind;
  credential_value:    string | null;
  credential_note:     string | null;
  evidence_url:        string | null;
  status:              VerificationStatus;
  rejection_reason:    string | null;
  submitted_at:        string;
  reviewed_at:         string | null;
  reviewed_by_admin_id: string | null;
  reviewed_by_email:   string | null;
  expires_at:          string | null;
  submitted_via:       string;
};

/** Submit a verification. Idempotent — resubmitting cancels any
 *  previous pending/rejected of the same kind for the same subject. */
export async function requestVerification(input: {
  subjectKind:     SubjectKind;
  subjectId:       string;
  subjectSlug?:    string;
  subjectDisplay?: string;
  credentialKind:  CredentialKind;
  credentialValue?: string;
  credentialNote?: string;
  evidenceUrl?:    string;
  evidenceKind?:   string;
  submittedVia?:   "user" | "admin_manual" | "api_import";
  expiresAt?:      string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  // Kill any existing pending / rejected for the same subject+credential
  await supabaseAdmin
    .from("hammerex_verifications")
    .update({ status: "expired" })
    .eq("subject_kind",   input.subjectKind)
    .eq("subject_id",     input.subjectId)
    .eq("credential_kind", input.credentialKind)
    .in("status",          ["pending", "rejected"]);

  const ins = await supabaseAdmin
    .from("hammerex_verifications")
    .insert({
      subject_kind:      input.subjectKind,
      subject_id:        input.subjectId,
      subject_slug:      input.subjectSlug     ?? null,
      subject_display:   input.subjectDisplay  ?? null,
      credential_kind:   input.credentialKind,
      credential_value:  input.credentialValue ?? null,
      credential_note:   input.credentialNote  ?? null,
      evidence_url:      input.evidenceUrl     ?? null,
      evidence_kind:     input.evidenceKind    ?? null,
      submitted_via:     input.submittedVia    ?? "user",
      expires_at:        input.expiresAt       ?? null,
      status:            "pending"
    })
    .select("id")
    .maybeSingle();
  if (ins.error || !ins.data) {
    console.error("[verification] insert failed:", ins.error);
    return { ok: false, error: ins.error?.message ?? "insert-failed" };
  }
  return { ok: true, id: ins.data.id as string };
}

export async function approveVerification(input: {
  verificationId: string;
  reviewerAdminId?: string | null;
  reviewerEmail:  string;
  expiresAt?:     string | null;
}): Promise<boolean> {
  const res = await supabaseAdmin
    .from("hammerex_verifications")
    .update({
      status:               "verified",
      reviewed_at:          new Date().toISOString(),
      reviewed_by_admin_id: input.reviewerAdminId ?? null,
      reviewed_by_email:    input.reviewerEmail,
      expires_at:           input.expiresAt ?? null
    })
    .eq("id", input.verificationId)
    .select("id")
    .maybeSingle();
  return !!res.data;
}

export async function rejectVerification(input: {
  verificationId: string;
  reviewerAdminId?: string | null;
  reviewerEmail:  string;
  reason:         string;
}): Promise<boolean> {
  const res = await supabaseAdmin
    .from("hammerex_verifications")
    .update({
      status:               "rejected",
      reviewed_at:          new Date().toISOString(),
      reviewed_by_admin_id: input.reviewerAdminId ?? null,
      reviewed_by_email:    input.reviewerEmail,
      rejection_reason:     input.reason
    })
    .eq("id", input.verificationId)
    .select("id")
    .maybeSingle();
  return !!res.data;
}

/** Load the pending queue for admin review. */
export async function loadPendingVerifications(limit = 100): Promise<Verification[]> {
  const res = await supabaseAdmin
    .from("hammerex_verifications")
    .select("*")
    .eq("status", "pending")
    .order("submitted_at", { ascending: true })
    .limit(limit);
  return (res.data as Verification[]) ?? [];
}

/** Read for public profile — "is this trade Gas Safe verified?" */
export async function loadVerificationsForSubject(subjectKind: SubjectKind, subjectId: string): Promise<Verification[]> {
  const res = await supabaseAdmin
    .from("hammerex_verifications")
    .select("*")
    .eq("subject_kind", subjectKind)
    .eq("subject_id",   subjectId)
    .order("created_at", { ascending: false });
  return (res.data as Verification[]) ?? [];
}
