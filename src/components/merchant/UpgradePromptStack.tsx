"use client";

// UpgradePromptStack — renders up to 2 active upgrade nudges at the
// top of the merchant dashboard. Each is dismissible (fires POST to
// the dismiss endpoint) and links to the tier-appropriate upgrade
// path. Server passes the pre-resolved list of active prompts —
// this component is a pure presenter.

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export type PromptViewModel = {
  key:        string;
  targetTier: string;
  title:      string;
  body:       string;
  ctaLabel:   string;
  ctaHref:    string;
};

export function UpgradePromptStack({
  prompts,
  slug
}: {
  prompts: PromptViewModel[];
  slug:    string;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = prompts.filter((p) => !dismissed.has(p.key));
  if (visible.length === 0) return null;

  async function dismiss(key: string) {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    try {
      await fetch("/api/upgrade-prompts/dismiss", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slug, key })
      });
    } catch {
      /* best-effort — user still won't see the prompt this session */
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-2 px-4 pb-2 pt-4">
      {visible.map((p) => (
        <div
          key={p.key}
          className="flex items-center gap-3 rounded-xl border p-3"
          style={{
            borderColor:     "rgba(184,134,11,0.30)",
            backgroundColor: "#FFF7DB"
          }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#7A5B00]">
              {p.title}
            </p>
            <p className="mt-0.5 text-[12px] leading-snug text-neutral-800">
              {p.body}
            </p>
          </div>
          <Link
            href={p.ctaHref}
            className="inline-flex h-8 shrink-0 items-center rounded-full px-3 text-[10px] font-black uppercase tracking-wider text-white transition hover:brightness-95"
            style={{ backgroundColor: "#166534" }}
          >
            {p.ctaLabel}
          </Link>
          <button
            type="button"
            onClick={() => dismiss(p.key)}
            aria-label={`Dismiss ${p.title}`}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
          >
            <X size={14} strokeWidth={2.4}/>
          </button>
        </div>
      ))}
    </div>
  );
}
