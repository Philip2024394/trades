// Admin audit log · single write helper.
//
// Every admin action across every surface calls writeAuditLog().
// v1 accepts nullable actor_admin_id because current admin auth is
// shared-password (see src/lib/adminAuth.ts). Phase 0.2 introduces
// hammerex_admins and the assertAdminRole() helper fills actor
// automatically.
//
// Store JSONB snapshots — small enough to inline. Rule-3 non-
// destructive-restore reconstructs pre-action state from log.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type AuditActorKind =
  | "admin"
  | "moderator"
  | "support"
  | "analyst"
  | "finance"
  | "system"      // in-app automation (e.g. warranty cron)
  | "scheduled";  // Vercel/pg cron

export type AuditEntry = {
  /** Uploaded automatically by the request wrapper in Phase 0.2 */
  actorAdminId?:   string | null;
  /** Fallback identity for v1 shared-password admin */
  actorEmail?:     string | null;
  actorKind?:      AuditActorKind;

  /** Namespaced verb: "yard.post.moderate", "user.suspend",
   *  "merchant.tier.upgrade", "gdpr.export.fulfill", ... */
  action:          string;

  targetType?:     string | null;
  targetId?:       string | null;
  targetSlug?:     string | null;

  beforeState?:    Record<string, unknown> | null;
  afterState?:     Record<string, unknown> | null;

  reason?:         string | null;

  /** Extracted from the request if the caller provides it */
  ipAddress?:      string | null;
  userAgent?:      string | null;
};

/** Fire-and-forget write. Never throws — audit-log failure must not
 *  break the parent action (Rule 3: non-destructive). Logs its own
 *  error to console for ops visibility. */
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const res = await supabaseAdmin
      .from("hammerex_admin_audit_log")
      .insert({
        actor_admin_id: entry.actorAdminId ?? null,
        actor_email:    entry.actorEmail   ?? null,
        actor_kind:     entry.actorKind    ?? "admin",
        action:         entry.action,
        target_type:    entry.targetType   ?? null,
        target_id:      entry.targetId     ?? null,
        target_slug:    entry.targetSlug   ?? null,
        before_state:   entry.beforeState  ?? null,
        after_state:    entry.afterState   ?? null,
        reason:         entry.reason       ?? null,
        ip_address:     entry.ipAddress    ?? null,
        user_agent:     entry.userAgent    ?? null
      });
    if (res.error) {
      console.error("[audit] insert failed:", res.error.message, entry.action);
    }
  } catch (err) {
    console.error("[audit] threw:", err, entry.action);
  }
}

/** Extract IP + UA from a request. Best-effort — headers vary by
 *  hosting. Vercel exposes x-forwarded-for + x-real-ip. */
export function extractRequestContext(req: Request): { ipAddress: string | null; userAgent: string | null } {
  const forwarded = req.headers.get("x-forwarded-for");
  const real      = req.headers.get("x-real-ip");
  const ip = (forwarded?.split(",")[0].trim()) || real || null;
  const ua = req.headers.get("user-agent") || null;
  return { ipAddress: ip, userAgent: ua };
}
