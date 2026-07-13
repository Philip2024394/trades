// /studio/editor — the admin editor.
//
// Center canvas + right sidebar (containers / heroes / buttons /
// sections, each with search + one-type-at-a-time). Add, drop, reorder,
// remove. Save to studio_layouts as drafts.

import { redirect } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { EditorShell } from "@/components/studio/editor/EditorShell";

export const dynamic = "force-dynamic";

export default async function EditorPage(): Promise<JSX.Element> {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");
  return <EditorShell brandId={session.brand.id} />;
}
