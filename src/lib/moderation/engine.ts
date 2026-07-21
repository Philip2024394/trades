// Moderation Engine · polymorphic content-review queue.
//
// Products call flagContent() when a user reports something, when a
// heuristic fires (spam link, phone-number leak), or when an admin
// spots something manually. The queue lives in hammerex_moderation_flags
// and drains via /admin/moderation.
//
// Rule 3 · non-destructive: `hide` calls the product-specific adapter
// to set a soft-hide column (e.g. moderation_status='hidden' on yard
// posts) — the underlying row is never deleted.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ModerationSubjectKind =
  | "yard_post"
  | "sitebook_photo"
  | "review"
  | "chat_message"
  | "merchant_profile"
  | "trade_profile";

export type FlagKind =
  | "spam"
  | "offensive"
  | "off_topic"
  | "personal_info"
  | "copyright"
  | "low_quality"
  | "other";

export type FlagSource =
  | "user_report"
  | "auto_heuristic"
  | "auto_ai"
  | "admin_manual";

export type Severity = "low" | "normal" | "high" | "critical";

export type FlagStatus =
  | "pending"
  | "approved"
  | "hidden"
  | "removed"
  | "escalated";

export type ModerationFlag = {
  id:                   string;
  subject_kind:         ModerationSubjectKind;
  subject_id:           string;
  subject_display:      string | null;
  subject_url:          string | null;
  flag_kind:            FlagKind;
  flag_source:          FlagSource;
  flag_note:            string | null;
  reporter_kind:        string | null;
  reporter_id:          string | null;
  status:               FlagStatus;
  severity:             Severity;
  resolved_at:          string | null;
  resolved_by_admin_id: string | null;
  resolved_by_email:    string | null;
  resolution_note:      string | null;
  created_at:           string;
};

/** Submit a flag. Never throws — moderation must not block user flows. */
export async function flagContent(input: {
  subjectKind:     ModerationSubjectKind;
  subjectId:       string;
  subjectDisplay?: string;
  subjectUrl?:     string;
  flagKind:        FlagKind;
  flagSource:      FlagSource;
  flagNote?:       string;
  reporterKind?:   string;
  reporterId?:     string;
  severity?:       Severity;
}): Promise<void> {
  try {
    await supabaseAdmin.from("hammerex_moderation_flags").insert({
      subject_kind:    input.subjectKind,
      subject_id:      input.subjectId,
      subject_display: input.subjectDisplay ?? null,
      subject_url:     input.subjectUrl     ?? null,
      flag_kind:       input.flagKind,
      flag_source:     input.flagSource,
      flag_note:       input.flagNote       ?? null,
      reporter_kind:   input.reporterKind   ?? null,
      reporter_id:     input.reporterId     ?? null,
      severity:        input.severity       ?? "normal",
      status:          "pending"
    });
  } catch (err) {
    console.error("[moderation] flagContent failed:", err);
  }
}

export async function loadPendingFlags(limit = 200): Promise<ModerationFlag[]> {
  const res = await supabaseAdmin
    .from("hammerex_moderation_flags")
    .select("*")
    .eq("status", "pending")
    .order("severity",   { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  return (res.data as ModerationFlag[]) ?? [];
}

export async function loadFlag(id: string): Promise<ModerationFlag | null> {
  const res = await supabaseAdmin
    .from("hammerex_moderation_flags")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (res.data as ModerationFlag | null) ?? null;
}

export async function resolveFlag(input: {
  flagId:          string;
  status:          "approved" | "hidden" | "removed" | "escalated";
  reviewerAdminId?: string | null;
  reviewerEmail:   string;
  resolutionNote?: string;
}): Promise<{ ok: boolean; error?: string; flag?: ModerationFlag }> {
  const flag = await loadFlag(input.flagId);
  if (!flag) return { ok: false, error: "flag not found" };

  const update = await supabaseAdmin
    .from("hammerex_moderation_flags")
    .update({
      status:               input.status,
      resolved_at:          new Date().toISOString(),
      resolved_by_admin_id: input.reviewerAdminId ?? null,
      resolved_by_email:    input.reviewerEmail,
      resolution_note:      input.resolutionNote  ?? null
    })
    .eq("id", input.flagId)
    .select("*")
    .maybeSingle();
  if (update.error) return { ok: false, error: update.error.message };

  // Rule 3 · propagate soft-hide / remove to product row
  if (input.status === "hidden" || input.status === "removed") {
    await applyAdapter(flag, input.status, input.resolutionNote ?? null);
  }
  return { ok: true, flag: update.data as ModerationFlag };
}

/** Product-specific soft-hide adapters. `removed` is treated as hide
 *  everywhere in v1 — hard-deletion of user rows requires explicit
 *  GDPR flow (see /api/admin/gdpr/delete). */
async function applyAdapter(flag: ModerationFlag, status: "hidden" | "removed", note: string | null): Promise<void> {
  const now = new Date().toISOString();
  switch (flag.subject_kind) {
    case "yard_post":
      await supabaseAdmin
        .from("hammerex_trade_off_yard_posts")
        .update({
          moderation_status: status === "removed" ? "spam" : "hidden",
          moderation_reason: note,
          moderated_at:      now
        })
        .eq("id", flag.subject_id);
      break;
    case "sitebook_photo":
      await supabaseAdmin
        .from("hammerex_sitebook_photos")
        .update({ hidden_at: now, hidden_reason: note })
        .eq("id", flag.subject_id);
      break;
    case "review":
      await supabaseAdmin
        .from("hammerex_trade_off_reviews")
        .update({ hidden_at: now, hidden_reason: note })
        .eq("id", flag.subject_id);
      break;
    case "chat_message":
      await supabaseAdmin
        .from("hammerex_sitebook_messages")
        .update({ hidden_at: now, hidden_reason: note })
        .eq("id", flag.subject_id);
      break;
    case "merchant_profile":
    case "trade_profile":
      // Profiles are hidden via suspend flow (see /api/admin/users + merchants).
      // Moderation flag on profile = escalation, not auto-hide.
      break;
  }
}
