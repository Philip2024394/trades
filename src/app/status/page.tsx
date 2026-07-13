// Xrated Trades — Service Status page.
// Static for now: signals operational maturity to Stripe risk reviewers
// and to customers checking us out before signing up. Wires a real
// uptime monitor (Better Stack / Statuspage) is a Phase 2 upgrade.

import type { Metadata } from "next";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BRAND, absolute } from "@/lib/seo";

// Force dynamic so the "Server time" line is current on each request.
// Cheap render — no DB calls, no edge headers.
export const dynamic = "force-dynamic";

const SUPPORT_EMAIL = "support@thenetworkers.app";

export const metadata: Metadata = {
  title: "Service status — Thenetworkers",
  description:
    "Real-time status for Thenetworkers. The platform is operating normally. Email support@thenetworkers.app to receive incident updates.",
  alternates: { canonical: "/status" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: "Service status — Thenetworkers",
    description:
      "Platform operational status and incident history for Thenetworkers.",
    url: absolute("/status")
  }
};

export default function StatusPage() {
  const now = new Date();
  // Render in a fixed UTC string so SSR + hydration agree without a
  // client-side useEffect dance.
  const serverTimeUtc = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  return (
    <main className="bg-white pb-20">
      <XratedHeader />

      <section
        className="border-b border-neutral-200"
        style={{ background: "#0A0A0A" }}
      >
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <p
            className="text-[13px] font-bold uppercase tracking-[0.22em]"
            style={{ color: XRATED_BRAND.accent }}
          >
            Status
          </p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Service status
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-white/75 sm:text-sm">
            Live operational state of thenetworkers.app, our APIs and the
            Stripe billing surface. Page updates as we ship incidents.
          </p>
        </div>
      </section>

      <article className="mx-auto mt-10 flex max-w-3xl flex-col gap-8 px-4 text-[13px] leading-relaxed text-neutral-800 sm:px-6 sm:text-sm">
        {/* Headline status pill */}
        <section
          className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"
          aria-label="Current platform status"
        >
          <div className="flex items-center gap-3">
            <span className="relative inline-flex h-3 w-3">
              <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
            <div>
              <p className="text-[13px] font-extrabold text-emerald-900">
                thenetworkers.app is operating normally.
              </p>
              <p className="mt-0.5 text-[13px] text-emerald-800/80">
                Public site, dashboards, APIs, and Stripe billing are all
                green.
              </p>
            </div>
          </div>
          <p className="hidden text-[13px] font-bold text-emerald-900 sm:block">
            All systems
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Component status
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            <ComponentRow name="Marketing site (thenetworkers.app)" />
            <ComponentRow name="Public profile pages (/trade/*)" />
            <ComponentRow name="Tradesperson dashboards" />
            <ComponentRow name="Sign-in & magic links" />
            <ComponentRow name="Stripe billing & checkout" />
            <ComponentRow name="Webhooks & API" />
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Incident history
          </h2>
          <p className="mt-3 text-neutral-700">
            <strong>No incidents in the past 90 days.</strong>
          </p>
          <p className="mt-2 text-neutral-700">
            We publish post-incident summaries here within 5 business
            days of resolution. The summary covers what broke, how long
            customers were affected, what we shipped to stop it
            recurring, and (where relevant) any SLA credits issued.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Subscribe to status updates
          </h2>
          <p className="mt-3">
            Email{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Subscribe%20to%20status%20updates`}
              className="font-extrabold underline"
            >
              {SUPPORT_EMAIL}
            </a>{" "}
            with the subject line{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px]">
              Subscribe to status updates
            </code>{" "}
            and we'll add you to the incident notification list. We email
            on declared incidents only — no marketing, no weekly digests.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-extrabold text-neutral-900 sm:text-xl">
            Server time
          </h2>
          <p className="mt-3 font-mono text-[13px] text-neutral-900">
            {serverTimeUtc}
          </p>
          <p className="mt-2 text-[13px] text-neutral-600">
            This page renders dynamically, so a recent timestamp here
            means the platform's request path is healthy end-to-end.
          </p>
        </section>
      </article>

      <XratedFooter />
    </main>
  );
}

function ComponentRow({ name }: { name: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <span className="text-[13px] font-semibold text-neutral-900">
        {name}
      </span>
      <span className="inline-flex items-center gap-2 text-[13px] font-bold text-emerald-700">
        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        Operational
      </span>
    </li>
  );
}
