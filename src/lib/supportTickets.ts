// Support ticket system — server-side helpers.
//
// Handles every user-facing report path: DMCA takedowns, IP claims,
// content reports (CSAM/sexual/defamation), privacy requests,
// account/billing questions, general enquiries. One table, one
// admin queue, one SLA policy.
//
// Two auto-behaviours land here (not in individual routes):
//   1. SLA deadline auto-calculated from severity at insert time.
//   2. When a ticket's kind is CSAM or sexual, we ALSO write
//      moderation_hidden_at + moderation_hidden_reason onto the
//      target row (canteen post or image submission) so the
//      content disappears from public surfaces IMMEDIATELY —
//      before human review. Admin can restore if the report was
//      malicious.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type TicketKind =
  | "dmca_takedown"
  | "ip_infringement"
  | "content_report"
  | "csam_report"
  | "sexual_content"
  | "defamation"
  | "privacy_request"
  | "account"
  | "billing"
  | "general";

export type TicketSeverity = "urgent" | "high" | "normal" | "low";
export type TicketStatus =
  | "open" | "reviewing" | "action_required"
  | "resolved" | "closed" | "spam";

export type TicketTargetKind =
  | "canteen_post" | "image" | "canteen" | "trade"
  | "submission" | "product" | "quote_request" | "other";

/** Auto-hide target kinds — when a ticket with severity=urgent
 *  lands referencing one of these, we IMMEDIATELY set the target's
 *  moderation_hidden_at column so the content stops rendering on
 *  public surfaces pending admin review. */
const AUTO_HIDE_TARGET_TABLES: Partial<Record<TicketTargetKind, string>> = {
  canteen_post: "hammerex_canteen_posts",
  submission:   "networkers_image_submissions",
  image:        "networkers_image_submissions"
};

export type SupportTicket = {
  id: string;
  kind: TicketKind;
  severity: TicketSeverity;
  status: TicketStatus;
  reporterName: string;
  reporterEmail: string;
  reporterPhone: string | null;
  reporterSlug: string | null;
  reporterIp: string | null;
  reporterUserAgent: string | null;
  subject: string;
  description: string;
  targetKind: TicketTargetKind | null;
  targetId: string | null;
  targetUrl: string | null;
  claimedOwnership: string | null;
  swornStatement: boolean;
  attachmentUrls: string[];
  moderatorSlug: string | null;
  moderatorNote: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  slaDeadlineAt: string;
  createdAt: string;
  updatedAt: string;
};

export const TICKET_MIN_DESCRIPTION_CHARS = 40;
export const TICKET_MAX_DESCRIPTION_CHARS = 6000;
export const TICKET_MAX_ATTACHMENTS = 5;
export const TICKET_MAX_ATTACHMENT_BYTES = 6 * 1024 * 1024;
export const TICKET_RATE_LIMIT_PER_HOUR = 5;

/** SLA policy — how long admin has to first-respond, by severity.
 *  Urgent (CSAM, IP, DMCA) = 4 hours; high = 24; normal = 48; low = 5 days. */
function slaHoursForSeverity(sev: TicketSeverity): number {
  switch (sev) {
    case "urgent": return 4;
    case "high":   return 24;
    case "normal": return 48;
    case "low":    return 24 * 5;
  }
}

/** Auto-derive severity from ticket kind. CSAM + sexual are always
 *  urgent (safeguarding); DMCA + IP + defamation are high (legal);
 *  privacy is high (GDPR clock); rest default normal. */
export function severityForKind(kind: TicketKind): TicketSeverity {
  switch (kind) {
    case "csam_report":     return "urgent";
    case "sexual_content":  return "urgent";
    case "dmca_takedown":   return "high";
    case "ip_infringement": return "high";
    case "defamation":      return "high";
    case "privacy_request": return "high";
    default:                return "normal";
  }
}

