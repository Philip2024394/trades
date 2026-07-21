// /trade-off/edit/[slug]/videos
// Networkers TV — trade's video management surface.
//
// Server component that loads the merchant's videos + hands them to
// the client for upload/edit/delete. Uses getMerchantSlug + validates
// the URL slug matches the signed session.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { loadWasherBag } from "@/lib/washers";
import { VideosClient } from "./VideosClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:      "Networkers TV — video library",
  robots:     { index: false, follow: false }
};

type VideoRow = {
  id:               string;
  title:            string;
  description:      string | null;
  video_url:        string;
  thumbnail_url:    string | null;
  duration_seconds: number | null;
  video_class:      "feed" | "portfolio" | "kb";
  category_slug:    string | null;
  status:           string;
  view_count:       number;
  save_count:       number;
  quote_attach_count: number;
  created_at:       string;
  expires_at:       string | null;
  published_at:     string | null;
};

export default async function VideoLibraryPage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: routeSlug } = await params;
  const sessionSlug = await getMerchantSlug();

  // Merchant-only surface — signed session must match the URL slug
  if (!sessionSlug || sessionSlug !== routeSlug) notFound();

  const { data: videosData } = await supabaseAdmin
    .from("hammerex_videos")
    .select("id, title, description, video_url, thumbnail_url, duration_seconds, video_class, category_slug, status, view_count, save_count, quote_attach_count, created_at, expires_at, published_at")
    .eq("merchant_slug", routeSlug)
    .neq("status", "removed")
    .order("created_at", { ascending: false });

  const videos: VideoRow[] = (videosData ?? []) as VideoRow[];
  const permanentCount = videos.filter((v) => v.video_class !== "feed").length;

  const bag = await loadWasherBag(routeSlug);
  const washerBalance = bag?.balance ?? 0;

  const { data: categoriesData } = await supabaseAdmin
    .from("hammerex_video_categories")
    .select("slug, display_name")
    .is("parent_slug", null)
    .order("sort_order", { ascending: true });
  const categories = (categoriesData ?? []) as Array<{ slug: string; display_name: string }>;

  return (
    <VideosClient
      merchantSlug={routeSlug}
      videos={videos}
      permanentCount={permanentCount}
      washerBalance={washerBalance}
      categories={categories}
    />
  );
}
