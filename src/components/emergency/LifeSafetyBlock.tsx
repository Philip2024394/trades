"use client";

// LifeSafetyBlock — full-bleed hero banner + red life-safety callout
// with 3 UK emergency numbers. Each number has a tel: link AND a
// copy-to-clipboard button. Rendered at the top of /emergency and
// every /emergency/[slug] leaf.

import { useState } from "react";
import { AlertTriangle, Phone, Copy, Check } from "lucide-react";

const EMERGENCY_HERO = "https://ik.imagekit.io/9huhxxvtr/ChatGPT%20Image%20Jul%2020,%202026,%2008_20_06%20AM.png";

const NUMBERS: Array<{ number: string; label: string }> = [
  { number: "999",          label: "Fire / injury / crime in progress" },
  { number: "0800 111 999", label: "National Gas Emergency (24/7 free)" },
  { number: "105",          label: "UK street power failure (free)" }
];

export function LifeSafetyBlock() {
  return (
    <>
      {/* Full-bleed hero banner above the callout — no text overlay */}
      <div
        className="overflow-hidden rounded-2xl border-2 shadow-sm"
        style={{ borderColor: "rgba(139,69,19,0.10)", backgroundColor: "#0A0A0A" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={EMERGENCY_HERO}
          alt="UK trade emergency — life-safety first"
          className="block h-auto w-full object-contain"
          loading="eager"
        />
      </div>

      {/* Life-safety callout — always visible immediately below the banner */}
      <section
        className="mt-6 rounded-2xl border-2 p-6 shadow-sm md:p-8"
        style={{ borderColor: "#DC2626", backgroundColor: "#FEF2F2" }}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} strokeWidth={2.6} className="text-red-700"/>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-red-800">
            Life-safety first — call these before any trade
          </p>
        </div>
        <ul className="mt-3 grid gap-2 md:grid-cols-3">
          {NUMBERS.map((n) => (
            <NumberCard key={n.number} number={n.number} label={n.label}/>
          ))}
        </ul>
      </section>
    </>
  );
}

function NumberCard({ number, label }: { number: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement("textarea");
      el.value = number;
      document.body.appendChild(el);
      el.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); }
      catch { /* silent */ }
      document.body.removeChild(el);
    }
  }

  return (
    <li className="flex items-center gap-2 rounded-2xl border-2 bg-white p-3" style={{ borderColor: "#DC2626" }}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "#DC2626" }}>
        <Phone size={14} strokeWidth={2.6} className="text-white"/>
      </div>
      <div className="flex-1 min-w-0">
        <a
          href={`tel:${number.replace(/\s+/g, "")}`}
          className="text-[16px] font-black leading-none tabular-nums text-red-900 hover:underline"
        >
          {number}
        </a>
        <p className="mt-0.5 text-[10px] font-black uppercase tracking-wider text-neutral-600">{label}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Number copied" : `Copy ${number} to clipboard`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition"
        style={{
          borderColor:      copied ? "#166534" : "#DC2626",
          backgroundColor:  copied ? "#DCFCE7" : "#FFFFFF",
          color:            copied ? "#166534" : "#DC2626"
        }}
        title={copied ? "Copied" : "Copy number"}
      >
        {copied ? <Check size={13} strokeWidth={2.8}/> : <Copy size={13} strokeWidth={2.6}/>}
      </button>
    </li>
  );
}
