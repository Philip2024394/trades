// Xrated Trades — landing-page jobs carousel.
// Server component. Gated by NEXT_PUBLIC_XRATED_JOBS_CAROUSEL=on so it
// stays hidden until there's real job density to show. Fetches the latest
// 8 live jobs and renders a horizontal scroll strip.

import { supabase, type HammerexXratedJob } from "@/lib/supabase";
import { jobsCarouselEnabled } from "@/lib/xratedJobs";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { JobCard } from "./JobCard";

export async function JobsCarousel() {
  if (!jobsCarouselEnabled()) return null;

  const res = await supabase
    .from("hammerex_xrated_jobs")
    .select("*")
    .eq("status", "live")
    .order("created_at", { ascending: false })
    .limit(8);

  const jobs = (res.data ?? []) as HammerexXratedJob[];

  return (
    <section className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: XRATED_BRAND.accent }}
            >
              Live jobs
            </p>
            <h2 className="mt-1 text-lg font-bold leading-tight text-neutral-900 sm:text-xl">
              Jobs posted on Xrated Trades — message customers direct.
            </h2>
          </div>
          <a
            href="/trade-off/jobs"
            className="inline-flex h-11 items-center rounded-lg border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:border-[#FFB300] hover:text-[#FFB300]"
          >
            See all jobs →
          </a>
        </div>

        {jobs.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-brand-line bg-brand-surface p-8 text-center">
            <p className="text-sm font-semibold text-brand-text">
              No live jobs yet — customers will appear here soon.
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              Tradies, your WhatsApp is the inbound channel.
            </p>
          </div>
        ) : (
          <div className="mt-5 -mx-4 overflow-x-auto px-4 [scrollbar-width:thin] snap-x snap-mandatory">
            <ul className="flex w-max gap-4">
              {jobs.map((j) => (
                <li
                  key={j.id}
                  className="w-[88vw] max-w-[420px] shrink-0 snap-start sm:w-[460px] sm:max-w-none"
                >
                  <JobCard job={j} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

export default JobsCarousel;
