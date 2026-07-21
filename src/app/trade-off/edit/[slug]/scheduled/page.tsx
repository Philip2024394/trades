// /trade-off/edit/[slug]/scheduled — merchant's scheduled-post
// dashboard. Lists upcoming, posted, and failed scheduled posts
// with reschedule / cancel actions.
//
// Server-side auth: the [slug]/layout.tsx already gates this
// subtree to the merchant who owns the slug. We just render the
// data.

import { redirect, notFound } from "next/navigation";
import { getMerchantSlug } from "@/lib/merchantSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { ScheduledPostsShell } from "./ScheduledPostsShell";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Scheduled posts — Thenetworkers",
  description: "Manage posts scheduled to go live on your canteen and the yard feed."
};

type ScheduledRow = {
  id:             string;
  scheduled_for:  string;
  kind:           string;
  body:           string | null;
  photo_urls:     string[] | null;
  target_canteen: boolean;
  target_yard:    boolean;
  status:         string;
  posted_at:      string | null;
  failure_reason: string | null;
  created_at:     string;
};

export default async function ScheduledPostsPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await getMerchantSlug();
  if (!auth) redirect("/trade-off/signup");
  if (auth !== slug) notFound();

  const [pending, posted, failed, listing] = await Promise.all([
    supabaseAdmin
      .from("hammerex_scheduled_posts")
      .select("id, scheduled_for, kind, body, photo_urls, target_canteen, target_yard, status, posted_at, failure_reason, created_at")
      .eq("merchant_slug", slug)
      .eq("status", "pending")
      .order("scheduled_for", { ascending: true })
      .limit(50),
    supabaseAdmin
      .from("hammerex_scheduled_posts")
      .select("id, scheduled_for, kind, body, photo_urls, target_canteen, target_yard, status, posted_at, failure_reason, created_at")
      .eq("merchant_slug", slug)
      .eq("status", "posted")
      .order("posted_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("hammerex_scheduled_posts")
      .select("id, scheduled_for, kind, body, photo_urls, target_canteen, target_yard, status, posted_at, failure_reason, created_at")
      .eq("merchant_slug", slug)
      .eq("status", "failed")
      .order("scheduled_for", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("timezone, display_name")
      .eq("slug", slug)
      .maybeSingle()
  ]);

  return (
    <ScheduledPostsShell
      slug={slug}
      timezone={(listing.data as { timezone?: string } | null)?.timezone ?? "Europe/London"}
      merchantName={(listing.data as { display_name?: string } | null)?.display_name ?? slug}
      pending={(pending.data as ScheduledRow[] | null) ?? []}
      posted={(posted.data as ScheduledRow[] | null) ?? []}
      failed={(failed.data as ScheduledRow[] | null) ?? []}
    />
  );
}
