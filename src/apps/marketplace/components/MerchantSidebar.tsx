// Merchant right sidebar — About prose + Shop Info + Visit Store Front CTA.
// Matches the mock.

import Link from "next/link";
import { MapPin, Calendar, Clock, Package, FileText, ShieldCheck } from "lucide-react";
import { FavouriteButton } from "@/apps/favourites/components/FavouriteButton";
import type { MarketplaceMerchant } from "../data/merchants";

type Props = {
  merchant: MarketplaceMerchant;
  productCount: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric"
  });
}

function responseTimeLabel(hours: number): string {
  if (hours < 1) return "Within 1 Hour";
  if (hours < 2) return "Within 1 Hour";
  if (hours < 24) return `Within ${Math.ceil(hours)} Hours`;
  return `Within ${Math.ceil(hours / 24)} Days`;
}

export function MerchantSidebar({ merchant, productCount }: Props) {
  return (
    <aside
      className="flex w-full flex-shrink-0 flex-col gap-5 border-t pt-5 lg:w-[240px] lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
      aria-label="Merchant sidebar"
    >
      {/* About */}
      <section>
        <h2 className="text-[13px] font-black text-neutral-900">
          About {merchant.displayName}
        </h2>
        <p className="mt-2 line-clamp-6 text-[11.5px] leading-relaxed text-neutral-600">
          {merchant.description ??
            `We are a family run business with over ${merchant.yearsTrading} years experience in the industry. We supply only the best products used by professionals every day.`}
        </p>
        <button
          type="button"
          className="mt-2 text-[11px] font-black uppercase tracking-wider text-neutral-700 underline decoration-dotted underline-offset-2 hover:text-neutral-900"
        >
          Read More
        </button>
      </section>

      {/* Shop Info */}
      <section>
        <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">
          Shop Info
        </h3>
        <ul className="mt-2 flex flex-col gap-2 text-[11.5px]">
          <InfoRow icon={<MapPin size={11}/>} label="Location" value={`${merchant.homeCity}, UK`}/>
          <InfoRow
            icon={<Calendar size={11}/>}
            label="Member Since"
            value={merchant.memberSinceIso ? formatDate(merchant.memberSinceIso) : `${merchant.yearsTrading}y trading`}
          />
          <InfoRow
            icon={<Clock size={11}/>}
            label="Response Time"
            value={responseTimeLabel(merchant.responseTimeHrsMedian)}
          />
          <InfoRow
            icon={<Package size={11}/>}
            label="Products"
            value={productCount.toLocaleString()}
          />
        </ul>
      </section>

      {/* Open Trade Account — the primary merchant-acquisition CTA */}
      <section
        className="rounded-lg border p-3"
        style={{
          borderColor: "rgba(22,101,52,0.35)",
          backgroundColor: "#F0FDF4"
        }}
      >
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-[#166534]"/>
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[#166534]">
            For Trade Customers
          </div>
        </div>
        <div className="mt-1 text-[12px] font-black leading-tight text-neutral-900">
          Open a Trade Account
        </div>
        <p className="mt-1 text-[10.5px] leading-snug text-neutral-600">
          30-day credit terms · Autofilled from your Verified Trade Identity · 60-second application.
        </p>
        <Link
          href={`/tc/apply/${merchant.slug}`}
          className="mt-2 flex min-h-[44px] items-center justify-center gap-1.5 rounded-full px-3 text-[10.5px] font-black uppercase tracking-wider text-white shadow-sm"
          style={{ backgroundColor: "#166534" }}
        >
          <FileText size={12}/>
          Apply for Account
        </Link>
      </section>

      {/* CTA — Visit Store Front */}
      <Link
        href={`/tc/trade-center/merchant/${merchant.slug}`}
        className="inline-flex min-h-[44px] items-center justify-center rounded-full border bg-white px-4 py-2 text-[11.5px] font-black uppercase tracking-wider text-neutral-800 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        Visit Store Front
      </Link>

      {/* Save merchant */}
      <FavouriteButton kind="merchant" targetSlug={merchant.slug} variant="labelled"/>
    </aside>
  );
}

function InfoRow({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <li>
      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">
        {icon}
        {label}
      </div>
      <div className="ml-0.5 mt-0.5 font-bold text-neutral-800">{value}</div>
    </li>
  );
}
