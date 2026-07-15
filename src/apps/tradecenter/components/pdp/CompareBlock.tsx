// Compare — side-by-side 3-column comparison. Current product highlighted
// with a yellow border + "You are here" chip. Ports Hammerex CompareSection.

import Link from "next/link";
import { Package, Check } from "lucide-react";
import { PRODUCT_FIXTURES } from "../../data/products";
import type { TradeCenterProduct } from "../../types";

type Props = {
  current: TradeCenterProduct;
  compareSlugs: string[];
};

export function CompareBlock({ current, compareSlugs }: Props) {
  const others = compareSlugs
    .map((s) => PRODUCT_FIXTURES.find((p) => p.slug === s))
    .filter((p): p is TradeCenterProduct => Boolean(p));
  if (others.length === 0) return null;

  const lineup: Array<{ p: TradeCenterProduct; isCurrent: boolean }> = [
    { p: current, isCurrent: true },
    ...others.map((p) => ({ p, isCurrent: false }))
  ];

  return (
    <section className="border-t py-8" style={{ borderColor: "rgba(139,69,19,0.15)" }}>
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-[16px] font-black text-neutral-900">Compare these products</h2>
        <p className="mt-1 text-[11.5px] text-neutral-500">
          See how the {current.name} stacks up against the closest alternatives.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {lineup.map(({ p, isCurrent }) => {
            const href = `/tc/trade-center/product/${p.slug}`;
            return (
              <article
                key={p.slug}
                className={`flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ${
                  isCurrent ? "border-2" : "border"
                }`}
                style={{ borderColor: isCurrent ? "#FFB300" : "rgba(139,69,19,0.15)" }}
              >
                <Link href={href} className="relative block aspect-square w-full overflow-hidden" style={{ backgroundColor: "#F5F0E4" }}>
                  {p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt={p.name} className="h-full w-full object-contain p-3"/>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-[48px] opacity-40">
                      <Package aria-hidden strokeWidth={1.5}/>
                    </div>
                  )}
                  {isCurrent && (
                    <span
                      className="absolute left-0 top-3 z-10 inline-flex h-7 items-center px-3 text-[10px] font-black uppercase tracking-widest"
                      style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
                    >
                      This product
                    </span>
                  )}
                </Link>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <Link href={href} className="text-[13px] font-black leading-tight text-neutral-900 hover:text-neutral-700">
                    {p.name}
                  </Link>
                  <div className="text-[16px] font-black text-neutral-900">£{p.priceGbp}</div>
                  <div className="text-[11px] text-neutral-500 line-clamp-2">{p.spec}</div>

                  <ul className="flex flex-col gap-1.5">
                    <CompareFeature label={p.deliveryPromise}/>
                    <CompareFeature label={`${p.starRating.toFixed(1)}★ · ${p.reviewCount.toLocaleString()} reviews`}/>
                    {p.badges && p.badges.length > 0 && (
                      <CompareFeature label={p.badges.map((b) => b.replace("-", " ")).join(" · ")}/>
                    )}
                  </ul>

                  <Link
                    href={href}
                    className="mt-auto grid h-10 place-items-center rounded-full text-[11px] font-black uppercase tracking-wider transition"
                    style={
                      isCurrent
                        ? { color: "#0A0A0A", border: "2px solid #FFB300", pointerEvents: "none" }
                        : { color: "#FFFFFF", backgroundColor: "#166534" }
                    }
                  >
                    {isCurrent ? "You are here" : "View product →"}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CompareFeature({ label }: { label: string }) {
  return (
    <li className="flex items-start gap-2 text-[11.5px] leading-snug text-neutral-600">
      <Check size={11} className="mt-0.5 flex-shrink-0" style={{ color: "#166534" }} strokeWidth={3}/>
      <span className="line-clamp-2">{label}</span>
    </li>
  );
}
