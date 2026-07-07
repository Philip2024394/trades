// /site-office/apps/products — merchant offer manager.
//
// Shows every offer this merchant has published, with inline price +
// stock edits + a "search canonical + add offer" flow. Constitution-
// compliant: gated on hasActiveEntitlement, uses shared services only.

import { redirect } from "next/navigation";
import { getMerchantId } from "@/lib/os/merchantSession";
import { hasActiveEntitlement } from "@/lib/os/billing/entitlements";
import { listMerchantOffers } from "@/lib/products/read";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ProductsMerchantView } from "./ProductsMerchantView";

export const dynamic = "force-dynamic";

export default async function ProductsMerchantPage() {
  const merchantId = await getMerchantId();
  if (!merchantId) {
    redirect("/site-office?next=/site-office/apps/products");
  }
  const entitled = await hasActiveEntitlement(merchantId, "products");
  const [offers, merchant] = await Promise.all([
    entitled
      ? listMerchantOffers({ merchantId, limit: 200 })
      : Promise.resolve([]),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("display_name, trading_name")
      .eq("id", merchantId)
      .maybeSingle()
  ]);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <header className="mb-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          {merchant.data?.trading_name ||
            merchant.data?.display_name ||
            "Your business"}
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Products</h1>
        <p className="mt-1 text-[14px] text-neutral-600">
          Your product offers. Same catalogue that AI Visualiser
          renders and Quote Workspace quotes against. Update price or
          stock here — every downstream app picks it up automatically.
        </p>
      </header>

      {!entitled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <div className="text-[15px] font-semibold text-amber-900">
            Products plan needed
          </div>
          <p className="mt-2 text-[13px] text-amber-900">
            Publishing offers requires an active Products plan. It's
            bundled free with Merchant Pro, or £0 standalone (bundled
            tier).
          </p>
        </div>
      ) : (
        <ProductsMerchantView
          initialOffers={offers.map((o) => ({
            id: o.id,
            pricePence: o.pricePence,
            rrpPence: o.rrpPence,
            stockStatus: o.stockStatus,
            stockQuantity: o.stockQuantity,
            merchantSku: o.merchantSku,
            isActive: o.isActive,
            localImageCount: o.localImageUrls.length,
            canonical: {
              id: o.canonical.id,
              brandName: o.canonical.brandName,
              name: o.canonical.name,
              heroImageUrl: o.canonical.heroImageUrl,
              categoryPath: o.canonical.categoryPath,
              msrpPence: o.canonical.msrpPence
            }
          }))}
        />
      )}
    </div>
  );
}
