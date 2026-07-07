// Business Hub subscriptions.
//
// The Hub snapshot cache is event-driven. Every event that would
// change a counter or money figure invalidates the merchant's cached
// snapshot. The next Hub page load rebuilds it lazily (see hub/cache.ts).
import "server-only";
import { register } from "../registry";
import { invalidateHubCache } from "@/lib/os/hub/cache";
import type { OsEventType } from "../types";

const HUB_INVALIDATING_EVENTS: OsEventType[] = [
  "render.completed",
  "lead.captured",
  "quote.drafted",
  "quote.sent",
  "quote.viewed",
  "quote.accepted",
  "quote.rejected",
  "quote.expired",
  "job.opened",
  "job.checked_in",
  "job.milestone_hit",
  "job.signed_off",
  "review.posted",
  "review.responded",
  "warranty.registered",
  "contact.created",
  "contact.stage_changed",
  "product.published",
  "product.updated",
  "product.withdrawn",
  "product.price_changed",
  "product.stock_low",
  "billing.subscription.updated"
];

for (const eventType of HUB_INVALIDATING_EVENTS) {
  register({
    subscriberSlug: `business-hub.invalidate.${eventType}`,
    eventType,
    handler: async (event) => {
      const merchantId = event.actorBusinessId;
      if (!merchantId) return { ok: true };
      await invalidateHubCache(merchantId);
      return { ok: true };
    }
  });
}
