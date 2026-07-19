// /join/homeowner — the homeowner-facing landing.
//
// Homeowners get free personal accounts (viewer_role='diy'). Sign-up
// route is /home/sign-in?signup=1 — this page is the marketing wrap
// so homeowners understand what they get before they hit the auth
// form.
//
// Free forever. Notebook, Site Board, quote requests, direct
// WhatsApp with trades.

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Home,
  Heart,
  MessageCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft
} from "lucide-react";

const STEP_IMAGES = {
  save:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_47_12%20PM.png?updatedAt=1783442852639",
  notebook:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_57_35%20PM.png?updatedAt=1783443475927",
  quote:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_55_03%20PM.png?updatedAt=1783443325500"
};

export const metadata = {
  title: "Homeowners on Thenetworkers — free forever",
  description:
    "Save inspiration, keep a Notebook for each project, and quote trades direct. No card, no commission on quotes, free forever."
};

export default function JoinHomeownerPage() {
  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(255,179,0,0.18) 0%, transparent 60%)"
        }}
      />

      <div className="relative mx-auto max-w-3xl px-6 py-10 md:px-8 md:py-16">
        <Link
          href="/join"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Pick a different path
        </Link>

        <div className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-800">
          <Home className="h-3 w-3" aria-hidden />
          For homeowners
        </div>
        <h1 className="mt-3 text-[38px] font-bold leading-[1.05] tracking-tight text-[#1B1A17] md:text-[56px]">
          Your Notebook. Every project.
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-[1.55] text-[#1B1A17]/70 md:text-[18px]">
          Save inspiration, keep receipts, and quote trades direct. Free forever — Thenetworkers never takes a cut of anything you spend.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/sign-in?role=customer"
            className="inline-flex min-h-[56px] items-center gap-2 rounded-full bg-amber-400 px-7 text-[15px] font-bold text-neutral-900 transition hover:bg-amber-300"
          >
            Create free account
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <span className="text-[13px] text-[#1B1A17]/60">
            2 minutes · No card ever
          </span>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          <FlowStep
            n="01"
            imageUrl={STEP_IMAGES.save}
            icon={<Heart className="h-4 w-4" aria-hidden />}
            title="Save what you like"
            body="Every kitchen, extension, and finished floor on Site Interest — tap the heart to pin it to your Site Board."
          />
          <FlowStep
            n="02"
            imageUrl={STEP_IMAGES.notebook}
            icon={<BookOpen className="h-4 w-4" aria-hidden />}
            title="Keep your Notebook"
            body="One notebook per project. Quotes, receipts, photos, contacts — everything you need in one place, permanent."
          />
          <FlowStep
            n="03"
            imageUrl={STEP_IMAGES.quote}
            icon={<MessageCircle className="h-4 w-4" aria-hidden />}
            title="Quote trades direct"
            body="Message any trade you find. Zero commission — the price they quote is the price you pay."
          />
        </div>

        <ul className="mt-12 grid gap-3 text-[14px] text-[#1B1A17]/80 md:grid-cols-2 md:gap-x-6">
          <ValuePoint>Free forever — no card ever required</ValuePoint>
          <ValuePoint>Site Board for saving inspiration by project</ValuePoint>
          <ValuePoint>Notebook keeps every quote, invoice, and photo</ValuePoint>
          <ValuePoint>Direct WhatsApp with trades — no middleman</ValuePoint>
          <ValuePoint>Verified badges on every trade (Gas Safe, NICEIC, etc.)</ValuePoint>
          <ValuePoint>Own your data — export any time</ValuePoint>
        </ul>

        <div className="mt-14 border-t border-[#1B1A17]/12 pt-6">
          <p className="text-[13px] text-[#1B1A17]/55">
            Already have an account?{" "}
            <Link href="/sign-in?role=customer" className="font-semibold text-amber-700 hover:text-amber-800">
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
      <Image
        src={imageUrl}
        alt={title}
        fill
        sizes="(min-width: 768px) 33vw, 100vw"
        className="object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(20,17,10,0.88) 0%, rgba(20,17,10,0.55) 45%, rgba(20,17,10,0.15) 100%)"
        }}
      />
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
        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
        aria-hidden
      />
      {children}
    </li>
  );
}
