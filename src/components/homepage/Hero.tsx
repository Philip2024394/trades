// Section 1 — Hero.
//
// The 3-second test lives here. Copy first (typography-forward, Apple
// pattern — no photo required to feel premium). Notebook preview cards
// float in the right column on desktop; stack below the copy on
// mobile. All motion CSS-only, respects prefers-reduced-motion.

import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  PlayCircle,
  FileText,
  Users,
  ScrollText
} from "lucide-react";
import type { HeroContent } from "./types";

export function Hero({ content }: { content: HeroContent }) {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Paper texture rule-line background — very subtle */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 31px, #0f0f0f 32px)",
          backgroundSize: "100% 32px"
        }}
      />

      {/* Notebook margin — vertical accent line, left side */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-8 hidden w-px bg-amber-400/40 md:block lg:left-16"
      />

      <div className="relative mx-auto grid max-w-[1400px] gap-12 px-6 pb-24 pt-16 md:grid-cols-12 md:gap-8 md:px-12 md:pb-32 md:pt-24 lg:px-20">
        {/* Copy stack — 7 cols */}
        <div className="md:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-neutral-700">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" aria-hidden />
            {content.overline}
          </div>

          <h1 className="mt-6 text-[44px] font-bold leading-[1.05] tracking-tight text-neutral-900 md:text-[64px] lg:text-[80px]">
            {content.headline}
            {content.headlineHighlight ? (
              <>
                <br />
                <span className="text-amber-500">
                  {content.headlineHighlight}
                </span>
              </>
            ) : null}
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-[1.55] text-neutral-600 md:text-[20px]">
            {content.subheadline}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={content.primaryCta.href}
              className="inline-flex min-h-[52px] items-center gap-2 rounded-full bg-neutral-900 px-6 text-[15px] font-bold text-white transition hover:bg-neutral-800"
            >
              {content.primaryCta.label}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            {content.secondaryCta ? (
              <Link
                href={content.secondaryCta.href}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-full border border-neutral-300 bg-white px-6 text-[15px] font-semibold text-neutral-900 transition hover:border-neutral-900"
              >
                <PlayCircle className="h-4 w-4" aria-hidden />
                {content.secondaryCta.label}
              </Link>
            ) : null}
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-neutral-600">
            {content.trustPoints.map((p) => (
              <li key={p} className="inline-flex items-center gap-1.5">
                <CheckCircle2
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden
                />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Floating notebook preview — 5 cols, hidden on small mobile */}
        <div className="relative hidden md:col-span-5 md:block">
          <FloatingNotebook />
        </div>
      </div>
    </section>
  );
}

function FloatingNotebook() {
  return (
    <div className="relative h-[520px] w-full">
      {/* Main notebook card */}
      <div
        className="absolute inset-x-0 top-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-2xl motion-safe:animate-[float_6s_ease-in-out_infinite]"
        style={{ boxShadow: "0 32px 80px rgba(15,15,15,0.16)" }}
      >
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
          <div className="h-2 w-2 rounded-full bg-red-400" />
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <div className="ml-auto text-[13px] font-mono text-neutral-400">
            smithroofing.notebook
          </div>
        </div>
        <div className="mt-4 flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-[20px] font-black text-neutral-900">
            SR
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold text-neutral-900">
              Smith Roofing Ltd
            </div>
            <div className="text-[13px] text-neutral-500">
              Roofer · Manchester
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Verified · On the record since 2019
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatBlock
            n="127"
            label="Jobs"
            icon={<FileText className="h-3.5 w-3.5" aria-hidden />}
          />
          <StatBlock
            n="34"
            label="Circle"
            icon={<Users className="h-3.5 w-3.5" aria-hidden />}
          />
          <StatBlock
            n="4.8"
            label="Rated"
            icon={<ScrollText className="h-3.5 w-3.5" aria-hidden />}
          />
        </div>
        <div className="mt-4 rounded-2xl bg-neutral-50 p-3 text-[13px]">
          <div className="font-semibold text-neutral-900">
            Recent — Chimney rebuild, Levenshulme
          </div>
          <div className="mt-0.5 text-neutral-500">
            Signed off 12 May · £2,400 · 5-year warranty
          </div>
        </div>
      </div>

      {/* Floating badge — Trade Circle */}
      <div
        className="absolute -right-4 top-[380px] rounded-2xl border border-neutral-200 bg-white p-3 shadow-xl motion-safe:animate-[float_7s_ease-in-out_infinite_reverse]"
        style={{ boxShadow: "0 20px 48px rgba(15,15,15,0.12)" }}
      >
        <div className="flex items-center gap-2 text-[13px]">
          <div className="flex -space-x-1.5">
            <div className="h-6 w-6 rounded-full border-2 border-white bg-blue-500" />
            <div className="h-6 w-6 rounded-full border-2 border-white bg-emerald-500" />
            <div className="h-6 w-6 rounded-full border-2 border-white bg-purple-500" />
          </div>
          <div>
            <div className="font-bold text-neutral-900">Trade Circle</div>
            <div className="text-neutral-500">34 vouched trades</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  n,
  label,
  icon
}: {
  n: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-neutral-100 bg-white p-2.5">
      <div className="flex items-center gap-1 text-[13px] text-neutral-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[20px] font-black text-neutral-900">{n}</div>
    </div>
  );
}
