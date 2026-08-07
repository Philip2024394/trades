// NEX Analytics · simulator engagement generator
//
// After every successful simulator send, roll dice for realistic
// downstream events (spec Philip 2026-08-08):
//   delivered:    98% (rest bounced)
//   opened:       45% of delivered  (delay: 5-120 min · exp-like curve)
//   clicked:      20% of opens      (delay: 1-30 min after open)
//   unsubscribed: 5%  of opens      (delay: 5-60 min after open)
//   complaints:   0.2%              (rare · immediate)
//
// Events are inserted with FUTURE event_timestamps so dashboards show
// realistic curves as time passes. Delivered event is immediate.

import { ingestEvent } from "./ingest";
import type { EventType } from "./types";

const P_BOUNCED     = 0.015;                                // 1.5% (of sent)
const P_OPENED      = 0.45;                                  // 45% of delivered
const P_CLICKED     = 0.20;                                  // 20% of opens → 9% of delivered
const P_UNSUB       = 0.05;                                  // 5% of opens → 2.25% of delivered
const P_COMPLAINT   = 0.002;                                 // 0.2% of delivered

// Delays (minutes)
const DELAY_OPEN_MIN = 5;    const DELAY_OPEN_MAX = 120;
const DELAY_CLICK_MIN = 1;   const DELAY_CLICK_MAX = 30;
const DELAY_UNSUB_MIN = 5;   const DELAY_UNSUB_MAX = 60;

function futureIso(minMinutes: number, maxMinutes: number, base: Date = new Date()): string {
  const minutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

const DOMAIN_UAS: Record<string, string[]> = {
  gmail:   ["Mozilla/5.0 (Windows NT 10.0) Chrome/125 Gmail", "Gmail-Image-Proxy"],
  outlook: ["Mozilla/5.0 (Windows NT 10.0) Outlook 16.0", "Outlook-Image-Proxy"],
  yahoo:   ["Mozilla/5.0 YahooMailProxy"],
  apple:   ["Mail/16.0 (Apple iPhone)", "AppleWebKit/605.1.15"],
  other:   ["Mozilla/5.0 (X11; Linux x86_64) Firefox/122"],
};

function classifyDomain(domain: string): keyof typeof DOMAIN_UAS {
  const d = domain.toLowerCase();
  if (d.includes("gmail"))                                  return "gmail";
  if (d.includes("outlook") || d.includes("hotmail") || d.includes("live")) return "outlook";
  if (d.includes("yahoo"))                                  return "yahoo";
  if (d.includes("icloud") || d.includes("me.com"))         return "apple";
  return "other";
}
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * Emit engagement chain for one recipient. Called AFTER the actual
 * (simulated) send transitions the recipient to `sent`. The `queued`
 * event is emitted by the worker at send time; this handles everything
 * downstream of that.
 */
export async function simulateEngagementFor(input: {
  campaign_id: string;
  recipient_id: string;
  segment_id?: string | null;
  email: string;
  country?: string | null;
  provider_message_id?: string | null;
}): Promise<void> {
  const domain = (input.email.split("@")[1] ?? "unknown").toLowerCase();
  const uaBucket = DOMAIN_UAS[classifyDomain(domain)];
  const now = new Date();

  const base = {
    campaign_id: input.campaign_id, recipient_id: input.recipient_id,
    segment_id: input.segment_id ?? null,
    provider: "simulator", country: input.country ?? null, domain,
    provider_message_id: input.provider_message_id ?? null,
  };

  // Roll: bounced or delivered
  const isBounced = Math.random() < P_BOUNCED;
  if (isBounced) {
    await ingestEvent({ ...base, event_type: "bounced", metadata: { synthetic: true, reason: "simulated hard bounce" } });
    return;
  }

  await ingestEvent({ ...base, event_type: "delivered", latency_ms: Math.round(80 + Math.random() * 220), metadata: { synthetic: true } });

  // Complaint (rare · immediate)
  if (Math.random() < P_COMPLAINT) {
    await ingestEvent({ ...base, event_type: "complaint", metadata: { synthetic: true, source: "isp_feedback_loop" } });
  }

  // Open
  if (Math.random() < P_OPENED) {
    const openAt = futureIso(DELAY_OPEN_MIN, DELAY_OPEN_MAX, now);
    await ingestEvent({ ...base, event_type: "opened", event_timestamp: openAt, user_agent: pick(uaBucket), metadata: { synthetic: true } });

    // Click
    if (Math.random() < P_CLICKED) {
      const clickAt = futureIso(DELAY_CLICK_MIN, DELAY_CLICK_MAX, new Date(openAt));
      await ingestEvent({
        ...base, event_type: "clicked", event_timestamp: clickAt,
        user_agent: pick(uaBucket), link_url: pick(["https://example.com/cta", "https://example.com/learn-more", "https://example.com/pricing"]),
        metadata: { synthetic: true },
      });
    }

    // Unsubscribe
    if (Math.random() < P_UNSUB) {
      const unsubAt = futureIso(DELAY_UNSUB_MIN, DELAY_UNSUB_MAX, new Date(openAt));
      await ingestEvent({ ...base, event_type: "unsubscribed", event_timestamp: unsubAt, metadata: { synthetic: true, source: "one_click_unsubscribe" } });
    }
  }
}

export const SIMULATOR_PROBABILITIES = {
  P_BOUNCED, P_OPENED, P_CLICKED, P_UNSUB, P_COMPLAINT,
  DELAY_OPEN_MIN, DELAY_OPEN_MAX, DELAY_CLICK_MIN, DELAY_CLICK_MAX, DELAY_UNSUB_MIN, DELAY_UNSUB_MAX,
};

// Type contract check
export type _SimulatorGeneratesEventTypes = Extract<EventType, "delivered" | "opened" | "clicked" | "bounced" | "unsubscribed" | "complaint">;
