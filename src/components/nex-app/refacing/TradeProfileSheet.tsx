"use client";

// TradeProfileSheet · slider content for every trade directory card (Refacing
// today · reusable across future trade directories).
//
// NEX TRADE CARD RULE (memory: project_nex_trade_card_rule_2026_08_13.md):
//   1. One orange "More Details" button on every card opens THIS slider.
//   2. Contact Company (inside the slider) ALWAYS opens NEX Chat — never
//      tel:, never mailto:, never a form that emails the trade directly.
//   3. Unclaimed listings are shown here BUT their inbox is closed —
//      the amber routing panel explains what happens to the enquiry.
//   4. Enquiries flow with an 8-hour SLA rotation (routing engine · see
//      docs/refacing/REFACING-MEMBER-ENTITLEMENT-SPEC.md § 4A).
//
// Deliberately does NOT reuse src/components/nex-app/centre/MerchantProfileSheet.tsx
// (958 lines, still contains a `tel:` Call button that violates Rule 2 · will
// be migrated next time it's touched). This file is scoped, tight, and safe.

import Link from "next/link";
import { MapPin, ShieldCheck, MessageSquare, Hammer, Building2, Wrench, Clock, ArrowRightLeft } from "lucide-react";
import type { CentreFeedItem } from "@/lib/nex/centre-publishing/types";
import { REFACING_CAPABILITY_LABELS } from "@/lib/nex/centre-publishing/categories";

const ORANGE = "#F97316";

// Custom NEX website icon (replaces lucide Globe). Sits inline next to the
// Business website link so the trade profile matches NEX brand rather than a
// generic globe glyph.
const WEBSITE_ICON_SRC =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%2013,%202026,%2004_31_39%20PM.png";

type Props = {
  item: CentreFeedItem;
  /** True when the directory_state maps to "partner" in the feed (i.e. paid_member).
   *  Passed in from the caller so the sheet doesn't need to know the raw seed shape. */
  isPartner: boolean;
  /** True when the directory_state is "listed" (unclaimed). Used to render
   *  the trade-owner "Is this your business?" invitation inside the sheet. */
  isUnclaimed: boolean;
};

