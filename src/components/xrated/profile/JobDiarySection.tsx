// Public profile — Job Diary inline teaser.
//
// Server component. Surfaces the SINGLE most-recent LIVE project on
// the home profile, with its latest update inline (cover thumb, status
// chip, note, posted-relative timestamp, day-N-of-X). One yellow eyebrow
// + h2 that mirrors the visual rhythm of RecommendedTrades and
// DownloadsSection.
//
// Silently renders nothing when:
//   * The listing has zero live projects.
//   * The newest update on the latest live project is older than 30
//     days (cadence-graveyard guard — prevents a dormant diary from
//     reading as proof the tradesperson isn't busy).
//
// "View all projects →" link points at /<slug>/job-diary when the
// listing has more than one live project. "Follow this project →"
// jumps to the per-project page.

import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProject,
  type HammerexXratedProjectUpdate
} from "@/lib/supabase";
import { StatusChip } from "./StatusChip";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function loadLiveSnapshot(listingId: string): Promise<{
  latest: HammerexXratedProject | null;
  liveCount: number;
  latestUpdate: HammerexXratedProjectUpdate | null;
}> {
  // Fetch up to N live projects so we can know the count + pick the
  // one whose latest update is most recent.
  const ps = await supabase
    .from("hammerex_xrated_projects")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(20);
  const projects = (ps.data ?? []) as HammerexXratedProject[];
  if (projects.length === 0) {
    return { latest: null, liveCount: 0, latestUpdate: null };
  }

  // One batched fetch of the latest update per project — get the
  // newest 20 across all live projects and dedupe by project.
  const ids = projects.map((p) => p.id);
  const us = await supabase
    .from("hammerex_xrated_project_updates")
    .select("*")
    .in("project_id", ids)
    .order("posted_at", { ascending: false })
    .limit(20);
  const updates = (us.data ?? []) as HammerexXratedProjectUpdate[];

  // First match per project, in update-order — gives us the newest
  // update overall, and the project that owns it.
  const seen = new Set<string>();
  let pickedUpdate: HammerexXratedProjectUpdate | null = null;
  for (const u of updates) {
    if (seen.has(u.project_id)) continue;
    seen.add(u.project_id);
    if (!pickedUpdate) pickedUpdate = u;
  }
  const latestProject = pickedUpdate
    ? projects.find((p) => p.id === pickedUpdate!.project_id) ?? projects[0]
    : projects[0];

  return {
    latest: latestProject,
    liveCount: projects.length,
    latestUpdate: pickedUpdate
  };
}

function relativeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const wks = Math.floor(days / 7);
  return `${wks} wk${wks === 1 ? "" : "s"} ago`;
}

function dayOf(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

function estimatedDays(p: HammerexXratedProject): number | null {
  if (!p.estimated_complete_at) return null;
  const ms =
    new Date(p.estimated_complete_at).getTime() -
    new Date(p.started_at).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export async function JobDiarySection({
  listing
}: {
  listing: HammerexTradeOffListing;
}) {
  const { latest, liveCount, latestUpdate } = await loadLiveSnapshot(listing.id);
  if (!latest) return null;

  // Cadence-graveyard guard: if the project's last update is older
  // than 30 days, hide the teaser. We use the project's started_at
  // as a fall-back when there are no updates yet — a fresh project
  // with no updates should still show.
  const lastSignalIso = latestUpdate?.posted_at ?? latest.started_at;
  const isStale = Date.now() - new Date(lastSignalIso).getTime() > THIRTY_DAYS_MS;
  if (isStale) return null;

  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const day = dayOf(latest.started_at);
  const estDays = estimatedDays(latest);

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 sm:pt-12">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Job Diary
          </p>
          <h2 className="mt-1 text-xl font-extrabold text-neutral-900 sm:text-2xl">
            {firstName}&rsquo;s current work
          </h2>
          <p className="mt-1 text-[13px] text-neutral-500 sm:text-sm">
            Live updates from the project on now &mdash; photos, status, and
            the day count.
          </p>
        </div>
        {liveCount > 1 && (
          <a
            href={`/${listing.slug}/job-diary`}
            className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3.5 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:inline-flex sm:h-10"
          >
            View all
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </a>
        )}
      </div>

      <a
        href={`/${listing.slug}/job-diary/${latest.id}`}
        className="group mt-5 flex flex-col gap-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white transition hover:border-[#FFB300] hover:shadow-md sm:flex-row"
      >
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-neutral-100 sm:h-auto sm:w-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={latestUpdate?.image_urls[0] ?? latest.cover_image_url}
            alt={latest.title}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {latestUpdate && <StatusChip status={latestUpdate.status_chip} />}
            <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
              {estDays ? `Day ${day} of ~${estDays}` : `Day ${day}`}
            </span>
          </div>
          <p className="text-lg font-extrabold leading-tight text-neutral-900 sm:text-xl">
            {latest.title}
          </p>
          <p className="text-[13px] text-neutral-500">
            {latest.location_label}
            {latestUpdate ? ` · ${relativeAgo(latestUpdate.posted_at)}` : ""}
          </p>
          {latestUpdate?.note && (
            <p className="line-clamp-3 text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
              &ldquo;{latestUpdate.note}&rdquo;
            </p>
          )}
          <p className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-neutral-500 transition group-hover:text-[#FFB300]">
            Follow this project
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition group-hover:translate-x-0.5">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </p>
        </div>
      </a>

      {liveCount > 1 && (
        <a
          href={`/${listing.slug}/job-diary`}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:hidden"
        >
          View all {liveCount} live projects
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      )}
    </section>
  );
}
