// Studio Global Buttons page.

import { loadStudioSession } from "@/lib/studio/session";
import { loadBrandTokens } from "@/lib/studio/tokensLoader";
import { GlobalButtonManager } from "@/components/studio/GlobalButtonManager";
import type { MerchantData } from "@/lib/studio/sectionTypes";

export const dynamic = "force-dynamic";

export default async function StudioGlobalButtonsPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  const tokens = await loadBrandTokens(session.brand.id);
  const data: MerchantData = {
    merchantId: session.merchant.id,
    slug: session.merchant.slug,
    merchantName: session.merchant.display_name,
    city: "Leeds",
    whatsappHref: null,
    brandName: session.brand.name,
    domain: {}
  };
  return <GlobalButtonManager merchantTokens={tokens} merchantData={data} />;
}
