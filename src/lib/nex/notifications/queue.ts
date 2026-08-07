// NEX Notifications Runtime · queue
//
// Per-channel in-memory queue with retry. Registry-resolved on every
// send · same doctrine as the Email Runtime:
//
//   Consumer → Registry → Alias Resolution → Canonical Contact →
//   Compliance Check → Runtime → Provider

import { getNotifications } from "./registry";
import { notificationsAudit } from "./audit";
import { checkNotificationCompliance, type ComplianceContact } from "./compliance";
import type { NotificationChannel, NotificationMessage, NotificationSendResult } from "./types";
import { findContactByIdentifiers, loadContactById } from "@/lib/nex/contacts/registry";
import { resolveAlias } from "@/lib/nex/contacts/merge";

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_BACKOFF_MS = 500;

export type SendJob = {
  message: NotificationMessage;
  contact?: ComplianceContact & { contact_id?: string };
  caller: string;
  campaign_id?: string;
  business_id?: string;
};

type PerChannelStats = { sent: number; blocked: number; failed: number };
type Snapshot = Record<NotificationChannel, PerChannelStats>;

class NotificationsQueue {
  private stats: Snapshot = {
    whatsapp: { sent: 0, blocked: 0, failed: 0 },
    sms:      { sent: 0, blocked: 0, failed: 0 },
    push:     { sent: 0, blocked: 0, failed: 0 },
    in_app:   { sent: 0, blocked: 0, failed: 0 },
  };
  private readonly maxRetries = DEFAULT_MAX_RETRIES;
  private readonly baseBackoff = DEFAULT_BASE_BACKOFF_MS;

  snapshot(): Snapshot { return this.stats; }

  async enqueue(job: SendJob): Promise<NotificationSendResult & { blocked?: true }> {
    const to = job.message.to[0];
    if (!to) return { ok: false, provider: "queue", reason: "no recipient", retryable: false };

    // Phase 3d.2 · Registry resolution (mirrors Email Runtime)
    let canonical: (ComplianceContact & { contact_id?: string }) | null = null;
    let aliasResolved = false;
    try {
      if (job.contact?.contact_id) {
        const canonicalId = await resolveAlias(job.contact.contact_id);
        aliasResolved = canonicalId !== job.contact.contact_id;
        const c = await loadContactById(canonicalId);
        if (c) {
          canonical = {
            phone: c.phone,
            email: c.email,
            never_contact: c.never_contact,
            unsubscribe_at: c.unsubscribe_at,
            consent_marketing: c.consent_marketing,
            consent_transactional: c.consent_transactional,
            contact_id: c.contact_id,
          };
        }
      }
      if (!canonical && (job.message.channel === "whatsapp" || job.message.channel === "sms") && to.address) {
        const c = await findContactByIdentifiers({ phone: to.address });
        if (c) {
          canonical = {
            phone: c.phone,
            email: c.email,
            never_contact: c.never_contact,
            unsubscribe_at: c.unsubscribe_at,
            consent_marketing: c.consent_marketing,
            consent_transactional: c.consent_transactional,
            contact_id: c.contact_id,
          };
        }
      }
    } catch {
      // Registry unreachable · fall back to caller-supplied or consent-unknown
    }

    const complianceContact: ComplianceContact = canonical ?? job.contact ?? {
      phone: to.address,
      consent_marketing: null,
      consent_transactional: null,
    };
    const resolvedContactId = canonical?.contact_id ?? job.contact?.contact_id ?? null;
    const gate = checkNotificationCompliance(complianceContact, job.message.channel, job.message.kind, to.address);

    if (!gate.allowed) {
      this.stats[job.message.channel].blocked += 1;
      await notificationsAudit.blocked({
        contact_id: resolvedContactId,
        to_address: to.address,
        channel: job.message.channel,
        kind: job.message.kind,
        campaign_id: job.campaign_id ?? null,
        business_id: job.business_id ?? null,
        caller: job.caller,
        reason: gate.reason,
        detail: gate.detail,
        registry_resolved: !!canonical,
        alias_resolved: aliasResolved,
      });
      return { ok: false, provider: "queue", reason: `blocked: ${gate.reason} · ${gate.detail}`, retryable: false, blocked: true };
    }

    // Send with retry via the channel's adapter
    const adapter = getNotifications(job.message.channel);
    let attempt = 0;
    let last: NotificationSendResult & { ok: false } = { ok: false, provider: adapter.name, reason: "no attempt", retryable: false };
    while (attempt <= this.maxRetries) {
      const started = Date.now();
      const result = await adapter.send(job.message);
      const latency = Date.now() - started;
      if (result.ok) {
        this.stats[job.message.channel].sent += 1;
        await notificationsAudit.sent({
          contact_id: resolvedContactId,
          to_address: to.address,
          channel: job.message.channel,
          kind: job.message.kind,
          campaign_id: job.campaign_id ?? null,
          business_id: job.business_id ?? null,
          caller: job.caller,
          provider: result.provider,
          provider_message_id: result.provider_message_id,
          latency_ms: latency,
          registry_resolved: !!canonical,
          alias_resolved: aliasResolved,
        });
        return result;
      }
      last = result;
      if (!result.retryable || attempt === this.maxRetries) break;
      await new Promise((r) => setTimeout(r, this.baseBackoff * 2 ** attempt));
      attempt += 1;
    }

    this.stats[job.message.channel].failed += 1;
    await notificationsAudit.failed({
      contact_id: resolvedContactId,
      to_address: to.address,
      channel: job.message.channel,
      kind: job.message.kind,
      campaign_id: job.campaign_id ?? null,
      business_id: job.business_id ?? null,
      caller: job.caller,
      provider: last.provider,
      reason: last.reason,
      retryable: last.retryable,
      latency_ms: 0,
      registry_resolved: !!canonical,
      alias_resolved: aliasResolved,
    });
    return last;
  }
}

let queue: NotificationsQueue | null = null;
export function getNotificationsQueue(): NotificationsQueue {
  if (!queue) queue = new NotificationsQueue();
  return queue;
}

/** Single entry point for every caller · mirrors sendEmail() from the Email Runtime. */
export async function sendNotification(job: SendJob): Promise<NotificationSendResult & { blocked?: true }> {
  return getNotificationsQueue().enqueue(job);
}
