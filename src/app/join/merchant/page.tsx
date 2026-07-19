// /join/merchant — the product-merchant landing.
//
// Merchants = product sellers (builders' merchant, stone yard, tool
// shop, timber, kitchen supplier). Under the hood they share the
// trade wizard (viewer_role='trade') — the difference is the framing
// on this page and the emphasis on Trade Center placement.
//
// After signup they hit the canteen create flow, and the first-3-
// products step immediately seeds their Trade Center presence.

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Package,
  Store,
  TrendingUp,
  CheckCircle2,
  ChevronLeft
} from "lucide-react";

const STEP_IMAGES = {
  tellUs:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_47_12%20PM.png?updatedAt=1783442852639",
  products:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_57_35%20PM.png?updatedAt=1783443475927",
  tradeCenter:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_55_03%20PM.png?updatedAt=1783443325500"
};

export const metadata = {
  title: "Sell to trades on Thenetworkers — free to list",
  description:
    "Free canteen for your yard, and every product you list lands in Trade Center automatically. No commission, no lead fees, no card at signup."
};

export default function JoinMerchantPage() {
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
          <Package className="h-3 w-3" aria-hidden />
          For product merchants
        </div>
        <h1 className="mt-3 text-[38px] font-bold leading-[1.05] tracking-tight text-[#1B1A17] md:text-[56px]">
          Every product you list. Live in Trade Center.
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-[1.55] text-[#1B1A17]/70 md:text-[18px]">
          Your yard, your prices, your terms. Trades browse and message you direct — zero commission on any sale, ever.
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

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          <FlowStep
            n="01"
            imageUrl={STEP_IMAGES.tellUs}
            icon={<Store className="h-4 w-4" aria-hidden />}
            title="Tell us about your yard"
            body="Business name, primary category, city. Verified against Companies House."
          />
          <FlowStep
            n="02"
            imageUrl={STEP_IMAGES.products}
            icon={<Package className="h-4 w-4" aria-hidden />}
            title="Add your first products"
            body="Just a name and price to start. Each one lands in Trade Center immediately — flesh them out later in Manage."
          />
          <FlowStep
            n="03"
            imageUrl={STEP_IMAGES.tradeCenter}
            icon={<TrendingUp className="h-4 w-4" aria-hidden />}
            title="Trades find you"
            body="Search, message, and buy direct. You keep 100% of the money — Thenetworkers takes nothing on the sale."
          />
        </div>

        <ul className="mt-12 grid gap-3 text-[14px] text-[#1B1A17]/80 md:grid-cols-2 md:gap-x-6">
          <ValuePoint>Free canteen with your yard branding</ValuePoint>
          <ValuePoint>Every product syndicates to Trade Center</ValuePoint>
          <ValuePoint>Zero commission on sales — you keep 100%</ValuePoint>
          <ValuePoint>Trade-only pricing supported (visible only to verified trades)</ValuePoint>
          <ValuePoint>Bulk pricing, pack sizes, delivery promises</ValuePoint>
          <ValuePoint>Featured Placement available at Pro tier (optional)</ValuePoint>
        </ul>

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
