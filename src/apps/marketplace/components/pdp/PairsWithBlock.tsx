// "Buy with this product" 3-column grid — the Hammerex PairsWith pattern.
// Each accessory has a mini card with image / name / reason / price / add.

import Link from "next/link";
import { Plus, Package } from "lucide-react";
import { PRODUCT_FIXTURES } from "../../data/products";
import type { ProductPairWith } from "../../data/productDetails";

type Props = {
  pairs: ProductPairWith[];
};

export function PairsWithBlock({ pairs }: Props) {
  if (pairs.length === 0) return null;

  return (
    <section className="border-t py-8" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-[16px] font-black text-neutral-900">Buy with this product</h2>
        <p className="mt-1 text-[11.5px] text-neutral-500">
          Curated picks that make this tool better. Add one in a tap.
        </p>

        <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pairs.map((pair) => {
            const p = PRODUCT_FIXTURES.find((x) => x.slug === pair.productSlug);
            if (!p) return null;
            const href = `/tc/trade-center/product/${p.slug}`;
            return (
              <li
                key={pair.id}
                className="overflow-hidden rounded-2xl border bg-white shadow-sm"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              >
                <Link href={href} className="relative block aspect-square w-full overflow-hidden" style={{ backgroundColor: "#F5F0E4" }}>
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain p-4"/>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[48px] opacity-40">
                      <Package aria-hidden strokeWidth={1.5}/>
                    </div>
                  )}
                </Link>
                <div className="flex flex-col gap-2 p-4">
                  <Link
                    href={href}
                    className="text-[13px] font-black text-neutral-900 hover:text-neutral-700"
                  >
                    {p.name}
                  </Link>
                  <p className="text-[11px] leading-snug text-neutral-600">{pair.reason}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[15px] font-black text-neutral-900">£{p.priceGbp}</span>
                    <button
                      type="button"
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-full border bg-white px-4 text-[11px] font-black uppercase tracking-wider text-neutral-800 shadow-sm hover:bg-neutral-50"
                      style={{ borderColor: "rgba(139,69,19,0.15)" }}
                    >
                      <Plus size={11}/>
                      Add
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
