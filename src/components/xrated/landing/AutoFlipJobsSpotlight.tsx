"use client";

// Xrated Trades — auto-flipping live jobs spotlight (the headline feature).
// Single landscape card cross-fading between live jobs every 3 seconds.
// Pause-on-hover (desktop) + pause-on-touch (mobile) + swipe gestures.
// Progress dots are tappable and act as both indicator + control.
//
// Country-weighted shuffle: ~70% of the slides come from the user's own
// country (server-detected) and ~30% are international, interleaved so the
// user immediately sees that this is a multi-country directory. The country
// flag emoji renders next to the city + as a top-right ribbon on the photo.

import { useEffect, useMemo, useRef, useState } from "react";
import type { HammerexXratedJob } from "@/lib/supabase";
import { tradeLabel } from "@/lib/tradeOff";
import { XRATED_BRAND } from "@/lib/xratedTrades";
import { flagFor } from "@/components/xrated/jobs/JobCard";

type Props = {
  jobs: HammerexXratedJob[];
  userCountry: string | null;
};

const FLIP_MS = 3000;
const SWIPE_THRESHOLD = 40; // px
const DISPLAY_TARGET = 8;
const LOCAL_SHARE = 0.7;

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
  return `${Math.floor(days / 7)}w ago`;
}

function waUrlFor(job: HammerexXratedJob): string | null {
  if (job.is_example) return null;
  const digits = job.customer_whatsapp.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  const label = tradeLabel(job.trade_slug);
  const text =
    `Hi ${job.customer_name}, I saw your ${label.toLowerCase()} job on Xrated Trades.\n` +
    `I can help — happy to discuss the details.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// Fisher-Yates — pure, returns a new array so the input isn't mutated.
function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Build the display list. ~70% local + ~30% international, interleaved so we
// don't get a block of local then a block of intl. Falls back gracefully when
// either bucket is empty or short.
function buildDisplayList(
  jobs: HammerexXratedJob[],
  userCountry: string | null,
  target = DISPLAY_TARGET
): HammerexXratedJob[] {
  if (jobs.length === 0) return [];
  if (!userCountry) return shuffle(jobs).slice(0, target);

  const cc = userCountry.toUpperCase();
  const local = shuffle(jobs.filter((j) => (j.country ?? "").toUpperCase() === cc));
  const intl  = shuffle(jobs.filter((j) => (j.country ?? "").toUpperCase() !== cc));

  if (local.length === 0) return intl.slice(0, target);
  if (intl.length === 0)  return local.slice(0, target);

  const desiredLocal = Math.round(target * LOCAL_SHARE);
  const localPick    = local.slice(0, Math.min(desiredLocal, local.length));
  const remaining    = target - localPick.length;
  const intlPick     = intl.slice(0, Math.min(remaining, intl.length));

  // Interleave: round-robin from the longer bucket so we never get all-local
  // up front then all-intl after.
  const out: HammerexXratedJob[] = [];
  const longer  = localPick.length >= intlPick.length ? localPick : intlPick;
  const shorter = localPick.length >= intlPick.length ? intlPick  : localPick;
  const ratio   = shorter.length === 0 ? 0 : Math.max(1, Math.round(longer.length / shorter.length));
  let li = 0;
  let si = 0;
  while (li < longer.length || si < shorter.length) {
    for (let k = 0; k < ratio && li < longer.length; k++) out.push(longer[li++]);
    if (si < shorter.length) out.push(shorter[si++]);
  }
  return out.slice(0, target);
}

export function AutoFlipJobsSpotlight({ jobs, userCountry }: Props) {
  // SSR-stable initial order — first DISPLAY_TARGET jobs in DB order. Avoids
  // a hydration mismatch from `Math.random()` returning a different sequence
  // on the server vs. the client. After mount we swap in the country-weighted
  // shuffle below.
  const ssrInitial = useMemo(
    () => jobs.slice(0, DISPLAY_TARGET),
    [jobs.map((j) => j.id).join(",")]
  );
  const [display, setDisplay] = useState<HammerexXratedJob[]>(ssrInitial);

  // Run the 70/30 country-weighted shuffle only on the client, after hydration.
  useEffect(() => {
    setDisplay(buildDisplayList(jobs, userCountry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs.map((j) => j.id).join(","), userCountry]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = display.length;

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, FLIP_MS);
    return () => window.clearInterval(id);
  }, [count, paused]);

  if (count === 0) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-16">
        <SpotlightHeader />
        <div className="mt-5 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-10 text-center">
          <p className="text-sm font-semibold text-neutral-900">
            No live jobs yet — customers will appear here soon.
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Be first to post a job — free.
          </p>
          <a
            href="/trade-off/jobs/post"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-[#FFB300] px-5 text-xs font-bold text-white transition hover:bg-[#E5A500]"
          >
            Post a job
          </a>
        </div>
      </section>
    );
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    setPaused(true);
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start == null) {
      setPaused(false);
      return;
    }
    const delta = e.changedTouches[0].clientX - start;
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      setIndex((i) => {
        if (delta < 0) return (i + 1) % count;
        return (i - 1 + count) % count;
      });
    }
    // Give the user a beat to read before resuming.
    window.setTimeout(() => setPaused(false), 1500);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <SpotlightHeader />

      <div
        className="relative mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-white"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative aspect-[16/9] w-full md:aspect-auto md:min-h-[340px]">
          {display.map((job, i) => (
            <SpotlightSlide
              key={job.id}
              job={job}
              active={i === index}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-4 py-3">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {display.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to job ${i + 1} of ${count}`}
                className={`h-2 rounded-full transition-all ${
                  i === index ? "w-8 bg-[#FFB300]" : "w-2 bg-neutral-300 hover:bg-neutral-400"
                }`}
              />
            ))}
          </div>
          <p className="shrink-0 text-xs font-semibold text-neutral-500">
            {index + 1} of {count}
          </p>
        </div>
      </div>
    </section>
  );
}

