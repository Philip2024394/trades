// Marketplace — widget handler implementations.
//
// Registered with the platform Widget Runtime via
// registerWidgetHandler(id, fn) at bootstrap. Each handler returns
// a WidgetPayload the canonical shell renderer walks.
//
// These are pure functions of the fixture data for Week 5. Real
// user-scoped queries land when tc_saved_lists ships in Wave 2.

import { PRODUCT_FIXTURES } from "../data/products";
import { MERCHANT_FIXTURES } from "../data/merchants";
import type { WidgetPayload } from "@/platform/widgets/runtime";

/** marketplace.back_in_stock — items on the user's saved list that
 *  are now back in stock. Week 5 uses low-stock products as a proxy
 *  for demo purposes.
 */
export function backInStockWidget(): WidgetPayload {
  const items = PRODUCT_FIXTURES.filter(
    (p) => p.stockState === "in" && (p.badges?.includes("new") || (p.stockQty ?? 0) > 100)
  ).slice(0, 3);
  if (items.length === 0) {
    return { emptyLabel: "Nothing on your saved list is back yet." };
  }
  return {
    headline: `${items.length} item${items.length === 1 ? "" : "s"} available now.`,
    chips: [
      { kind: "good", label: "Back in stock", value: items.length }
    ],
    rows: items.map((p) => ({
      id: p.id,
      title: p.name,
      subtitle: `${p.spec} · £${p.priceGbp}`,
      trailing: p.deliveryPromise,
      href: `/tc/trade-center/${p.category}#${p.id}`
    })),
    href: "/tc/trade-center"
  };
}

/** marketplace.new_from_pinned — new listings from merchants the
 *  user has pinned. Week 5 uses recent "new" badge products as a
 *  proxy.
 */
export function newFromPinnedWidget(): WidgetPayload {
  const items = PRODUCT_FIXTURES.filter((p) => p.badges?.includes("new")).slice(0, 3);
  const merchants = Array.from(new Set(items.map((p) => p.merchantSlug)));
  if (items.length === 0) {
    return { emptyLabel: "No new listings from pinned merchants." };
  }
  return {
    headline: `${items.length} new listing${items.length === 1 ? "" : "s"} from your pinned merchants.`,
    chips: [
      { kind: "count", label: "Merchants", value: merchants.length },
      { kind: "count", label: "Products", value: items.length }
    ],
    rows: items.map((p) => {
      const m = MERCHANT_FIXTURES.find((mm) => mm.slug === p.merchantSlug);
      return {
        id: p.id,
        title: p.name,
        subtitle: m ? `${m.displayName} · £${p.priceGbp}` : `£${p.priceGbp}`,
        trailing: "New"
      };
    }),
    href: "/tc/trade-center"
  };
}
