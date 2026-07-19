// /join — audience picker.
//
// Three-way fork. Everyone lands here from the audience gate; the tile
// they pick governs the framing on the next page. Backend account
// shape is unified (viewer_role='trade' | 'diy') — trades and
// merchants share the trade wizard, homeowners share the diy sign-in.
//
// Trade-specific marketing → /join/trade
// Merchant-specific marketing → /join/merchant
// Homeowner-specific marketing → /join/homeowner

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Hammer,
  Package,
  Home,
  Factory,
  ChevronLeft
} from "lucide-react";

export const metadata = {
  title: "Join Thenetworkers — pick your path",
  description:
    "Trades, merchants, and homeowners all live on Thenetworkers. Pick the path that fits you — every one is free to start."
};

type Path = {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  image: string;
};

const PATHS: readonly Path[] = [
  {
    href: "/join/trade",
    eyebrow: "For trades",
    title: "I run a trade.",
    body: "Plumber, sparks, joiner, kitchen fitter, bricklayer. Free business app, canteen, and URL — customers WhatsApp you direct, no commission.",
    cta: "Join as a trade",
    icon: Hammer,
    image:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_57_35%20PM.png?updatedAt=1783443475927"
  },
  {
    href: "/join/manufacturer",
    eyebrow: "For manufacturers",
    title: "I make the product.",
    body: "Brand-direct sellers. Tool makers, timber mills, stone yards. Your canteen shows the \"direct from source\" chip so buyers know it's not resale.",
    cta: "Join as a manufacturer",
    icon: Factory,
    image:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2016,%202026,%2009_25_22%20AM.png"
  },
  {
    href: "/join/merchant",
    eyebrow: "For merchants",
    title: "I sell products to trades.",
    body: "Builders' merchant, retailers, distributors. Free canteen, plus every product you list lands in Trade Center automatically.",
    cta: "Join as a merchant",
    icon: Package,
    image:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_47_12%20PM.png?updatedAt=1783442852639"
  },
  {
    href: "/join/homeowner",
    eyebrow: "For homeowners",
    title: "I'm a homeowner.",
    body: "Save inspiration, keep a Notebook for each project, quote trades direct. Free forever — no card, no commission on quotes.",
    cta: "Sign up as a homeowner",
    icon: Home,
    image:
      "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_55_03%20PM.png?updatedAt=1783443325500"
  }
];

export default function JoinPickerPage() {
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

      <div className="relative mx-auto max-w-5xl px-6 py-10 md:px-8 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </Link>

        <h1 className="mt-8 text-[38px] font-bold leading-[1.05] tracking-tight text-[#1B1A17] md:text-[56px]">
          One network. Four doors.
        </h1>
        <p className="mt-4 max-w-2xl text-[16px] leading-[1.55] text-[#1B1A17]/70 md:text-[18px]">
          Trades, manufacturers, merchants, and homeowners all live on Thenetworkers. Pick the door that fits you — each one is free to start. You can always change later.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {PATHS.map((p) => (
            <PathCard key={p.href} path={p} />
          ))}
        </div>

        <div className="mt-14 border-t border-[#1B1A17]/12 pt-6">
          <p className="text-[13px] text-[#1B1A17]/55">
            Already on Thenetworkers?{" "}
            <Link href="/sign-in" className="font-semibold text-amber-700 hover:text-amber-800">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

function PathCard({ path }: { path: Path }) {
  const Icon = path.icon;
  return (
    <Link
      href={path.href}
      className="group relative flex min-h-[380px] flex-col overflow-hidden rounded-2xl border border-[#1B1A17]/12 shadow-[0_20px_40px_-24px_rgba(27,26,23,0.20)] transition hover:shadow-[0_28px_52px_-24px_rgba(27,26,23,0.30)]"
    >
      <Image
        src={path.image}
        alt={path.title}
        fill
        sizes="(min-width: 768px) 33vw, 100vw"
        className="object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(20,17,10,0.92) 0%, rgba(20,17,10,0.65) 45%, rgba(20,17,10,0.15) 100%)"
        }}
      />
      <div className="relative flex flex-1 flex-col p-5">
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400/20 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-200"
        >
          <Icon className="h-3 w-3" aria-hidden />
          {path.eyebrow}
        </span>
        <h3 className="mt-auto text-[22px] font-black leading-tight text-white">
          {path.title}
        </h3>
        <p className="mt-2 text-[13px] leading-[1.5] text-white/85">
          {path.body}
        </p>
        <span
          className="mt-4 inline-flex items-center gap-2 text-[12px] font-black uppercase tracking-[0.16em] text-amber-300 transition group-hover:gap-3"
        >
          {path.cta}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}