function SpotlightHeader() {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <p
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]"
          style={{ color: XRATED_BRAND.accent }}
        >
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 animate-pulse rounded-full"
            style={{ background: "#ef4444", boxShadow: "0 0 8px #ef4444" }}
          />
          Live jobs
        </p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
          Message customers direct.
        </h2>
      </div>
      <a
        href="/trade-off/jobs"
        className="hidden h-11 items-center rounded-lg border border-neutral-300 bg-white px-4 text-xs font-semibold text-neutral-900 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:inline-flex"
      >
        See all jobs →
      </a>
    </div>
  );
}

function SpotlightSlide({
  job,
  active
}: {
  job: HammerexXratedJob;
  active: boolean;
}) {
  const photo = job.photos?.[0] ?? null;
  const label = tradeLabel(job.trade_slug);
  const waUrl = waUrlFor(job);
  const cc = (job.country ?? "").toUpperCase();
  const flag = flagFor(cc);

  return (
    <div
      aria-hidden={!active}
      className={`absolute inset-0 transition-opacity duration-700 ${
        active ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="flex h-full flex-col md:flex-row">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-black md:aspect-auto md:w-1/2">
          {photo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photo}
              alt={`${label} job in ${job.city}`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="1.5" aria-hidden="true">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
          )}
          {flag && (
            <span
              title={cc}
              aria-label={`Country ${cc}`}
              className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-base leading-none shadow-lg backdrop-blur"
            >
              <span className="text-lg">{flag}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">{cc}</span>
            </span>
          )}
          {job.is_example && (
            <span className="absolute right-3 top-3 inline-flex items-center rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold tracking-wide text-black shadow-lg">
              EXAMPLE
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4 sm:p-6 md:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[#FFB300] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
              {label}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {job.city}
              {flag && (
                <span title={cc} className="ml-0.5 text-base leading-none">
                  {flag}
                </span>
              )}
            </span>
            <span className="text-xs text-neutral-500">{relativeTime(job.created_at)}</span>
          </div>
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-neutral-900 md:text-base">
            {job.description}
          </p>
          {job.budget_hint && (
            <p className="mt-3">
              <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-semibold text-neutral-900">
                Budget: {job.budget_hint}
              </span>
            </p>
          )}
          <div className="mt-auto pt-5">
            {job.is_example || !waUrl ? (
              <a
                href={`/trade-off/jobs/${job.slug}`}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-neutral-300 bg-white px-5 text-sm font-bold text-neutral-900 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:w-auto sm:px-7"
              >
                View job →
              </a>
            ) : (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#22c55e] px-5 text-sm font-bold text-white shadow-lg shadow-green-500/20 transition hover:bg-[#16a34a] active:scale-[0.98] sm:w-auto sm:px-7"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.52 3.48A11.94 11.94 0 0 0 12.04.05C5.46.05.13 5.38.13 11.96c0 2.1.55 4.15 1.6 5.96L0 24l6.27-1.64a11.93 11.93 0 0 0 5.77 1.47h.01c6.58 0 11.91-5.33 11.91-11.91 0-3.18-1.24-6.17-3.44-8.44ZM12.04 21.8h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.72.97 1-3.63-.24-.37a9.84 9.84 0 0 1-1.51-5.21c0-5.47 4.46-9.92 9.93-9.92 2.65 0 5.14 1.03 7.01 2.91a9.84 9.84 0 0 1 2.9 7.02c0 5.47-4.45 9.92-9.97 9.92Z" />
                </svg>
                Message customer on WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AutoFlipJobsSpotlight;
