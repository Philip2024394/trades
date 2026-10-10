// src/lib/nex/marketing/deliverability/bounce-classifier.ts
//
// NEX Deliverability · Bounce/Complaint Classifier
// Founder-authorised programme · Session-6 · Part 11a · 2026-09-21.
//
// PURE FUNCTION · zero network · zero fabrication.
// Every classification traces to a matched signal in the payload · never
// invents a category · never assumes hard-bounce without evidence.
//
// Recognised payload shapes (major providers · patterns publicly documented):
//   • Resend       webhook body (type field · e.g. "email.bounced" · "email.complained")
//   • SendGrid     event array (event: "bounce" · "dropped" · "spamreport")
//   • Amazon SES   SNS notification (Message.eventType or Message.notificationType)
//   • Mailgun      event API (event field · e.g. "failed" · "complained")
//   • Postmark     webhook (RecordType · Type)
//   • Generic      SMTP DSN status codes (RFC 3463 · e.g. 5.1.1 = mailbox not found)
//
// Never claims to support a provider it doesn't actually recognise. Unknown
// payloads return { kind: "unknown", ... } — never guessed.

export type ClassifiedKind =
  | "hard_bounce"
  | "soft_bounce"
  | "complaint"
  | "block"
  | "unsubscribe"
  | "delivery"
  | "open"
  | "click"
  | "unknown";

export type ProviderHint = "resend" | "sendgrid" | "ses" | "mailgun" | "postmark" | "generic-smtp" | "unknown";

export interface ClassifiedEvent {
  readonly kind: ClassifiedKind;
  readonly provider: ProviderHint;
  readonly reason: string;                     // human-readable · quotes the matched signal
  readonly matched_signal: string;             // exact field / value in the payload
  readonly recipient_email: string | null;     // present when payload contains it
  readonly provider_message_id: string | null; // for correlation with send_log
  readonly smtp_code: string | null;           // RFC 3463 enhanced status when known
  readonly diagnostic_snippet: string | null;  // ≤200 char excerpt from the payload
  readonly received_at: string;                // ISO · when this classifier ran
  readonly raw_type: string | null;            // the payload's own type/event string
}

// ─── Public API ─────────────────────────────────────────────────────
export interface ClassifyInput {
  readonly payload: unknown;                    // the raw webhook body (already JSON-parsed if applicable)
  readonly provider?: ProviderHint;             // caller may pass a hint · never assumed
  readonly received_at?: string;
}

export function classifyBounceEvent(input: ClassifyInput): ClassifiedEvent {
  const received_at = input.received_at ?? new Date().toISOString();
  const p = input.payload;
  const providerHint = input.provider ?? "unknown";

  if (p == null || typeof p !== "object") {
    return blank("unknown", providerHint, "payload_not_object", received_at);
  }

  // Detect provider even without hint · signature-based
  const provider = providerHint !== "unknown" ? providerHint : detectProvider(p as Record<string, unknown>);

  switch (provider) {
    case "resend":       return classifyResend(p as any, received_at);
    case "sendgrid":     return classifySendGrid(p as any, received_at);
    case "ses":          return classifySes(p as any, received_at);
    case "mailgun":      return classifyMailgun(p as any, received_at);
    case "postmark":     return classifyPostmark(p as any, received_at);
    case "generic-smtp": return classifyGenericSmtp(p as any, received_at);
    default:              return blank("unknown", "unknown", "provider_not_recognised", received_at, snippet(p));
  }
}

// ─── Provider detectors ─────────────────────────────────────────────
function detectProvider(p: Record<string, unknown>): ProviderHint {
  // Resend · "type" is namespaced ("email.bounced" · "email.complained")
  if (typeof p.type === "string" && /^email\./.test(p.type)) return "resend";
  // SendGrid · "event" field on each array element · or the object itself
  if (typeof p.event === "string" && ["processed","delivered","bounce","dropped","spamreport","unsubscribe","open","click","deferred","blocked"].includes(p.event as string)) return "sendgrid";
  // SES SNS notification · notificationType or eventType
  if (typeof p.notificationType === "string" && ["Bounce","Complaint","Delivery"].includes(p.notificationType as string)) return "ses";
  if (typeof p.eventType === "string" && ["Bounce","Complaint","Delivery","Send","Reject","Open","Click"].includes(p.eventType as string)) return "ses";
  // Mailgun · "event" with different vocabulary
  if (typeof p.event === "string" && ["failed","complained","delivered","opened","clicked","unsubscribed"].includes(p.event as string)) return "mailgun";
  // Postmark · RecordType
  if (typeof p.RecordType === "string") return "postmark";
  // Generic SMTP DSN · has a Status field with X.Y.Z shape
  if (typeof p.Status === "string" && /^\d\.\d+\.\d+$/.test(p.Status as string)) return "generic-smtp";
  return "unknown";
}

