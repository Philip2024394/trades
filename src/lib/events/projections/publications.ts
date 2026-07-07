// Publications projection — for each merchant channel connection,
// compose channel-appropriate content and queue a publication row.
//
// A single event fans out to 1 row per (active connection × channel
// type it supports). All rows share scheduled_for (default 60min out)
// so the merchant's Instagram, Facebook, and GBP posts land at the
// same moment.

import { composeForChannel } from "@/lib/llm/composeForChannel";
import type { ChannelId } from "@/lib/llm/composeForChannel";
import {
  activeConnectionsForMerchant,
  insertPublication
} from "@/lib/publications/loader";
import { nextBestTime } from "@/lib/signals/bestTime";
import type { BusinessEvent, ProjectionResult } from "../types";

const CONTENT_WORTHY: string[] = [
  "work_captured",
  "job_completed",
  "review_received",
  "testimonial_recorded",
  "certification_earned",
  "milestone_reached"
];

/** Consent gate identical to feed projection — no publication happens
 *  without merchant-recorded consent. */
function consentOk(event: BusinessEvent): boolean {
  const p = event.eventPayload as Record<string, unknown>;
  const state = (p.consent_state as string) ?? "";
  return state === "granted" || state === "not_required";
}

export async function publicationsProjection(
  event: BusinessEvent
): Promise<ProjectionResult> {
  if (!CONTENT_WORTHY.includes(event.eventType)) {
    return { status: "skipped", reason: `no publication for ${event.eventType}` };
  }
  if (!consentOk(event)) {
    return {
      status: "held",
      reason: "consent_missing — no external publications without permission"
    };
  }

  const connections = await activeConnectionsForMerchant(event.merchantId);
  if (connections.length === 0) {
    return {
      status: "skipped",
      reason: "no active channel connections — connect Instagram / Facebook / GBP to publish"
    };
  }

  const composed: Array<{ channel: ChannelId; connectionId: string }> = [];
  for (const conn of connections) {
    const channel = conn.channel;
    // G4: publish to any channel that has a handler registered.
    // Filtering happens per merchant connection — each merchant only
    // has connections for the channels they've actually authorised.
    const { SUPPORTED_CHANNELS } = await import("@/lib/channels/registry");
    if (!SUPPORTED_CHANNELS.includes(channel)) continue;
    const rendered = await composeForChannel(event, channel);
    // Per-channel best-time picker — if we have ≥20 signals for this
    // (merchant, channel) we bias scheduled_for to a historically
    // higher-engagement slot within the next 7 days; otherwise fall
    // back to +60min.
    const scheduled = await nextBestTime(event.merchantId, channel);
    const minutesOut = Math.max(
      60,
      Math.round((scheduled.getTime() - Date.now()) / 60000)
    );
    const pub = await insertPublication({
      merchantId: event.merchantId,
      eventId: event.id,
      channel,
      connectionId: conn.id,
      renderedContent: rendered as unknown as Record<string, unknown>,
      scheduledMinutesFromNow: minutesOut
    });
    if (pub) composed.push({ channel, connectionId: conn.id });
  }

  if (composed.length === 0) {
    return {
      status: "skipped",
      reason: "no supported channels among active connections"
    };
  }

  return {
    status: "done",
    targetRef: {
      publications: composed,
      count: composed.length
    }
  };
}
