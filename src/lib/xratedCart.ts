// Xrated Shop Mode — localStorage cart helpers.
//
// Per-tradesperson scoped so visiting two different tradies on the
// same device never merges their carts. The cart is never sent to a
// server — the customer composes a WhatsApp enquiry from it and the
// tradesperson confirms the final price separately.

// Bulk pricing band — used by Wholesale Mode products. Threaded into
// the cart line so the cart page can compute the multi-buy hint
// inline without re-fetching the product. Matches the shape used by
// BulkTierTable / tierForQty.
export type Tier = {
  min_qty: number;
  max_qty?: number | null;
  price_pence: number;
};

export type CartItem = {
  product_id: string;
  name: string;
  price_pence: number;
  cover_url: string | null;
  qty: number;
  added_at: string;
  // Optional pricing unit for service-mode items ("per hour", "per tree",
  // "per sqm" …). When set the cart + WhatsApp composer append it after
  // the price so the line reads "£23.00 per tree × 2". Null/undefined for
  // physical Shop Mode products — they price by item, no unit suffix.
  unit?: string | null;
  // Phase 2 variant axis — when a product/service has variants the
  // customer picks one before "Add to cart" and we record the label
  // here ("L", "Yellow", "1-day hire"). The composite cart key becomes
  // product_id + variant_label so two sizes of the same product live
  // as separate cart lines instead of silently merging.
  variant_label?: string | null;
  // Bulk-tier ladder (Wholesale Mode). Threaded onto the cart line so
  // the cart page can render the multi-buy hint without re-fetching
  // the product. null/undefined means no ladder — render no hint.
  bulk_tiers?: Tier[] | null;
};

export type CartState = {
  listing_slug: string;
  items: CartItem[];
};

const STORAGE_VERSION = "v1";
const QTY_MAX = 99;

function cartKey(slug: string): string {
  return `xrated_cart_${STORAGE_VERSION}::${slug}`;
}

function emptyState(slug: string): CartState {
  return { listing_slug: slug, items: [] };
}

function clampQty(qty: number): number {
  if (!Number.isFinite(qty) || qty < 1) return 1;
  if (qty > QTY_MAX) return QTY_MAX;
  return Math.floor(qty);
}

// Normalise a variant label down to a stable form for key equality:
// trim, collapse whitespace, lowercase. Two "L" and " l " variants
// merge into one cart line (same product, same option). Null/empty
// stays null so legacy unitless items remain backwards-compatible.
function normaliseVariantLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

// Validate a parsed bulk_tiers value. Keeps the array only when every
// entry has numeric min_qty + price_pence (and max_qty is number|null).
// Anything malformed normalises to null so a corrupted localStorage
// entry never blows up the cart page.
function normaliseBulkTiers(raw: unknown): Tier[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: Tier[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") return null;
    const tier = t as { min_qty?: unknown; max_qty?: unknown; price_pence?: unknown };
    if (typeof tier.min_qty !== "number" || typeof tier.price_pence !== "number") {
      return null;
    }
    const max =
      tier.max_qty === null || tier.max_qty === undefined
        ? null
        : typeof tier.max_qty === "number"
          ? tier.max_qty
          : null;
    out.push({
      min_qty: tier.min_qty,
      max_qty: max,
      price_pence: tier.price_pence
    });
  }
  return out;
}

function sameLine(a: CartItem, b: { product_id: string; variant_label?: string | null }): boolean {
  if (a.product_id !== b.product_id) return false;
  const av = a.variant_label ?? null;
  const bv = normaliseVariantLabel(b.variant_label ?? null);
  return av === bv;
}

export function readCart(slug: string): CartState {
  if (typeof window === "undefined") return emptyState(slug);
  try {
    const raw = window.localStorage.getItem(cartKey(slug));
    if (!raw) return emptyState(slug);
    const parsed = JSON.parse(raw) as CartState | null;
    if (!parsed || !Array.isArray(parsed.items)) return emptyState(slug);
    // Defensive normalisation — strip any malformed rows so a corrupted
    // localStorage entry never crashes the cart page.
    const items: CartItem[] = parsed.items
      .filter(
        (it) =>
          it &&
          typeof it.product_id === "string" &&
          typeof it.name === "string" &&
          typeof it.price_pence === "number"
      )
      .map((it) => ({
        product_id: it.product_id,
        name: it.name,
        price_pence: it.price_pence,
        cover_url: it.cover_url ?? null,
        qty: clampQty(typeof it.qty === "number" ? it.qty : 1),
        added_at: typeof it.added_at === "string" ? it.added_at : new Date().toISOString(),
        unit:
          typeof it.unit === "string" && it.unit.trim().length > 0
            ? it.unit.trim()
            : null,
        variant_label: normaliseVariantLabel(it.variant_label),
        bulk_tiers: normaliseBulkTiers(it.bulk_tiers)
      }));
    return { listing_slug: slug, items };
  } catch {
    return emptyState(slug);
  }
}

