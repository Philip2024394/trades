// Studio Button Library page.

import { loadStudioSession } from "@/lib/studio/session";
import { loadBrandTokens } from "@/lib/studio/tokensLoader";
import { ButtonLibraryBrowser } from "@/components/studio/ButtonLibraryBrowser";
import type { MerchantData } from "@/lib/studio/sectionTypes";

export const dynamic = "force-dynamic";

export default async function StudioButtonsPage() {
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
    brandId: session.brand.id,
    domain: {}
  };
  return (
    <ButtonLibraryBrowser
      merchantTokens={tokens}
      merchantData={data}
    />
  );
}
