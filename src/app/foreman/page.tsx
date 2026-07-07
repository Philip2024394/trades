// /foreman — the Business Operating System pitch for foremen + builders.
//
// The homeowner Notebook is the marketing edge. The Foreman tier is the
// operational engine — every sub-trade a foreman hires shows up as a
// live engagement on the builder's dashboard.

import Link from "next/link";
import {
  ArrowRight,
  HardHat,
  Users,
  ClipboardCheck,
  Camera,
  Building2,
  ShieldCheck,
  Sparkles,
  Info
} from "lucide-react";
import { ForemanWaitlistForm } from "./ForemanWaitlistForm";

export const metadata = {
  title: "Foreman Mode · The Construction Notebook",
  description:
    "The operating system for construction sites. Every sub-trade a foreman hires on record, live on the builder's dashboard, AI-parsed from a photo."
};

const PALETTE = {
  cream: "#FBF6EC",
  ink: "#1B1A17",
  inkSoft: "rgba(27,26,23,0.72)",
  inkMuted: "rgba(27,26,23,0.55)",
  honey: "#B8860B",
  honeyBright: "#FFB300",
  paperLine: "rgba(184,134,11,0.10)",
  divider: "rgba(27,26,23,0.10)"
};

export default function ForemanPage() {
  return (
    <main
      className="relative min-h-screen"
      style={{ backgroundColor: PALETTE.cream, color: PALETTE.ink }}
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, transparent 47px, ${PALETTE.paperLine} 48px)`,
          backgroundSize: "100% 48px",
          opacity: 0.5
        }}
      />

      <div className="relative mx-auto max-w-[1100px] px-5 py-5 md:px-10 md:py-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: PALETTE.honey }}
          >
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: PALETTE.honeyBright }}
            />
            The Construction Notebook
          </Link>
          <Link
            href="/why"
            className="text-[13px] font-semibold underline-offset-4 hover:underline"
            style={{ color: PALETTE.ink }}
          >
            Why Notebook
          </Link>
        </div>
      </div>

      <div className="relative mx-auto max-w-[900px] px-5 pb-24 md:px-10">
        {/* Hero */}
        <section>
          <p
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.22em]"
            style={{
              backgroundColor: "rgba(184,134,11,0.14)",
              color: PALETTE.honey
            }}
          >
            <HardHat className="h-3 w-3" aria-hidden />
            Foreman Mode · Waitlist open
          </p>
          <h1 className="mt-6 text-[40px] font-black leading-[1.0] tracking-tight md:text-[64px]">
            Every sub-trade you hire.<br />
            <span style={{ color: PALETTE.honey }}>On the record. On one screen.</span>
          </h1>
          <p
            className="mt-6 max-w-[52ch] text-[16px] leading-[1.6] md:text-[18px]"
            style={{ color: PALETTE.inkSoft }}
          >
            Foreman Mode turns the Construction Notebook into your site
            operating system. Every sub you hire, every price you agree,
            every payment you make — captured from a photo and visible on
            the builder&apos;s dashboard the second it happens.
          </p>
        </section>

        {/* The three-pillar pitch */}
        <section className="mt-16 grid gap-5 md:mt-20 md:grid-cols-3 md:gap-6">
          <PillarCard
            icon={<Users className="h-5 w-5" aria-hidden />}
            title="Site-first, not project-first"
            body="One site holds many projects, many foremen, many subs. The Notebook already handles addresses — sites are the operating layer above."
          />
          <PillarCard
            icon={<Camera className="h-5 w-5" aria-hidden />}
            title="AI captures the paperwork"
            body="Snap a handwritten agreement, WhatsApp screenshot, or a supplier receipt — Claude Vision extracts the trade, the price, the dates. You confirm."
          />
          <PillarCard
            icon={<Building2 className="h-5 w-5" aria-hidden />}
            title="Builder oversight in one click"
            body="The builder sees every active engagement across every site, foreman, and sub. Time-on-site, deposit paid, work started. No more Monday morning phone-arounds."
          />
        </section>

        {/* How it works */}
        <section className="mt-16 md:mt-20">
          <SectionHeading eyebrow="How it works">
            One capture. Three surfaces. Everyone sees the same truth.
          </SectionHeading>

          <div className="mt-8 space-y-4">
            <FlowRow
              n="01"
              title="Foreman photographs a scribbled agreement with Dave the carpenter"
              body='"Dave — kitchen carcass — £2,400 — £800 deposit — start 15 Aug — finish 22 Aug."'
            />
            <FlowRow
              n="02"
              title="AI extracts the fields and files an engagement"
              body="A site_engagement row is created linking Dave (or a placeholder if he&apos;s not on the platform yet), the price, the dates, the site."
            />
            <FlowRow
              n="03"
              title="Builder&apos;s dashboard updates in seconds"
              body="One glance: 'Elm Grove Reno — 4 active engagements — £8,200 committed this week — 1 handwritten agreement pending confirmation.'"
            />
            <FlowRow
              n="04"
              title="Dave gets a Notebook invitation"
              body="If he&apos;s not on xratedtrade.com yet, we email him. When he joins, the engagement links automatically — no re-entry, no duplicate."
            />
            <FlowRow
              n="05"
              title="Homeowner (Sarah) gets the visible portfolio"
              body="Materials list, warranty PDF, before/after photos — attached to her address the day Dave marks the job signed off."
            />
          </div>
        </section>

        {/* Roadmap */}
        <section className="mt-16 md:mt-20">
          <SectionHeading eyebrow="Roadmap">Where we are, in the open</SectionHeading>

          <div className="mt-8 space-y-3">
            <RoadmapRow
              phase="Now"
              done
              title="Notebook Foundation"
              body="Homeowner + trade sign-in, project brief, matches, owner-side trade file, payment recording with screenshot upload and AI receipt parsing."
            />
            <RoadmapRow
              phase="Next"
              title="Site Model"
              body="os_sites + os_site_engagements schemas are already migrated. Foreman-facing UI, AI photo capture of handwritten agreements, and the builder oversight dashboard land next."
            />
            <RoadmapRow
              phase="After"
              title="Builder Oversight Dashboard"
              body="One-click view across foremen and sites. Utilisation, cash committed this week, pending confirmations, warranty exposure by trade."
            />
            <RoadmapRow
              phase="Then"
              title="Chat + Agreement Capture"
              body="1:1 conversation per engagement, contract PDF autogeneration, homeowner signoff surfaces."
            />
          </div>
        </section>

        {/* Waitlist */}
        <section
          className="mt-16 rounded-3xl p-8 md:mt-20 md:p-12"
          style={{ backgroundColor: PALETTE.ink, color: PALETTE.cream }}
        >
          <p
            className="inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: PALETTE.honeyBright }}
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            Foreman waitlist
          </p>
          <h2 className="mt-4 text-[28px] font-black leading-[1.1] tracking-tight md:text-[38px]">
            Get first access.
          </h2>
          <p
            className="mt-4 max-w-[54ch] text-[14px] leading-[1.55] md:text-[15px]"
            style={{ color: "rgba(251,246,236,0.7)" }}
          >
            Foreman Mode is being built with a small number of design partners
            first. Tell us about your team and we&apos;ll bring you in early.
          </p>

          <div className="mt-6 max-w-[520px]">
            <ForemanWaitlistForm />
          </div>

          <p
            className="mt-4 flex items-start gap-2 text-[12px] leading-[1.5]"
            style={{ color: "rgba(251,246,236,0.5)" }}
          >
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span>
              We&apos;re not selling anything today. No card, no callback we
              didn&apos;t ask for. Just your seat at the table.
            </span>
          </p>
        </section>

        {/* Trust ribbon */}
        <section className="mt-14 flex flex-wrap items-center justify-center gap-4 border-t pt-6 md:gap-10">
          <TrustBadge
            icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
            label="Site data — foreman controlled"
          />
          <TrustBadge
            icon={<Camera className="h-3.5 w-3.5" aria-hidden />}
            label="Photograph, don&apos;t type"
          />
          <TrustBadge
            icon={<ClipboardCheck className="h-3.5 w-3.5" aria-hidden />}
            label="One truth per engagement"
          />
        </section>

        <div className="mt-10 flex items-center justify-between text-[12px]" style={{ color: PALETTE.inkMuted }}>
          <div>© {new Date().getFullYear()} XRatedTrade · Britain</div>
          <Link href="/why" className="underline-offset-4 hover:underline">
            Why Notebook
          </Link>
        </div>
      </div>
    </main>
  );
}

function PillarCard({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: PALETTE.divider }}
    >
      <div
        className="inline-flex h-9 w-9 items-center justify-center rounded-full"
        style={{
          backgroundColor: "rgba(184,134,11,0.14)",
          color: PALETTE.honey
        }}
        aria-hidden
      >
        {icon}
      </div>
      <h3 className="mt-4 text-[17px] font-bold leading-tight">{title}</h3>
      <p className="mt-2 text-[14px] leading-[1.55]" style={{ color: PALETTE.inkSoft }}>
        {body}
      </p>
    </article>
  );
}

function SectionHeading({
  eyebrow,
  children
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p
        className="text-[12px] font-extrabold uppercase tracking-[0.22em]"
        style={{ color: PALETTE.honey }}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 text-[26px] font-black leading-[1.1] tracking-tight md:text-[36px]">
        {children}
      </h2>
    </div>
  );
}

function FlowRow({
  n,
  title,
  body
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <article
      className="flex items-start gap-4 rounded-2xl border bg-white p-5"
      style={{ borderColor: PALETTE.divider }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-bold"
        style={{ backgroundColor: PALETTE.ink, color: PALETTE.honeyBright }}
      >
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-bold leading-tight">{title}</h3>
        <p className="mt-1 text-[13px] leading-[1.55]" style={{ color: PALETTE.inkSoft }}>
          {body}
        </p>
      </div>
    </article>
  );
}

function RoadmapRow({
  phase,
  title,
  body,
  done
}: {
  phase: string;
  title: string;
  body: string;
  done?: boolean;
}) {
  return (
    <article
      className="rounded-2xl border bg-white p-5"
      style={{ borderColor: PALETTE.divider }}
    >
      <div className="flex items-baseline gap-3">
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest"
          style={{
            backgroundColor: done ? "rgba(15,122,61,0.14)" : "rgba(184,134,11,0.14)",
            color: done ? "#0F7A3D" : PALETTE.honey
          }}
        >
          {phase}
        </span>
        <h3 className="text-[15px] font-bold">{title}</h3>
      </div>
      <p className="mt-2 text-[13px] leading-[1.55]" style={{ color: PALETTE.inkSoft }}>
        {body}
      </p>
    </article>
  );
}

function TrustBadge({
  icon,
  label
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span style={{ color: PALETTE.honey }} aria-hidden>
        {icon}
      </span>
      <span
        className="text-[12px] font-extrabold uppercase tracking-[0.16em]"
        style={{ color: PALETTE.ink }}
      >
        {label}
      </span>
    </div>
  );
}
