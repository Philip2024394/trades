"use client";

// Boost button that renders on the trade's OWN yard posts. Detects
// ownership by comparing the URL magic-link slug against the post
// owner's slug. If the viewer isn't authed as the post's owner the
// button never renders — no wasted pixels for buyers.
//
// Click opens a small confirmation modal with two duration options
// (24h / 48h) and their reference prices. Confirming hits the boost
// API which extends is_boosted_until immediately. Feed prioritisation
// is server-sorted; the card badge (BOOSTED) updates on next visit
// or after a router.refresh().
//
// V1 payment integration: not wired. The modal notes the price is
// for reference and marks the boost as "free during launch". Wire
// Stripe payment mode into the button's confirm flow when ready.

import { useEffect, useState } from "react";
import { Rocket, X, Loader2, Check } from "lucide-react";

const BRAND_YELLOW = "#FFB300";
const BRAND_INK = "#0A0A0A";

export function YardBoostButton({
  postId,
  posterSlug
}: {
  postId: string;
  posterSlug: string;
}) {
  const [ownerAuth, setOwnerAuth] = useState<{ slug: string; token: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // Only surface the button if the URL magic-link identity matches
  // this post's poster slug. Everyone else stays button-less.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const slug = sp.get("slug");
    const token = sp.get("token");
    if (slug && token && slug === posterSlug) {
      setOwnerAuth({ slug, token });
    }
  }, [posterSlug]);

  if (!ownerAuth) return null;

  async function apply(hours: 24 | 48) {
    if (!ownerAuth || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Route through Stripe Checkout — one-time payment mode. The
      // webhook branches on metadata.kind='boost' and extends
      // is_boosted_until on payment success. Returning the Stripe URL
      // and redirecting means we never fake-apply a boost that hasn't
      // been paid for.
      const res = await fetch(`/api/trade-off/yard/boost/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: ownerAuth.slug,
          edit_token: ownerAuth.token,
          post_id: postId,
          hours
        })
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        url?: string;
      };
      if (!res.ok || !data.ok || !data.url) {
        setError(
          data.error === "unauthorised"
            ? "Sign-in expired — grab a fresh magic link."
            : "Couldn't start boost checkout. Try again."
        );
        return;
      }
      // Persistent redirect to Stripe; the return URL comes back to
      // /trade-off/yard with a ?boost=success flag.
      window.location.href = data.url;
    } catch {
      setError("Network error — try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDone(null);
          setError(null);
          setOpen(true);
        }}
        aria-label="Boost this post"
        className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[11px] font-black uppercase tracking-[0.14em] shadow-sm transition active:scale-[0.97]"
        style={{ background: BRAND_YELLOW, color: BRAND_INK }}
      >
        <Rocket className="h-3.5 w-3.5" aria-hidden />
        Boost
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Boost this post"
          className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6"
          style={{ background: "rgba(20,17,10,0.72)" }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border bg-[#FBF6EC] shadow-2xl"
            style={{ borderColor: "rgba(27,26,23,0.10)" }}
          >
            <button
              type="button"
              onClick={() => !busy && setOpen(false)}
              aria-label="Close"
              disabled={busy}
              className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md"
              style={{ background: "#8B0F0F" }}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>

            <div className="px-5 pb-4 pt-5">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">
                <Rocket className="h-3 w-3" aria-hidden />
                Boost your post
              </div>
              <h2 className="mt-2 text-[18px] font-black leading-tight text-[#1B1A17]">
                Float to the top of The Yard.
              </h2>
              <p className="mt-2 text-[12px] leading-[1.5] text-[#1B1A17]/70">
                Boosted posts appear above every other post in the feed
                for the duration you choose. Re-boosting a live boost
                adds time — nothing gets lost.
              </p>

              {done ? (
                <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-50 p-3">
                  <div className="flex items-center gap-2 text-[13px] font-black text-emerald-900">
                    <Check className="h-4 w-4" aria-hidden />
                    Boost applied
                  </div>
                  <p className="mt-1 text-[11px] text-emerald-900/70">
                    Refreshing the feed…
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => apply(24)}
                    className="flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition hover:border-amber-400 disabled:opacity-60"
                    style={{ borderColor: "rgba(27,26,23,0.15)", background: "white" }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                      24 hours
                    </span>
                    <span className="text-[15px] font-black text-[#1B1A17]">
                      £2.00
                    </span>
                    <span className="text-[10px] text-[#1B1A17]/55">
                      Pay via Stripe
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => apply(48)}
                    className="flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition hover:border-amber-400 disabled:opacity-60"
                    style={{ borderColor: "rgba(27,26,23,0.15)", background: "white" }}
                  >
                    <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">
                      48 hours
                    </span>
                    <span className="text-[15px] font-black text-[#1B1A17]">
                      £5.00
                    </span>
                    <span className="text-[10px] text-[#1B1A17]/55">
                      Pay via Stripe
                    </span>
                  </button>
                </div>
              )}

              {busy && (
                <div className="mt-3 flex items-center gap-1.5 text-[12px] text-[#1B1A17]/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Applying boost…
                </div>
              )}
              {error && (
                <p className="mt-3 text-[12px] font-semibold text-red-700">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
