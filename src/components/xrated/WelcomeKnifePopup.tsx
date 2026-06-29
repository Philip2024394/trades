"use client";

// Xrated Trades — welcome-knife popup shown on /trade-off/signup/done.
// Modal overlay that lets the new tradie drop the free Hammerex Folding
// Safety Cutting Knife straight into the Hammerex cart with one tap, then
// branch to either /cart or back to /trade-off.

import { useEffect, useState } from "react";

// TODO(phase2): the welcome-knife popup originally dropped a free
// Hammerex product into the Hammerex shop cart. The standalone Xrated
// repo has no shop cart, so the Add-to-cart branch is stubbed to a
// no-op. Either rewire to a Hammerex hand-off (deep link to the
// Hammerex site with the voucher pre-filled) or remove this popup
// entirely if the welcome gift is no longer the funnel we want.
type CartLine = {
  productId: string;
  slug: string;
  name: string;
  sku: string | null;
  image: string | null;
  unitPriceIdr: number;
  qty: number;
  size: string | null;
  baseCurrency: string;
  threadColor: string | null;
  variantId: string | null;
  variantLabel: string | null;
  backpackStraps: boolean;
};
const cart = {
  add(_line: CartLine) {
    // No-op in Xrated standalone — see TODO(phase2) above.
  }
};

type Props = {
  voucherCode: string;
  product: {
    id: string;
    slug: string;
    name: string;
    sku: string | null;
    image_url: string | null;
  };
  // Optional — derived expiry date string ("12 months from now")
  expiryLabel: string;
};

const FREE_KNIFE_NOTE_KEY = "xrated_welcome_voucher_code";

export function WelcomeKnifePopup({ voucherCode, product, expiryLabel }: Props) {
  // Auto-open on mount; user can dismiss with X.
  const [open, setOpen] = useState(true);
  const [added, setAdded] = useState(false);

  // Pre-check if the knife is already in the cart so re-visits don't
  // double-add.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const lines = JSON.parse(localStorage.getItem("hammerex_cart_v1") ?? "[]") as CartLine[];
      if (lines.some((l) => l.productId === product.id)) {
        setAdded(true);
      }
    } catch {
      // ignore
    }
  }, [product.id]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function addToCart() {
    const line: CartLine = {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      image: product.image_url,
      // Free — price locked to 0 in the line. Admin sees the voucher
      // code attached on the order and confirms fulfilment.
      unitPriceIdr: 0,
      qty: 1,
      size: null,
      baseCurrency: "GBP",
      threadColor: null,
      variantId: null,
      variantLabel: "FREE — Xrated welcome gift",
      backpackStraps: false
    };
    cart.add(line);
    // Stash the voucher code so the checkout form can pre-fill it.
    try {
      localStorage.setItem(FREE_KNIFE_NOTE_KEY, voucherCode);
    } catch {
      // ignore — checkout will still work, just won't auto-fill
    }
    setAdded(true);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome gift — free Hammerex knife"
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-full text-2xl"
            style={{ background: "#FFB300" }}
            aria-hidden="true"
          >
            🎁
          </div>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: "#FFB300" }}>
            Welcome gift
          </p>
          <h2 className="mt-1 text-xl font-extrabold leading-tight text-neutral-900 sm:text-2xl">
            A free Hammerex knife — yours to keep.
          </h2>

          {product.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              className="mt-4 h-32 w-32 object-contain"
            />
          )}

          <p className="mt-3 text-sm font-bold text-neutral-900">{product.name}</p>
          <p className="text-xs text-neutral-500">
            Add it to your cart now — yours FREE inside your next Hammerex order.
          </p>

          <div className="mt-4 w-full rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
              Your voucher code
            </p>
            <p className="mt-1 font-mono text-sm font-bold text-neutral-900">
              {voucherCode}
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">Expires {expiryLabel}</p>
          </div>

          {added ? (
            <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row">
              <a
                href="/cart"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-neutral-900 transition active:scale-[0.98]"
                style={{ background: "#FFB300" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                </svg>
                View cart
              </a>
              <a
                href="/trade-off"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-neutral-200 bg-white px-5 text-sm font-bold text-neutral-900 transition hover:border-neutral-400 active:scale-[0.98]"
              >
                Back to Xrated
              </a>
            </div>
          ) : (
            <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={addToCart}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold text-neutral-900 transition active:scale-[0.98]"
                style={{ background: "#FFB300" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
                Add knife to my cart
              </button>
              <a
                href="/trade-off"
                className="inline-flex h-12 flex-1 items-center justify-center rounded-xl border-2 border-neutral-200 bg-white px-5 text-sm font-bold text-neutral-900 transition hover:border-neutral-400 active:scale-[0.98]"
              >
                Maybe later
              </a>
            </div>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-neutral-400">
            The knife is added at £0. Voucher code travels with your order so admin can
            confirm. Delivery applies to the rest of your order — no minimum spend.
          </p>
        </div>
      </div>
    </div>
  );
}
