// _ModulePlaceholder — shared shell used by NEX apps that don't have
// their implementation yet. Cream background, orange accents, back to
// platform home. Written once so calculator placeholders (and any
// future "coming soon" NEX modules) stay consistent.

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Sparkles } from "lucide-react";
import { MT } from "./_tokens";

export type ModulePlaceholderProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  intro: string;
  phases: {
    label: string;
    body: string;
    state: "next" | "later";
  }[];
  ruleNote?: string;
};

export function ModulePlaceholder({
  icon: Icon,
  title,
  subtitle,
  intro,
  phases,
  ruleNote,
}: ModulePlaceholderProps) {
  return (
    <div
      className="relative mx-auto flex min-h-screen w-full flex-col"
      style={{ background: MT.bg, color: MT.darkGrey, maxWidth: 640, fontFamily: "Inter, system-ui, -apple-system, sans-serif" }}
    >
      <header
        className="sticky top-0 z-30 flex items-center gap-3 px-4 pt-4 pb-3"
        style={{ background: MT.bg, borderBottom: `1px solid ${MT.borderLight}` }}
      >
        <Link
          href="/nex-app"
          aria-label="Back to NEX"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full transition-transform active:scale-95"
          style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, boxShadow: MT.shadowSoft }}
        >
          <ArrowLeft size={20} strokeWidth={2.25} style={{ color: MT.primary }} />
        </Link>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MT.secondaryGrey }}>
            NEX
          </div>
          <h1 className="text-[19px] font-extrabold leading-tight tracking-tight" style={{ color: MT.darkGrey, letterSpacing: -0.4 }}>
            {title}
          </h1>
        </div>
      </header>

      <main className="flex-1 px-4 pb-16 pt-6">
        <section
          className="flex flex-col items-center px-6 py-10 text-center"
          style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, borderRadius: MT.radiusLg, boxShadow: MT.shadowSoft }}
        >
          <div
            className="grid h-16 w-16 place-items-center rounded-2xl"
            style={{ background: MT.primarySoft, color: MT.primary, border: `1px solid ${MT.primaryBorder}` }}
          >
            <Icon size={28} strokeWidth={1.85} />
          </div>
          <h2 className="mt-4 text-[22px] font-extrabold" style={{ color: MT.darkGrey, letterSpacing: -0.5 }}>
            {title}
          </h2>
          <p className="mt-1 text-[13.5px] font-semibold" style={{ color: MT.secondaryGrey }}>
            {subtitle}
          </p>
          <p className="mt-4 max-w-md text-[13.5px] leading-relaxed" style={{ color: MT.midGrey }}>
            {intro}
          </p>
          <span
            className="mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ background: MT.primarySoft, color: MT.primary, border: `1px solid ${MT.primaryBorder}` }}
          >
            <Sparkles size={12} strokeWidth={2.25} />
            Coming next
          </span>
        </section>

        <section className="mt-6">
          <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider" style={{ color: MT.secondaryGrey }}>
            Phases
          </h3>
          <ol className="flex flex-col gap-3">
            {phases.map((p, i) => (
              <li
                key={i}
                className="relative flex gap-3 px-4 py-3"
                style={{ background: MT.card, border: `1px solid ${MT.borderLight}`, borderRadius: MT.radiusMd, boxShadow: MT.shadowSoft }}
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
                  style={{
                    background: p.state === "next" ? MT.primarySoft : MT.borderLight,
                    color:      p.state === "next" ? MT.primary     : MT.secondaryGrey,
                    border:     p.state === "next" ? `1px solid ${MT.primaryBorder}` : `1px solid ${MT.border}`,
                  }}
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold" style={{ color: MT.darkGrey }}>
                    {p.label}
                    {p.state === "later" && (
                      <span className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: MT.borderLight, color: MT.secondaryGrey }}>
                        Later
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: MT.secondaryGrey }}>
                    {p.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {ruleNote && (
          <section
            className="mt-6 px-4 py-3"
            style={{ background: MT.card, border: `1px dashed ${MT.border}`, borderRadius: MT.radiusMd }}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MT.primary }}>
              Governance note
            </div>
            <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: MT.midGrey }}>
              {ruleNote}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
