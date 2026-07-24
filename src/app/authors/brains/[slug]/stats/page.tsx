// /authors/brains/[slug]/stats — Brain Growth dashboard.

import { redirect } from "next/navigation";
import { getAuthorFromCookie, nexAuthorStudioEnabled } from "@/lib/nex/brains/_studio";
import { BrainStatsPanel } from "@/apps/author-studio/components/stats/BrainStatsPanel";

export default async function BrainStatsPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!nexAuthorStudioEnabled()) redirect("/authors");
  const authorId = await getAuthorFromCookie();
  if (!authorId) redirect("/authors");
  const { slug } = await params;
  return <BrainStatsPanel slug={slug} authorId={authorId} />;
}
