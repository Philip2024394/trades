// Section templates — browse-catalog of every registered section.
//
// Server component loads the merchant session for context; the client
// component owns filtering, expansion, and the usage-count fetch.

import { loadStudioSession } from "@/lib/studio/session";
import { StudioTemplatesLibrary } from "@/components/studio/StudioTemplatesLibrary";

export const dynamic = "force-dynamic";

export default async function StudioTemplatesPage() {
  const session = await loadStudioSession();
  if (!session) return null;
  return (
    <StudioTemplatesLibrary
      merchantSlug={session.merchant.slug}
      brandName={session.brand.name}
    />
  );
}
