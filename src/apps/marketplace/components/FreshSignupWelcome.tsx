// FreshSignupWelcome — small "Welcome, {name}" chip that renders on
// the first landing after a freshly-signed-up trade account. DIY
// viewers get the DiyWelcomeBanner instead (full inline explainer);
// trades get this lighter greeting since they already know how the
// system works.
//
// Renders inline right under the header. One-time via localStorage —
// dismissed automatically after 12s or on first user gesture.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, X } from "lucide-react";
import { useCurrentTrade } from "@/lib/useCurrentTrade";

const SEEN_KEY = "tc.trade-fresh-welcome-seen";

export function FreshSignupWelcome() {
  const { trade } = useCurrentTrade();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Only trades — DIY viewers have their own banner elsewhere.
    if (!trade || trade.viewerRole === "diy") {
      setVisible(false);
      return;
    }
    const seen = window.localStorage.getItem(SEEN_KEY);
    if (seen) return;
    setVisible(true);
    // Fade out after 12 seconds so it never lingers on the page.
    const t = window.setTimeout(dismiss, 12_000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade?.tradeId, trade?.viewerRole]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(SEEN_KEY, new Date().toISOString());
    } catch {
      /* silent */
    }
  }

  if (!visible || !trade) return null;

  return (
    <div
      className="mx-4 mt-3 flex items-center gap-3 rounded-full border py-2 px-3 shadow-sm md:mx-6"
      style={{
        backgroundColor: "#0A0A0A",
        borderColor: "rgba(255,179,0,0.4)",
        color: "#FFB300"
      }}
      role="status"
    >
      <Sparkles size={14} strokeWidth={2.2}/>
      <div className="min-w-0 flex-1 truncate text-[12px] font-black">
        Welcome to Trade Center, {trade.displayName.split(" ")[0]}.
      </div>
      <Link
        href="/tc/identity"
        onClick={dismiss}
        className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-[#FFB300] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-900 shadow-sm hover:brightness-105"
      >
        Verify identity
        <ArrowRight size={11}/>
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss welcome message"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10"
      >
        <X size={12}/>
      </button>
    </div>
  );
}
