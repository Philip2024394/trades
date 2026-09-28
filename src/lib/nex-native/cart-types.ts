// src/lib/nex-native/cart-types.ts
//
// Bridge 22 · Cart types shared between client + server. Cart state
// lives in the browser's localStorage under key NEX_CART_STORAGE_KEY.
// On Send, the client serialises the cart lines for one shop into a
// JSON payload and POSTs it via sendCartOrderAction · the server
// re-validates + snapshots into a peer-message cart_order bubble.

export const NEX_CART_STORAGE_KEY = "nex_cart_v1";

export interface NexCartItem {
  /** Stable per-item key for React lists · UUID or slug + attribute
   *  hash. Client-generated at add-time. */
  key: string;
  kind: "product" | "menu_item";
  id: string; // nex_product.id or nex_menu_item.id
  shop_id: string;
  shop_slug: string;
  shop_owner_account_id: string;
  shop_display_name: string;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  quantity: number;
  /** Human-readable variant labels e.g. ["Black paint", "Body + Summicron"]. */
  variants: string[];
  /** Per-item buyer note · optional. */
  note?: string | null;
  added_at: number;
}

/** Payload the client serialises into cart_payload hidden input on
 *  Send · matches the shape the sendCartOrderAction expects. */
export interface NexCartSendPayload {
  peer_account_id: string;
  shop_id: string;
  shop_slug: string | null;
  shop_display_name: string;
  currency: string;
  buyer_notes: string | null;
  items: Array<{
    kind: "product" | "menu_item";
    id: string;
    name: string;
    price_pence: number;
    currency: string;
    quantity: number;
    variants: string[];
    note: string | null;
    image_url: string | null;
  }>;
}
