// Xrated Trades — Lead Alerts send pipeline.
//
// Fan-out for any push event we deliver to a tradesperson's
// subscribed devices. Single entry point: `sendLeadAlert(listing_id,
// event)`.
//
// Responsibilities:
//   1. Fetch every enabled subscription row for the listing.
//   2. Filter mutes (subscription.muted_events) + quiet-hours window.
//   3. Throttle per-subscription: 1 push / minute, max 12 / hour.
//      Throttled events are logged with delivery_status='throttled'
//      so the dashboard can show a "1 push suppressed" pill.
//   4. Build per-event payload (title / body / data.url / tag).
//   5. Call sendWebPush, log the attempt.
//   6. On 404/410 (gone), flip enabled=false on the row + bump
//      failure_count.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendWebPush } from "@/lib/vapid";
import { adminWhatsapp } from "@/lib/whatsapp";
import { whatsappDigits } from "@/lib/tradeOff";

export type LeadAlertEvent =
  | {
      type: "whatsapp_click";
      data: {
        customer_country?: string | null;
        clicked_at: string;
      };
    }
  | {
      type: "commission";
      data: {
        ref_code: string;
        merchant_name: string;
        commission_pence: number;
        order_value_pence: number;
      };
    }
  | {
      type: "review";
      data: {
        reviewer_name: string;
        rating: number;
      };
    }
  | {
      type: "project_beacon";
      data: {
        customer_name: string;
        customer_whatsapp: string;
        customer_city: string;
        trade_label: string;
        project_excerpt: string;
      };
    }
  | {
      type: "test";
      data: Record<string, unknown>;
    };

type SubscriptionRow = {
  id: string;
  listing_id: string;
  endpoint: string;
  endpoint_hash: string;
  p256dh_key: string;
  auth_key: string;
  platform: string;
  vibration_pattern: number[] | null;
  muted_events: string[] | null;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  enabled: boolean;
  last_used_at: string | null;
};

type ListingLite = {
  id: string;
  slug: string;
  display_name: string | null;
  whatsapp: string | null;
};

const THROTTLE_MIN_GAP_MS = 60 * 1000;
const THROTTLE_HOURLY_CAP = 12;

function pencesToGbp(pence: number): string {
  const pounds = Math.max(0, Math.round(pence)) / 100;
  return `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** True if `nowHourLocal` falls inside the subscription's quiet-hours
 *  window. Window straddles midnight when start > end. */
export function isInQuietHours(
  start: number | null | undefined,
  end: number | null | undefined,
  nowHour: number
): boolean {
  if (start == null || end == null) return false;
  if (start === end) return false; // disabled window
  if (start < end) {
    return nowHour >= start && nowHour < end;
  }
  // wraps midnight (e.g. 22 → 7)
  return nowHour >= start || nowHour < end;
}

/** Returns true if the subscription has had ≥1 push in the last minute
 *  OR ≥12 in the last hour. Caller logs 'throttled' if true. */
async function isThrottled(subscriptionId: string, lastUsedAt: string | null): Promise<boolean> {
  const now = Date.now();
  if (lastUsedAt) {
    const last = new Date(lastUsedAt).getTime();
    if (Number.isFinite(last) && now - last < THROTTLE_MIN_GAP_MS) return true;
  }
  // Count 'sent' attempts in the last hour for this subscription.
  const since = new Date(now - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("hammerex_xrated_push_log")
    .select("id", { count: "exact", head: true })
    .eq("subscription_id", subscriptionId)
    .eq("delivery_status", "sent")
    .gte("created_at", since);
  if (error) return false;
  return (count ?? 0) >= THROTTLE_HOURLY_CAP;
}

function buildPayload(
  event: LeadAlertEvent,
  listing: ListingLite,
  vibrate: number[]
): { title: string; body: string; data: { url: string }; tag: string; vibrate: number[]; requireInteraction: boolean } {
  switch (event.type) {
    case "whatsapp_click": {
      const wa = whatsappDigits(listing.whatsapp ?? adminWhatsapp());
      return {
        title: "Lead just landed",
        body: "Someone tapped WhatsApp on your profile. Tap to open.",
        data: { url: `https://wa.me/${wa}` },
        tag: `lead-${listing.id}`,
        vibrate,
        requireInteraction: true
      };
    }
    case "commission": {
      const amount = pencesToGbp(event.data.commission_pence);
      return {
        title: `${amount} commission earned`,
        body: `${event.data.merchant_name} confirmed an order (${event.data.ref_code}). Tap to view.`,
        data: { url: `/trade-off/edit/${encodeURIComponent(listing.slug)}/materials-network` },
        tag: `commission-${listing.id}`,
        vibrate,
        requireInteraction: false
      };
    }
    case "review": {
      return {
        title: "New review on your profile",
        body: `${event.data.reviewer_name} left a ${event.data.rating}-star review.`,
        data: { url: `/${encodeURIComponent(listing.slug)}` },
        tag: `review-${listing.id}`,
        vibrate,
        requireInteraction: false
      };
    }
    case "project_beacon": {
      const wa = whatsappDigits(event.data.customer_whatsapp);
      const firstName = event.data.customer_name.split(/\s+/)[0] ?? event.data.customer_name;
      const text = encodeURIComponent(
        `Hi ${firstName}, I saw your Xrated project beacon for ${event.data.trade_label.toLowerCase()} in ${event.data.customer_city}. Happy to help — when would you like the work done?`
      );
      return {
        title: `📣 New project nearby — ${event.data.trade_label}`,
        body: `${firstName} in ${event.data.customer_city}: "${event.data.project_excerpt}". Tap to WhatsApp them direct.`,
        data: { url: `https://wa.me/${wa}?text=${text}` },
        tag: `beacon-${listing.id}`,
        vibrate,
        requireInteraction: true
      };
    }
    case "test":
    default: {
      return {
        title: "Test from Xrated",
        body: "Your alerts are working.",
        data: { url: `/trade-off/edit/${encodeURIComponent(listing.slug)}/lead-alerts` },
        tag: `test-${listing.id}`,
        vibrate,
        requireInteraction: false
      };
    }
  }
}

