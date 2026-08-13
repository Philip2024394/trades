// Notification hooks for the Collector lifecycle events.
//
// These are STUBS that hand off to the existing NEX notification / communication
// infrastructure (constitution_nex_notifications_runtime · single canonical rail
// per Philip 2026-08-13 · no parallel comm system for refacing).
//
// The Collector calls these when it wants to fire a workflow event. Each hook
// resolves the correct downstream adapter (email · WhatsApp · SMS · push) via
// the existing notification runtime. If that runtime is not yet wired, the
// event is logged and no fake message is sent (silence-over-fabrication).
//
// EVENTS (name → intent):
//   claim_invited          Business owner is invited to claim their listing
//   claim_reminder         Follow-up if they haven't claimed
//   membership_invited     Claimed owner is invited to join paid membership
//   membership_reminder    Follow-up on membership offer
//
// NEVER fire automatically on record creation. Only fire when triggered by
// an admin action or an approved scheduled workflow inside the existing system.

import type { DirectorySeed } from "./directorySeedLoader";

export type CollectorNotificationEvent =
  | "claim_invited"
  | "claim_reminder"
  | "membership_invited"
  | "membership_reminder";

export type CollectorNotificationPayload = {
  event: CollectorNotificationEvent;
  listing_id: string;
  slug: string;
  business_name: string;
  email: string | null;
  triggered_by: string; // admin username or "system"
  triggered_at: string; // ISO
};

/**
 * Emit a Collector notification event to the existing NEX comms rail.
 *
 * Current behaviour: log-only stub · the shared comms rail is not yet imported.
 * When wired, this function will resolve to the existing sender for the event's
 * preferred channel (email for claim/membership invites) via the existing
 * templates + throttling + audit trail.
 *
 * Returns `sent: false, reason` when the seed has no verified email, so the
 * caller can flag the record for further research rather than silently drop.
 */
export async function emitCollectorNotification(
  seed: Pick<DirectorySeed, "id" | "slug" | "business_name" | "email" | "email_verified">,
  event: CollectorNotificationEvent,
  triggered_by: string
): Promise<{ sent: boolean; reason?: string; payload: CollectorNotificationPayload }> {
  const payload: CollectorNotificationPayload = {
    event,
    listing_id: seed.id,
    slug: seed.slug,
    business_name: seed.business_name,
    email: seed.email ?? null,
    triggered_by,
    triggered_at: new Date().toISOString(),
  };

  // Rule: never send to unverified or missing emails.
  if (!seed.email || !seed.email.trim()) {
    console.info("[CollectorNotifications] skipped · no email", payload);
    return { sent: false, reason: "no_email_on_record", payload };
  }
  if (!seed.email_verified) {
    console.info("[CollectorNotifications] skipped · email not verified", payload);
    return { sent: false, reason: "email_not_verified", payload };
  }

  // TODO(existing-comms-rail): call the shared notification sender.
  //   e.g. await sendTransactionalEmail({ to: seed.email, template: event, vars: {...} });
  // For now, log-only stub · audit-trail intent captured, no fake send.
  console.info("[CollectorNotifications] would send via existing NEX comms rail", payload);
  return { sent: false, reason: "comms_rail_not_wired_yet", payload };
}

/** Eligibility helper the Dashboard can use to show/hide "Invite to claim" buttons. */
export function canSendCollectorNotification(
  seed: Pick<DirectorySeed, "email" | "email_verified" | "lifecycle_status">,
  event: CollectorNotificationEvent
): boolean {
  if (!seed.email || !seed.email.trim()) return false;
  if (!seed.email_verified) return false;
  const lc = seed.lifecycle_status ?? "unclaimed";
  switch (event) {
    case "claim_invited":     return lc === "unclaimed";
    case "claim_reminder":    return ["contacted", "interested"].includes(lc);
    case "membership_invited":return lc === "claimed";
    case "membership_reminder":return lc === "claimed";
  }
}
