// NEX Email · audit trail
//
// Every send · every block · every failure writes an event to nex.events
// via the storage layer. This is what makes the mission-control page (and
// legal defensibility) possible. Never bypass this.

import { randomUUID } from "node:crypto";
import { getStorage } from "@/lib/nex/storage/registry";
import { COLLECTIONS } from "@/lib/nex/storage/types";
import type { ComplianceReason } from "./compliance";
import type { EmailKind } from "./types";

type BaseAudit = {
  contact_id?: string | null;
  to_email: string;
  kind: EmailKind;
  campaign_id?: string | null;
  business_id?: string | null;
  caller: string;                      // origin ref · e.g. "contact-form" · "worker:invitations" · "hq:compose"
  registry_resolved?: boolean;          // Phase 3d · true if the runtime resolved the recipient through the Contact Registry
  alias_resolved?: boolean;             // Phase 3d · true if the resolved contact_id differs from what the caller supplied (merge chain followed)
};

type SentAudit = BaseAudit & { provider: string; provider_message_id: string; latency_ms: number };
type BlockedAudit = BaseAudit & { reason: ComplianceReason; detail: string };
type FailedAudit = BaseAudit & { provider: string; reason: string; retryable: boolean; latency_ms: number };

async function write(eventType: string, outcome: "ok" | "blocked" | "failed", payload: Record<string, unknown>, business_id?: string | null) {
  const store = getStorage();
  const now = new Date().toISOString();
  await store.save(COLLECTIONS.events, {
    event_id: randomUUID(),
    event_type: eventType,
    source: "nex-email-runtime",
    actor_id: null,
    timestamp: now,
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

export const emailAudit = {
  async sent(a: SentAudit) {
    await write("email.sent", "ok", {
      contact_id: a.contact_id ?? null,
      to_email: a.to_email,
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
    await write("email.blocked", "blocked", {
      contact_id: a.contact_id ?? null,
      to_email: a.to_email,
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
    await write("email.failed", "failed", {
      contact_id: a.contact_id ?? null,
      to_email: a.to_email,
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
