// NEX Notifications · audit trail
//
// Every send / block / failure writes an event to nex.events via the
// storage layer. Same shape and doctrine as the Email audit · one event
// per attempted send · carries channel · registry_resolved · alias_resolved
// so the Consumer Adoption metrics stay accurate for the Notifications row.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { ComplianceReason } from "./compliance";
import type { NotificationChannel, NotificationKind } from "./types";

type BaseAudit = {
  contact_id?: string | null;
  to_address: string;
  channel: NotificationChannel;
  kind: NotificationKind;
  campaign_id?: string | null;
  business_id?: string | null;
  caller: string;
  registry_resolved?: boolean;
  alias_resolved?: boolean;
};

type SentAudit = BaseAudit & { provider: string; provider_message_id: string; latency_ms: number };
type BlockedAudit = BaseAudit & { reason: ComplianceReason; detail: string };
type FailedAudit = BaseAudit & { provider: string; reason: string; retryable: boolean; latency_ms: number };

async function write(eventType: string, outcome: "ok" | "blocked" | "failed", payload: Record<string, unknown>, business_id?: string | null) {
  const store = getStorage();
  await store.save(COLLECTIONS.events, {
    event_id: randomUUID(),
    event_type: eventType,
    source: "nex-notifications-runtime",
    actor_id: null,
    timestamp: new Date().toISOString(),
    business_id: business_id ?? null,
    related_department: "communications",
    related_brain: null,
    related_job: null,
    related_contact: (payload.contact_id as string) ?? null,
    outcome,
    payload,
    reversible: false,
    reverse_of: null,
    supersedes: null,
  });
}

export const notificationsAudit = {
  async sent(a: SentAudit) {
    await write("notification.sent", "ok", {
      contact_id: a.contact_id ?? null,
      to_address: a.to_address,
      channel: a.channel,
      kind: a.kind,
      campaign_id: a.campaign_id ?? null,
      caller: a.caller,
      provider: a.provider,
      provider_message_id: a.provider_message_id,
      latency_ms: a.latency_ms,
      registry_resolved: !!a.registry_resolved,
      alias_resolved: !!a.alias_resolved,
    }, a.business_id);
  },
  async blocked(a: BlockedAudit) {
    await write("notification.blocked", "blocked", {
      contact_id: a.contact_id ?? null,
      to_address: a.to_address,
      channel: a.channel,
      kind: a.kind,
      campaign_id: a.campaign_id ?? null,
      caller: a.caller,
      reason: a.reason,
      detail: a.detail,
      registry_resolved: !!a.registry_resolved,
      alias_resolved: !!a.alias_resolved,
    }, a.business_id);
  },
  async failed(a: FailedAudit) {
    await write("notification.failed", "failed", {
      contact_id: a.contact_id ?? null,
      to_address: a.to_address,
      channel: a.channel,
      kind: a.kind,
      campaign_id: a.campaign_id ?? null,
      caller: a.caller,
      provider: a.provider,
      reason: a.reason,
      retryable: a.retryable,
      latency_ms: a.latency_ms,
      registry_resolved: !!a.registry_resolved,
      alias_resolved: !!a.alias_resolved,
    }, a.business_id);
  },
};
