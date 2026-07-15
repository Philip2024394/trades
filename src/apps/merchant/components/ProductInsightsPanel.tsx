// Which of your products the trade audience is engaging with — Notebook
// adds, Verified Trade orders, Job Cost estimate appearances. These are
// the numbers the trust panel surfaces to buyers; merchants see the
// aggregated picture across their whole catalogue.

import Link from "next/link";
import { Package, TrendingUp, ArrowRight } from "lucide-react";
import { PRODUCT_FIXTURES } from "@/apps/tradecenter/data/products";
import { PRODUCT_SOCIAL_PROOF_FIXTURES } from "@/apps/tradecenter/data/socialProof";

type Props = {
  merchantSlug: string;
};

export function ProductInsightsPanel({ merchantSlug }: Props) {
  const products = PRODUCT_FIXTURES.filter((p) => p.merchantSlug === merchantSlug);

  const withProof = products
    .map((p) => ({
      product: p,
      proof: PRODUCT_SOCIAL_PROOF_FIXTURES.find((x) => x.productSlug === p.slug)
    }))
    .filter((r) => r.proof)
    .sort((a, b) => (b.proof?.notebookCount ?? 0) - (a.proof?.notebookCount ?? 0))
    .slice(0, 5);

  return (
    <section
      className="rounded-2xl border bg-white p-5 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <header className="mb-3 flex items-center justify-between">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
          Top products by trade demand
        </div>
        <Link
          href={`/tc/trade-center/merchant/${merchantSlug}`}
          className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
        >
          Store front →
        </Link>
      </header>

      {withProof.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-6 text-center text-[11.5px] text-neutral-500" style={{ borderColor: "rgba(139,69,19,0.20)" }}>
          No product-level demand data yet. Publish more and give it a couple weeks.
        </div>
      ) : (
        <ul className="flex flex-col divide-y" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          {withProof.map(({ product, proof }) => {
            if (!proof) return null;
            return (
              <li key={product.slug}>
                <Link
                  href={`/tc/trade-center/product/${product.slug}`}
                  className="flex min-h-[64px] items-center gap-3 py-2 pl-1 transition hover:bg-neutral-50"
                >
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
                    style={{ backgroundColor: "#F5F0E4" }}
                  >
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt="" className="h-full w-full object-contain p-1"/>
                    ) : (
                      <Package size={16} className="text-neutral-400" strokeWidth={1.5}/>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 text-[12px] font-black text-neutral-900">
                      {product.name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[10.5px] text-neutral-600">
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp size={9} className="text-amber-700"/>
                        <strong className="text-neutral-800">{proof.notebookCount}</strong> Notebooks
                      </span>
                      <span>{proof.verifiedTradeOrders30d} orders / 30d</span>
                      <span>{proof.jobCostAppearancesMonth} Job Cost estimates</span>
                    </div>
                  </div>
                  <ArrowRight size={13} className="flex-shrink-0 text-neutral-400"/>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