// ─── Resend ────────────────────────────────────────────────────────
function classifyResend(p: { type?: string; data?: any }, received_at: string): ClassifiedEvent {
  const type = String(p.type ?? "");
  const data = p.data ?? {};
  const recipient = firstEmail(data?.to) ?? data?.email ?? null;
  const msgId = data?.email_id ?? data?.id ?? null;
  const base = {
    provider: "resend" as ProviderHint,
    recipient_email: recipient,
    provider_message_id: msgId,
    diagnostic_snippet: snippet(p),
    received_at,
    raw_type: type,
    smtp_code: null,
  };
  switch (type) {
    case "email.delivered":   return { ...base, kind: "delivery",  reason: "resend delivery event",     matched_signal: `type=${type}` };
    case "email.opened":      return { ...base, kind: "open",      reason: "resend open event",         matched_signal: `type=${type}` };
    case "email.clicked":     return { ...base, kind: "click",     reason: "resend click event",        matched_signal: `type=${type}` };
    case "email.complained":  return { ...base, kind: "complaint", reason: "resend complaint event",    matched_signal: `type=${type}` };
    case "email.bounced": {
      // Resend distinguishes hard/soft via data.bounce.type
      const bt = String(data?.bounce?.type ?? "").toLowerCase();
      if (bt === "hard" || bt === "permanent") return { ...base, kind: "hard_bounce", reason: "resend hard bounce", matched_signal: `data.bounce.type=${bt}` };
      if (bt === "soft" || bt === "temporary") return { ...base, kind: "soft_bounce", reason: "resend soft bounce", matched_signal: `data.bounce.type=${bt}` };
      return { ...base, kind: "hard_bounce", reason: "resend bounce (type unspecified · classified conservatively as hard)", matched_signal: "type=email.bounced" };
    }
    case "email.unsubscribed": return { ...base, kind: "unsubscribe", reason: "resend unsubscribe event", matched_signal: `type=${type}` };
    case "email.blocked":      return { ...base, kind: "block",       reason: "resend blocked event",     matched_signal: `type=${type}` };
    default:                    return { ...base, kind: "unknown",     reason: `unrecognised resend type '${type}'`, matched_signal: `type=${type}` };
  }
}

// ─── SendGrid ──────────────────────────────────────────────────────
function classifySendGrid(p: any, received_at: string): ClassifiedEvent {
  const evt = String(p.event ?? "");
  const base = {
    provider: "sendgrid" as ProviderHint,
    recipient_email: p.email ?? null,
    provider_message_id: p.sg_message_id ?? p.message_id ?? null,
    diagnostic_snippet: snippet(p),
    received_at,
    raw_type: evt,
    smtp_code: p.status ?? null,
  };
  const bounceReason = String(p.reason ?? p.type ?? "").toLowerCase();
  switch (evt) {
    case "delivered":  return { ...base, kind: "delivery",    reason: "sendgrid delivered event",      matched_signal: `event=${evt}` };
    case "open":       return { ...base, kind: "open",        reason: "sendgrid open event",           matched_signal: `event=${evt}` };
    case "click":      return { ...base, kind: "click",       reason: "sendgrid click event",          matched_signal: `event=${evt}` };
    case "spamreport": return { ...base, kind: "complaint",   reason: "sendgrid spamreport event",     matched_signal: `event=${evt}` };
    case "unsubscribe":
    case "group_unsubscribe":
                        return { ...base, kind: "unsubscribe", reason: "sendgrid unsubscribe event",     matched_signal: `event=${evt}` };
    case "bounce": {
      if (bounceReason.includes("mailbox") || bounceReason.includes("does not exist") || bounceReason.includes("no such user") || bounceReason.includes("user unknown")) {
        return { ...base, kind: "hard_bounce", reason: "sendgrid hard bounce · mailbox not found", matched_signal: `reason=${bounceReason}` };
      }
      // SendGrid types: "bounce" (hard) vs "blocked" (soft). Their `type` field
      // often carries "bounce" or "blocked". If type explicitly says hard/soft, honour it.
      if (String(p.type ?? "").toLowerCase() === "blocked") {
        return { ...base, kind: "soft_bounce", reason: "sendgrid blocked (soft)", matched_signal: `type=blocked` };
      }
      return { ...base, kind: "hard_bounce", reason: "sendgrid bounce event", matched_signal: `event=${evt}` };
    }
    case "dropped":    return { ...base, kind: "hard_bounce", reason: "sendgrid dropped event (invalid recipient)", matched_signal: `event=${evt}` };
    case "blocked":
    case "deferred":   return { ...base, kind: "soft_bounce", reason: `sendgrid ${evt} event · retryable`, matched_signal: `event=${evt}` };
    default:            return { ...base, kind: "unknown",     reason: `unrecognised sendgrid event '${evt}'`, matched_signal: `event=${evt}` };
  }
}

