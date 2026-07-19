// /join/manufacturer — the brand-direct-seller landing.
//
// Manufacturers = brands who make their own product (Hammerex, tool
// makers, timber mills). Their canteen carries a blue "Manufacturer"
// chip on the hero so buyers can tell them apart from merchants who
// retail others' stock. Under the hood they share the trade wizard
// (viewer_role='trade' schema-wise, entity_type='manufacturer').

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Factory,
  Package,
  TrendingUp,
  CheckCircle2,
  ChevronLeft
} from "lucide-react";

const STEP_IMAGES = {
  tellUs:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%2016,%202026,%2009_25_22%20AM.png",
  products:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_57_35%20PM.png?updatedAt=1783443475927",
  tradeCenter:
    "https://ik.imagekit.io/9mrgsv2rp/ChatGPT%20Image%20Jul%207,%202026,%2011_55_03%20PM.png?updatedAt=1783443325500"
};

export const metadata = {
  title: "Sell direct on Thenetworkers — free for manufacturers",
  description:
    "Brand-direct sellers get a canteen, product catalogue on Trade Center, and a Manufacturer chip so buyers know it's not resale."
};

export default function JoinManufacturerPage() {
  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% 0%, rgba(30,58,138,0.18) 0%, transparent 60%)"
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

        <div
          className="mt-8 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white"
          style={{ backgroundColor: "#1E3A8A" }}
        >
          <Factory className="h-3 w-3" aria-hidden />
          For manufacturers
        </div>
        <h1 className="mt-3 text-[38px] font-bold leading-[1.05] tracking-tight text-[#1B1A17] md:text-[56px]">
          Direct from source. No resale layer.
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-[1.55] text-[#1B1A17]/70 md:text-[18px]">
          Your brand, your prices, your terms. The Manufacturer chip on your canteen and every product tells buyers this isn't a retailer — you make it.
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
            icon={<Factory className="h-4 w-4" aria-hidden />}
            title="Tell us about your brand"
            body="Brand name, product category, country of assembly. Verified against Companies House."
          />
          <FlowStep
            n="02"
            imageUrl={STEP_IMAGES.products}
            icon={<Package className="h-4 w-4" aria-hidden />}
            title="Add your product catalogue"
            body="Full spec, variants, Deal Breaker upsells, dual currency. Every product carries your Ref number end-to-end."
          />
          <FlowStep
            n="03"
            imageUrl={STEP_IMAGES.tradeCenter}
            icon={<TrendingUp className="h-4 w-4" aria-hidden />}
            title="Buyers find you direct"
            body="Trades browse Trade Center, see the Manufacturer chip, and message you direct. Zero commission on any sale."
          />
        </div>

        <ul className="mt-12 grid gap-3 text-[14px] text-[#1B1A17]/80 md:grid-cols-2 md:gap-x-6">
          <ValuePoint>Blue Manufacturer chip on canteen + every product</ValuePoint>
          <ValuePoint>Ref numbers surface on PDP, cart, WhatsApp share</ValuePoint>
          <ValuePoint>Dual currency (canonical + indicative) built in</ValuePoint>
          <ValuePoint>Deal Breaker upsells inline on every PDP</ValuePoint>
          <ValuePoint>Zero commission on any sale — you keep 100%</ValuePoint>
          <ValuePoint>Point your existing domain at your canteen (optional)</ValuePoint>
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
