// DiyWelcomeBanner — one-time inline onboarding for freshly-signed-up
// DIY viewers. Explains the core value in three short lines so a
// homeowner opening the app for the first time knows what they can
// actually do.
//
// Renders inline on /tc/trade-center. Dismissed permanently on the
// first close via localStorage. Silent for trades and guests.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ShoppingCart, ScrollText, ShieldCheck } from "lucide-react";
import { useCurrentTrade } from "@/lib/useCurrentTrade";

const DISMISS_KEY = "tc.diy-welcome-dismissed";

export function DiyWelcomeBanner() {
  const { trade } = useCurrentTrade();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (trade?.viewerRole !== "diy") {
      setVisible(false);
      return;
    }
    const dismissed = window.localStorage.getItem(DISMISS_KEY);
    setVisible(!dismissed);
  }, [trade?.viewerRole]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      /* silent */
    }
  }

  if (!visible) return null;

  return (
    <section
      className="relative mx-4 mt-4 flex flex-col gap-3 rounded-2xl border p-4 shadow-sm md:mx-6 md:flex-row md:items-start md:gap-4"
      style={{
        backgroundColor: "#DBEAFE",
        borderColor: "rgba(29,78,216,0.25)"
      }}
      role="region"
      aria-label="Welcome"
    >
      <div className="flex items-center gap-3 md:flex-shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: "#1D4ED8" }}
        >
          <ShoppingCart size={18} strokeWidth={2}/>
        </div>
        <div className="min-w-0 md:hidden">
          <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "#1E3A8A" }}>
            Welcome
          </div>
          <div className="mt-0.5 text-[14px] font-black text-neutral-900">
            How Trade Center works
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="hidden md:block">
          <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "#1E3A8A" }}>
            Welcome
          </div>
          <div className="mt-0.5 text-[15px] font-black text-neutral-900">
            How Trade Center works for DIY
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 text-[12px] leading-snug text-neutral-800">
          <li className="flex items-start gap-2">
            <ShoppingCart size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#1D4ED8" }}/>
            <span>
              <strong>Browse + add to cart</strong> — mix items from any merchants; each merchant checks out separately.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ShieldCheck size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#1D4ED8" }}/>
            <span>
              <strong>Safe Trade at checkout</strong> — pay via Stripe / PayPal / escrow. Money-back if the merchant doesn&apos;t deliver.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <ScrollText size={13} className="mt-0.5 flex-shrink-0" style={{ color: "#1D4ED8" }}/>
            <span>
              <strong>Notebook for whole projects</strong> — save everything you need, ask nearby merchants to quote it as one basket.
            </span>
          </li>
        </ul>
        <Link
          href="/tc/help"
          className="inline-flex w-fit items-center gap-1 text-[11px] font-black uppercase tracking-wider text-neutral-900 hover:underline"
        >
          Read the full guide
        </Link>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome message"
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-black/5 md:relative md:right-auto md:top-auto md:self-start"
      >
        <X size={14}/>
      </button>
    </section>
  );
}
