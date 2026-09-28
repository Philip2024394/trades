// src/lib/nex-native/cart-types.ts
//
// Bridge 22 · Cart types shared between client + server. Cart state
// lives in the browser's localStorage under key NEX_CART_STORAGE_KEY.
// On Send, the client serialises the cart lines for one shop into a
// JSON payload and POSTs it via sendCartOrderAction · the server
// re-validates + snapshots into a peer-message cart_order bubble.

export const NEX_CART_STORAGE_KEY = "nex_cart_v1";

/** Bridge 22c-2 · structured delivery address · lives under its own
 *  localStorage key so buyers only type it once across multiple cart
 *  sends. Attached into cart_payload on Send so the seller receives
 *  a clean copy-paste block (name / phone / street / city / postal). */
export const NEX_DELIVERY_ADDRESS_STORAGE_KEY = "nex_delivery_address_v1";

export interface NexDeliveryAddress {
  /** Recipient full name (may differ from buyer's NEX display name). */
  recipient_name: string;
  /** Local phone in whichever format the buyer uses · seller will
   *  paste it into their courier's booking screen so we don't
   *  normalise. Empty string means "not provided". */
  phone: string;
  /** Street address · line 1 (house/building number + street). */
  street: string;
  /** Optional line 2 (apartment / unit / floor / landmark). */
  street_2: string;
  /** City / kabupaten / regency. */
  city: string;
  /** Province / state / region · optional. */
  region: string;
  /** Postal / ZIP code. */
  postal_code: string;
  /** Country · ISO name or free text. Defaults to buyer's country. */
  country: string;
  /** Extra delivery notes (which gate · guard's name · leave-with-
   *  neighbour · etc.). */
  notes: string;
}

export const NEX_DELIVERY_ADDRESS_EMPTY: NexDeliveryAddress = {
  recipient_name: "",
  phone: "",
  street: "",
  street_2: "",
  city: "",
  region: "",
  postal_code: "",
  country: "",
  notes: "",
};

export function isDeliveryAddressComplete(a: NexDeliveryAddress): boolean {
  return !!(
    a.recipient_name.trim() &&
    a.phone.trim() &&
    a.street.trim() &&
    a.city.trim()
  );
}

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
  /** Bridge 25c · seller pickup coordinates · frozen at add-time so
   *  the /cart page's bike-delivery estimator doesn't need to re-
   *  query the seller row per render. Nullable · restaurants that
   *  haven't disclosed lat/lng fall back to "confirm in chat". */
  shop_lat?: number | null;
  shop_lng?: number | null;
  name: string;
  price_pence: number;
  currency: string;
  image_url: string | null;
  quantity: number;
  /** Human-readable variant labels e.g. ["Black paint", "Body + Summicron"]. */
  variants: string[];
  /** Bridge 23c-3 · perk tokens attached to this line at add-time ·
   *  frozen so the cart badge (🚚 Free Delivery etc.) survives even
   *  if the seller edits the dish later. */
  perks?: string[];
  /** Bridge 23c-3 · custom text used when perks contains 'other'. */
  perks_note?: string | null;
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
  /** Bridge 22c-2 · structured delivery block · null when the buyer
   *  hasn't filled it in yet (falls back to buyer_notes for legacy
   *  compat). */
  delivery_address: NexDeliveryAddress | null;
  /** Bridge 25c · bike-delivery quote frozen at send time. */
  delivery_quote?: {
    kind: "free" | "estimate" | "unknown";
    distance_km?: number;
    fare_pence?: number;
    currency?: "IDR";
    eta_minutes?: number;
    free_reason?: string | null;
  } | null;
  items: Array<{
    kind: "product" | "menu_item";
    id: string;
    name: string;
    price_pence: number;
    currency: string;
    quantity: number;
    variants: string[];
    /** Bridge 23c-3 · perks flow through so the seller sees the same
     *  Free-Delivery / BOGO chips the buyer saw at add-time. */
    perks?: string[];
    perks_note?: string | null;
    note: string | null;
    image_url: string | null;
  }>;
}
