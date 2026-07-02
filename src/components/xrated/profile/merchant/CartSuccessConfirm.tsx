"use client";

// CartSuccessConfirm — confirms the order on the server (Payment Link
// mode) and shows the receipt-style success card.

import { useEffect, useState } from "react";
import Link from "next/link";

type ConfirmState =
  | { kind: "loading" }
  | { kind: "ok"; orderRef: string }
  | { kind: "no_pending" }
  | { kind: "error"; message: string };

export function CartSuccessConfirm({
  listingSlug,
  merchantName
}: {
  listingSlug: string;
  merchantName: string;
}) {
  const [state, setState] = useState<ConfirmState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Priority: URL params (Stripe/PayPal/Square all echo something
      // back on their return URL) → sessionStorage (Payment Link mode
      // that has no server-round-trip echo).
      const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
      const refFromUrl = url?.searchParams.get("ref") ?? null;
      const sessionIdFromUrl =
        url?.searchParams.get("session_id") ??
        url?.searchParams.get("token") ??
        url?.searchParams.get("transactionId") ??
        null;
      const ref =
        refFromUrl ??
        (typeof window !== "undefined"
          ? window.sessionStorage.getItem("xrated_pending_order_ref")
          : null);
      const slug =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem("xrated_pending_order_slug")
          : null;
      if (!ref) {
        if (!cancelled) setState({ kind: "no_pending" });
        return;
      }
      if (slug && slug !== listingSlug) {
        if (!cancelled) setState({ kind: "no_pending" });
        return;
      }
      try {
        const res = await fetch("/api/checkout/confirm-provider", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            listing_slug: listingSlug,
            order_ref: ref,
            session_id: sessionIdFromUrl ?? undefined
          })
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setState({ kind: "error", message: json.error ?? "confirm_failed" });
          return;
        }
        // Clear the session storage — order confirmed.
        try {
          window.sessionStorage.removeItem("xrated_pending_order_ref");
          window.sessionStorage.removeItem("xrated_pending_order_slug");
        } catch {
          /* ignore */
        }
        setState({ kind: "ok", orderRef: ref });
      } catch (e) {
        if (cancelled) return;
        setState({ kind: "error", message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingSlug]);

  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-12 pt-10 sm:px-6">
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-center">
        {state.kind === "loading" && (
          <p className="text-[14px] font-bold text-neutral-700">
            Confirming your order…
          </p>
        )}
        {state.kind === "no_pending" && (
          <>
            <p className="text-[18px] font-extrabold text-neutral-900">
              Welcome back.
            </p>
            <p className="mt-2 text-[13px] text-neutral-500">
              We couldn&rsquo;t find a pending order in this session. If you just
              completed a payment, please check your provider receipt.
            </p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <p className="text-[16px] font-extrabold text-red-700">
              We couldn&rsquo;t confirm the order automatically.
            </p>
            <p className="mt-2 text-[13px] text-neutral-500">
              {state.message}. If you completed payment, message{" "}
              {merchantName} on WhatsApp to confirm.
            </p>
          </>
        )}
        {state.kind === "ok" && (
          <>
            <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "#0F7A3F" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l5 5L20 7" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-extrabold text-neutral-900">
              Order received
            </h1>
            <p className="mt-2 text-[14px] text-neutral-700">
              Reference{" "}
              <span className="font-mono font-extrabold">{state.orderRef}</span>
            </p>
            <p className="mt-3 text-[13px] text-neutral-500">
              {merchantName} will be in touch about delivery. Please keep your
              payment-provider receipt for your records.
            </p>
            <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
              <Link
                href={`/${listingSlug}/shop`}
                className="inline-flex h-11 items-center rounded-xl bg-neutral-900 px-5 text-[13px] font-extrabold uppercase tracking-wider text-white transition hover:opacity-90"
              >
                Back to shop
              </Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
