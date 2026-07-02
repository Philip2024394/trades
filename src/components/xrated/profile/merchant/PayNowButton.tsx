"use client";

// PayNowButton — green Pay-Now CTA on the cart page. Posts the cart
// to /api/checkout/create which inserts an order row and returns a
// next-hop URL (Payment Link or, later, a Stripe/PayPal/Square hosted
// checkout). We then redirect the browser to that URL.

import { useState } from "react";

export type PayNowCartLine = {
  product_id: string;
  name: string;
  price_pence: number;
  qty: number;
};

export function PayNowButton({
  listingSlug,
  cartItems,
  totalPence
}: {
  listingSlug: string;
  cartItems: PayNowCartLine[];
  totalPence: number;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pay() {
    if (cartItems.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/checkout/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          listing_slug: listingSlug,
          cart_items: cartItems
        })
      });
      const json = (await res.json()) as {
        ok?: boolean;
        redirect_url?: string;
        order_ref?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !json.ok || !json.redirect_url) {
        setErr(json.detail ?? json.error ?? "Checkout failed.");
        setBusy(false);
        return;
      }
      // Persist order_ref so the cart-success page can confirm on return.
      try {
        if (json.order_ref) {
          window.sessionStorage.setItem(
            "xrated_pending_order_ref",
            json.order_ref
          );
          window.sessionStorage.setItem(
            "xrated_pending_order_slug",
            listingSlug
          );
        }
      } catch {
        /* private mode — no-op */
      }
      window.location.href = json.redirect_url;
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={pay}
        disabled={busy || cartItems.length === 0 || totalPence === 0}
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold uppercase tracking-wider text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60"
        style={{
          background: "#0F7A3F",
          boxShadow: "0 10px 26px rgba(15,122,63,0.5)"
        }}
        aria-label="Pay now with card"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
        {busy ? "Opening checkout…" : "Pay now"}
      </button>
      {err && (
        <p className="mt-2 text-center text-[12px] font-bold text-red-700">
          {err}
        </p>
      )}
    </div>
  );
}
