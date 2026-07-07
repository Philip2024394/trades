// /project — Homeowner project entry.
//
// Landing page for homeowners clicking "Submit Your Project" on the
// split gate. Establishes the value proposition, shows the 3-step
// flow, and hands off to the wizard (built as a follow-up).

import Link from "next/link";
import {
  ArrowRight,
  Home,
  ClipboardList,
  Users,
  ShieldCheck,
  CheckCircle2,
  ChevronLeft
} from "lucide-react";

export const metadata = {
  title: "Submit Your Project · The Construction Notebook",
  description:
    "Post your project. Match with trusted trades. Keep it on the record forever. Free forever."
};

export default function SubmitProjectPage() {
  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      {/* Subtle brand glow — mirrored from the /join page for consistency */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.14) 0%, transparent 60%)"
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, transparent 39px, #ffffff 40px)",
          backgroundSize: "100% 40px"
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 py-10 md:px-8 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#1B1A17]/5 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-[#1B1A17]/95 backdrop-blur">
          <Home className="h-3.5 w-3.5" aria-hidden />
          For homeowners
        </div>

        <h1 className="mt-6 text-[38px] font-bold leading-[1.05] tracking-tight text-[#1B1A17] md:text-[56px]">
          Tell us about your project.
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-[1.55] text-[#1B1A17]/70 md:text-[18px]">
          We&apos;ll match you with trades on the record — verified, backed by
          their peers, with every past job open to inspection.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/project/start"
            className="inline-flex min-h-[56px] items-center gap-2 rounded-full bg-white px-7 text-[15px] font-bold text-neutral-900 transition hover:bg-neutral-100"
          >
            Get Started
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <span className="text-[13px] text-[#1B1A17]/60">
            2 minutes · No card required
          </span>
        </div>

        {/* Three-step flow */}
        <div className="mt-14 grid gap-4 md:grid-cols-3 md:gap-6">
          <FlowStep
            n="01"
            icon={<ClipboardList className="h-5 w-5" aria-hidden />}
            title="Describe your project"
            body="What you want done, where, budget range, timeframe. Two minutes."
          />
          <FlowStep
            n="02"
            icon={<Users className="h-5 w-5" aria-hidden />}
            title="Get matched"
            body="Verified trades near you review your brief and get in touch."
          />
          <FlowStep
            n="03"
            icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
            title="Track it in your Notebook"
            body="Quotes, warranties, photos — all recorded. Follows your property forever."
          />
        </div>

        {/* Value markers */}
        <ul className="mt-12 grid gap-3 text-[14px] text-[#1B1A17]/80 md:grid-cols-2 md:gap-x-6">
          <ValuePoint>Only verified trades on the record</ValuePoint>
          <ValuePoint>Free forever — no card required</ValuePoint>
          <ValuePoint>Warranties stored + reminded before expiry</ValuePoint>
          <ValuePoint>Every trade you hire lives in your Notebook</ValuePoint>
          <ValuePoint>Property Passport transfers at sale</ValuePoint>
          <ValuePoint>Your data, your call — always</ValuePoint>
        </ul>

        <div className="mt-14 border-t border-[#1B1A17]/12 pt-6">
          <p className="text-[13px] text-[#1B1A17]/55">
            Already have a home Notebook?{" "}
            <Link href="/home/sign-in" className="text-amber-300 hover:text-amber-200">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
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
    <div className="rounded-2xl border border-[#1B1A17]/12 bg-[#1B1A17]/4 p-5 backdrop-blur">
      <div className="flex items-center gap-2 text-[13px] font-mono font-semibold text-amber-300">
        {n}
      </div>
      <div className="mt-3 flex items-center gap-2 text-[#1B1A17]">{icon}</div>
      <h3 className="mt-3 text-[16px] font-bold text-[#1B1A17]">{title}</h3>
      <p className="mt-2 text-[13px] leading-[1.5] text-[#1B1A17]/60">{body}</p>
    </div>
  );
}

function ValuePoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="inline-flex items-start gap-2">
      <CheckCircle2
        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
        aria-hidden
      />
      {children}
    </li>
  );
}