async function logAttempt(params: {
  listingId: string;
  subscriptionId: string | null;
  eventType: LeadAlertEvent["type"];
  payload: Record<string, unknown>;
  status: "queued" | "sent" | "failed" | "throttled" | "muted" | "quiet_hours";
  error?: string | null;
}): Promise<void> {
  await supabaseAdmin.from("hammerex_xrated_push_log").insert({
    listing_id: params.listingId,
    subscription_id: params.subscriptionId,
    event_type: params.eventType,
    payload: params.payload,
    delivery_status: params.status,
    delivery_error: params.error ?? null
  });
}

export async function sendLeadAlert(
  listingId: string,
  event: LeadAlertEvent,
  options: { throttle?: boolean; onlyEndpointHash?: string } = {}
): Promise<{ delivered: number; throttled: number; muted: number; quietHours: number; failed: number }> {
  const result = { delivered: 0, throttled: 0, muted: 0, quietHours: 0, failed: 0 };

  const listingRes = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, whatsapp")
    .eq("id", listingId)
    .maybeSingle();
  if (!listingRes.data) return result;
  const listing = listingRes.data as ListingLite;

  let q = supabaseAdmin
    .from("hammerex_xrated_push_subscriptions")
    .select(
      "id, listing_id, endpoint, endpoint_hash, p256dh_key, auth_key, platform, vibration_pattern, muted_events, quiet_hours_start, quiet_hours_end, enabled, last_used_at"
    )
    .eq("listing_id", listingId)
    .eq("enabled", true);
  if (options.onlyEndpointHash) {
    q = q.eq("endpoint_hash", options.onlyEndpointHash);
  }

  const subsRes = await q;
  if (subsRes.error || !subsRes.data) return result;

  const subs = subsRes.data as SubscriptionRow[];
  const nowHour = new Date().getHours();

  for (const sub of subs) {
    const muted = Array.isArray(sub.muted_events) && sub.muted_events.includes(event.type);
    if (muted) {
      result.muted++;
      await logAttempt({
        listingId,
        subscriptionId: sub.id,
        eventType: event.type,
        payload: event.data as Record<string, unknown>,
        status: "muted"
      });
      continue;
    }

    if (isInQuietHours(sub.quiet_hours_start, sub.quiet_hours_end, nowHour)) {
      result.quietHours++;
      await logAttempt({
        listingId,
        subscriptionId: sub.id,
        eventType: event.type,
        payload: event.data as Record<string, unknown>,
        status: "quiet_hours"
      });
      continue;
    }

    if (options.throttle !== false) {
      const blocked = await isThrottled(sub.id, sub.last_used_at);
      if (blocked) {
        result.throttled++;
        await logAttempt({
          listingId,
          subscriptionId: sub.id,
          eventType: event.type,
          payload: event.data as Record<string, unknown>,
          status: "throttled"
        });
        continue;
      }
    }

    const vibrate = Array.isArray(sub.vibration_pattern) && sub.vibration_pattern.length > 0
      ? sub.vibration_pattern
      : [200, 100, 200, 100, 400];
    const payload = buildPayload(event, listing, vibrate);

    const sendRes = await sendWebPush(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key }
      },
      payload
    );

    if (sendRes.ok) {
      result.delivered++;
      await supabaseAdmin
        .from("hammerex_xrated_push_subscriptions")
        .update({
          last_used_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          failure_count: 0
        })
        .eq("id", sub.id);
      await logAttempt({
        listingId,
        subscriptionId: sub.id,
        eventType: event.type,
        payload: event.data as Record<string, unknown>,
        status: "sent"
      });
    } else {
      result.failed++;
      if (sendRes.gone) {
        await supabaseAdmin
          .from("hammerex_xrated_push_subscriptions")
          .update({
            enabled: false,
            failure_count: 999,
            last_used_at: new Date().toISOString()
          })
          .eq("id", sub.id);
      } else {
        await supabaseAdmin
          .from("hammerex_xrated_push_subscriptions")
          .update({
            failure_count: 1, // bumped; full incr requires read-modify-write
            last_used_at: new Date().toISOString()
          })
          .eq("id", sub.id);
      }
      await logAttempt({
        listingId,
        subscriptionId: sub.id,
        eventType: event.type,
        payload: event.data as Record<string, unknown>,
        status: "failed",
        error: sendRes.error.slice(0, 500)
      });
    }
  }

  return result;
}