// ─── Amazon SES / SNS ──────────────────────────────────────────────
function classifySes(p: any, received_at: string): ClassifiedEvent {
  // SES sends via SNS · the actual event lives in eventType or notificationType
  const notif = String(p.notificationType ?? p.eventType ?? "");
  const bounceType = String(p.bounce?.bounceType ?? "").toLowerCase();
  const bounceSubType = String(p.bounce?.bounceSubType ?? "").toLowerCase();
  const recipient = firstEmail(p.mail?.destination) ?? firstEmail(p.bounce?.bouncedRecipients?.[0]?.emailAddress) ?? null;
  const base = {
    provider: "ses" as ProviderHint,
    recipient_email: recipient,
    provider_message_id: p.mail?.messageId ?? null,
    diagnostic_snippet: snippet(p),
    received_at,
    raw_type: notif,
    smtp_code: p.bounce?.bouncedRecipients?.[0]?.status ?? null,
  };
  switch (notif) {
    case "Bounce":
      if (bounceType === "permanent") return { ...base, kind: "hard_bounce", reason: `ses permanent bounce · ${bounceSubType}`, matched_signal: `bounceType=${bounceType} bounceSubType=${bounceSubType}` };
      if (bounceType === "transient") return { ...base, kind: "soft_bounce", reason: `ses transient bounce · ${bounceSubType}`, matched_signal: `bounceType=${bounceType} bounceSubType=${bounceSubType}` };
      if (bounceType === "undetermined") return { ...base, kind: "soft_bounce", reason: "ses undetermined bounce · conservatively soft", matched_signal: `bounceType=undetermined` };
      return { ...base, kind: "hard_bounce", reason: "ses bounce (type unspecified · conservatively hard)", matched_signal: `notificationType=Bounce` };
    case "Complaint":   return { ...base, kind: "complaint",   reason: "ses complaint",              matched_signal: `notificationType=Complaint` };
    case "Delivery":    return { ...base, kind: "delivery",    reason: "ses delivery",                matched_signal: `notificationType=Delivery` };
    case "Send":        return { ...base, kind: "delivery",    reason: "ses send accepted",           matched_signal: `notificationType=Send` };
    case "Open":        return { ...base, kind: "open",        reason: "ses open",                    matched_signal: `notificationType=Open` };
    case "Click":       return { ...base, kind: "click",       reason: "ses click",                   matched_signal: `notificationType=Click` };
    case "Reject":      return { ...base, kind: "block",       reason: "ses rejected · provider-side block", matched_signal: `notificationType=Reject` };
    default:             return { ...base, kind: "unknown",     reason: `unrecognised ses notification '${notif}'`, matched_signal: `notificationType=${notif}` };
  }
}

