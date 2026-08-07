// NEX Comms Centre · Social · audit event emitter.
//
// Every state change or admin action writes an append-only row to
// nex.social_audit_events. INSERT-only is enforced at the DB grant
// level (UPDATE + DELETE revoked from PUBLIC).

import type { PgClientLike } from "@/lib/nex/db";
import type { SocialAuditEventType, TenantId } from "./types";

export interface AuditEmitInput {
  tenant_id:    TenantId;
  event_type:   SocialAuditEventType | string;
  actor:        string;
  subject_kind?: string;
  subject_id?:   string;
  details?:      Record<string, unknown>;
}

// Emits an audit row through the caller's existing client so it
// participates in the caller's transaction (and its RLS scope). Every
// call from application code must be inside a `withTenantClient` scope
// so tenant_id matches the RLS GUC.
export async function emitSocialAudit(c: PgClientLike, input: AuditEmitInput): Promise<void> {
  await c.query(
    `INSERT INTO nex.social_audit_events (tenant_id, event_type, actor, subject_kind, subject_id, details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.tenant_id,
      input.event_type,
      input.actor,
      input.subject_kind ?? null,
      input.subject_id ?? null,
      JSON.stringify(input.details ?? {}),
    ],
  );
}
