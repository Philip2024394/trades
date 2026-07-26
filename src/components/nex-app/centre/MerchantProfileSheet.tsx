"use client";

// MerchantProfileSheet — renders inside NexBottomSheet, stacked above
// a ProductDetailsSheet when the customer taps the merchant strip.
//
// V1 renders what's currently on CentreFeedItem — full merchant
// profile fetching (gallery, projects, reviews, certifications,
// service areas, cover photo) is a future increment once those
// endpoints exist.

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Heart,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Store,
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
  seed: CentreFeedItem;
  onSelectProduct: (item: CentreFeedItem) => void;
};

export function MerchantProfileSheet({ seed, onSelectProduct }: Props) {
  const [showWaProtection, setShowWaProtection] = useState(false);
  const [products, setProducts] = useState<CentreFeedItem[]>([]);
  const [savedMerchant, setSavedMerchant] = useState(false);

  const merchantName = seed.merchant_display_name ?? seed.brand_name;
  const location = seed.merchant_city ?? seed.merchant_postcode_prefix ?? "UK";

  const whatsappUrl = seed.merchant_whatsapp
    ? `https://wa.me/${seed.merchant_whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
        `Hi ${merchantName}, I found you on NEX Centre.`
      )}`
    : null;
  const mailtoUrl = seed.merchant_email
    ? `mailto:${seed.merchant_email}?subject=${encodeURIComponent(
        `NEX Centre enquiry`
      )}`
    : null;
  const telUrl = seed.merchant_phone
    ? `tel:${seed.merchant_phone.replace(/[^0-9+]/g, "")}`
    : null;
  const websiteUrl = seed.merchant_website
    ? seed.merchant_website.startsWith("http")
      ? seed.merchant_website
      : `https://${seed.merchant_website}`
    : null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/nex/centre/feed?limit=24`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (cancelled) return;
        const list = (data?.items as CentreFeedItem[]) ?? [];
        setProducts(list.filter((i) => i.merchant_id === seed.merchant_id));
      } catch {
        // ignore
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [seed.merchant_id]);

  return (
    <div>
      {/* Cover strip — for V1 use the seed product image as a soft
          hero backdrop until dedicated cover photos are added. */}
      <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-neutral-200 to-neutral-300">
        {seed.hero_image_url && (
          <img
            src={seed.hero_image_url}
            alt=""
            className="h-full w-full object-cover opacity-70"
          />
        )}
      </div>

      <div className="px-5">
        {/* Logo + name row (logo overlaps the cover) */}
        <div className="-mt-8 flex items-end gap-3">
          {seed.merchant_avatar_url ? (
            <img
              src={seed.merchant_avatar_url}
              alt=""
              className="h-16 w-16 rounded-2xl border-4 border-white object-cover shadow-md"
            />
          ) : (
            <div className="grid h-16 w-16 place-items-center rounded-2xl border-4 border-white bg-orange-100 shadow-md">
              <Store className="h-6 w-6 text-orange-700" />
            </div>
          )}
          <div className="pb-1">
            <div className="text-lg font-semibold leading-tight text-black">
              {merchantName}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-black/60">
              <MapPin className="h-3 w-3" />
              {location}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
          {(seed.merchant_verification_level === "verified" ||
            seed.merchant_verification_level === "partner") && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
              {seed.merchant_verification_level === "partner"
                ? "NEX Partner"
                : "Verified"}
            </span>
          )}
        </div>

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

        {/* Save merchant / Share row */}
        <div className="mt-6 flex items-center justify-around border-t border-black/5 pt-4">
          <button
            type="button"
            onClick={() => setSavedMerchant((v) => !v)}
            className={`flex flex-col items-center gap-1 text-[10px] ${
              savedMerchant ? "text-red-600" : "text-black/60"
            }`}
          >
            <Heart
              className={`h-5 w-5 ${savedMerchant ? "fill-current" : ""}`}
            />
            {savedMerchant ? "Saved" : "Save merchant"}
          </button>
          <button
            type="button"
            onClick={async () => {
              const url = seed.merchant_slug
                ? `${window.location.origin}/trade/${seed.merchant_slug}`
                : window.location.href;
              if (navigator.share) {
                try {
                  await navigator.share({ title: merchantName, url });
                } catch {
                  /* ignore */
                }
              } else if (navigator.clipboard) {
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  /* ignore */
                }
              }
            }}
            className="flex flex-col items-center gap-1 text-[10px] text-black/60"
          >
            <Share2 className="h-5 w-5" />
            Share
          </button>
        </div>

        {/* Products from this merchant */}
        {products.length > 0 && (
          <div className="mt-6">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-black/50">
              Products ({products.length})
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {products.map((p) => (
                <button
                  key={p.offer_id}
                  type="button"
                  onClick={() => onSelectProduct(p)}
                  className="overflow-hidden rounded-xl border border-black/5 bg-white text-left"
                >
                  {p.hero_image_url ? (
                    <img
                      src={p.hero_image_url}
                      alt={p.name}
                      className="h-28 w-full object-cover"
                    />
                  ) : (
                    <div className="h-28 w-full bg-neutral-100" />
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

        {/* Placeholder rails — populated in a future increment when we
            have the data endpoints for reviews / projects / gallery */}
        <div className="mt-6 space-y-2 text-[11px] text-black/40">
          <PlaceholderRow label="Reviews" />
          <PlaceholderRow label="Latest projects" />
          <PlaceholderRow label="Certifications" />
          <PlaceholderRow label="Service areas" />
        </div>

        <div className="h-8" />
      </div>

      {showWaProtection && whatsappUrl && (
        <WhatsAppProtectionModal
          whatsappUrl={whatsappUrl}
          merchantName={merchantName}
          onClose={() => setShowWaProtection(false)}
        />
      )}
    </div>
  );
}

function PlaceholderRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-dashed border-black/10 bg-white px-3 py-3">
      <span className="text-[11px] text-black/60">{label}</span>
      <span className="text-[10px] text-black/30">Coming soon</span>
    </div>
  );
}
