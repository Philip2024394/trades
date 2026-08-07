// NEX Compliance Engine
//
// The ONE gate that mutates contact compliance state. Provider adapters
// and the analytics layer NEVER write to contact compliance fields
// directly — everything routes through here.
//
// Doctrine (Philip 2026-08-08):
//   Provider Webhook → Signature Validation → Canonical Event
//     → Event Ingest → Compliance Engine → Contact Registry
//     → Future Campaign Expansion

import { withClient } from "@/lib/nex/delivery/db";
import type { AnalyticsEvent } from "@/lib/nex/analytics/types";
import type { ComplianceAuditEvent, ComplianceEventType, ComplianceSource, ComplianceState, ContactCompliance } from "./types";
import { POLICY } from "./policy";

// ── Classification helpers ────────────────────────────────────────

/** Classify a canonical `bounced` event as hard vs soft using provider-specific metadata. */
export function classifyBounce(ev: AnalyticsEvent): "hard" | "soft" | "unknown" {
  const md = ev.metadata ?? {};
  // SES: metadata.bounce_type = "Permanent" | "Transient" | "Undetermined"
  const sesType = String(md.bounce_type ?? "");
  if (/^Permanent$/i.test(sesType))  return "hard";
  if (/^Transient$/i.test(sesType))  return "soft";
  // Mailgun: metadata.severity = "permanent" | "temporary"
  const mgSev = String(md.severity ?? "");
  if (/^permanent$/i.test(mgSev))    return "hard";
  if (/^temporary$/i.test(mgSev))    return "soft";
  // Postmark: metadata.type = "HardBounce" | "SoftBounce" | "Blocked" | ...
  const pmType = String(md.type ?? md.raw_type ?? "");
  if (/hard|blocked|badmailbox/i.test(pmType)) return "hard";
  if (/soft/i.test(pmType))                    return "soft";
  // SendGrid: metadata.type = "bounce" (hard) | "blocked" (soft-ish) · fall through
  if (/^bounce$/i.test(pmType))                return "hard";
  if (/^blocked$/i.test(pmType))               return "soft";
  return "unknown";
}

function sourceFromProvider(provider: string | null | undefined): ComplianceSource {
  const p = (provider ?? "").toLowerCase();
  if (p === "sendgrid") return "sendgrid_webhook";
  if (p === "ses")      return "ses_webhook";
  if (p === "mailgun")  return "mailgun_webhook";
  if (p === "postmark") return "postmark_webhook";
  if (p === "simulator") return "simulator";
  return "manual_admin";
}

// ── Row mapping ───────────────────────────────────────────────────
function rowToCompliance(r: Record<string, unknown>): ContactCompliance {
  return {
    contact_id: String(r.contact_id),
    email: (r.email as string | null) ?? null,
    name:  (r.name  as string | null) ?? null,
    compliance_state: (r.compliance_state as ComplianceState) ?? "allowed",
    compliance_reason: (r.compliance_reason as string | null) ?? null,
    compliance_source: (r.compliance_source as ComplianceSource | null) ?? null,
    compliance_updated_at: (r.compliance_updated_at as string | null) ?? null,
    soft_bounce_count: Number(r.soft_bounce_count ?? 0),
    soft_bounce_last_at: (r.soft_bounce_last_at as string | null) ?? null,
    never_contact: r.never_contact === true,
    unsubscribe_at: (r.unsubscribe_at as string | null) ?? null,
    last_provider_message_id: (r.last_provider_message_id as string | null) ?? null,
  };
}

// ── Public read helpers ──────────────────────────────────────────
export async function getContactCompliance(contact_id: string): Promise<ContactCompliance | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT contact_id, email, name, compliance_state, compliance_reason, compliance_source,
              compliance_updated_at, soft_bounce_count, soft_bounce_last_at,
              never_contact, unsubscribe_at, last_provider_message_id
       FROM nex.contacts
       WHERE contact_id = $1 AND deleted_at IS NULL
       LIMIT 1`, [contact_id],
    );
    return res.rows[0] ? rowToCompliance(res.rows[0]) : null;
  });
  return r ?? null;
}

export async function getAuditForContact(contact_id: string, limit = 100): Promise<ComplianceAuditEvent[]> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT * FROM nex.compliance_events WHERE contact_id = $1 ORDER BY created_at DESC LIMIT ${Math.max(1, Math.min(500, limit))}`,
      [contact_id],
    );
    return res.rows.map((r0) => ({
      event_id: String(r0.event_id),
      contact_id: String(r0.contact_id),
      event_type: r0.event_type as ComplianceEventType,
      old_state: (r0.old_state as ComplianceState | null) ?? null,
      new_state: (r0.new_state as ComplianceState | null) ?? null,
      reason: (r0.reason as string | null) ?? null,
      source: r0.source as ComplianceSource,
      provider: (r0.provider as string | null) ?? null,
      provider_message_id: (r0.provider_message_id as string | null) ?? null,
      campaign_id: (r0.campaign_id as string | null) ?? null,
      actor: (r0.actor as string | null) ?? null,
      analytics_event_id: (r0.analytics_event_id as string | null) ?? null,
      metadata: (r0.metadata as Record<string, unknown>) ?? {},
      created_at: String(r0.created_at),
    }));
  });
  return r ?? [];
}

