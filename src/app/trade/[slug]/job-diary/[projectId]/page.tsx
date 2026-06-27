// Public profile — single Job Diary project page.
//
// Full update stream for one project. Newest update first. Project
// header shows title, location, started_at (day-N), and the live /
// completed status. Past-projects strip below. Small "Request
// removal" link in the footer.
//
// Indexable. Per-project OG image uses the project's cover.

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProject
} from "@/lib/supabase";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { PremiumHero } from "@/components/xrated/profile/PremiumHero";
import { JobDiaryStream } from "@/components/xrated/profile/JobDiaryStream";
import { PastProjectsStrip } from "@/components/xrated/profile/PastProjectsStrip";
import { tradeLabel, whatsappQuoteUrl } from "@/lib/tradeOff";
import { effectiveTier } from "@/lib/xratedTrades";
import { isJobDiaryOn } from "@/lib/xratedAddons";

export const revalidate = 60;

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

async function loadProject(
  listingId: string,
  projectId: string
): Promise<HammerexXratedProject | null> {
  const res = await supabase
    .from("hammerex_xrated_projects")
    .select("*")
    .eq("id", projectId)
    .eq("listing_id", listingId)
    .maybeSingle();
  return (res.data ?? null) as HammerexXratedProject | null;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string; projectId: string }>;
}): Promise<Metadata> {
  const { slug, projectId } = await params;
  const listing = await loadListing(slug);
  if (!listing) return { title: "Job Diary project" };
  const project = await loadProject(listing.id, projectId);
  if (!project) return { title: "Job Diary project" };

  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const primary = tradeLabel(listing.primary_trade);
  return {
    title: `${project.title} — ${firstName} (${primary}, ${listing.city}) | Xrated`,
    description: `Live updates from ${firstName}'s ${project.title.toLowerCase()} project in ${project.location_label}. ${primary} in ${listing.city}.`,
    alternates: { canonical: `/${slug}/job-diary/${projectId}` },
    openGraph: {
      title: `${project.title} — ${firstName}'s Job Diary`,
      description: `Live updates from a ${primary.toLowerCase()} project in ${project.location_label}.`,
      url: `/${slug}/job-diary/${projectId}`,
      images: [{ url: project.cover_image_url }],
      type: "article"
    }
  };
}

function estimatedDays(p: HammerexXratedProject): number | null {
  if (!p.estimated_complete_at) return null;
  const ms =
    new Date(p.estimated_complete_at).getTime() -
    new Date(p.started_at).getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function dayOf(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

function startedLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

export default async function JobDiaryProjectPage({
  params
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();

  const tier = effectiveTier(listing);
  const isPaid = tier === "app_trial" || tier === "app_paid";
  if (!isPaid || !isJobDiaryOn(listing)) redirect(`/${slug}`);

  const project = await loadProject(listing.id, projectId);
  if (!project) notFound();

  // Archived projects are soft-hidden — the per-project page 404s
  // so a stale share link doesn't keep surfacing a removed job.
  if (project.status === "archived") notFound();

  const primary = tradeLabel(listing.primary_trade);
  const waUrl = whatsappQuoteUrl(
    listing.whatsapp,
    listing.display_name,
    primary
  );
  const firstName =
    listing.display_name.split(/\s+/)[0] ?? listing.display_name;
  const day = dayOf(project.started_at);
  const estDays = estimatedDays(project);
  const isCompleted = project.status === "completed";

  return (
    <main className="flex flex-1 flex-col pb-20 md:pb-0">
      <PremiumHero listing={listing} waUrl={waUrl} currentPage="profile" />

      <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:px-6 sm:pt-10">
        <a
          href={`/${slug}/job-diary`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs font-bold text-neutral-700 transition hover:border-[#FFB300] hover:text-[#FFB300] sm:text-sm"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to {firstName}&rsquo;s Job Diary
        </a>

        <div className="mt-5">
          <p
            className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
            style={{ color: "#FFB300" }}
          >
            Job Diary &middot; project
          </p>
          <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl md:text-4xl">
            {project.title}
          </h1>
          <p className="mt-2 text-[13px] text-neutral-500 sm:text-sm">
            {project.location_label} &middot; started {startedLabel(project.started_at)}{" "}
            &middot;{" "}
            {isCompleted
              ? "Completed"
              : estDays
                ? `Day ${day} of ~${estDays}`
                : `Day ${day}`}
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6">
        {isCompleted && project.final_summary && (
          <div
            className="mb-4 rounded-2xl border-2 px-5 py-4"
            style={{ borderColor: "#FFB300", background: "rgba(255,179,0,0.08)" }}
          >
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
              style={{ color: "#FFB300" }}
            >
              Project complete
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-800 sm:text-sm">
              {project.final_summary}
            </p>
          </div>
        )}
        <JobDiaryStream projectId={project.id} />
      </section>

      <PastProjectsStrip listing={listing} heading="Other projects" />

      <section className="mx-auto w-full max-w-3xl px-4 pb-12 pt-8 sm:px-6">
        <p className="text-center text-[13px] text-neutral-500">
          Concerned about something in this post?{" "}
          <a
            href={`/${slug}/job-diary/${project.id}/request-removal`}
            className="font-bold underline-offset-2 hover:underline"
            style={{ color: "#FFB300" }}
          >
            Request removal
          </a>
          {" "}&mdash; the project hides immediately, admin reviews within 24 hours.
        </p>
      </section>

      <div className="mt-auto">
        {!isPaid && <XratedHeader />}
        <XratedFooter />
      </div>
    </main>
  );
}
