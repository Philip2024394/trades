"use client";

// In-place private view for a side-lane post. Lands at the TOP of the
// canteen main feed column, not in a popup. Only the user who clicked
// the card sees this — for everyone else, the live feed keeps rolling.
//
// Two explicit exits: Make an Offer (primary yellow) or Pass (red pill
// with a soft red pulse — respects prefers-reduced-motion).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Eye, ShieldAlert, ChevronRight, X, MessageCircle, Package, Truck, MapPin, Info, AlertTriangle, ArrowLeft, Send } from "lucide-react";
import type { SideLanePost } from "@/lib/canteens";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

// Red pulse — respects prefers-reduced-motion via media query.
const PULSE_CSS = `
@keyframes canteen-pass-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.45), 0 4px 12px rgba(0,0,0,0.08); }
  50%      { box-shadow: 0 0 0 8px rgba(220,38,38,0.00), 0 4px 12px rgba(0,0,0,0.10); }
}
.canteen-pass-btn { animation: canteen-pass-pulse 2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .canteen-pass-btn { animation: none; } }
`;

const RED = "#DC2626";
const RED_TINT = "#FEF2F2";

const CURRENCY_META: Record<string, { symbol: string; label: string; locales: string[] }> = {
  GBP: { symbol: "£", label: "GBP", locales: ["en-GB"] },
  EUR: { symbol: "€", label: "EUR", locales: ["de","fr","es","it","nl","pt","ga","en-IE"] },
  USD: { symbol: "$", label: "USD", locales: ["en-US"] },
  AUD: { symbol: "A$", label: "AUD", locales: ["en-AU"] },
  CAD: { symbol: "C$", label: "CAD", locales: ["en-CA","fr-CA"] }
};

/** Best-guess buyer locale currency. Uses `navigator.language`; falls
 *  back to GBP when the browser is unavailable (SSR) or unmatched. */
function detectBuyerCurrency(): "GBP" | "EUR" | "USD" | "AUD" | "CAD" {
  if (typeof navigator === "undefined") return "GBP";
  const lang = (navigator.language ?? "en-GB").toLowerCase();
  for (const [code, meta] of Object.entries(CURRENCY_META)) {
    if (meta.locales.some((l) => lang.startsWith(l.toLowerCase()))) {
      return code as "GBP" | "EUR" | "USD" | "AUD" | "CAD";
    }
  }
  return "GBP";
}