export type SuppressedListRow = ContactCompliance & { last_reason: string | null };

export async function listSuppressed(opts: { limit?: number; state?: ComplianceState; search?: string } = {}): Promise<SuppressedListRow[]> {
  const limit = Math.max(1, Math.min(500, opts.limit ?? 100));
  const wheres: string[] = ["deleted_at IS NULL", "compliance_state <> 'allowed'"];
  const params: unknown[] = [];
  if (opts.state) { params.push(opts.state); wheres.push(`compliance_state = $${params.length}`); }
  if (opts.search) {
    const like = `%${opts.search.toLowerCase()}%`;
    params.push(like);
    wheres.push(`(LOWER(COALESCE(email, '')) LIKE $${params.length} OR LOWER(COALESCE(name, '')) LIKE $${params.length})`);
  }
  const r = await withClient(async (c) => {
    const res = await c.query(
      `SELECT contact_id, email, name, compliance_state, compliance_reason, compliance_source,
              compliance_updated_at, soft_bounce_count, soft_bounce_last_at,
              never_contact, unsubscribe_at, last_provider_message_id
       FROM nex.contacts
       WHERE ${wheres.join(" AND ")}
       ORDER BY compliance_updated_at DESC NULLS LAST
       LIMIT ${limit}`, params,
    );
    return res.rows.map((r0) => ({ ...rowToCompliance(r0), last_reason: (r0.compliance_reason as string | null) ?? null }));
  });
  return r ?? [];
}

export type ComplianceMetrics = {
  totals: Record<ComplianceState, number>;
  total_suppressed: number;
  audit_last_24h: number;
  by_source_last_24h: Record<string, number>;
  by_event_type_last_24h: Record<string, number>;
};

export async function getComplianceMetrics(): Promise<ComplianceMetrics> {
  const zero: Record<ComplianceState, number> = {
    allowed: 0, suppressed_soft: 0, suppressed_hard: 0,
    unsubscribed: 0, complaint: 0, manual_block: 0,
  };
  const r = await withClient(async (c) => {
    const statesRes = await c.query(`SELECT compliance_state, COUNT(*)::int AS n FROM nex.contacts WHERE deleted_at IS NULL GROUP BY compliance_state`);
    const auditRes  = await c.query(`SELECT COUNT(*)::int AS n FROM nex.compliance_events WHERE created_at > NOW() - INTERVAL '24 hours'`);
    const bySrcRes  = await c.query(`SELECT source, COUNT(*)::int AS n FROM nex.compliance_events WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY source`);
    const byTypeRes = await c.query(`SELECT event_type, COUNT(*)::int AS n FROM nex.compliance_events WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY event_type`);
    const totals = { ...zero };
    for (const row of statesRes.rows) totals[row.compliance_state as ComplianceState] = Number(row.n);
    const total_suppressed = totals.suppressed_soft + totals.suppressed_hard + totals.unsubscribed + totals.complaint + totals.manual_block;
    return {
      totals, total_suppressed,
      audit_last_24h: Number((auditRes.rows[0] as { n: number })?.n ?? 0),
      by_source_last_24h:     Object.fromEntries(bySrcRes.rows.map((r0) => [String(r0.source), Number(r0.n)])),
      by_event_type_last_24h: Object.fromEntries(byTypeRes.rows.map((r0) => [String(r0.event_type), Number(r0.n)])),
    };
  });
  return r ?? { totals: zero, total_suppressed: 0, audit_last_24h: 0, by_source_last_24h: {}, by_event_type_last_24h: {} };
}

