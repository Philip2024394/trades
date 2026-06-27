// Dedicated "Job Diary" page.
//
// Marketing surface — INDEXABLE by default. A customer searching
// "loft conversion Camden" should be able to discover Mike. Mirrors
// the trusted-trades / downloads server-shell pattern: hero up top so
// the visitor knows whose work this is, then a list of CURRENT
// projects with their latest update inline (newest first), then the
// past-projects strip.
//
// Gated to paid tier AND the `job_diary` add-on enabled. Free profiles
// or paid-with-add-on-off bounce back to /<slug>.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProject,
  type HammerexXratedProjectUpdate
} from "@/lib/supabase";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { PastProjectsStrip } from "@/components/xrated/profile/PastProjectsStrip";
import { StatusChip } from "@/components/xrated/profile/StatusChip";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import { isJobDiaryOn } from "@/lib/xratedAddons";

export const revalidate = 300;

async function loadListing(
  slug: string
): Promise<HammerexTradeOffListing | null> {
  const res = await supabase
    .from("hammerex_trade_off_listings")
    .select("*")
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();
  return (res.data ?? null) as HammerexTradeOffListing | null;
}

async function loadLiveProjects(listingId: string): Promise<HammerexXratedProject[]> {
  const res = await supabase
    .from("hammerex_xrated_projects")
    .select("*")
    .eq("listing_id", listingId)
    .eq("status", "live")
    .order("started_at", { ascending: false })
    .limit(20);
  return (res.data ?? []) as HammerexXratedProject[];
}

async function loadLatestUpdates(
  projectIds: string[]
): Promise<Record<string, HammerexXratedProjectUpdate>> {
  if (projectIds.length === 0) return {};
  const res = await supabase
    .from("hammerex_xrated_project_updates")
    .select("*")
    .in("project_id", projectIds)
    .order("posted_at", { ascending: false });
  const rows = (res.data ?? []) as HammerexXratedProjectUpdate[];
  const out: Record<string, HammerexXratedProjectUpdate> = {};
  for (const u of rows) {
    if (!out[u.project_id]) out[u.project_id] = u;
  }
  return out;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Job Diary" };

  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const primary = tradeLabel(listing.primary_trade);
  const title = `${firstName}'s Job Diary — live updates from ${primary} jobs in ${listing.city} | Xrated`;

  // Pick the first project's cover for the OG image so the share card
  // is visual, not text-on-yellow.
  const projects = await loadLiveProjects(listing.id);
  const ogImage = projects[0]?.cover_image_url || listing.photos[0] || undefined;

  return {
    title,
    description: `Live job updates from ${firstName} — ${primary.toLowerCase()} in ${listing.city}. See what we're working on and what we've delivered.`,
    alternates: { canonical: `/${slug}/job-diary` },
    openGraph: {
      title: `${firstName}'s Job Diary — ${primary} in ${listing.city}`,
      description: `Live updates from every job — photos, status, day count.`,
      url: `/${slug}/job-diary`,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "article"
    }
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

export default async function JobDiaryPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid || !isJobDiaryOn(listing)) redirect(`/${slug}`);

  const primary = tradeLabel(listing.primary_trade);
  const waUrl = whatsappQuoteUrl(
    listing.whatsapp,
    listing.display_name,
    primary
  );
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;

  const liveProjects = await loadLiveProjects(listing.id);
  const latestByProject = await loadLatestUpdates(liveProjects.map((p) => p.id));

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="profile" />

      <section className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
        <a
          href={`/${slug}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:text-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to {firstName}&rsquo;s profile
        </a>

        <div className="mt-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Job Diary &middot; updates from {firstName}
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl md:text-4xl">
            {firstName}&rsquo;s{" "}
            <span style={{ color: "#FFB300" }}>Job Diary.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-neutral-600 sm:text-sm">
            Live updates from every job &mdash; see what we&rsquo;re working
            on and what we&rsquo;ve delivered.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6">
        {liveProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center">
            <p className="text-sm text-neutral-600">
              {firstName} doesn&rsquo;t have any live projects right now. Check
              back soon &mdash; or message direct for an update.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {liveProjects.map((p) => {
              const latest = latestByProject[p.id];
              const day = dayOf(p.started_at);
              return (
                <li
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <a
                    href={`/${slug}/job-diary/${p.id}`}
                    className="group flex flex-col gap-4 transition hover:bg-neutral-50 sm:flex-row"
                  >
                    <div className="relative h-44 w-full shrink-0 overflow-hidden bg-neutral-100 sm:h-auto sm:w-56">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={latest?.image_urls[0] ?? p.cover_image_url}
                        alt={p.title}
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        {latest && <StatusChip status={latest.status_chip} />}
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
                          Day {day}
                        </span>
                      </div>
                      <p className="text-lg font-extrabold leading-tight text-neutral-900 sm:text-xl">
                        {p.title}
                      </p>
                      <p className="text-[13px] text-neutral-500">
                        {p.location_label}
                        {latest ? ` · ${relativeAgo(latest.posted_at)}` : ""}
                      </p>
                      {latest?.note ? (
                        <p className="line-clamp-3 text-[13px] leading-relaxed text-neutral-700 sm:text-sm">
                          &ldquo;{latest.note}&rdquo;
                        </p>
                      ) : (
                        <p className="text-[13px] italic text-neutral-400">
                          No updates yet &mdash; freshly started.
                        </p>
                      )}
                      <p className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-neutral-500 transition group-hover:text-[#FFB300]">
                        See full project
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition group-hover:translate-x-0.5">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PastProjectsStrip listing={listing} />

      <section className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 sm:px-6">
        <div
          className="overflow-hidden rounded-3xl px-6 py-8 text-center sm:px-12"
          style={{ background: "#0A0A0A" }}
        >
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Are you a tradesperson too?
          </p>
          <h2 className="mt-2 text-xl font-extrabold leading-tight text-white sm:text-2xl">
            Want to track your own jobs publicly?{" "}
            <span style={{ color: "#FFB300" }}>
              Start your 14-day free trial.
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[13px] leading-relaxed text-white/70 sm:text-sm">
            Job Diary turns every project into a live update stream &mdash; photo,
            status, day count, social share. £4/mo. Cancel any time.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <a
              href={`/trade-off/signup?ref=${encodeURIComponent(slug)}`}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg px-5 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.98] sm:text-sm"
              style={{ background: "#FFB300" }}
            >
              Join XratedTrade
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
            <a
              href="/trade-off/add-ons"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-white/30 bg-white/5 px-5 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              See all add-ons
            </a>
          </div>
        </div>
      </section>

      <div className="mt-auto">
        {!isPaid && <XratedHeader />}
        <XratedFooter />
      </div>
    </main>
  );
}