export function TradeProfileSheet({ item, isPartner, isUnclaimed }: Props) {
  const location =
    item.merchant_city ??
    item.merchant_postcode_prefix ??
    "UK";
  const slug = item.merchant_slug ?? item.merchant_id;
  const contactHref = `/nex-app/refacing/companies/${encodeURIComponent(slug)}/ask`;
  const claimHref = `/nex-app/claim?listing_id=${encodeURIComponent(slug)}`;

  // Service pills · drawn from merchant_services (from the seed's services array)
  // + fall back to the raw category if nothing else.
  const services = item.merchant_services?.length
    ? item.merchant_services.slice(0, 24)
    : item.category_path && item.category_path.length
    ? item.category_path
    : [];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-8">
      {/* Hero — full-width, natural aspect so no cropping */}
      {item.hero_image_url && (
        <div className="relative -mx-4 mb-4 overflow-hidden bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.hero_image_url}
            alt={item.name}
            className="block h-auto max-h-[420px] w-full object-cover"
          />
          {isPartner && (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-sm">
              <ShieldCheck size={12} strokeWidth={2.5} />
              NEX Refacing Member
            </span>
          )}
          {isUnclaimed && (
            <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-black/70 shadow-sm">
              Unclaimed
            </span>
          )}
        </div>
      )}

      {/* Identity */}
      <div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ORANGE }}>
          NEX · Trade profile
        </div>
        <h2 className="mt-1 text-2xl font-black leading-tight text-black">{item.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-black/70">
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} strokeWidth={2} className="text-black/50" />
            {location}
          </span>
          {item.category_path[0] && (
            <span className="inline-flex items-center rounded-full bg-black/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/60">
              {item.category_path[0]}
            </span>
          )}
        </div>
        {item.description && (
          <p className="mt-3 text-[13px] leading-relaxed text-black/75">{item.description}</p>
        )}
      </div>

      {/* CONTACT COMPANY · the sole enquiry action.
          Never a tel:/mailto: · always routes to /ask which enters NEX Chat. */}
      <div className="mt-5">
        <Link
          href={contactHref}
          className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-black uppercase tracking-wider text-white transition-transform active:scale-95"
          style={{ background: ORANGE, boxShadow: "0 6px 18px rgba(249,115,22,0.35)" }}
        >
          <MessageSquare size={14} strokeWidth={2.5} />
          Contact Company
        </Link>
        <p className="mt-2 text-center text-[11px] text-black/50">
          Enquiries flow through NEX Chat. NEX routes to a suitable Refacing Trade Member.
        </p>
      </div>

      {/* Routing behaviour hint — differs by membership state so the homeowner
          knows what to expect BEFORE they tap Contact Company. */}
      <div className="mt-5 rounded-xl border border-black/10 bg-white p-4 text-[12.5px] leading-relaxed text-black/80">
        {isPartner ? (
          <>
            <div className="font-black uppercase tracking-wider text-emerald-700">
              What happens next
            </div>
            <ul className="mt-2 space-y-1">
              <li className="flex items-start gap-2">
                <MessageSquare size={12} strokeWidth={2.2} className="mt-0.5 shrink-0 text-emerald-700" />
                Your enquiry lands in this trade's NEX Chat inbox.
              </li>
              <li className="flex items-start gap-2">
                <Clock size={12} strokeWidth={2.2} className="mt-0.5 shrink-0 text-emerald-700" />
                8-hour response window · rolls to the next eligible Refacing Trade Member if silent.
              </li>
            </ul>
          </>
        ) : (
          <>
            <div className="font-black uppercase tracking-wider text-amber-700">
              What happens next
            </div>
            <ul className="mt-2 space-y-1">
              <li className="flex items-start gap-2">
                <ArrowRightLeft size={12} strokeWidth={2.2} className="mt-0.5 shrink-0 text-amber-700" />
                This trade hasn't activated their NEX Refacing Trade Member subscription · NEX routes to the next eligible member in your area.
              </li>
              <li className="flex items-start gap-2">
                <Clock size={12} strokeWidth={2.2} className="mt-0.5 shrink-0 text-amber-700" />
                8-hour response window per trade · rotates automatically.
              </li>
            </ul>
          </>
        )}
      </div>

      {/* Services */}
      {services.length > 0 && (
        <div className="mt-5">
          <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-black/60">
            <Wrench size={12} strokeWidth={2.5} />
            Services this trade performs
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span
                key={s}
                className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-200"
              >
                {REFACING_CAPABILITY_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Website — discovery signal, not a contact action */}
      {item.merchant_website && (
        <div className="mt-5">
          <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-black/60">
            <Building2 size={12} strokeWidth={2.5} />
            Business website
          </h3>
          <a
            href={item.merchant_website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[12px] font-semibold text-black/70 shadow-sm hover:bg-black/[0.03]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={WEBSITE_ICON_SRC}
              alt=""
              aria-hidden="true"
              className="h-4 w-4 object-contain"
            />
            {shortHost(item.merchant_website)}
          </a>
        </div>
      )}

      {/* Trade-owner claim invitation — INSIDE the slider (Rule 1 · not on the card face) */}
      {isUnclaimed && (
        <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-start gap-3">
            <Hammer size={20} strokeWidth={2.2} style={{ color: ORANGE }} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ORANGE }}>
                Trade owner
              </div>
              <div className="mt-1 text-[13px] font-black text-black">Is this your business?</div>
              <p className="mt-1 text-[12px] leading-relaxed text-black/70">
                Claim your NEX profile · then activate your Refacing Trade Member subscription so NEX can route homeowner enquiries to your NEX Chat inbox.
              </p>
              <Link
                href={claimHref}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-orange-700 shadow-sm hover:bg-orange-100"
              >
                Claim this business →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function shortHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
