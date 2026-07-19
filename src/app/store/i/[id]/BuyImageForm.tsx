"use client";

// Client — two paths:
//   1. Buy this image now (single) — email + Stripe redirect
//   2. Add to pack (client cart) — routes to cart page or stays for
//      more browsing
//
// Both are visible so merchant can pick. Add-to-pack is subtle so
// single-buy stays the primary CTA when count=0.

import Link from "next/link";
import { useState } from "react";
import { useStoreCart } from "../../useStoreCart";

export function BuyImageForm({ imageId }: { imageId: string }) {
  const { add, remove, has, count } = useStoreCart();
  const inCart = has(imageId);
  const [email, setEmail] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ imageIds: [imageId], email: email.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      window.location.href = data.redirect;
    } catch (err) {
      setError((err as Error).message ?? "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Buy single */}
      <form onSubmit={submit} className="space-y-2">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
            Your email
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.co.uk"
            required
            className="mt-1 block w-full rounded-md border px-3 py-2 text-[13px] text-neutral-900 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            style={{ borderColor: "rgba(0,0,0,0.12)" }}
          />
        </label>
        {error && (
          <div className="rounded-md bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center rounded-md bg-neutral-900 text-[12px] font-black uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Preparing checkout…" : "Buy this image — £10"}
        </button>
      </form>

      {/* OR divider */}
      <div className="relative py-1 text-center">
        <span
          className="absolute inset-x-0 top-1/2 h-px"
          style={{ backgroundColor: "rgba(0,0,0,0.08)" }}
        />
        <span
          className="relative inline-block px-2 text-[10px] font-black uppercase tracking-wider text-neutral-400"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          Or
        </span>
      </div>

      {/* Add to pack */}
      <div>
        {inCart ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex h-11 flex-1 items-center justify-center rounded-md border text-[12px] font-black uppercase tracking-wider"
              style={{ borderColor: "#166534", backgroundColor: "#F0FDF4", color: "#166534" }}
            >
              ✓ In your pack ({count})
            </span>
            <button
              type="button"
              onClick={() => remove(imageId)}
              className="inline-flex h-11 items-center rounded-md border px-3 text-[11px] font-black uppercase tracking-wider text-neutral-500 transition hover:bg-neutral-50"
              style={{ borderColor: "rgba(0,0,0,0.12)" }}
              aria-label="Remove from pack"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => add(imageId)}
            className="inline-flex h-11 w-full items-center justify-center rounded-md border text-[12px] font-black uppercase tracking-wider text-neutral-900 transition hover:bg-neutral-50"
            style={{ borderColor: "rgba(0,0,0,0.20)" }}
          >
            + Add to pack {count > 0 && <span className="ml-1 text-neutral-500">({count})</span>}
          </button>
        )}
        {count > 0 && (
          <Link
            href="/store/cart"
            className="mt-2 block text-center text-[11px] font-black uppercase tracking-wider text-neutral-500 hover:text-neutral-900"
          >
            View pack ({count}) →
          </Link>
        )}
        <p className="mt-1 text-center text-[10px] text-neutral-500">
          Packs from £39 (5 images) up to £249 (50 images).
        </p>
      </div>
    </div>
  );
}
