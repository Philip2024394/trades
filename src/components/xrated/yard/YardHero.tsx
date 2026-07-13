// The Yard hero — construction-style, action-first.
//
// Not marketing copy over an image. This is above-the-fold action:
//   • Live pulse counters ("27 new today · 12 tools · 4 abroad")
//   • Big search bar with trade + region + scope filters
//   • Quick-action chips: Available / Need crew / Tools sale / Abroad
// Reads as a live marketplace dashboard, not a page.

import Link from "next/link";
import { HardHat, Hammer, Wrench, Globe } from "lucide-react";
import { YardSearchBar } from "./YardSearchBar";

type Stats = {
  newToday: number;
  toolsListed: number;
  abroad: number;
  jobsOffered: number;
  seekers: number;
};

export function YardHero({
  stats,
  initialQuery = ""
}: {
  stats: Stats;
  initialQuery?: string;
}) {
  return (
    <section className="relative border-b border-[#1B1A17]/10 bg-[#FBF6EC] pb-4 pt-6 sm:pb-6 sm:pt-10">
      {/* Warm ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 30% at 50% 0%, rgba(255,179,0,0.16) 0%, transparent 60%)"
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Ribbon */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#FFB300" }}
            />
            The Yard · Trades Marketplace
          </div>
          <Link
            href="/"
            className="text-[12px] font-semibold text-[#1B1A17]/60 underline-offset-4 hover:text-[#1B1A17] hover:underline"
          >
            ← Notebook
          </Link>
        </div>

        {/* Headline */}
        <h1
          className="mt-4 font-black leading-[0.98] tracking-tight text-[#1B1A17]"
          style={{ fontSize: "clamp(28px, 4.5vw, 52px)" }}
        >
          Every trade, every job,
          <br />
          <span style={{ color: "#B8860B" }}>on one board.</span>
        </h1>
        <p className="mt-3 max-w-[52ch] text-[14px] leading-[1.55] text-[#1B1A17]/70 md:text-[16px]">
          Available now, need crew, tools for sale, tools wanted, materials
          surplus, work abroad — the UK&apos;s construction marketplace.
        </p>

        {/* Live counters — makes the yard feel alive */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] font-semibold text-[#1B1A17]/70 sm:text-[13px]">
          <CounterChip label="new today" value={stats.newToday} accent />
          <span aria-hidden className="text-[#1B1A17]/25">·</span>
          <CounterChip label="tools listed" value={stats.toolsListed} />
          <span aria-hidden className="text-[#1B1A17]/25">·</span>
          <CounterChip label="jobs offered" value={stats.jobsOffered} />
          <span aria-hidden className="text-[#1B1A17]/25">·</span>
          <CounterChip label="available now" value={stats.seekers} />
          <span aria-hidden className="text-[#1B1A17]/25">·</span>
          <CounterChip
            label="abroad"
            value={stats.abroad}
            icon={<Globe className="h-3 w-3" aria-hidden />}
          />
        </div>

        {/* Quick-post action chips — replace the boring signup CTA with
            "post one of these" cards. Each is a shortcut to the composer
            pre-filled with the selected kind. */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          <QuickPostChip
            label="Available now"
            sublabel="Get hired"
            icon={<HardHat className="h-4 w-4" aria-hidden />}
            href="/trade-off/yard?compose=job-seek"
          />
          <QuickPostChip
            label="Need crew"
            sublabel="Hire trades"
            icon={<Hammer className="h-4 w-4" aria-hidden />}
            href="/trade-off/yard?compose=job-offer"
          />
          <QuickPostChip
            label="Tools for sale"
            sublabel="Free to list"
            icon={<Wrench className="h-4 w-4" aria-hidden />}
            href="/trade-off/yard?compose=tools-sell"
          />
          <QuickPostChip
            label="Work abroad"
            sublabel="International"
            icon={<Globe className="h-4 w-4" aria-hidden />}
            href="/trade-off/yard?compose=abroad-job"
          />
        </div>

        {/* Live search — writes to URL, filters the feed on submit. */}
        <YardSearchBar initial={initialQuery} />
      </div>
    </section>
  );
}

function CounterChip({
  value,
  label,
  accent,
  icon
}: {
  value: number;
  label: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {icon}
      <span
        className={`text-[14px] font-black tabular-nums leading-none sm:text-[15px] ${
          accent ? "text-amber-700" : "text-[#1B1A17]"
        }`}
      >
        {value}
      </span>
      <span className="text-[12px] font-semibold text-[#1B1A17]/55">
        {label}
      </span>
    </span>
  );
}

function QuickPostChip({
  label,
  sublabel,
  icon,
  href
}: {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#1B1A17]/10 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400/50 hover:shadow-md sm:p-4"
    >
      <span
        aria-hidden
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10"
        style={{
          background: "rgba(255,179,0,0.15)",
          color: "#B8860B"
        }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] font-black leading-tight text-[#1B1A17] sm:text-[14px]">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] font-semibold text-[#1B1A17]/55">
          {sublabel}
        </span>
      </span>
      <span
        aria-hidden
        className="text-[16px] text-[#1B1A17]/40 transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}
