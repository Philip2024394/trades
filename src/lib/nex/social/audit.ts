// Social audit. Append-only via trigger.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SocialAuditAction =
  | "account.connected" | "account.revoked" | "account.error"
  | "post.draft" | "post.awaiting_approval" | "post.approved"
  | "post.scheduled" | "post.publishing" | "post.published"
  | "post.failed" | "post.rejected" | "post.edited"
  | "post.created_by_nex"
  | "schedule.created" | "schedule.paused" | "schedule.ended"
  | "auto_publish.enabled" | "auto_publish.disabled"
  | "analytics.recorded";

export async function auditSocial(input: {
  merchantSlug: string;
  actor:        string;
  action:       SocialAuditAction;
  postId?:      string;
  accountId?:   string;
  details?:     Record<string, unknown>;
}): Promise<void> {
  await supabaseAdmin.from("hammerex_nex_social_audit_log").insert({
    merchant_slug: input.merchantSlug,
    actor:         input.actor,
    action:        input.action,
    post_id:       input.postId ?? null,
    account_id:    input.accountId ?? null,
    details_json:  input.details ?? null
  });
}
