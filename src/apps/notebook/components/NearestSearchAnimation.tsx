// Loading animation for the Trade Notebook's "finding nearest merchants"
// pass. Philip's brief: "update spinner hammer action" — a hammer that
// rotates + a status ticker showing merchants being scanned.
//
// Pure CSS animation (Tailwind's arbitrary-value + keyframes injected
// via style tag). Used briefly on first mount then swapped out for the
// result rows.

"use client";

import { useEffect, useState } from "react";
import { Hammer } from "lucide-react";
import { MERCHANT_FIXTURES } from "@/apps/tradecenter/data/merchants";

type Props = {
  itemCount: number;
};

export function NearestSearchAnimation({ itemCount }: Props) {
  const [tickIndex, setTickIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTickIndex((i) => (i + 1) % MERCHANT_FIXTURES.length);
    }, 220);
    return () => clearInterval(id);
  }, []);

  const scanning = MERCHANT_FIXTURES[tickIndex]?.displayName ?? "…";

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border p-10 text-center"
      style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FFFDF8" }}
    >
      {/* Hammer swing animation. Uses inline @keyframes so we don't need
          to touch tailwind.config for one-off animation. */}
      <style>{`
        @keyframes tc-hammer-swing {
          0%   { transform: rotate(-32deg); }
          45%  { transform: rotate(-32deg); }
          60%  { transform: rotate(24deg); }
          75%  { transform: rotate(24deg); }
          100% { transform: rotate(-32deg); }
        }
        @keyframes tc-hammer-impact {
          0%   { transform: translateY(0); opacity: 0; }
          55%  { transform: translateY(0); opacity: 0; }
          60%  { transform: translateY(2px); opacity: 1; }
          80%  { transform: translateY(2px); opacity: 0.7; }
          100% { transform: translateY(6px); opacity: 0; }
        }
        @keyframes tc-ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* Spinner + hammer combo */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        {/* Outer ring spinner */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "3px solid rgba(139,69,19,0.10)",
            borderTopColor: "#166534",
            animation: "tc-ring-spin 1s linear infinite"
          }}
          aria-hidden
        />
        {/* Hammer icon that swings */}
        <div
          style={{
            transformOrigin: "50% 70%",
            animation: "tc-hammer-swing 900ms ease-in-out infinite"
          }}
        >
          <Hammer size={40} className="text-neutral-900" strokeWidth={2}/>
        </div>
        {/* Impact spark */}
        <div
          className="absolute -bottom-1 h-1.5 w-6 rounded-full"
          style={{
            backgroundColor: "#FFB300",
            animation: "tc-hammer-impact 900ms ease-in-out infinite"
          }}
          aria-hidden
        />
      </div>

      <div>
        <div className="text-[13px] font-black text-neutral-900">
          Finding the nearest merchant for every notebook item
        </div>
        <div className="mt-1 text-[11.5px] text-neutral-600">
          Scanning {itemCount} item{itemCount === 1 ? "" : "s"} across {MERCHANT_FIXTURES.length} verified merchants…
        </div>
      </div>

      {/* Ticker */}
      <div
        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10.5px] font-black uppercase tracking-wider"
        style={{ backgroundColor: "#0A0A0A", color: "#FFB300" }}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#FFB300]"/>
        Checking {scanning}
      </div>

      {/* Reassurance line — Trade Center's principle surfaced */}
      <p className="max-w-md text-[10.5px] leading-snug text-neutral-500">
        Ranked by distance, never by price. Merchants stay on Trade Center because we don't push
        them into price wars.
      </p>
    </div>
  );
}
