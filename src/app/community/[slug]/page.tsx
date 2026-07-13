// /community/[slug] — compatibility redirect back to the canonical
// canteen URL.
//
// Historical context: ADR-053 (Trade Center Week 4) added a 308
// permanent redirect from /trade-off/yard/canteens/* → /community/*
// in anticipation of a rebrand. The /community/* target never
// shipped, so the redirect chain 404'd. The redirect was disabled in
// next.config.mjs on 2026-07-12, but browsers that visited the site
// while it was live have the 308 cached — permanent redirects stick.
//
// This route absorbs those stale client-side hits and forwards them
// back to the canonical location so nobody sees a dead page.

import { redirect } from "next/navigation";

export default async function CommunitySlugCompatRedirect({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/trade-off/yard/canteens/${slug}`);
}
