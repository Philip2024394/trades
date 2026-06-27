// Project Beacon page — customer-side "ping the 3 closest trades"
// surface. Standalone page rather than a toggle on /find because the
// form takes real estate that the search-result list shouldn't lose.

import type { Metadata } from "next";
import { headers } from "next/headers";
import { FindHeader } from "@/components/xrated/find/FindHeader";
import { FindFooter } from "@/components/xrated/find/FindFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";
import { ProjectBeaconForm } from "@/components/xrated/find/ProjectBeaconForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "Send your project to the 3 nearest trades | xratedtrades.com",
  description:
    "Type your project once, push it to the 3 closest verified Xrated trades. They WhatsApp you direct. We don't sit in the middle — no quote forms, no lead routing, no commission.",
  alternates: { canonical: "/find/beacon" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Project Beacon — push to the 3 nearest UK trades.",
    description:
      "Type once. 3 nearest trades get pinged. They WhatsApp you direct. No middleman.",
    url: absolute("/find/beacon")
  }
};

async function detectCountry(): Promise<string> {
  try {
    const h = await headers();
    const fromCf = h.get("cf-ipcountry");
    if (fromCf && fromCf.length === 2) return fromCf.toUpperCase();
    const fromVercel = h.get("x-vercel-ip-country");
    if (fromVercel && fromVercel.length === 2) return fromVercel.toUpperCase();
  } catch {}
  return "GB";
}

export default async function ProjectBeaconPage() {
  const detectedCountry = await detectCountry();
  return (
    <main className="bg-neutral-50 pb-2 md:pb-0">
      <FindHeader />

      {/* Hero — black full-bleed, simple */}
      <section
        className="relative overflow-hidden border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="relative mx-auto max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-16">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Project Beacon
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-[1.05] text-white sm:text-5xl md:text-6xl">
            Type once.{" "}
            <span style={{ color: XRATED_BRAND.accent }}>3 trades reply.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-bold text-white/85 sm:text-base">
            Push your project to the 3 nearest paid Xrated trades.
            They&rsquo;ll WhatsApp you direct &mdash; we never sit in the
            middle.
          </p>
        </div>
      </section>

      {/* Form — floats over the hero/page boundary like /find */}
      <section className="relative z-10 -mt-10 mb-2 px-4 sm:-mt-14 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <ProjectBeaconForm detectedCountry={detectedCountry} />
        </div>
      </section>

      {/* How it works — three quick steps */}
      <section className="mx-auto max-w-3xl px-4 pt-10 sm:px-6 sm:pt-12">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
          How it works
        </h2>
        <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Step n={1} title="You type" body="Trade, your area, your project. 30 seconds." />
          <Step n={2} title="3 trades get pinged" body="Phone notification + sound to the closest paid members in your trade." />
          <Step n={3} title="They WhatsApp you" body="Direct, no middleman. Xrated never sees the conversation." />
        </ol>
      </section>

      {/* Back to search */}
      <section className="mx-auto mt-8 max-w-3xl px-4 pb-2 text-center sm:px-6">
        <a
          href="/find"
          className="inline-flex h-10 items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wider text-neutral-600 transition hover:text-neutral-900"
        >
          &larr; Or browse trades on xratedtrades.com
        </a>
      </section>

      <FindFooter />
    </main>
  );
}

function Step({
  n,
  title,
  body
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-neutral-900"
        style={{ background: XRATED_BRAND.accent }}
        aria-hidden="true"
      >
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-extrabold text-neutral-900">
          {title}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-600">
          {body}
        </p>
      </div>
    </li>
  );
}
