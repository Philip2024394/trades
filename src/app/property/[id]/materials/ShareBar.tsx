"use client";

// Copy-link + WhatsApp share for a Materials Passport. Rendered near
// the top so a homeowner can send the URL to their surveyor / insurer /
// buyer in one tap.

import { useState } from "react";
import { Share2, Copy, Check, MessageCircle } from "lucide-react";

export function PassportShareBar({
  postcodePrefix
}: {
  postcodePrefix: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* silent */
    }
  }

  function whatsappHref() {
    if (typeof window === "undefined") return "#";
    const text = encodeURIComponent(
      `Materials Passport for the property${
        postcodePrefix ? ` at ${postcodePrefix}` : ""
      } — every trade action tagged to the address: ${window.location.href}`
    );
    return `https://wa.me/?text=${text}`;
  }

  return (
    <div
      className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border p-3 shadow-sm"
      style={{
        borderColor: "rgba(15,122,63,0.25)",
        background:
          "linear-gradient(90deg, rgba(15,122,63,0.06) 0%, rgba(255,255,255,1) 60%)"
      }}
    >
      <Share2
        className="h-4 w-4 shrink-0 text-emerald-700"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-black text-[#1B1A17]">
          Share this passport
        </p>
        <p className="text-[10.5px] text-[#1B1A17]/60">
          Send the audit chain to a surveyor, insurer, or buyer.
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-emerald-700/20 bg-white px-3 text-[12px] font-black text-emerald-800 hover:bg-emerald-50"
        aria-label="Copy link"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" aria-hidden />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" aria-hidden />
            Copy link
          </>
        )}
      </button>
      <a
        href={whatsappHref()}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] font-black text-white shadow-sm"
        style={{ background: "#0F7A3F" }}
        aria-label="Share via WhatsApp"
      >
        <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        WhatsApp
      </a>
    </div>
  );
}
