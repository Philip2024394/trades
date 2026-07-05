// Studio Blueprints browser.

import { loadStudioSession } from "@/lib/studio/session";
import { BlueprintBrowser } from "@/components/studio/blueprints/BlueprintBrowser";
// Side-effect: register every blueprint before the client tries to fetch
import "@/lib/studio/blueprints";

export const dynamic = "force-dynamic";

export default async function StudioBlueprintsPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return (
    <BlueprintBrowser
      currentSlug={session.merchant.slug}
      displayName={session.merchant.display_name}
    />
  );
}
