// src/lib/nex-native/push-subscription-service.ts
//
// Bridge 89b · Server-side operations on nex_account_push_subscription.
// ---------------------------------------------------------------------
// upsertSubscription  · client landed on the app, granted notification
//                       permission, called pushManager.subscribe() ·
//                       stash the resulting endpoint + keys keyed by
//                       account_id
// listSubscriptions   · look up every device to fan-out a push
//                       (calls, urgent messages)
// pruneSubscription   · called by the send path when a push returns
//                       410 Gone / 404 Not Found · endpoint is dead
//
// This module is the persistent counterpart to the in-memory store in
// src/lib/nex/push/server.ts · that older store was keyed by session
// id for the trade-off surface. NEX-native uses account_id so a user's
// subscriptions survive server restarts + multi-instance deploys.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";

export interface NexPushSubscriptionRow {
  id: NexUuid;
  account_id: NexUuid;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
}

export async function upsertPushSubscription(
  accountId: NexUuid,
  sub: {
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent?: string | null;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_account_push_subscription")
    .upsert(
      {
        account_id: accountId,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        user_agent: sub.user_agent ?? null,
        last_seen_at: now,
      },
      { onConflict: "account_id,endpoint" },
    );
  if (error) {
    throw new Error(`push-subscription-service.upsert: ${error.message}`);
  }
}

export async function listPushSubscriptions(
  accountId: NexUuid,
): Promise<NexPushSubscriptionRow[]> {
  const { data, error } = await nexSupabaseAdmin
    .from("nex_account_push_subscription")
    .select("*")
    .eq("account_id", accountId)
    .order("last_seen_at", { ascending: false });
  if (error) {
    throw new Error(`push-subscription-service.list: ${error.message}`);
  }
  return (data as NexPushSubscriptionRow[]) ?? [];
}

/** Called by the send path when the push service returns a terminal
 *  status (410 Gone / 404 Not Found) · endpoint is dead + we should
 *  stop trying to hit it. Silent no-op if the row is already gone. */
export async function prunePushSubscription(endpoint: string): Promise<void> {
  await nexSupabaseAdmin
    .from("nex_account_push_subscription")
    .delete()
    .eq("endpoint", endpoint);
}

/** Called by clients on sign-out to remove this device's subscription
 *  proactively (instead of waiting for a delivery failure). */
export async function removePushSubscription(
  accountId: NexUuid,
  endpoint: string,
): Promise<void> {
  await nexSupabaseAdmin
    .from("nex_account_push_subscription")
    .delete()
    .eq("account_id", accountId)
    .eq("endpoint", endpoint);
}
