// Studio App Store — browse route.
//
// Server wrapper that loads the session and renders the client-side
// StudioAppStore. The Store fetches from /api/platform/apps/list on
// mount so filters can be applied client-side without full-page reloads.

import { loadStudioSession } from "@/lib/studio/session";
import { StudioAppStore } from "@/components/studio/StudioAppStore";

export const dynamic = "force-dynamic";

export default async function StudioAppStorePage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return (
    <StudioAppStore
      brandName={session.brand.name}
      merchantSlug={session.merchant.slug}
    />
  );
}
