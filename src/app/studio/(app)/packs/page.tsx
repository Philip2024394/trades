// Studio Industry Pack browser.
//
// Server wrapper — loads session and hands off to the client-side
// browser. Merchants land here on first login after choosing an
// industry (Phase-9 onboarding flow) or via the "Change industry"
// button in Studio.

import { loadStudioSession } from "@/lib/studio/session";
import { StudioPackBrowser } from "@/components/studio/StudioPackBrowser";

export const dynamic = "force-dynamic";

export default async function StudioPackBrowserPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return (
    <StudioPackBrowser
      brandName={session.brand.name}
      merchantSlug={session.merchant.slug}
      primaryTrade={session.merchant.primary_trade}
    />
  );
}
