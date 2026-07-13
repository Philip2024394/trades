// Section 4 — Live Notebook Example.
//
// Show a real notebook, don't explain it. Dark section for visual pause
// after the light Comparison. Renders a realistic-looking dashboard
// mockup: tabs, timeline entries, verified badges, stats. Everything
// data-driven from LiveNotebookContent.

import {
  ShieldCheck,
  Clock,
  Users,
  Package,
  Star,
  MapPin,
  FileText
} from "lucide-react";
import type { LiveNotebookContent } from "./types";

export function LiveNotebook({
  overline,
  headline,
  subheadline,
  notebook
}: {
  overline: string;
  headline: string;
  subheadline: string;
  notebook: LiveNotebookContent;
}) {
  return (
    <section className="relative overflow-hidden bg-neutral-950 py-24 text-white md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(80% 60% at 50% 0%, rgba(255,179,0,0.25) 0%, transparent 60%)"
        }}
      />
      <div className="relative mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <header className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-amber-300">
            {overline}
          </div>
          <h2 className="mt-6 text-[36px] font-bold leading-[1.1] tracking-tight md:text-[52px]">
            {headline}
          </h2>
          <p className="mt-4 text-[17px] leading-[1.55] text-white/70 md:text-[18px]">
            {subheadline}
          </p>
        </header>

        <div className="mx-auto mt-14 max-w-5xl">
          <NotebookMock notebook={notebook} />
        </div>
      </div>
    </section>
  );
}

function NotebookMock({ notebook }: { notebook: LiveNotebookContent }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white text-neutral-900 shadow-2xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-5 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <div className="mx-auto text-[13px] font-mono text-neutral-400">
          thenetworkers.app/{notebook.businessName.toLowerCase().replace(/\s+/g, "-")}
        </div>
      </div>

      {/* Notebook header */}
      <div className="border-b border-neutral-100 px-6 py-5 md:px-10 md:py-7">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-[24px] font-black text-neutral-900">
            {notebook.businessName
              .split(" ")
              .map((w) => w[0])
              .slice(0, 2)
              .join("")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-[22px] font-bold text-neutral-900 md:text-[26px]">
                {notebook.businessName}
              </h3>
              <span className="text-[15px] text-neutral-500">
                {notebook.trade}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-neutral-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                {notebook.city}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                On the record since {2026 - notebook.yearsOnRecord}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {notebook.verifiedBadges.map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[13px] font-semibold text-emerald-800"
                >
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 md:grid-cols-4">
          <StatTile
            icon={<FileText className="h-4 w-4" aria-hidden />}
            n={String(notebook.jobsOnRecord)}
            label="Jobs on record"
          />
          <StatTile
            icon={<Users className="h-4 w-4" aria-hidden />}
            n={String(notebook.circleSize)}
            label="Trade Circle"
          />
          <StatTile
            icon={<Star className="h-4 w-4" aria-hidden />}
            n="4.8"
            label="Homeowner rating"
          />
          <StatTile
            icon={<Package className="h-4 w-4" aria-hidden />}
            n="12"
            label="Merchants linked"
          />
        </div>
      </div>

      {/* Tabs strip */}
      <div className="overflow-x-auto border-b border-neutral-100 px-6 md:px-10">
        <div className="flex min-w-max gap-6">
          {notebook.tabs.map((tab, i) => (
            <div
              key={tab.key}
              className={`whitespace-nowrap border-b-2 py-3 text-[13px] font-semibold ${
                i === 0
                  ? "border-amber-400 text-neutral-900"
                  : "border-transparent text-neutral-500"
              }`}
            >
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* Timeline body */}
      <div className="px-6 py-6 md:px-10 md:py-8">
        <TimelineEntry
          date="12 May 2026"
          title="Chimney rebuild"
          location="Levenshulme, Manchester"
          cost="£2,400"
          status="Signed off · 5-year warranty"
        />
        <TimelineEntry
          date="03 April 2026"
          title="Full roof replacement"
          location="Chorlton, Manchester"
          cost="£11,800"
          status="Signed off · 10-year warranty · 4 trades in circle"
        />
        <TimelineEntry
          date="21 March 2026"
          title="Flashing repair"
          location="Didsbury, Manchester"
          cost="£680"
          status="Signed off"
          isLast
        />
      </div>
    </div>
  );
}

function StatTile({
  icon,
  n,
  label
}: {
  icon: React.ReactNode;
  n: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-100 bg-neutral-50 p-3">
      <div className="flex items-center gap-1 text-[13px] text-neutral-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[22px] font-black text-neutral-900">{n}</div>
    </div>
  );
}

function TimelineEntry({
  date,
  title,
  location,
  cost,
  status,
  isLast
}: {
  date: string;
  title: string;
  location: string;
  cost: string;
  status: string;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-4 pb-6 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="h-3 w-3 rounded-full border-2 border-amber-400 bg-white" />
        {!isLast ? (
          <div className="w-px flex-1 bg-neutral-200" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <div className="text-[13px] font-mono text-neutral-500">{date}</div>
          <div className="text-[15px] font-bold text-neutral-900">{title}</div>
        </div>
        <div className="mt-0.5 text-[13px] text-neutral-500">
          {location} · {cost}
        </div>
        <div className="mt-1 text-[13px] font-semibold text-emerald-700">
          {status}
        </div>
      </div>
    </div>
  );
}
