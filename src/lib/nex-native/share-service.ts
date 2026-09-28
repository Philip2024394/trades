// src/lib/nex-native/share-service.ts
//
// NEX Direct Price · share-service · Bridge 49b · sealed 2026-09-29.
//
// The viral loop for NEX Direct Price. Handles:
//   · createShareGrantAndSend  · single write path for "buyer shares
//     a product to a NEX friend" · runs the anti-spam + active-
//     recipient checks · creates the grant · sends the peer message.
//   · listActiveGrantsFor      · reads grants that still apply for a
//     given (buyer, business) pair · used by cart calculators to
//     compute the discount at checkout.
//   · markGrantConsumed        · flips consumed_at when an order
//     actually consumes the grant · Bridge 49b-next hook.
//
// Doctrine (memory · nex_direct_price_swiss_sealed_2026_09_29.md):
//   · Sharing is NEX-only. Never external.
//   · Same (sharer, target, business) not sharable within 7 days.
//   · Recipient MUST be active in the last 7 days (peer chat activity).
//   · Sharer + receiver both get the same bonus % · applied at
//     checkout · capped by ladder.max_cap_pct.
//   · Group shares grant every member the same bonus · enforcement
//     tolerant (all members claim independently within the window).

import { nexSupabaseAdmin } from "./supabase-admin";
import { getLadderForBusiness } from "./ladder-service";
import {
  getOrCreatePeerConversation,
  findPeerConversation,
} from "./peer-conversation-service";
import { sendPeerMessage } from "./peer-message-service";
import type { NexPeerProductShareSnapshot } from "./peer-message-service";
import type { NexTimestamp, NexUuid } from "./types";

// ---------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------

export interface NexProductShareGrantRow {
  id: NexUuid;
  sharer_account_id: NexUuid;
  receiver_account_id: NexUuid | null;
  receiver_group_id: NexUuid | null;
  business_id: NexUuid;
  product_id: NexUuid | null;
  share_type: "friend" | "group";
  sharer_bonus_pct: number;
  receiver_bonus_pct: number;
  personal_note: string | null;
  expires_at: NexTimestamp;
  consumed_by_sharer_at: NexTimestamp | null;
  consumed_by_receiver_at: NexTimestamp | null;
  created_at: NexTimestamp;
}

export interface CreateFriendShareInput {
  sharer_account_id: NexUuid;
  receiver_account_id: NexUuid;
  business_id: NexUuid;
  product_id: NexUuid;
  product_name: string;
  product_price_pence: number;
  product_currency: string;
  product_image_url: string | null;
  business_name: string;
  business_slug: string;
  business_location: string | null;
  personal_note: string | null;
}

/** Rejection reasons from createFriendShareGrant · surface these
 *  directly to the UI so the buyer knows why the share failed. */
export type ShareRejection =
  | "no_ladder"
  | "self_share"
  | "cooldown_7d"
  | "recipient_inactive"
  | "grant_insert_failed"
  | "message_send_failed";

export class ShareRejectedError extends Error {
  constructor(
    public readonly reason: ShareRejection,
    public readonly detail: string,
  ) {
    super(`share-service · ${reason} · ${detail}`);
    this.name = "ShareRejectedError";
  }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

/** All grants that could still discount a given (buyer, business)
 *  · grants where the buyer is either the sharer (self) or the
 *  receiver · not yet consumed by them · not yet expired. Used by
 *  the cart calculator to pick the biggest applicable bonus at
 *  checkout time. */
export async function listActiveGrantsFor(
  buyerAccountId: NexUuid,
  businessId: NexUuid,
): Promise<NexProductShareGrantRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_share_grant")
    .select("*")
    .eq("business_id", businessId)
    .gt("expires_at", nowIso)
    .or(
      `sharer_account_id.eq.${buyerAccountId},receiver_account_id.eq.${buyerAccountId}`,
    )
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`share-service.listActiveGrantsFor: ${error.message}`);
  }
  const rows = (data as NexProductShareGrantRow[]) ?? [];
  // Filter out consumed-side grants so the caller doesn't reapply.
  return rows.filter((g) => {
    if (g.sharer_account_id === buyerAccountId) {
      return g.consumed_by_sharer_at == null;
    }
    if (g.receiver_account_id === buyerAccountId) {
      return g.consumed_by_receiver_at == null;
    }
    return false;
  });
}

