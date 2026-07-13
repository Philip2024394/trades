"use client";

// Video-upgrade upsell — fires when a free member taps "Video" on the
// canteen composer. £14.99/mo unlocks: full account, the trade app for
// this canteen's topic, video posting, and every other paid feature.
//
// Cream + yellow-dot brand, mobile-first bottom sheet, dark-green CTA.

import Link from "next/link";
import { X, Video, Check, Sparkles, ChevronRight } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const PERKS = [
  "Post video to any canteen you're in",
  "Your trade app installed automatically",
  "Full profile with reviews, prices, WhatsApp, and verified badge",
  "Every paid app in the App Warehouse — free with your plan",
  "Post to The Yard and every canteen without limits"
];

export function CanteenVideoUpsellModal({
  open,
  onClose,
  canteenTradeLabel
}: {
  open: boolean;
  onClose: () => void;
  canteenTradeLabel: string;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>

        {/* Dark header with yellow accent */}
        <div className="relative overflow-hidden" style={{ backgroundColor: BRAND_BLACK }}>
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
            <div className="flex items-center gap-2">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl shadow-md"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                <Video size={18} color={BRAND_BLACK} strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: BRAND_YELLOW }}>
                  Paid feature
                </div>
                <div className="text-[18px] font-black leading-tight text-white sm:text-[20px]">
                  Post video with a Full Account
                </div>
              </div>
            </div>
            <p className="mt-2 text-[12px] leading-snug text-white/80">
              Video posting is included with the £14.99/mo Full Account. Your {canteenTradeLabel} trade app comes with it — set up ready to go.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {/* Price band */}
          <div
            className="mb-4 flex items-center justify-between rounded-xl border p-4"
            style={{ borderColor: `${BRAND_YELLOW}66`, backgroundColor: `${BRAND_YELLOW}0F` }}
          >
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
                Full Account
              </div>
              <div className="mt-0.5 text-[26px] font-black leading-none text-neutral-900">
                £14.99<span className="text-[13px] font-bold text-neutral-500">/mo</span>
              </div>
              <div className="mt-0.5 text-[11px] text-neutral-500">
                14-day free trial · no card up front
              </div>
            </div>
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full shadow-md"
              style={{ backgroundColor: BRAND_BLACK }}
            >
              <Sparkles size={14} color={BRAND_YELLOW} strokeWidth={2.5} />
            </span>
          </div>

          {/* Perks list */}
          <div className="mb-4">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              What you get
            </div>
            <ul className="flex flex-col gap-2">
              {PERKS.map((p) => (
                <li key={p} className="flex items-start gap-2 text-[13px] leading-snug text-neutral-800">
                  <span
                    className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: BRAND_GREEN_DARK }}
                  >
                    <Check size={11} color="#FFFFFF" strokeWidth={3} />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Trust hint */}
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-[11px] leading-snug text-neutral-600">
            Cancel any time. Your profile drops back to the free tier automatically — reviews, photos and your slug stay yours forever.
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex items-center gap-2 border-t border-neutral-200 bg-white p-4">
          <button
            onClick={onClose}
            className="h-11 flex-shrink-0 rounded-full border border-neutral-200 bg-white px-4 text-[12px] font-black uppercase tracking-wider text-neutral-700"
          >
            Not now
          </button>
          <Link
            href="/trade-off/signup"
            className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md"
            style={{ backgroundColor: BRAND_YELLOW }}
          >
            Start free trial
            <ChevronRight size={13} strokeWidth={3} />
          </Link>
        </div>
      </div>
    </div>
  );
}
