// src/app/nex-native/_your-nex-card.tsx
//
// Wave 4 · Server Component wrapping the "Your NEX" address card ·
// sealed 2026-09-25. This is the surface that starts the Founder's
// acquisition loop:
//   Owner sees their NEX Address → copies it → shares in every bio →
//   visitor arrives → enters Chat → relationship begins.
//
// The card is intentionally understated · not a growth-hack banner ·
// so it can live on multiple owner surfaces (manage/site, conversations,
// settings) without feeling repetitive.

import React from "react";
import Link from "next/link";
import type { NexAddress } from "@/lib/nex-native/nex-address";
import { CopyNexLinkButton } from "./_copy-nex-link-button";

interface YourNexCardProps {
  address: NexAddress;
  /** Optional context label · defaults to "Your NEX". */
  label?: string;
}

export function YourNexCard({ address, label = "Your NEX" }: YourNexCardProps) {
  return (
    <section
      className="mb-4 rounded-2xl border border-[var(--nex-neutral-200)] bg-white/70 p-4 backdrop-blur-sm"
      data-nex-your-nex-card
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--nex-accent-600)]">
            {label}
          </p>
          <p className="mt-0.5 text-lg font-semibold text-[var(--nex-neutral-900)]">
            {address.display}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--nex-neutral-500)]">
            share this link everywhere · your Instagram bio · email
            signature · WhatsApp status · QR codes.
          </p>
        </div>
        <CopyNexLinkButton
          url={address.url}
          display="Copy"
          className="shrink-0"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={address.url}
          target="_blank"
          className="inline-flex items-center rounded-full border border-[var(--nex-neutral-300)] bg-white px-3 py-1 text-xs text-[var(--nex-neutral-700)] hover:border-[var(--nex-accent-600)] hover:text-[var(--nex-accent-700)]"
          data-nex-open-your-nex
        >
          Open your NEX ↗
        </Link>
        {!address.is_polished && (
          <span
            className="inline-flex items-center rounded-full border border-[var(--nex-warning-500)]/40 bg-white/70 px-3 py-1 text-xs text-[var(--nex-neutral-700)]"
            data-nex-unpolished-address
          >
            Upgrade to a human-readable handle
          </span>
        )}
      </div>
    </section>
  );
}
