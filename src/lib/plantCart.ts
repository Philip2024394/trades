// Plant hire cart — client-side localStorage state. Cart is per-merchant
// (key = merchant slug) so switching between merchants doesn't mix items.
// This is a WhatsApp-shell cart: contents are stringified into a WhatsApp
// message on checkout. No server-side cart rows, no charge.

export type PlantCartItem = {
  slug: string;
  label: string;
  duration: "day" | "week" | "month";
  quantity: number;
  wet_hire: boolean;
  /** Per-unit unit price at time of add (pence). */
  unit_price_pence: number;
  /** Chosen delivery date (optional). */
  date_from?: string;
};

const KEY_PREFIX = "plant-cart-";

function key(slug: string): string {
  return KEY_PREFIX + slug;
}

export function readCart(merchantSlug: string): PlantCartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(merchantSlug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PlantCartItem[];
  } catch {
    return [];
  }
}

export function writeCart(merchantSlug: string, items: PlantCartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(merchantSlug), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("plant-cart-change", { detail: { merchantSlug } }));
  } catch {
    // storage full or blocked — silent
  }
}

export function addToCart(merchantSlug: string, item: PlantCartItem): PlantCartItem[] {
  const items = readCart(merchantSlug);
  const existing = items.findIndex(
    (i) =>
      i.slug === item.slug &&
      i.duration === item.duration &&
      i.wet_hire === item.wet_hire
  );
  if (existing >= 0) {
    items[existing] = {
      ...items[existing],
      quantity: Math.min(items[existing].quantity + item.quantity, 99)
    };
  } else {
    items.push(item);
  }
  writeCart(merchantSlug, items);
  return items;
}

export function removeFromCart(merchantSlug: string, index: number): PlantCartItem[] {
  const items = readCart(merchantSlug).filter((_, i) => i !== index);
  writeCart(merchantSlug, items);
  return items;
}

export function updateCartQuantity(
  merchantSlug: string,
  index: number,
  quantity: number
): PlantCartItem[] {
  const clamped = Math.max(1, Math.min(99, quantity));
  const items = readCart(merchantSlug).map((i, idx) =>
    idx === index ? { ...i, quantity: clamped } : i
  );
  writeCart(merchantSlug, items);
  return items;
}

export function clearCart(merchantSlug: string): void {
  writeCart(merchantSlug, []);
}

export function cartTotalPence(items: PlantCartItem[]): number {
  return items.reduce((sum, i) => sum + i.unit_price_pence * i.quantity, 0);
}
