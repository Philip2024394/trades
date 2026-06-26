// Xrated Trades — public jobs feed card.
// Server component, no client JS. Links to /trade-off/jobs/<slug>.
// Shows the EXAMPLE pill for demo posts so tradies know not to message.
// A country flag emoji renders inline with the city so international source
// is instantly visible (UK, US, AU, DE, ES, etc.).

import type { HammerexXratedJob } from "@/lib/supabase";
import { tradeLabel } from "@/lib/tradeOff";
import { ExamplePill } from "./ExamplePill";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

// ISO 3166-1 alpha-2 country code → Unicode regional indicator emoji pair.
// e.g. 'GB' → 🇬🇧. Returns empty string for unknown / malformed codes so
// the caller can render conditionally without extra checks.
export function flagFor(cc: string): string {
  if (!cc || cc.length !== 2) return '';
  const A = 0x1F1E6 - 65;
  return String.fromCodePoint(cc.charCodeAt(0) + A, cc.charCodeAt(1) + A);
}

function tradeIconPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black/60 text-[#FFB300]">
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    </div>
  );
}

export function JobCard({ job }: { job: HammerexXratedJob }) {
  const photo = job.photos?.[0] ?? null;
  const label = tradeLabel(job.trade_slug);
  const cc = (job.country ?? '').toUpperCase();
  const flag = flagFor(cc);

  return (
    <a
      href={`/trade-off/jobs/${job.slug}`}
      className="group relative flex h-full flex-row overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-[#FFB300]"
    >
      <div className="relative aspect-[4/3] w-[42%] shrink-0 overflow-hidden bg-neutral-100 sm:w-[44%]">
        {photo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo}
            alt={`${label} job in ${job.city}`}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          tradeIconPlaceholder()
        )}
        {job.is_example && (
          <ExamplePill className="absolute right-2 top-2 shadow-lg" />
        )}
        {flag && (
          <span
            title={cc}
            aria-label={`Country ${cc}`}
            className="absolute left-2 top-2 inline-flex items-center rounded-full bg-black/70 px-1.5 py-0.5 text-sm leading-none shadow-lg backdrop-blur"
          >
            {flag}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-[#FFB300] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            {label}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-brand-muted">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="truncate">{job.city}</span>
            {flag && (
              <span title={cc} aria-label={`Country ${cc}`} className="ml-0.5">
                {flag}
              </span>
            )}
          </span>
        </div>
        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-brand-text sm:line-clamp-4">
          {job.description}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-xs text-brand-muted">
          <span>{relativeTime(job.created_at)}</span>
          {job.budget_hint && (
            <span className="inline-flex items-center rounded-full border border-brand-line bg-neutral-100 px-2 py-0.5 font-semibold text-brand-text">
              {job.budget_hint}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

export default JobCard;