export function CanteenPrivateView({
  post,
  onPass,
  onMakeOffer
}: {
  post: SideLanePost;
  onPass: () => void;
  onMakeOffer: () => void;
}) {
  // Auto-scroll the private view into view when it mounts so the user
  // doesn't have to hunt for it after clicking a side-lane card.
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!rootRef.current) return;
    // Delay one frame so layout settles first.
    const t = requestAnimationFrame(() => {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(t);
  }, [post.id]);

  // Existing offers on this listing (if it's a make-me-offer mood).
  // Ordered newest-first, capped at 3 to match the side-lane card.
  const existingOffers = (post.offers ?? []).slice(-3).reverse();

  // Currency handling — seller-locked, buyer-warned on mismatch.
  const sellerCurrency = post.currency ?? "GBP";
  const sellerMeta = CURRENCY_META[sellerCurrency];
  const [buyerCurrency, setBuyerCurrency] = useState<string>("GBP");
  useEffect(() => { setBuyerCurrency(detectBuyerCurrency()); }, []);
  const currencyMismatch = buyerCurrency !== sellerCurrency;

  // Offer input mode — the Make an Offer button reveals the input strip
  // instead of closing. Buyer must submit or cancel.
  const [offerMode, setOfferMode] = useState(false);
  const [offerDraft, setOfferDraft] = useState("");
  const [offerSent, setOfferSent] = useState(false);

  const submitOffer = () => {
    if (!offerDraft.trim() || Number(offerDraft) <= 0) return;
    // Wire to /api/canteen-offers when the schema lands.
    setOfferSent(true);
  };
  // Detect whether the seller has any buyer-protected rail. For this
  // preview we don't have real rail data on the post yet, so we treat
  // sub-£100 items as safer (small-ticket collection deals) and larger
  // items as needing Safe Trade. Real data lands with the schema.
  const needsSafeTrade = (post.priceGbp ?? 0) >= 100;

  return (
    <div
      ref={rootRef}
      className="mb-4 overflow-hidden rounded-2xl border shadow-lg"
      style={{
        borderColor: `${BRAND_YELLOW}80`,
        backgroundColor: "#FFFFFF"
      }}
    >
      <style>{PULSE_CSS}</style>

      {/* Private-view chip strip */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ backgroundColor: `${BRAND_YELLOW}15`, borderBottom: `1px solid ${BRAND_YELLOW}40` }}
      >
        <div className="flex items-center gap-1.5">
          <Eye size={12} strokeWidth={2.5} className="text-amber-700" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-800">
            Only you see this
          </span>
        </div>
        <button
          onClick={onPass}
          className="flex h-6 w-6 items-center justify-center rounded-full text-amber-800 transition hover:bg-amber-100"
          aria-label="Close private view"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* Image + core info */}
      <div className="flex gap-3 p-4">
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
          {post.imageUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={post.imageUrl}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          {!post.imageUrl && (
            <div className="flex h-full w-full items-center justify-center">
              <Package size={22} className="text-neutral-400" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-black leading-tight text-neutral-900">
            {post.headline}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <Link
              href={`/trade/${post.posterSlug}`}
              className="text-[11px] font-bold text-neutral-600 hover:underline"
            >
              {post.posterDisplayName}
            </Link>
            {post.priceGbp !== undefined && (
              <div className="text-right">
                <span className="text-[20px] font-black leading-none text-neutral-900">
                  {sellerMeta.symbol}{post.priceGbp}
                </span>
                <div className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-neutral-500">
                  Priced in {sellerMeta.label}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Currency-mismatch warning — fires when the buyer's locale
          differs from the seller's currency. Prevents "I thought it
          was in my currency" disputes after the fact. */}
      {currencyMismatch && (
        <div
          className="mx-4 mb-3 flex items-start gap-2 rounded-lg border p-2.5"
          style={{ borderColor: `${RED}66`, backgroundColor: RED_TINT }}
        >
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" color={RED} strokeWidth={2.5} />
          <div className="min-w-0 flex-1 text-[11px] leading-snug" style={{ color: RED }}>
            <div className="font-black">Currency check — {sellerMeta.label} only</div>
            <div className="mt-0.5 text-red-700">
              This seller trades in <strong>{sellerMeta.symbol} {sellerMeta.label}</strong>. Your locale looks like <strong>{CURRENCY_META[buyerCurrency]?.label ?? buyerCurrency}</strong>. Any offer you make will be in {sellerMeta.label} — you're responsible for the exchange rate.
            </div>
          </div>
        </div>
      )}

      {/* Safe Trade signal — appears when seller only accepts unsafe rails */}
      {needsSafeTrade && (
        <div
          className="mx-4 mb-3 flex items-start gap-2 rounded-lg border p-2.5"
          style={{ borderColor: "#F59E0B66", backgroundColor: "#FEF3C7" }}
        >
          <ShieldAlert size={14} className="mt-0.5 flex-shrink-0 text-amber-700" strokeWidth={2.5} />
          <div className="min-w-0 flex-1 text-[11px] leading-snug text-amber-900">
            <div className="font-black">Trade Safe · Request Safe Trade</div>
            <div className="mt-0.5 text-amber-800">
              This listing hasn't set a buyer-protected rail. Ask the seller to accept PayPal G&S or Escrow before you pay.
            </div>
            <Link
              href="/trade-off/safe-trade"
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-900 underline decoration-2 underline-offset-2"
            >
              Learn about Safe Trade
              <ChevronRight size={10} strokeWidth={3} />
            </Link>
          </div>
        </div>
      )}

      {/* Delivery mode signal — placeholder until seller-set data lands */}
      <div className="mx-4 mb-3 flex flex-wrap gap-1.5 text-[10px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-bold text-neutral-600">
          <MapPin size={9} />
          Collection · Leeds LS1
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-bold text-neutral-600">
          <Truck size={9} />
          Post on request
        </span>
      </div>

      {/* Body / spec placeholder */}
      <div className="mx-4 mb-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-500">
          <Info size={10} />
          Full details
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-neutral-700">
          Bought 6 months ago for a fit-out that's now finished. All original accessories included. Barely used — batteries in mint condition. Collection preferred; post on request.
        </p>
      </div>

      {/* Live offers on this listing — only renders when the seller has
          applied the make-me-offer mood. Shows the last 3 offers with
          buyer avatars beside each amount, plus a headline count. */}
      {post.mood === "make-me-offer" && existingOffers.length > 0 && (
        <div
          className="mx-4 mb-3 rounded-lg border p-3"
          style={{ borderColor: `${BRAND_YELLOW}66`, backgroundColor: `${BRAND_YELLOW}0F` }}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-600">
              Offers so far · {post.offers?.length ?? 0}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-500">
              Highest: £{Math.max(...(post.offers ?? []).map((o) => o.amountGbp))}
            </div>
          </div>
          <div className="space-y-1.5">
            {existingOffers.map((o) => (
              <div key={o.id} className="flex items-center gap-2">
                <div
                  className="h-6 w-6 flex-shrink-0 rounded-full border border-white shadow-sm"
                  style={{
                    backgroundImage: o.buyerAvatarUrl ? `url('${o.buyerAvatarUrl}')` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundColor: !o.buyerAvatarUrl ? BRAND_YELLOW : undefined
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-neutral-800">
                  {o.buyerDisplayName}
                </span>
                <span className="text-[13px] font-black text-neutral-900">
                  £{o.amountGbp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom action row — Make Offer + Pass. When Make Offer is
          tapped the row transforms into an inline offer input strip. */}
      <div className="border-t border-neutral-100 bg-white p-4">
        {offerSent ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1">
              <div className="text-[13px] font-black text-neutral-900">
                Offer sent · {sellerMeta.symbol}{offerDraft}
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-600">
                {post.posterDisplayName.split(" ")[0]} will confirm within 24h. Watch the offer log for a match.
              </div>
            </div>
            <button
              onClick={() => { setOfferSent(false); setOfferDraft(""); onMakeOffer(); }}
              className="inline-flex h-9 flex-shrink-0 items-center gap-1 rounded-full px-4 text-[11px] font-black uppercase tracking-wider text-white"
              style={{ backgroundColor: BRAND_GREEN_DARK }}
            >
              Done
              <ChevronRight size={12} strokeWidth={3}/>
            </button>
          </div>
        ) : offerMode ? (
          <div>
            <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Your offer · {sellerMeta.label} only
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-1 rounded-full border-2 bg-white pl-3 pr-1"
                style={{ borderColor: BRAND_YELLOW }}
              >
                <span className="text-[16px] font-black text-neutral-800">
                  {sellerMeta.symbol}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  autoFocus
                  value={offerDraft}
                  onChange={(e) => setOfferDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitOffer(); }}
                  placeholder="0"
                  className="h-10 min-w-0 flex-1 bg-transparent text-[16px] font-black focus:outline-none"
                />
                <button
                  onClick={submitOffer}
                  disabled={!offerDraft || Number(offerDraft) <= 0}
                  className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-black uppercase tracking-wider text-neutral-900 shadow-sm disabled:opacity-40"
                  style={{ backgroundColor: BRAND_YELLOW }}
                >
                  <Send size={11} strokeWidth={2.5}/>
                  Send
                </button>
              </div>
              <button
                onClick={() => { setOfferMode(false); setOfferDraft(""); }}
                className="inline-flex h-11 items-center gap-1 rounded-full border px-3 text-[11px] font-black uppercase tracking-wider transition"
                style={{ borderColor: "#E5E7EB", color: "#525252" }}
                aria-label="Back"
              >
                <ArrowLeft size={11} strokeWidth={2.5}/>
                Back
              </button>
            </div>
            <div className="mt-2 text-[10px] text-neutral-500">
              One offer per buyer per listing. Seller accepts or the offer expires with the listing.
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={onPass}
              className="canteen-pass-btn inline-flex h-11 items-center justify-center gap-1 rounded-full border px-5 text-[12px] font-black uppercase tracking-wider transition"
              style={{
                borderColor: RED,
                backgroundColor: RED_TINT,
                color: RED
              }}
            >
              Pass
            </button>
            <button
              onClick={() => setOfferMode(true)}
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-black uppercase tracking-wider shadow-md transition active:scale-[0.97]"
              style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
            >
              <MessageCircle size={13} strokeWidth={2.5} />
              Make an Offer
              <ChevronRight size={13} strokeWidth={3} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
