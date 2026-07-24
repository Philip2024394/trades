// /authors/brains/[slug]/edit — the module editor.
//
// A tabbed editor with one tab per V1 module. Author picks a module,
// edits, saves. Client-heavy — the actual editing UI is a client
// component that talks to the /api/authors endpoints.

import { redirect } from "next/navigation";
import { getAuthorFromCookie, nexAuthorStudioEnabled } from "@/lib/nex/brains/_studio";
import { BrainEditor } from "@/apps/author-studio/components/BrainEditor";

export default async function BrainEditPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!nexAuthorStudioEnabled()) redirect("/authors");
  const authorId = await getAuthorFromCookie();
  if (!authorId) redirect("/authors");
  const { slug } = await params;

  return <BrainEditor slug={slug} authorId={authorId} />;
}
