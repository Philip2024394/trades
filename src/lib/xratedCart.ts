// Xrated Shop Mode — localStorage cart helpers.
//
// Per-tradesperson scoped so visiting two different tradies on the
// same device never merges their carts. The cart is never sent to a
// server — the customer composes a WhatsApp enquiry from it and the
// tradesperson confirms the final price separately.

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
        variant_label: normaliseVariantLabel(it.variant_label)
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
      variant_label: normalisedVariant
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
