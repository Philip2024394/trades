"use client";

// Xrated Trades — post-submit confirmation page.
// Reads ?slug=<returned-slug>. The job sits in 'pending' until admin flips
// it to 'live' (Agent C owns moderation). Customer sees an amber pending
// banner here so the expectation is set.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XratedViewTracker } from "@/components/trade-off/XratedViewTracker";

export const dynamic = "force-dynamic";

function Inner() {
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const trackingPath = `/trade-off/jobs/${slug}`;

  return (
    <main className="min-h-screen bg-brand-bg text-brand-text">
      <XratedViewTracker page="job_post_done" listingId={null} />
      <XratedHeader />

      <section className="mx-auto max-w-2xl px-4 pb-16 pt-12">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
            Pending review
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight sm:text-3xl">
            Your job is pending review — usually live within 24 hours.
          </h1>
          <p className="mt-3 text-xs leading-relaxed text-brand-text sm:text-sm">
            We're checking quickly that the job is real before pushing it live. Tradies
            will start messaging you on WhatsApp once it's live.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="/trade-off/jobs"
            className="inline-flex h-11 items-center rounded-lg bg-[#FFB300] px-5 text-xs font-bold text-white transition hover:bg-[#E5A500]"
          >
            See live jobs
          </a>
          {slug && (
            <a
              href={trackingPath}
              className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-5 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] hover:text-[#FFB300]"
            >
              Preview my job page
            </a>
          )}
          <a
            href="/trade-off"
            className="inline-flex h-11 items-center rounded-lg border border-brand-line bg-brand-surface px-5 text-xs font-semibold text-brand-text transition hover:border-[#FFB300] hover:text-[#FFB300]"
          >
            Browse tradies
          </a>
        </div>

        <p className="mt-8 text-center text-xs text-brand-muted">
          Xrated Trades is free for customers. We don't take a cut of your job.
        </p>
      </section>

      <XratedFooter />
    </main>
  );
}

export default function JobPostDonePage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
