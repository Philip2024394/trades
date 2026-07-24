// /authors/brains/[slug]/extract — Knowledge Extraction Pipeline UI.
//
// Author pastes raw knowledge → LLM proposes structured candidates →
// Author reviews each one · Accept / Edit / Reject per candidate ·
// accepted candidates are merged into the draft module.

import { redirect } from "next/navigation";
import { getAuthorFromCookie, nexAuthorStudioEnabled } from "@/lib/nex/brains/_studio";
import { ExtractPanel } from "@/apps/author-studio/components/extract/ExtractPanel";

export default async function ExtractPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!nexAuthorStudioEnabled()) redirect("/authors");
  const authorId = await getAuthorFromCookie();
  if (!authorId) redirect("/authors");
  const { slug } = await params;
  return <ExtractPanel slug={slug} authorId={authorId} />;
}
