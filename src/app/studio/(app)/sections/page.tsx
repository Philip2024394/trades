// Studio Section Library page.
//
// Live at /studio/sections. Server component: loads the merchant's
// brand tokens and passes them plus minimal MerchantData into the
// client browser so every card previews in the merchant's active
// theme.

import { loadStudioSession } from "@/lib/studio/session";
import { loadBrandTokens } from "@/lib/studio/tokensLoader";
import { SectionLibraryBrowser } from "@/components/studio/SectionLibraryBrowser";
import type { MerchantData } from "@/lib/studio/sectionTypes";

export const dynamic = "force-dynamic";

export default async function StudioSectionsPage() {
  const session = await loadStudioSession();
  if (!session) return null;

  const tokens = await loadBrandTokens(session.brand.id);

  const previewData: MerchantData = {
    merchantId: session.merchant.id,
    slug: session.merchant.slug,
    merchantName: session.merchant.display_name,
    city: "Leeds",
    whatsappHref: null,
    brandName: session.brand.name,
    domain: {}
  };

  return (
    <SectionLibraryBrowser
      merchantTokens={tokens}
      merchantData={previewData}
    />
  );
}
