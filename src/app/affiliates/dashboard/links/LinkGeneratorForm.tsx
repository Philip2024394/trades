"use client";

import { useMemo, useState } from "react";
import { CopyButton } from "../CopyButton";

const QUICK_LINKS: { href: string; label: string }[] = [
  { href: "https://thenetworkers.app/", label: "Homepage" },
  { href: "https://thenetworkers.app/trade-off/pricing", label: "Pricing" },
  { href: "https://thenetworkers.app/trade-off/trades", label: "Trade examples" },
  { href: "https://thenetworkers.app/showcase", label: "Showcase" }
];

function append(url: string, affiliateId: number): string {
  try {
    const u = new URL(url);
    u.searchParams.set("ref", String(affiliateId));
    return u.toString();
  } catch {
    // Bare slug — assume thenetworkers.app origin.
    const path = url.startsWith("/") ? url : `/${url}`;
    return `https://thenetworkers.app${path}?ref=${affiliateId}`;
  }
}

export function LinkGeneratorForm({ affiliateId }: { affiliateId: number }) {
  const [input, setInput] = useState("https://thenetworkers.app/");
  const generated = useMemo(
    () => append(input, affiliateId),
    [input, affiliateId]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-line bg-brand-surface p-5">
        <label className="block">
          <span className="text-[13px] font-bold text-brand-text">
            Paste any thenetworkers.app URL
          </span>
          <input
            type="url"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="mt-1 block h-12 w-full rounded-xl border border-brand-line bg-brand-bg px-3 text-[13px] text-brand-text focus:border-brand-accent focus:outline-none"
          />
        </label>
        <div className="mt-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-accent">
            Your tagged link
          </p>
          <p className="mt-2 break-all rounded-lg bg-brand-bg p-3 text-[13px] font-mono text-brand-text">
            {generated}
          </p>
          <div className="mt-3">
            <CopyButton text={generated} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-muted">
          Quick links
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_LINKS.map((q) => (
            <button
              key={q.href}
              type="button"
              onClick={() => setInput(q.href)}
              className="rounded-lg border border-brand-line bg-brand-surface px-3 py-2 text-[13px] font-bold text-brand-text hover:bg-brand-line"
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
