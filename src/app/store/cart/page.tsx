// /store/cart — pack cart page.
//
// Client component (the cart lives in localStorage). Fetches image
// metadata for the cart ids on mount from a small API so we don't
// need to ship the whole library. Shows the pack tier + total,
// nudges to next tier, checks out via /api/store/checkout.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStoreCart, priceForCount, nextTierNudge, PACK_TIERS } from "../useStoreCart";

type Item = { id: string; url: string; alt: string };

export default function CartPage() {
  const { ids, remove, clear, count } = useStoreCart();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch metadata whenever the id list changes.
  useEffect(() => {
    if (ids.length === 0) { setItems([]); return; }
    setLoading(true);
    fetch("/api/store/lookup", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ ids })
    })
      .then((r) => r.json())
      .then((data) => setItems((data.items ?? []) as Item[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [ids]);

  const tier = priceForCount(count);
  const nudge = nextTierNudge(count);
  const perImage = count > 0 ? (tier.priceGbp / count).toFixed(2) : "0.00";

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (count === 0) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ imageIds: ids, email: email.trim() })
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
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2 text-[11px] text-neutral-500">
        <Link href="/store" className="hover:text-neutral-900">Site Interest</Link>
        <span>›</span>
        <span className="text-neutral-700">Your pack</span>
      </div>

      <h1 className="text-[28px] font-black text-neutral-900 md:text-[32px]">
        Your pack
      </h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Build up a pack of 1-50 images. The price tier updates automatically.
      </p>

      {count === 0 ? (
        <div
          className="mt-8 rounded-2xl border p-10 text-center"
          style={{ borderColor: "rgba(0,0,0,0.10)", backgroundColor: "#FAFAF7" }}
        >
          <div className="text-[16px] font-black text-neutral-900">Your pack is empty</div>
          <p className="mx-auto mt-2 max-w-sm text-[12px] text-neutral-600">
            Browse the library and tap &ldquo;Add to pack&rdquo; on any image to start building.
          </p>
          <Link
            href="/store/browse"
            className="mt-5 inline-flex h-11 items-center rounded-md bg-neutral-900 px-5 text-[12px] font-black uppercase tracking-wider text-white transition hover:opacity-90"
          >
            Browse the library →
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          {/* Items grid */}
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                {count} image{count === 1 ? "" : "s"}
              </div>
              <button
                type="button"
                onClick={clear}
                className="text-[10px] font-black uppercase tracking-wider text-neutral-500 hover:text-red-600"
              >
                Clear all
              </button>
            </div>
            {loading && items.length === 0 ? (
              <div className="text-[12px] text-neutral-500">Loading…</div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {items.map((img) => (
                  <div key={img.id} className="relative">
                    <div
                      className="overflow-hidden rounded-lg border bg-neutral-100"
                      style={{ borderColor: "rgba(0,0,0,0.08)", aspectRatio: "9 / 12" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt={img.alt} loading="lazy" className="h-full w-full object-cover"/>
                      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <span
                          className="rotate-[-25deg] text-[9px] font-black uppercase tracking-[0.3em] text-white/40"
                          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
                        >
                          Site Interest
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(img.id)}
                      className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-[12px] font-black text-neutral-700 shadow-sm transition hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove from pack"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Sticky sidebar — pricing + checkout */}
          <aside>
            <div
              className="sticky top-20 space-y-4 rounded-2xl border p-5"
              style={{ borderColor: "rgba(0,0,0,0.10)" }}
            >
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
                  {tier.label}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <div className="text-[36px] font-black leading-none text-neutral-900">£{tier.priceGbp}</div>
                  <div className="text-[11px] font-bold text-neutral-500">total</div>
                </div>
                <div className="mt-1 text-[11px] text-neutral-500">
                  £{perImage} per image · {count} of {tier.size} used
                </div>
              </div>

              {/* Nudge — add more to fill the tier */}
              {nudge && nudge.moreToAdd > 0 && (
                <div
                  className="rounded-lg p-3 text-[11px] leading-snug text-neutral-700"
                  style={{ backgroundColor: "#FFFBEB" }}
                >
                  <span className="font-black">Add {nudge.moreToAdd} more</span> to fill your Pack of {nudge.nextSize} for the same price.
                  <Link href="/store/browse" className="ml-1 underline">Browse →</Link>
                </div>
              )}

              {/* Pack tier ladder */}
              <div>
                <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Pack tiers
                </div>
                <ul className="space-y-1 text-[11px]">
                  {PACK_TIERS.map((t) => {
                    const active = tier.size === t.size;
                    return (
                      <li
                        key={t.size}
                        className="flex items-center justify-between rounded-md px-2 py-1"
                        style={{
                          backgroundColor: active ? "#FFFBEB" : "transparent",
                          color:           active ? "#0A0A0A" : "#525252"
                        }}
                      >
                        <span className="font-black">{t.label}</span>
                        <span className="tabular-nums">£{t.priceGbp}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Checkout form */}
              <form onSubmit={checkout} className="space-y-2 border-t pt-4"
                style={{ borderColor: "rgba(0,0,0,0.08)" }}
              >
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
                  disabled={busy || count === 0}
                  className="inline-flex h-11 w-full items-center justify-center rounded-md bg-neutral-900 text-[12px] font-black uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {busy ? "Preparing checkout…" : `Checkout — £${tier.priceGbp}`}
                </button>
                <p className="text-center text-[10px] text-neutral-500">
                  Secure Stripe checkout. Download links emailed after payment.
                </p>
              </form>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
