// Public "Right to removal" form for a single Job Diary project.
//
// Anyone — customer, neighbour, employer — can submit. The API
// immediately soft-hides the project (status -> archived) and queues
// the request for admin review.
//
// Indexable? No — robots noindex so search engines don't latch onto a
// half-emptied stub.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  supabase,
  type HammerexTradeOffListing,
  type HammerexXratedProject
} from "@/lib/supabase";
import { XratedFooter } from "@/components/xrated/XratedFooter";
import { XratedHeader } from "@/components/xrated/XratedHeader";
import { RemovalRequestForm } from "./RemovalRequestForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Request removal",
  robots: { index: false, follow: false }
};

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

export default async function RequestRemovalPage({
  params
}: {
  params: Promise<{ slug: string; projectId: string }>;
}) {
  const { slug, projectId } = await params;
  const listing = await loadListing(slug);
  if (!listing) notFound();
  const project = await loadProject(listing.id, projectId);
  if (!project) notFound();

  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <XratedHeader />
      <section className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <p
          className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: "#FFB300" }}
        >
          Right to removal
        </p>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight text-neutral-900 sm:text-3xl">
          Request removal of &ldquo;{project.title}&rdquo;
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-neutral-600 sm:text-sm">
          If something in this project shouldn&rsquo;t be public &mdash; a
          recognisable face, an address, or work the customer didn&rsquo;t agree
          to share &mdash; tell us why. The project hides from the public
          immediately while we review your request (admin replies within 24
          hours).
        </p>

        <div className="mt-6">
          <RemovalRequestForm slug={slug} projectId={projectId} projectTitle={project.title} />
        </div>
      </section>
      <XratedFooter />
    </main>
  );
}