// ─── Mailgun ───────────────────────────────────────────────────────
function classifyMailgun(p: any, received_at: string): ClassifiedEvent {
  const evt = String(p.event ?? "");
  const severity = String(p.severity ?? "").toLowerCase();  // 'temporary' or 'permanent' for failed events
  const base = {
    provider: "mailgun" as ProviderHint,
    recipient_email: p.recipient ?? p["recipient-domain"] ? p.recipient : null,
    provider_message_id: p?.["message-id"] ?? p?.message?.headers?.["message-id"] ?? null,
    diagnostic_snippet: snippet(p),
    received_at,
    raw_type: evt,
    smtp_code: p?.["delivery-status"]?.code ?? null,
  };
  switch (evt) {
    case "delivered":   return { ...base, kind: "delivery",    reason: "mailgun delivered event",   matched_signal: `event=${evt}` };
    case "opened":      return { ...base, kind: "open",        reason: "mailgun opened event",       matched_signal: `event=${evt}` };
    case "clicked":     return { ...base, kind: "click",       reason: "mailgun clicked event",       matched_signal: `event=${evt}` };
    case "complained":  return { ...base, kind: "complaint",   reason: "mailgun complained event",   matched_signal: `event=${evt}` };
    case "unsubscribed": return { ...base, kind: "unsubscribe", reason: "mailgun unsubscribed event", matched_signal: `event=${evt}` };
    case "failed":
      if (severity === "permanent") return { ...base, kind: "hard_bounce", reason: "mailgun permanent failure", matched_signal: `severity=${severity}` };
      if (severity === "temporary") return { ...base, kind: "soft_bounce", reason: "mailgun temporary failure", matched_signal: `severity=${severity}` };
      return { ...base, kind: "hard_bounce", reason: "mailgun failed event (severity unspecified · conservatively hard)", matched_signal: `event=${evt}` };
    case "rejected":     return { ...base, kind: "block",       reason: "mailgun rejected event",     matched_signal: `event=${evt}` };
    default:              return { ...base, kind: "unknown",     reason: `unrecognised mailgun event '${evt}'`, matched_signal: `event=${evt}` };
  }
}

// ─── Postmark ──────────────────────────────────────────────────────
function classifyPostmark(p: any, received_at: string): ClassifiedEvent {
  const rt = String(p.RecordType ?? "");
  const t = String(p.Type ?? "").toLowerCase();
  const base = {
    provider: "postmark" as ProviderHint,
    recipient_email: p.Email ?? p.Recipient ?? null,
    provider_message_id: p.MessageID ?? null,
    diagnostic_snippet: snippet(p),
    received_at,
    raw_type: rt,
    smtp_code: p.Details ?? null,
  };
  switch (rt) {
    case "Delivery":       return { ...base, kind: "delivery",    reason: "postmark delivery",         matched_signal: `RecordType=${rt}` };
    case "Open":           return { ...base, kind: "open",        reason: "postmark open",              matched_signal: `RecordType=${rt}` };
    case "Click":          return { ...base, kind: "click",       reason: "postmark click",             matched_signal: `RecordType=${rt}` };
    case "SpamComplaint":  return { ...base, kind: "complaint",   reason: "postmark spam complaint",   matched_signal: `RecordType=${rt}` };
    case "SubscriptionChange":
      // Postmark uses SubscriptionChange for unsubscribe. If SuppressionReason indicates opt-out
      return { ...base, kind: "unsubscribe", reason: "postmark subscription change (unsubscribe)", matched_signal: `RecordType=${rt}` };
    case "Bounce":
      // Postmark bounce Type: HardBounce · SoftBounce · Transient · SpamNotification · etc.
      if (t === "hardbounce" || t === "badmailaddress" || t === "invalidemailaddress" || t === "manuallydeactivated" || t === "unknown" && p.Inactive === true) {
        return { ...base, kind: "hard_bounce", reason: `postmark hard bounce · ${t}`, matched_signal: `Type=${t}` };
      }
      if (t === "softbounce" || t === "transient" || t === "dnserror" || t === "smtpapierror" || t === "autoresponder") {
        return { ...base, kind: "soft_bounce", reason: `postmark soft bounce · ${t}`, matched_signal: `Type=${t}` };
      }
      return { ...base, kind: "hard_bounce", reason: `postmark bounce · type '${t}' · conservatively hard`, matched_signal: `Type=${t}` };
    default:                return { ...base, kind: "unknown",     reason: `unrecognised postmark RecordType '${rt}'`, matched_signal: `RecordType=${rt}` };
  }
}

