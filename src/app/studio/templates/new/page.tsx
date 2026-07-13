// /studio/templates/new — template authoring tool.
//
// Phase 3 of the template pipeline. You upload a reference image;
// Opus 4.7 vision extracts structural signals; the tool proposes a
// template preview + template metadata; you review + save.

import { redirect } from "next/navigation";
import { loadStudioSession } from "@/lib/studio/session";
import { TemplateAuthoringShell } from "@/components/studio/builder/TemplateAuthoringShell";

export const dynamic = "force-dynamic";

export default async function TemplateAuthorPage(): Promise<JSX.Element> {
  const session = await loadStudioSession();
  if (!session) redirect("/studio");
  return <TemplateAuthoringShell />;
}
