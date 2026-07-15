// /tc/favourites — cross-area bookmarks.
// Tabs for Products · Merchants · Trades · Job postings.

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Heart,
  Package,
  Store,
  ShieldCheck,
  Briefcase,
  MapPin,
  Trash2,
  ArrowRight
} from "lucide-react";
import { TradeCenterHeader } from "@/apps/tradecenter/components/TradeCenterHeader";
import {
  loadWithSeed,
  loadFavourites,
  saveFavourites,
  type Favourite,
  type FavouriteKind
} from "@/apps/favourites/data/favourites";
import { PRODUCT_FIXTURES } from "@/apps/tradecenter/data/products";
import { findMerchant } from "@/apps/tradecenter/data/merchants";
import { findTradeIdentity } from "@/apps/identity/data/tradeIdentities";
import { findJobPosting } from "@/apps/jobBoard/data/jobPostings";

const TABS: Array<{ key: FavouriteKind; label: string; Icon: typeof Package }> = [
  { key: "product",     label: "Products",     Icon: Package },
  { key: "merchant",    label: "Merchants",    Icon: Store },
  { key: "trade",       label: "Trades",       Icon: ShieldCheck },
  { key: "job-posting", label: "Jobs",         Icon: Briefcase }
];

export default function FavouritesPage() {
  const [tab, setTab] = useState<FavouriteKind>("product");
  const [refreshKey, setRefreshKey] = useState(0);

  const all = useMemo(() => loadWithSeed(), [refreshKey]);
  const filtered = useMemo(() => all.filter((f) => f.kind === tab), [all, tab]);

  function remove(fav: Favourite) {
    const list = loadFavourites();
    saveFavourites(
      list.filter((f) => !(f.kind === fav.kind && f.targetSlug === fav.targetSlug))
    );
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#FBF6EC]">
      <TradeCenterHeader activeCategorySlug={null}/>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <header className="mb-6 md:mb-8">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-500">
            Trade Center · Favourites
          </div>
          <h1 className="mt-1 flex items-center gap-2 text-[22px] font-black leading-tight text-neutral-900 md:text-[28px]">
            <Heart size={24} className="fill-red-500 text-red-500"/>
            Everything you saved
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-neutral-600 md:text-[13px]">
            Products, merchants, trades, and job postings you bookmarked. Different from your
            Notebook — favourites are things you want to remember, not things you buy every job.
          </p>
        </header>

        {/* Tabs */}
        <div
          className="mb-5 flex flex-wrap items-center gap-1 rounded-full border bg-white p-1 shadow-sm"
          style={{ borderColor: "rgba(139,69,19,0.15)" }}
        >
          {TABS.map((t) => {
            const count = all.filter((f) => f.kind === t.key).length;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-black uppercase tracking-wider transition"
                style={{
                  backgroundColor: active ? "#0A0A0A" : "transparent",
                  color: active ? "#FFB300" : "#525252"
                }}
              >
                <t.Icon size={12}/>
                {t.label}
                {count > 0 && (
                  <span
                    className="rounded-full px-1.5 text-[9.5px]"
                    style={{
                      backgroundColor: active ? "#FFB300" : "#F5F0E4",
                      color: "#0A0A0A"
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {filtered.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed p-10 text-center"
            style={{ borderColor: "rgba(139,69,19,0.20)" }}
          >
            <Heart size={24} className="mx-auto text-neutral-400"/>
            <div className="mt-2 text-[13px] font-black text-neutral-900">
              Nothing saved in this tab yet
            </div>
            <p className="mx-auto mt-1 max-w-md text-[11.5px] text-neutral-600">
              Tap the heart icon on any product, merchant, trade profile, or job posting to save it here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((fav) => (
              <li key={`${fav.kind}:${fav.targetSlug}`}>
                <FavouriteRow fav={fav} onRemove={() => remove(fav)}/>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return "just now";
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  const days = Math.floor(mins / (60 * 24));
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function FavouriteRow({ fav, onRemove }: { fav: Favourite; onRemove: () => void }) {
  const meta = resolveFavouriteMeta(fav);
  if (!meta) return null;
  return (
    <article
      className="flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <Link
        href={meta.href}
        className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{ backgroundColor: "#F5F0E4" }}
      >
        {meta.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={meta.imageUrl} alt="" className="h-full w-full object-contain p-1"/>
        ) : (
          <meta.Icon size={18} strokeWidth={1.5} className="text-neutral-500"/>
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={meta.href} className="text-[13px] font-black text-neutral-900 hover:underline">
          {meta.title}
        </Link>
        {meta.subtitle && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-600">
            <meta.SubIcon size={10}/>
            {meta.subtitle}
          </div>
        )}
        {fav.note && (
          <div className="mt-1 rounded-md bg-neutral-50 px-2 py-1 text-[10.5px] italic text-neutral-600">
            &ldquo;{fav.note}&rdquo;
          </div>
        )}
        <div className="mt-1 text-[10px] text-neutral-500">Saved {timeAgo(fav.addedAtIso)}</div>
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={meta.href}
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
          aria-label="View"
        >
          <ArrowRight size={14}/>
        </Link>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove favourite"
          className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 size={14}/>
        </button>
      </div>
    </article>
  );
}

type FavMeta = {
  title: string;
  subtitle?: string;
  href: string;
  imageUrl?: string;
  Icon: typeof Package;
  SubIcon: typeof MapPin;
};

function resolveFavouriteMeta(fav: Favourite): FavMeta | null {
  if (fav.kind === "product") {
    const p = PRODUCT_FIXTURES.find((x) => x.slug === fav.targetSlug);
    if (!p) return null;
    const m = findMerchant(p.merchantSlug);
    return {
      title: p.name,
      subtitle: m ? `£${p.priceGbp} · ${m.displayName}` : `£${p.priceGbp}`,
      href: `/tc/trade-center/product/${p.slug}`,
      imageUrl: p.imageUrl,
      Icon: Package,
      SubIcon: Store
    };
  }
  if (fav.kind === "merchant") {
    const m = findMerchant(fav.targetSlug);
    if (!m) return null;
    return {
      title: m.displayName,
      subtitle: `${m.homeCity} · ${m.yearsTrading}yrs trading`,
      href: `/tc/trade-center/merchant/${m.slug}`,
      imageUrl: m.logoImageUrl,
      Icon: Store,
      SubIcon: MapPin
    };
  }
  if (fav.kind === "trade") {
    const t = findTradeIdentity(fav.targetSlug);
    if (!t) return null;
    return {
      title: t.displayName,
      subtitle: `${t.tradeType} · ${t.homeCity}`,
      href: `/tc/trade/${t.slug}`,
      Icon: ShieldCheck,
      SubIcon: MapPin
    };
  }
  if (fav.kind === "job-posting") {
    const j = findJobPosting(fav.targetSlug);
    if (!j) return null;
    return {
      title: j.title,
      subtitle: `${j.customerLocation}${j.budgetRangeGbp ? ` · £${j.budgetRangeGbp[0]}–£${j.budgetRangeGbp[1]}` : ""}`,
      href: `/tc/job-board/${j.slug}`,
      Icon: Briefcase,
      SubIcon: MapPin
    };
  }
  return null;
}
