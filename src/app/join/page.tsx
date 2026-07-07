// /join — Trade join entry.
//
// Landing page for merchants clicking "Join as a Trade" on the split
// gate. Establishes the value proposition, shows the 3-step flow, and
// hands off to the wizard (built as a follow-up).

import Image from "next/image";
import Link from "next/link";
import { PreviewTabs } from "./PreviewTabs";
import {
  ArrowRight,
  Hammer,
  ShieldCheck,
  BookOpen,
  Users,
  CheckCircle2,
  ChevronLeft
} from "lucide-react";

const STEP_IMAGES = {
  tellUs:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_47_12%20PM.png?updatedAt=1783442852639",
  setUp:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_57_35%20PM.png?updatedAt=1783443475927",
  circle:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_55_03%20PM.png?updatedAt=1783443325500"
};

export const metadata = {
  title: "Join as a Trade · The Construction Notebook",
  description:
    "Get discovered. Build your Notebook. Grow your reputation. Free forever."
};

export default function JoinTradePage() {
  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body { scrollbar-width: none !important; -ms-overflow-style: none !important; }
            html::-webkit-scrollbar, body::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
            *::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
          `
        }}
      />
      {/* Subtle brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.18) 0%, transparent 60%)"
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

        <h1 className="mt-8 text-[38px] font-bold leading-[1.05] tracking-tight text-[#1B1A17] md:text-[56px]">
          Create your Trade Notebook.
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-[1.55] text-[#1B1A17]/70 md:text-[18px]">
          Your own live trade page. Under 5 minutes. Free forever.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/join/start"
            className="inline-flex min-h-[56px] items-center gap-2 rounded-full bg-amber-400 px-7 text-[15px] font-bold text-neutral-900 transition hover:bg-amber-300"
          >
            Get Started
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <span className="text-[13px] text-[#1B1A17]/60">
            3 minutes · No card required
          </span>
        </div>

        {/* See what you get — inline preview */}
        <section className="mt-14">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            See what you get
          </p>
          <h2 className="mt-3 text-[24px] font-bold leading-tight tracking-tight text-[#1B1A17] md:text-[32px]">
            Two things live from day one.
          </h2>
          <div className="mt-6">
            <PreviewTabs />
          </div>
        </section>

        {/* Three-step flow — sets expectations before the wizard */}
        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          <FlowStep
            n="01"
            imageUrl={STEP_IMAGES.tellUs}
            icon={<Hammer className="h-4 w-4" aria-hidden />}
            title="Tell us about your trade"
            body="Business name, primary trade, city. Verified against Companies House."
          />
          <FlowStep
            n="02"
            imageUrl={STEP_IMAGES.setUp}
            icon={<BookOpen className="h-4 w-4" aria-hidden />}
            title="Set up your Notebook"
            body="Add your first services, photos, and past work. Your presence, your brand."
          />
          <FlowStep
            n="03"
            imageUrl={STEP_IMAGES.circle}
            icon={<Users className="h-4 w-4" aria-hidden />}
            title="Join the Trade Circle"
            body="Recommend the trades you work with. Get recommended back. Grow together."
          />
        </div>

        {/* Value markers */}
        <ul className="mt-12 grid gap-3 text-[14px] text-[#1B1A17]/80 md:grid-cols-2 md:gap-x-6">
          <ValuePoint>Your own Notebook — free forever</ValuePoint>
          <ValuePoint>Verified badges (Companies House, Gas Safe, NICEIC)</ValuePoint>
          <ValuePoint>Every job on the record — permanent</ValuePoint>
          <ValuePoint>Peer endorsements from other trades</ValuePoint>
          <ValuePoint>Homeowner enquiries direct to you</ValuePoint>
          <ValuePoint>Own your data — leave any time with it</ValuePoint>
        </ul>

        <div className="mt-14 border-t border-[#1B1A17]/12 pt-6">
          <p className="text-[13px] text-[#1B1A17]/55">
            Already have a Notebook?{" "}
            <Link href="/sign-in" className="text-amber-300 hover:text-amber-200">
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
  imageUrl,
  icon,
  title,
  body
}: {
  n: string;
  imageUrl: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#1B1A17]/12 p-5 text-white shadow-[0_20px_40px_-24px_rgba(27,26,23,0.20)]">
      {/* Full-card background image */}
      <Image
        src={imageUrl}
        alt={title}
        fill
        sizes="(min-width: 768px) 33vw, 100vw"
        className="object-cover"
      />
      {/* Dark gradient so the copy is legible over any part of the image */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(20,17,10,0.88) 0%, rgba(20,17,10,0.55) 45%, rgba(20,17,10,0.15) 100%)"
        }}
      />
      {/* Content */}
      <div className="relative">
        <div className="flex items-center gap-2 text-[13px] font-mono font-semibold text-amber-300">
          {n}
        </div>
        <h3 className="mt-3 text-[16px] font-bold text-white">{title}</h3>
        <p className="mt-2 text-[13px] leading-[1.5] text-white/80">{body}</p>
        <div className="sr-only">{icon}</div>
      </div>
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
