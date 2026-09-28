// src/lib/nex-native/cart-service.ts
//
// Bridge 22c-3 · Server-side cart persistence.
// --------------------------------------------
// A signed-in NEX account has ONE cart row · items + delivery address
// live in JSONB so the shape stays flexible. This service is the
// server-side counterpart to the client's localStorage · the client
// calls saveServerCart on every mutation and reads getServerCart on
// hydration so the cart follows the buyer across devices.
//
// Server writes are last-write-wins keyed on account_id · the trigger
// on nex_cart updates updated_at automatically so the client can pick
// the fresher side if it ever needs to.

import "server-only";
import { nexSupabaseAdmin } from "./supabase-admin";
import type { NexUuid } from "./types";
import type {
  NexCartItem,
  NexDeliveryAddress,
} from "./cart-types";
import { NEX_DELIVERY_ADDRESS_EMPTY } from "./cart-types";

export interface NexServerCart {
  items: NexCartItem[];
  delivery_address: NexDeliveryAddress;
  updated_at: string;
}

/** Read a NEX account's cart · returns an empty cart when none exists
 *  so callers never have to null-check. */
export async function getServerCart(
  accountId: NexUuid,
): Promise<NexServerCart> {
  const db = nexSupabaseAdmin();
  const { data, error } = await db
    .from("nex_cart")
    .select("items,delivery_address,updated_at")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) {
    throw new Error(`nex_cart.select failed: ${error.message}`);
  }
  if (!data) {
    return {
      items: [],
      delivery_address: NEX_DELIVERY_ADDRESS_EMPTY,
      updated_at: new Date(0).toISOString(),
    };
  }
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const items = rawItems.filter(
    (x: unknown): x is NexCartItem =>
      !!x && typeof x === "object" && typeof (x as { key?: unknown }).key === "string",
  );
  const address: NexDeliveryAddress = {
    ...NEX_DELIVERY_ADDRESS_EMPTY,
    ...(data.delivery_address && typeof data.delivery_address === "object"
      ? (data.delivery_address as Partial<NexDeliveryAddress>)
      : {}),
  };
  return {
    items,
    delivery_address: address,
    updated_at: data.updated_at,
  };
}

/** Upsert a NEX account's cart. Called from the server action after
 *  each client-side mutation · debounced on the client so we don't
 *  hammer the DB for every keystroke in the delivery-address form. */
export async function saveServerCart(
  accountId: NexUuid,
  items: NexCartItem[],
  deliveryAddress: NexDeliveryAddress,
): Promise<NexServerCart> {
  const db = nexSupabaseAdmin();
  const now = new Date().toISOString();
  const cleanItems = items
    .filter(
      (x) =>
        x &&
        typeof x === "object" &&
        typeof x.key === "string" &&
        typeof x.id === "string" &&
        typeof x.shop_id === "string" &&
        typeof x.quantity === "number" &&
        x.quantity > 0,
    )
    .slice(0, 200); // hard cap · 200 lines is more than any real cart
  const cleanAddress: NexDeliveryAddress = {
    ...NEX_DELIVERY_ADDRESS_EMPTY,
    ...deliveryAddress,
  };
  const { data, error } = await db
    .from("nex_cart")
    .upsert(
      {
        account_id: accountId,
        items: cleanItems,
        delivery_address: cleanAddress,
        updated_at: now,
      },
      { onConflict: "account_id" },
    )
    .select("items,delivery_address,updated_at")
    .single();
  if (error) {
    throw new Error(`nex_cart.upsert failed: ${error.message}`);
  }
  return {
    items: (Array.isArray(data.items) ? data.items : []) as NexCartItem[],
    delivery_address: {
      ...NEX_DELIVERY_ADDRESS_EMPTY,
      ...(data.delivery_address as Partial<NexDeliveryAddress>),
    },
    updated_at: data.updated_at,
  };
}

/** Wipe a NEX account's cart · called after a successful Send order so
 *  the same items don't linger on the buyer's other devices. */
export async function clearServerCart(accountId: NexUuid): Promise<void> {
  const db = nexSupabaseAdmin();
  const { error } = await db
    .from("nex_cart")
    .delete()
    .eq("account_id", accountId);
  if (error) {
    throw new Error(`nex_cart.delete failed: ${error.message}`);
  }
}
