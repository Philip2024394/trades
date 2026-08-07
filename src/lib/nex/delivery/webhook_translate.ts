// NEX Delivery · webhook event translation
//
// Each provider webhook fires with its own event vocabulary. This
// module translates each provider's shape into the CANONICAL event
// stream (src/lib/nex/analytics/types.ts) so downstream analytics
// stays provider-agnostic (Philip 2026-08-08 doctrine).
//
// One function per provider. Each returns an array of AnalyticsEvent
// objects ready to be ingested via /api/nex/analytics/ingest.

import type { AnalyticsEvent, EventType } from "@/lib/nex/analytics/types";

// ── Shared helpers ────────────────────────────────────────────────
function domainOf(email: string | undefined | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : null;
}

function iso(ts: string | number | undefined | null): string | undefined {
  if (ts === undefined || ts === null) return undefined;
  if (typeof ts === "number") return new Date(ts * (ts < 1e11 ? 1000 : 1)).toISOString();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

// ── SendGrid ──────────────────────────────────────────────────────
// Payload: JSON array of events with fields:
//   event ('processed' | 'delivered' | 'open' | 'click' | 'bounce' | 'dropped' |
//          'spamreport' | 'unsubscribe' | 'group_unsubscribe' | 'deferred')
//   email · timestamp · sg_message_id · sg_event_id · type (for bounce: 'bounce' | 'blocked')
//   custom_args carries our campaign_id/recipient_contact_id/segment_id
export function translateSendGrid(body: unknown): AnalyticsEvent[] {
  if (!Array.isArray(body)) return [];
  const out: AnalyticsEvent[] = [];
  for (const raw of body as Array<Record<string, unknown>>) {
    const type = mapSendGridType(String(raw.event ?? ""));
    if (!type) continue;
    const email = String(raw.email ?? "");
    const args = (raw as { custom_args?: Record<string, string> }).custom_args ?? {};
    out.push({
      event_type: type,
      event_timestamp: iso(raw.timestamp as number | string),
      campaign_id: args.campaign_id ?? null,
      recipient_id: args.recipient_contact_id ?? null,
      segment_id: args.segment_id ?? null,
      provider: "sendgrid",
      country: null,
      domain: domainOf(email),
      provider_message_id: (raw.sg_message_id as string | undefined) ?? null,
      user_agent: (raw.useragent as string | undefined) ?? null,
      ip: (raw.ip as string | undefined) ?? null,
      link_url: (raw.url as string | undefined) ?? null,
      metadata: { raw_event: raw.event, sg_event_id: raw.sg_event_id, reason: raw.reason, status: raw.status, type: raw.type },
    });
  }
  return out;
}
function mapSendGridType(e: string): EventType | null {
  switch (e) {
    case "processed":         return "queued";
    case "delivered":         return "delivered";
    case "deferred":          return "deferred";
    case "open":              return "opened";
    case "click":             return "clicked";
    case "bounce":            return "bounced";
    case "dropped":           return "suppressed";
    case "spamreport":        return "complaint";
    case "unsubscribe":       return "unsubscribed";
    case "group_unsubscribe": return "unsubscribed";
    default: return null;
  }
}

// ── Mailgun ───────────────────────────────────────────────────────
// Payload: { signature: {...}, event-data: { event, timestamp, recipient, message: { headers: { message-id } }, user-variables: {...} } }
export function translateMailgun(body: unknown): AnalyticsEvent[] {
  const b = body as { "event-data"?: Record<string, unknown> } | null;
  const ed = b?.["event-data"];
  if (!ed) return [];
  const type = mapMailgunType(String(ed.event ?? ""));
  if (!type) return [];
  const recipient = String(ed.recipient ?? "");
  const uv = (ed["user-variables"] as Record<string, string> | undefined) ?? {};
  const message = ed.message as { headers?: { "message-id"?: string } } | undefined;
  const clientInfo = ed["client-info"] as { "user-agent"?: string; "client-name"?: string } | undefined;
  const geoloc = ed.geolocation as { country?: string } | undefined;

  return [{
    event_type: type,
    event_timestamp: iso(ed.timestamp as number),
    campaign_id: uv.campaign_id ?? null,
    recipient_id: uv.recipient_contact_id ?? null,
    segment_id: uv.segment_id ?? null,
    provider: "mailgun",
    country: geoloc?.country ?? null,
    domain: domainOf(recipient),
    provider_message_id: message?.headers?.["message-id"] ?? null,
    user_agent: clientInfo?.["user-agent"] ?? null,
    ip: (ed.ip as string | undefined) ?? null,
    link_url: (ed.url as string | undefined) ?? null,
    metadata: { raw_event: ed.event, severity: ed.severity, reason: ed.reason },
  }];
}
function mapMailgunType(e: string): EventType | null {
  switch (e) {
    case "accepted":               return "queued";
    case "delivered":              return "delivered";
    case "temporary_failure":      return "deferred";
    case "opened":                 return "opened";
    case "clicked":                return "clicked";
    case "failed":                 return "bounced";        // Mailgun uses 'failed' with severity for bounces
    case "complained":             return "complaint";
    case "unsubscribed":           return "unsubscribed";
    case "rejected":               return "suppressed";
    default: return null;
  }
}

// ── Postmark ──────────────────────────────────────────────────────
// Payload: JSON with RecordType = 'Delivery' | 'Open' | 'Click' | 'Bounce' | 'SpamComplaint' | 'SubscriptionChange'
// Metadata carries campaign_id/recipient_contact_id
export function translatePostmark(body: unknown): AnalyticsEvent[] {
  const b = body as Record<string, unknown> | null;
  if (!b) return [];
  const type = mapPostmarkType(String(b.RecordType ?? ""));
  if (!type) return [];
  const email = String(b.Recipient ?? b.Email ?? "");
  const meta = (b.Metadata as Record<string, string> | undefined) ?? {};
  const geo  = (b.Geo      as { CountryISOCode?: string } | undefined);

  return [{
    event_type: type,
    event_timestamp: iso(b.DeliveredAt as string ?? b.ReceivedAt as string ?? b.BouncedAt as string),
    campaign_id: meta.campaign_id ?? null,
    recipient_id: meta.recipient_contact_id ?? null,
    segment_id: meta.segment_id ?? null,
    provider: "postmark",
    country: geo?.CountryISOCode ?? null,
    domain: domainOf(email),
    provider_message_id: (b.MessageID as string | undefined) ?? null,
    user_agent: (b.UserAgent as string | undefined) ?? null,
    ip: (b.IP as string | undefined) ?? null,
    link_url: (b.OriginalLink as string | undefined) ?? null,
    metadata: { raw_type: b.RecordType, description: b.Description, type: b.Type, changed_at: b.ChangedAt },
  }];
}
function mapPostmarkType(t: string): EventType | null {
  switch (t) {
    case "Delivery":           return "delivered";
    case "Open":               return "opened";
    case "Click":              return "clicked";
    case "Bounce":             return "bounced";
    case "SpamComplaint":      return "complaint";
    case "SubscriptionChange": return "unsubscribed";
    default: return null;
  }
}

// ── Amazon SES (delivered via SNS) ────────────────────────────────
// SNS notification wraps the SES event in Message (JSON string):
//   { notificationType: 'Delivery' | 'Bounce' | 'Complaint' } OR
//   { eventType:        'Delivery' | 'Bounce' | 'Complaint' | 'Open' | 'Click' | 'Send' | 'Reject' | ... }
// Look for 'Tags' with our campaign_id/recipient_contact_id.
export function translateSes(sesMessage: Record<string, unknown>): AnalyticsEvent[] {
  const kindRaw = String(sesMessage.eventType ?? sesMessage.notificationType ?? "");
  const type = mapSesType(kindRaw);
  if (!type) return [];

  const mail    = sesMessage.mail as { destination?: string[]; messageId?: string; tags?: Record<string, string[]> } | undefined;
  const dest    = mail?.destination?.[0] ?? "";
  const tags    = mail?.tags ?? {};
  const bounce  = sesMessage.bounce   as { bouncedRecipients?: Array<{ emailAddress?: string }>; bounceType?: string; bounceSubType?: string } | undefined;
  const complaint = sesMessage.complaint as { complainedRecipients?: Array<{ emailAddress?: string }>; complaintFeedbackType?: string } | undefined;
  const open    = sesMessage.open     as { ipAddress?: string; userAgent?: string; timestamp?: string } | undefined;
  const click   = sesMessage.click    as { ipAddress?: string; userAgent?: string; timestamp?: string; link?: string } | undefined;
  const email   = bounce?.bouncedRecipients?.[0]?.emailAddress
               ?? complaint?.complainedRecipients?.[0]?.emailAddress
               ?? dest;

  return [{
    event_type: type,
    event_timestamp: iso((click?.timestamp ?? open?.timestamp ?? sesMessage.eventTimestamp) as string | undefined) ?? undefined,
    campaign_id:  tags.campaign_id?.[0] ?? null,
    recipient_id: tags.recipient_contact_id?.[0] ?? null,
    segment_id:   tags.segment_id?.[0] ?? null,
    provider: "ses",
    country: null,
    domain: domainOf(email),
    provider_message_id: mail?.messageId ?? null,
    user_agent: click?.userAgent ?? open?.userAgent ?? null,
    ip: click?.ipAddress ?? open?.ipAddress ?? null,
    link_url: click?.link ?? null,
    metadata: {
      raw_type: kindRaw,
      bounce_type: bounce?.bounceType, bounce_subtype: bounce?.bounceSubType,
      complaint_feedback_type: complaint?.complaintFeedbackType,
    },
  }];
}
function mapSesType(t: string): EventType | null {
  switch (t) {
    case "Send":       return "queued";
    case "Delivery":   return "delivered";
    case "Bounce":     return "bounced";
    case "Complaint":  return "complaint";
    case "Open":       return "opened";
    case "Click":      return "clicked";
    case "Reject":     return "suppressed";
    case "DeliveryDelay": return "deferred";
    default: return null;
  }
}