/** Pure helper · pick the maximum applicable bonus % for a buyer
 *  from a list of grants + a max cap. Callers combine with any tier
 *  discount before showing the final price. */
export function pickBestBonusPct(
  grants: readonly NexProductShareGrantRow[],
  buyerAccountId: NexUuid,
  maxCapPct: number,
): number {
  if (grants.length === 0) return 0;
  let best = 0;
  for (const g of grants) {
    const isSharer = g.sharer_account_id === buyerAccountId;
    const bonus = isSharer ? g.sharer_bonus_pct : g.receiver_bonus_pct;
    if (bonus > best) best = bonus;
  }
  return Math.min(best, maxCapPct);
}

// ---------------------------------------------------------------------
// Anti-spam · 7-day cooldown per (sharer, target, business)
// ---------------------------------------------------------------------

async function assertNoCooldown7d(input: {
  sharer_account_id: NexUuid;
  receiver_account_id: NexUuid;
  business_id: NexUuid;
}): Promise<void> {
  const cutoffIso = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const { data, error } = await nexSupabaseAdmin
    .from("nex_product_share_grant")
    .select("id, created_at")
    .eq("sharer_account_id", input.sharer_account_id)
    .eq("receiver_account_id", input.receiver_account_id)
    .eq("business_id", input.business_id)
    .gte("created_at", cutoffIso)
    .limit(1);
  if (error) {
    throw new Error(`share-service.assertNoCooldown7d: ${error.message}`);
  }
  if ((data ?? []).length > 0) {
    const prev = (data as { id: string; created_at: string }[])[0]!;
    const daysAgo = Math.floor(
      (Date.now() - new Date(prev.created_at).getTime()) / (24 * 60 * 60 * 1000),
    );
    const daysLeft = 7 - daysAgo;
    throw new ShareRejectedError(
      "cooldown_7d",
      `Already shared this shop to this friend ${daysAgo} day${daysAgo === 1 ? "" : "s"} ago · try again in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
    );
  }
}

// ---------------------------------------------------------------------
// Active-recipient rule · peer chat activity within last 7 days
// ---------------------------------------------------------------------

async function assertRecipientActive(sharer: NexUuid, receiver: NexUuid): Promise<void> {
  // "Active" · they have an existing peer chat with the sharer AND
  // that chat had a message within the last 7 days. If no chat
  // exists at all, we treat as inactive (dormant contact).
  const conv = await findPeerConversation(sharer, receiver).catch(() => null);
  if (!conv) {
    throw new ShareRejectedError(
      "recipient_inactive",
      "You need to have chatted with this friend recently to share deals with them.",
    );
  }
  const lastMs = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
  if (Date.now() - lastMs > ACTIVE_WINDOW_MS) {
    throw new ShareRejectedError(
      "recipient_inactive",
      "This friend hasn't chatted with you in the last 7 days · say hi first, then share.",
    );
  }
}

// ---------------------------------------------------------------------
// Create + send · single write path
// ---------------------------------------------------------------------

/** Full flow · check cooldown + recipient activity · create the
 *  grant · get-or-create the peer conversation · send the
 *  product_share peer message with the B4 banner metadata. Throws
 *  ShareRejectedError with a UI-friendly reason on any gate failure.
 *  Non-fatal · caller (server action) catches and shows the reason
 *  as a banner. */
export async function createFriendShareGrant(
  input: CreateFriendShareInput,
): Promise<{
  grant: NexProductShareGrantRow;
  peerMessageId: string;
}> {
  if (input.sharer_account_id === input.receiver_account_id) {
    throw new ShareRejectedError("self_share", "You can't share to yourself.");
  }

  const ladder = await getLadderForBusiness(input.business_id);
  if (!ladder || !ladder.active) {
    throw new ShareRejectedError(
      "no_ladder",
      "This shop hasn't enabled NEX Direct Price yet.",
    );
  }

  await assertNoCooldown7d({
    sharer_account_id: input.sharer_account_id,
    receiver_account_id: input.receiver_account_id,
    business_id: input.business_id,
  });

  await assertRecipientActive(input.sharer_account_id, input.receiver_account_id);

  // Grant expiry from ladder config · seller-set 1-168hr, default 48.
  const expiresAt = new Date(
    Date.now() + ladder.share_expiry_hours * 60 * 60 * 1000,
  ).toISOString();

  const noteTrimmed =
    input.personal_note && input.personal_note.trim().length > 0
      ? input.personal_note.trim().slice(0, 200)
      : null;

  const { data: grantRow, error: grantError } = await nexSupabaseAdmin
    .from("nex_product_share_grant")
    .insert({
      sharer_account_id: input.sharer_account_id,
      receiver_account_id: input.receiver_account_id,
      business_id: input.business_id,
      product_id: input.product_id,
      share_type: "friend",
      sharer_bonus_pct: ladder.share_friend_bonus_pct,
      receiver_bonus_pct: ladder.share_friend_bonus_pct,
      personal_note: noteTrimmed,
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (grantError || !grantRow) {
    throw new ShareRejectedError(
      "grant_insert_failed",
      grantError?.message ?? "no row returned",
    );
  }
  const grant = grantRow as NexProductShareGrantRow;

  const snapshot: NexPeerProductShareSnapshot = {
    grant_id: grant.id,
    business_id: input.business_id,
    business_name: input.business_name,
    business_slug: input.business_slug,
    business_location: input.business_location,
    product_id: input.product_id,
    product_name: input.product_name,
    product_image_url: input.product_image_url,
    price_pence: input.product_price_pence,
    currency: input.product_currency,
    receiver_bonus_pct: ladder.share_friend_bonus_pct,
    expires_at: expiresAt,
    personal_note: noteTrimmed,
    open_href: `/nex-native/${input.business_slug}/${input.product_id}/direct`,
  };

  const conv = await getOrCreatePeerConversation(
    input.sharer_account_id,
    input.receiver_account_id,
  );

  // Body doubles as a fallback for clients that don't render the
  // attachment · one-line summary + the personal note.
  const bodyLines: string[] = [
    `🎁 ${input.product_name} · ${input.business_name}`,
    `−${ladder.share_friend_bonus_pct}% off · ${ladder.share_expiry_hours}hr window`,
  ];
  if (noteTrimmed) bodyLines.push(`"${noteTrimmed}"`);

  try {
    const msg = await sendPeerMessage({
      conversation_id: conv.id,
      sender_account_id: input.sharer_account_id,
      body: bodyLines.join("\n"),
      attachment_url: snapshot.open_href,
      attachment_type: "product_share",
      attachment_meta: { product_share: snapshot },
    });
    return { grant, peerMessageId: msg.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new ShareRejectedError("message_send_failed", msg);
  }
}

// ---------------------------------------------------------------------
// Consumption · marks a grant used on the buyer's side
// ---------------------------------------------------------------------

/** Called from the order-completion hook · if the buyer was the
 *  sharer or the receiver of this grant, flip the corresponding
 *  consumed_at. One-shot · reapplying is prevented by
 *  listActiveGrantsFor's filter. */
export async function markGrantConsumed(
  grantId: NexUuid,
  buyerAccountId: NexUuid,
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data: grant, error: gErr } = await nexSupabaseAdmin
    .from("nex_product_share_grant")
    .select(
      "id, sharer_account_id, receiver_account_id, business_id, product_id, sharer_bonus_pct, receiver_bonus_pct, consumed_by_sharer_at, consumed_by_receiver_at",
    )
    .eq("id", grantId)
    .maybeSingle();
  if (gErr || !grant) return; // silent · grant may already be gone
  const patch: Record<string, string> = {};
  const g = grant as {
    id: string;
    sharer_account_id: string;
    receiver_account_id: string | null;
    business_id: string;
    product_id: string | null;
    sharer_bonus_pct: number;
    receiver_bonus_pct: number;
    consumed_by_sharer_at: string | null;
    consumed_by_receiver_at: string | null;
  };
  const receiverJustConsumed =
    g.receiver_account_id === buyerAccountId && !g.consumed_by_receiver_at;
  if (g.sharer_account_id === buyerAccountId && !g.consumed_by_sharer_at) {
    patch.consumed_by_sharer_at = nowIso;
  }
  if (receiverJustConsumed) {
    patch.consumed_by_receiver_at = nowIso;
  }
  if (Object.keys(patch).length === 0) return;
  const { error: updateErr } = await nexSupabaseAdmin
    .from("nex_product_share_grant")
    .update(patch)
    .eq("id", grantId);
  if (updateErr) return;

  // Bridge 49-notify · when the RECEIVER side is the one being
  // consumed, notify the sharer in their existing peer chat that
  // their friend used the reward. This closes the viral loop and
  // gives the sharer positive reinforcement to share again.
  // Non-fatal · notification failure never breaks consumption.
  if (receiverJustConsumed && g.receiver_account_id) {
    try {
      await notifyShareConsumedByReceiver({
        grant: g,
        receiverAccountId: g.receiver_account_id,
      });
    } catch (e) {
      // silent · log for observability, do not throw
      // eslint-disable-next-line no-console
      console.warn(
        "[nex-share] receiver-consumed notification failed",
        e instanceof Error ? e.message : e,
      );
    }
  }
}

/** Bridge 49-notify · send a celebration peer message from the
 *  receiver to the sharer when the receiver actually consumes their
 *  half of the grant. The message goes into the existing peer chat
 *  between the two (the same chat where the original banner landed).
 *
 *  Private helper · not exported · only called by markGrantConsumed. */
async function notifyShareConsumedByReceiver(input: {
  grant: {
    id: string;
    sharer_account_id: string;
    receiver_account_id: string | null;
    business_id: string;
    product_id: string | null;
    sharer_bonus_pct: number;
    receiver_bonus_pct: number;
  };
  receiverAccountId: string;
}): Promise<void> {
  // Fetch just enough context to write a natural message.
  const [businessRes, productRes, receiverRes] = await Promise.all([
    nexSupabaseAdmin
      .from("nex_business")
      .select("display_name")
      .eq("id", input.grant.business_id)
      .maybeSingle(),
    input.grant.product_id
      ? nexSupabaseAdmin
          .from("nex_product")
          .select("name")
          .eq("id", input.grant.product_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    nexSupabaseAdmin
      .from("nex_account")
      .select("display_name")
      .eq("id", input.receiverAccountId)
      .maybeSingle(),
  ]);
  const businessName =
    (businessRes.data as { display_name?: string } | null)?.display_name ??
    "this shop";
  const productName =
    (productRes.data as { name?: string } | null)?.name ?? "the product";
  const receiverName =
    (receiverRes.data as { display_name?: string } | null)?.display_name ??
    "your friend";
  const bothPct = input.grant.receiver_bonus_pct; // same for both sides on friend shares

  const body = [
    `🎉 ${receiverName} just ordered ${productName} from ${businessName}`,
    `You both used the NEX Direct Price reward · saved −${bothPct}% each.`,
    `Thanks for sharing.`,
  ].join("\n");

  const conv = await getOrCreatePeerConversation(
    input.grant.sharer_account_id,
    input.receiverAccountId,
  );

  // Sent by the receiver so it lands as an incoming message in the
  // sharer's chat with them (matches the "your friend just did X"
  // mental model · no fake system-bot voice).
  await sendPeerMessage({
    conversation_id: conv.id,
    sender_account_id: input.receiverAccountId,
    body,
    attachment_url: null,
    attachment_type: null,
    attachment_meta: null,
  });
}
