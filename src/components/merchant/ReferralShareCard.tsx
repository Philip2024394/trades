"use client";

// ReferralShareCard — dashboard widget showing the merchant's own
// referral link + copy button + running counts.
//
// Rewards summary is passed in from the server (referralStatsForMerchant)
// so the card is a leaf — no client-side data fetches, no loading state.

import { useState } from "react";

export function ReferralShareCard({
  slug,
  origin,
  stats
}: {
  slug:   string;
  origin: string;
  stats:  { totalReferrals: number; pendingRewards: number; fulfilledRewards: number };
}) {
  const link = `${origin}/?mref=${encodeURIComponent(slug)}`;
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can select the text manually */
    }
  }

  function shareWhatsapp() {
    const msg = `I've joined The Network — a UK trades platform with no lead fees. Here's my invite (both of us get 50 free WhatsApp leads):\n\n${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  function shareEmail() {
    const subject = "Join me on The Network";
    const body    = `I've joined The Network — a UK trades platform with no lead fees. You get your own live profile + WhatsApp button + reviews. Free for life if you log in every 30 days.\n\nWith my invite link, both of us get 50 free WhatsApp leads:\n\n${link}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#FFF7DB" }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "#7A5B00" }}>
            Invite another trade
          </p>
          <p className="mt-1 text-[15px] font-black text-neutral-900">
            50 free leads for you and them
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[22px] font-black leading-none" style={{ color: "#B8860B" }}>
            {stats.totalReferrals}
          </p>
          <p className="text-[9px] font-black uppercase tracking-wider text-neutral-500">
            {stats.totalReferrals === 1 ? "joined" : "joined"}
          </p>
        </div>
      </div>

      <div
        className="mt-4 flex items-center gap-2 rounded-lg border bg-white px-3 py-2"
        style={{ borderColor: "rgba(0,0,0,0.10)" }}
      >
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 truncate bg-transparent text-[12px] text-neutral-800 outline-none"
          aria-label="Your referral link"
        />
        <button
          type="button"
          onClick={copyLink}
          className="shrink-0 rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider transition"
          style={{ backgroundColor: copied ? "#166534" : "#0A0A0A", color: "#FFFFFF" }}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={shareWhatsapp}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full text-[11px] font-black uppercase tracking-wider transition"
          style={{ backgroundColor: "#166534", color: "#FFFFFF" }}
        >
          Share on WhatsApp
        </button>
        <button
          type="button"
          onClick={shareEmail}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border text-[11px] font-black uppercase tracking-wider text-neutral-900 transition hover:bg-neutral-50"
          style={{ borderColor: "rgba(0,0,0,0.15)", backgroundColor: "#FFFFFF" }}
        >
          Share by email
        </button>
      </div>

      {(stats.pendingRewards > 0 || stats.fulfilledRewards > 0) && (
        <div className="mt-4 flex items-center gap-4 border-t pt-3 text-[10px] font-bold text-neutral-600" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
          <span>Rewards:</span>
          {stats.pendingRewards > 0 && (
            <span><b>{stats.pendingRewards}</b> pending</span>
          )}
          {stats.fulfilledRewards > 0 && (
            <span className="text-green-700"><b>{stats.fulfilledRewards}</b> paid out</span>
          )}
        </div>
      )}
    </div>
  );
}
