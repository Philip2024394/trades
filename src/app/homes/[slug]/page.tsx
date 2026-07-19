// /homes/[slug] — LEGACY route. Redirects to root /{slug}.
//
// Homeowner SiteBooks moved to root level (thenetworkers.app/{slug})
// on 2026-07-18 for the shortest possible URL. This file keeps old
// links + external references working via server redirect.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyHomesRedirect({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}`);
}