/** Validation. Returns first error encountered or null on OK. */
export type TicketInput = {
  kind?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  subject?: string;
  description?: string;
  targetKind?: string;
  targetId?: string;
  targetUrl?: string;
  claimedOwnership?: string;
  swornStatement?: boolean;
  consented?: boolean;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_KINDS = new Set<TicketKind>([
  "dmca_takedown","ip_infringement","content_report","csam_report",
  "sexual_content","defamation","privacy_request","account","billing","general"
]);
const VALID_TARGET_KINDS = new Set<TicketTargetKind>([
  "canteen_post","image","canteen","trade","submission","product","quote_request","other"
]);

export function validateTicketInput(input: TicketInput): string | null {
  const kind = (input.kind ?? "").trim();
  if (!VALID_KINDS.has(kind as TicketKind)) return "invalid-kind";

  const name = (input.reporterName ?? "").trim();
  if (name.length < 2) return "name-too-short";
  if (name.length > 120) return "name-too-long";

  const email = (input.reporterEmail ?? "").trim();
  if (!EMAIL_RE.test(email)) return "invalid-email";

  const subject = (input.subject ?? "").trim();
  if (subject.length < 4) return "subject-too-short";
  if (subject.length > 200) return "subject-too-long";

  const description = (input.description ?? "").trim();
  if (description.length < TICKET_MIN_DESCRIPTION_CHARS) return "description-too-short";
  if (description.length > TICKET_MAX_DESCRIPTION_CHARS) return "description-too-long";

  if (input.targetKind && !VALID_TARGET_KINDS.has(input.targetKind as TicketTargetKind)) {
    return "invalid-target-kind";
  }

  // DMCA / IP claims require the sworn-under-penalty-of-perjury tick.
  // This is what makes the takedown legally actionable AND lets us
  // reject bad-faith reports.
  if ((kind === "dmca_takedown" || kind === "ip_infringement") && input.swornStatement !== true) {
    return "sworn-statement-required";
  }

  if (input.consented !== true) return "consent-required";

  return null;
}

/** Rate limit — no more than TICKET_RATE_LIMIT_PER_HOUR tickets
 *  per IP per rolling hour. Blocks obvious form spam without
 *  needing captcha. */
export async function isTicketRateLimited(ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = await supabaseAdmin
    .from("networkers_support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("reporter_ip", ip)
    .gte("created_at", hourAgo);
  if (res.error) return false;
  return (res.count ?? 0) >= TICKET_RATE_LIMIT_PER_HOUR;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function shapeTicket(r: any): SupportTicket {
  return {
    id:                r.id,
    kind:              r.kind,
    severity:          r.severity,
    status:            r.status,
    reporterName:      r.reporter_name,
    reporterEmail:     r.reporter_email,
    reporterPhone:     r.reporter_phone ?? null,
    reporterSlug:      r.reporter_slug ?? null,
    reporterIp:        r.reporter_ip ?? null,
    reporterUserAgent: r.reporter_user_agent ?? null,
    subject:           r.subject,
    description:       r.description,
    targetKind:        r.target_kind ?? null,
    targetId:          r.target_id ?? null,
    targetUrl:         r.target_url ?? null,
    claimedOwnership:  r.claimed_ownership ?? null,
    swornStatement:    r.sworn_statement,
    attachmentUrls:    (r.attachment_urls ?? []) as string[],
    moderatorSlug:     r.moderator_slug ?? null,
    moderatorNote:     r.moderator_note ?? null,
    resolution:        r.resolution ?? null,
    resolvedAt:        r.resolved_at ?? null,
    slaDeadlineAt:     r.sla_deadline_at,
    createdAt:         r.created_at,
    updatedAt:         r.updated_at
  };
}

export async function insertTicket(params: {
  kind: TicketKind;
  reporterName: string;
  reporterEmail: string;
  reporterPhone: string | null;
  reporterSlug: string | null;
  reporterIp: string | null;
  reporterUserAgent: string | null;
  subject: string;
  description: string;
  targetKind: TicketTargetKind | null;
  targetId: string | null;
  targetUrl: string | null;
  claimedOwnership: string | null;
  swornStatement: boolean;
  attachmentUrls: string[];
}): Promise<SupportTicket | null> {
  const severity = severityForKind(params.kind);
  const slaHours = slaHoursForSeverity(severity);
  const slaDeadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

  const res = await supabaseAdmin
    .from("networkers_support_tickets")
    .insert({
      kind:                params.kind,
      severity,
      status:              "open",
      reporter_name:       params.reporterName,
      reporter_email:      params.reporterEmail,
      reporter_phone:      params.reporterPhone,
      reporter_slug:       params.reporterSlug,
      reporter_ip:         params.reporterIp,
      reporter_user_agent: params.reporterUserAgent,
      subject:             params.subject,
      description:         params.description,
      target_kind:         params.targetKind,
      target_id:           params.targetId,
      target_url:          params.targetUrl,
      claimed_ownership:   params.claimedOwnership,
      sworn_statement:     params.swornStatement,
      attachment_urls:     params.attachmentUrls,
      sla_deadline_at:     slaDeadline.toISOString()
    })
    .select("*")
    .single();

  if (res.error || !res.data) {
    // eslint-disable-next-line no-console
    console.error("[supportTickets] insert failed", res.error);
    return null;
  }

  const ticket = shapeTicket(res.data);

  // Auto-hide content when the report is CSAM or sexual and the
  // target is a hidable content row. This is the "guilty until
  // proven innocent" pattern that protects the platform — admin
  // can restore if the report was malicious, but every second
  // CSAM stays up is a legal + reputational catastrophe.
  const shouldAutoHide =
    (ticket.kind === "csam_report" || ticket.kind === "sexual_content") &&
    ticket.targetKind &&
    ticket.targetId &&
    AUTO_HIDE_TARGET_TABLES[ticket.targetKind];
  if (shouldAutoHide) {
    const table = AUTO_HIDE_TARGET_TABLES[ticket.targetKind!]!;
    try {
      await supabaseAdmin
        .from(table)
        .update({
          moderation_hidden_at: new Date().toISOString(),
          moderation_hidden_reason: `auto-hidden: ${ticket.kind} ticket ${ticket.id}`
        })
        .eq("id", ticket.targetId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[supportTickets] auto-hide failed (non-fatal)", err);
    }
  }

  return ticket;
}

/** Admin queue read — open + reviewing tickets, urgent first,
 *  overdue-SLA next. */
export async function ticketQueue(limit = 100): Promise<SupportTicket[]> {
  const res = await supabaseAdmin
    .from("networkers_support_tickets")
    .select("*")
    .in("status", ["open", "reviewing", "action_required"])
    .order("severity", { ascending: true })   // urgent first (lex sort — 'h','l','n','u' — reverse below)
    .order("sla_deadline_at", { ascending: true })
    .limit(limit);
  if (res.error || !res.data) return [];
  // Re-sort so urgent > high > normal > low regardless of lex order.
  const severityRank: Record<TicketSeverity, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
  return res.data
    .map(shapeTicket)
    .sort((a, b) => {
      const sr = severityRank[a.severity] - severityRank[b.severity];
      if (sr !== 0) return sr;
      return a.slaDeadlineAt.localeCompare(b.slaDeadlineAt);
    });
}

/** Moderator action — resolve / close / escalate / mark spam.
 *  When action='restore_content' AND targetKind is auto-hideable,
 *  clear the moderation_hidden flags. */
export async function moderateTicket(params: {
  id: string;
  moderatorSlug: string;
  status: TicketStatus;
  resolution?: string | null;
  moderatorNote?: string | null;
  restoreContent?: boolean;
}): Promise<SupportTicket | null> {
  const patch: Record<string, unknown> = {
    status:         params.status,
    moderator_slug: params.moderatorSlug,
    moderator_note: params.moderatorNote ?? null,
    resolution:     params.resolution ?? null
  };
  if (params.status === "resolved" || params.status === "closed") {
    patch.resolved_at = new Date().toISOString();
  }
  const res = await supabaseAdmin
    .from("networkers_support_tickets")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();
  if (res.error || !res.data) return null;
  const ticket = shapeTicket(res.data);

  if (params.restoreContent && ticket.targetKind && ticket.targetId) {
    const table = AUTO_HIDE_TARGET_TABLES[ticket.targetKind];
    if (table) {
      await supabaseAdmin
        .from(table)
        .update({ moderation_hidden_at: null, moderation_hidden_reason: null })
        .eq("id", ticket.targetId);
    }
  }
  return ticket;
}

/** Upload attachment to support-attachments bucket. */
export async function uploadTicketAttachment(params: {
  file: File;
  reporterName: string;
}): Promise<string | null> {
  if (params.file.size > TICKET_MAX_ATTACHMENT_BYTES) return null;
  if (!params.file.type.startsWith("image/") && params.file.type !== "application/pdf") return null;

  const ext = params.file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
  const nameSlug = params.reporterName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "reporter";
  const path = `${nameSlug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = await params.file.arrayBuffer();
  const up = await supabaseAdmin.storage
    .from("support-attachments")
    .upload(path, buffer, { contentType: params.file.type, upsert: false });
  if (up.error) return null;
  return supabaseAdmin.storage
    .from("support-attachments")
    .getPublicUrl(up.data.path).data.publicUrl ?? null;
}
