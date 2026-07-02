// Publish dashboard — every page for the current brand, its publish
// state, pending changes since last publish, and shareable reviewer
// preview links.

import { loadStudioSession } from "@/lib/studio/session";
import { StudioPublishDashboard } from "@/components/studio/StudioPublishDashboard";

export const dynamic = "force-dynamic";

export default async function StudioPublishPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return <StudioPublishDashboard brandName={session.brand.name} />;
}