export function writeCart(state: CartState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cartKey(state.listing_slug), JSON.stringify(state));
    // Notify same-tab listeners — the native `storage` event only fires
    // across tabs, so the floating cart island won't re-render after an
    // add otherwise.
    window.dispatchEvent(
      new CustomEvent("xrated-cart-change", { detail: { slug: state.listing_slug } })
    );
  } catch {
    // Quota / private-mode failure — silently no-op. The cart UI still
    // works for the current page render; only persistence is lost.
  }
}

export function addItem(
  slug: string,
  item: Omit<CartItem, "qty" | "added_at"> & { qty?: number }
): CartState {
  const state = readCart(slug);
  const qtyToAdd = clampQty(item.qty ?? 1);
  const normalisedVariant = normaliseVariantLabel(item.variant_label);
  // Composite key is product_id + variant_label so two different
  // variants of the same product cohabit as separate lines.
  const existing = state.items.find((it) =>
    sameLine(it, { product_id: item.product_id, variant_label: normalisedVariant })
  );
  if (existing) {
    existing.qty = clampQty(existing.qty + qtyToAdd);
  } else {
    state.items.push({
      product_id: item.product_id,
      name: item.name,
      price_pence: item.price_pence,
      cover_url: item.cover_url ?? null,
      qty: qtyToAdd,
      added_at: new Date().toISOString(),
      unit:
        typeof item.unit === "string" && item.unit.trim().length > 0
          ? item.unit.trim()
          : null,
      variant_label: normalisedVariant,
      bulk_tiers: normaliseBulkTiers(item.bulk_tiers)
    });
  }
  writeCart(state);
  return state;
}

export function setQty(
  slug: string,
  product_id: string,
  qty: number,
  variant_label?: string | null
): CartState {
  const state = readCart(slug);
  const clamped = clampQty(qty);
  const target = normaliseVariantLabel(variant_label);
  const next = state.items.map((it) =>
    sameLine(it, { product_id, variant_label: target }) ? { ...it, qty: clamped } : it
  );
  const out: CartState = { listing_slug: slug, items: next };
  writeCart(out);
  return out;
}

export function removeItem(
  slug: string,
  product_id: string,
  variant_label?: string | null
): CartState {
  const state = readCart(slug);
  const target = normaliseVariantLabel(variant_label);
  const out: CartState = {
    listing_slug: slug,
    items: state.items.filter(
      (it) => !sameLine(it, { product_id, variant_label: target })
    )
  };
  writeCart(out);
  return out;
}

export function clearCart(slug: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(cartKey(slug));
    window.dispatchEvent(
      new CustomEvent("xrated-cart-change", { detail: { slug } })
    );
  } catch {
    // ignore
  }
}

export function cartTotalPence(state: CartState): number {
  return state.items.reduce((acc, it) => acc + it.price_pence * it.qty, 0);
}

export function cartItemCount(state: CartState): number {
  return state.items.reduce((acc, it) => acc + it.qty, 0);
}

export function formatGbp(pence: number): string {
  const pounds = pence / 100;
  return `£${pounds.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

/** Resolve a consumer-facing display price for a product. UK Price
 *  Marking Order 2004 requires the dominant figure shown to consumers
 *  to be VAT-inclusive on retail sales. When a product is stored
 *  ex-VAT with a vat_rate_pct, we surface the gross figure as the
 *  primary price and keep the net for a smaller meta line aimed at
 *  trade buyers.
 *
 *  Returns:
 *    - displayPence: the price to render as the dominant figure
 *      (gross when ex-VAT is converted, otherwise the stored value)
 *    - vatLabel: short meta string ("inc VAT" / "from £X ex VAT" /
 *      "no VAT" — for non-VAT-registered traders)
 *    - subtitlePence: optional second price (the ex-VAT figure) the
 *      caller can render at smaller size beneath the dominant price.
 *      null when no secondary line is appropriate.
 */
export function consumerDisplayPrice(product: {
  price_pence: number;
  vat_inclusive: boolean | null;
  vat_rate_pct: number | null;
}): {
  displayPence: number;
  vatLabel: string;
  subtitlePence: number | null;
} {
  const { price_pence, vat_inclusive, vat_rate_pct } = product;
  if (vat_inclusive === null || vat_rate_pct === null) {
    // Merchant not VAT-registered (or hasn't filled the field). PMO
    // doesn't force a label here — render the stored price as-is.
    return { displayPence: price_pence, vatLabel: "no VAT", subtitlePence: null };
  }
  if (vat_inclusive) {
    return {
      displayPence: price_pence,
      vatLabel: "inc VAT",
      subtitlePence: null
    };
  }
  // Ex VAT path — gross becomes the dominant figure for PMO compliance.
  const gross = Math.round(price_pence * (1 + vat_rate_pct / 100));
  return {
    displayPence: gross,
    vatLabel: `inc VAT · ${formatGbp(price_pence)} ex VAT`,
    subtitlePence: price_pence
  };
}
