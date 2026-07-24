"use client";

// DiscoverHeader — page nav (back arrow + title + notifications) +
// "DISCOVER" tag + subtitle + search bar.

import Link from "next/link";
import { ArrowLeft, Bell, Search } from "lucide-react";

export function DiscoverHeader({
  query, onQueryChange
}: {
  query:         string;
  onQueryChange: (v: string) => void;
}) {
  return (
    <>
      <header
        className="flex items-center justify-between px-4 pt-3 pb-3"
        style={{
          background: "color-mix(in oklab, var(--nex-cream) 92%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--nex-neutral-200)"
        }}
      >
        <Link href="/nex-app" aria-label="Back to home"
              className="grid h-9 w-9 place-items-center rounded-full"
              style={{ color: "var(--nex-neutral-700)" }}>
          <ArrowLeft size={22} strokeWidth={1.75} />
        </Link>
        <div className="flex flex-col text-center">
          <span className="text-[10px] font-black uppercase tracking-[0.28em]"
                style={{ color: "var(--nex-accent-500)" }}>
            Discover
          </span>
          <span className="text-[12px] font-semibold leading-tight"
                style={{ color: "var(--nex-neutral-900)" }}>
            Find People, Businesses &amp; Communities
          </span>
        </div>
        <button type="button" aria-label="Notifications"
                className="relative grid h-9 w-9 place-items-center rounded-full"
                style={{ color: "var(--nex-neutral-700)" }}>
          <Bell size={20} strokeWidth={1.75} />
        </button>
      </header>

      <div className="mt-3 px-4">
        <div
          className="flex items-center gap-2 rounded-full pl-3.5 pr-3 py-2"
          style={{
            background: "var(--nex-neutral-0)",
            border: "1px solid var(--nex-neutral-200)",
            boxShadow: "var(--nex-shadow-sm)"
          }}
        >
          <Search size={16} strokeWidth={1.75} style={{ color: "var(--nex-neutral-400)" }} />
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search people or businesses..."
            aria-label="Search Discover"
            className="flex-1 bg-transparent py-1 text-[13px] outline-none placeholder:text-[color:var(--nex-neutral-400)]"
            style={{ color: "var(--nex-neutral-900)" }}
          />
        </div>
      </div>
    </>
  );
}
