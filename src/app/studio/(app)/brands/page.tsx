// Brand tokens editor — the Global panel.
//
// Server component: loads the merchant's session + current brand
// tokens from the DB (with DEFAULT_TOKENS merged in), then hands off
// to the client component that owns edits and autosave.
//
// Module 16 mounts the Brand Extraction Wizard above the token editor
// so merchants with an existing live site can seed brand tokens from
// their real brand in one flow (zero cold-start friction).

import { loadStudioSession } from "@/lib/studio/session";
import { loadBrandTokens } from "@/lib/studio/tokensLoader";
import { BrandTokensEditor } from "@/components/studio/BrandTokensEditor";
import { StudioBrandExtractWizard } from "@/components/studio/StudioBrandExtractWizard";

export const dynamic = "force-dynamic";

export default async function StudioBrandsPage() {
  const session = await loadStudioSession();
  if (!session) return null;

  const tokens = await loadBrandTokens(session.brand.id);

  return (
    <div className="space-y-6">
      <StudioBrandExtractWizard />
      <BrandTokensEditor
        initialTokens={tokens}
        brandName={session.brand.name}
      />
    </div>
  );
}
