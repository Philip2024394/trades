"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Globe,
  Inbox,
  ArrowRight,
  MapPin,
  Sparkles,
  Clock,
  PoundSterling
} from "lucide-react";

type TabKey = "app" | "leads";

const TABS: {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "app", label: "Your Trade App", icon: Globe },
  { key: "leads", label: "Your First Leads", icon: Inbox }
];

export function PreviewTabs() {
  const [active, setActive] = useState<TabKey>("app");

  return (
    <div>
      {/* Tab strip */}
      <div
        role="tablist"
        aria-label="What you get"
        className="inline-flex rounded-full border border-[#1B1A17]/12 bg-white p-1 shadow-[0_10px_30px_-16px_rgba(27,26,23,0.20)]"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(t.key)}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition sm:px-5 sm:text-[14px] ${
                isActive
                  ? "bg-[#1B1A17] text-white"
                  : "text-[#1B1A17]/65 hover:text-[#1B1A17]"
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="mt-5">
        {active === "app" ? <AppPreview /> : <LeadsPreview />}
      </div>
    </div>
  );
}

function AppPreview() {
  return (
    <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#FBF6EC] p-6 shadow-[0_20px_50px_-24px_rgba(27,26,23,0.20)] md:p-10">
      <div className="mx-auto max-w-[360px]">
        {/* iPhone frame */}
        <div className="relative rounded-[52px] border-[10px] border-neutral-900 bg-neutral-900 p-0 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.35),_0_0_0_1px_rgba(0,0,0,0.08)]">
          {/* Side buttons */}
          <div className="pointer-events-none absolute -right-[13px] top-24 h-14 w-[3px] rounded-r bg-neutral-900" />
          <div className="pointer-events-none absolute -left-[13px] top-20 h-8 w-[3px] rounded-l bg-neutral-900" />
          <div className="pointer-events-none absolute -left-[13px] top-36 h-14 w-[3px] rounded-l bg-neutral-900" />

          {/* Screen — outer bg matches the sticky footer so any sub-pixel
              seam at the bottom reads as one continuous black surface. */}
          <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-[42px] bg-neutral-950">
            {/* Black status area behind the Dynamic Island */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 z-20 h-10 bg-neutral-950"
            />
            {/* Dynamic Island */}
            <div
              aria-hidden
              className="absolute left-1/2 top-2 z-30 flex h-6 w-24 -translate-x-1/2 items-center justify-end gap-1.5 rounded-full bg-neutral-800 px-3"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-700" />
            </div>

            <iframe
              src="/sample-notebook?embed=1"
              title="Live sample Trade Notebook"
              aria-label="Live preview of a Trade Notebook"
              loading="lazy"
              className="absolute left-0 top-10 border-0 bg-white"
              style={{
                width: "100%",
                height: "calc(100% - 2.5rem)"
              }}
            />

            {/* Home indicator */}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-1.5 z-20 mx-auto h-1 w-24 rounded-full bg-neutral-900/40"
            />
          </div>
        </div>

        <p className="mt-6 text-center text-[13px] leading-[1.55] text-[#1B1A17]/60">
          Your Trade App — live at a URL like{" "}
          <span className="font-mono text-[#1B1A17]/80">
            thenetworkers.app/your-name
          </span>
          .<br />
          Same shape, filled with <em>your</em> details.
        </p>

        <div className="mt-4 flex items-center justify-center">
          <Link
            href="/sample-notebook"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-amber-700 underline-offset-4 hover:underline"
          >
            Open the full sample in a new tab
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}

function LeadsPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#1B1A17]/12 bg-white shadow-[0_20px_50px_-24px_rgba(27,26,23,0.20)]">
      {/* Header */}
      <div className="border-b border-[#1B1A17]/8 bg-[#1B1A17]/4 px-5 py-3 md:px-8">
        <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
          <Inbox className="h-3 w-3" aria-hidden />
          Your inbox — 1 new brief
        </div>
      </div>

      {/* Fake brief */}
      <div className="grid gap-6 p-5 md:grid-cols-5 md:p-8">
        <div className="md:col-span-3">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-700">
            <Sparkles className="h-3 w-3" aria-hidden />
            New project · matched to you
          </div>
          <h3 className="mt-3 text-[20px] font-black leading-tight text-[#1B1A17] md:text-[24px]">
            Kitchen fit-out
          </h3>
          <p className="mt-1 inline-flex items-center gap-1 text-[13px] text-[#1B1A17]/60">
            <MapPin className="h-3 w-3" aria-hidden />
            M20 3AB · 1.4 miles from you
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[#1B1A17]/10 bg-[#1B1A17]/4 p-3">
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#1B1A17]/50">
                <PoundSterling className="h-3 w-3" aria-hidden />
                Budget
              </div>
              <div className="mt-1 text-[15px] font-black text-[#1B1A17]">
                £15k–25k
              </div>
            </div>
            <div className="rounded-lg border border-[#1B1A17]/10 bg-[#1B1A17]/4 p-3">
              <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#1B1A17]/50">
                <Clock className="h-3 w-3" aria-hidden />
                Timeframe
              </div>
              <div className="mt-1 text-[15px] font-black text-[#1B1A17]">
                1–3 months
              </div>
            </div>
          </div>

          <p className="mt-4 text-[13px] leading-[1.55] text-[#1B1A17]/70">
            &ldquo;Full rip and refit, 4 x 3m kitchen. Existing units to
            strip, replaster where needed, fit new carcasses + worktops.
            Ready to start end of the month.&rdquo;
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full bg-amber-400 px-4 text-[12px] font-bold text-neutral-900"
            >
              Reply now
              <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
            <button
              type="button"
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-[#1B1A17]/15 bg-white px-4 text-[12px] font-semibold text-[#1B1A17]"
            >
              Not for me
            </button>
          </div>
        </div>

        <ul className="space-y-2 md:col-span-2">
          <PerkRow>Free — no lead-cost, no callback fee</PerkRow>
          <PerkRow>Matched by postcode + your trade</PerkRow>
          <PerkRow>Homeowner-confirmed, not scraped</PerkRow>
          <PerkRow>Reply direct — WhatsApp or email</PerkRow>
        </ul>
      </div>

      <div className="border-t border-[#1B1A17]/8 bg-[#1B1A17]/4 px-5 py-3 text-[11px] text-[#1B1A17]/55 md:px-8">
        Every homeowner brief on the platform routes to matched trades in the
        area. When yours lands, you see it here.
      </div>
    </div>
  );
}

function PerkRow({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 rounded-lg border border-[#1B1A17]/10 bg-[#1B1A17]/4 p-3 text-[12px] leading-[1.5] text-[#1B1A17]/75">
      <span
        aria-hidden
        className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
      />
      {children}
    </li>
  );
}
