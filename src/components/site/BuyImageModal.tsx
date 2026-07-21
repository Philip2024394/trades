"use client";

// BuyImageModal — two-choice purchase sheet for The Site cards.
//
// Left: buy this single image (£5.99 one-off).
// Right: subscribe unlimited (£14.99/mo — every image, every month).
//
// Both choices POST to /api/site/checkout/{single|subscribe} which
// returns { url } — a Stripe hosted Checkout page we redirect to.
// After payment, Stripe redirects back to /trade-off/search with a
// success query param and the access-check picks up the new row.
//
// Anonymous (not-signed-in) callers get an inline email input required
// on both flows. Signed-in merchants skip the email step — the checkout
// endpoint reads the trade-session cookie server-side.

import { useEffect, useState } from "react";
import { Download, Infinity as InfinityIcon, Loader2, X } from "lucide-react";

const BRAND_BLACK  = "#0A0A0A";
const BRAND_YELLOW = "#FFB300";

export type BuyImageContext = {
  imageId:   string;
  imageUrl:  string;
  subject:   string;
};

export function BuyImageModal({
  context,
  merchantSignedIn,
  onClose
}: {
  context:          BuyImageContext;
  /** True when the caller has a valid trade-session cookie. Hides the
   *  email input — the checkout endpoint will read the session
   *  server-side. */
  merchantSignedIn: boolean;
  onClose:          () => void;
}) {
  const [email,     setEmail]   = useState("");
  const [busy,      setBusy]    = useState<"single" | "subscribe" | null>(null);
  const [error,     setError]   = useState<string | null>(null);

  // Escape + backdrop close + scroll-lock while open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const needsEmail = !merchantSignedIn;
  const canGo      = !needsEmail || emailValid;

  async function startCheckout(kind: "single" | "subscribe") {
    if (!canGo) {
      setError("Enter your email so we can send the download.");
      return;
    }
    setBusy(kind);
    setError(null);
    try {
      const endpoint = kind === "single"
        ? "/api/site/checkout/single"
        : "/api/site/checkout/subscribe";
      const body = kind === "single"
        ? { image_id: context.imageId, email: needsEmail ? email.trim() : undefined }
        : {                             email: needsEmail ? email.trim() : undefined };
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({} as { url?: string; error?: string }));
      if (!res.ok || !data.url) {
        setError(data.error ?? "Checkout failed — try again.");
        setBusy(null);
        return;
      }
      window.location.href = data.url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      style={{ backgroundColor: "rgba(10,10,10,0.75)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-2.5 sm:px-6" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
          <div className="flex items-center gap-2">
            <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}>
              <Download size={12} strokeWidth={2.6}/>
            </span>
            <span className="text-[11px] font-black uppercase tracking-[0.18em]">
              Get this image
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-black/10"
          >
            <X size={15} strokeWidth={2.6}/>
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {/* Image preview strip */}
          <div className="mb-4 flex items-center gap-3 rounded-xl border p-2" style={{ borderColor: "rgba(139,69,19,0.12)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={context.imageUrl} alt="" className="h-14 w-14 flex-shrink-0 rounded-md object-cover"/>
            <p className="line-clamp-2 text-[12px] leading-snug text-neutral-700">{context.subject}</p>
          </div>

          {/* Anonymous email input */}
          {needsEmail && (
            <div className="mb-4">
              <label htmlFor="site-buy-email" className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                Email for download link
              </label>
              <input
                id="site-buy-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourbusiness.co.uk"
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-neutral-900 focus:outline-none focus:ring-2"
                style={{ borderColor: "rgba(139,69,19,0.15)" }}
              />
            </div>
          )}

          {/* Two-choice grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Single */}
            <button
              type="button"
              disabled={busy !== null || !canGo}
              onClick={() => startCheckout("single")}
              className="group relative overflow-hidden rounded-2xl border p-4 text-left transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FBF6EC" }}
            >
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
                This one
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-[28px] font-black leading-none text-neutral-900">£5.99</span>
                <span className="text-[10px] font-bold text-neutral-500">one-off</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-700">
                <li>Perpetual licence</li>
                <li>Watermark removed</li>
                <li>Commercial use</li>
              </ul>
              <div className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-white shadow-sm" style={{ backgroundColor: BRAND_BLACK }}>
                {busy === "single" ? <Loader2 size={12} className="animate-spin"/> : "Buy £5.99"}
              </div>
            </button>

            {/* Sub (highlighted — bigger value if 2+ images/mo) */}
            <button
              type="button"
              disabled={busy !== null || !canGo}
              onClick={() => startCheckout("subscribe")}
              className="group relative overflow-hidden rounded-2xl border-2 p-4 text-left shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderColor: BRAND_BLACK, backgroundColor: BRAND_BLACK, color: "white" }}
            >
              <div className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}>
                Best value
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                Unlimited
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-[28px] font-black leading-none">£14.99</span>
                <span className="text-[10px] font-bold text-neutral-400">/ month</span>
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px] text-neutral-200">
                <li className="flex items-center gap-1"><InfinityIcon size={10} strokeWidth={2.6}/> Every image on The Site</li>
                <li>Editor + post to Canteen / Yard</li>
                <li>Cancel any time</li>
              </ul>
              <div className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider text-neutral-900" style={{ backgroundColor: BRAND_YELLOW }}>
                {busy === "subscribe" ? <Loader2 size={12} className="animate-spin"/> : "Subscribe"}
              </div>
            </button>
          </div>

          {error && (
            <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] font-black text-red-700">
              {error}
            </div>
          )}

          <p className="mt-4 text-[10px] text-neutral-500">
            Secure checkout by Stripe. VAT included where applicable. No card details ever touch our servers.
          </p>
        </div>
      </div>
    </div>
  );
}