// ── State mutation (the ONLY writer to contact compliance fields) ──
async function applyStateChange(input: {
  contact_id: string;
  new_state: ComplianceState;
  reason: string;
  source: ComplianceSource;
  event_type: ComplianceEventType;
  provider?: string | null;
  provider_message_id?: string | null;
  campaign_id?: string | null;
  actor?: string | null;
  analytics_event_id?: string | null;
  metadata?: Record<string, unknown>;
  reset_soft_streak?: boolean;
  increment_soft?: boolean;
}): Promise<ContactCompliance | null> {
  return withClient(async (c) => {
    // Read current row inside the same connection so audit gets the true "old_state"
    const cur = await c.query(
      `SELECT compliance_state, soft_bounce_count FROM nex.contacts WHERE contact_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [input.contact_id],
    );
    if (cur.rows.length === 0) return null;
    const old_state = (cur.rows[0].compliance_state as ComplianceState) ?? "allowed";
    const cur_soft  = Number(cur.rows[0].soft_bounce_count ?? 0);

    // Compute new never_contact + unsubscribe_at from the target state
    const sets: string[] = ["compliance_state = $1", "compliance_reason = $2", "compliance_source = $3", "compliance_updated_at = NOW()", "updated_at = NOW()"];
    const params: unknown[] = [input.new_state, input.reason.slice(0, 500), input.source];

    const nonAllowed = input.new_state !== "allowed";
    params.push(nonAllowed); sets.push(`never_contact = $${params.length}`);

    if (input.new_state === "unsubscribed") { sets.push(`unsubscribe_at = COALESCE(unsubscribe_at, NOW())`); }
    if (input.new_state === "allowed")      { sets.push(`unsubscribe_at = NULL`); }

    if (input.reset_soft_streak) {
      sets.push(`soft_bounce_count = 0`);
    } else if (input.increment_soft) {
      sets.push(`soft_bounce_count = soft_bounce_count + 1`);
      sets.push(`soft_bounce_last_at = NOW()`);
    }

    if (input.provider_message_id) {
      params.push(input.provider_message_id); sets.push(`last_provider_message_id = $${params.length}`);
    }

    params.push(input.contact_id);
    await c.query(`UPDATE nex.contacts SET ${sets.join(", ")} WHERE contact_id = $${params.length} AND deleted_at IS NULL`, params);

    // Insert immutable audit row · never mutated after write
    await c.query(
      `INSERT INTO nex.compliance_events (contact_id, event_type, old_state, new_state, reason, source, provider, provider_message_id, campaign_id, actor, analytics_event_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
      [
        input.contact_id, input.event_type, old_state, input.new_state,
        input.reason.slice(0, 500), input.source, input.provider ?? null,
        input.provider_message_id ?? null, input.campaign_id ?? null,
        input.actor ?? "system", input.analytics_event_id ?? null,
        JSON.stringify({ ...(input.metadata ?? {}), prior_soft_bounce_count: cur_soft }),
      ],
    );

    return getContactComplianceInner(c, input.contact_id);
  });
}

async function getContactComplianceInner(c: import("@/lib/nex/delivery/db").PgClientLike, id: string): Promise<ContactCompliance | null> {
  const res = await c.query(
    `SELECT contact_id, email, name, compliance_state, compliance_reason, compliance_source,
            compliance_updated_at, soft_bounce_count, soft_bounce_last_at,
            never_contact, unsubscribe_at, last_provider_message_id
     FROM nex.contacts WHERE contact_id = $1 AND deleted_at IS NULL LIMIT 1`, [id],
  );
  return res.rows[0] ? rowToCompliance(res.rows[0]) : null;
}

// ── The Ingest → Engine bridge (called by analytics.ingestEvent) ──
/**
 * Given a canonical AnalyticsEvent, decide whether to apply a
 * compliance state change and, if so, do it. Best-effort: any error
 * here is swallowed so it never fails analytics ingest.
 * Returns the compliance action taken (or null if none).
 */
export async function applyCanonicalEvent(ev: AnalyticsEvent, analytics_event_id?: string | null): Promise<{ event_type: ComplianceEventType; new_state: ComplianceState } | null> {
  try {
    const contact_id = ev.recipient_id;
    if (!contact_id) return null;                             // aggregate events (no recipient) can't affect compliance
    const source = sourceFromProvider(ev.provider);

    switch (ev.event_type) {
      case "delivered": {
        if (!POLICY.resetSoftOnDelivered) return null;
        // Zero the soft-bounce counter iff there's history to clear · don't emit noise for zeros
        const current = await getContactCompliance(contact_id);
        if (!current || current.soft_bounce_count === 0) return null;
        await applyStateChange({
          contact_id, new_state: current.compliance_state, reason: `soft-bounce streak reset after delivered · ${current.soft_bounce_count} → 0`,
          source, event_type: "delivered_reset_soft_streak",
          provider: ev.provider ?? null, provider_message_id: ev.provider_message_id ?? null,
          campaign_id: ev.campaign_id ?? null, analytics_event_id: analytics_event_id ?? null,
          reset_soft_streak: true,
        });
        return { event_type: "delivered_reset_soft_streak", new_state: current.compliance_state };
      }

      case "bounced": {
        const kind = classifyBounce(ev);
        if (kind === "hard") {
          // Idempotency guard · duplicate webhook (same provider_message_id
          // when already suppressed_hard) MUST NOT double-log the state
          // transition. Analytics still records both webhook events for
          // forensics; compliance only records the actual state change.
          const cur = await getContactCompliance(contact_id);
          if (
            cur?.compliance_state === "suppressed_hard" &&
            ev.provider_message_id &&
            cur?.last_provider_message_id === ev.provider_message_id
          ) {
            return null;
          }
          const reason = `hard bounce · ${ev.provider ?? "unknown"} · ${String((ev.metadata ?? {}).bounce_subtype ?? (ev.metadata ?? {}).reason ?? "no detail")}`;
          const r = await applyStateChange({
            contact_id, new_state: "suppressed_hard", reason,
            source, event_type: "hard_bounce_received",
            provider: ev.provider ?? null, provider_message_id: ev.provider_message_id ?? null,
            campaign_id: ev.campaign_id ?? null, analytics_event_id: analytics_event_id ?? null,
            metadata: ev.metadata,
          });
          if (r) return { event_type: "hard_bounce_received", new_state: "suppressed_hard" };
          return null;
        }
        if (kind === "soft") {
          // Increment counter · log soft_bounce_received · if we cross threshold, transition to suppressed_soft
          const current = await getContactCompliance(contact_id);
          const nextCount = (current?.soft_bounce_count ?? 0) + 1;
          const threshold = POLICY.softBounceThreshold;
          const willSuppress = nextCount >= threshold && current?.compliance_state === "allowed";
          const reason = `soft bounce ${nextCount}/${threshold} · ${ev.provider ?? "unknown"}`;
          await applyStateChange({
            contact_id, new_state: willSuppress ? "suppressed_soft" : (current?.compliance_state ?? "allowed"),
            reason, source, event_type: willSuppress ? "suppressed_soft_threshold" : "soft_bounce_received",
            provider: ev.provider ?? null, provider_message_id: ev.provider_message_id ?? null,
            campaign_id: ev.campaign_id ?? null, analytics_event_id: analytics_event_id ?? null,
            metadata: ev.metadata, increment_soft: true,
          });
          return { event_type: willSuppress ? "suppressed_soft_threshold" : "soft_bounce_received", new_state: willSuppress ? "suppressed_soft" : (current?.compliance_state ?? "allowed") };
        }
        return null;                                             // unknown bounce classification · no action
      }

      case "complaint": {
        const reason = `complaint · ${ev.provider ?? "unknown"} · ${String((ev.metadata ?? {}).complaint_feedback_type ?? "no detail")}`;
        const r = await applyStateChange({
          contact_id, new_state: "complaint", reason,
          source, event_type: "complaint_received",
          provider: ev.provider ?? null, provider_message_id: ev.provider_message_id ?? null,
          campaign_id: ev.campaign_id ?? null, analytics_event_id: analytics_event_id ?? null,
          metadata: ev.metadata,
        });
        if (r) return { event_type: "complaint_received", new_state: "complaint" };
        return null;
      }

      case "unsubscribed": {
        const reason = `unsubscribed · ${ev.provider ?? "unknown"}`;
        const r = await applyStateChange({
          contact_id, new_state: "unsubscribed", reason,
          source, event_type: "unsubscribed",
          provider: ev.provider ?? null, provider_message_id: ev.provider_message_id ?? null,
          campaign_id: ev.campaign_id ?? null, analytics_event_id: analytics_event_id ?? null,
          metadata: ev.metadata,
        });
        if (r) return { event_type: "unsubscribed", new_state: "unsubscribed" };
        return null;
      }

      default:
        return null;                                             // queued · opened · clicked · deferred · failed · suppressed → no compliance action
    }
  } catch {
    return null;                                                 // NEVER fail analytics ingest because of a compliance error
  }
}

// ── Manual admin actions ──────────────────────────────────────────
export async function manualSuppress(contact_id: string, reason: string, actor: string): Promise<ContactCompliance | null> {
  return applyStateChange({
    contact_id, new_state: "manual_block", reason: reason || "manual admin block",
    source: "manual_admin", event_type: "manual_suppressed",
    actor,
  });
}

export async function manualReinstate(contact_id: string, actor: string, reason: string): Promise<ContactCompliance | null> {
  return applyStateChange({
    contact_id, new_state: "allowed", reason: reason || "manually reinstated",
    source: "manual_admin", event_type: "reinstated",
    actor, reset_soft_streak: true,
  });
}
