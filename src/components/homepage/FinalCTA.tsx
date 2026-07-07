// Section 9 — Final Call To Action.
//
// Closer. Full-bleed dark section, brand-tinted gradient, centered
// copy stack + two CTAs. Emotional close of the page.

import Link from "next/link";
import { ArrowRight, PlayCircle } from "lucide-react";
import type { FinalCtaContent } from "./types";

export function FinalCTA({ content }: { content: FinalCtaContent }) {
  return (
    <section className="relative overflow-hidden bg-neutral-950 py-24 text-white md:py-40">
      {/* Warm brand-tinted radial */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 100%, rgba(255,179,0,0.35) 0%, transparent 65%)"
        }}
      />
      {/* Subtle grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 63px, #ffffff 64px), linear-gradient(to right, transparent 63px, #ffffff 64px)",
          backgroundSize: "64px 64px"
        }}
      />

      <div className="relative mx-auto max-w-[1100px] px-6 text-center md:px-12">
        <h2 className="mx-auto max-w-3xl text-[40px] font-bold leading-[1.05] tracking-tight md:text-[64px]">
          {content.headline}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-[1.55] text-white/75 md:text-[19px]">
          {content.subheadline}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={content.primaryCta.href}
            className="inline-flex min-h-[56px] items-center gap-2 rounded-full bg-amber-400 px-7 text-[15px] font-bold text-neutral-900 transition hover:bg-amber-300"
          >
            {content.primaryCta.label}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          {content.secondaryCta ? (
            <Link
              href={content.secondaryCta.href}
              className="inline-flex min-h-[56px] items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 text-[15px] font-semibold text-white transition hover:bg-white/10"
            >
              <PlayCircle className="h-4 w-4" aria-hidden />
              {content.secondaryCta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
