// /why — the strategic case for joining The Network.
//
// Everything here is either evidenced (footnote to a public source) or
// labelled as an assumption. No fabricated numbers, no invented years,
// no future features presented as present tense.

import Link from "next/link";
import {
  ShieldCheck,
  PoundSterling,
  FileCheck2,
  Landmark,
  KeyRound,
  Users,
  BookOpen,
  ArrowRight,
  Lock,
  Camera,
  ClipboardCheck,
  Info,
  CheckCircle2,
  XCircle
} from "lucide-react";

export const metadata = {
  title: "Why join The Network · The Network",
  description:
    "Documented homes sell faster and lose fewer chips in the survey. Insurance discounts, transferable warranties, and paperwork buyers already ask for."
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

export default function WhyPage() {
  return (
    <main
      className="relative min-h-screen"
      style={{ backgroundColor: PALETTE.cream, color: PALETTE.ink }}
    >
      {/* Paper-rule background */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `linear-gradient(to bottom, transparent 47px, ${PALETTE.paperLine} 48px)`,
          backgroundSize: "100% 48px",
          opacity: 0.5
        }}
      />

      {/* Header */}
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
            The Network
          </Link>
          <nav className="flex items-center gap-4 text-[13px] font-semibold">
            <Link
              href="/project/start"
              className="hidden underline-offset-4 hover:underline sm:inline"
              style={{ color: PALETTE.ink }}
            >
              Submit a project
            </Link>
            <Link
              href="/why/trades"
              className="hidden underline-offset-4 hover:underline sm:inline"
              style={{ color: PALETTE.ink }}
            >
              For trades
            </Link>
            <Link
              href="/join/start"
              className="hidden underline-offset-4 hover:underline sm:inline"
              style={{ color: PALETTE.ink }}
            >
              Join as a trade
            </Link>
            <Link
              href="/home/sign-in"
              className="rounded-full border-2 px-4 py-2 text-[12px] font-bold"
              style={{ borderColor: PALETTE.ink, color: PALETTE.ink }}
            >
              Sign in
            </Link>
          </nav>
        </div>
      </div>

      <div className="relative mx-auto max-w-[900px] px-5 pb-24 md:px-10">
        {/* Hero */}
        <section className="pt-6 md:pt-10">
          <p
            className="text-[12px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: PALETTE.honey }}
          >
            Why join The Network
          </p>
          <h1 className="mt-4 text-[38px] font-black leading-[1.0] tracking-tight md:text-[64px]">
            Documented homes sell faster.<br />
            <span style={{ color: PALETTE.honey }}>
              Undocumented homes get chipped down.
            </span>
          </h1>
          <p
            className="mt-6 max-w-[52ch] text-[16px] leading-[1.6] md:text-[18px]"
            style={{ color: PALETTE.inkSoft }}
          >
            The Network is not a photo album. It&apos;s an evidence chain
            attached to the address — the paperwork surveyors, solicitors,
            insurers, and future contractors already ask for, kept in one place
            for the life of the property.
          </p>
        </section>

        {/* Evidenced benefits */}
        <section className="mt-14 md:mt-20">
          <SectionHeading eyebrow="What&apos;s evidenced">
            Four ways The Network pays back
          </SectionHeading>

          <div className="mt-8 grid gap-4 md:gap-5">
            <EvidencedCard
              icon={<FileCheck2 className="h-5 w-5" aria-hidden />}
              title="Sell faster, lose fewer chip-away deductions"
              body="Surveyors and buyers&apos; solicitors routinely flag missing FENSA certificates, Building Regs sign-offs, Part P electrical certificates, and gas safety records. When they&apos;re missing, buyers negotiate down or the sale delays."
              source="RICS Home Survey Reports · NAEA · The Homeowning Alliance"
            />
            <EvidencedCard
              icon={<PoundSterling className="h-5 w-5" aria-hidden />}
              title="Insurance premium discounts for documented work"
              body="Major UK insurers (Aviva, LV=, Direct Line) reduce buildings premiums when you can produce electrical (EICR), roof, or damp-proofing certificates within their look-back window. Typical range: 5–15% off the annual premium."
              source="Aviva / LV= / Direct Line published policy schedules"
            />
            <EvidencedCard
              icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
              title="Warranties transfer at sale — but only with the paperwork"
              body="NHBC Buildmark, Premier Guarantee, and LABC Warranty are all transferable to new owners. Buyers&apos; solicitors ask for them. Homes without the documentation lose the transferable value."
              source="NHBC · Premier Guarantee · LABC Warranty"
            />
            <EvidencedCard
              icon={<Landmark className="h-5 w-5" aria-hidden />}
              title="Scotland already requires a version of this by law"
              body="The Scottish Home Report has been mandatory since 2008. It includes a Property Questionnaire covering work history, energy performance, and a single survey. One of the four nations already forces the buyer to see what The Network chooses to preserve."
              source="Scottish Government · Housing (Scotland) Act 2006"
            />
          </div>

          <p
            className="mt-6 rounded-2xl border p-4 text-[13px] leading-[1.55]"
            style={{
              borderColor: PALETTE.divider,
              backgroundColor: "rgba(184,134,11,0.06)",
              color: PALETTE.inkSoft
            }}
          >
            <Info
              className="mr-1.5 inline h-4 w-4 align-text-bottom"
              style={{ color: PALETTE.honey }}
              aria-hidden
            />
            We don&apos;t claim The Network adds a specific percentage to your
            sale price — that number has never been published by Rightmove or
            Zoopla, and estate-agent blog posts aren&apos;t evidence. What we
            claim is what&apos;s documented above: you sell faster, with fewer
            deductions, and you keep insurance and warranty value that
            undocumented homes lose.
          </p>
        </section>

        {/* Network Passport — the killer feature */}
        <section className="mt-16 md:mt-24">
          <SectionHeading eyebrow="Network Passport">
            One code. Only who you choose. Only what you choose.
          </SectionHeading>
          <p
            className="mt-6 max-w-[58ch] text-[16px] leading-[1.6]"
            style={{ color: PALETTE.inkSoft }}
          >
            Every previous UK home log — Home Information Packs, Log Book of
            the Home, Property Passport — died the same death: it was a
            passive record no one used. The Network Passport fixes that. You
            mint a read-only code that lets a specific person see specific
            sections, for a specific length of time. Fully revocable. Watermarked
            with the viewer&apos;s email on every page.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <PassportUseCase
              icon={<KeyRound className="h-4 w-4" aria-hidden />}
              title="Buyers &amp; their solicitors"
              body="During a sale — issue a 30-day pass, revoke it if the sale falls through."
            />
            <PassportUseCase
              icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
              title="Insurers"
              body="At quote or claim time — issue a 1-year pass scoped to electrical, roof, or damp."
            />
            <PassportUseCase
              icon={<ClipboardCheck className="h-4 w-4" aria-hidden />}
              title="Surveyors"
              body="During valuation or remortgage — a 7-day pass to the relevant section only."
            />
            <PassportUseCase
              icon={<Users className="h-4 w-4" aria-hidden />}
              title="Future contractors"
              body="Quoting on maintenance — &quot;here&apos;s what&apos;s behind the wall&quot; without a paper trail hunt."
            />
          </div>
        </section>

        {/* How trades participate */}
        <section className="mt-16 md:mt-24">
          <SectionHeading eyebrow="How your record actually gets built">
            The trade drafts. You publish.
          </SectionHeading>

          <div className="mt-8 grid gap-5">
            <FlowStep
              n="01"
              icon={<Camera className="h-5 w-5" aria-hidden />}
              title="Trade posts to their own business app"
              body="Every trade on the platform builds their own portfolio. Photos, materials list, install date, warranty documents — attached to the project."
            />
            <FlowStep
              n="02"
              icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
              title="You see it as a candidate feed"
              body="&quot;Your roofer added 4 photos and a materials list. Add these to your property record?&quot; One tap accepts or ignores. Nothing appears on your property record without your permission."
            />
            <FlowStep
              n="03"
              icon={<BookOpen className="h-5 w-5" aria-hidden />}
              title="Published items attach to the address, not the paperwork drawer"
              body="Once you accept, the entry is stored against the property. Structured data — brand, model, batch, warranty PDF — not just a photograph. Searchable. Insurable. Provable."
            />
          </div>
        </section>

        {/* Bring your own trades */}
        <section className="mt-16 md:mt-24">
          <SectionHeading eyebrow="Not all your trades are here yet">
            Bring your own. We&apos;ll invite them.
          </SectionHeading>
          <p
            className="mt-6 max-w-[58ch] text-[16px] leading-[1.6]"
            style={{ color: PALETTE.inkSoft }}
          >
            You already have a plumber, a carpenter, an electrician you trust.
            You don&apos;t need to swap them for platform-approved trades — you
            invite yours. We&apos;ll send them a Network invitation on your
            behalf; if they accept, every quote, invoice, message, and photo
            with them lives in one place from that day forward.
          </p>
          <div
            className="mt-6 rounded-2xl border p-5"
            style={{
              borderColor: PALETTE.divider,
              backgroundColor: "rgba(184,134,11,0.06)"
            }}
          >
            <p
              className="text-[12px] font-extrabold uppercase tracking-[0.18em]"
              style={{ color: PALETTE.honey }}
            >
              Coming next
            </p>
            <p
              className="mt-2 text-[14px] leading-[1.55]"
              style={{ color: PALETTE.inkSoft }}
            >
              <b style={{ color: PALETTE.ink }}>Owner-side trade files.</b> One
              page per trade in your circle — every job they&apos;ve done for
              you, every invoice, every message thread, every quote, side by
              side. We&apos;re building this next. Sign up now and you&apos;ll
              get it the day it ships.
            </p>
          </div>
        </section>

        {/* The honest what-we-are-NOT section */}
        <section className="mt-16 md:mt-24">
          <SectionHeading eyebrow="Being straight with you">
            What The Network is not
          </SectionHeading>

          <div className="mt-8 grid gap-4">
            <HonestyRow
              icon={<XCircle className="h-5 w-5" aria-hidden />}
              title="Not a magic sale-price uplift"
              body="We don&apos;t promise your house is worth more just because you keep records. We can prove you&apos;ll sell faster and take fewer chips in the survey — that&apos;s different."
            />
            <HonestyRow
              icon={<XCircle className="h-5 w-5" aria-hidden />}
              title="Not a mandatory public record"
              body="Nothing appears on the property record without you tapping accept. Bad photos, half-finished work, disputes — you decide what stays private, what gets published, and what&apos;s revoked."
            />
            <HonestyRow
              icon={<XCircle className="h-5 w-5" aria-hidden />}
              title="Not a payment platform"
              body="XRatedTrade does not hold your money. Invoices and payments are recorded here for your records; the money goes direct between you and your trade."
            />
            <HonestyRow
              icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
              title="It is your evidence chain"
              body="Photos, materials, warranties, sign-offs, messages, invoices — attached to the address, controlled by you, transferable when you sell."
              positive
            />
          </div>
        </section>

        {/* Trust ribbon */}
        <section
          className="mt-16 rounded-3xl border p-6 md:mt-24 md:p-10"
          style={{
            borderColor: PALETTE.divider,
            backgroundColor: "rgba(27,26,23,0.03)"
          }}
        >
          <div className="flex flex-wrap items-center gap-6 md:gap-10">
            <TrustBadge
              icon={<Lock className="h-4 w-4" aria-hidden />}
              label="Owner-controlled visibility"
            />
            <TrustBadge
              icon={<Users className="h-4 w-4" aria-hidden />}
              label="Free forever for homeowners"
            />
            <TrustBadge
              icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
              label="UK-hosted data"
            />
            <TrustBadge
              icon={<BookOpen className="h-4 w-4" aria-hidden />}
              label="Attached to the address"
            />
          </div>
        </section>

        {/* CTA */}
        <section className="mt-14 md:mt-20">
          <div
            className="rounded-3xl p-8 md:p-12"
            style={{ backgroundColor: PALETTE.ink, color: PALETTE.cream }}
          >
            <p
              className="text-[12px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: PALETTE.honeyBright }}
            >
              Join The Network
            </p>
            <h2 className="mt-4 text-[32px] font-black leading-[1.05] tracking-tight md:text-[48px]">
              Start with one project.<br />
              Keep it for the life of the house.
            </h2>
            <p
              className="mt-4 max-w-[54ch] text-[15px] leading-[1.6] md:text-[16px]"
              style={{ color: "rgba(251,246,236,0.72)" }}
            >
              No account required to submit your first brief. If you want the
              record kept, join The Network free when you&apos;re ready.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/project/start"
                className="group inline-flex min-h-[56px] items-center justify-center gap-3 rounded-full pl-6 pr-4 text-[15px] font-bold"
                style={{
                  backgroundColor: PALETTE.honeyBright,
                  color: PALETTE.ink
                }}
              >
                Submit your project
                <span
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5"
                  style={{ backgroundColor: PALETTE.ink, color: PALETTE.cream }}
                  aria-hidden
                >
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <Link
                href="/join/start"
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full border-2 px-6 text-[15px] font-bold"
                style={{
                  borderColor: "rgba(251,246,236,0.3)",
                  color: PALETTE.cream
                }}
              >
                Join as a trade
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer
          className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-[12px]"
          style={{ borderColor: PALETTE.divider, color: PALETTE.inkMuted }}
        >
          <div>© {new Date().getFullYear()} XRatedTrade · Britain</div>
          <div className="flex gap-4">
            <Link href="/" className="underline-offset-4 hover:underline">
              Home
            </Link>
            <Link href="/home" className="underline-offset-4 hover:underline">
              My Network
            </Link>
          </div>
        </footer>
      </div>
    </main>
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
      <h2 className="mt-3 text-[28px] font-black leading-[1.1] tracking-tight md:text-[38px]">
        {children}
      </h2>
    </div>
  );
}