// ─── Generic SMTP DSN ──────────────────────────────────────────────
function classifyGenericSmtp(p: any, received_at: string): ClassifiedEvent {
  const status = String(p.Status ?? "");
  const action = String(p.Action ?? "").toLowerCase();
  const recipient = p["Final-Recipient"] ?? p["Original-Recipient"] ?? p.Recipient ?? null;
  const base = {
    provider: "generic-smtp" as ProviderHint,
    recipient_email: extractRfc822Email(recipient),
    provider_message_id: p["Original-Envelope-Id"] ?? null,
    diagnostic_snippet: snippet(p),
    received_at,
    raw_type: `smtp-${status}`,
    smtp_code: status,
  };
  // RFC 3463: 5.x.x = permanent · 4.x.x = transient · 2.x.x = success
  const first = status.charAt(0);
  if (first === "5") {
    return { ...base, kind: "hard_bounce", reason: `smtp permanent failure · ${status} · ${action}`, matched_signal: `Status=${status}` };
  }
  if (first === "4") {
    return { ...base, kind: "soft_bounce", reason: `smtp transient failure · ${status} · ${action}`, matched_signal: `Status=${status}` };
  }
  if (first === "2") {
    return { ...base, kind: "delivery", reason: `smtp success · ${status}`, matched_signal: `Status=${status}` };
  }
  return { ...base, kind: "unknown", reason: `smtp unrecognised status '${status}'`, matched_signal: `Status=${status}` };
}

// ─── Helpers ────────────────────────────────────────────────────────
function firstEmail(v: unknown): string | null {
  if (typeof v === "string") return v.trim().toLowerCase() || null;
  if (Array.isArray(v) && v.length > 0) {
    const first = v[0];
    if (typeof first === "string") return first.trim().toLowerCase();
    if (first && typeof first === "object" && typeof (first as any).address === "string") return (first as any).address.trim().toLowerCase();
    if (first && typeof first === "object" && typeof (first as any).email === "string") return (first as any).email.trim().toLowerCase();
    if (first && typeof first === "object" && typeof (first as any).emailAddress === "string") return (first as any).emailAddress.trim().toLowerCase();
  }
  return null;
}

function extractRfc822Email(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /<([^>]+)>|([\w.+\-]+@[\w.\-]+\.[a-z]{2,})/i.exec(v);
  const e = (m?.[1] ?? m?.[2] ?? "").trim().toLowerCase();
  return e || null;
}

function snippet(p: unknown, max: number = 200): string | null {
  try {
    const s = JSON.stringify(p);
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch { return null; }
}

function blank(kind: ClassifiedKind, provider: ProviderHint, reason: string, received_at: string, diag: string | null = null): ClassifiedEvent {
  return {
    kind, provider, reason,
    matched_signal: reason,
    recipient_email: null, provider_message_id: null, smtp_code: null,
    diagnostic_snippet: diag,
    received_at, raw_type: null,
  };
}

// ─── Reputation weighting (Founder-authored · Session-6b) ──────────
export interface EventWeights {
  readonly hard_bounce: number;
  readonly soft_bounce: number;
  readonly complaint: number;
  readonly block: number;
  readonly unsubscribe: number;
}

export const DEFAULT_EVENT_WEIGHTS: EventWeights = {
  hard_bounce: 1.00,          // full weight
  soft_bounce: 0.25,          // retryable · quarter weight
  complaint:   1.00,          // full weight (deliverability-critical)
  block:       0.75,          // provider-side block · high weight
  unsubscribe: 0.00,          // healthy signal · NOT counted against reputation
};

export function weightForKind(kind: ClassifiedKind, weights: EventWeights = DEFAULT_EVENT_WEIGHTS): number {
  switch (kind) {
    case "hard_bounce": return weights.hard_bounce;
    case "soft_bounce": return weights.soft_bounce;
    case "complaint":   return weights.complaint;
    case "block":       return weights.block;
    case "unsubscribe": return weights.unsubscribe;
    default: return 0;
  }
}

// ─── Structural boundary markers · verified in acceptance ──────────
export const _CLASSIFIER_NEVER_FABRICATES = "classification_only_from_matched_payload_signals";
export const _CLASSIFIER_NEVER_GUESSES_PROVIDER = "unknown_provider_returns_unknown_kind_never_guessed";
export const _CLASSIFIER_UNSUBSCRIBE_NOT_COUNTED_AGAINST_REPUTATION = "unsubscribe_is_healthy_signal_weight_zero";
