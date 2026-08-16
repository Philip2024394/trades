"use client";

// ProductDetailsSheet — renders inside NexBottomSheet. Contains
// everything that used to be on the card (contact channels · save ·
// share · report) plus the full product story and a strip of other
// products from the same merchant.
//
// Contact channels respect the merchant's opt-in flags — the feed
// server has already null'd any channel the merchant hid.

import { useEffect, useState } from "react";
import { formatCardLocation } from "@/lib/nex/geography/formatAddress";
import {
  ExternalLink,
  Flag,
  Heart,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Shield,
} from "lucide-react";
import type { CentreFeedItem } from "@/lib/nex/centre-publishing/types";
import { WhatsAppProtectionModal } from "./WhatsAppProtectionModal";

function formatPrice(pence: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pence / 100);
}

type Props = {
  item: CentreFeedItem;
  saved: boolean;
  onSaveToggle: () => void;
  onOpenMerchant: () => void;
  onSelectProduct: (item: CentreFeedItem) => void;
};

export function ProductDetailsSheet({
  item,
  saved,
  onSaveToggle,
  onOpenMerchant,
  onSelectProduct,
}: Props) {
  const [showWaProtection, setShowWaProtection] = useState(false);
  const [otherProducts, setOtherProducts] = useState<CentreFeedItem[]>([]);
  const [loadingOthers, setLoadingOthers] = useState(false);

  const price = formatPrice(item.price_pence);
  const location =
    formatCardLocation({
      country: item.merchant_country,
      city: item.merchant_city,
      county: item.merchant_region,
      region: item.merchant_region,
      postcode: item.merchant_postcode_prefix,
      postcode_prefix: item.merchant_postcode_prefix,
    }) || (item.merchant_city ?? item.merchant_postcode_prefix ?? "");

  const whatsappUrl = item.merchant_whatsapp
    ? `https://wa.me/${item.merchant_whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hi, I saw your ${item.name} on NEX Centre.`
      )}`
    : null;
  const mailtoUrl = item.merchant_email
    ? `mailto:${item.merchant_email}?subject=${encodeURIComponent(
        `NEX Centre enquiry: ${item.name}`
      )}`
    : null;
  const telUrl = item.merchant_phone
    ? `tel:${item.merchant_phone.replace(/[^0-9+]/g, "")}`
    : null;
  const websiteUrl = item.merchant_website
    ? item.merchant_website.startsWith("http")
      ? item.merchant_website
      : `https://${item.merchant_website}`
    : null;

  // Load other products from the same merchant when the sheet opens
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingOthers(true);
      try {
        const res = await fetch(`/api/nex/centre/feed?limit=12`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        const list = (data?.items as CentreFeedItem[]) ?? [];
        setOtherProducts(
          list
            .filter(
              (i) =>
                i.merchant_id === item.merchant_id && i.offer_id !== item.offer_id
            )
            .slice(0, 6)
        );
      } catch {
        // ignore — the strip just stays empty
      } finally {
        if (!cancelled) setLoadingOthers(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [item.merchant_id, item.offer_id]);

  const handleShare = async () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/nex-app/centre#${item.offer_id}`
        : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: item.name, text: item.brand_name, url });
      } catch {
        // ignore
      }
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div>
      {/* Hero image */}
      {item.hero_image_url ? (
        <img
          src={item.hero_image_url}
          alt={item.name}
          className="w-full object-cover"
          style={{ aspectRatio: "4 / 3" }}
        />
      ) : (
        <div
          className="w-full bg-gradient-to-br from-neutral-100 to-neutral-200"
          style={{ aspectRatio: "4 / 3" }}
        />
      )}

      <div className="px-5 pt-4 pb-6">
        {/* Product title + price */}
        <div className="text-lg font-semibold leading-tight text-black">
          {item.name}
        </div>
        <div className="mt-1 text-2xl font-semibold text-black">{price}</div>

        {/* Merchant strip (tap opens the merchant sheet) */}
        <button
          type="button"
          onClick={onOpenMerchant}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-white p-3 text-left hover:bg-black/[0.02]"
        >
          {item.merchant_avatar_url ? (
            <img
              src={item.merchant_avatar_url}
              alt=""
              className="h-10 w-10 flex-none rounded-full object-cover"
            />
          ) : (
            <div className="h-10 w-10 flex-none rounded-full bg-orange-100" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-black">
              {item.merchant_display_name ?? item.brand_name}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-black/60">
              <MapPin className="h-3 w-3" />
              {location}
            </div>
          </div>
          <div className="text-[11px] font-medium text-orange-600">View →</div>
        </button>

        {/* Description */}
        {item.description && (
          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-black/50">
              About this product
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-black/80">
              {item.description}
            </p>
          </div>
        )}

        {/* Category path */}
        {item.category_path.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {item.category_path.map((seg) => (
              <span
                key={seg}
                className="rounded-full bg-black/5 px-2 py-1 text-[10px] text-black/60"
              >
                {seg}
              </span>
            ))}
          </div>
        )}

        {/* Contact section */}
        {(whatsappUrl || mailtoUrl || telUrl || websiteUrl) && (
          <div className="mt-6">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-black/50">
              Contact
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {whatsappUrl && (
                <button
                  type="button"
                  onClick={() => setShowWaProtection(true)}
                  className="flex items-center justify-center gap-2 rounded-full bg-[#25D366] py-2.5 text-sm font-medium text-white hover:opacity-90"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </button>
              )}
              {mailtoUrl && (
                <a
                  href={mailtoUrl}
                  className="flex items-center justify-center gap-2 rounded-full border border-black/10 py-2.5 text-sm font-medium text-black/80 hover:bg-black/5"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </a>
              )}
              {telUrl && (
                <a
                  href={telUrl}
                  className="flex items-center justify-center gap-2 rounded-full border border-black/10 py-2.5 text-sm font-medium text-black/80 hover:bg-black/5"
                >
                  <Phone className="h-4 w-4" />
                  Phone
                </a>
              )}
              {websiteUrl && (
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full border border-black/10 py-2.5 text-sm font-medium text-black/80 hover:bg-black/5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Website
                </a>
              )}
            </div>
          </div>
        )}

        {/* Save · Share · Report row */}
        <div className="mt-6 flex items-center justify-around border-t border-black/5 pt-4">
          <button
            type="button"
            onClick={onSaveToggle}
            className={`flex flex-col items-center gap-1 text-[10px] ${
              saved ? "text-red-600" : "text-black/60"
            }`}
          >
            <Heart className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
            {saved ? "Saved" : "Save"}
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex flex-col items-center gap-1 text-[10px] text-black/60"
          >
            <Share2 className="h-5 w-5" />
            Share
          </button>
          <button
            type="button"
            onClick={() =>
              window.open(
                `mailto:hello@thenetworkers.app?subject=${encodeURIComponent(
                  `Report listing ${item.offer_id}`
                )}`
              )
            }
            className="flex flex-col items-center gap-1 text-[10px] text-black/60"
          >
            <Flag className="h-5 w-5" />
            Report
          </button>
        </div>

        {/* Other products from this merchant */}
        {otherProducts.length > 0 && (
          <div className="mt-6">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-black/50">
              More from {item.merchant_display_name ?? item.brand_name}
            </div>
            <div className="mt-2 -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-2">
              {otherProducts.map((p) => (
                <button
                  key={p.offer_id}
                  type="button"
                  onClick={() => onSelectProduct(p)}
                  className="w-32 flex-none snap-start overflow-hidden rounded-xl border border-black/5 bg-white text-left"
                >
                  {p.hero_image_url ? (
                    <img
                      src={p.hero_image_url}
                      alt={p.name}
                      className="h-24 w-full object-cover"
                    />
                  ) : (
                    <div className="h-24 w-full bg-neutral-100" />
                  )}
                  <div className="p-2">
                    <div className="line-clamp-2 text-[11px] font-medium text-black">
                      {p.name}
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-black">
                      {formatPrice(p.price_pence)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {loadingOthers && otherProducts.length === 0 && (
          <div className="mt-6 text-[11px] text-black/40">
            Loading more from this merchant…
          </div>
        )}

        {/* Bottom safety spacer for iOS home indicator */}
        <div className="h-8" />
      </div>

      {/* WhatsApp protection modal — never blocks, just reminds */}
      {showWaProtection && whatsappUrl && (
        <WhatsAppProtectionModal
          whatsappUrl={whatsappUrl}
          merchantName={item.merchant_display_name ?? item.brand_name}
          onClose={() => setShowWaProtection(false)}
        />
      )}
    </div>
  );
}