function EvidencedCard({
  icon,
  title,
  body,
  source
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  source: string;
}) {
  return (
    <article
      className="rounded-2xl border bg-white p-5 md:p-6"
      style={{ borderColor: PALETTE.divider }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: "rgba(184,134,11,0.12)",
            color: PALETTE.honey
          }}
          aria-hidden
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-bold leading-tight md:text-[19px]">
            {title}
          </h3>
          <p
            className="mt-2 text-[14px] leading-[1.55] md:text-[15px]"
            style={{ color: PALETTE.inkSoft }}
          >
            {body}
          </p>
          <p
            className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: PALETTE.honey }}
          >
            Source: {source}
          </p>
        </div>
      </div>
    </article>
  );
}

function PassportUseCase({
  icon,
  title,
  body
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-2xl border bg-white p-4"
      style={{ borderColor: PALETTE.divider }}
    >
      <div
        className="inline-flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.16em]"
        style={{ color: PALETTE.honey }}
      >
        {icon}
        {title}
      </div>
      <p
        className="mt-2 text-[13px] leading-[1.5]"
        style={{ color: PALETTE.inkSoft }}
      >
        {body}
      </p>
    </div>
  );
}

function FlowStep({
  n,
  icon,
  title,
  body
}: {
  n: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <article
      className="rounded-2xl border bg-white p-5 md:p-6"
      style={{ borderColor: PALETTE.divider }}
    >
      <div className="flex items-start gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-mono text-[13px] font-bold"
          style={{
            backgroundColor: PALETTE.ink,
            color: PALETTE.honeyBright
          }}
        >
          {n}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span style={{ color: PALETTE.honey }} aria-hidden>
              {icon}
            </span>
            <h3 className="text-[17px] font-bold leading-tight md:text-[19px]">
              {title}
            </h3>
          </div>
          <p
            className="mt-2 text-[14px] leading-[1.55] md:text-[15px]"
            style={{ color: PALETTE.inkSoft }}
          >
            {body}
          </p>
        </div>
      </div>
    </article>
  );
}

function HonestyRow({
  icon,
  title,
  body,
  positive
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  positive?: boolean;
}) {
  return (
    <div
      className="flex items-start gap-4 rounded-2xl border bg-white p-5"
      style={{ borderColor: PALETTE.divider }}
    >
      <div
        className="shrink-0"
        style={{
          color: positive ? "#0F7A3D" : PALETTE.honey
        }}
        aria-hidden
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-bold">{title}</h3>
        <p
          className="mt-1 text-[14px] leading-[1.55]"
          style={{ color: PALETTE.inkSoft }}
        >
          {body}
        </p>
      </div>
    </div>
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
